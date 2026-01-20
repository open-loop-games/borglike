/**
 * Extended Bot AI Test - More turns to test deeper progression
 *
 * Run with: npx tsx scripts/test-bot-extended.ts
 */

import { createGameRunner, quickRun, runBatchGames } from '../src/game/index'
import type { BotPersonality } from '../src/game/types'

async function main() {
  console.log('='.repeat(60))
  console.log('Borglike Bot AI Extended Test (More Turns)')
  console.log('='.repeat(60))
  console.log()

  // Test 1: Single long run
  console.log('Test 1: Long single run (Human Warrior, Cautious, 20000 turns)')
  console.log('-'.repeat(40))

  const result1 = quickRun('human', 'warrior', 'cautious', 20000)
  console.log('Result: ' + result1.reason)
  console.log('Turns: ' + result1.turnsPlayed)
  console.log('Max Depth: ' + result1.maxDepth)
  console.log('Kills: ' + result1.kills)
  console.log('Essence: ' + result1.essence)
  console.log('Final HP: ' + result1.game.character.hp + '/' + result1.game.character.maxHp)
  console.log('Level: ' + result1.game.character.level)
  console.log()

  // Test 2: Compare personalities with 15000 turn limit
  console.log('Test 2: Compare personalities (10 runs each, 15000 turns)')
  console.log('-'.repeat(40))

  const personalities: BotPersonality[] = ['cautious', 'aggressive', 'greedy', 'speedrunner']

  for (const personality of personalities) {
    const batch = await runBatchGames(
      {
        raceId: 'human',
        classId: 'warrior',
        botPersonality: personality,
        maxTurns: 15000,
      },
      10
    )

    const line = personality.padEnd(12) + ' | ' +
      'Avg Depth: ' + batch.averageDepth.toFixed(1).padStart(4) + ' | ' +
      'Max: ' + batch.maxDepth.toString().padStart(2) + ' | ' +
      'Avg Kills: ' + batch.averageKills.toFixed(1).padStart(5) + ' | ' +
      'Avg Turns: ' + batch.averageTurns.toFixed(0).padStart(5) + ' | ' +
      'Deaths: ' + batch.deaths
    console.log(line)
  }
  console.log()

  // Test 3: Different race/class combos with more turns
  console.log('Test 3: Race/class combinations (15000 turns each)')
  console.log('-'.repeat(40))

  const combos = [
    { race: 'human', class: 'warrior' },
    { race: 'elf', class: 'mage' },
    { race: 'dwarf', class: 'paladin' },
    { race: 'hobbit', class: 'rogue' },
    { race: 'half_orc', class: 'warrior' },
    { race: 'high_elf', class: 'ranger' },
  ]

  for (const combo of combos) {
    const result = quickRun(combo.race, combo.class, 'cautious', 15000)
    const line = (combo.race + ' ' + combo.class).padEnd(20) + ' | ' +
      'Depth: ' + result.maxDepth.toString().padStart(2) + ' | ' +
      'Kills: ' + result.kills.toString().padStart(3) + ' | ' +
      'Level: ' + result.game.character.level.toString().padStart(2) + ' | ' +
      result.reason
    console.log(line)
  }
  console.log()

  // Test 4: Aggressive personality deep run
  console.log('Test 4: Aggressive personality deep run (25000 turns)')
  console.log('-'.repeat(40))

  const result4 = quickRun('half_orc', 'warrior', 'aggressive', 25000)
  console.log('Result: ' + result4.reason)
  console.log('Turns: ' + result4.turnsPlayed)
  console.log('Max Depth: ' + result4.maxDepth)
  console.log('Kills: ' + result4.kills)
  console.log('Level: ' + result4.game.character.level)
  console.log('Essence: ' + result4.essence)
  console.log()

  console.log('='.repeat(60))
  console.log('All extended tests completed!')
  console.log('='.repeat(60))
}

main().catch(console.error)
