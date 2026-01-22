/**
 * Diagnostic Runner
 *
 * Core game loop that runs the bot and dispatches events to analyzers.
 */

import Tinypool from 'tinypool'
import { cpus } from 'os'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { createGame, processTurn } from '../../../src/game/game-loop'
import { computeMaxUpgradeBonuses } from '../../../src/game/upgrade-effects'
import { DEFAULT_BALANCE, type BalanceOverrides } from '../../../src/game/types'
import { runBotTick, createBotState } from '../../../src/game/bot'
import type { GameState } from '../../../src/game/types'
import type { BotState } from '../../../src/game/bot/types'
import type {
  DiagnoseConfig,
  DiagnoseResult,
  BatchConfig,
  BatchResult,
  EndReason,
  TurnContext,
  PostTurnContext,
  DiagnosticIssue,
} from './types'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// ============================================================================
// DEFAULTS
// ============================================================================

const DEFAULT_CONFIG: Required<Omit<DiagnoseConfig, 'analyzers'>> = {
  seed: Date.now(),
  raceId: 'human',
  classId: 'warrior',
  personality: 'cautious',
  maxTurns: 5000,
  circuitBreakerTurns: 1000,
  verbosity: 1,
  maxUpgrades: false,
  randomize: false,
  balance: DEFAULT_BALANCE,
}

// ============================================================================
// SINGLE RUN
// ============================================================================

/**
 * Run a single diagnostic session
 */
export function runDiagnosis(config: DiagnoseConfig): DiagnoseResult {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const analyzers = config.analyzers ?? []

  // Create game
  const game: GameState = createGame({
    raceId: cfg.raceId,
    classId: cfg.classId,
    seed: cfg.seed,
    upgradeBonuses: cfg.maxUpgrades ? computeMaxUpgradeBonuses(cfg.balance.upgradePowerPercent) : undefined,
    balanceOverrides: cfg.balance,
  })

  const botState: BotState = createBotState()
  let endReason: EndReason = 'max_turns'
  let turnsOnCurrentLevel = 0
  let currentDepth = game.character.depth

  // Notify analyzers of start
  for (const analyzer of analyzers) {
    analyzer.onStart?.(game, botState)
  }

  // Main loop
  while (game.isRunning && game.turn < cfg.maxTurns) {
    const turn = game.turn
    const previousPosition = { ...game.character.position }
    const previousHP = game.character.hp
    const previousDepth = game.character.depth

    // Get bot action
    const action = runBotTick(game, cfg.personality, botState)

    // Build turn context
    const turnCtx: TurnContext = {
      game,
      botState,
      action,
      turn,
    }

    // Notify analyzers pre-turn
    for (const analyzer of analyzers) {
      analyzer.onTurn?.(turnCtx)
    }

    // Process turn
    processTurn(game, action)

    // Check for level change
    if (game.character.depth !== currentDepth) {
      const oldDepth = currentDepth
      currentDepth = game.character.depth
      turnsOnCurrentLevel = 0

      for (const analyzer of analyzers) {
        analyzer.onLevelChange?.(game, oldDepth, currentDepth)
      }
    } else {
      turnsOnCurrentLevel++
    }

    // Build post-turn context
    const moved =
      previousPosition.x !== game.character.position.x ||
      previousPosition.y !== game.character.position.y

    const postCtx: PostTurnContext = {
      ...turnCtx,
      moved,
      previousPosition,
      previousHP,
      previousDepth,
    }

    // Notify analyzers post-turn
    for (const analyzer of analyzers) {
      analyzer.onPostTurn?.(postCtx)
    }

    // Check end conditions
    if (game.character.hp <= 0) {
      endReason = 'death'
      break
    }

    if (game.isVictory) {
      endReason = 'victory'
      break
    }

    // Circuit breaker
    if (turnsOnCurrentLevel >= cfg.circuitBreakerTurns) {
      endReason = 'circuit_breaker'
      break
    }
  }

  // Notify analyzers of end
  for (const analyzer of analyzers) {
    analyzer.onEnd?.(game, endReason)
  }

  // Collect results
  const analyzerResults = analyzers.map((a) => a.summarize())
  const allIssues: DiagnosticIssue[] = analyzerResults.flatMap((r) => r.issues)

  return {
    seed: cfg.seed,
    config: cfg,
    endReason,
    finalState: {
      turn: game.turn,
      depth: game.character.depth,
      hp: game.character.hp,
      maxHp: game.character.maxHp,
      kills: game.stats.kills,
      gold: game.character.gold,
      position: { ...game.character.position },
    },
    analyzerResults,
    allIssues,
    hasErrors: allIssues.some((i) => i.severity === 'error'),
    hasWarnings: allIssues.some((i) => i.severity === 'warning'),
  }
}

