/**
 * Target Tracking Test
 *
 * Monitors goalTarget changes to understand when and why
 * the bot switches exploration targets.
 */

import { createGameRunner } from '../src/game/index'
import type { Point, GameState } from '../src/game/types'
import type { BotState } from '../src/game/bot'

function pointStr(p: Point | null): string {
  return p ? `(${p.x},${p.y})` : 'null'
}

function distance(a: Point, b: Point): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
}

async function runTargetTrackingTest(maxTurns: number = 1000): Promise<void> {
  console.log('='.repeat(60))
  console.log('Target Tracking Test')
  console.log('='.repeat(60))
  console.log()

  let targetChanges = 0
  let targetReached = 0
  let targetCleared = 0
  let turnsWithTarget = 0
  let turnsWithoutTarget = 0

  const targetDurations: number[] = []
  let currentTargetStart = -1
  let lastTarget: Point | null = null
  let finalGame: GameState | null = null
  let endReason = ''

  const runner = createGameRunner({
    raceId: 'human',
    classId: 'warrior',
    botPersonality: 'cautious',
    maxTurns,
    onTurn: (game) => {
      const botState = runner.getBotState()
      const pos = game.character.position
      const turn = game.turn
      const targetAfter = botState.goalTarget ? { ...botState.goalTarget } : null

      // Track target changes
      const targetChanged = (
        (lastTarget === null && targetAfter !== null) ||
        (lastTarget !== null && targetAfter === null) ||
        (lastTarget !== null && targetAfter !== null &&
         (lastTarget.x !== targetAfter.x || lastTarget.y !== targetAfter.y))
      )

      if (targetChanged) {
        if (lastTarget !== null && targetAfter === null) {
          // Target was cleared
          const duration = turn - currentTargetStart
          targetDurations.push(duration)

          const reached = pos.x === lastTarget.x && pos.y === lastTarget.y
          if (reached) {
            targetReached++
            console.log(`Turn ${turn}: Target REACHED ${pointStr(lastTarget)} after ${duration} turns`)
          } else {
            targetCleared++
            console.log(`Turn ${turn}: Target CLEARED ${pointStr(lastTarget)} after ${duration} turns (was ${distance(pos, lastTarget)} away)`)
          }
        }

        if (targetAfter !== null && (lastTarget === null || lastTarget.x !== targetAfter.x || lastTarget.y !== targetAfter.y)) {
          targetChanges++
          currentTargetStart = turn
          const dist = distance(pos, targetAfter)
          console.log(`Turn ${turn}: NEW TARGET ${pointStr(targetAfter)} (distance: ${dist}) | pos: ${pointStr(pos)} | depth: ${game.character.depth}`)
        }
      }

      if (botState.goalTarget) {
        turnsWithTarget++
      } else {
        turnsWithoutTarget++
      }

      lastTarget = targetAfter
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
  console.log(`Total target changes: ${targetChanges}`)
  console.log(`Targets reached: ${targetReached}`)
  console.log(`Targets cleared (not reached): ${targetCleared}`)
  console.log(`Turns with target: ${turnsWithTarget}`)
  console.log(`Turns without target: ${turnsWithoutTarget}`)
  if (targetDurations.length > 0) {
    const avgDuration = targetDurations.reduce((a, b) => a + b, 0) / targetDurations.length
    console.log(`Average target duration: ${avgDuration.toFixed(1)} turns`)
    console.log(`Min/Max duration: ${Math.min(...targetDurations)} / ${Math.max(...targetDurations)}`)
  }
  console.log(`Final depth: ${finalGame?.character.depth ?? 'N/A'}`)
  console.log(`End reason: ${endReason}`)
}

runTargetTrackingTest(1000).catch(console.error)
