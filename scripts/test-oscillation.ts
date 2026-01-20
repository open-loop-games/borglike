/**
 * Oscillation Detection Test
 *
 * Runs the bot and detects position oscillation patterns.
 * Logs when A-B-A-B or A-B-C-A-B-C patterns occur.
 */

import { createGameRunner } from '../src/game/index'
import type { Point, GameState } from '../src/game/types'

interface OscillationStats {
  totalTurns: number
  twoPointOscillations: number
  threePointOscillations: number
  longestOscillation: number
  oscillationTurns: number[]
}

function pointsEqual(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y
}

function detectOscillation(history: Point[]): { type: 'none' | 'two' | 'three', length: number } {
  if (history.length < 4) return { type: 'none', length: 0 }

  // Check for 2-point oscillation (A-B-A-B)
  const last4 = history.slice(-4)
  if (pointsEqual(last4[0]!, last4[2]!) &&
      pointsEqual(last4[1]!, last4[3]!) &&
      !pointsEqual(last4[0]!, last4[1]!)) {

    // Count how long this oscillation has been going
    let length = 4
    for (let i = history.length - 5; i >= 0; i -= 2) {
      if (i >= 1 &&
          pointsEqual(history[i]!, last4[1]!) &&
          pointsEqual(history[i-1]!, last4[0]!)) {
        length += 2
      } else {
        break
      }
    }
    return { type: 'two', length }
  }

  // Check for 3-point oscillation (A-B-C-A-B-C)
  if (history.length >= 6) {
    const last6 = history.slice(-6)
    if (pointsEqual(last6[0]!, last6[3]!) &&
        pointsEqual(last6[1]!, last6[4]!) &&
        pointsEqual(last6[2]!, last6[5]!) &&
        !pointsEqual(last6[0]!, last6[1]!) &&
        !pointsEqual(last6[1]!, last6[2]!) &&
        !pointsEqual(last6[0]!, last6[2]!)) {
      return { type: 'three', length: 6 }
    }
  }

  return { type: 'none', length: 0 }
}

async function runOscillationTest(maxTurns: number = 2000): Promise<void> {
  console.log('='.repeat(60))
  console.log('Oscillation Detection Test')
  console.log('='.repeat(60))
  console.log()

  const positionHistory: Point[] = []
  const stats: OscillationStats = {
    totalTurns: 0,
    twoPointOscillations: 0,
    threePointOscillations: 0,
    longestOscillation: 0,
    oscillationTurns: []
  }

  let currentOscillationStart = -1
  let lastOscillationType: 'none' | 'two' | 'three' = 'none'
  let finalGame: GameState | null = null
  let endReason = ''

  const runner = createGameRunner({
    raceId: 'human',
    classId: 'warrior',
    botPersonality: 'cautious',
    maxTurns,
    onTurn: (game) => {
      const pos = { ...game.character.position }
      positionHistory.push(pos)

      // Keep history bounded
      if (positionHistory.length > 100) {
        positionHistory.shift()
      }

      const turn = game.turn
      const oscillation = detectOscillation(positionHistory)

      if (oscillation.type !== 'none') {
        if (lastOscillationType === 'none') {
          currentOscillationStart = turn
          console.log(`\nTurn ${turn}: OSCILLATION STARTED (${oscillation.type}-point)`)
          console.log(`  Position: (${pos.x}, ${pos.y})`)
          console.log(`  Depth: ${game.character.depth}`)
          console.log(`  Recent positions: ${positionHistory.slice(-6).map(p => `(${p.x},${p.y})`).join(' → ')}`)
        }

        if (oscillation.type === 'two') stats.twoPointOscillations++
        if (oscillation.type === 'three') stats.threePointOscillations++
        stats.oscillationTurns.push(turn)
        stats.longestOscillation = Math.max(stats.longestOscillation, oscillation.length)
      } else if (lastOscillationType !== 'none') {
        const duration = turn - currentOscillationStart
        console.log(`Turn ${turn}: Oscillation ended after ${duration} turns`)
      }

      lastOscillationType = oscillation.type
      stats.totalTurns = turn
      finalGame = game
    },
    onEnd: (game, reason) => {
      finalGame = game
      endReason = reason
    }
  })

  runner.runToCompletion()

  console.log()
  console.log('='.repeat(60))
  console.log('Results')
  console.log('='.repeat(60))
  console.log(`Total turns: ${stats.totalTurns}`)
  console.log(`2-point oscillations detected: ${stats.twoPointOscillations}`)
  console.log(`3-point oscillations detected: ${stats.threePointOscillations}`)
  console.log(`Longest oscillation: ${stats.longestOscillation} positions`)
  console.log(`Turns spent oscillating: ${stats.oscillationTurns.length} (${(stats.oscillationTurns.length / Math.max(1, stats.totalTurns) * 100).toFixed(1)}%)`)
  console.log(`Final depth: ${finalGame?.character.depth ?? 'N/A'}`)
  console.log(`End reason: ${endReason}`)
}

runOscillationTest(2000).catch(console.error)
