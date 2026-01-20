/**
 * Persistence Layer for Borglike
 *
 * Uses IndexedDB to persist game progress between sessions.
 * Handles serialization of Sets and automatic saving.
 */

import { openDB, type IDBPDatabase, type DBSchema } from 'idb'
import { useProgressionStore } from './progression'
import { watch } from 'vue'
import type { Currency, UnlockState, GlobalStats, RunStats, BestiaryEntry, SlotConfig } from '@/types/progression'
import type { UpgradeState } from './progression'

// ============================================================================
// DATABASE SCHEMA
// ============================================================================

/** Serializable version of UnlockState (Sets converted to arrays) */
interface SerializedUnlockState {
  races: string[]
  classes: string[]
  runSlots: number
  upgrades: string[]
  boosters: string[]
}

/** Serializable version of RunLoadout */
interface SerializedRunLoadout {
  boosters: [string | null, string | null]
}

/** Full progression data for storage */
interface ProgressionData {
  version: number
  currency: Currency
  unlocks: SerializedUnlockState
  globalStats: GlobalStats
  upgradeLevels: UpgradeState
  prestigeLevel: number
  lifetimeEssence: number
  totalVictories: number
  activeLoadout?: SerializedRunLoadout
  bestiary?: Record<string, BestiaryEntry>
  slotConfigs?: SlotConfig[]
}

/** Database schema for type safety */
interface BorglikeDB extends DBSchema {
  progression: {
    key: 'main'
    value: ProgressionData
  }
  runHistory: {
    key: number
    value: RunStats
    indexes: { 'by-time': number }
  }
}

const DB_NAME = 'borglike-progress'
const DB_VERSION = 1

// ============================================================================
// DATABASE INITIALIZATION
// ============================================================================

let db: IDBPDatabase<BorglikeDB> | null = null

/**
 * Initialize the IndexedDB database
 */
export async function initDB(): Promise<IDBPDatabase<BorglikeDB>> {
  if (db) return db

  db = await openDB<BorglikeDB>(DB_NAME, DB_VERSION, {
    upgrade(database, _oldVersion, _newVersion) {
      // Create progression store
      if (!database.objectStoreNames.contains('progression')) {
        database.createObjectStore('progression')
      }

      // Create run history store with auto-increment
      if (!database.objectStoreNames.contains('runHistory')) {
        const runStore = database.createObjectStore('runHistory', {
          keyPath: undefined,
          autoIncrement: true,
        })
        runStore.createIndex('by-time', 'startTime')
      }
    },
  })

  return db
}

/**
 * Close the database connection
 */
export function closeDB(): void {
  if (db) {
    db.close()
    db = null
  }
}

// ============================================================================
// SERIALIZATION
// ============================================================================

/**
 * Convert Sets to arrays for JSON serialization
 */
function serializeUnlocks(unlocks: UnlockState): SerializedUnlockState {
  return {
    races: Array.from(unlocks.races),
    classes: Array.from(unlocks.classes),
    runSlots: unlocks.runSlots,
    upgrades: Array.from(unlocks.upgrades),
    boosters: Array.from(unlocks.boosters),
  }
}

/**
 * Convert arrays back to Sets after loading
 */
function deserializeUnlocks(data: SerializedUnlockState): UnlockState {
  return {
    races: new Set(data.races),
    classes: new Set(data.classes),
    runSlots: data.runSlots,
    upgrades: new Set(data.upgrades),
    boosters: new Set(data.boosters ?? []),
  }
}

// ============================================================================
// SAVE FUNCTIONS
// ============================================================================

/**
 * Save current progression state to IndexedDB
 */
export async function saveProgression(): Promise<void> {
  const database = await initDB()
  const progression = useProgressionStore()

  // Deep clone slotConfigs to strip Vue reactivity (nested boosters array is reactive)
  const serializedSlotConfigs = progression.slotConfigs.map((config) => ({
    race: config.race,
    class: config.class,
    personality: config.personality,
    boosters: [config.boosters[0], config.boosters[1]] as [string | null, string | null],
  }))

  // Deep clone bestiary to strip reactivity
  const serializedBestiary: Record<string, BestiaryEntry> = {}
  for (const [key, entry] of Object.entries(progression.bestiary)) {
    serializedBestiary[key] = { kills: entry.kills, firstKillTime: entry.firstKillTime }
  }

  const data: ProgressionData = {
    version: 1,
    currency: { essence: progression.currency.essence, artifacts: progression.currency.artifacts },
    unlocks: serializeUnlocks(progression.unlocks),
    globalStats: { ...progression.globalStats },
    upgradeLevels: { ...progression.upgradeLevels },
    prestigeLevel: progression.prestigeLevel,
    lifetimeEssence: progression.lifetimeEssence,
    totalVictories: progression.totalVictories,
    activeLoadout: { boosters: [progression.activeLoadout.boosters[0], progression.activeLoadout.boosters[1]] },
    bestiary: serializedBestiary,
    slotConfigs: serializedSlotConfigs,
  }

  await database.put('progression', data, 'main')
}

