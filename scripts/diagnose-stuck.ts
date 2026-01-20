/**
 * Diagnostic script for stuck/exploration issues
 */
import { createGame, processTurn } from '../src/game'
import { runBotTick, createBotState, getExplorationStats } from '../src/game/bot'
import type { BotPersonality, GameAction } from '../src/game/types'

function runDiagnostic() {
  const personalities: BotPersonality[] = ['aggressive', 'cautious', 'greedy', 'speedrunner']

  for (const personality of personalities) {
    let totalRuns = 0
    let stuckRuns = 0
    let avgWaits = 0
    let avgExploreTime = 0
    let avgStairsFoundTurn = 0
    let stairsFoundCount = 0
    let diedBeforeStairs = 0

    for (let run = 0; run < 20; run++) {
      const game = createGame({
        raceId: 'human',
        classId: 'warrior',
        seed: run * 1000 + Date.now() % 1000,
        botPersonality: personality,
      })
      const botState = createBotState()
      let waits = 0
      let stairsFoundTurn = -1
      let depth1Turns = 0
      let foundStairsOnLevel = false

      for (let t = 0; t < 1000; t++) {
        if (!game.isRunning) {
          if (!foundStairsOnLevel && game.character.depth === 1) {
            diedBeforeStairs++
          }
          break
        }

        // Track when we find stairs on level 1
        if (game.character.depth === 1) {
          depth1Turns++
          const stats = getExplorationStats(game)
          if (stats.stairsFound && !foundStairsOnLevel) {
            stairsFoundTurn = t
            foundStairsOnLevel = true
          }
        }

        const action: GameAction = runBotTick(game, personality, undefined, botState)

        if (action.type === 'wait') {
          waits++
        }

        processTurn(game, action)
      }

      totalRuns++
      avgWaits += waits
      avgExploreTime += depth1Turns

      if (stairsFoundTurn > 0) {
        stairsFoundCount++
        avgStairsFoundTurn += stairsFoundTurn
      }

      // Check if stuck - too many waits relative to total turns
      if (waits > 20) {
        stuckRuns++
      }
    }

    console.log('')
    console.log(personality.toUpperCase() + ':')
    console.log('  Stuck runs (>20 waits): ' + stuckRuns + '/' + totalRuns)
    console.log('  Avg waits per run: ' + (avgWaits / totalRuns).toFixed(1))
    console.log('  Avg L1 turns: ' + (avgExploreTime / totalRuns).toFixed(0))
    console.log('  Stairs found on L1: ' + stairsFoundCount + '/' + totalRuns)
    console.log('  Died before finding stairs: ' + diedBeforeStairs)
    if (stairsFoundCount > 0) {
      console.log('  Avg turn when stairs found: ' + (avgStairsFoundTurn / stairsFoundCount).toFixed(0))
    }
  }
}

runDiagnostic()