// ============================================================================
// BATCH RUNS
// ============================================================================

/**
 * Run multiple diagnostic sessions and aggregate results
 */
export function runBatchDiagnosis(config: BatchConfig): BatchResult {
  const startSeed = config.startSeed ?? Date.now()
  const results: DiagnoseResult[] = []
  const problemRuns: DiagnoseResult[] = []

  // Aggregate metrics across runs
  const metricSums: Record<string, number[]> = {}
  const issueCounter = new Map<string, number>()
  const deathCauses = new Map<string, number>()

  for (let i = 0; i < config.runs; i++) {
    const seed = startSeed + i
    const result = runDiagnosis({
      ...config,
      seed,
    })

    results.push(result)

    if (result.hasErrors || result.hasWarnings) {
      problemRuns.push(result)
    }

    // Aggregate metrics from each analyzer
    for (const ar of result.analyzerResults) {
      for (const [key, value] of Object.entries(ar.metrics)) {
        if (typeof value === 'number') {
          const fullKey = `${ar.name}.${key}`
          if (!metricSums[fullKey]) {
            metricSums[fullKey] = []
          }
          metricSums[fullKey].push(value)
        } else if (key === 'killedBy' && typeof value === 'string' && result.endReason === 'death') {
          const count = deathCauses.get(value) ?? 0
          deathCauses.set(value, count + 1)
        }
      }
    }

    // Count issues
    for (const issue of result.allIssues) {
      const count = issueCounter.get(issue.message) ?? 0
      issueCounter.set(issue.message, count + 1)
    }
  }

  // Compute aggregate metrics
  const aggregateMetrics: Record<string, { min: number; max: number; avg: number }> = {}
  for (const [key, values] of Object.entries(metricSums)) {
    if (values.length > 0) {
      aggregateMetrics[key] = {
        min: Math.min(...values),
        max: Math.max(...values),
        avg: values.reduce((a, b) => a + b, 0) / values.length,
      }
    }
  }

  // Sort issues by frequency
  const aggregateIssues = Array.from(issueCounter.entries())
    .map(([message, count]) => ({ message, count }))
    .sort((a, b) => b.count - a.count)

  // Sort death causes by frequency
  const sortedDeathCauses = Array.from(deathCauses.entries())
    .map(([monster, count]) => ({ monster, count }))
    .sort((a, b) => b.count - a.count)

  return {
    config,
    totalRuns: config.runs,
    successfulRuns: results.length - problemRuns.length,
    problemRuns,
    aggregateMetrics,
    aggregateIssues,
    deathCauses: sortedDeathCauses,
  }
}

// ============================================================================
// PARALLEL BATCH RUNS
// ============================================================================

/** Extended batch config with thread count */
export interface ParallelBatchConfig extends BatchConfig {
  /** Number of worker threads (default: 8, max: CPU count) */
  threads?: number
  /** Progress callback */
  onProgress?: (completed: number, total: number) => void
}

export interface WorkerInput {
  seed: number
  config: {
    raceId?: string
    classId?: string
    personality?: string
    maxTurns?: number
    circuitBreakerTurns?: number
    maxUpgrades?: boolean
    randomize?: boolean
    balance?: Partial<BalanceOverrides>
  }
}

/**
 * Run multiple diagnostic sessions in parallel using worker threads
 */
