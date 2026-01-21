/**
 * Debug script to find stuck positions (same position for many turns)
 */
import { createGame } from '../src/game'
import { processTurn } from '../src/game/game-loop'
import { runBotTick } from '../src/game/bot/tick'
import { createBotState } from '../src/game/bot/state'
import { findAdjacentMonster } from '../src/game/bot/combat'

const seed = 1768969893346

console.log(`\nDebug stuck detection for seed ${seed}\n`)

const game = createGame({
  seed,
  raceId: 'human',
  classId: 'warrior',
})

const botState = createBotState()
const personality = 'cautious'

let lastPos = { x: -1, y: -1 }
let samePosTurns = 0
let maxSamePosTurns = 0
let maxSamePosStart = 0

for (let turn = 0; turn < 1500; turn++) {
  if (!game.isRunning) break

  const pos = game.character.position
  const action = runBotTick(game, personality, botState)
  const goal = botState.currentGoal
  const adjacentMonster = findAdjacentMonster(game)

  // Check if position is same as last turn
  if (pos.x === lastPos.x && pos.y === lastPos.y) {
    samePosTurns++
    if (samePosTurns >= 5) {
      const monsterInfo = adjacentMonster
        ? `${adjacentMonster.template.name}@(${adjacentMonster.position.x},${adjacentMonster.position.y}) hp=${adjacentMonster.hp}`
        : 'none'
      console.log(
        `Turn ${turn}: SAME POS (${samePosTurns}x) pos=(${pos.x},${pos.y}) ` +
        `adjacent=${monsterInfo} goal=${goal?.type}@(${goal?.target?.x},${goal?.target?.y}) ` +
        `action=${action.type}${action.type === 'move' ? ':' + action.direction : ''}`
      )
    }
    if (samePosTurns > maxSamePosTurns) {
      maxSamePosTurns = samePosTurns
      maxSamePosStart = turn - samePosTurns + 1
    }
  } else {
    samePosTurns = 1
  }
  lastPos = { ...pos }

  processTurn(game, action)
}

console.log(`\nMax same position: ${maxSamePosTurns} turns starting at turn ${maxSamePosStart}`)
console.log(`Final: depth=${game.character.depth} kills=${game.stats.kills} hp=${game.character.hp}`)