/**
 * Save a run to history
 */
export async function saveRun(run: RunStats): Promise<void> {
  const database = await initDB()
  await database.add('runHistory', run)
}

/**
 * Save all runs from the store (for bulk operations)
 */
export async function saveAllRuns(runs: RunStats[]): Promise<void> {
  const database = await initDB()
  const tx = database.transaction('runHistory', 'readwrite')

  for (const run of runs) {
    await tx.store.add(run)
  }

  await tx.done
}

// ============================================================================
// LOAD FUNCTIONS
// ============================================================================

/**
 * Load progression state from IndexedDB
 *
 * @returns true if data was loaded, false if no saved data exists
 */
export async function loadProgression(): Promise<boolean> {
  const database = await initDB()
  const data = await database.get('progression', 'main')

  if (!data) {
    return false
  }

  const progression = useProgressionStore()

  // Restore state
  progression.currency.essence = data.currency.essence
  progression.currency.artifacts = data.currency.artifacts

  // Restore unlocks (deserialize Sets)
  const unlocks = deserializeUnlocks(data.unlocks)
  progression.unlocks.races = unlocks.races
  progression.unlocks.classes = unlocks.classes
  progression.unlocks.runSlots = unlocks.runSlots
  progression.unlocks.upgrades = unlocks.upgrades
  progression.unlocks.boosters = unlocks.boosters

  // Restore global stats
  Object.assign(progression.globalStats, data.globalStats)

  // Restore upgrade levels
  Object.assign(progression.upgradeLevels, data.upgradeLevels)

  // Restore prestige state
  progression.prestigeLevel = data.prestigeLevel ?? 0
  progression.lifetimeEssence = data.lifetimeEssence ?? 0
  progression.totalVictories = data.totalVictories ?? 0

  // Restore active loadout
  if (data.activeLoadout) {
    progression.activeLoadout.boosters = data.activeLoadout.boosters
  }

  // Restore bestiary (never resets, survives prestige)
  if (data.bestiary) {
    Object.assign(progression.bestiary, data.bestiary)
  }

  // Restore slot configs
  if (data.slotConfigs) {
    progression.slotConfigs.length = 0
    progression.slotConfigs.push(...data.slotConfigs)
  }

  return true
}

/**
 * Load run history from IndexedDB
 */
export async function loadRunHistory(): Promise<RunStats[]> {
  const database = await initDB()
  const runs = await database.getAllFromIndex('runHistory', 'by-time')
  // Sort by time descending (most recent first)
  return runs.reverse()
}

/**
 * Load run history into the store
 */
export async function loadRunHistoryIntoStore(): Promise<void> {
  const progression = useProgressionStore()
  const runs = await loadRunHistory()

  // Clear existing history and add loaded runs
  progression.runHistory.length = 0
  progression.runHistory.push(...runs.slice(0, 100)) // Keep only last 100
}

// ============================================================================
// AUTO-SAVE
// ============================================================================

let saveTimeout: ReturnType<typeof setTimeout> | null = null
const SAVE_DEBOUNCE_MS = 500 // 500ms (reduced from 2000ms for faster persistence)
const BACKUP_KEY = 'borglike-backup'

/**
 * Get a snapshot of the current progression state for backup
 */
function getProgressionSnapshot(): ProgressionData {
  const progression = useProgressionStore()

  // Deep clone slotConfigs to strip Vue reactivity (nested boosters array is reactive)
  const serializedSlotConfigs = progression.slotConfigs.map((config) => ({
    race: config.race,
    class: config.class,
    personality: config.personality,
    boosters: [config.boosters[0], config.boosters[1]] as [string | null, string | null],
  }))

  // Deep clone bestiary to strip reactivity
  const serializedBestiary: Record<string, BestiaryEntry> = {}
  for (const [key, entry] of Object.entries(progression.bestiary)) {
    serializedBestiary[key] = { kills: entry.kills, firstKillTime: entry.firstKillTime }
  }

  return {
    version: 1,
    currency: { essence: progression.currency.essence, artifacts: progression.currency.artifacts },
    unlocks: serializeUnlocks(progression.unlocks),
    globalStats: { ...progression.globalStats },
    upgradeLevels: { ...progression.upgradeLevels },
    prestigeLevel: progression.prestigeLevel,
    lifetimeEssence: progression.lifetimeEssence,
    totalVictories: progression.totalVictories,
    activeLoadout: { boosters: [progression.activeLoadout.boosters[0], progression.activeLoadout.boosters[1]] },
    bestiary: serializedBestiary,
    slotConfigs: serializedSlotConfigs,
  }
}

