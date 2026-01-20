/**
 * Stuck Detection Test
 *
 * Monitors when the bot gets stuck and tracks the recovery responses.
 */

import { createGameRunner } from '../src/game/index'
import type { Point, GameState } from '../src/game/types'
import { TWITCH_THRESHOLDS } from '../src/game/bot/stuck'

function distance(a: Point, b: Point): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
}

async function runStuckTest(maxTurns: number = 2000): Promise<void> {
  console.log('='.repeat(60))
  console.log('Stuck Detection Test')
  console.log('='.repeat(60))
  console.log()
  console.log('Twitch Thresholds:')
  console.log(`  LEVEL_1 (wall_follow): ${TWITCH_THRESHOLDS.LEVEL_1} turns`)
  console.log(`  LEVEL_2 (clear_history): ${TWITCH_THRESHOLDS.LEVEL_2} turns`)
  console.log(`  LEVEL_3 (force_descent): ${TWITCH_THRESHOLDS.LEVEL_3} turns`)
  console.log(`  LEVEL_4 (wait): ${TWITCH_THRESHOLDS.LEVEL_4} turns`)
  console.log()

  let finalGame: GameState | null = null
  let endReason = ''
  let lastDepth = 1
  let lastTurnsOnLevel = 0

  // Track stuck phases
  const stuckPhases: { turn: number; level: number; turnsSince: number; depth: number }[] = []
  let lastStuckLevel = 0
  let maxStuckLevel = 0
  let totalLevel1Turns = 0
  let totalLevel2Turns = 0
  let totalLevel3Turns = 0
  let totalLevel4Turns = 0

  const runner = createGameRunner({
    raceId: 'human',
    classId: 'warrior',
    botPersonality: 'cautious',
    maxTurns,
    onTurn: (game) => {
      const botState = runner.getBotState()
      const pos = game.character.position
      const turn = game.turn
      const depth = game.character.depth
      const turnsOnLevel = botState.turnsOnLevel
      const turnsSinceProgress = turn - botState.lastProgressTurn

      // Detect depth changes
      if (depth !== lastDepth) {
        console.log(
          `Turn ${turn}: DESCENDED to depth ${depth} (was on level for ${lastTurnsOnLevel} turns)`
        )
        lastDepth = depth
        lastStuckLevel = 0
      }

      // Calculate current stuck level
      let currentLevel = 0
      if (turnsSinceProgress >= TWITCH_THRESHOLDS.LEVEL_4) currentLevel = 4
      else if (turnsSinceProgress >= TWITCH_THRESHOLDS.LEVEL_3) currentLevel = 3
      else if (turnsSinceProgress >= TWITCH_THRESHOLDS.LEVEL_2) currentLevel = 2
      else if (turnsSinceProgress >= TWITCH_THRESHOLDS.LEVEL_1) currentLevel = 1

      // Track stuck time per level
      if (currentLevel >= 1) totalLevel1Turns++
      if (currentLevel >= 2) totalLevel2Turns++
      if (currentLevel >= 3) totalLevel3Turns++
      if (currentLevel >= 4) totalLevel4Turns++

      // Detect stuck level transitions
      if (currentLevel !== lastStuckLevel) {
        if (currentLevel > lastStuckLevel) {
          console.log(
            `Turn ${turn}: Stuck level ${currentLevel} (${turnsSinceProgress}t since progress, depth ${depth})`
          )
          console.log(
            `  Position: (${pos.x}, ${pos.y}), Goal: ${botState.currentGoal?.type ?? 'none'}`
          )
          stuckPhases.push({ turn, level: currentLevel, turnsSince: turnsSinceProgress, depth })
        } else if (currentLevel === 0 && lastStuckLevel > 0) {
          console.log(`Turn ${turn}: Recovered from stuck level ${lastStuckLevel}`)
        }
      }

      maxStuckLevel = Math.max(maxStuckLevel, currentLevel)
      lastStuckLevel = currentLevel
      lastTurnsOnLevel = turnsOnLevel
      finalGame = game
    },
    onEnd: (game, reason) => {
      finalGame = game
      endReason = reason
    },
  })

  runner.runToCompletion()

  console.log()
  console.log('='.repeat(60))
  console.log('Results')
  console.log('='.repeat(60))
  console.log(`Total turns: ${finalGame?.turn ?? 'N/A'}`)
  console.log(`Final depth: ${finalGame?.character.depth ?? 'N/A'}`)
  console.log(`End reason: ${endReason}`)
  console.log()
  console.log('Stuck analysis:')
  console.log(`  Max stuck level reached: ${maxStuckLevel}`)
  console.log(`  Turns at level 1+ (wall_follow): ${totalLevel1Turns}`)
  console.log(`  Turns at level 2+ (clear_history): ${totalLevel2Turns}`)
  console.log(`  Turns at level 3+ (force_descent): ${totalLevel3Turns}`)
  console.log(`  Turns at level 4+ (wait): ${totalLevel4Turns}`)
  console.log()

  // Calculate stuck percentage
  const totalTurns = finalGame?.turn ?? 1
  const stuckPercent = Math.round((totalLevel1Turns / totalTurns) * 100)
  console.log(`Stuck percentage: ${stuckPercent}% of turns at level 1+`)

  if (stuckPercent > 5) {
    console.log('WARNING: Stuck percentage is high!')
  } else {
    console.log('SUCCESS: Stuck percentage is acceptable.')
  }
}

runStuckTest(2000).catch(console.error)
