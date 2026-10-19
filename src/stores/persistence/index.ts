/**
 * Persistence Orchestration
 *
 * Public API the rest of the app imports from `@/stores/persistence`. Owns
 * the active backend instance, the Pinia auto-save watcher, the close-handler
 * cleanup, and the debounced/manual save scheduling. Talks to core.ts for
 * data shaping and to a PersistenceBackend implementation for transport.
 *
 * Picking the backend is currently hardcoded to the IDB implementation.
 * The Node TUI build will switch this to createFileBackend() — either via a
 * build-time alias or by branching here.
 */

import { watch } from 'vue'
import LZString from 'lz-string'
import type { RunStats } from '@/types/progression'
import { useProgressionStore } from '../progression'
import { useSettingsStore } from '../settings'
import {
  SAVE_VERSION,
  EXPORT_MAGIC_V2,
  serializeProgression,
  restoreProgressionFromData,
  validateProgressionData,
  buildExportPayload,
  progressionDataFromExport,
  setRunHistoryInStore,
} from './core'
import type { PersistenceBackend, BackupSlotId, BackupSlot } from './backend'

// ============================================================================
// BACKEND
// ============================================================================

// Set by initPersistence(backend). Each shell (Vue / TUI) picks its own
// implementation and injects it. Accessing any export before init crashes
// loudly — same brittleness as the previous module-load construction, just
// deferred to function-call time.
let backend!: PersistenceBackend

// ============================================================================
// LIFECYCLE STATE
// ============================================================================

const SAVE_DEBOUNCE_MS = 500
const RECENT_BACKUP_INTERVAL = 5 * 60 * 1000 // 5 minutes
const HOURLY_BACKUP_INTERVAL = 60 * 60 * 1000 // 1 hour

let saveTimeout: ReturnType<typeof setTimeout> | null = null
let autoSaveStopFn: (() => void) | null = null
let settingsAutoSaveStopFn: (() => void) | null = null
let closeHandlerCleanup: (() => void) | null = null
let lastRecentBackup = 0
let lastHourlyBackup = 0

// ============================================================================
// SAVE
// ============================================================================

async function saveWithRetry(maxRetries = 3): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const data = serializeProgression()
      await backend.saveProgression(data)
      return true
    } catch (err) {
      console.warn(`[Persistence] Save attempt ${i + 1} failed:`, err)
      if (i < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, 100 * (i + 1)))
      }
    }
  }
  console.error('[Persistence] All save attempts failed')
  return false
}

function scheduleSave(): void {
  if (saveTimeout) clearTimeout(saveTimeout)
  saveTimeout = setTimeout(async () => {
    const success = await saveWithRetry()
    if (success) {
      console.debug('[Persistence] Auto-saved progression')
      await checkAndSaveTimedBackups()
    }
  }, SAVE_DEBOUNCE_MS)
}

export async function saveProgression(): Promise<void> {
  const data = serializeProgression()
  await backend.saveProgression(data)
}

export async function saveImmediately(): Promise<void> {
  if (saveTimeout) {
    clearTimeout(saveTimeout)
    saveTimeout = null
  }
  await saveWithRetry()
}

export async function saveRun(stats: RunStats): Promise<void> {
  await backend.saveRun(stats)
}

// ============================================================================
// LOAD
// ============================================================================

export async function loadProgression(): Promise<boolean> {
  const data = await backend.loadProgression()
  if (!data) return false

  if (data.version !== SAVE_VERSION) {
    console.warn(
      `[Persistence] Save version mismatch: found ${data.version}, expected ${SAVE_VERSION}. Loading anyway.`
    )
  }

  const validation = validateProgressionData(data)
  if (!validation.valid) {
    console.error('[Persistence] Save validation failed:', validation.errors)
  }
  if (validation.repaired) {
    console.warn(
      '[Persistence] Save data was repaired:',
      validation.errors.filter((e) => e.severity === 'warning')
    )
    await backend.saveProgression(data)
  }

  restoreProgressionFromData(data)
  return true
}

export async function loadRunHistoryIntoStore(): Promise<void> {
  const runs = await backend.loadRunHistory()
  setRunHistoryInStore(runs)
}

async function loadSettingsIntoStore(): Promise<void> {
  const loaded = await backend.loadSettings()
  if (!loaded) return
  const settingsStore = useSettingsStore()
  settingsStore.applyLoadedSettings(loaded)
}

