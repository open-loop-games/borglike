/**
 * Test the circuit breaker for stuck bots
 */
import { createGameRunner } from '../src/game/game-runner'

// Run a game and track turnsOnLevel
const runner = createGameRunner({
  raceId: 'human',
  classId: 'warrior',
  botPersonality: 'cautious',
  maxTurns: 5000,
  onTurn: (game, _events) => {
    const botState = runner.getBotState()
    if (game.turn % 100 === 0) {
      console.log(`Turn ${game.turn}: depth=${game.character.depth}, turnsOnLevel=${botState.turnsOnLevel}, hp=${game.character.hp}/${game.character.maxHp}`)
    }
  },
  onEnd: (game, reason) => {
    const botState = runner.getBotState()
    console.log(`\nGame ended: ${reason}`)
    console.log(`Final depth: ${game.character.depth}`)
    console.log(`Final turnsOnLevel: ${botState.turnsOnLevel}`)
    console.log(`Total turns: ${game.turn}`)
    console.log(`Character dead: ${game.character.isDead}`)
  }
})

console.log('Starting test run...\n')
runner.runToCompletion()
