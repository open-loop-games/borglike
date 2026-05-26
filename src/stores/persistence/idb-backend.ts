/**
 * IndexedDB Persistence Backend
 *
 * Browser-target implementation of PersistenceBackend. Uses idb (Jake
 * Archibald's typed wrapper around IDB) for the primary store, plus a
 * compressed localStorage snapshot installed on beforeunload as a sync
 * recovery channel since IndexedDB writes are async and may not flush
 * before the tab closes.
 */

import { openDB, type IDBPDatabase, type DBSchema } from 'idb'
import type { RunStats } from '@/types/progression'
import { compressForStorage, decompressFromStorage, type ProgressionData } from './core'
import type { GameSettings } from '../settings'
import type {
  PersistenceBackend,
  BackupSlotId,
  BackupData,
  BackupSlot,
  CloseHandlerOptions,
} from './backend'

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
  backups: {
    key: BackupSlotId
    value: BackupData
  }
}

const DB_NAME = 'borglike-progress'
const DB_VERSION = 2
const BACKUP_KEY = 'borglike-backup'
const SETTINGS_KEY = 'borglike-settings'

export function createIdbBackend(): PersistenceBackend {
  let db: IDBPDatabase<BorglikeDB> | null = null

  async function ensureDB(): Promise<IDBPDatabase<BorglikeDB>> {
    if (db) return db
    db = await openDB<BorglikeDB>(DB_NAME, DB_VERSION, {
      upgrade(database, oldVersion, _newVersion) {
        if (!database.objectStoreNames.contains('progression')) {
          database.createObjectStore('progression')
        }

        if (!database.objectStoreNames.contains('runHistory')) {
          const runStore = database.createObjectStore('runHistory', {
            keyPath: undefined,
            autoIncrement: true,
          })
          runStore.createIndex('by-time', 'startTime')
        }

        if (oldVersion < 2 && !database.objectStoreNames.contains('backups')) {
          database.createObjectStore('backups')
          console.info('[Persistence] Created backups store (DB v2)')
        }
      },
    })
    return db
  }

  return {
    async init(): Promise<void> {
      await ensureDB()
    },

    close(): void {
      if (db) {
        db.close()
        db = null
      }
    },

    async loadProgression(): Promise<ProgressionData | null> {
      const database = await ensureDB()
      const data = await database.get('progression', 'main')
      return data ?? null
    },

    async saveProgression(data: ProgressionData): Promise<void> {
      const database = await ensureDB()
      await database.put('progression', data, 'main')
    },

    async saveRun(stats: RunStats): Promise<void> {
      const database = await ensureDB()
      await database.add('runHistory', stats)
    },

    async saveAllRuns(runs: RunStats[]): Promise<void> {
      const database = await ensureDB()
      const tx = database.transaction('runHistory', 'readwrite')
      for (const run of runs) {
        await tx.store.add(run)
      }
      await tx.done
    },

    async loadRunHistory(): Promise<RunStats[]> {
      const database = await ensureDB()
      const runs = await database.getAllFromIndex('runHistory', 'by-time')
      return runs.reverse() // Most recent first
    },

    async clearRunHistory(): Promise<void> {
      const database = await ensureDB()
      await database.clear('runHistory')
    },

    async saveBackup(slot: BackupSlotId, data: BackupData): Promise<void> {
      const database = await ensureDB()
      await database.put('backups', data, slot)
    },

    async loadBackup(slot: BackupSlotId): Promise<BackupData | null> {
      const database = await ensureDB()
      const backup = await database.get('backups', slot)
      return backup ?? null
    },

    async listBackups(): Promise<BackupSlot[]> {
      const database = await ensureDB()
      const out: BackupSlot[] = []
      for (const id of ['recent', 'hourly', 'manual'] as const) {
        const backup = await database.get('backups', id)
        if (backup) {
          out.push({ id, ...backup })
        }
      }
      return out.sort((a, b) => b.timestamp - a.timestamp)
    },

    async loadSettings(): Promise<GameSettings | null> {
      try {
        const stored = localStorage.getItem(SETTINGS_KEY)
        if (!stored) return null
        return JSON.parse(stored) as GameSettings
      } catch (err) {
        console.warn('[Persistence] Failed to load settings:', err)
        return null
      }
    },

    async saveSettings(settings: GameSettings): Promise<void> {
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
      } catch (err) {
        console.warn('[Persistence] Failed to save settings:', err)
      }
    },

    async clearAll(): Promise<void> {
      const database = await ensureDB()
      await database.delete('progression', 'main')
      await database.clear('runHistory')
      localStorage.removeItem(BACKUP_KEY)
    },

    installCloseHandler(options: CloseHandlerOptions): () => void {
      const handler = () => {
        options.flushPending?.()

        try {
          const data = options.getSnapshot()
          const compressed = compressForStorage(data)
          localStorage.setItem(BACKUP_KEY, compressed)
        } catch {
          try {
            const data = options.getSnapshot()
            localStorage.setItem(BACKUP_KEY, JSON.stringify(data))
            console.warn('[Persistence] Compression failed, saved uncompressed backup')
          } catch (fallbackErr) {
            console.error('[Persistence] Failed to save backup on unload:', fallbackErr)
          }
        }
      }

      window.addEventListener('beforeunload', handler)

      return () => {
        window.removeEventListener('beforeunload', handler)
      }
    },

    async readSyncBackup(): Promise<ProgressionData | null> {
      try {
        const stored = localStorage.getItem(BACKUP_KEY)
        if (!stored) return null
        return decompressFromStorage(stored)
      } catch (err) {
        console.error('[Persistence] Failed to read sync backup:', err)
        localStorage.removeItem(BACKUP_KEY)
        return null
      }
    },

    clearSyncBackup(): void {
      localStorage.removeItem(BACKUP_KEY)
    },
  }
}