// ============================================================================
// SYNC BACKUP RECOVERY
// ============================================================================

async function recoverSyncBackupIfNewer(): Promise<void> {
  if (!backend.readSyncBackup || !backend.clearSyncBackup) return

  const backup = await backend.readSyncBackup()
  if (!backup) return

  const progression = useProgressionStore()
  const currentLifetime = progression.lifetimeEssence
  const backupLifetime = backup.lifetimeEssence ?? 0

  if (backupLifetime > currentLifetime) {
    console.info(
      `[Persistence] Restoring sync backup (${backupLifetime} > ${currentLifetime} lifetime essence)`
    )
    restoreProgressionFromData(backup)
    await saveProgression()
  }

  backend.clearSyncBackup()
}

// ============================================================================
// AUTO-SAVE
// ============================================================================

export function setupAutoSave(): () => void {
  const progression = useProgressionStore()
  const settingsStore = useSettingsStore()

  const stopProgression = watch(
    () => ({
      essence: progression.currency.essence,
      totalRuns: progression.globalStats.totalRuns,
      totalEssence: progression.globalStats.totalEssence,
      maxDepthEver: progression.globalStats.maxDepthEver,
      prestigeLevel: progression.prestigeLevel,
      starBalance: progression.starBalance,
      cycleMaxDepth: progression.cycleMaxDepth,
      lifetimeEssence: progression.lifetimeEssence,
      totalVictories: progression.totalVictories,
      upgrades: JSON.stringify(progression.upgradeLevels),
      bestiary: JSON.stringify(progression.bestiary),
      itemArmory: JSON.stringify(progression.itemArmory),
      slotConfigs: JSON.stringify(progression.slotConfigs),
      botCapabilities: JSON.stringify(progression.botCapabilities),
      races: Array.from(progression.unlocks.races).join(','),
      classes: Array.from(progression.unlocks.classes).join(','),
      boosters: Array.from(progression.unlocks.boosters).join(','),
      runSlots: progression.unlocks.runSlots,
      activeLoadout: JSON.stringify(progression.activeLoadout),
      runHistoryLength: progression.runHistory.length,
      topRunsByDepthLength: progression.topRunsByDepth.length,
      topRunsByEssenceLength: progression.topRunsByEssence.length,
      topRunsByKillsLength: progression.topRunsByKills.length,
      winHistoryLength: progression.winHistory.length,
      achievementsUnlocked: Array.from(progression.achievementState.unlocked).join(','),
      achievementsProgress: JSON.stringify(progression.achievementState.progress),
    }),
    scheduleSave,
    { deep: false }
  )
  autoSaveStopFn = stopProgression

  // Settings changes are user-driven and infrequent (clicking toggles) —
  // write through immediately, no debounce.
  const stopSettings = watch(
    () => settingsStore.settings,
    (next) => {
      void backend.saveSettings({ ...next }).catch((err) => {
        console.warn('[Persistence] Failed to save settings:', err)
      })
    },
    { deep: true }
  )
  settingsAutoSaveStopFn = stopSettings

  console.debug('[Persistence] Auto-save enabled')

  return () => {
    stopProgression()
    stopSettings()
  }
}

// ============================================================================
// BACKUP ROTATION
// ============================================================================

async function saveBackupToSlot(slot: BackupSlotId): Promise<void> {
  const data = serializeProgression()
  await backend.saveBackup(slot, { data, timestamp: Date.now() })
  console.debug(`[Persistence] Backup saved to '${slot}' slot`)
}

async function checkAndSaveTimedBackups(): Promise<void> {
  const now = Date.now()

  if (now - lastRecentBackup >= RECENT_BACKUP_INTERVAL) {
    await saveBackupToSlot('recent')
    lastRecentBackup = now
  }

  if (now - lastHourlyBackup >= HOURLY_BACKUP_INTERVAL) {
    await saveBackupToSlot('hourly')
    lastHourlyBackup = now
  }
}

export async function saveManualBackup(): Promise<void> {
  await saveBackupToSlot('manual')
  console.info('[Persistence] Manual backup saved')
}

export async function listBackups(): Promise<BackupSlot[]> {
  return backend.listBackups()
}

