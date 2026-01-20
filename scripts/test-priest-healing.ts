/**
 * Test script to diagnose Priest self-healing behavior
 */

import { createGame, processTurn } from '../src/game/game-loop'
import { runBotTick, createBotState } from '../src/game/bot-ai'
import { getAvailableSpells, getKnownSpells } from '../src/game/spell-resolution'
import { getHealingSpellAction } from '../src/game/bot/spells'
import { getPersonalityConfig } from '../src/game/bot/personality'
import type { RunConfig } from '../src/game/types'

// Create a Priest run
const config: RunConfig = {
  raceId: 'human',
  classId: 'priest',
  seed: Date.now(),
}

const game = createGame(config)
const botState = createBotState()
const personality = 'cautious'
const personalityConfig = getPersonalityConfig(personality)

console.log('=== Priest Healing Test ===\n')

// Check starting state
console.log('Character:', game.character.name)
console.log('Class:', game.character.classId)
console.log('Level:', game.character.level)
console.log('Stats:', game.character.stats)
console.log('HP:', game.character.hp, '/', game.character.maxHp)
console.log('MP:', game.character.mp, '/', game.character.maxMp)
console.log('')

// Check known spells
const knownSpells = getKnownSpells(game.character)
console.log('Known spells:', knownSpells)

// Check available spells
const availableSpells = getAvailableSpells(game.character, game.turn)
console.log('\nAvailable spells at turn', game.turn, ':')
for (const entry of availableSpells) {
  console.log(`  - ${entry.spell.name} (${entry.spell.id}): canCast=${entry.canCast}, reason=${entry.reason || 'OK'}`)
  console.log(`    manaCost: ${entry.spell.manaCost}, effectType: ${entry.spell.effectType}`)
}

// Simulate damage to trigger healing
console.log('\n=== Simulating damage ===')
game.character.hp = Math.floor(game.character.maxHp * 0.4) // Set to 40% HP
console.log('HP after damage:', game.character.hp, '/', game.character.maxHp, `(${Math.floor(game.character.hp / game.character.maxHp * 100)}%)`)

// Check healing spell action
console.log('\n=== Checking heal spell action ===')
const healAction = getHealingSpellAction(game, personalityConfig)
console.log('Heal action:', healAction)

// Run a few bot ticks to see behavior
console.log('\n=== Running bot ticks ===')
for (let i = 0; i < 10; i++) {
  const action = runBotTick(game, personality, undefined, botState)
  console.log(`Turn ${game.turn}: action=${action.type}${action.type === 'cast' ? ` (spell: ${(action as any).spellId})` : ''}`)
  console.log(`  HP: ${game.character.hp}/${game.character.maxHp}, MP: ${game.character.mp}/${game.character.maxMp}`)

  // Process the turn
  processTurn(game, action)

  // Check if healed
  if (action.type === 'cast' && (action as any).spellId === 'minor_heal') {
    console.log('  >>> HEALED!')
  }

  // Reset HP if full
  if (game.character.hp >= game.character.maxHp * 0.6) {
    game.character.hp = Math.floor(game.character.maxHp * 0.4)
    console.log('  (Resetting HP to 40%)')
  }
}

// Test with 0 mana
console.log('\n=== Testing with 0 mana ===')
game.character.mp = 0
game.character.hp = Math.floor(game.character.maxHp * 0.3) // 30% HP
console.log(`HP: ${game.character.hp}/${game.character.maxHp}, MP: ${game.character.mp}/${game.character.maxMp}`)

const availableWithNoMana = getAvailableSpells(game.character, game.turn)
console.log('Available spells with 0 mana:')
for (const entry of availableWithNoMana) {
  console.log(`  - ${entry.spell.name}: canCast=${entry.canCast}, reason=${entry.reason || 'OK'}`)
}

const healActionNoMana = getHealingSpellAction(game, personalityConfig)
console.log('Heal action with no mana:', healActionNoMana)

console.log('\n=== Test complete ===')
