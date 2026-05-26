/**
 * Persistence Backend Interface
 *
 * Transport-level API the rest of the app talks to without knowing whether
 * data lives in IndexedDB, on disk, or anywhere else. Implementations live
 * in idb-backend.ts (current shipping target) and will grow a file-backend
 * for the Node TUI build.
 *
 * Snapshot/restore against Pinia, validation, compression, and auto-save
 * orchestration live in core.ts and index.ts — none of that knows or cares
 * which backend is plugged in.
 */

import type { RunStats } from '@/types/progression'
import type { ProgressionData } from './core'
import type { GameSettings } from '../settings'

export type BackupSlotId = 'recent' | 'hourly' | 'manual'

export interface BackupData {
  data: ProgressionData
  timestamp: number
}

/** Public backup info for UI consumers */
export interface BackupSlot {
  id: BackupSlotId
  data: ProgressionData
  timestamp: number
}

export interface CloseHandlerOptions {
  /** Returns a fresh ProgressionData snapshot to write synchronously on close. */
  getSnapshot: () => ProgressionData
  /** Cancels any pending debounced save so the close-write isn't superseded. */
  flushPending?: () => void
}

export interface PersistenceBackend {
  init(): Promise<void>
  close(): void

  // Progression
  loadProgression(): Promise<ProgressionData | null>
  saveProgression(data: ProgressionData): Promise<void>

  // Run history
  saveRun(stats: RunStats): Promise<void>
  saveAllRuns(runs: RunStats[]): Promise<void>
  loadRunHistory(): Promise<RunStats[]>
  clearRunHistory(): Promise<void>

  // Backup rotation
  saveBackup(slot: BackupSlotId, data: BackupData): Promise<void>
  loadBackup(slot: BackupSlotId): Promise<BackupData | null>
  listBackups(): Promise<BackupSlot[]>

  // Settings (cross-shell user preferences)
  loadSettings(): Promise<GameSettings | null>
  saveSettings(settings: GameSettings): Promise<void>

  // Reset
  clearAll(): Promise<void>

  /**
   * Install a shell-lifecycle close hook. IDB backend uses this to wire a
   * beforeunload handler + localStorage sync-backup; file backends can wire
   * process signal handlers, or no-op if their writes are already durable.
   *
   * Returns a cleanup function to remove the hook.
   */
  installCloseHandler?(options: CloseHandlerOptions): () => void

  /**
   * Read the sync-backup snapshot (e.g. the IDB backend's localStorage
   * snapshot from beforeunload). Returns null if no snapshot exists or it's
   * unreadable. Backends without a sync-backup channel omit this method.
   *
   * The orchestration layer compares the snapshot's lifetime essence to the
   * current store and restores it if newer; this method is pure read.
   */
  readSyncBackup?(): Promise<ProgressionData | null>

  /** Clear the sync-backup snapshot (after restore or invalidation). */
  clearSyncBackup?(): void
}
