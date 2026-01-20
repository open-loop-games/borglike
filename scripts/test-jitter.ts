/**
 * Jitter Detection Test
 *
 * Runs 10 games with 2000 max turns each to measure jitter rates.
 * Jitter = bot moving in small area without making progress.
 */

import { createGameRunner } from '../src/game/index'
import type { Point } from '../src/game/types'

const NUM_RUNS = 10
const MAX_TURNS = 2000
const WINDOW_SIZE = 20
const JITTER_THRESHOLD = 25

function getBoundingBox(positions: Point[]): number {
  if (positions.length === 0) return 0

  let minX = positions[0]!.x, maxX = positions[0]!.x
  let minY = positions[0]!.y, maxY = positions[0]!.y

  for (const p of positions) {
    minX = Math.min(minX, p.x)
    maxX = Math.max(maxX, p.x)
    minY = Math.min(minY, p.y)
    maxY = Math.max(maxY, p.y)
  }

  return (maxX - minX + 1) * (maxY - minY + 1)
}

interface RunResult {
  run: number
  turns: number
  jitterTurns: number
  jitterPct: number
  maxDepth: number
  stairsFound: boolean
  reason: string
}

function runSingleGame(runNum: number): RunResult {
  const positionHistory: Point[] = []
  let jitterTurns = 0
  let maxDepth = 0
  let stairsFound = false
  let turns = 0
  let reason = ''

  const runner = createGameRunner({
    raceId: 'human',
    classId: 'warrior',
    botPersonality: 'cautious',
    maxTurns: MAX_TURNS,
    onTurn: (game) => {
      turns = game.turn
      maxDepth = Math.max(maxDepth, game.character.depth)

      const botState = runner.getBotState()
      if (botState.stairsPosition) stairsFound = true

      positionHistory.push({ ...game.character.position })
      if (positionHistory.length > WINDOW_SIZE) {
        positionHistory.shift()
      }

      if (positionHistory.length >= WINDOW_SIZE) {
        const area = getBoundingBox(positionHistory)
        if (area < JITTER_THRESHOLD) {
          jitterTurns++
        }
      }
    },
    onEnd: (_game, endReason) => {
      reason = endReason
    }
  })

  runner.runToCompletion()

  return {
    run: runNum,
    turns,
    jitterTurns,
    jitterPct: turns > 0 ? (jitterTurns / turns) * 100 : 0,
    maxDepth,
    stairsFound,
    reason
  }
}

function runJitterTest(): void {
  console.log('='.repeat(60))
  console.log(`Jitter Detection Test (${NUM_RUNS} runs, ${MAX_TURNS} max turns)`)
  console.log('='.repeat(60))
  console.log()

  const results: RunResult[] = []

  for (let i = 1; i <= NUM_RUNS; i++) {
    results.push(runSingleGame(i))
  }

  // Print results table
  console.log('Run | Turns | Jitter% | Depth | Stairs | Reason')
  console.log('-'.repeat(55))

  for (const r of results) {
    console.log(
      `${r.run.toString().padStart(3)} | ` +
      `${r.turns.toString().padStart(5)} | ` +
      `${r.jitterPct.toFixed(1).padStart(6)}% | ` +
      `${r.maxDepth.toString().padStart(5)} | ` +
      `${(r.stairsFound ? 'Y' : 'N').padStart(6)} | ` +
      `${r.reason}`
    )
  }

  // Print summary
  const avgJitter = results.reduce((a, r) => a + r.jitterPct, 0) / NUM_RUNS
  const avgDepth = results.reduce((a, r) => a + r.maxDepth, 0) / NUM_RUNS
  const stairsCount = results.filter(r => r.stairsFound).length

  console.log('-'.repeat(55))
  console.log(
    `AVG |       | ${avgJitter.toFixed(1).padStart(6)}% | ` +
    `${avgDepth.toFixed(1).padStart(5)} | ` +
    `${stairsCount}/${NUM_RUNS}`.padStart(6) + ' |'
  )
}

runJitterTest()
