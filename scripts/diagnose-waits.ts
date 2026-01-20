/**
 * Diagnostic script for understanding wait actions
 */
import { createGame, processTurn } from '../src/game'
import { runBotTick, createBotState, getExplorationStats } from '../src/game/bot'
import type { BotPersonality, GameAction } from '../src/game/types'

function runDiagnostic() {
  const personality: BotPersonality = 'aggressive'

  // Track wait reasons across runs
  const waitReasons: Record<string, number> = {}
  let totalWaits = 0
  let runs = 0

  for (let run = 0; run < 5; run++) {
    const game = createGame({
      raceId: 'human',
      classId: 'warrior',
      seed: run * 1000 + Date.now() % 1000,
      botPersonality: personality,
    })
    const botState = createBotState()

    for (let t = 0; t < 500; t++) {
      if (!game.isRunning) break

      const action: GameAction = runBotTick(game, personality, undefined, botState)

      if (action.type === 'wait') {
        totalWaits++
        const goalType = botState.currentGoal?.type || 'NO_GOAL'
        const reason = botState.currentGoal?.reason || 'unknown'
        const key = goalType + ': ' + reason.substring(0, 30)
        waitReasons[key] = (waitReasons[key] || 0) + 1
      }

      processTurn(game, action)
    }
    runs++
  }

  console.log('Wait Analysis for ' + personality.toUpperCase())
  console.log('Total waits: ' + totalWaits + ' across ' + runs + ' runs')
  console.log('')
  console.log('Wait reasons:')

  const sorted = Object.entries(waitReasons)
    .sort((a, b) => b[1] - a[1])

  for (const [reason, count] of sorted) {
    console.log('  ' + count.toString().padStart(4) + 'x  ' + reason)
  }
}

runDiagnostic()
