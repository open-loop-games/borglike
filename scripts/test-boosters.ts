/**
 * Test script for the Booster System
 *
 * Verifies:
 * - computeBoosterBonuses returns correct values
 * - Stat boosters affect character stats
 * - Equipment boosters affect starting gear enchantment
 * - Multipliers stack correctly with upgrades
 * - Second Wind effect triggers correctly
 */

import {
  boosters,
  getBoosterById,
  canUnlockBooster,
  computeBoosterBonuses,
  DEFAULT_BOOSTER_BONUSES,
  createCharacter,
  createStartingEquipment,
  computeUpgradeBonuses,
  mergeWithBoosterBonuses,
  createGame,
} from '../src/game'

// Helper to format test output
function test(name: string, fn: () => boolean): void {
  const result = fn()
  console.log(result ? '✓' : '✗', name)
  if (!result) {
    process.exitCode = 1
  }
}

console.log('=== Booster System Tests ===\n')

// ============================================================================
// Test 1: Booster definitions are valid
// ============================================================================
console.log('--- Booster Definitions ---')

test('All boosters have required fields', () => {
  return boosters.every(
    (b) =>
      b.id &&
      b.name &&
      b.description &&
      b.category &&
      b.icon &&
      b.unlockCost > 0 &&
      b.effect
  )
})

test('Booster count is 26 (6 equipment + 15 stats + 5 special)', () => {
  return boosters.length === 26
})

test('getBoosterById finds boosters', () => {
  const booster = getBoosterById('str_minor')
  return booster?.name === 'Minor Strength' && booster?.unlockCost === 200
})

// ============================================================================
// Test 2: Prerequisites work correctly
// ============================================================================
console.log('\n--- Booster Prerequisites ---')

test('canUnlockBooster allows first tier without prereqs', () => {
  const unlocked = new Set<string>()
  return canUnlockBooster('str_minor', unlocked) === true
})

test('canUnlockBooster blocks second tier without first', () => {
  const unlocked = new Set<string>()
  return canUnlockBooster('str_greater', unlocked) === false
})

test('canUnlockBooster allows second tier with first', () => {
  const unlocked = new Set<string>(['str_minor'])
  return canUnlockBooster('str_greater', unlocked) === true
})

test('canUnlockBooster blocks already unlocked', () => {
  const unlocked = new Set<string>(['str_minor'])
  return canUnlockBooster('str_minor', unlocked) === false
})

// ============================================================================
// Test 3: computeBoosterBonuses works correctly
// ============================================================================
console.log('\n--- Booster Bonus Computation ---')

test('Default bonuses are neutral', () => {
  const bonuses = DEFAULT_BOOSTER_BONUSES
  return (
    bonuses.strBonus === 0 &&
    bonuses.xpMultiplier === 1 &&
    bonuses.goldMultiplier === 1 &&
    bonuses.startsWithPotion === false
  )
})

test('Stat booster adds correct bonus', () => {
  const bonuses = computeBoosterBonuses(['str_superior'])
  return bonuses.strBonus === 3 && bonuses.dexBonus === 0
})

test('Multiple stat boosters stack', () => {
  const bonuses = computeBoosterBonuses(['str_minor', 'dex_minor'])
  return bonuses.strBonus === 1 && bonuses.dexBonus === 1
})

test('Equipment booster sets correct bonus', () => {
  const bonuses = computeBoosterBonuses(['weapon_plus_2'])
  return bonuses.startingWeaponBonus === 2 && bonuses.startingArmorBonus === 0
})

test('Gear booster sets both weapon and armor', () => {
  const bonuses = computeBoosterBonuses(['gear_plus_1'])
  return bonuses.startingWeaponBonus === 1 && bonuses.startingArmorBonus === 1
})

test('Equipment boosters take max value', () => {
  const bonuses = computeBoosterBonuses(['weapon_plus_1', 'gear_plus_2'])
  return bonuses.startingWeaponBonus === 2 && bonuses.startingArmorBonus === 2
})

test('Multiplier booster works', () => {
  const bonuses = computeBoosterBonuses(['quick_study'])
  return bonuses.xpMultiplier === 1.15
})

test('Lucky Start booster sets flag', () => {
  const bonuses = computeBoosterBonuses(['lucky_start'])
  return bonuses.startsWithPotion === true
})

test('Second Wind booster sets flags', () => {
  const bonuses = computeBoosterBonuses(['second_wind'])
  return bonuses.hasSecondWind === true && bonuses.secondWindPercent === 20
})

