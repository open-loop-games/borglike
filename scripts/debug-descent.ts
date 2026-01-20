/**
 * Debug script to understand descent behavior
 */

import { createGame, processTurn } from '../src/game'
import { createBotState, runBotTick, getExplorationProgress, BASE_CONFIGS } from '../src/game/bot'

const seed = 12345
const game = createGame({
  raceId: 'human',
  classId: 'warrior',
  seed,
  botPersonality: 'cautious',
})

const botState = createBotState()
const config = BASE_CONFIGS.cautious

console.log('='.repeat(60))
console.log('DESCENT DEBUG')
console.log('='.repeat(60))
console.log(`Cautious personality config:`)
console.log(`  exploration threshold: ${config.exploration}%`)
console.log(`  patience: ${config.patience} turns`)
console.log('')

// Run until descent or 300 turns
for (let turn = 0; turn < 300 && game.isRunning; turn++) {
  const action = runBotTick(game, 'cautious', undefined, botState)

  // Log key metrics every 25 turns
  if (turn % 25 === 0 || turn === 299 || action.type === 'descend') {
    const explorationProgress = getExplorationProgress(game)
    const knownStairs = botState.knownStairsDown
    const goal = botState.currentGoal

    console.log(`--- Turn ${game.turn} ---`)
    console.log(`  Goal: ${goal?.type ?? 'NONE'}`)
    console.log(`  Exploration: ${explorationProgress}% (threshold: ${config.exploration}%)`)
    console.log(`  Turns on level: ${botState.turnsOnLevel} (patience: ${config.patience})`)
    console.log(`  Known stairs: ${knownStairs ? `(${knownStairs.x}, ${knownStairs.y})` : 'none'}`)
    console.log(`  Action: ${action.type}`)

    // Check descent conditions
    const shouldDescend = explorationProgress >= config.exploration || botState.turnsOnLevel >= config.patience
    console.log(`  Should descend: ${shouldDescend} (exploration >= ${config.exploration} OR turnsOnLevel >= ${config.patience})`)
    console.log(`    explorationProgress >= exploration: ${explorationProgress} >= ${config.exploration} = ${explorationProgress >= config.exploration}`)
    console.log(`    turnsOnLevel >= patience: ${botState.turnsOnLevel} >= ${config.patience} = ${botState.turnsOnLevel >= config.patience}`)
    console.log('')
  }

  processTurn(game, action)

  // Stop if we descended
  if (game.character.depth > 1) {
    console.log(`DESCENDED to depth ${game.character.depth}!`)
    break
  }
}

console.log('='.repeat(60))
console.log('DESCENT DEBUG COMPLETE')
console.log('='.repeat(60))