export async function restoreFromBackup(slot: BackupSlotId): Promise<boolean> {
  const backup = await backend.loadBackup(slot)
  if (!backup) {
    console.error(`[Persistence] No backup found in '${slot}' slot`)
    return false
  }

  const validation = validateProgressionData(backup.data)
  if (!validation.valid) {
    console.error('[Persistence] Backup validation failed:', validation.errors)
    return false
  }

  restoreProgressionFromData(backup.data)
  await saveProgression()

  console.info(
    `[Persistence] Restored from '${slot}' backup (${new Date(backup.timestamp).toLocaleString()})`
  )
  return true
}

// ============================================================================
// EXPORT / IMPORT
// ============================================================================

export async function exportDataAsJSON(): Promise<string> {
  const runs = await backend.loadRunHistory()
  const payload = buildExportPayload(runs)
  const json = JSON.stringify(payload)
  const compressed = LZString.compressToBase64(json)
  return EXPORT_MAGIC_V2 + compressed
}

export async function importDataFromJSON(input: string): Promise<boolean> {
  try {
    if (!input.startsWith(EXPORT_MAGIC_V2)) {
      console.error('[Persistence] Unrecognized export format')
      return false
    }

    const compressed = input.slice(EXPORT_MAGIC_V2.length)
    const json = LZString.decompressFromBase64(compressed)
    if (!json) {
      console.error('[Persistence] Failed to decompress import data')
      return false
    }

    const payload = JSON.parse(json) as ReturnType<typeof buildExportPayload>

    if (payload.version !== SAVE_VERSION) {
      console.warn(
        `[Persistence] Import version mismatch: ${payload.version} vs ${SAVE_VERSION}. Importing anyway.`
      )
    }

    const progressionData = progressionDataFromExport(payload)

    const validation = validateProgressionData(progressionData)
    if (!validation.valid) {
      console.error('[Persistence] Import validation failed:', validation.errors)
      return false
    }

    restoreProgressionFromData(progressionData)
    await saveProgression()

    if (payload.runHistory && Array.isArray(payload.runHistory)) {
      await backend.clearRunHistory()
      await backend.saveAllRuns(payload.runHistory)
      await loadRunHistoryIntoStore()
    }

    console.info('[Persistence] Import successful')
    return true
  } catch (error) {
    console.error('[Persistence] Import failed:', error)
    return false
  }
}

// ============================================================================
// RESET
// ============================================================================

export async function clearAllData(): Promise<void> {
  await backend.clearAll()
  console.warn('[Persistence] All saved data cleared')
}

// ============================================================================
// CLOSE HANDLER
// ============================================================================

function installCloseHandler(): void {
  if (!backend.installCloseHandler) return
  closeHandlerCleanup = backend.installCloseHandler({
    getSnapshot: () => serializeProgression(),
    flushPending: () => {
      if (saveTimeout) {
        clearTimeout(saveTimeout)
        saveTimeout = null
      }
    },
  })
}

// ============================================================================
// INIT / CLEANUP
// ============================================================================

let initialized = false

/**
 * Single entry point: install the backend, init it, hydrate Pinia stores
 * from persisted data, recover sync backup if newer, set up auto-save,
 * install close handler.
 *
 * Returns true if persisted progression was loaded, false on a fresh save.
 */
export async function initPersistence(b: PersistenceBackend): Promise<boolean> {
  if (initialized) return true

  backend = b
  await backend.init()

  const hadData = await loadProgression()
  await loadRunHistoryIntoStore()
  await loadSettingsIntoStore()
  await recoverSyncBackupIfNewer()

  setupAutoSave()
  installCloseHandler()

  initialized = true
  return hadData
}

export function cleanupPersistence(): void {
  if (autoSaveStopFn) {
    autoSaveStopFn()
    autoSaveStopFn = null
  }

  if (settingsAutoSaveStopFn) {
    settingsAutoSaveStopFn()
    settingsAutoSaveStopFn = null
  }

  if (closeHandlerCleanup) {
    closeHandlerCleanup()
    closeHandlerCleanup = null
  }

  if (saveTimeout) {
    clearTimeout(saveTimeout)
    saveTimeout = null
  }

  backend.close()
  initialized = false
  console.debug('[Persistence] Cleanup complete')
}

// ============================================================================
// RE-EXPORTS
// ============================================================================

export type { BackupSlot, BackupSlotId } from './backend'
export type { ProgressionData } from './core'
