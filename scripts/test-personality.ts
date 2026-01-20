/**
 * Test script for bot personality differentiation
 * Run with: npx tsx scripts/test-personality.ts
 *
 * Success Criteria from Phase 8:
 * - Each personality produces measurably different behavior patterns
 * - Cautious: Higher HP at death, more exploration, fewer fights
 * - Aggressive: Lower HP at death, seeks combat, faster progression
 * - Greedy: More items collected, higher gold, thorough exploration
 * - Speedrunner: Fastest depth progression, minimal exploration
 */

import { createGame, processTurn } from '../src/game'
import {
  createBotState,
  runBotTick,
  getExplorationProgress,
  PERSONALITIES,
  describePersonality,
  summarizePersonality,
} from '../src/game/bot'
import type { BotPersonality, GameAction } from '../src/game/types'

interface PersonalityStats {
  personality: BotPersonality
  runs: number
  avgMaxDepth: number
  avgTurns: number
  avgExploration: number
  avgKills: number
  avgItemsCollected: number
  avgGold: number
  avgHpAtDeath: number // HP% when died
  avgFleesPerRun: number
  deathsByMonster: number
  victories: number
}

const MAX_TURNS = 3000
const RUNS_PER_PERSONALITY = 10

function runPersonalityTest(personality: BotPersonality, seed: number): {
  maxDepth: number
  turns: number
  avgExploration: number
  kills: number
  itemsCollected: number
  gold: number
  hpAtDeath: number
  flees: number
  diedToMonster: boolean
  victory: boolean
} {
  const game = createGame({
    raceId: 'human',
    classId: 'warrior',
    seed,
    botPersonality: personality,
  })

  const botState = createBotState()
  let totalExploration = 0
  let explorationSamples = 0
  let kills = 0
  let itemsCollected = 0
  let flees = 0
  let lastMonsterCount = game.monsters.length
  let lastItemCount = game.items.length
  let lastGoal: string | null = null

  while (game.isRunning && game.turn < MAX_TURNS) {
    const action: GameAction = runBotTick(game, personality, undefined, botState)

    // Track goal changes to count flee attempts
    const currentGoal = botState.currentGoal?.type ?? null
    if (currentGoal === 'FLEE' && lastGoal !== 'FLEE') {
      flees++
    }
    lastGoal = currentGoal

    processTurn(game, action)

    // Track kills
    if (game.monsters.length < lastMonsterCount) {
      kills += lastMonsterCount - game.monsters.length
    }
    lastMonsterCount = game.monsters.length

    // Track item pickups
    if (game.items.length < lastItemCount) {
      itemsCollected += lastItemCount - game.items.length
    }
    lastItemCount = game.items.length

    // Sample exploration every 100 turns
    if (game.turn % 100 === 0) {
      totalExploration += getExplorationProgress(game)
      explorationSamples++
    }
  }

  const hpAtDeath = game.character.hp <= 0
    ? 0
    : (game.character.hp / game.character.maxHp) * 100

  return {
    maxDepth: game.character.depth,
    turns: game.turn,
    avgExploration: explorationSamples > 0 ? totalExploration / explorationSamples : 0,
    kills,
    itemsCollected,
    gold: game.character.gold,
    hpAtDeath,
    flees,
    diedToMonster: game.character.hp <= 0,
    victory: game.character.depth >= 26, // Reached bottom
  }
}

interface RunResult {
  maxDepth: number
  turns: number
  avgExploration: number
  kills: number
  itemsCollected: number
  gold: number
  hpAtDeath: number
  flees: number
  diedToMonster: boolean
  victory: boolean
}