export async function runBatchDiagnosisParallel(config: ParallelBatchConfig): Promise<BatchResult> {
  const startSeed = config.startSeed ?? Date.now()
  const threadCount = Math.min(config.threads ?? 8, cpus().length)
  const workerPath = join(__dirname, 'worker.ts')

  const results: DiagnoseResult[] = []
  const problemRuns: DiagnoseResult[] = []

  // Aggregate metrics across runs
  const metricSums: Record<string, number[]> = {}
  const issueCounter = new Map<string, number>()
  const deathCauses = new Map<string, number>() // Track what killed us

  // Build work items
  const baseConfig = {
    raceId: config.raceId,
    classId: config.classId,
    personality: config.personality,
    maxTurns: config.maxTurns,
    circuitBreakerTurns: config.circuitBreakerTurns,
    maxUpgrades: config.maxUpgrades,
    randomize: config.randomize,
    balance: config.balance,
  }

  const workItems: WorkerInput[] = []
  for (let i = 0; i < config.runs; i++) {
    workItems.push({ seed: startSeed + i, config: baseConfig })
  }

  let completed = 0
  const total = workItems.length

  // Create thread pool with tsx loader
  const pool = new Tinypool({
    filename: workerPath,
    minThreads: threadCount,
    maxThreads: threadCount,
    runtime: 'child_process',
    execArgv: ['--import', 'tsx/esm'],
  })

  try {
    // Run all tasks in parallel
    const promises = workItems.map(async (item) => {
      const result: DiagnoseResult = await pool.run(item)

      results.push(result)

      if (result.hasErrors || result.hasWarnings) {
        problemRuns.push(result)
      }

      // Aggregate metrics
      for (const ar of result.analyzerResults) {
        for (const [key, value] of Object.entries(ar.metrics)) {
          if (typeof value === 'number') {
            const fullKey = `${ar.name}.${key}`
            if (!metricSums[fullKey]) {
              metricSums[fullKey] = []
            }
            metricSums[fullKey].push(value)
          } else if (key === 'killedBy' && typeof value === 'string' && result.endReason === 'death') {
            // Track death causes
            const count = deathCauses.get(value) ?? 0
            deathCauses.set(value, count + 1)
          }
        }
      }

      // Count issues
      for (const issue of result.allIssues) {
        const count = issueCounter.get(issue.message) ?? 0
        issueCounter.set(issue.message, count + 1)
      }

      completed++
      config.onProgress?.(completed, total)
    })

    await Promise.all(promises)
  } finally {
    await pool.destroy()
  }

  // Compute aggregate metrics
  const aggregateMetrics: Record<string, { min: number; max: number; avg: number }> = {}
  for (const [key, values] of Object.entries(metricSums)) {
    if (values.length > 0) {
      aggregateMetrics[key] = {
        min: Math.min(...values),
        max: Math.max(...values),
        avg: values.reduce((a, b) => a + b, 0) / values.length,
      }
    }
  }

  // Sort issues by frequency
  const aggregateIssues = Array.from(issueCounter.entries())
    .map(([message, count]) => ({ message, count }))
    .sort((a, b) => b.count - a.count)

  // Sort death causes by frequency
  const sortedDeathCauses = Array.from(deathCauses.entries())
    .map(([monster, count]) => ({ monster, count }))
    .sort((a, b) => b.count - a.count)

  return {
    config,
    totalRuns: config.runs,
    successfulRuns: results.length - problemRuns.length,
    problemRuns,
    aggregateMetrics,
    aggregateIssues,
    deathCauses: sortedDeathCauses,
  }
}

// ============================================================================
// DEEP DIVE (single seed, verbose output)
// ============================================================================

/** Turn log entry for deep dive mode */
export interface TurnLogEntry {
  turn: number
  position: { x: number; y: number }
  hp: number
  depth: number
  goal: string | null
  action: string
  moved: boolean
  flags: string[]
}

/**
 * Run a deep diagnostic on a single seed with full turn logging
 */