// ============================================================================
// Test 4: Character creation applies stat bonuses
// ============================================================================
console.log('\n--- Character Stat Bonuses ---')

test('Character without boosters has base stats', () => {
  const char = createCharacter({ raceId: 'human', classId: 'warrior' })
  // Human Warrior: base 10, human mods: str+1, con+1, class mods: str+2, con+1
  // Expected: STR = 10+1+2 = 13, CON = 10+1+1 = 12
  return char.baseStats.str === 13 && char.baseStats.con === 12
})

test('Character with STR booster has higher STR', () => {
  const boosterBonuses = computeBoosterBonuses(['str_superior'])
  const char = createCharacter({
    raceId: 'human',
    classId: 'warrior',
    boosterBonuses,
  })
  // Human Warrior STR 13 + 3 from booster = 16
  return char.baseStats.str === 16
})

test('Character with multiple stat boosters', () => {
  const boosterBonuses = computeBoosterBonuses(['str_minor', 'con_greater'])
  const char = createCharacter({
    raceId: 'human',
    classId: 'warrior',
    boosterBonuses,
  })
  // STR: 13 + 1 = 14, CON: 12 + 2 = 14
  return char.baseStats.str === 14 && char.baseStats.con === 14
})

// ============================================================================
// Test 5: Equipment creation applies enchantment bonuses
// ============================================================================
console.log('\n--- Equipment Enchantment Bonuses ---')

test('Starting equipment without boosters has no enchantment', () => {
  const items = createStartingEquipment('Warrior')
  const weapon = items.find((i) => i.template.type === 'weapon')
  const armor = items.find((i) => i.template.type === 'armor')
  return weapon?.enchantment === 0 && armor?.enchantment === 0
})

test('Starting equipment with weapon booster has enchanted weapon', () => {
  const boosterBonuses = computeBoosterBonuses(['weapon_plus_2'])
  const items = createStartingEquipment('Warrior', boosterBonuses)
  const weapon = items.find((i) => i.template.type === 'weapon')
  const armor = items.find((i) => i.template.type === 'armor')
  return weapon?.enchantment === 2 && armor?.enchantment === 0
})

test('Starting equipment with gear booster has both enchanted', () => {
  const boosterBonuses = computeBoosterBonuses(['gear_plus_1'])
  const items = createStartingEquipment('Warrior', boosterBonuses)
  const weapon = items.find((i) => i.template.type === 'weapon')
  const armor = items.find((i) => i.template.type === 'armor')
  return weapon?.enchantment === 1 && armor?.enchantment === 1
})

// ============================================================================
// Test 6: Multiplier stacking with upgrades
// ============================================================================
console.log('\n--- Multiplier Stacking ---')

test('mergeWithBoosterBonuses combines multipliers multiplicatively', () => {
  // Upgrade gives 1.1x XP multiplier
  const upgradeState = { fast_learner: 2 }
  const upgradeBonuses = computeUpgradeBonuses(upgradeState)
  // Booster gives 1.15x XP multiplier
  const boosterBonuses = computeBoosterBonuses(['quick_study'])

  const combined = mergeWithBoosterBonuses(upgradeBonuses, boosterBonuses)
  // Expected: 1.1 * 1.15 = 1.265
  return Math.abs(combined.xpMultiplier - 1.1 * 1.15) < 0.001
})

// ============================================================================
// Test 7: Game creation with boosters
// ============================================================================
console.log('\n--- Game Creation with Boosters ---')

test('Game with Lucky Start has extra potion', () => {
  const boosterBonuses = computeBoosterBonuses(['lucky_start'])
  const game = createGame({
    raceId: 'human',
    classId: 'warrior',
    boosterBonuses,
  })
  // Count potions in inventory (starting equipment gives 3 healing potions)
  const potions = game.character.inventory.filter(
    (i) => i.template.type === 'potion'
  )
  // Should have 3 + 1 = 4 potions
  return potions.length === 4
})

test('Game with Second Wind has usedSecondWind flag set to false', () => {
  const boosterBonuses = computeBoosterBonuses(['second_wind'])
  const game = createGame({
    raceId: 'human',
    classId: 'warrior',
    boosterBonuses,
  })
  return game.usedSecondWind === false && game.boosterBonuses?.hasSecondWind === true
})

// ============================================================================
// Summary
// ============================================================================
console.log('\n=== Tests Complete ===')