function runMultipleTests(personality: BotPersonality, count: number): PersonalityStats {
  const results: RunResult[] = []
  for (let i = 0; i < count; i++) {
    const seed = Date.now() + i * 1000 + Math.random() * 1000
    results.push(runPersonalityTest(personality, seed))
  }

  return {
    personality,
    runs: count,
    avgMaxDepth: results.reduce((sum, r) => sum + r.maxDepth, 0) / count,
    avgTurns: results.reduce((sum, r) => sum + r.turns, 0) / count,
    avgExploration: results.reduce((sum, r) => sum + r.avgExploration, 0) / count,
    avgKills: results.reduce((sum, r) => sum + r.kills, 0) / count,
    avgItemsCollected: results.reduce((sum, r) => sum + r.itemsCollected, 0) / count,
    avgGold: results.reduce((sum, r) => sum + r.gold, 0) / count,
    avgHpAtDeath: results.reduce((sum, r) => sum + r.hpAtDeath, 0) / count,
    avgFleesPerRun: results.reduce((sum, r) => sum + r.flees, 0) / count,
    deathsByMonster: results.filter(r => r.diedToMonster).length,
    victories: results.filter(r => r.victory).length,
  }
}

console.log('='.repeat(70))
console.log('BOT PERSONALITY DIFFERENTIATION TEST')
console.log('='.repeat(70))

console.log('\nPersonality Configurations:')
const personalities: BotPersonality[] = ['cautious', 'aggressive', 'greedy', 'speedrunner']
for (const p of personalities) {
  const config = PERSONALITIES[p]
  console.log(`\n${p.toUpperCase()}:`)
  console.log(`  ${describePersonality(p)}`)
  console.log(`  Summary: ${summarizePersonality(config)}`)
  console.log(`  Config: agg=${config.aggression}, greed=${config.greed}, caut=${config.caution}, expl=${config.exploration}, pat=${config.patience}`)
}

console.log('\n' + '='.repeat(70))
console.log(`Running ${RUNS_PER_PERSONALITY} runs per personality...`)
console.log('='.repeat(70))

const allStats: PersonalityStats[] = []

for (const personality of personalities) {
  console.log(`\nTesting ${personality}...`)
  const stats = runMultipleTests(personality, RUNS_PER_PERSONALITY)
  allStats.push(stats)
  console.log(`  Done. Avg depth: ${stats.avgMaxDepth.toFixed(1)}, Avg kills: ${stats.avgKills.toFixed(1)}`)
}

console.log('\n' + '='.repeat(70))
console.log('RESULTS')
console.log('='.repeat(70))

// Print comparison table
console.log('\nMetric Comparison:')
console.log('-'.repeat(70))
console.log('Metric'.padEnd(20) + personalities.map(p => p.padStart(12)).join(''))
console.log('-'.repeat(70))

const metrics: { name: string; key: keyof PersonalityStats; format?: (n: number) => string }[] = [
  { name: 'Avg Max Depth', key: 'avgMaxDepth' },
  { name: 'Avg Turns', key: 'avgTurns', format: n => n.toFixed(0) },
  { name: 'Avg Exploration %', key: 'avgExploration' },
  { name: 'Avg Kills', key: 'avgKills' },
  { name: 'Avg Items', key: 'avgItemsCollected' },
  { name: 'Avg Gold', key: 'avgGold', format: n => n.toFixed(0) },
  { name: 'Avg Flees/Run', key: 'avgFleesPerRun' },
  { name: 'Deaths', key: 'deathsByMonster', format: n => n.toFixed(0) },
]

for (const metric of metrics) {
  const format = metric.format ?? ((n: number) => n.toFixed(1))
  const row = metric.name.padEnd(20) + allStats.map(s => format(s[metric.key] as number).padStart(12)).join('')
  console.log(row)
}

console.log('-'.repeat(70))

// Verify differentiation
console.log('\nDifferentiation Checks:')

// Stats are accessed via allStats array

// 1. Speedrunner should have fewest turns per level (fastest pace)
const turnsPerDepth = allStats.map(s => ({
  p: s.personality,
  ratio: s.avgTurns / Math.max(s.avgMaxDepth, 1)
}))
const fastestPace = turnsPerDepth.reduce((a, b) => a.ratio < b.ratio ? a : b)
const speedrunnerPaceCheck = fastestPace.p === 'speedrunner'
console.log(`  Speedrunner fastest pace: ${speedrunnerPaceCheck ? '✓' : '✗'} (${fastestPace.p} was fastest at ${fastestPace.ratio.toFixed(0)} turns/depth)`)

