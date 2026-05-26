#!/usr/bin/env npx tsx
/**
 * TUI Entry
 *
 * Boots Pinia + file persistence, starts a run, hands the screen over to the
 * blessed renderer. Ctrl-C / q quits cleanly. Step 5 — rendering only, no
 * meta-control input yet (pause/speed/slot-cycle land in step 6).
 *
 * Invoke: pnpm exec tsx --tsconfig tsconfig.tui.json src/tui/main.ts
 */

// MUST be first — sets globalThis.__APP_VERSION__ before persistence loads.
import './bootstrap'

import { createPinia, setActivePinia } from 'pinia'

import { initPersistence, cleanupPersistence } from '@/stores/persistence'
import { createFileBackend } from '@/stores/persistence/file-backend'
import { startRun, stopRun } from '@/engine/instance-manager'
import { createRenderer } from './render'

async function main(): Promise<void> {
  setActivePinia(createPinia())

  const backend = createFileBackend()
  const hadData = await initPersistence(backend)
  if (!hadData) {
    // Visible in the feed once the renderer is up; harmless to also log here.
    console.error('[tui] starting from fresh save')
  }

  const runId = startRun(0)
  const renderer = createRenderer(0)

  const shutdown = (signal: string): void => {
    try {
      renderer.destroy()
    } catch {
      // ignore — process is exiting anyway
    }
    try {
      stopRun(runId)
    } catch (err) {
      console.error('[tui] error stopping run:', err)
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
