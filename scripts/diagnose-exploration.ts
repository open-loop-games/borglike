/**
 * Diagnostic for exploration efficiency
 */
import { createGame, processTurn } from '../src/game'
import { runBotTick, createBotState, getExplorationStats } from '../src/game/bot'
import type { BotPersonality, GameAction } from '../src/game/types'

function runDiagnostic() {
  const personality: BotPersonality = 'cautious'

  console.log('Exploration efficiency analysis (20 runs)')
  console.log('')

  let totalFoundTurn = 0
  let foundCount = 0
  let notFoundAtDeath = 0
  let explorationAtDeath: number[] = []

  for (let run = 0; run < 20; run++) {
    const game = createGame({
      raceId: 'human',
      classId: 'warrior',
      seed: run,
      botPersonality: personality,
    })
    const botState = createBotState()
    let foundStairsThisLevel = false
    let stairsFoundTurn = -1
    let turnsOnLevel = 0
    let currentDepth = 1

    while (game.isRunning && game.turn < 5000) {
      // Level change
      if (game.character.depth !== currentDepth) {
        // Reset
        foundStairsThisLevel = false
        stairsFoundTurn = -1
        turnsOnLevel = 0
        currentDepth = game.character.depth
      }

      turnsOnLevel++
      const stats = getExplorationStats(game)

      // Track when stairs found
      if (stats.stairsFound && !foundStairsThisLevel) {
        foundStairsThisLevel = true
        stairsFoundTurn = turnsOnLevel
        totalFoundTurn += turnsOnLevel
        foundCount++
      }

      const action: GameAction = runBotTick(game, personality, undefined, botState)
      processTurn(game, action)
    }

    // On death
    const finalStats = getExplorationStats(game)
    explorationAtDeath.push(finalStats.explored)
    if (!foundStairsThisLevel) {
      notFoundAtDeath++
      console.log('Run ' + run + ': Died at depth ' + game.character.depth +
        ' after ' + turnsOnLevel + ' turns, explored ' + finalStats.explored +
        '%, stairs NOT found')
    } else {
      console.log('Run ' + run + ': Died at depth ' + game.character.depth +
        ' after ' + turnsOnLevel + ' turns, explored ' + finalStats.explored +
        '%, stairs found at turn ' + stairsFoundTurn)
    }
  }

  console.log('')
  console.log('Summary:')
  console.log('  Avg turn when stairs found: ' + (foundCount > 0 ? (totalFoundTurn / foundCount).toFixed(0) : 'N/A'))
  console.log('  Times died without finding stairs: ' + notFoundAtDeath + '/20')
  const avgExplored = explorationAtDeath.reduce((a, b) => a + b, 0) / explorationAtDeath.length
  console.log('  Avg exploration at death: ' + avgExplored.toFixed(1) + '%')
}

runDiagnostic()
