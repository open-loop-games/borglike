/**
 * Bot AI Validation Test
 * Run with: npx tsx scripts/validate-bot.ts
 *
 * Validates the bot against all success metrics from BOT-AI-PLAN.md:
 * - Stairs found: >95%
 * - Average depth: >5
 * - Oscillation rate: <1%
 * - Stuck rate: <2%
 * - Path efficiency: >90%
 * - Combat deaths: >80%
 */

import { createGame, processTurn } from '../src/game'
import {
  createBotState,
  runBotTick,
  getExplorationStats,
  PERSONALITIES,
} from '../src/game/bot'
import type { BotPersonality, GameAction, Point } from '../src/game/types'
import type { BotState } from '../src/game/bot'

// ============================================================================
// CONFIGURATION
// ============================================================================

const TEST_RUNS = 50
const MAX_TURNS_PER_RUN = 5000
const PERSONALITIES_TO_TEST: BotPersonality[] = ['cautious', 'aggressive', 'greedy', 'speedrunner']

// Success criteria from BOT-AI-PLAN.md
const CRITERIA = {
  stairsFoundRate: 95,      // >95%
  avgDepth: 5,               // >5
  oscillationRate: 1,        // <1%
  stuckRate: 2,              // <2%
  pathEfficiency: 90,        // >90%
  combatDeathRate: 80,       // >80%
}

// ============================================================================
// TYPES
// ============================================================================

interface RunMetrics {
  personality: BotPersonality
  seed: number
  maxDepth: number
  totalTurns: number
  levelsCompleted: number
  stairsFoundCount: number
  totalLevels: number
  oscillationTurns: number
  stuckTurns: number
  diedInCombat: boolean
  diedToStarvation: boolean
  diedToTrap: boolean
  victory: boolean
  pathEfficiencySum: number
  pathEfficiencySamples: number
}

interface AggregateMetrics {
  personality: BotPersonality
  runs: number
  avgDepth: number
  stairsFoundRate: number
  oscillationRate: number
  stuckRate: number
  avgPathEfficiency: number
  combatDeathRate: number
  victoryRate: number
}

// ============================================================================
// OSCILLATION DETECTION
// ============================================================================

function detectOscillation(history: Point[]): boolean {
  if (history.length < 4) return false

  // Check A-B-A-B pattern
  const [p1, p2, p3, p4] = history.slice(-4)
  if (!p1 || !p2 || !p3 || !p4) return false

  const isABAB = (
    p1.x === p3.x && p1.y === p3.y &&
    p2.x === p4.x && p2.y === p4.y &&
    (p1.x !== p2.x || p1.y !== p2.y)
  )

  return isABAB
}

// ============================================================================
// SINGLE RUN
// ============================================================================

function runValidationTest(personality: BotPersonality, seed: number): RunMetrics {
  const game = createGame({
    raceId: 'human',
    classId: 'warrior',
    seed,
    botPersonality: personality,
  })

  const botState = createBotState()

  // Tracking variables
  const positionHistory: Point[] = []
  let oscillationTurns = 0
  let stuckTurns = 0
  let currentDepth = 1
  let stairsFoundThisLevel = false
  let stairsFoundCount = 0
  let totalLevels = 0
  let pathEfficiencySum = 0
  let pathEfficiencySamples = 0

  // Track for path efficiency
  let lastGoalTarget: Point | null = null
  let stepsTowardGoal = 0
  let optimalDistance = 0

  while (game.isRunning && game.turn < MAX_TURNS_PER_RUN) {
    const pos = game.character.position

    // Track position history
    positionHistory.push({ ...pos })
    if (positionHistory.length > 10) {
      positionHistory.shift()
    }

    // Detect oscillation
    if (detectOscillation(positionHistory)) {
      oscillationTurns++
    }

    // Check for level change
    if (game.character.depth !== currentDepth) {
      // Record previous level stats
      if (stairsFoundThisLevel) {
        stairsFoundCount++
      }
      totalLevels++

      // Reset for new level
      currentDepth = game.character.depth
      stairsFoundThisLevel = false
    }

    // Check if stairs found this level
    const explStats = getExplorationStats(game)
    if (explStats.stairsFound) {
      stairsFoundThisLevel = true
    }

    // Run bot tick
    const action: GameAction = runBotTick(game, personality, undefined, botState)

    // Track stuck turns (when bot has no goal or is waiting)
    const currentGoal = botState.currentGoal
    if (!currentGoal || currentGoal.type === 'WAIT') {
      stuckTurns++
    }

    // Track path efficiency
    const goalTarget = botState.goalTarget
    if (goalTarget) {
      if (!lastGoalTarget || lastGoalTarget.x !== goalTarget.x || lastGoalTarget.y !== goalTarget.y) {
        // New goal - record efficiency of previous goal if we had one
        if (lastGoalTarget && optimalDistance > 0 && stepsTowardGoal > 0) {
          const efficiency = (optimalDistance / stepsTowardGoal) * 100
          if (efficiency <= 200) { // Filter out anomalies
            pathEfficiencySum += Math.min(100, efficiency)
            pathEfficiencySamples++
          }
        }

        // Start tracking new goal
        lastGoalTarget = { ...goalTarget }
        optimalDistance = Math.abs(goalTarget.x - pos.x) + Math.abs(goalTarget.y - pos.y)
        stepsTowardGoal = 0
      }

      // Count steps toward current goal
      if (action.type === 'move') {
        stepsTowardGoal++
      }
    }

    processTurn(game, action)
  }

  // Record final level
  if (stairsFoundThisLevel) {
    stairsFoundCount++
  }
  totalLevels++

  // Determine death cause
  const diedInCombat = game.character.hp <= 0
  const victory = game.character.depth >= 26

  return {
    personality,
    seed,
    maxDepth: game.character.depth,
    totalTurns: game.turn,
    levelsCompleted: currentDepth - 1,
    stairsFoundCount,
    totalLevels,
    oscillationTurns,
    stuckTurns,
    diedInCombat,
    diedToStarvation: false, // Not implemented
    diedToTrap: false, // Not implemented
    victory,
    pathEfficiencySum,
    pathEfficiencySamples,
  }
}