// 2. Greedy should collect most items (items per depth)
const itemsPerDepth = allStats.map(s => ({
  p: s.personality,
  ratio: s.avgItemsCollected / Math.max(s.avgMaxDepth, 1)
}))
const mostItemsPerDepth = itemsPerDepth.reduce((a, b) => a.ratio > b.ratio ? a : b)
const greedyItemsCheck = mostItemsPerDepth.p === 'greedy'
console.log(`  Greedy highest items/depth: ${greedyItemsCheck ? '✓' : '✗'} (${mostItemsPerDepth.p} had ${mostItemsPerDepth.ratio.toFixed(1)} items/depth)`)

// 3. Aggressive should have most kills per turn (highest combat rate)
const killsPerTurn = allStats.map(s => ({
  p: s.personality,
  ratio: s.avgKills / Math.max(s.avgTurns / 100, 1)
}))
const highestKillRate = killsPerTurn.reduce((a, b) => a.ratio > b.ratio ? a : b)
const aggressiveKillsCheck = highestKillRate.p === 'aggressive'
console.log(`  Aggressive highest kill rate: ${aggressiveKillsCheck ? '✓' : '✗'} (${highestKillRate.p} had ${highestKillRate.ratio.toFixed(2)} kills/100turns)`)

// 4. Greedy should have longest runs (most patient)
const longestRuns = allStats.reduce((a, b) => a.avgTurns > b.avgTurns ? a : b)
const greedyPatienceCheck = longestRuns.personality === 'greedy'
console.log(`  Greedy longest runs: ${greedyPatienceCheck ? '✓' : '✗'} (${longestRuns.personality} had ${longestRuns.avgTurns.toFixed(0)} avg turns)`)

// 5. Speedrunner should have shortest runs (most impatient)
const shortestRuns = allStats.reduce((a, b) => a.avgTurns < b.avgTurns ? a : b)
const speedrunnerImpatientCheck = shortestRuns.personality === 'speedrunner'
console.log(`  Speedrunner shortest runs: ${speedrunnerImpatientCheck ? '✓' : '✗'} (${shortestRuns.personality} had ${shortestRuns.avgTurns.toFixed(0)} avg turns)`)

// 6. Aggressive should have highest death rate (least cautious)
const deathRate = allStats.map(s => ({
  p: s.personality,
  rate: s.deathsByMonster / s.runs
}))
const highestDeathRate = deathRate.reduce((a, b) => a.rate > b.rate ? a : b)
// Allow either aggressive or speedrunner (both have low caution)
const aggressiveDeathCheck = highestDeathRate.p === 'aggressive' || highestDeathRate.p === 'speedrunner'
console.log(`  Aggressive/Speedrunner most deaths: ${aggressiveDeathCheck ? '✓' : '✗'} (${highestDeathRate.p} had ${(highestDeathRate.rate * 100).toFixed(0)}% death rate)`)

// 7. Behaviors should be distinct - check variance across personalities
const depthVariance = calculateVariance(allStats.map(s => s.avgMaxDepth))
const turnsVariance = calculateVariance(allStats.map(s => s.avgTurns))
const itemsVariance = calculateVariance(allStats.map(s => s.avgItemsCollected))
const significantVariance = depthVariance > 0.1 || turnsVariance > 10000 || itemsVariance > 0.2
console.log(`  Behaviors are distinct: ${significantVariance ? '✓' : '✗'} (depth var: ${depthVariance.toFixed(2)}, turns var: ${turnsVariance.toFixed(0)}, items var: ${itemsVariance.toFixed(2)})`)

const passedChecks = [
  speedrunnerPaceCheck,
  greedyItemsCheck,
  aggressiveKillsCheck,
  greedyPatienceCheck,
  speedrunnerImpatientCheck,
  aggressiveDeathCheck,
  significantVariance,
].filter(Boolean).length

console.log('\n' + '='.repeat(70))
console.log(`PERSONALITY DIFFERENTIATION: ${passedChecks}/7 checks passed`)
console.log('='.repeat(70))

// Helper function
function calculateVariance(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  return values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
}