export function runDeepDiagnosis(
  config: DiagnoseConfig
): DiagnoseResult & { turnLog: TurnLogEntry[] } {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const analyzers = config.analyzers ?? []
  const turnLog: TurnLogEntry[] = []

  // Create game
  const game: GameState = createGame({
    raceId: cfg.raceId,
    classId: cfg.classId,
    seed: cfg.seed,
    upgradeBonuses: cfg.maxUpgrades ? computeMaxUpgradeBonuses(cfg.balance.upgradePowerPercent) : undefined,
    balanceOverrides: cfg.balance,
  })

  const botState: BotState = createBotState()
  let endReason: EndReason = 'max_turns'
  let turnsOnCurrentLevel = 0
  let currentDepth = game.character.depth

  // Track repeated actions for stuck detection
  let lastActionStr = ''
  let sameActionCount = 0

  // Notify analyzers of start
  for (const analyzer of analyzers) {
    analyzer.onStart?.(game, botState)
  }

  // Main loop
  while (game.isRunning && game.turn < cfg.maxTurns) {
    const turn = game.turn
    const previousPosition = { ...game.character.position }
    const previousHP = game.character.hp
    const previousDepth = game.character.depth

    // Get bot action
    const action = runBotTick(game, cfg.personality, botState)

    // Build action string BEFORE processTurn (items/monsters may be consumed/killed)
    let actionType: string
    switch (action.type) {
      case 'move':
        actionType = `move:${action.direction}`
        break
      case 'use': {
        const useItem = game.character.inventory.find(i => i.id === (action as any).itemId)
        actionType = useItem ? `use:${useItem.template.name}` : `use:${(action as any).itemId}`
        break
      }
      case 'attack':
      case 'ranged_attack': {
        const target = game.monsters.find(m => m.id === (action as any).targetId)
        actionType = target ? `${action.type}:${target.template.name}` : action.type
        break
      }
      case 'cast':
        actionType = `cast:${(action as any).spellId}`
        break
      default:
        actionType = action.type
    }

    // Build turn context
    const turnCtx: TurnContext = {
      game,
      botState,
      action,
      turn,
    }

    // Notify analyzers pre-turn
    for (const analyzer of analyzers) {
      analyzer.onTurn?.(turnCtx)
    }

    // Process turn
    processTurn(game, action)

    // Check for level change
    if (game.character.depth !== currentDepth) {
      const oldDepth = currentDepth
      currentDepth = game.character.depth
      turnsOnCurrentLevel = 0

      for (const analyzer of analyzers) {
        analyzer.onLevelChange?.(game, oldDepth, currentDepth)
      }
    } else {
      turnsOnCurrentLevel++
    }

    // Build post-turn context
    const moved =
      previousPosition.x !== game.character.position.x ||
      previousPosition.y !== game.character.position.y

    const postCtx: PostTurnContext = {
      ...turnCtx,
      moved,
      previousPosition,
      previousHP,
      previousDepth,
    }

    // Notify analyzers post-turn
    for (const analyzer of analyzers) {
      analyzer.onPostTurn?.(postCtx)
    }

    // Track repeated actions
    const actionStr = JSON.stringify(action)
    if (actionStr === lastActionStr) {
      sameActionCount++
    } else {
      sameActionCount = 1
      lastActionStr = actionStr
    }

    // Build flags
    const flags: string[] = []
    if (moved) flags.push('MOVED')
    if (previousDepth !== game.character.depth) flags.push('DESCENDED')
    if (previousHP > game.character.hp) flags.push('DAMAGE')
    if (sameActionCount >= 10) flags.push(`STUCK:${sameActionCount}`)  // Raised from 5 - corridors often have 10+ same-direction moves

    const goal = botState.currentGoal
    const goalStr = goal ? `${goal.type}@(${goal.target?.x},${goal.target?.y})` : null

    turnLog.push({
      turn,
      position: { ...game.character.position },
      hp: game.character.hp,
      depth: game.character.depth,
      goal: goalStr,
      action: actionType,
      moved,
      flags,
    })

    // Check end conditions
    if (game.character.hp <= 0) {
      endReason = 'death'
      break
    }

    if (game.isVictory) {
      endReason = 'victory'
      break
    }

    // Circuit breaker
    if (turnsOnCurrentLevel >= cfg.circuitBreakerTurns) {
      endReason = 'circuit_breaker'
      break
    }
  }

  // Notify analyzers of end
  for (const analyzer of analyzers) {
    analyzer.onEnd?.(game, endReason)
  }

  // Collect results
  const analyzerResults = analyzers.map((a) => a.summarize())
  const allIssues: DiagnosticIssue[] = analyzerResults.flatMap((r) => r.issues)

  return {
    seed: cfg.seed,
    config: cfg,
    endReason,
    finalState: {
      turn: game.turn,
      depth: game.character.depth,
      hp: game.character.hp,
      maxHp: game.character.maxHp,
      kills: game.stats.kills,
      gold: game.character.gold,
      position: { ...game.character.position },
    },
    analyzerResults,
    allIssues,
    hasErrors: allIssues.some((i) => i.severity === 'error'),
    hasWarnings: allIssues.some((i) => i.severity === 'warning'),
    turnLog,
  }
}
