#!/usr/bin/env npx tsx
/**
 * Minimal TUI Entry — Headless Engine Smoke
 *
 * Proves the engine pipeline (instance-manager + game + bot + stores) runs in
 * Node under file persistence. No blessed yet — logs slot 0's run state to
 * stdout every 2 seconds. Ctrl-C to stop.
 *
 * Invoke: pnpm exec tsx --tsconfig tsconfig.tui.json src/tui/main.ts
 */

// MUST be first — sets globalThis.__APP_VERSION__ before persistence loads.
import './bootstrap'

import { createPinia, setActivePinia } from 'pinia'

import { initPersistence, cleanupPersistence } from '@/stores/persistence'
import { createFileBackend } from '@/stores/persistence/file-backend'
import { startRun, stopRun } from '@/engine/instance-manager'
import { useRunsStore } from '@/stores/runs'
import { useProgressionStore } from '@/stores/progression'

async function main(): Promise<void> {
  setActivePinia(createPinia())

  const backend = createFileBackend()
  console.log('[tui] initializing persistence...')
  const hadData = await initPersistence(backend)
  console.log(`[tui] persistence ready (${hadData ? 'loaded existing' : 'fresh save'})`)

  const progression = useProgressionStore()
  const runs = useRunsStore()

  console.log(
    `[tui] essence=${progression.currency.essence} ` +
      `slots=${progression.unlocks.runSlots} ` +
      `races=${progression.unlocks.races.size} ` +
      `classes=${progression.unlocks.classes.size}`
  )

  const runId = startRun(0)
  console.log(`[tui] started run ${runId} in slot 0`)

  const logInterval = setInterval(() => {
    const run = runs.getRun(runId)
    if (!run) {
      console.log('[tui] run vanished from store')
      return
    }
    const goal = run.botGoal ?? '—'
    console.log(
      `[tui] T${run.turns} D${run.depth} ` +
        `HP=${run.hp}/${run.maxHp} MP=${run.mp}/${run.maxMp} ` +
        `lvl=${run.level} kills=${run.kills} gold=${run.gold} ` +
        `state=${run.state} | ${goal}`
    )
    if (run.state === 'dead' || run.state === 'victory') {
      console.log(`[tui] run ended: ${run.state}`)
    }
  }, 2000)

  const shutdown = (signal: string) => {
    console.log(`\n[tui] ${signal} received, shutting down...`)
    clearInterval(logInterval)
    try {
      stopRun(runId)
    } catch (err) {
      console.error('[tui] error stopping run:', err)
    }
    cleanupPersistence()
    process.exit(0)
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

main().catch((err: unknown) => {
  console.error('[tui] fatal:', err)
  process.exit(1)
})
