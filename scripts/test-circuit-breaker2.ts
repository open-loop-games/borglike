/**
 * Test the circuit breaker with lower threshold
 */
import { createGame, processTurn } from '../src/game/game-loop'
import { runBotTick, createBotState } from '../src/game/bot'
import { MAX_DEPTH } from '../src/game/types'

const STALE_LEVEL_THRESHOLD = 100 // Lower for testing

const game = createGame({
  raceId: 'human',
  classId: 'warrior',
})

const botState = createBotState()

console.log('Testing circuit breaker with threshold =', STALE_LEVEL_THRESHOLD)
console.log('MAX_DEPTH =', MAX_DEPTH)
console.log('Starting depth:', game.character.depth)
console.log('')

let triggered = false
for (let i = 0; i < 500 && game.isRunning; i++) {
  const action = runBotTick(game, 'cautious', botState)
  processTurn(game, action)
  
  // Circuit breaker check (same as game-runner.ts)
  if (botState.turnsOnLevel > STALE_LEVEL_THRESHOLD && game.character.depth < MAX_DEPTH) {
    console.log(`\nCircuit breaker TRIGGERED at turn ${game.turn}!`)
    console.log(`  turnsOnLevel: ${botState.turnsOnLevel}`)
    console.log(`  depth: ${game.character.depth}`)
    game.character.hp = 0
    game.character.isDead = true
    game.isRunning = false
    triggered = true
  }
  
  if (i % 50 === 0) {
    console.log(`Turn ${game.turn}: depth=${game.character.depth}, turnsOnLevel=${botState.turnsOnLevel}`)
  }
}

if (!triggered) {
  console.log('\nCircuit breaker did NOT trigger')
  console.log(`Final turnsOnLevel: ${botState.turnsOnLevel}`)
  console.log(`Final depth: ${game.character.depth}`)
  console.log(`Game running: ${game.isRunning}`)
}
