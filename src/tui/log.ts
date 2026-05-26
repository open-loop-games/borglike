/**
 * Console Redirect
 *
 * Blessed owns the terminal as a full-screen alternate buffer. Any `console.*`
 * call writes directly to stdout/stderr and corrupts the rendered screen.
 *
 * This module — imported BEFORE the persistence package — replaces the global
 * console methods with appenders that write to `<data-dir>/tui.log`. Persistence
 * is the chattiest source (auto-save, backup rotation, version warnings) but
 * the redirect catches anything else too (Vue warnings, Pinia warnings, etc.).
 *
 * The log file is append-only. Tail it during dev:
 *   tail -f ~/.local/share/borglike/tui.log
 */

import { mkdirSync, createWriteStream } from 'node:fs'
import { join } from 'node:path'
import envPaths from 'env-paths'

function dataDirFromArgv(argv: string[]): string | undefined {
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--data-dir') return argv[i + 1]
    if (arg?.startsWith('--data-dir=')) return arg.slice('--data-dir='.length)
  }
  return undefined
}

const dataDir = dataDirFromArgv(process.argv) ?? envPaths('borglike', { suffix: '' }).data

mkdirSync(dataDir, { recursive: true })

const LOG_PATH = join(dataDir, 'tui.log')
const stream = createWriteStream(LOG_PATH, { flags: 'a' })

stream.write(`\n--- session start ${new Date().toISOString()} pid=${process.pid} ---\n`)

function formatArg(v: unknown): string {
  if (v instanceof Error) return v.stack ?? `${v.name}: ${v.message}`
  if (typeof v === 'object' && v !== null) {
    try {
      return JSON.stringify(v)
    } catch {
      return String(v)
    }
  }
  return String(v)
}

function logTo(level: string): (...args: unknown[]) => void {
  return (...args) => {
    const ts = new Date().toISOString()
    stream.write(`[${ts}] [${level}] ${args.map(formatArg).join(' ')}\n`)
  }
}

console.log = logTo('log')
console.info = logTo('info')
console.debug = logTo('debug')
console.warn = logTo('warn')
console.error = logTo('error')

export const TUI_LOG_PATH = LOG_PATH
