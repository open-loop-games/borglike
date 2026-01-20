/**
 * Diagnostic for depth/stairs issues
 */
import { createGame, processTurn } from '../src/game'
import { runBotTick, createBotState, getExplorationStats } from '../src/game/bot'
import type { BotPersonality, GameAction } from '../src/game/types'

function runDiagnostic() {
  const personality: BotPersonality = 'cautious'

  console.log('Depth/Stairs analysis for ' + personality + ' (50 runs)')
  console.log('')

  let totalLevels = 0
  let stairsFound = 0
  let diedLevel1 = 0
  let diedLevel2 = 0
  let diedLevel3Plus = 0
  let avgTurnsPerLevel: number[] = []
  let stairsFoundOnDeathLevel = 0
  let stairsNotFoundOnDeathLevel = 0

  for (let run = 0; run < 50; run++) {
    const game = createGame({
      raceId: 'human',
      classId: 'warrior',
      seed: run,
      botPersonality: personality,
    })
    const botState = createBotState()
    let currentDepth = 1
    let turnsOnLevel = 0
    let foundStairsThisLevel = false

    while (game.isRunning && game.turn < 5000) {
      turnsOnLevel++

      // Check level change
      if (game.character.depth !== currentDepth) {
        // Record previous level
        totalLevels++
        if (foundStairsThisLevel) stairsFound++
        avgTurnsPerLevel.push(turnsOnLevel)

        // Reset for new level
        currentDepth = game.character.depth
        turnsOnLevel = 0
        foundStairsThisLevel = false
      }

      // Check if stairs found
      const stats = getExplorationStats(game)
      if (stats.stairsFound) {
        foundStairsThisLevel = true
      }

      const action: GameAction = runBotTick(game, personality, undefined, botState)
      processTurn(game, action)
    }

    // Record death level stats
    totalLevels++
    if (foundStairsThisLevel) {
      stairsFound++
      stairsFoundOnDeathLevel++
    } else {
      stairsNotFoundOnDeathLevel++
    }
    avgTurnsPerLevel.push(turnsOnLevel)

    const depth = game.character.depth
    if (depth === 1) diedLevel1++
    else if (depth === 2) diedLevel2++
    else diedLevel3Plus++
  }

  const stairsRate = (stairsFound / totalLevels) * 100
  const avgTurns = avgTurnsPerLevel.reduce((a, b) => a + b, 0) / avgTurnsPerLevel.length

  console.log('Results:')
  console.log('  Total levels visited: ' + totalLevels)
  console.log('  Stairs found rate: ' + stairsRate.toFixed(1) + '%')
  console.log('  Avg turns per level: ' + avgTurns.toFixed(0))
  console.log('')
  console.log('  Deaths on level 1: ' + diedLevel1)
  console.log('  Deaths on level 2: ' + diedLevel2)
  console.log('  Deaths on level 3+: ' + diedLevel3Plus)
  console.log('')
  console.log('  On death level, stairs found: ' + stairsFoundOnDeathLevel)
  console.log('  On death level, stairs NOT found: ' + stairsNotFoundOnDeathLevel)
}

runDiagnostic()
