/**
 * Trace adjacent monster bug - find cases where adjacent monster exists but no attack
 */

import { createGame, processAction } from '../src/game'
import { runBotTick } from '../src/game/bot/tick'
import { findAdjacentMonster } from '../src/game/bot/combat'
import { getImmediateDangerTier, getImmediateDanger } from '../src/game/bot/danger'
import type { BotState } from '../src/game/bot/types'
import { createBotState } from '../src/game/bot/state'

const SEED = 1768970170941
const MAX_TURNS = 2000

function run() {
  console.log(`Tracing seed ${SEED} for adjacent monster bug...\n`)

  const game = createGame({
    seed: SEED,
    classId: 'warrior',
    raceId: 'human',
  })

  let botState: BotState = createBotState()
  let bugFound = false
  let turnsWithAdjacentNoAttack = 0
  let lastAdjacentNoAttackTurn = -100

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    if (game.character.hp <= 0) {
      console.log(`\nDied on turn ${turn}`)
      break
    }

    // Check for adjacent monster BEFORE bot tick
    const adjacentMonster = findAdjacentMonster(game)
    const immediateDanger = getImmediateDanger(game)
    const tier = getImmediateDangerTier(
      immediateDanger,
      game.character.hp,
      game.character.maxHp,
      adjacentMonster !== null
    )

    // Run bot tick
    const action = runBotTick(game, 'cautious', botState)

    // Check: adjacent monster exists but action is NOT attack
    if (adjacentMonster && action.type !== 'attack') {
      turnsWithAdjacentNoAttack++

      // Only log if not consecutive (to avoid spam)
      if (turn - lastAdjacentNoAttackTurn > 1 || turnsWithAdjacentNoAttack <= 3) {
        console.log(`\n=== BUG CANDIDATE: Turn ${turn} ===`)
        console.log(`  Position: (${game.character.position.x}, ${game.character.position.y})`)
        console.log(`  HP: ${game.character.hp}/${game.character.maxHp}`)
        console.log(`  Depth: ${game.character.depth}`)
        console.log(`  Adjacent monster: ${adjacentMonster.template.name} (HP: ${adjacentMonster.hp}, pos: ${adjacentMonster.position.x},${adjacentMonster.position.y})`)
        console.log(`  Immediate danger: ${immediateDanger}`)
        console.log(`  Danger tier: ${tier}`)
        console.log(`  Action returned: ${action.type}${action.type === 'move' ? `:${(action as any).direction}` : ''}`)
        console.log(`  Current goal: ${botState.currentGoal?.type ?? 'none'} @ ${botState.currentGoal?.target ? `(${botState.currentGoal.target.x},${botState.currentGoal.target.y})` : 'none'}`)
        bugFound = true
      }
      lastAdjacentNoAttackTurn = turn
    }

    // Process action
    processAction(game, action)
  }

  console.log(`\n=== Summary ===`)
  console.log(`Turns with adjacent monster but no attack: ${turnsWithAdjacentNoAttack}`)
  console.log(`Bug found: ${bugFound}`)
  console.log(`Final turn: ${game.turn}`)
  console.log(`Final depth: ${game.character.depth}`)
  console.log(`Final HP: ${game.character.hp}/${game.character.maxHp}`)
}

run()
