/**
 * Quick test to verify upgrade effects are applied correctly
 */

import { createCharacter } from '../src/game/character'
import { computeUpgradeBonuses, DEFAULT_BONUSES } from '../src/game/upgrade-effects'

console.log('============================================================')
console.log('Upgrade Effects Test')
console.log('============================================================\n')

// Test 1: Character without upgrades
console.log('Test 1: Character with no upgrades')
console.log('----------------------------------------')
const charNoUpgrades = createCharacter({
  raceId: 'human',
  classId: 'warrior',
})
console.log(`Max HP: ${charNoUpgrades.maxHp}`)
console.log(`Armor: ${charNoUpgrades.combat.armor}`)
console.log(`Melee Damage: ${charNoUpgrades.combat.meleeDamage}`)
console.log(`Evasion: ${charNoUpgrades.combat.evasion}`)

// Test 2: Compute bonuses from upgrades
console.log('\nTest 2: Compute upgrade bonuses')
console.log('----------------------------------------')
const testLevels = {
  vitality: 3,      // +5 HP per level = +15 HP
  might: 2,         // +2% damage per level = +4%
  resilience: 2,    // +1 armor per level = +2
  swiftness: 1,     // +5% dodge per level = +5%
  fast_learner: 5,  // +5% XP per level = +25%
  gold_digger: 3,   // +15% gold per level = +45%
}
const bonuses = computeUpgradeBonuses(testLevels)
console.log('Bonuses from upgrades:')
console.log(`  maxHpBonus: ${bonuses.maxHpBonus}`)
console.log(`  damagePercent: ${bonuses.damagePercent}`)
console.log(`  armorBonus: ${bonuses.armorBonus}`)
console.log(`  dodgePercent: ${bonuses.dodgePercent}`)
console.log(`  xpMultiplier: ${bonuses.xpMultiplier}`)
console.log(`  goldMultiplier: ${bonuses.goldMultiplier}`)

// Test 3: Character with upgrades applied
console.log('\nTest 3: Character with upgrades applied')
console.log('----------------------------------------')
const charWithUpgrades = createCharacter({
  raceId: 'human',
  classId: 'warrior',
  upgradeBonuses: bonuses,
})
console.log(`Max HP: ${charWithUpgrades.maxHp} (was ${charNoUpgrades.maxHp}, +${charWithUpgrades.maxHp - charNoUpgrades.maxHp})`)
console.log(`Armor: ${charWithUpgrades.combat.armor} (was ${charNoUpgrades.combat.armor}, +${charWithUpgrades.combat.armor - charNoUpgrades.combat.armor})`)
console.log(`Melee Damage: ${charWithUpgrades.combat.meleeDamage} (was ${charNoUpgrades.combat.meleeDamage})`)
console.log(`Evasion: ${charWithUpgrades.combat.evasion} (was ${charNoUpgrades.combat.evasion}, +${charWithUpgrades.combat.evasion - charNoUpgrades.combat.evasion})`)

// Test 4: XP and Gold multipliers
console.log('\nTest 4: XP and Gold multipliers')
console.log('----------------------------------------')
import { applyXPBonus } from '../src/game/upgrade-effects'
const baseXP = 100
const xpWithBonus = applyXPBonus(baseXP, bonuses)
console.log(`Base XP: ${baseXP}`)
console.log(`XP with 25% bonus: ${xpWithBonus} (expected: ${Math.floor(baseXP * 1.25)})`)

// Test 5: Essence formulas
console.log('\nTest 5: Essence formulas')
console.log('----------------------------------------')
import { essenceFromDeath, essenceFromVictory, prestigeMultiplier } from '../src/core/formulas'

const deathEssence = essenceFromDeath(10, 50, 1000)  // Depth 10, 50 kills, 1000 gold
console.log(`Essence from death at depth 10 (50 kills, 1000 gold): ${deathEssence}`)

const victoryEssence = essenceFromVictory(50, 200, 0)  // Depth 50, 200 kills
console.log(`Essence from victory (200 kills): ${victoryEssence}`)

console.log('\nPrestige multipliers:')
for (let level = 0; level <= 5; level++) {
  console.log(`  Prestige ${level}: ${prestigeMultiplier(level)}x`)
}

console.log('\n============================================================')
console.log('All upgrade tests completed!')
console.log('============================================================')