/**
 * Save with retry logic for reliability
 */
async function saveWithRetry(maxRetries = 3): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await saveProgression()
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

/**
 * Schedule a debounced save operation
 */
function scheduleSave(): void {
  if (saveTimeout) {
    clearTimeout(saveTimeout)
  }
  saveTimeout = setTimeout(async () => {
    const success = await saveWithRetry()
    if (success) {
      console.debug('[Persistence] Auto-saved progression')
    }
  }, SAVE_DEBOUNCE_MS)
}

/**
 * Save immediately, bypassing debounce (for critical actions)
 */
export async function saveImmediately(): Promise<void> {
  if (saveTimeout) {
    clearTimeout(saveTimeout)
    saveTimeout = null
  }
  await saveWithRetry()
}

/**
 * Set up beforeunload handler to save on page close
 *
 * Uses localStorage as a synchronous backup since IndexedDB is async
 * and may not complete before the page closes.
 */
export function setupUnloadHandler(): void {
  window.addEventListener('beforeunload', () => {
    // Cancel any pending debounced save
    if (saveTimeout) {
      clearTimeout(saveTimeout)
      saveTimeout = null
    }

    // Synchronous backup to localStorage (IndexedDB may not complete in time)
    try {
      const data = getProgressionSnapshot()
      localStorage.setItem(BACKUP_KEY, JSON.stringify(data))
      console.debug('[Persistence] Backup saved to localStorage on unload')
    } catch (err) {
      console.error('[Persistence] Failed to save backup on unload:', err)
    }
  })

  console.debug('[Persistence] Unload handler installed')
}

/**
 * Check for and restore localStorage backup if it's newer than IndexedDB data
 *
 * Called during initialization to recover data that may have been lost
 * due to the browser closing before IndexedDB could complete a save.
 */
async function checkAndRestoreBackup(): Promise<void> {
  try {
    const backupJson = localStorage.getItem(BACKUP_KEY)
    if (!backupJson) return

    const backup = JSON.parse(backupJson) as ProgressionData
    const progression = useProgressionStore()

    // Compare lifetime essence - backup is newer if it has more lifetime essence
    // (lifetime essence only increases, never decreases)
    const currentLifetime = progression.lifetimeEssence
    const backupLifetime = backup.lifetimeEssence ?? 0

    if (backupLifetime > currentLifetime) {
      console.log('[Persistence] Restoring from localStorage backup (more recent data detected)')

      // Restore from backup
      progression.currency.essence = backup.currency.essence
      progression.currency.artifacts = backup.currency.artifacts

      const unlocks = deserializeUnlocks(backup.unlocks)
      progression.unlocks.races = unlocks.races
      progression.unlocks.classes = unlocks.classes
      progression.unlocks.runSlots = unlocks.runSlots
      progression.unlocks.upgrades = unlocks.upgrades
      progression.unlocks.boosters = unlocks.boosters

      Object.assign(progression.globalStats, backup.globalStats)
      Object.assign(progression.upgradeLevels, backup.upgradeLevels)

      progression.prestigeLevel = backup.prestigeLevel ?? 0
      progression.lifetimeEssence = backup.lifetimeEssence ?? 0
      progression.totalVictories = backup.totalVictories ?? 0

      if (backup.activeLoadout) {
        progression.activeLoadout.boosters = backup.activeLoadout.boosters
      }

      if (backup.bestiary) {
        Object.assign(progression.bestiary, backup.bestiary)
      }

      if (backup.slotConfigs) {
        progression.slotConfigs.length = 0
        progression.slotConfigs.push(...backup.slotConfigs)
      }

      // Save the restored data to IndexedDB
      await saveProgression()
      console.log('[Persistence] Backup restored and saved to IndexedDB')
    }

    // Clear the backup after checking (we'll create a new one on next unload)
    localStorage.removeItem(BACKUP_KEY)
  } catch (err) {
    console.error('[Persistence] Failed to check/restore backup:', err)
  }
}

/**
 * Set up automatic saving when store state changes
 *
 * Call this once during app initialization, after the store is created.
 * Uses a single watcher with a composite getter for efficiency.
 */
