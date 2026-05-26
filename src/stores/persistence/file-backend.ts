/**
 * Filesystem Persistence Backend
 *
 * Node-target implementation of PersistenceBackend. Writes JSON files under
 * the platform's user-data dir (resolved via env-paths) using atomic
 * write-temp-then-rename for crash safety.
 *
 * Layout under <data-dir>/borglike/:
 *   progression.json       — main save (single JSON document)
 *   runs.jsonl             — run history (one JSON object per line, append-only)
 *   settings.json          — user settings
 *   backups/recent.json    — rotation slots written by orchestration
 *   backups/hourly.json
 *   backups/manual.json
 *
 * No compression: debuggability beats sub-MB disk savings, and the TUI build
 * has no localStorage envelope to fit.
 *
 * No installCloseHandler: fs.writeFile is durable as soon as it resolves,
 * so there's no async-flush-on-close gap like IndexedDB has. Pending
 * orchestration-side debounce (500ms window) is the TUI shell's concern
 * via process signal handling if it cares.
 */

import { promises as fs } from 'node:fs'
import { dirname, join } from 'node:path'
import envPaths from 'env-paths'

import type { RunStats } from '@/types/progression'
import type { ProgressionData } from './core'
import type { GameSettings } from '../settings'
import type { PersistenceBackend, BackupSlotId, BackupData, BackupSlot } from './backend'

export interface FileBackendOptions {
  /** Override the data directory. Defaults to env-paths('borglike').data. */
  dataDir?: string
}

const BACKUP_SLOTS: readonly BackupSlotId[] = ['recent', 'hourly', 'manual'] as const

export function createFileBackend(options: FileBackendOptions = {}): PersistenceBackend {
  const paths = envPaths('borglike', { suffix: '' })
  const dataDir = options.dataDir ?? paths.data

  const progressionPath = join(dataDir, 'progression.json')
  const runsPath = join(dataDir, 'runs.jsonl')
  const settingsPath = join(dataDir, 'settings.json')
  const backupsDir = join(dataDir, 'backups')

  const backupPathFor = (slot: BackupSlotId): string => join(backupsDir, `${slot}.json`)

  // Per-writer counter for unique tmp filenames. Two concurrent saves used to
  // both write `path.tmp` and race on rename — first one wins, second got
  // ENOENT and burned through retries. Suffixing each write with pid+counter
  // means no two in-flight writes share a tmp name.
  let tmpCounter = 0

  async function ensureDir(dir: string): Promise<void> {
    await fs.mkdir(dir, { recursive: true })
  }

  async function atomicWriteFile(path: string, content: string): Promise<void> {
    await ensureDir(dirname(path))
    const tmpPath = `${path}.tmp.${process.pid}.${++tmpCounter}`
    try {
      await fs.writeFile(tmpPath, content, 'utf8')
      await fs.rename(tmpPath, path)
    } catch (err) {
      // Best-effort cleanup so a failed write doesn't leave orphan tmp files.
      try {
        await fs.unlink(tmpPath)
      } catch {
        // ignore — already gone or never created
      }
      throw err
    }
  }

  async function atomicWriteJson(path: string, value: unknown): Promise<void> {
    await atomicWriteFile(path, JSON.stringify(value, null, 2))
  }

  async function readJsonOrNull<T>(path: string): Promise<T | null> {
    try {
      const content = await fs.readFile(path, 'utf8')
      return JSON.parse(content) as T
    } catch (err) {
      if (isENOENT(err)) return null
      throw err
    }
  }

  return {
    async init(): Promise<void> {
      await ensureDir(dataDir)
      await ensureDir(backupsDir)
    },

    close(): void {
      // No persistent handles to release.
    },

    async loadProgression(): Promise<ProgressionData | null> {
      return readJsonOrNull<ProgressionData>(progressionPath)
    },

    async saveProgression(data: ProgressionData): Promise<void> {
      await atomicWriteJson(progressionPath, data)
    },

    async saveRun(stats: RunStats): Promise<void> {
      // Append-only JSONL — single record per line, no full rewrite on each
      // run end. Order in file is chronological; loadRunHistory reverses to
      // match IDB's `by-time` index (most-recent-first).
      await ensureDir(dirname(runsPath))
      await fs.appendFile(runsPath, JSON.stringify(stats) + '\n', 'utf8')
    },

    async saveAllRuns(runs: RunStats[]): Promise<void> {
      // Bulk replace — used during import. Atomic via tmp+rename like the
      // other writes so a crash mid-write doesn't leave a partial file.
      const content = runs.map((r) => JSON.stringify(r)).join('\n') + (runs.length ? '\n' : '')
      await atomicWriteFile(runsPath, content)
    },

    async loadRunHistory(): Promise<RunStats[]> {
      try {
        const content = await fs.readFile(runsPath, 'utf8')
        const trimmed = content.trim()
        if (!trimmed) return []
        const runs = trimmed.split('\n').map((line) => JSON.parse(line) as RunStats)
        return runs.reverse()
      } catch (err) {
        if (isENOENT(err)) return []
        throw err
      }
    },

    async clearRunHistory(): Promise<void> {
      try {
        await fs.unlink(runsPath)
      } catch (err) {
        if (!isENOENT(err)) throw err
      }
    },

    async saveBackup(slot: BackupSlotId, data: BackupData): Promise<void> {
      await atomicWriteJson(backupPathFor(slot), data)
    },

    async loadBackup(slot: BackupSlotId): Promise<BackupData | null> {
      return readJsonOrNull<BackupData>(backupPathFor(slot))
    },

    async listBackups(): Promise<BackupSlot[]> {
      const out: BackupSlot[] = []
      for (const id of BACKUP_SLOTS) {
        const backup = await readJsonOrNull<BackupData>(backupPathFor(id))
        if (backup) {
          out.push({ id, data: backup.data, timestamp: backup.timestamp })
        }
      }
      return out.sort((a, b) => b.timestamp - a.timestamp)
    },

    async loadSettings(): Promise<GameSettings | null> {
      return readJsonOrNull<GameSettings>(settingsPath)
    },

    async saveSettings(settings: GameSettings): Promise<void> {
      await atomicWriteJson(settingsPath, settings)
    },

    async clearAll(): Promise<void> {
      for (const path of [progressionPath, runsPath, settingsPath]) {
        try {
          await fs.unlink(path)
        } catch (err) {
          if (!isENOENT(err)) throw err
        }
      }
      for (const id of BACKUP_SLOTS) {
        try {
          await fs.unlink(backupPathFor(id))
        } catch (err) {
          if (!isENOENT(err)) throw err
        }
      }
    },
  }
}

function isENOENT(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as NodeJS.ErrnoException).code === 'ENOENT'
}
