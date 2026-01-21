/**
 * Debug Bot AI - Comprehensive analysis after fixes
 */

import { createGame, processTurn } from '../src/game/game-loop'
import { runBotTick, createBotState } from '../src/game/bot'

function main() {
  console.log('='.repeat(80))
  console.log('Post-Fix Analysis - 500 turns')
  console.log('='.repeat(80))
  console.log()

  const game = createGame({
    raceId: 'human',
    classId: 'warrior',
    botPersonality: 'cautious',
  })

  const botState = createBotState()

  let totalTwitchSum = 0
  let highTwitchTurns = 0
  let depthChanges: { turn: number; depth: number }[] = []
  let lastDepth = 1
  let actionCounts = new Map<string, number>()

  for (let i = 0; i < 500 && game.isRunning; i++) {
    const action = runBotTick(game, 'cautious', botState)

    // Track stats
    totalTwitchSum += botState.twitchCounter
    if (botState.twitchCounter >= 8) highTwitchTurns++

    const baseAction = action.type
    actionCounts.set(baseAction, (actionCounts.get(baseAction) || 0) + 1)

    processTurn(game, action)

    // Track depth changes
    if (game.character.depth !== lastDepth) {
      depthChanges.push({ turn: i + 1, depth: game.character.depth })
      lastDepth = game.character.depth
    }

    // Log every 100 turns
    if ((i + 1) % 100 === 0) {
      console.log(`Turn ${i + 1}: Depth ${game.character.depth}, HP ${game.character.hp}/${game.character.maxHp}, Twitch ${botState.twitchCounter}`)
    }
  }

  console.log()
  console.log('='.repeat(80))
  console.log('SUMMARY')
  console.log('-'.repeat(80))
  console.log(`Total turns: ${game.turn}`)
  console.log(`Final depth: ${game.character.depth}`)
  console.log(`Final HP: ${game.character.hp}/${game.character.maxHp}`)
  console.log(`Game running: ${game.isRunning}`)
  console.log(`Kills: ${game.stats.kills}`)
  console.log()

  console.log(`Depth changes: ${depthChanges.length}`)
  for (const dc of depthChanges) {
    console.log(`  Turn ${dc.turn}: descended to depth ${dc.depth}`)
  }
  console.log()

  console.log('Action distribution:')
  const sortedActions = [...actionCounts.entries()].sort((a, b) => b[1] - a[1])
  for (const [action, count] of sortedActions) {
    console.log(`  ${action}: ${count} (${(count / game.turn * 100).toFixed(1)}%)`)
  }
  console.log()

  console.log(`High twitch turns (>=8): ${highTwitchTurns} (${(highTwitchTurns / game.turn * 100).toFixed(1)}%)`)
  console.log(`Average twitch: ${(totalTwitchSum / game.turn).toFixed(2)}`)
}

main()
