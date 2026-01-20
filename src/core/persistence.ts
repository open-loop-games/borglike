/**
 * Persistence Module
 *
 * Handles saving and loading game state using IndexedDB.
 * Provides automatic persistence and manual save/load capabilities.
 */

const DB_NAME = 'borglike-db'
const DB_VERSION = 1
const STORES = {
  PROGRESSION: 'progression',
  SETTINGS: 'settings',
  RUN_HISTORY: 'run-history',
}

let db: IDBDatabase | null = null

/**
 * Initialize the IndexedDB database
 */
export async function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      console.error('Failed to open IndexedDB:', request.error)
      reject(request.error)
    }

    request.onsuccess = () => {
      db = request.result
      resolve(db)
    }

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result

      // Create object stores
      if (!database.objectStoreNames.contains(STORES.PROGRESSION)) {
        database.createObjectStore(STORES.PROGRESSION, { keyPath: 'id' })
      }

      if (!database.objectStoreNames.contains(STORES.SETTINGS)) {
        database.createObjectStore(STORES.SETTINGS, { keyPath: 'id' })
      }

      if (!database.objectStoreNames.contains(STORES.RUN_HISTORY)) {
        const runStore = database.createObjectStore(STORES.RUN_HISTORY, { keyPath: 'id' })
        runStore.createIndex('startTime', 'startTime', { unique: false })
        runStore.createIndex('race', 'race', { unique: false })
        runStore.createIndex('class', 'class', { unique: false })
      }
    }
  })
}

/**
 * Get the database instance, initializing if needed
 */
async function getDB(): Promise<IDBDatabase> {
  if (db) return db
  return initDB()
}

/**
 * Save data to a store
 */
async function saveToStore<T>(storeName: string, key: string, data: T): Promise<void> {
  const database = await getDB()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)
    const request = store.put({ id: key, ...data, savedAt: Date.now() })

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

/**
 * Load data from a store
 */
async function loadFromStore<T>(storeName: string, key: string): Promise<T | null> {
  const database = await getDB()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readonly')
    const store = transaction.objectStore(storeName)
    const request = store.get(key)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const result = request.result
      if (result) {
        // Remove internal fields
        const { id: _id, savedAt: _savedAt, ...data } = result
        resolve(data as T)
      } else {
        resolve(null)
      }
    }
  })
}

/**
 * Delete data from a store
 */
export async function deleteFromStore(storeName: string, key: string): Promise<void> {
  const database = await getDB()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)
    const request = store.delete(key)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

/**
 * Clear all data from a store
 */
async function clearStore(storeName: string): Promise<void> {
  const database = await getDB()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)
    const request = store.clear()

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

// =============================================================================
// PROGRESSION PERSISTENCE
// =============================================================================

export interface ProgressionSaveData {
  currency: {
    essence: number
    artifacts: number
  }
  unlocks: {
    races: string[]
    classes: string[]
    runSlots: number
    upgrades: string[]
  }
  upgradeLevels: Record<string, number>
  globalStats: {
    totalRuns: number
    totalDeaths: number
    totalKills: number
    totalGold: number
    totalEssence: number
    maxDepthEver: number
  }
  prestigeLevel: number
  lifetimeEssence: number
  totalVictories: number
}

/**
 * Save progression data
 */
export async function saveProgression(data: ProgressionSaveData): Promise<void> {
  await saveToStore(STORES.PROGRESSION, 'main', data)
}

/**
 * Load progression data
 */
export async function loadProgression(): Promise<ProgressionSaveData | null> {
  return loadFromStore<ProgressionSaveData>(STORES.PROGRESSION, 'main')
}

/**
 * Clear progression data
 */
export async function clearProgression(): Promise<void> {
  await clearStore(STORES.PROGRESSION)
}

// =============================================================================
// SETTINGS PERSISTENCE
// =============================================================================

export interface SettingsSaveData {
  showGrid: boolean
  showMinimap: boolean
  animationSpeed: string
  fontSize: string
  defaultPersonality: string
  autoRestart: boolean
  turboByDefault: boolean
  soundEnabled: boolean
  musicEnabled: boolean
  volume: number
  showFPS: boolean
  debugMode: boolean
}

/**
 * Save settings data
 */
export async function saveSettings(data: SettingsSaveData): Promise<void> {
  await saveToStore(STORES.SETTINGS, 'main', data)
}

/**
 * Load settings data
 */
export async function loadSettings(): Promise<SettingsSaveData | null> {
  return loadFromStore<SettingsSaveData>(STORES.SETTINGS, 'main')
}

// =============================================================================
// RUN HISTORY PERSISTENCE
// =============================================================================

export interface RunHistoryEntry {
  id: string
  startTime: number
  endTime: number
  race: string
  class: string
  maxDepth: number
  kills: number
  goldEarned: number
  xpEarned: number
  essenceEarned: number
  deathCause?: string
  isVictory: boolean
}

/**
 * Save a run to history
 */
export async function saveRunToHistory(run: RunHistoryEntry): Promise<void> {
  const database = await getDB()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORES.RUN_HISTORY, 'readwrite')
    const store = transaction.objectStore(STORES.RUN_HISTORY)
    const request = store.put(run)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

/**
 * Load run history (most recent first)
 */
export async function loadRunHistory(limit: number = 100): Promise<RunHistoryEntry[]> {
  const database = await getDB()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORES.RUN_HISTORY, 'readonly')
    const store = transaction.objectStore(STORES.RUN_HISTORY)
    const index = store.index('startTime')
    const request = index.openCursor(null, 'prev')

    const results: RunHistoryEntry[] = []

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const cursor = request.result
      if (cursor && results.length < limit) {
        results.push(cursor.value)
        cursor.continue()
      } else {
        resolve(results)
      }
    }
  })
}

/**
 * Clear run history
 */
export async function clearRunHistory(): Promise<void> {
  await clearStore(STORES.RUN_HISTORY)
}

// =============================================================================
// GLOBAL PERSISTENCE UTILITIES
// =============================================================================

/**
 * Clear all persisted data
 */
export async function clearAllData(): Promise<void> {
  await Promise.all([
    clearStore(STORES.PROGRESSION),
    clearStore(STORES.SETTINGS),
    clearStore(STORES.RUN_HISTORY),
  ])
}

/**
 * Export all data as JSON
 */
export async function exportAllData(): Promise<object> {
  const [progression, settings, runHistory] = await Promise.all([
    loadProgression(),
    loadSettings(),
    loadRunHistory(1000),
  ])

  return {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    progression,
    settings,
    runHistory,
  }
}

/**
 * Import data from JSON export
 */
export async function importAllData(data: {
  progression?: ProgressionSaveData
  settings?: SettingsSaveData
  runHistory?: RunHistoryEntry[]
}): Promise<void> {
  const promises: Promise<void>[] = []

  if (data.progression) {
    promises.push(saveProgression(data.progression))
  }

  if (data.settings) {
    promises.push(saveSettings(data.settings))
  }

  if (data.runHistory) {
    for (const run of data.runHistory) {
      promises.push(saveRunToHistory(run))
    }
  }

  await Promise.all(promises)
}

/**
 * Check if IndexedDB is available
 */
export function isIndexedDBAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined'
  } catch {
    return false
  }
}

/**
 * Get database storage estimate
 */
export async function getStorageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate()
    return {
      usage: estimate.usage || 0,
      quota: estimate.quota || 0,
    }
  }
  return null
}