// ============================================================================
// AGGREGATE METRICS
// ============================================================================

function aggregateMetrics(results: RunMetrics[]): AggregateMetrics {
  const personality = results[0]!.personality
  const runs = results.length

  const totalTurns = results.reduce((sum, r) => sum + r.totalTurns, 0)
  const totalLevels = results.reduce((sum, r) => sum + r.totalLevels, 0)
  const stairsFound = results.reduce((sum, r) => sum + r.stairsFoundCount, 0)
  const oscillationTurns = results.reduce((sum, r) => sum + r.oscillationTurns, 0)
  const stuckTurns = results.reduce((sum, r) => sum + r.stuckTurns, 0)
  const combatDeaths = results.filter(r => r.diedInCombat).length
  const victories = results.filter(r => r.victory).length
  const totalDeaths = results.filter(r => !r.victory).length

  // Path efficiency
  const efficiencySum = results.reduce((sum, r) => sum + r.pathEfficiencySum, 0)
  const efficiencySamples = results.reduce((sum, r) => sum + r.pathEfficiencySamples, 0)

  return {
    personality,
    runs,
    avgDepth: results.reduce((sum, r) => sum + r.maxDepth, 0) / runs,
    stairsFoundRate: totalLevels > 0 ? (stairsFound / totalLevels) * 100 : 0,
    oscillationRate: totalTurns > 0 ? (oscillationTurns / totalTurns) * 100 : 0,
    stuckRate: totalTurns > 0 ? (stuckTurns / totalTurns) * 100 : 0,
    avgPathEfficiency: efficiencySamples > 0 ? efficiencySum / efficiencySamples : 100,
    combatDeathRate: totalDeaths > 0 ? (combatDeaths / totalDeaths) * 100 : 100,
    victoryRate: (victories / runs) * 100,
  }
}

// ============================================================================
// MAIN
// ============================================================================

console.log('='.repeat(70))
console.log('BOT AI VALIDATION TEST')
console.log('='.repeat(70))
console.log('')
console.log('Success Criteria (from BOT-AI-PLAN.md):')
console.log(`  - Stairs found rate: >${CRITERIA.stairsFoundRate}%`)
console.log(`  - Average depth: >${CRITERIA.avgDepth}`)
console.log(`  - Oscillation rate: <${CRITERIA.oscillationRate}%`)
console.log(`  - Stuck rate: <${CRITERIA.stuckRate}%`)
console.log(`  - Path efficiency: >${CRITERIA.pathEfficiency}%`)
console.log(`  - Combat death rate: >${CRITERIA.combatDeathRate}%`)
console.log('')
console.log(`Running ${TEST_RUNS} tests per personality...`)
console.log('')

const allMetrics: AggregateMetrics[] = []

for (const personality of PERSONALITIES_TO_TEST) {
  process.stdout.write(`Testing ${personality}... `)

  const results: RunMetrics[] = []
  for (let i = 0; i < TEST_RUNS; i++) {
    const seed = Date.now() + i * 1000 + Math.random() * 10000
    results.push(runValidationTest(personality, seed))

    // Progress indicator
    if ((i + 1) % 10 === 0) {
      process.stdout.write('.')
    }
  }

  const metrics = aggregateMetrics(results)
  allMetrics.push(metrics)
  console.log(` done`)
}

