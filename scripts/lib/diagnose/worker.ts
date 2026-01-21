/**
 * Worker thread for parallel diagnosis runs
 *
 * Tinypool worker that executes runDiagnosis in parallel.
 */

import { createGame, processTurn } from '../../../src/game/game-loop'
import { runBotTick, createBotState } from '../../../src/game/bot'
import type { GameState, BotPersonality } from '../../../src/game/types'
import type { BotState } from '../../../src/game/bot/types'
import type { DiagnoseResult, EndReason, DiagnosticIssue, AnalyzerResult } from './types'

interface WorkerInput {
  seed: number
  config: {
    raceId?: string
    classId?: string
    personality?: string
    maxTurns?: number
    circuitBreakerTurns?: number
  }
}

const DEFAULT_CONFIG = {
  raceId: 'human',
  classId: 'warrior',
  personality: 'cautious' as BotPersonality,
  maxTurns: 5000,
  circuitBreakerTurns: 1000,
  verbosity: 1 as const,
}

function runDiagnosisInWorker(input: WorkerInput): DiagnoseResult {
  const { seed, config } = input
  const cfg = { ...DEFAULT_CONFIG, ...config, seed }

  const game: GameState = createGame({
    raceId: cfg.raceId,
    classId: cfg.classId,
    seed: cfg.seed,
  })

  const botState: BotState = createBotState()
  let endReason: EndReason = 'max_turns'
  let turnsOnCurrentLevel = 0
  let currentDepth = game.character.depth

  // Basic tracking for metrics
  let stuckCount = 0
  let lastActionStr = ''
  let sameActionCount = 0
  let maxDepthReached = 0
  let totalDamageTaken = 0
  let moveCount = 0
  let waitCount = 0

  while (game.isRunning && game.turn < cfg.maxTurns) {
    const previousHP = game.character.hp
    const previousPosition = { ...game.character.position }

    const action = runBotTick(game, cfg.personality as BotPersonality, botState)
    processTurn(game, action)

    // Track movement
    const moved = previousPosition.x !== game.character.position.x ||
                  previousPosition.y !== game.character.position.y
    if (moved) moveCount++
    if (action.type === 'wait') waitCount++

    // Track damage
    if (game.character.hp < previousHP) {
      totalDamageTaken += previousHP - game.character.hp
    }

    // Track depth
    if (game.character.depth !== currentDepth) {
      currentDepth = game.character.depth
      turnsOnCurrentLevel = 0
    } else {
      turnsOnCurrentLevel++
    }
    maxDepthReached = Math.max(maxDepthReached, currentDepth)

    // Track stuck patterns
    const actionStr = JSON.stringify(action)
    if (actionStr === lastActionStr) {
      sameActionCount++
      if (sameActionCount >= 10) stuckCount++
    } else {
      sameActionCount = 1
      lastActionStr = actionStr
    }

    // End conditions
    if (game.character.hp <= 0) {
      endReason = 'death'
      break
    }
    if (game.isVictory) {
      endReason = 'victory'
      break
    }
    if (turnsOnCurrentLevel >= cfg.circuitBreakerTurns) {
      endReason = 'circuit_breaker'
      break
    }
  }

  // Build basic analyzer results
  const issues: DiagnosticIssue[] = []
  if (endReason === 'circuit_breaker') {
    issues.push({ severity: 'error', message: `Circuit breaker triggered at depth ${currentDepth}` })
  }
  if (stuckCount > 50) {
    issues.push({ severity: 'warning', message: `High stuck count: ${stuckCount}` })
  }

  const analyzerResults: AnalyzerResult[] = [{
    name: 'worker-metrics',
    metrics: {
      maxDepth: maxDepthReached,
      totalTurns: game.turn,
      moveRate: game.turn > 0 ? moveCount / game.turn : 0,
      waitRate: game.turn > 0 ? waitCount / game.turn : 0,
      stuckCount,
      kills: game.stats.kills,
      damageTaken: totalDamageTaken,
    },
    issues: [],
  }]

  return {
    seed: cfg.seed,
    config: { ...cfg, personality: cfg.personality as BotPersonality },
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
    allIssues: issues,
    hasErrors: issues.some(i => i.severity === 'error'),
    hasWarnings: issues.some(i => i.severity === 'warning'),
  }
}

// Tinypool expects a default export function
export default runDiagnosisInWorker
