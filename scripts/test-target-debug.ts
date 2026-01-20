/**
 * Target Debug Test
 *
 * Shows exactly WHY targets are being changed each turn.
 */

import { createGameRunner } from '../src/game/index'
import type { Point, GameState } from '../src/game/types'
import { findPathThroughDoors, getTile } from '../src/game/dungeon'

function pointStr(p: Point | null): string {
  return p ? `(${p.x},${p.y})` : 'null'
}

async function runTargetDebugTest(maxTurns: number = 100): Promise<void> {
  console.log('='.repeat(60))
  console.log('Target Debug Test - Why targets change')
  console.log('='.repeat(60))
  console.log()

  let lastTarget: Point | null = null

  const runner = createGameRunner({
    raceId: 'human',
    classId: 'warrior',
    botPersonality: 'cautious',
    maxTurns,
    onTurn: (game) => {
      const botState = runner.getBotState()
      const pos = game.character.position
      const turn = game.turn
      const target = botState.goalTarget

      // Check if target changed
      const targetChanged = (
        (lastTarget === null && target !== null) ||
        (lastTarget !== null && target === null) ||
        (lastTarget !== null && target !== null &&
         (lastTarget.x !== target.x || lastTarget.y !== target.y))
      )

      if (targetChanged && turn <= 50) {
        console.log(`\nTurn ${turn}: Target changed`)
        console.log(`  Player pos: ${pointStr(pos)}`)
        console.log(`  Old target: ${pointStr(lastTarget)}`)
        console.log(`  New target: ${pointStr(target)}`)
        console.log(`  Goal: ${botState.currentGoal}`)

        if (lastTarget) {
          // Why was old target cleared?
          const atOldTarget = pos.x === lastTarget.x && pos.y === lastTarget.y
          const path = findPathThroughDoors(game.currentLevel, pos, lastTarget)
          const oldTile = getTile(game.currentLevel, lastTarget.x, lastTarget.y)

          console.log(`  Old target analysis:`)
          console.log(`    - At target: ${atOldTarget}`)
          console.log(`    - Path exists: ${path.length >= 2} (length: ${path.length})`)
          console.log(`    - Tile explored: ${oldTile?.explored ?? 'N/A'}`)
          console.log(`    - Tile type: ${oldTile?.type ?? 'N/A'}`)
        }

        if (target) {
          const path = findPathThroughDoors(game.currentLevel, pos, target)
          const newTile = getTile(game.currentLevel, target.x, target.y)
          const dist = Math.max(Math.abs(target.x - pos.x), Math.abs(target.y - pos.y))

          console.log(`  New target analysis:`)
          console.log(`    - Distance: ${dist}`)
          console.log(`    - Path length: ${path.length}`)
          console.log(`    - Tile explored: ${newTile?.explored ?? 'N/A'}`)
          console.log(`    - Tile type: ${newTile?.type ?? 'N/A'}`)
        }
      }

      lastTarget = target ? { ...target } : null
    },
    onEnd: (game, reason) => {
      console.log(`\nGame ended: ${reason} at turn ${game.turn}`)
    }
  })

  runner.runToCompletion()
}

runTargetDebugTest(100).catch(console.error)
