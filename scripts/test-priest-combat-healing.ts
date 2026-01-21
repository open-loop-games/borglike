/**
 * Test script to diagnose Priest healing in COMBAT situations
 * This tests whether the priest heals when adjacent to a monster
 */

import { createGame, processTurn } from '../src/game/game-loop'
import { runBotTick, createBotState } from '../src/game/bot'
import type { RunConfig, Monster } from '../src/game/types'
import { getMonsterByName } from '../src/game/data/monsters'

// Create a Priest run
const config: RunConfig = {
  raceId: 'human',
  classId: 'priest',
  seed: Date.now(),
}

const game = createGame(config)
const botState = createBotState()
const personality = 'cautious'

console.log('=== Priest Combat Healing Test ===\n')

// Find the character's position
const charPos = game.character.position
console.log('Character position:', charPos)

// Spawn a monster right next to the priest
const ratTemplate = getMonsterByName('Giant white rat')!
const adjacentMonster: Monster = {
  id: 'test_rat',
  template: ratTemplate,
  hp: ratTemplate.hp,
  maxHp: ratTemplate.hp,
  position: { x: charPos.x + 1, y: charPos.y },
  isAwake: true,
  seen: true,
  energy: 100,
  debuffs: [],
}
game.monsters.push(adjacentMonster)
console.log('Spawned rat at:', adjacentMonster.position)

// Reduce priest HP to critical level
game.character.hp = Math.floor(game.character.maxHp * 0.25) // 25% HP (very low)
console.log(`\nPriest HP: ${game.character.hp}/${game.character.maxHp} (${Math.floor(game.character.hp / game.character.maxHp * 100)}%)`)
console.log(`Priest MP: ${game.character.mp}/${game.character.maxMp}`)

console.log('\n=== Running bot ticks (should heal when critically low!) ===\n')

for (let i = 0; i < 10; i++) {
  // Check if monster is still adjacent
  const dx = Math.abs(adjacentMonster.position.x - game.character.position.x)
  const dy = Math.abs(adjacentMonster.position.y - game.character.position.y)
  const isAdjacent = dx <= 1 && dy <= 1

  const hpPercent = Math.floor(game.character.hp / game.character.maxHp * 100)

  // Get bot action
  const action = runBotTick(game, personality, botState)

  console.log(`Turn ${i}: HP=${game.character.hp}/${game.character.maxHp} (${hpPercent}%), MP=${game.character.mp}/${game.character.maxMp}`)
  console.log(`  Adjacent monster: ${isAdjacent}`)
  console.log(`  Action: ${action.type}${action.type === 'cast' ? ` (${(action as any).spellId})` : ''}${action.type === 'attack' ? ' (ATTACKING!)' : ''}`)

  if (action.type === 'cast' && (action as any).spellId === 'minor_heal') {
    console.log('  >>> HEALED IN COMBAT!')
  } else if (action.type === 'attack' && hpPercent < 30) {
    console.log('  >>> BUG: Attacking instead of healing at critical HP!')
  }

  // Process turn
  processTurn(game, action)

  // Keep HP low to simulate ongoing combat
  if (game.character.hp > game.character.maxHp * 0.30) {
    game.character.hp = Math.floor(game.character.maxHp * 0.25)
    console.log('  (Reset HP to 25%)')
  }

  // Revive monster if dead
  if (adjacentMonster.hp <= 0) {
    adjacentMonster.hp = ratTemplate.hp
    game.monsters.push(adjacentMonster)
    console.log('  (Revived monster)')
  }

  console.log('')
}

console.log('=== Analysis ===')
console.log('If the priest is always attacking instead of healing when at <30% HP,')
console.log('then the bug is that attack priority is higher than heal priority in combat.')
