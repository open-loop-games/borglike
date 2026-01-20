/**
 * Trace exactly what happens when a priest casts heal
 */

import { createGame, processTurn, handleCast } from '../src/game/game-loop'
import { castSpell, canCast, getAvailableSpells } from '../src/game/spell-resolution'
import { getSpellById } from '../src/game/data/spells'
import type { RunConfig } from '../src/game/types'

const config: RunConfig = {
  raceId: 'human',
  classId: 'priest',
  seed: 12345,
}

const game = createGame(config)
const char = game.character

console.log('=== Initial State ===')
console.log(`HP: ${char.hp}/${char.maxHp}`)
console.log(`MP: ${char.mp}/${char.maxMp}`)
console.log(`Known spells: ${char.knownSpells}`)

// Damage the priest
char.hp = 10
console.log(`\n=== After damage ===`)
console.log(`HP: ${char.hp}/${char.maxHp}`)

// Check if spell is available
const spell = getSpellById('minor_heal')!
console.log(`\n=== Spell check ===`)
console.log(`Spell: ${spell.name}, manaCost: ${spell.manaCost}`)

const canCastResult = canCast(char, spell, game.turn)
console.log(`canCast: ${canCastResult.canCast}, reason: ${canCastResult.reason || 'OK'}`)

const available = getAvailableSpells(char, game.turn)
console.log(`Available spells:`, available.map(a => `${a.spell.id}:${a.canCast}`))

// Try casting directly
console.log(`\n=== Direct castSpell ===`)
const beforeHp = char.hp
const beforeMp = char.mp
const result = castSpell(game, 'minor_heal')
console.log(`Result: success=${result.success}, message=${result.message}, healed=${result.healed}`)
console.log(`HP: ${beforeHp} -> ${char.hp}`)
console.log(`MP: ${beforeMp} -> ${char.mp}`)

// Reset and try via processTurn
char.hp = 10
char.mp = 5
console.log(`\n=== Via processTurn ===`)
console.log(`Before: HP=${char.hp}, MP=${char.mp}`)
const events = processTurn(game, { type: 'cast', spellId: 'minor_heal' })
console.log(`After: HP=${char.hp}, MP=${char.mp}`)
console.log(`Events:`, events)
console.log(`Messages:`, game.messages.slice(-3))
