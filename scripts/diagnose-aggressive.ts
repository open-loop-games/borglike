/**
 * Detailed diagnostic for aggressive personality stuck issues
 */
import { createGame, processTurn } from '../src/game'
import { runBotTick, createBotState } from '../src/game/bot'
import type { GameAction, BotPersonality } from '../src/game/types'

function runDiagnostic() {
  const personality: BotPersonality = 'aggressive'

  console.log('Detailed aggressive stuck analysis (50 runs)')
  console.log('')

  let totalStuckTurns = 0
  let totalTurns = 0
  let highStuckRuns = 0
  const highStuckSeeds: number[] = []

  for (let run = 0; run < 50; run++) {
    const seed = run
    const game = createGame({
      raceId: 'human',
      classId: 'warrior',
      seed,
      botPersonality: personality,
    })
    const botState = createBotState()
    let stuckTurns = 0
    let runTurns = 0

    while (game.isRunning && game.turn < 5000) {
      runTurns++
      totalTurns++

      const action: GameAction = runBotTick(game, personality, undefined, botState)
      const goal = botState.currentGoal

      if (!goal || goal.type === 'WAIT') {
        stuckTurns++
        totalStuckTurns++
      }

      processTurn(game, action)
    }

    const runStuckRate = (stuckTurns / runTurns) * 100
    if (runStuckRate > 5) {
      highStuckRuns++
      highStuckSeeds.push(seed)
      console.log('Run ' + run + ' (seed=' + seed + '): stuck=' + stuckTurns + '/' + runTurns + ' (' + runStuckRate.toFixed(1) + '%)')
    }
  }

  console.log('')
  console.log('Summary:')
  console.log('  Overall stuck rate: ' + ((totalStuckTurns / totalTurns) * 100).toFixed(2) + '%')
  console.log('  High-stuck runs (>5%): ' + highStuckRuns + '/50')
  console.log('  Problem seeds: ' + highStuckSeeds.join(', '))
}

runDiagnostic()
