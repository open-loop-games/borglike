/**
 * Persistence Layer for Borglike
 *
 * Uses IndexedDB to persist game progress between sessions.
 * Handles serialization of Sets and automatic saving.
 */

import { openDB, type IDBPDatabase, type DBSchema } from 'idb'
import { useProgressionStore } from './progression'
import { watch } from 'vue'
import type { Currency, UnlockState, GlobalStats, RunStats } from '@/types/progression'
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

  const data: ProgressionData = {
    version: 1,
    currency: { ...progression.currency },
    unlocks: serializeUnlocks(progression.unlocks),
    globalStats: { ...progression.globalStats },
    upgradeLevels: { ...progression.upgradeLevels },
    prestigeLevel: progression.prestigeLevel,
    lifetimeEssence: progression.lifetimeEssence,
    totalVictories: progression.totalVictories,
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

  // Restore global stats
  Object.assign(progression.globalStats, data.globalStats)

  // Restore upgrade levels
  Object.assign(progression.upgradeLevels, data.upgradeLevels)

  // Restore prestige state
  progression.prestigeLevel = data.prestigeLevel ?? 0
  progression.lifetimeEssence = data.lifetimeEssence ?? 0
  progression.totalVictories = data.totalVictories ?? 0

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
const SAVE_DEBOUNCE_MS = 2000 // 2 seconds

/**
 * Schedule a debounced save operation
 */
function scheduleSave(): void {
  if (saveTimeout) {
    clearTimeout(saveTimeout)
  }
  saveTimeout = setTimeout(async () => {
    try {
      await saveProgression()
      console.debug('[Persistence] Auto-saved progression')
    } catch (error) {
      console.error('[Persistence] Auto-save failed:', error)
    }
  }, SAVE_DEBOUNCE_MS)
}

/**
 * Set up automatic saving when store state changes
 *
 * Call this once during app initialization, after the store is created.
 */
export function setupAutoSave(): void {
  const progression = useProgressionStore()

  // Watch currency changes
  watch(() => progression.currency.essence, scheduleSave)
  watch(() => progression.currency.artifacts, scheduleSave)

  // Watch global stats changes
  watch(() => progression.globalStats.totalRuns, scheduleSave)
  watch(() => progression.globalStats.totalEssence, scheduleSave)

  // Watch prestige changes
  watch(() => progression.prestigeLevel, scheduleSave)
  watch(() => progression.lifetimeEssence, scheduleSave)

  // Watch upgrade purchases
  watch(() => Object.keys(progression.upgradeLevels).length, scheduleSave, { deep: true })

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

    Object.assign(progression.globalStats, prog.globalStats)
    Object.assign(progression.upgradeLevels, prog.upgradeLevels)

    progression.prestigeLevel = prog.prestigeLevel ?? 0
    progression.lifetimeEssence = prog.lifetimeEssence ?? 0
    progression.totalVictories = prog.totalVictories ?? 0

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
  if (hadData) {
    await loadRunHistoryIntoStore()
  }
  setupAutoSave()
  return hadData
}
