#!/usr/bin/env npx tsx
/**
 * TUI Entry
 *
 * Boots Pinia + file persistence, starts a run in slot 0, hands the screen
 * over to the blessed renderer. Keybindings live in render.ts (close to the
 * blessed.screen instance that owns them). Quits cleanly on Ctrl-C / q.
 *
 * Invoke: pnpm exec tsx --tsconfig tsconfig.tui.json src/tui/main.ts [--data-dir <path>]
 */

// Order matters — both modules have load-time side effects that must run
// BEFORE the persistence package's module bodies execute.
//   bootstrap: sets globalThis.__APP_VERSION__ (Vite-define equivalent)
//   log:       redirects console.* to <data-dir>/tui.log so blessed's screen
//              isn't corrupted by persistence chatter
import './bootstrap'
import './log'

import { createPinia, setActivePinia } from 'pinia'

import { initPersistence, cleanupPersistence } from '@/stores/persistence'
import { createFileBackend } from '@/stores/persistence/file-backend'
import { startRun } from '@/engine/instance-manager'
import { createRenderer } from './render'

interface Args {
  dataDir?: string
}

function parseArgs(argv: string[]): Args {
  const args: Args = {}
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i]
    if (!arg) continue
    if (arg === '--data-dir') {
      args.dataDir = argv[++i]
    } else if (arg.startsWith('--data-dir=')) {
      args.dataDir = arg.slice('--data-dir='.length)
    } else if (arg === '--help' || arg === '-h') {
      printUsage()
      process.exit(0)
    } else {
      console.error(`[tui] unknown arg: ${arg}`)
      printUsage()
      process.exit(2)
    }
  }
  return args
}

function printUsage(): void {
  console.error('Usage: borglike-tui [--data-dir <path>]')
  console.error('')
  console.error('  --data-dir <path>   Override save location (default: $XDG_DATA_HOME/borglike)')
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv)

  setActivePinia(createPinia())

  const backend = createFileBackend(args.dataDir ? { dataDir: args.dataDir } : {})
  await initPersistence(backend)

  // Auto-start slot 0 so the watcher loop has something to render from frame 1.
  startRun(0)

  const renderer = createRenderer()

  const shutdown = (signal: string): void => {
    try {
      renderer.destroy()
    } catch {
      // ignore — exiting anyway
    }
    cleanupPersistence()
    console.error(`[tui] exited on ${signal}`)
    process.exit(0)
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

main().catch((err: unknown) => {
  console.error('[tui] fatal:', err)
  process.exit(1)
})
