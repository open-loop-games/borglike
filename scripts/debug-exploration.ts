/**
 * Debug script to understand exploration behavior
 */

import { createGame, processTurn, getTile, isWalkable } from '../src/game'
import { createBotState, runBotTick, getExplorationStats, findFrontierTiles } from '../src/game/bot'

const seed = 12345
const game = createGame({
  raceId: 'human',
  classId: 'warrior',
  seed,
  botPersonality: 'cautious',
})

const botState = createBotState()

console.log('='.repeat(60))
console.log('EXPLORATION DEBUG')
console.log('='.repeat(60))

// Run 200 turns and check exploration progress
for (let turn = 0; turn < 200 && game.isRunning; turn++) {
  const action = runBotTick(game, 'cautious', undefined, botState)
  processTurn(game, action)

  // Every 25 turns, log debug info
  if (turn % 25 === 0 || turn === 199) {
    const stats = getExplorationStats(game)
    const frontier = findFrontierTiles(game)
    const goal = botState.currentGoal
    const pos = game.character.position

    console.log(`\n--- Turn ${game.turn} ---`)
    console.log(`Position: (${pos.x}, ${pos.y})`)
    console.log(`HP: ${game.character.hp}/${game.character.maxHp}`)
    console.log(`Exploration: ${stats.progress}% (${stats.exploredTiles}/${stats.totalExplorableTiles})`)
    console.log(`Frontier: ${stats.frontierSize} tiles`)
    console.log(`Stairs found: ${stats.stairsFound}`)
    console.log(`Goal: ${goal?.type ?? 'NONE'}`)
    if (goal?.target) {
      console.log(`Goal target: (${goal.target.x}, ${goal.target.y})`)
    }
    console.log(`Bot goal target: ${botState.goalTarget ? `(${botState.goalTarget.x}, ${botState.goalTarget.y})` : 'none'}`)
    console.log(`Turns on level: ${botState.turnsOnLevel}`)

    // Show top 5 frontier tiles
    if (frontier.length > 0) {
      console.log('Top frontier tiles:')
      for (const f of frontier.slice(0, 5)) {
        const tile = getTile(game.currentLevel, f.position.x, f.position.y)
        console.log(`  (${f.position.x}, ${f.position.y}): potential=${f.unexploredNeighbors}, dist=${f.distance}, score=${f.score}, type=${tile?.type ?? 'unknown'}`)
      }
    }

    // Debug descent decision
    const knownStairs = botState.knownStairsDown
    console.log(`Known stairs: ${knownStairs ? `(${knownStairs.x}, ${knownStairs.y})` : 'none'}`)

    // Check if action was move
    if (action.type === 'move') {
      console.log(`Action: move ${action.direction}`)
    } else if (action.type === 'wait') {
      console.log(`Action: WAIT (stuck?)`)
    } else if (action.type === 'descend') {
      console.log(`Action: DESCEND`)
    } else {
      console.log(`Action: ${action.type}`)
    }
  }
}

console.log('\n' + '='.repeat(60))
console.log('DEBUG COMPLETE')
console.log('='.repeat(60))

// Print level map with explored tiles
console.log('\nLevel map (# = unexplored, . = explored floor, + = explored door, > = stairs):')
const level = game.currentLevel
const pos = game.character.position
for (let y = 0; y < Math.min(level.height, 30); y++) {
  let row = ''
  for (let x = 0; x < Math.min(level.width, 60); x++) {
    const tile = getTile(level, x, y)
    if (x === pos.x && y === pos.y) {
      row += '@'
    } else if (tile) {
      if (!tile.explored) {
        row += '#'
      } else if (tile.type === 'stairs_down') {
        row += '>'
      } else if (tile.type === 'stairs_up') {
        row += '<'
      } else if (tile.type === 'floor') {
        row += '.'
      } else if (tile.type === 'door_open') {
        row += '/'
      } else if (tile.type === 'door_closed') {
        row += '+'
      } else if (tile.type === 'wall') {
        row += '#'
      } else {
        row += '?'
      }
    } else {
      row += ' '
    }
  }
  console.log(row)
}
