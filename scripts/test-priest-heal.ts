/**
 * Test script for Priest self-healing behavior
 *
 * Run with: npx tsx scripts/test-priest-heal.ts
 */

import { createGameRunner } from '../src/game/index'

async function main() {
  console.log('='.repeat(60))
  console.log('Priest Healing Test')
  console.log('='.repeat(60))
  console.log()

  let healCount = 0
  let attackCount = 0
  let lowHpAttacks = 0  // Attacks when HP < 50%

  const runner = createGameRunner({
    raceId: 'human',
    classId: 'priest',
    botPersonality: 'cautious',
    maxTurns: 2000,
    onTurn: (game, events) => {
      const char = game.character
      const hpPercent = Math.floor(char.hp / char.maxHp * 100)

      // Get all messages from this turn
      const turnMsgs = game.messages.filter(m => m.turn === game.turn)

      for (const msg of turnMsgs) {
        const msgText = msg.text

        // Check for healing spell casts
        if (msgText.includes('Minor Heal') || msgText.includes('Cure Wounds')) {
          healCount++
          console.log(`Turn ${game.turn}: HEALED - ${msgText} (HP now ${hpPercent}%)`)
        }

        // Check for attacks
        if (msgText.includes('You hit') || msgText.includes('You miss')) {
          attackCount++
          if (hpPercent < 50) {
            lowHpAttacks++
            console.log(`Turn ${game.turn}: ATTACK at ${hpPercent}% HP - ${msgText.substring(0, 50)}`)
          }
        }

        // Check for monster attacks on priest
        if (msgText.includes('hits you') || msgText.includes('misses you')) {
          console.log(`Turn ${game.turn}: MONSTER HIT - ${msgText.substring(0, 60)} (HP now ${hpPercent}%)`)
        }
      }

      // Log every 100 turns
      if (game.turn % 200 === 0) {
        console.log(`--- Turn ${game.turn}: Depth ${char.depth}, Level ${char.level}, HP ${char.hp}/${char.maxHp}, MP ${char.mp}/${char.maxMp} ---`)
      }
    },
    onEnd: (game, reason) => {
      console.log()
      console.log('='.repeat(60))
      console.log(`Game ended: ${reason}`)
      console.log(`Final: Depth ${game.character.depth}, Level ${game.character.level}`)
      console.log(`Turns: ${game.turn}`)
      console.log()
      console.log('=== Healing Analysis ===')
      console.log(`Total heals: ${healCount}`)
      console.log(`Total attacks: ${attackCount}`)
      console.log(`Attacks at <50% HP: ${lowHpAttacks}`)
      if (healCount === 0 && attackCount > 0) {
        console.log('>>> BUG CONFIRMED: Priest never healed!')
      }
      console.log('='.repeat(60))
    }
  })

  runner.runToCompletion()
}

main().catch(console.error)
