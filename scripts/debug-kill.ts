/**
 * Debug script to trace KILL goal behavior
 */
import { createGame, processAction } from '../src/game'
import { runBotTick } from '../src/game/bot/tick'
import { createBotState } from '../src/game/bot/state'
import { findAdjacentMonster } from '../src/game/bot/combat'
import { getImmediateDanger, getImmediateDangerTier } from '../src/game/bot/danger'

const seed = 1768969893346

console.log(`\nDebug KILL goal for seed ${seed}\n`)

const game = createGame({
  seed,
  raceId: 'human',
  classId: 'warrior',
})

const botState = createBotState()
const personality = 'cautious'

let killGoalTurns = 0
let lastGoalType = ''

for (let turn = 0; turn < 1500; turn++) {
  if (!game.isRunning) break

  const adjacentMonster = findAdjacentMonster(game)
  const immediateDanger = getImmediateDanger(game)
  const hasAdjacentMonster = adjacentMonster !== null
  const tier = getImmediateDangerTier(
    immediateDanger,
    game.character.hp,
    game.character.maxHp,
    hasAdjacentMonster
  )

  const action = runBotTick(game, personality, botState)
  const goal = botState.currentGoal

  // Log when we have a KILL goal or adjacent monster
  if (goal?.type === 'KILL' || hasAdjacentMonster) {
    killGoalTurns++
    if (killGoalTurns <= 100) {
      const pos = game.character.position
      const monsterInfo = adjacentMonster
        ? `${adjacentMonster.template.name}@(${adjacentMonster.position.x},${adjacentMonster.position.y}) hp=${adjacentMonster.hp}`
        : 'none'
      console.log(
        `Turn ${turn}: pos=(${pos.x},${pos.y}) tier=${tier} ` +
        `adjacent=${monsterInfo} ` +
        `goal=${goal?.type}@(${goal?.target?.x},${goal?.target?.y}) ` +
        `action=${action.type}${action.type === 'attack' ? ':' + action.targetId : action.type === 'move' ? ':' + action.direction : ''}`
      )
    }
  }

  // Check for transition into KILL goal
  if (goal?.type === 'KILL' && lastGoalType !== 'KILL') {
    console.log(`\n>>> KILL goal started at turn ${turn}`)
  }
  if (lastGoalType === 'KILL' && goal?.type !== 'KILL') {
    console.log(`<<< KILL goal ended at turn ${turn} (new goal: ${goal?.type})\n`)
  }
  lastGoalType = goal?.type ?? ''

  processAction(game, action)
}

console.log(`\nTotal KILL/adjacent turns logged: ${killGoalTurns}`)
console.log(`Final: depth=${game.character.depth} kills=${game.stats.kills} hp=${game.character.hp}`)
