/**
 * Spell System Test Script
 *
 * Tests spell casting mechanics, mana usage, and bot spell behavior.
 * Run with: npx tsx scripts/test-spells.ts
 */

import {
  createGame,
  processTurn,
  getSpellById,
  getSpellsForLevel,
  classCanCast,
  castSpell,
  canCast,
  getKnownSpells,
  getAvailableSpells,
  calculateSpellPower,
  runBotTick,
  createBotState,
  type BotPersonality,
} from '../src/game'

// ============================================================================
// TEST UTILITIES
// ============================================================================

function log(message: string): void {
  console.log(message)
}

function logSection(title: string): void {
  console.log('\n' + '='.repeat(60))
  console.log(title)
  console.log('='.repeat(60))
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    process.exit(1)
  }
  console.log(`PASS: ${message}`)
}

// ============================================================================
// SPELL DATA TESTS
// ============================================================================

function testSpellData(): void {
  logSection('Spell Data Tests')

  // Test spell retrieval
  const magicMissile = getSpellById('magic_missile')
  assert(magicMissile !== undefined, 'Magic Missile exists')
  assert(magicMissile?.school === 'arcane', 'Magic Missile is arcane')
  assert(magicMissile?.manaCost === 2, 'Magic Missile costs 2 mana')

  const minorHeal = getSpellById('minor_heal')
  assert(minorHeal !== undefined, 'Minor Heal exists')
  assert(minorHeal?.school === 'divine', 'Minor Heal is divine')
  assert(minorHeal?.effectType === 'heal', 'Minor Heal is a heal spell')

  // Test class spell lists
  assert(classCanCast('mage'), 'Mage can cast spells')
  assert(classCanCast('priest'), 'Priest can cast spells')
  assert(!classCanCast('warrior'), 'Warrior cannot cast spells')
  assert(!classCanCast('berserker'), 'Berserker cannot cast spells')

  // Test spells for level
  const mageSpellsL1 = getSpellsForLevel('mage', 1)
  assert(mageSpellsL1.length > 0, 'Mage has spells at level 1')
  assert(
    mageSpellsL1.some((s) => s.id === 'magic_missile'),
    'Mage knows Magic Missile at level 1'
  )

  const mageSpellsL15 = getSpellsForLevel('mage', 15)
  assert(
    mageSpellsL15.some((s) => s.id === 'lightning_bolt'),
    'Mage knows Lightning Bolt at level 15'
  )

  const priestSpellsL1 = getSpellsForLevel('priest', 1)
  assert(
    priestSpellsL1.some((s) => s.id === 'minor_heal'),
    'Priest knows Minor Heal at level 1'
  )

  log(`Mage spells at level 1: ${mageSpellsL1.map((s) => s.name).join(', ')}`)
  log(`Mage spells at level 15: ${mageSpellsL15.map((s) => s.name).join(', ')}`)
}

// ============================================================================
// SPELL CASTING TESTS
// ============================================================================

function testSpellCasting(): void {
  logSection('Spell Casting Tests')

  // Create a mage game
  const game = createGame({
    raceId: 'human',
    classId: 'mage',
    seed: 12345,
  })

  const char = game.character

  log(`Created ${char.name} (Level ${char.level})`)
  log(`HP: ${char.hp}/${char.maxHp}, MP: ${char.mp}/${char.maxMp}`)
  log(`Known spells: ${char.knownSpells.join(', ')}`)

  // Test known spells
  assert(char.knownSpells.length > 0, 'Mage starts with spells')
  assert(char.knownSpells.includes('magic_missile'), 'Mage knows Magic Missile')

  // Test available spells
  const available = getAvailableSpells(char, game.turn)
  assert(available.length > 0, 'Mage has available spells')
  log(`Available spells: ${available.map((a) => a.spell.name).join(', ')}`)

  // Test canCast
  const mm = getSpellById('magic_missile')!
  const castCheck = canCast(char, mm, game.turn)
  assert(castCheck.canCast, 'Can cast Magic Missile')

  // Test spell power calculation
  const power = calculateSpellPower(char, mm, false)
  log(`Magic Missile power: ${power}`)
  assert(power > 0, 'Spell has positive power')

  // Test actually casting a spell (need a target)
  const initialMp = char.mp
  const result = castSpell(game, 'magic_missile')
  log(`Cast result: ${result.message}`)
  assert(result.success, 'Spell cast succeeded')
  assert(char.mp < initialMp, 'Mana was consumed')

  log(`MP after cast: ${char.mp}/${char.maxMp}`)
}

// ============================================================================
// BOT SPELL USAGE TESTS
// ============================================================================