export function setupAutoSave(): void {
  const progression = useProgressionStore()

  // Single watcher that tracks all saveable state
  // Returns a composite value that changes when any tracked state changes
  watch(
    () => ({
      essence: progression.currency.essence,
      artifacts: progression.currency.artifacts,
      totalRuns: progression.globalStats.totalRuns,
      totalEssence: progression.globalStats.totalEssence,
      maxDepthEver: progression.globalStats.maxDepthEver,
      prestigeLevel: progression.prestigeLevel,
      lifetimeEssence: progression.lifetimeEssence,
      totalVictories: progression.totalVictories,
      // JSON.stringify captures both keys and values for complex state
      upgrades: JSON.stringify(progression.upgradeLevels),
      bestiary: JSON.stringify(progression.bestiary),
      slotConfigs: JSON.stringify(progression.slotConfigs),
      // Track unlocks (races, classes, boosters, runSlots)
      races: Array.from(progression.unlocks.races).join(','),
      classes: Array.from(progression.unlocks.classes).join(','),
      boosters: Array.from(progression.unlocks.boosters).join(','),
      runSlots: progression.unlocks.runSlots,
      // Track active loadout
      activeLoadout: JSON.stringify(progression.activeLoadout),
      // Track run history length (saves happen via saveRun, but this catches manual changes)
      runHistoryLength: progression.runHistory.length,
    }),
    scheduleSave,
    { deep: false }
  )

  console.debug('[Persistence] Auto-save enabled')
}

// ============================================================================
// EXPORT/IMPORT
// ============================================================================

/**
 * Export all game data as JSON string
 *
 * Useful for manual backup or transferring progress.
 */
export async function exportDataAsJSON(): Promise<string> {
  const progression = useProgressionStore()
  const runs = await loadRunHistory()

  const exportData = {
    version: 1,
    exportedAt: Date.now(),
    progression: {
      currency: { ...progression.currency },
      unlocks: serializeUnlocks(progression.unlocks),
      globalStats: { ...progression.globalStats },
      upgradeLevels: { ...progression.upgradeLevels },
      prestigeLevel: progression.prestigeLevel,
      lifetimeEssence: progression.lifetimeEssence,
      totalVictories: progression.totalVictories,
      activeLoadout: { boosters: [...progression.activeLoadout.boosters] },
      bestiary: { ...progression.bestiary },
      slotConfigs: progression.slotConfigs.map((config) => ({ ...config })),
    },
    runHistory: runs,
  }

  return JSON.stringify(exportData, null, 2)
}

/**
 * Import game data from JSON string
 *
 * @param jsonString - The exported JSON data
 * @returns true if import was successful
 */
export async function importDataFromJSON(jsonString: string): Promise<boolean> {
  try {
    const data = JSON.parse(jsonString)

    if (data.version !== 1) {
      console.error('[Persistence] Unsupported export version:', data.version)
      return false
    }

    const progression = useProgressionStore()

    // Import progression
    const prog = data.progression
    progression.currency.essence = prog.currency.essence
    progression.currency.artifacts = prog.currency.artifacts

    const unlocks = deserializeUnlocks(prog.unlocks)
    progression.unlocks.races = unlocks.races
    progression.unlocks.classes = unlocks.classes
    progression.unlocks.runSlots = unlocks.runSlots
    progression.unlocks.upgrades = unlocks.upgrades
    progression.unlocks.boosters = unlocks.boosters

    Object.assign(progression.globalStats, prog.globalStats)
    Object.assign(progression.upgradeLevels, prog.upgradeLevels)

    progression.prestigeLevel = prog.prestigeLevel ?? 0
    progression.lifetimeEssence = prog.lifetimeEssence ?? 0
    progression.totalVictories = prog.totalVictories ?? 0

    // Restore active loadout
    if (prog.activeLoadout) {
      progression.activeLoadout.boosters = prog.activeLoadout.boosters
    }

    // Restore bestiary
    if (prog.bestiary) {
      Object.assign(progression.bestiary, prog.bestiary)
    }

    // Restore slot configs
    if (prog.slotConfigs) {
      progression.slotConfigs.length = 0
      progression.slotConfigs.push(...prog.slotConfigs)
    }

    // Save to IndexedDB
    await saveProgression()

    // Import run history
    if (data.runHistory && Array.isArray(data.runHistory)) {
      const database = await initDB()
      // Clear existing history
      await database.clear('runHistory')
      // Add imported runs
      await saveAllRuns(data.runHistory)
      // Load into store
      await loadRunHistoryIntoStore()
    }

    return true
  } catch (error) {
    console.error('[Persistence] Import failed:', error)
    return false
  }
}

// ============================================================================
// RESET
// ============================================================================

/**
 * Clear all saved data (use with caution!)
 */
export async function clearAllData(): Promise<void> {
  const database = await initDB()
  await database.delete('progression', 'main')
  await database.clear('runHistory')
  console.warn('[Persistence] All saved data cleared')
}

// ============================================================================
// INITIALIZATION HELPER
// ============================================================================

/**
 * Initialize persistence: load saved data and set up auto-save
 *
 * Call this once during app startup.
 */
export async function initPersistence(): Promise<boolean> {
  await initDB()
  const hadData = await loadProgression()
  // Always try to load run history (might exist independently)
  await loadRunHistoryIntoStore()
  // Check for localStorage backup and restore if newer
  await checkAndRestoreBackup()
  // Set up auto-save and unload handler
  setupAutoSave()
  setupUnloadHandler()
  return hadData
}
