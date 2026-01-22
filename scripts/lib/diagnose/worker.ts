/**
 * Worker thread for parallel diagnosis runs
 *
 * Tinypool worker that executes runDiagnosis in parallel.
 */

import { createGame, processTurn } from '../../../src/game/game-loop'
import { computeMaxUpgradeBonuses } from '../../../src/game/upgrade-effects'
import { runBotTick, createBotState } from '../../../src/game/bot'
import { calculateCombatStats, calculateStats } from '../../../src/game/character'
import type { GameState, BotPersonality, BalanceOverrides } from '../../../src/game/types'
import { DEFAULT_BALANCE } from '../../../src/game/types'
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
    maxUpgrades?: boolean
    randomize?: boolean
    balance?: Partial<BalanceOverrides>
  }
}

// Available options for randomization
const RACES = ['human', 'dwarf', 'elf', 'half_elf', 'hobbit', 'gnome', 'half_orc', 'half_troll', 'dunadan', 'high_elf', 'kobold']
const CLASSES = ['warrior', 'mage', 'rogue', 'priest', 'ranger', 'paladin', 'necromancer', 'berserker', 'archmage', 'druid', 'blackguard', 'monk', 'bard']
const PERSONALITIES: BotPersonality[] = ['cautious', 'aggressive', 'greedy', 'speedrunner']

function pickRandom<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length]
}

const DEFAULT_CONFIG = {
  raceId: 'human',
  classId: 'warrior',
  personality: 'cautious' as BotPersonality,
  maxTurns: 5000,
  circuitBreakerTurns: 1000,
  verbosity: 1 as const,
  maxUpgrades: false,
  randomize: false,
  balance: DEFAULT_BALANCE,
}

function runDiagnosisInWorker(input: WorkerInput): DiagnoseResult {
  const { seed, config } = input
  const cfg = { ...DEFAULT_CONFIG, ...config, seed }

  // Handle randomization - use seed to deterministically pick options
  if (cfg.randomize) {
    cfg.raceId = pickRandom(RACES, seed)
    cfg.classId = pickRandom(CLASSES, Math.floor(seed / RACES.length))
    cfg.personality = pickRandom(PERSONALITIES, Math.floor(seed / (RACES.length * CLASSES.length)))
  }

  // Merge balance overrides
  const balance = { ...DEFAULT_BALANCE, ...config.balance }

  const game: GameState = createGame({
    raceId: cfg.raceId,
    classId: cfg.classId,
    seed: cfg.seed,
    upgradeBonuses: cfg.maxUpgrades ? computeMaxUpgradeBonuses(balance.upgradePowerPercent) : undefined,
    balanceOverrides: balance,
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
  let killedBy: string | null = null

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
      // Find adjacent monster as likely killer
      const adjacentMonsters = game.monsters.filter(m => {
        const dx = Math.abs(m.position.x - game.character.position.x)
        const dy = Math.abs(m.position.y - game.character.position.y)
        return dx <= 1 && dy <= 1 && m.hp > 0
      })
      if (adjacentMonsters.length > 0) {
        killedBy = adjacentMonsters[0].template.name
      }
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
  if (stuckCount > 100) {  // Raised from 50 - normal corridor exploration can accumulate stuck counts
    issues.push({ severity: 'warning', message: `High stuck count: ${stuckCount}` })
  }

  // Calculate final combat stats
  const char = game.character
  const stats = calculateStats(char)
  const combatStats = calculateCombatStats(char)
  const weapon = char.equipment.weapon
  const armorItem = char.equipment.armor
  const bow = char.equipment.bow

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
      killedBy: killedBy ?? 'unknown',
    },
    issues: [],
  }, {
    name: 'stats',
    metrics: {
      'final.level': char.level,
      'final.depth': char.depth,
      'final.armor': combatStats.armor,
      'final.meleeDamage': combatStats.meleeDamage,
      'final.rangedDamage': combatStats.rangedDamage,
      'final.accuracy': combatStats.accuracy,
      'final.evasion': combatStats.evasion,
      'final.maxHp': combatStats.maxHp,
      'final.speed': combatStats.speed,
      'final.str': stats.str,
      'final.dex': stats.dex,
      'final.con': stats.con,
      'final.weaponEnchant': weapon?.enchantment ?? 0,
      'final.armorProtection': armorItem ? (armorItem.template.protection ?? 0) + armorItem.enchantment : 0,
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