function testBotSpellUsage(): void {
  logSection('Bot Spell Usage Tests')

  const classes = ['mage', 'priest', 'necromancer', 'druid']

  for (const classId of classes) {
    log(`\nTesting ${classId}...`)

    const game = createGame({
      raceId: 'human',
      classId,
      seed: 54321,
    })

    const botState = createBotState()
    const personality: BotPersonality = 'cautious'

    // Run several bot ticks and track spell usage
    let spellsCast = 0
    let totalTurns = 0
    const maxTurns = 100

    for (let i = 0; i < maxTurns && game.isRunning; i++) {
      const action = runBotTick(game, personality, undefined, botState)

      if (action.type === 'cast') {
        spellsCast++
        log(`  Turn ${game.turn}: Cast ${action.spellId}`)
      }

      processTurn(game, action)
      totalTurns++

      // Stop if character dies
      if (game.character.isDead) break
    }

    log(`  ${classId}: ${spellsCast} spells cast in ${totalTurns} turns`)
    log(`  Final state: Level ${game.character.level}, Depth ${game.character.depth}`)
    log(`  HP: ${game.character.hp}/${game.character.maxHp}, MP: ${game.character.mp}/${game.character.maxMp}`)
  }
}

// ============================================================================
// MANA REGENERATION TESTS
// ============================================================================

function testManaRegeneration(): void {
  logSection('Mana Regeneration Tests')

  const game = createGame({
    raceId: 'human',
    classId: 'mage',
    seed: 11111,
  })

  // Deplete some mana
  game.character.mp = Math.floor(game.character.maxMp / 2)
  const startMp = game.character.mp

  log(`Starting MP: ${startMp}/${game.character.maxMp}`)
  log(`WIS: ${game.character.stats.wis}`)

  // Wait several turns (should regen mana)
  for (let i = 0; i < 10; i++) {
    processTurn(game, { type: 'wait' })
  }

  log(`MP after 10 wait turns: ${game.character.mp}/${game.character.maxMp}`)
  assert(game.character.mp > startMp, 'Mana regenerated while waiting')

  // Expected regen: 1 + WIS/10 per turn
  const expectedRegen = 10 * (1 + Math.floor(game.character.stats.wis / 10))
  const actualRegen = game.character.mp - startMp
  log(`Expected regen (approx): ${expectedRegen}, Actual: ${actualRegen}`)
}

// ============================================================================
// NON-CASTER TESTS
// ============================================================================

function testNonCasters(): void {
  logSection('Non-Caster Class Tests')

  const warrior = createGame({
    raceId: 'human',
    classId: 'warrior',
    seed: 99999,
  })

  log(`Warrior known spells: ${warrior.character.knownSpells.length}`)
  assert(warrior.character.knownSpells.length === 0, 'Warrior has no spells')

  const available = getAvailableSpells(warrior.character, warrior.turn)
  assert(available.length === 0, 'Warrior has no available spells')

  // Bot should never try to cast
  const botState = createBotState()
  const action = runBotTick(warrior, 'aggressive', undefined, botState)
  assert(action.type !== 'cast', 'Warrior bot does not cast spells')
  log(`Warrior bot action: ${action.type}`)
}

// ============================================================================
// COOLDOWN TESTS
// ============================================================================

function testCooldowns(): void {
  logSection('Spell Cooldown Tests')

  const game = createGame({
    raceId: 'human',
    classId: 'mage',
    seed: 77777,
  })

  // Phase Door has a cooldown
  game.character.level = 10 // Ensure we know Phase Door
  game.character.knownSpells = getKnownSpells(game.character)

  // Recalculate max MP for level 10 mage
  const int = game.character.stats.int
  const wis = game.character.stats.wis
  game.character.maxMp = Math.floor(((int + wis) * game.character.level) / 4)
  game.character.mp = game.character.maxMp

  log(`Known spells at level 10: ${game.character.knownSpells.join(', ')}`)

  if (game.character.knownSpells.includes('phase_door')) {
    const phaseDoor = getSpellById('phase_door')!
    log(`Phase Door cooldown: ${phaseDoor.cooldown} turns`)

    // Cast Phase Door
    const result1 = castSpell(game, 'phase_door')
    log(`First cast: ${result1.message}`)
    assert(result1.success, 'First Phase Door cast succeeded')

    // Try to cast again immediately (should fail due to cooldown)
    game.character.mp = game.character.maxMp // Restore mana to isolate cooldown test
    const result2 = castSpell(game, 'phase_door')
    log(`Second cast (should fail): ${result2.message}`)
    assert(!result2.success, 'Second Phase Door cast failed (cooldown)')

    // Advance turns to clear cooldown
    for (let i = 0; i < phaseDoor.cooldown; i++) {
      game.turn++
    }

    // Restore mana and try again - should work now
    game.character.mp = game.character.maxMp
    const result3 = castSpell(game, 'phase_door')
    log(`Third cast (after cooldown): ${result3.message}`)
    assert(result3.success, 'Phase Door castable after cooldown')
  } else {
    log('Skipping cooldown test - Phase Door not learned')
  }
}

// ============================================================================
// MAIN
// ============================================================================

function main(): void {
  console.log('Borglike Spell System Tests')
  console.log('==========================')

  testSpellData()
  testSpellCasting()
  testManaRegeneration()
  testNonCasters()
  testCooldowns()
  testBotSpellUsage()

  logSection('All Tests Passed!')
}

main()
