/**
 * Test script for bot item evaluation and equipment logic
 * Run with: npx tsx scripts/test-items.ts
 */

import { WEAPONS, ARMOR, POTIONS } from '../src/game/data/items'
import type { Item, Character, GroundItem, Stats, CombatStats, Equipment } from '../src/game/types'
import {
  evaluateItem,
  shouldPickup,
  shouldEquip,
  compareEquipment,
  calculateEquipmentScore,
  BASE_CONFIGS,
} from '../src/game/bot'

// Create a mock character for testing
function createMockCharacter(equipment: Partial<Equipment> = {}): Character {
  const baseStats: Stats = { str: 10, int: 10, wis: 10, dex: 10, con: 10 }
  const combatStats: CombatStats = {
    maxHp: 50,
    maxMp: 20,
    armor: 5,
    accuracy: 10,
    evasion: 5,
    meleeDamage: 5,
    speed: 100,
  }

  return {
    id: 'test-char',
    name: 'Test Hero',
    raceId: 'human',
    classId: 'warrior',
    baseStats,
    stats: baseStats,
    hp: 50,
    maxHp: 50,
    mp: 20,
    maxMp: 20,
    level: 5,
    xp: 1000,
    xpToNextLevel: 2000,
    combat: combatStats,
    resistances: {},
    statusEffects: [],
    tempResistances: [],
    poison: null,
    equipment: equipment as Equipment,
    inventory: [],
    gold: 100,
    position: { x: 10, y: 10 },
    depth: 5,
    isDead: false,
  }
}

// Create a mock item
function createMockItem(template: typeof WEAPONS[0], enchantment = 0): Item {
  return {
    id: `item-${Math.random().toString(36).slice(2)}`,
    template,
    enchantment,
    identified: true,
    artifact: null,
  }
}

// Create a mock ground item
function createMockGroundItem(template: typeof WEAPONS[0], enchantment = 0): GroundItem {
  return {
    ...createMockItem(template, enchantment),
    position: { x: 12, y: 12 },
  }
}

console.log('='.repeat(60))
console.log('BOT ITEM EVALUATION TEST')
console.log('='.repeat(60))

// Test 1: Equipment score calculation
console.log('\n--- Test 1: Equipment Score Calculation ---')
const dagger = createMockItem(WEAPONS[0]!) // Dagger: 1d4
const longSword = createMockItem(WEAPONS[4]!) // Long Sword: 2d5
const longSwordPlus2 = createMockItem(WEAPONS[4]!, 2) // Long Sword +2

console.log(`Dagger (1d4) score: ${calculateEquipmentScore(dagger)}`)
console.log(`Long Sword (2d5) score: ${calculateEquipmentScore(longSword)}`)
console.log(`Long Sword +2 (2d5) score: ${calculateEquipmentScore(longSwordPlus2)}`)

// Test 2: Equipment comparison
console.log('\n--- Test 2: Equipment Comparison ---')
const comparison1 = compareEquipment(longSword, dagger)
console.log(`Long Sword vs Dagger: shouldEquip=${comparison1.shouldEquip}, diff=${comparison1.scoreDiff.toFixed(1)}, reason="${comparison1.reason}"`)

const comparison2 = compareEquipment(dagger, longSword)
console.log(`Dagger vs Long Sword: shouldEquip=${comparison2.shouldEquip}, diff=${comparison2.scoreDiff.toFixed(1)}, reason="${comparison2.reason}"`)

const comparison3 = compareEquipment(longSword, null)
console.log(`Long Sword vs empty: shouldEquip=${comparison3.shouldEquip}, diff=${comparison3.scoreDiff.toFixed(1)}, reason="${comparison3.reason}"`)

// Test 3: Item evaluation
console.log('\n--- Test 3: Item Evaluation ---')
const character = createMockCharacter()
const eval1 = evaluateItem(dagger, character)
console.log(`Dagger eval: score=${eval1.score}, useful=${eval1.isUseful}, upgrade=${eval1.isUpgrade}, reason="${eval1.reason}"`)

const eval2 = evaluateItem(longSword, character)
console.log(`Long Sword eval: score=${eval2.score}, useful=${eval2.isUseful}, upgrade=${eval2.isUpgrade}, reason="${eval2.reason}"`)

// With weapon equipped
const charWithWeapon = createMockCharacter({ weapon: dagger })
const eval3 = evaluateItem(longSword, charWithWeapon)
console.log(`Long Sword (with Dagger equipped): score=${eval3.score}, upgrade=${eval3.isUpgrade}, reason="${eval3.reason}"`)

// Test 4: Potion evaluation
console.log('\n--- Test 4: Potion Evaluation ---')
const healingPotion = createMockItem(POTIONS[0]!) // Cure Light Wounds
const fullHpChar = createMockCharacter()
const lowHpChar = createMockCharacter()
lowHpChar.hp = 15 // 30% HP

const potionEvalFull = evaluateItem(healingPotion, fullHpChar)
console.log(`Healing potion (full HP): score=${potionEvalFull.score}, reason="${potionEvalFull.reason}"`)

const potionEvalLow = evaluateItem(healingPotion, lowHpChar)
console.log(`Healing potion (low HP): score=${potionEvalLow.score}, reason="${potionEvalLow.reason}"`)

// Test 5: Should pickup decisions
console.log('\n--- Test 5: Pickup Decisions ---')
const groundSword = createMockGroundItem(WEAPONS[4]!) // Long Sword
const groundDagger = createMockGroundItem(WEAPONS[0]!) // Dagger

const cautiousConfig = BASE_CONFIGS.cautious
const greedyConfig = BASE_CONFIGS.greedy

console.log(`Cautious - Long Sword (no weapon): ${shouldPickup(groundSword, character, cautiousConfig)}`)
console.log(`Cautious - Dagger (no weapon): ${shouldPickup(groundDagger, character, cautiousConfig)}`)

console.log(`Greedy - Long Sword (no weapon): ${shouldPickup(groundSword, character, greedyConfig)}`)
console.log(`Greedy - Dagger (has Long Sword): ${shouldPickup(groundDagger, { ...character, equipment: { weapon: longSword } as Equipment }, greedyConfig)}`)

// Test 6: Should equip decisions
console.log('\n--- Test 6: Should Equip Decisions ---')
const charWithDagger = createMockCharacter({ weapon: dagger })
charWithDagger.inventory = [longSword]

console.log(`Should equip Long Sword over Dagger: ${shouldEquip(longSword, charWithDagger)}`)
console.log(`Should equip Dagger over Long Sword: ${shouldEquip(dagger, { ...charWithDagger, equipment: { weapon: longSword } as Equipment })}`)

// Test 7: Armor evaluation
console.log('\n--- Test 7: Armor Evaluation ---')
const robe = createMockItem(ARMOR[0]!) // Robe: protection 2
const chainMail = createMockItem(ARMOR[5]!) // Chain Mail: protection 32

const robeEval = evaluateItem(robe, character)
const chainMailEval = evaluateItem(chainMail, character)

console.log(`Robe (prot 2): score=${robeEval.score}, slot=${robeEval.slot}`)
console.log(`Chain Mail (prot 32): score=${chainMailEval.score}, slot=${chainMailEval.slot}`)

const armorComparison = compareEquipment(chainMail, robe)
console.log(`Chain Mail vs Robe: shouldEquip=${armorComparison.shouldEquip}, diff=${armorComparison.scoreDiff.toFixed(1)}`)

console.log('\n' + '='.repeat(60))
console.log('ALL TESTS COMPLETE')
console.log('='.repeat(60))