console.log('')
console.log('='.repeat(70))
console.log('RESULTS BY PERSONALITY')
console.log('='.repeat(70))

for (const m of allMetrics) {
  console.log(`\n${m.personality.toUpperCase()}:`)
  console.log(`  Avg Depth:        ${m.avgDepth.toFixed(1)}`)
  console.log(`  Stairs Found:     ${m.stairsFoundRate.toFixed(1)}%`)
  console.log(`  Oscillation Rate: ${m.oscillationRate.toFixed(2)}%`)
  console.log(`  Stuck Rate:       ${m.stuckRate.toFixed(1)}%`)
  console.log(`  Path Efficiency:  ${m.avgPathEfficiency.toFixed(1)}%`)
  console.log(`  Combat Death %:   ${m.combatDeathRate.toFixed(1)}%`)
  console.log(`  Victory Rate:     ${m.victoryRate.toFixed(1)}%`)
}

// Aggregate across all personalities
console.log('')
console.log('='.repeat(70))
console.log('OVERALL METRICS (All Personalities Combined)')
console.log('='.repeat(70))

const overall = {
  avgDepth: allMetrics.reduce((sum, m) => sum + m.avgDepth, 0) / allMetrics.length,
  stairsFoundRate: allMetrics.reduce((sum, m) => sum + m.stairsFoundRate, 0) / allMetrics.length,
  oscillationRate: allMetrics.reduce((sum, m) => sum + m.oscillationRate, 0) / allMetrics.length,
  stuckRate: allMetrics.reduce((sum, m) => sum + m.stuckRate, 0) / allMetrics.length,
  pathEfficiency: allMetrics.reduce((sum, m) => sum + m.avgPathEfficiency, 0) / allMetrics.length,
  combatDeathRate: allMetrics.reduce((sum, m) => sum + m.combatDeathRate, 0) / allMetrics.length,
}

console.log('')
console.log('Metric'.padEnd(25) + 'Value'.padStart(10) + 'Target'.padStart(12) + 'Status'.padStart(10))
console.log('-'.repeat(57))

const checks: { name: string; value: number; target: string; pass: boolean }[] = [
  {
    name: 'Stairs Found Rate',
    value: overall.stairsFoundRate,
    target: `>${CRITERIA.stairsFoundRate}%`,
    pass: overall.stairsFoundRate > CRITERIA.stairsFoundRate,
  },
  {
    name: 'Average Depth',
    value: overall.avgDepth,
    target: `>${CRITERIA.avgDepth}`,
    pass: overall.avgDepth > CRITERIA.avgDepth,
  },
  {
    name: 'Oscillation Rate',
    value: overall.oscillationRate,
    target: `<${CRITERIA.oscillationRate}%`,
    pass: overall.oscillationRate < CRITERIA.oscillationRate,
  },
  {
    name: 'Stuck Rate',
    value: overall.stuckRate,
    target: `<${CRITERIA.stuckRate}%`,
    pass: overall.stuckRate < CRITERIA.stuckRate,
  },
  {
    name: 'Path Efficiency',
    value: overall.pathEfficiency,
    target: `>${CRITERIA.pathEfficiency}%`,
    pass: overall.pathEfficiency > CRITERIA.pathEfficiency,
  },
  {
    name: 'Combat Death Rate',
    value: overall.combatDeathRate,
    target: `>${CRITERIA.combatDeathRate}%`,
    pass: overall.combatDeathRate > CRITERIA.combatDeathRate,
  },
]

for (const check of checks) {
  const valueStr = check.name.includes('Rate') || check.name.includes('Efficiency')
    ? `${check.value.toFixed(1)}%`
    : check.value.toFixed(1)
  const status = check.pass ? '✓ PASS' : '✗ FAIL'
  console.log(check.name.padEnd(25) + valueStr.padStart(10) + check.target.padStart(12) + status.padStart(10))
}

const passedCount = checks.filter(c => c.pass).length
const totalChecks = checks.length

console.log('')
console.log('='.repeat(70))
console.log(`VALIDATION RESULT: ${passedCount}/${totalChecks} criteria passed`)
if (passedCount === totalChecks) {
  console.log('BOT AI VALIDATION: SUCCESS')
} else {
  console.log('BOT AI VALIDATION: NEEDS IMPROVEMENT')
  console.log('')
  console.log('Failed criteria:')
  for (const check of checks.filter(c => !c.pass)) {
    console.log(`  - ${check.name}: ${check.value.toFixed(1)} (target: ${check.target})`)
  }
}
console.log('='.repeat(70))
