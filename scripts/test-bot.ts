/**
 * Test script for Bot AI
 *
 * Run with: npx tsx scripts/test-bot.ts
 */

import { createGameRunner, quickRun, runBatchGames } from '../src/game/index'
import type { BotPersonality } from '../src/game/types'

async function main() {
  console.log('='.repeat(60))
  console.log('Borglike Bot AI Test')
  console.log('='.repeat(60))
  console.log()

  // Test 1: Quick single run
  console.log('Test 1: Quick single run (Human Warrior, Cautious)')
  console.log('-'.repeat(40))

  const result1 = quickRun('human', 'warrior', 'cautious', 5000)
  console.log(`Result: ${result1.reason}`)
  console.log(`Turns: ${result1.turnsPlayed}`)
  console.log(`Max Depth: ${result1.maxDepth}`)
  console.log(`Kills: ${result1.kills}`)
  console.log(`Essence: ${result1.essence}`)
  console.log(`Final HP: ${result1.game.character.hp}/${result1.game.character.maxHp}`)
  console.log(`Level: ${result1.game.character.level}`)
  console.log()

  // Test 2: Test different personalities
  console.log('Test 2: Compare personalities (10 runs each)')
  console.log('-'.repeat(40))

  const personalities: BotPersonality[] = ['cautious', 'aggressive', 'greedy', 'speedrunner']

  for (const personality of personalities) {
    const batch = await runBatchGames(
      {
        raceId: 'human',
        classId: 'warrior',
        botPersonality: personality,
        maxTurns: 3000,
      },
      10
    )

    console.log(`${personality.padEnd(12)} | ` +
      `Avg Depth: ${batch.averageDepth.toFixed(1).padStart(4)} | ` +
      `Max: ${batch.maxDepth.toString().padStart(2)} | ` +
      `Avg Kills: ${batch.averageKills.toFixed(1).padStart(5)} | ` +
      `Essence: ${batch.averageEssence.toFixed(0).padStart(4)}`)
  }
  console.log()

  // Test 3: Step-by-step execution with logging
  console.log('Test 3: Step-by-step execution (first 20 turns)')
  console.log('-'.repeat(40))

  const runner = createGameRunner({
    raceId: 'elf',
    classId: 'mage',
    botPersonality: 'cautious',
    maxTurns: 100,
    onTurn: (game, _events) => {
      if (game.turn <= 20) {
        const lastMsg = game.messages[game.messages.length - 1]
        console.log(`Turn ${game.turn.toString().padStart(3)}: ` +
          `HP ${game.character.hp}/${game.character.maxHp} | ` +
          `Depth ${game.character.depth} | ` +
          (lastMsg ? lastMsg.text.substring(0, 40) : ''))
      }
    },
    onEnd: (_game, reason) => {
      console.log(`Game ended: ${reason}`)
    }
  })

  runner.runToCompletion()
  console.log()

  // Test 4: Test different race/class combos
  console.log('Test 4: Different race/class combinations')
  console.log('-'.repeat(40))

  const combos = [
    { race: 'human', class: 'warrior' },
    { race: 'elf', class: 'mage' },
    { race: 'dwarf', class: 'paladin' },
    { race: 'hobbit', class: 'rogue' },
  ]

  for (const combo of combos) {
    const result = quickRun(combo.race, combo.class, 'cautious', 3000)
    console.log(`${(combo.race + ' ' + combo.class).padEnd(20)} | ` +
      `Depth: ${result.maxDepth.toString().padStart(2)} | ` +
      `Kills: ${result.kills.toString().padStart(3)} | ` +
      `${result.reason}`)
  }
  console.log()

  console.log('='.repeat(60))
  console.log('All tests completed!')
  console.log('='.repeat(60))
}

main().catch(console.error)
