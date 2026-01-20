/**
 * Character System for Borglike
 *
 * Handles character creation, stat calculations, leveling, and equipment management.
 * All functions are pure where possible and properly typed.
 */

import type { Character, Stats, CombatStats, Item, EquipSlot } from './types'
import { getRaceById, getClassById, calculateHitdie } from './data/index'
import { xpForLevel } from '../core/formulas'
import type { UpgradeBonuses } from './upgrade-effects'
import { DEFAULT_BONUSES } from './upgrade-effects'

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
}): Character {
  const race = getRaceById(config.raceId)
  const gameClass = getClassById(config.classId)
  const bonuses = config.upgradeBonuses ?? DEFAULT_BONUSES

  if (!race) {
    throw new Error(`Invalid race ID: ${config.raceId}`)
  }
  if (!gameClass) {
    throw new Error(`Invalid class ID: ${config.classId}`)
  }

  // Calculate base stats: BASE_STAT + race modifiers + class modifiers
  const baseStats: Stats = {
    str: BASE_STAT + race.stats.str + gameClass.stats.str,
    int: BASE_STAT + race.stats.int + gameClass.stats.int,
    wis: BASE_STAT + race.stats.wis + gameClass.stats.wis,
    dex: BASE_STAT + race.stats.dex + gameClass.stats.dex,
    con: BASE_STAT + race.stats.con + gameClass.stats.con,
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
    speed: 100,
  }

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

    // Inventory
    equipment: {},
    inventory: [],
    gold: 0,

    // Position (will be placed by dungeon)
    position: { x: 0, y: 0 },
    depth: 1,

    // State
    isDead: false,
  }

  return character
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
 * Calculate derived combat stats from character stats and equipment
 *
 * @param character - The character to calculate combat stats for
 * @returns Computed CombatStats
 */
export function calculateCombatStats(character: Character): CombatStats {
  const stats = calculateStats(character)
  const gameClass = getClassById(character.classId)
  const race = getRaceById(character.raceId)

  if (!gameClass || !race) {
    throw new Error('Invalid character race or class')
  }

  // Calculate hitdie
  const hitdie = calculateHitdie(race.hitdie, gameClass.hitdie)

  // HP formula: (raceHitdie + classHitdie) * level * (1 + CON/20)
  const conMultiplier = 1 + stats.con / 20
  const maxHp = Math.floor(hitdie * character.level * conMultiplier)

  // MP formula: (INT + WIS) * level / 4 (if class has magic)
  const maxMp = gameClass.usesMagic
    ? Math.floor(((stats.int + stats.wis) * character.level) / 4)
    : 0

  // Armor: sum of equipment protection + DEX/4
  // ItemTemplate uses 'protection', artifacts use 'protection' and 'toAC' bonus
  let armor = Math.floor(stats.dex / 4)
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

  // Melee damage: weapon damage + STR/3
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

  // Accuracy: 50 + DEX + level + artifact toHit bonuses
  let accuracy = 50 + stats.dex + character.level
  if (weapon?.artifact?.bonuses?.toHit) {
    accuracy += weapon.artifact.bonuses.toHit
  }

  // Evasion: DEX/2 + equipment bonuses
  // Note: current ItemTemplate doesn't have evasion field, but artifacts might
  const evasion = Math.floor(stats.dex / 2)

  // Speed: base 100 + equipment modifiers
  // Artifacts use 'SPEED' in bonuses Record
  let speed = 100
  for (const item of Object.values(character.equipment)) {
    if (item?.artifact?.bonuses?.SPEED) {
      speed += item.artifact.bonuses.SPEED
    }
  }

  return {
    maxHp,
    maxMp,
    armor,
    accuracy,
    evasion,
    meleeDamage,
    speed,
  }
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
  amount: number
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
    applyLevelUp(character)
  }

  return { leveledUp, newLevel }
}

/**
 * Apply level up bonuses to a character
 *
 * @param character - The character that leveled up (mutated in place)
 */
function applyLevelUp(character: Character): void {
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
    const hpGain = Math.max(1, hitdie + conMod)

    // Heal the HP gained (don't lose current HP on level up)
    character.hp = Math.min(character.hp + hpGain, newCombat.maxHp)
  }

  // Update max values
  character.maxHp = newCombat.maxHp
  character.maxMp = newCombat.maxMp
  character.combat = newCombat

  // Recalculate stats with equipment
  character.stats = calculateStats(character)
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

  // Recalculate stats and combat
  character.stats = calculateStats(character)
  character.combat = calculateCombatStats(character)

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

  // Recalculate stats and combat
  character.stats = calculateStats(character)
  character.combat = calculateCombatStats(character)

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
