/**
 * Diagnostic for what validation counts as "stuck"
 */
import { createGame, processTurn } from '../src/game'
import { runBotTick, createBotState } from '../src/game/bot'
import type { BotPersonality, GameAction } from '../src/game/types'

function runDiagnostic() {
  const personalities: BotPersonality[] = ['aggressive', 'cautious', 'greedy', 'speedrunner']

  for (const personality of personalities) {
    let totalTurns = 0
    let noGoalTurns = 0
    let waitGoalTurns = 0
    const noGoalReasons: Record<string, number> = {}

    for (let run = 0; run < 20; run++) {
      const game = createGame({
        raceId: 'human',
        classId: 'warrior',
        seed: run * 1000,
        botPersonality: personality,
      })
      const botState = createBotState()

      for (let t = 0; t < 1000; t++) {
        if (!game.isRunning) break
        totalTurns++

        const action: GameAction = runBotTick(game, personality, undefined, botState)
        const goal = botState.currentGoal

        if (!goal) {
          noGoalTurns++
          noGoalReasons['no_goal'] = (noGoalReasons['no_goal'] || 0) + 1
        } else if (goal.type === 'WAIT') {
          waitGoalTurns++
          const key = 'WAIT: ' + (goal.reason || 'unknown')
          noGoalReasons[key] = (noGoalReasons[key] || 0) + 1
        }

        processTurn(game, action)
      }
    }

    const stuckRate = ((noGoalTurns + waitGoalTurns) / totalTurns) * 100

    console.log('')
    console.log(personality.toUpperCase() + ':')
    console.log('  Total turns: ' + totalTurns)
    console.log('  No goal turns: ' + noGoalTurns)
    console.log('  WAIT goal turns: ' + waitGoalTurns)
    console.log('  Stuck rate: ' + stuckRate.toFixed(2) + '%')
    console.log('  Reasons:')
    for (const [reason, count] of Object.entries(noGoalReasons).sort((a, b) => b[1] - a[1])) {
      console.log('    ' + count.toString().padStart(5) + 'x  ' + reason)
    }
  }
}

runDiagnostic()
