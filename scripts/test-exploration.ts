/**
 * Test script for bot exploration efficiency
 * Run with: npx tsx scripts/test-exploration.ts
 *
 * Success Criteria from plan:
 * - Finds stairs in >95% of levels
 * - Explores >80% of reachable area before descending (per personality)
 */

import { createGame, processTurn } from '../src/game'
import { createBotState, runBotTick, getExplorationStats } from '../src/game/bot'
import type { BotPersonality } from '../src/game/types'

interface LevelStats {
  depth: number
  stairsFound: boolean
  explorationProgress: number
  turnsOnLevel: number
}

interface RunStats {
  personality: BotPersonality
  maxDepth: number
  totalTurns: number
  levelsWithStairs: number
  totalLevels: number
  avgExplorationAtDescent: number
  stairsFindRate: number
  levelStats: LevelStats[]
}

const MAX_TURNS = 5000
const TEST_RUNS = 15

function runExplorationTest(personality: BotPersonality, seed: number): RunStats {
  const game = createGame({
    raceId: 'human',
    classId: 'warrior',
    seed,
    botPersonality: personality,
  })

  const botState = createBotState()
  const levelStats: LevelStats[] = []
  let currentDepth = 1
  let currentLevelTurns = 0
  let stairsFoundThisLevel = false

  while (game.isRunning && game.turn < MAX_TURNS) {
    // Check for level change
    if (game.character.depth !== currentDepth) {
      // Record stats for previous level
      const stats = getExplorationStats(game)
      levelStats.push({
        depth: currentDepth,
        stairsFound: stairsFoundThisLevel,
        explorationProgress: stats.progress,
        turnsOnLevel: currentLevelTurns,
      })

      currentDepth = game.character.depth
      currentLevelTurns = 0
      stairsFoundThisLevel = false
    }

    // Check if stairs found
    const explStats = getExplorationStats(game)
    if (explStats.stairsFound) {
      stairsFoundThisLevel = true
    }

    // Run bot tick
    const action = runBotTick(game, personality, undefined, botState)
    processTurn(game, action)
    currentLevelTurns++
  }

  // Record final level stats
  const finalStats = getExplorationStats(game)
  levelStats.push({
    depth: currentDepth,
    stairsFound: stairsFoundThisLevel || finalStats.stairsFound,
    explorationProgress: finalStats.progress,
    turnsOnLevel: currentLevelTurns,
  })

  // Calculate aggregate stats
  const levelsWithStairs = levelStats.filter(l => l.stairsFound).length
  const totalLevels = levelStats.length
  const avgExploration = levelStats.reduce((sum, l) => sum + l.explorationProgress, 0) / totalLevels

  return {
    personality,
    maxDepth: game.character.depth,
    totalTurns: game.turn,
    levelsWithStairs,
    totalLevels,
    avgExplorationAtDescent: avgExploration,
    stairsFindRate: (levelsWithStairs / totalLevels) * 100,
    levelStats,
  }
}

function runMultipleTests(personality: BotPersonality, count: number): {
  avgMaxDepth: number
  avgStairsFindRate: number
  avgExploration: number
  results: RunStats[]
} {
  const results: RunStats[] = []

  for (let i = 0; i < count; i++) {
    const seed = Date.now() + i * 1000
    results.push(runExplorationTest(personality, seed))
  }

  const avgMaxDepth = results.reduce((sum, r) => sum + r.maxDepth, 0) / count
  const avgStairsFindRate = results.reduce((sum, r) => sum + r.stairsFindRate, 0) / count
  const avgExploration = results.reduce((sum, r) => sum + r.avgExplorationAtDescent, 0) / count

  return { avgMaxDepth, avgStairsFindRate, avgExploration, results }
}

console.log('='.repeat(60))
console.log('BOT EXPLORATION TEST')
console.log('='.repeat(60))

console.log('\nSuccess Criteria:')
console.log('  - Stairs found rate: >95%')
console.log('  - Exploration before descent: per personality threshold')
console.log('')

const personalities: BotPersonality[] = ['cautious', 'aggressive', 'greedy', 'speedrunner']
const personalityTargets: Record<BotPersonality, number> = {
  cautious: 80,
  aggressive: 60,
  greedy: 90,
  speedrunner: 30,
}

console.log(`Running ${TEST_RUNS} runs per personality...`)
console.log('')

for (const personality of personalities) {
  const { avgMaxDepth, avgStairsFindRate, avgExploration, results } = runMultipleTests(personality, TEST_RUNS)
  const target = personalityTargets[personality]

  const stairsPass = avgStairsFindRate >= 95
  const explorePass = avgExploration >= target * 0.8 // Allow 20% tolerance

  console.log(`${personality.toUpperCase()}`)
  console.log(`  Avg Max Depth: ${avgMaxDepth.toFixed(1)}`)
  console.log(`  Stairs Find Rate: ${avgStairsFindRate.toFixed(1)}% ${stairsPass ? '✓' : '✗'} (target: >95%)`)
  console.log(`  Avg Exploration: ${avgExploration.toFixed(1)}% ${explorePass ? '✓' : '✗'} (target: ~${target}%)`)

  // Show sample level breakdown from one run
  const sampleRun = results[0]!
  console.log(`  Sample run levels:`)
  for (const level of sampleRun.levelStats.slice(0, 5)) {
    console.log(`    Depth ${level.depth}: ${level.explorationProgress}% explored, stairs: ${level.stairsFound ? 'yes' : 'no'}, ${level.turnsOnLevel} turns`)
  }
  if (sampleRun.levelStats.length > 5) {
    console.log(`    ... (${sampleRun.levelStats.length - 5} more levels)`)
  }
  console.log('')
}

// Run a detailed single test to show exploration progress
console.log('='.repeat(60))
console.log('DETAILED SINGLE RUN (Cautious)')
console.log('='.repeat(60))

const detailedSeed = 12345
const game = createGame({
  raceId: 'human',
  classId: 'warrior',
  seed: detailedSeed,
  botPersonality: 'cautious',
})

const botState = createBotState()
let lastDepth = 1
let depthExplorationLog: { turn: number; depth: number; progress: number }[] = []

for (let turn = 0; turn < 500 && game.isRunning; turn++) {
  const stats = getExplorationStats(game)

  // Log every 50 turns or on depth change
  if (turn % 50 === 0 || game.character.depth !== lastDepth) {
    depthExplorationLog.push({
      turn: game.turn,
      depth: game.character.depth,
      progress: stats.progress,
    })
  }

  if (game.character.depth !== lastDepth) {
    lastDepth = game.character.depth
  }

  const action = runBotTick(game, 'cautious', undefined, botState)
  processTurn(game, action)
}

console.log('\nExploration progress over time:')
for (const log of depthExplorationLog) {
  console.log(`  Turn ${log.turn.toString().padStart(4)}: Depth ${log.depth}, ${log.progress}% explored`)
}

const finalExplStats = getExplorationStats(game)
console.log(`\nFinal state:`)
console.log(`  Depth: ${game.character.depth}`)
console.log(`  Turn: ${game.turn}`)
console.log(`  Exploration: ${finalExplStats.progress}%`)
console.log(`  Frontier: ${finalExplStats.frontierSize} tiles`)
console.log(`  Stairs found: ${finalExplStats.stairsFound}`)

console.log('\n' + '='.repeat(60))
console.log('EXPLORATION TEST COMPLETE')
console.log('='.repeat(60))
