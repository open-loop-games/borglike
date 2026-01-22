/**
 * Character System for Borglike
 *
 * Handles character creation, stat calculations, leveling, and equipment management.
 * All functions are pure where possible and properly typed.
 */

import type { Character, Stats, CombatStats, Item, EquipSlot, Resistances } from './types'
import { getRaceById, getClassById, calculateHitdie } from './data/index'
import { xpForLevel } from '../core/formulas'
import type { UpgradeBonuses } from './upgrade-effects'
import { DEFAULT_BONUSES } from './upgrade-effects'
import type { BoosterBonuses } from './booster-effects'
import { DEFAULT_BOOSTER_BONUSES } from './booster-effects'
import { getSpellIdsForLevel, getNewSpellsAtLevel } from './data/class-spells'
import { addStatusEffect, hasStatusEffect } from './status-effects'
import { getFormById } from './data/forms'

// ============================================================================
// CONSTANTS
// ============================================================================

/** Base stat value before race/class modifiers */
const BASE_STAT = 10

/** Equipment slots that can provide armor/protection bonuses */
const ARMOR_SLOTS: EquipSlot[] = ['armor', 'shield', 'helm', 'gloves', 'boots']

/** Map ItemTemplate slot names to EquipSlot names */
const SLOT_MAP: Record<string, EquipSlot> = {
  weapon: 'weapon',
  bow: 'bow',
  body: 'armor',
  shield: 'shield',
  helm: 'helm',
  gloves: 'gloves',
  boots: 'boots',
  ring: 'ring1', // Default to ring1, handle ring2 in equip logic
  amulet: 'amulet',
  light: 'light',
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate a unique ID for entities
 */
function generateId(): string {
  return `chr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Calculate CON modifier for HP calculations
 * Formula: (CON - 10) / 2, minimum -2
 */
function getConModifier(con: number): number {
  return Math.max(-2, Math.floor((con - 10) / 2))
}

/**
 * Parse dice notation (e.g., "2d5") and return average damage
 * @param dice - Dice notation string like "2d5" or "1d6"
 * @returns Average damage value (rounded down)
 */
function parseDiceAverage(dice: string | undefined): number {
  if (!dice) return 0
  const match = dice.match(/(\d+)d(\d+)/)
  if (!match || !match[1] || !match[2]) return 0
  const numDice = parseInt(match[1], 10)
  const sides = parseInt(match[2], 10)
  // Average roll = numDice * (sides + 1) / 2
  return Math.floor((numDice * (sides + 1)) / 2)
}

/**
 * Get stat bonus from artifact bonuses Record
 * Artifacts use uppercase keys like 'STR', 'DEX', etc.
 */
function getArtifactStatBonus(
  bonuses: Record<string, number> | undefined,
  stat: 'str' | 'int' | 'wis' | 'dex' | 'con'
): number {
  if (!bonuses) return 0
  return bonuses[stat.toUpperCase()] || 0
}

/**
 * Map an ItemTemplate slot to an EquipSlot
 */
function mapSlot(templateSlot: string | undefined): EquipSlot | null {
  if (!templateSlot) return null
  return SLOT_MAP[templateSlot] || null
}

// ============================================================================
// CHARACTER CREATION
// ============================================================================

/**
 * Create a new character with the given race and class
 *
 * @param config - Character configuration
 * @param config.raceId - ID of the race to use
 * @param config.classId - ID of the class to use
 * @param config.name - Optional character name (defaults to race-class combo)
 * @param config.upgradeBonuses - Optional meta-progression bonuses from upgrades
 * @returns A fully initialized Character
 * @throws Error if race or class ID is invalid
 *
 * @example
 * const char = createCharacter({ raceId: 'human', classId: 'warrior', name: 'Borin' })
 * // char.stats = { str: 13, int: 8, wis: 8, dex: 12, con: 12 }
 */
export function createCharacter(config: {
  raceId: string
  classId: string
  name?: string
  upgradeBonuses?: UpgradeBonuses
  boosterBonuses?: BoosterBonuses
}): Character {
  const race = getRaceById(config.raceId)
  const gameClass = getClassById(config.classId)
  const bonuses = config.upgradeBonuses ?? DEFAULT_BONUSES
  const boosterBonuses = config.boosterBonuses ?? DEFAULT_BOOSTER_BONUSES

  if (!race) {
    throw new Error(`Invalid race ID: ${config.raceId}`)
  }
  if (!gameClass) {
    throw new Error(`Invalid class ID: ${config.classId}`)
  }

  // Calculate base stats: BASE_STAT + race modifiers + class modifiers + booster bonuses
  const baseStats: Stats = {
    str: BASE_STAT + race.stats.str + gameClass.stats.str + boosterBonuses.strBonus,
    int: BASE_STAT + race.stats.int + gameClass.stats.int + boosterBonuses.intBonus,
    wis: BASE_STAT + race.stats.wis + gameClass.stats.wis + boosterBonuses.wisBonus,
    dex: BASE_STAT + race.stats.dex + gameClass.stats.dex + boosterBonuses.dexBonus,
    con: BASE_STAT + race.stats.con + gameClass.stats.con + boosterBonuses.conBonus,
  }

  // Stats start the same as baseStats (will differ with equipment)
  const stats = { ...baseStats }

  // Calculate hitdie (minimum 1)
  const hitdie = calculateHitdie(race.hitdie, gameClass.hitdie)

  // Calculate initial HP: hitdie * (1 + CON/20) for level 1
  const conBonus = 1 + stats.con / 20
  let maxHp = Math.floor(hitdie * conBonus)

  // Apply vitality upgrade bonus (flat HP)
  maxHp += bonuses.maxHpBonus

  // Calculate initial MP: (INT + WIS) / 4 if class uses magic, else 0
  const maxMp = gameClass.usesMagic ? Math.floor((stats.int + stats.wis) / 4) : 0

  // Initial combat stats
  let baseArmor = Math.floor(stats.dex / 4)
  baseArmor += bonuses.armorBonus // Apply resilience upgrade

  let baseEvasion = Math.floor(stats.dex / 2)
  // Apply swiftness upgrade (dodge percent adds to evasion)
  baseEvasion += bonuses.dodgePercent

  let baseMeleeDamage = Math.floor(stats.str / 3)
  // Apply might upgrade (damage percent)
  baseMeleeDamage = Math.floor(baseMeleeDamage * (1 + bonuses.damagePercent / 100))

  const combat: CombatStats = {
    maxHp,
    maxMp,
    armor: baseArmor,
    accuracy: 50 + stats.dex + 1, // level 1
    evasion: baseEvasion,
    meleeDamage: baseMeleeDamage,
    rangedDamage: Math.floor(stats.dex / 3), // DEX-based, no bow yet
    rangedAccuracy: 50 + stats.dex + 1, // level 1
    speed: 100,
  }

  // Calculate initial resistances from race
  const resistances = calculateResistancesFromRace(race)

  // Initialize empty status effects
  const statusEffects: Character['statusEffects'] = []
  const tempResistances: Character['tempResistances'] = []
  const poison: Character['poison'] = null

  const character: Character = {
    // Identity
    id: generateId(),
    name: config.name || `${race.name} ${gameClass.name}`,
    raceId: config.raceId,
    classId: config.classId,

    // Stats
    baseStats,
    stats,

    // Resources
    hp: maxHp,
    maxHp,
    mp: maxMp,
    maxMp,

    // Progression
    level: 1,
    xp: 0,
    xpToNextLevel: xpForLevel(2),

    // Combat
    combat,

    // Resistances
    resistances,

    // Status effects
    statusEffects,
    tempResistances,
    poison,

    // Inventory
    equipment: {},
    inventory: [],
    gold: 0,

    // Position (will be placed by dungeon)
    position: { x: 0, y: 0 },
    depth: 1,

    // State
    isDead: false,

    // Store upgrade bonuses for recalculation
    upgradeBonuses: bonuses,

    // Spells - initialize with starting spells for class
    knownSpells: getSpellIdsForLevel(config.classId, 1),
    spellCooldowns: {},

    // SHAPESHIFTING: No active form at start
    activeFormId: null,
  }

  return character
}

/**
 * Calculate resistances from a race's abilities
 * Helper function for character creation (before Character object exists)
 */
function calculateResistancesFromRace(race: import('./data/races').Race): Resistances {
  const resistances: Resistances = {}

  for (const ability of race.abilities) {
    switch (ability.id) {
      case 'resist_poison':
        resistances.POISON = 100 // Immune
        break
      case 'resist_light':
        resistances.LIGHT = (resistances.LIGHT ?? 0) + 50
        break
      case 'resist_dark':
        resistances.DARK = (resistances.DARK ?? 0) + 50
        break
      case 'hold_life':
        resistances.DRAIN = 75 // High resistance
        break
      case 'elem_resist':
        // Elemental affinity (Draconian)
        resistances.FIRE = (resistances.FIRE ?? 0) + 50
        resistances.COLD = (resistances.COLD ?? 0) + 50
        resistances.ACID = (resistances.ACID ?? 0) + 50
        break
      case 'light_vuln':
        // Vampire light vulnerability
        resistances.LIGHT = -100
        break
      case 'construct':
        // Golem immunity to poison (and other effects handled elsewhere)
        resistances.POISON = 100
        break
    }
  }

  return resistances
}

// ============================================================================
// STAT CALCULATIONS
// ============================================================================

/**
 * Calculate effective stats with equipment bonuses
 *
 * @param character - The character to calculate stats for
 * @returns Computed Stats including all equipment modifiers
 */
export function calculateStats(character: Character): Stats {
  // Start with base stats
  const stats: Stats = { ...character.baseStats }

  // Add equipment bonuses
  for (const item of Object.values(character.equipment)) {
    if (!item) continue

    // Artifact bonuses (artifacts use 'bonuses' Record with uppercase keys)
    if (item.artifact?.bonuses) {
      stats.str += getArtifactStatBonus(item.artifact.bonuses, 'str')
      stats.int += getArtifactStatBonus(item.artifact.bonuses, 'int')
      stats.wis += getArtifactStatBonus(item.artifact.bonuses, 'wis')
      stats.dex += getArtifactStatBonus(item.artifact.bonuses, 'dex')
      stats.con += getArtifactStatBonus(item.artifact.bonuses, 'con')
    }

    // Note: Regular ItemTemplates don't have stat bonuses in the current data
    // structure, but we can add support for it via enchantments in the future
  }

  return stats
}

/**
 * Calculate resistances from race and equipment
 *
 * @param character - The character to calculate resistances for
 * @returns Computed Resistances from race and equipment
 */
export function calculateResistances(character: Character): Resistances {
  const race = getRaceById(character.raceId)
  if (!race) return {}

  // Start with racial resistances
  const resistances = calculateResistancesFromRace(race)

  // Equipment resistances could be parsed from item effects/artifacts here
  // For now, we only have racial resistances implemented

  return resistances
}

/**
 * Calculate derived combat stats from character stats and equipment
 *
 * @param character - The character to calculate combat stats for
 * @returns Computed CombatStats
 */
export function calculateCombatStats(character: Character): CombatStats {
  const stats = calculateStats(character)
  const gameClass = getClassById(character.classId)
  const race = getRaceById(character.raceId)
  const bonuses = character.upgradeBonuses ?? DEFAULT_BONUSES

  if (!gameClass || !race) {
    throw new Error('Invalid character race or class')
  }

  // SHAPESHIFTING: Apply form stat modifiers
  const activeForm = character.activeFormId ? getFormById(character.activeFormId) : null
  if (activeForm?.statMods) {
    const mods = activeForm.statMods
    if (mods.strMod) stats.str += mods.strMod
    if (mods.dexMod) stats.dex += mods.dexMod
    if (mods.conMod) stats.con += mods.conMod
    if (mods.intMod) stats.int += mods.intMod
    if (mods.wisMod) stats.wis += mods.wisMod
  }

  // Calculate hitdie
  const hitdie = calculateHitdie(race.hitdie, gameClass.hitdie)

  // HP formula: (raceHitdie + classHitdie) * level * (1 + CON/20) + vitality bonus
  const conMultiplier = 1 + stats.con / 20
  let maxHp = Math.floor(hitdie * character.level * conMultiplier)
  maxHp += bonuses.maxHpBonus // Apply vitality upgrade

  // MP formula: (INT + WIS) * level / 4 (if class has magic)
  const maxMp = gameClass.usesMagic
    ? Math.floor(((stats.int + stats.wis) * character.level) / 4)
    : 0

  // Armor: sum of equipment protection + DEX/4 + resilience bonus
  // ItemTemplate uses 'protection', artifacts use 'protection' and 'toAC' bonus
  let armor = Math.floor(stats.dex / 4)
  armor += bonuses.armorBonus // Apply resilience upgrade
  for (const slot of ARMOR_SLOTS) {
    const item = character.equipment[slot]
    if (item) {
      // Base item protection
      if (item.template.protection) {
        armor += item.template.protection + item.enchantment
      }
      // Artifact protection and AC bonus
      if (item.artifact?.protection) {
        armor += item.artifact.protection
      }
      if (item.artifact?.bonuses?.toAC) {
        armor += item.artifact.bonuses.toAC
      }
    }
  }
  // SHAPESHIFTING: Apply form armor modifier
  if (activeForm?.statMods.armorMod) {
    armor += activeForm.statMods.armorMod
  }

  // Melee damage: weapon damage + STR/3, with might bonus
  // ItemTemplate uses dice notation for damage (e.g., "2d5")
  let meleeDamage = Math.floor(stats.str / 3)
  const weapon = character.equipment.weapon
  if (weapon) {
    // Parse dice notation for base item damage
    meleeDamage += parseDiceAverage(weapon.template.damage) + weapon.enchantment
    // Artifact damage (also dice notation) and toDam bonus
    if (weapon.artifact?.damage) {
      meleeDamage += parseDiceAverage(weapon.artifact.damage)
    }
    if (weapon.artifact?.bonuses?.toDam) {
      meleeDamage += weapon.artifact.bonuses.toDam
    }
  }
  // Apply might upgrade (damage percent)
  meleeDamage = Math.floor(meleeDamage * (1 + bonuses.damagePercent / 100))
  // SHAPESHIFTING: Apply form melee damage modifier (percent)
  if (activeForm?.statMods.meleeDamageMod) {
    meleeDamage = Math.floor(meleeDamage * (1 + activeForm.statMods.meleeDamageMod / 100))
  }

  // Accuracy: 50 + DEX + level + artifact toHit bonuses + precision upgrade
  let accuracy = 50 + stats.dex + character.level + bonuses.accuracyBonus
  if (weapon?.artifact?.bonuses?.toHit) {
    accuracy += weapon.artifact.bonuses.toHit
  }

  // Evasion: DEX/2 + swiftness bonus
  // Note: current ItemTemplate doesn't have evasion field, but artifacts might
  let evasion = Math.floor(stats.dex / 2)
  evasion += bonuses.dodgePercent // Apply swiftness upgrade
  // SHAPESHIFTING: Apply form evasion modifier
  if (activeForm?.statMods.evasionMod) {
    evasion += activeForm.statMods.evasionMod
  }

  // Speed: base 100 + celerity upgrade + equipment modifiers
  // Artifacts use 'SPEED' in bonuses Record
  let speed = 100 + bonuses.speedBonus
  for (const item of Object.values(character.equipment)) {
    if (item?.artifact?.bonuses?.SPEED) {
      speed += item.artifact.bonuses.SPEED
    }
  }
  // SHAPESHIFTING: Apply form speed modifier
  if (activeForm?.statMods.speedMod) {
    speed += activeForm.statMods.speedMod
  }

  // Ranged combat stats (DEX-based)
  let rangedDamage = Math.floor(stats.dex / 3)
  let rangedAccuracy = 50 + stats.dex + character.level

  // Apply bow bonuses if equipped
  const bow = character.equipment.bow
  if (bow) {
    // Parse dice notation for bow damage
    rangedDamage += parseDiceAverage(bow.template.damage) + bow.enchantment
    // Artifact bow bonuses
    if (bow.artifact?.damage) {
      rangedDamage += parseDiceAverage(bow.artifact.damage)
    }
    if (bow.artifact?.bonuses?.toDam) {
      rangedDamage += bow.artifact.bonuses.toDam
    }
    // Hit bonus from bow template
    if (bow.template.hitBonus) {
      rangedAccuracy += bow.template.hitBonus
    }
    // Artifact hit bonus
    if (bow.artifact?.bonuses?.toHit) {
      rangedAccuracy += bow.artifact.bonuses.toHit
    }
  }
  // Apply might upgrade to ranged damage too
  rangedDamage = Math.floor(rangedDamage * (1 + bonuses.damagePercent / 100))

  return {
    maxHp,
    maxMp,
    armor,
    accuracy,
    evasion,
    meleeDamage,
    rangedDamage,
    rangedAccuracy,
    speed,
  }
}

/**
 * Recalculate and update a character's combat stats in place
 *
 * Used after equipment changes, form changes, or other stat modifications.
 *
 * @param character - The character to update (mutated in place)
 */
export function recalculateCombatStats(character: Character): void {
  const newCombat = calculateCombatStats(character)
  character.combat = newCombat

  // Also update current stats
  character.stats = calculateStats(character)

  // Cap HP/MP at new maximums
  character.maxHp = newCombat.maxHp
  character.maxMp = newCombat.maxMp
  if (character.hp > character.maxHp) character.hp = character.maxHp
  if (character.mp > character.maxMp) character.mp = character.maxMp
}

// ============================================================================
// LEVELING
// ============================================================================

/**
 * Award XP to a character and handle level ups
 *
 * @param character - The character to award XP to (mutated in place)
 * @param amount - Amount of XP to award
 * @returns Object indicating if level up occurred and the new level
 */
export function gainXP(
  character: Character,
  amount: number,
  levelupHpPercent = 100
): { leveledUp: boolean; newLevel?: number } {
  if (amount <= 0 || character.isDead) {
    return { leveledUp: false }
  }

  character.xp += amount
  let leveledUp = false
  let newLevel: number | undefined

  // Check for level ups (can gain multiple levels at once)
  while (character.xp >= character.xpToNextLevel && character.level < 50) {
    character.level++
    leveledUp = true
    newLevel = character.level

    // Update XP threshold for next level
    character.xpToNextLevel = xpForLevel(character.level + 1)

    // Recalculate stats on level up
    applyLevelUp(character, levelupHpPercent)
  }

  return { leveledUp, newLevel }
}

/**
 * Apply level up bonuses to a character
 *
 * @param character - The character that leveled up (mutated in place)
 * @param levelupHpPercent - HP gain multiplier (100 = normal)
 */
function applyLevelUp(character: Character, levelupHpPercent = 100): void {
  const gameClass = getClassById(character.classId)
  if (!gameClass) return

  // Stat gains: +1 to primary stat every 5 levels
  if (character.level % 5 === 0) {
    const primaryStat = gameClass.primaryStat
    character.baseStats[primaryStat]++
    character.stats[primaryStat]++
  }

  // Recalculate combat stats
  const newCombat = calculateCombatStats(character)

  // HP gain per level: hitdie + CON modifier
  const race = getRaceById(character.raceId)
  if (race) {
    const hitdie = calculateHitdie(race.hitdie, gameClass.hitdie)
    const conMod = getConModifier(character.stats.con)
    const baseHpGain = hitdie + conMod
    const hpGain = Math.max(1, Math.floor(baseHpGain * levelupHpPercent / 100))

    // Heal the HP gained (don't lose current HP on level up)
    character.hp = Math.min(character.hp + hpGain, newCombat.maxHp)
  }

  // Update max values
  character.maxHp = newCombat.maxHp
  character.maxMp = newCombat.maxMp
  character.combat = newCombat

  // Recalculate stats with equipment
  character.stats = calculateStats(character)

  // Learn new spells at this level
  const newSpells = getNewSpellsAtLevel(character.classId, character.level)
  for (const spell of newSpells) {
    if (!character.knownSpells.includes(spell.id)) {
      character.knownSpells.push(spell.id)
    }
  }

  // BRAVERY_30: Warriors gain permanent fear immunity at level 30
  if (character.classId === 'warrior' && character.level >= 30) {
    if (!hasStatusEffect(character, 'immunity_fear')) {
      addStatusEffect(character, { type: 'immunity_fear', turnsRemaining: 999999, value: 100 })
    }
  }
}

// ============================================================================
// EQUIPMENT MANAGEMENT
// ============================================================================

/**
 * Equip an item to the appropriate slot
 *
 * @param character - The character to equip the item on (mutated in place)
 * @param item - The item to equip
 * @returns Object with success status and any unequipped item
 */
export function equipItem(
  character: Character,
  item: Item
): { success: boolean; unequipped?: Item } {
  const template = item.template

  // Check if item is equippable (has a slot in template)
  if (!template.slot) {
    return { success: false }
  }

  // Map the template slot to our EquipSlot type
  let slot = mapSlot(template.slot)
  if (!slot) {
    return { success: false }
  }

  // Handle ring slots (ring1 or ring2)
  // ItemTemplate uses 'ring' which maps to 'ring1' by default
  if (slot === 'ring1') {
    // Try ring1 first, then ring2
    if (!character.equipment.ring1) {
      slot = 'ring1'
    } else if (!character.equipment.ring2) {
      slot = 'ring2'
    } else {
      // Both slots full, replace ring1
      slot = 'ring1'
    }
  }

  // Unequip current item in slot if any
  const currentItem = character.equipment[slot]
  let unequipped: Item | undefined

  if (currentItem) {
    unequipped = currentItem
    // Add unequipped item to inventory
    character.inventory.push(currentItem)
  }

  // Remove item from inventory if it was there
  const inventoryIndex = character.inventory.findIndex((i) => i.id === item.id)
  if (inventoryIndex >= 0) {
    character.inventory.splice(inventoryIndex, 1)
  }

  // Equip the new item
  character.equipment[slot] = item

  // Recalculate stats, combat, and resistances
  character.stats = calculateStats(character)
  character.combat = calculateCombatStats(character)
  character.resistances = calculateResistances(character)

  // Update max HP/MP (but don't reduce current values below 1)
  character.maxHp = character.combat.maxHp
  character.maxMp = character.combat.maxMp
  character.hp = Math.min(character.hp, character.maxHp)
  character.mp = Math.min(character.mp, character.maxMp)

  return { success: true, unequipped }
}

/**
 * Unequip an item from a slot
 *
 * @param character - The character to unequip from (mutated in place)
 * @param slot - The equipment slot to unequip
 * @returns The unequipped item, or null if slot was empty
 */
export function unequipItem(character: Character, slot: EquipSlot): Item | null {
  const item = character.equipment[slot]

  if (!item) {
    return null
  }

  // Remove from equipment
  delete character.equipment[slot]

  // Add to inventory
  character.inventory.push(item)

  // Recalculate stats, combat, and resistances
  character.stats = calculateStats(character)
  character.combat = calculateCombatStats(character)
  character.resistances = calculateResistances(character)

  // Update max HP/MP (but don't reduce current values below 1)
  character.maxHp = character.combat.maxHp
  character.maxMp = character.combat.maxMp
  character.hp = Math.min(character.hp, character.maxHp)
  character.mp = Math.min(character.mp, character.maxMp)

  return item
}

/**
 * Get the item equipped in a specific slot
 *
 * @param character - The character to check
 * @param slot - The equipment slot to check
 * @returns The equipped item, or null if slot is empty
 */
export function getEquippedItem(character: Character, slot: EquipSlot): Item | null {
  return character.equipment[slot] ?? null
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

/**
 * Calculate number of attacks per melee action
 *
 * Angband-inspired scaling with class differentiation:
 * - Base: 1 attack
 * - Class bonus: melee classes start with more attacks
 * - +1 per 3 STR above 12 (STR matters more)
 * - +1 per 3 levels (faster scaling)
 * - Capped by class maxAttacks
 *
 * @param character - The character to calculate attacks for
 * @returns Number of attacks per melee action (1 to class max)
 */
export function calculateAttackCount(character: Character): number {
  const gameClass = getClassById(character.classId)
  if (!gameClass) return 1

  // Class base bonus: melee classes start with more attacks
  // Warrior/Berserker/Monk: +1, others: 0
  const classBonus = gameClass.maxAttacks >= 6 ? 1 : 0

  // STR bonus: +1 attack per 3 STR above 12
  const strBonus = Math.max(0, Math.floor((character.stats.str - 12) / 3))

  // Level bonus: +1 attack per 3 levels
  const levelBonus = Math.floor(character.level / 3)

  // Total attacks: base 1 + bonuses, capped at class max
  const totalAttacks = 1 + classBonus + strBonus + levelBonus

  return Math.min(totalAttacks, gameClass.maxAttacks)
}

/**
 * Calculate number of ranged attacks (shots) per action
 *
 * FAST_SHOT mechanic (Ranger): +1 shot per 3 levels
 * Other classes: 1 shot always
 *
 * @param character - The character to calculate shots for
 * @returns Number of shots per ranged action
 */
export function calculateRangedAttackCount(character: Character): number {
  const gameClass = getClassById(character.classId)
  if (!gameClass) return 1

  // FAST_SHOT: Rangers get +1 shot per 3 levels
  if (character.classId === 'ranger') {
    const levelBonus = Math.floor(character.level / 3)
    return 1 + levelBonus
  }

  // Other classes: 1 shot
  return 1
}

/**
 * Check if a character can level up with their current XP
 */
export function canLevelUp(character: Character): boolean {
  return character.xp >= character.xpToNextLevel && character.level < 50
}

/**
 * Get the character's current title based on level and class
 */
export function getCharacterTitle(character: Character): string {
  const gameClass = getClassById(character.classId)
  if (!gameClass) return 'Adventurer'

  const titleIndex = Math.min(Math.floor((character.level - 1) / 5), gameClass.titles.length - 1)
  return gameClass.titles[titleIndex] || 'Adventurer'
}

/**
 * Calculate percentage of XP progress to next level
 */
export function getXPProgress(character: Character): number {
  const currentLevelXP = xpForLevel(character.level)
  const xpIntoLevel = character.xp - currentLevelXP
  const xpNeeded = character.xpToNextLevel - currentLevelXP

  if (xpNeeded <= 0) return 100
  return Math.floor((xpIntoLevel / xpNeeded) * 100)
}
