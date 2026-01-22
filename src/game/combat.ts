/**
 * Combat System for Borglike
 *
 * Handles attack resolution, damage calculation, and combat messages.
 * Functions are pure where possible - actual state mutation happens in the game loop.
 */

import type { Character, Monster, ResistanceType, Point } from './types'
import type { KnowledgeBonuses } from './knowledge-effects'
import { random } from './rng'
import { calculateAttackCount, calculateRangedAttackCount } from './character'
import { getClassById } from './data/classes'
import { getFormById, hasLifedrain } from './data/forms'

// ============================================================================
// TYPES
// ============================================================================

export interface AttackResult {
  hit: boolean
  damage: number
  critical: boolean
  killed: boolean
}

/** Result of a multi-attack melee action */
export interface MultiAttackResult {
  /** Number of attacks performed */
  attackCount: number
  /** Number of attacks that hit */
  hits: number
  /** Total damage dealt across all attacks */
  totalDamage: number
  /** Number of critical hits */
  criticals: number
  /** Whether the target was killed */
  killed: boolean
  /** Individual attack results for message formatting */
  attacks: AttackResult[]
}

interface AttackerStats {
  accuracy: number
  damage: number
}

interface DefenderStats {
  evasion: number
  armor: number
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard to check if an entity is a Character
 */
export function isCharacter(entity: Character | Monster): entity is Character {
  return 'classId' in entity && 'raceId' in entity
}

/**
 * Type guard to check if an entity is a Monster
 */
export function isMonster(entity: Character | Monster): entity is Monster {
  return 'template' in entity
}

// ============================================================================
// STAT EXTRACTION
// ============================================================================

/**
 * Extract attacker stats from a character or monster
 * For characters: uses combat stats
 * For monsters: uses template damage and derives accuracy from speed
 */
export function getAttackerStats(entity: Character | Monster): AttackerStats {
  if (isCharacter(entity)) {
    return {
      accuracy: entity.combat.accuracy,
      damage: entity.combat.meleeDamage,
    }
  } else {
    // Monster: accuracy derived from speed (faster = more accurate)
    // Base accuracy of 50, modified by speed (110 is normal)
    const speedBonus = Math.floor((entity.template.speed - 110) / 2)
    let accuracy = 50 + speedBonus
    let damage = entity.template.damage

    // Apply weaken debuff (reduces damage)
    const weakenDebuff = entity.debuffs?.find(d => d.type === 'weaken')
    if (weakenDebuff) {
      damage = Math.floor(damage * (100 - weakenDebuff.value) / 100)
    }

    // Apply blind debuff (reduces accuracy)
    const blindDebuff = entity.debuffs?.find(d => d.type === 'blind')
    if (blindDebuff) {
      accuracy = Math.floor(accuracy * (100 - blindDebuff.value) / 100)
    }

    return {
      accuracy,
      damage,
    }
  }
}

/**
 * Extract defender stats from a character or monster
 * For characters: uses combat stats
 * For monsters: uses template armor and derives evasion from speed
 */
export function getDefenderStats(entity: Character | Monster): DefenderStats {
  if (isCharacter(entity)) {
    return {
      evasion: entity.combat.evasion,
      armor: entity.combat.armor,
    }
  } else {
    // Monster: evasion derived from speed (faster = harder to hit)
    const speedBonus = Math.floor((entity.template.speed - 110) / 2)
    return {
      evasion: 20 + speedBonus,
      armor: entity.template.armor,
    }
  }
}

// ============================================================================
// STATUS EFFECT BONUSES
// ============================================================================

/**
 * Get hit bonus from status effects (heroism, blessing)
 */
export function getStatusHitBonus(character: Character): number {
  let bonus = 0
  for (const e of character.statusEffects) {
    if (e.type === 'heroism' || e.type === 'blessing') bonus += e.value
  }
  return bonus
}

/**
 * Get damage bonus from status effects (berserk)
 */
export function getStatusDamageBonus(character: Character): number {
  const berserk = character.statusEffects.find((e) => e.type === 'berserk')
  return berserk ? Math.floor(berserk.value * 0.5) : 0
}

/**
 * Get AC bonus from status effects (blessing)
 */
export function getStatusACBonus(character: Character): number {
  const blessing = character.statusEffects.find((e) => e.type === 'blessing')
  return blessing?.value ?? 0
}

/**
 * Get speed bonus from status effects (speed/haste)
 */
export function getStatusSpeedBonus(character: Character): number {
  const speed = character.statusEffects.find((e) => e.type === 'speed')
  return speed?.value ?? 0
}

/**
 * Get total resistance including temporary resistances
 */
export function getTotalResistance(character: Character, type: ResistanceType): number {
  const base = character.resistances[type] ?? 0
  const temp = character.tempResistances.find((r) => r.type === type)
  return base + (temp?.value ?? 0)
}

// ============================================================================
// DEADLINESS TABLE
// ============================================================================

/**
 * Deadliness lookup table
 *
 * Maps deadliness value to damage percentage multiplier.
 * Based on Angband's non-linear scaling where higher deadliness
 * gives increasingly better returns.
 *
 * Index = deadliness value (0-150)
 * Value = damage percentage (100 = 1x, 200 = 2x, etc.)
 */
const DEADLINESS_TABLE: number[] = [
  // 0-9: Minimal bonus
  100, 102, 104, 106, 108, 110, 112, 114, 116, 118,
  // 10-19: Small bonus
  120, 123, 126, 129, 132, 135, 138, 141, 144, 147,
  // 20-29: Moderate bonus
  150, 154, 158, 162, 166, 170, 174, 178, 182, 186,
  // 30-39: Good bonus
  190, 195, 200, 205, 210, 215, 220, 225, 230, 235,
  // 40-49: Strong bonus
  240, 246, 252, 258, 264, 270, 276, 282, 288, 294,
  // 50-59: Excellent bonus
  300, 307, 314, 321, 328, 335, 342, 349, 356, 363,
  // 60-69: Superior bonus
  370, 378, 386, 394, 402, 410, 418, 426, 434, 442,
  // 70-79: Exceptional bonus
  450, 459, 468, 477, 486, 495, 504, 513, 522, 531,
  // 80-89: Outstanding bonus
  540, 550, 560, 570, 580, 590, 600, 610, 620, 630,
  // 90-99: Legendary bonus
  640, 651, 662, 673, 684, 695, 706, 717, 728, 739,
  // 100+: Maximum
  750, 762, 774, 786, 798, 810, 822, 834, 846, 858,
  870, 883, 896, 909, 922, 935, 948, 961, 974, 987,
  1000, // 120 = 10x damage
  // 121-150: Diminishing returns past 10x
  1010, 1020, 1030, 1040, 1050, 1060, 1070, 1080, 1090,
  1100, 1108, 1116, 1124, 1132, 1140, 1148, 1156, 1164, 1172,
  1180, 1187, 1194, 1201, 1208, 1215, 1222, 1229, 1236, 1243,
  1250, // 150 = 12.5x damage (theoretical max)
]

/**
 * Calculate character's melee deadliness value
 *
 * Deadliness comes from:
 * - Weapon enchantment (to-damage): +2 deadliness per point
 * - STR bonus: +1 deadliness per point of STR above 10
 * - Level bonus: +0.5 deadliness per level
 *
 * @param character - The character
 * @returns Deadliness value (0-150)
 */
export function calculateDeadliness(character: Character): number {
  let deadliness = 0

  // Weapon enchantment bonus (each +1 enchant = +2 deadliness)
  const weapon = character.equipment.weapon
  if (weapon) {
    deadliness += weapon.enchantment * 2
  }

  // STR bonus (each point above 10 = +1 deadliness)
  const strBonus = Math.max(0, character.stats.str - 10)
  deadliness += strBonus

  // Level bonus (level / 2)
  deadliness += Math.floor(character.level / 2)

  // Cap at 150 (table maximum)
  return Math.min(150, deadliness)
}

/**
 * Calculate character's ranged deadliness value
 *
 * Similar to melee but uses:
 * - Bow enchantment: +2 deadliness per point
 * - DEX bonus: +1 deadliness per point of DEX above 10
 * - Level bonus: +0.5 deadliness per level
 *
 * @param character - The character
 * @returns Deadliness value (0-150)
 */
export function calculateRangedDeadliness(character: Character): number {
  let deadliness = 0

  // Bow enchantment bonus (each +1 enchant = +2 deadliness)
  const bow = character.equipment.bow
  if (bow) {
    deadliness += bow.enchantment * 2
  }

  // DEX bonus for ranged (each point above 10 = +1 deadliness)
  const dexBonus = Math.max(0, character.stats.dex - 10)
  deadliness += dexBonus

  // Level bonus (level / 2)
  deadliness += Math.floor(character.level / 2)

  // Cap at 150 (table maximum)
  return Math.min(150, deadliness)
}

/**
 * Apply deadliness damage multiplier
 *
 * @param baseDamage - Base damage before deadliness
 * @param deadliness - Deadliness value (0-150)
 * @returns Modified damage with deadliness applied
 */
export function applyDeadliness(baseDamage: number, deadliness: number): number {
  const clampedDeadliness = Math.max(0, Math.min(150, deadliness))
  const multiplier = DEADLINESS_TABLE[clampedDeadliness] ?? 100
  return Math.floor(baseDamage * multiplier / 100)
}

// ============================================================================
// SCALED CRITICAL SYSTEM
// ============================================================================

/**
 * Critical hit result with damage multiplier tier
 * Based on Angband's weight/level scaled criticals
 */
export interface CriticalResult {
  /** Whether a critical hit occurred */
  isCritical: boolean
  /** Damage multiplier (1 = no crit, 2/3/4 = tiered crit) */
  multiplier: number
  /** Crit tier name for messaging */
  tier: 'none' | 'good' | 'great' | 'superb'
}

/**
 * Calculate scaled critical hit based on weapon weight and character level
 *
 * Angband-inspired formula:
 * - Crit chance = (weight/10 + level * 3) / 100, capped at 50%
 * - On crit, roll determines tier:
 *   - 0-50%: good hit (2x damage)
 *   - 50-85%: great hit (3x damage)
 *   - 85-100%: superb hit (4x damage)
 *
 * @param weaponWeight - Weapon weight in 0.1 lbs (e.g., 120 = 12 lbs)
 * @param characterLevel - Character level
 * @returns CriticalResult with multiplier and tier
 */
export function calculateScaledCritical(weaponWeight: number, characterLevel: number): CriticalResult {
  // Base crit chance from weight (heavier = more crits)
  // Weight is in 0.1 lbs, so 120 = 12% base
  const weightBonus = weaponWeight / 10

  // Level bonus (3% per level)
  const levelBonus = characterLevel * 3

  // Total crit chance, capped at 50%
  const critChance = Math.min(50, weightBonus + levelBonus)

  // Roll for crit
  const critRoll = random() * 100
  if (critRoll >= critChance) {
    return { isCritical: false, multiplier: 1, tier: 'none' }
  }

  // Critical hit! Roll for tier
  const tierRoll = random() * 100
  if (tierRoll < 50) {
    // Good hit: 2x damage
    return { isCritical: true, multiplier: 2, tier: 'good' }
  } else if (tierRoll < 85) {
    // Great hit: 3x damage
    return { isCritical: true, multiplier: 3, tier: 'great' }
  } else {
    // Superb hit: 4x damage
    return { isCritical: true, multiplier: 4, tier: 'superb' }
  }
}

// ============================================================================
// COMBAT RESOLUTION
// ============================================================================

/**
 * Resolve an attack between two entities
 *
 * Hit chance: 50 + attackerAccuracy - defenderEvasion (clamped to 5-95%)
 * Damage: (attackerDamage - defenderArmor/2) * variance (minimum 1)
 * Variance: damage * (0.8 + random() * 0.4) for +/-20%
 * Critical: 5% chance for double damage
 * Resistance: If defender has resistance to the damage type, damage is reduced
 * Knowledge: Bestiary bonuses add damage when player attacks, reduce damage when monster attacks
 *
 * @param attacker - The attacking entity
 * @param defender - The defending entity
 * @param abilityType - Optional damage type for resistance calculation (e.g., 'POISON', 'FIRE')
 * @param knowledgeBonuses - Optional bestiary bonuses from monster knowledge
 * @returns AttackResult with hit, damage, critical, and killed flags
 */
export function attack(
  attacker: Character | Monster,
  defender: Character | Monster,
  abilityType?: ResistanceType,
  knowledgeBonuses?: KnowledgeBonuses,
  armorPenetration = 0
): AttackResult {
  const attackerStats = getAttackerStats(attacker)
  const defenderStats = getDefenderStats(defender)

  // Apply status effect bonuses
  let accuracyBonus = 0
  let damageBonus = 0
  let defenderACBonus = 0

  if (isCharacter(attacker)) {
    accuracyBonus = getStatusHitBonus(attacker)
    damageBonus = getStatusDamageBonus(attacker)
  }
  if (isCharacter(defender)) {
    defenderACBonus = getStatusACBonus(defender)
  }

  // Calculate hit chance (clamped between 5% and 95%)
  const baseHitChance =
    50 + attackerStats.accuracy + accuracyBonus - defenderStats.evasion - defenderACBonus
  const hitChance = Math.max(5, Math.min(95, baseHitChance))

  // Roll for hit
  const hitRoll = random() * 100
  const hit = hitRoll < hitChance

  if (!hit) {
    return {
      hit: false,
      damage: 0,
      critical: false,
      killed: false,
    }
  }

  // Calculate base damage (minimum 1)
  // Apply armor penetration (flat reduction to defender armor)
  const effectiveArmor = Math.max(0, defenderStats.armor + defenderACBonus - armorPenetration)
  let baseDamage = Math.max(1, attackerStats.damage + damageBonus - effectiveArmor / 2)

  // Apply deadliness multiplier for character melee attacks
  if (isCharacter(attacker)) {
    const deadliness = calculateDeadliness(attacker)
    baseDamage = applyDeadliness(baseDamage, deadliness)
  }

  // SHIELD_BASH: Characters with shield and canShieldBash have 20% chance for +50% damage
  if (isCharacter(attacker) && attacker.equipment.shield) {
    const gameClass = getClassById(attacker.classId)
    if (gameClass?.canShieldBash && random() < 0.20) {
      baseDamage = Math.floor(baseDamage * 1.5)
    }
  }

  // Apply variance (+/- 20%)
  const variance = 0.8 + random() * 0.4
  let damage = Math.floor(baseDamage * variance)

  // Check for critical hit
  // Characters use scaled criticals based on weapon weight and level
  // Monsters use flat 5% chance with 2x damage
  let critical = false
  if (isCharacter(attacker)) {
    const weaponWeight = attacker.equipment.weapon?.template.weight ?? 50 // Default to 5 lbs if unarmed
    const critResult = calculateScaledCritical(weaponWeight, attacker.level)
    critical = critResult.isCritical
    if (critical) {
      damage *= critResult.multiplier
    }
  } else {
    // Monster attacks: flat 5% chance, 2x damage
    const critRoll = random() * 100
    critical = critRoll < 5
    if (critical) {
      damage *= 2
    }
  }

  // Apply knowledge bonuses from bestiary
  if (knowledgeBonuses) {
    if (isCharacter(attacker) && isMonster(defender)) {
      // Player attacking monster: bonus damage
      damage = Math.floor(damage * (1 + knowledgeBonuses.damagePercent / 100))
    } else if (isMonster(attacker) && isCharacter(defender)) {
      // Monster attacking player: damage reduction
      damage = Math.floor(damage * (1 - knowledgeBonuses.reductionPercent / 100))
    }
  }

  // Apply resistance if defender is a character with resistances
  if (abilityType && isCharacter(defender)) {
    const resist = getTotalResistance(defender, abilityType)
    // Positive resist = damage reduction (100 = immune), negative = vulnerability
    damage = Math.floor(damage * (1 - resist / 100))
    damage = Math.max(0, damage) // Can't heal from resistance
  }

  // Ensure minimum damage of 1 on a hit (unless fully immune)
  if (abilityType && isCharacter(defender)) {
    const resist = getTotalResistance(defender, abilityType)
    if (resist < 100) {
      damage = Math.max(1, damage)
    }
    // If immune (100+), damage can be 0
  } else {
    damage = Math.max(1, damage)
  }

  // Check if defender would be killed
  const defenderHp = defender.hp
  const killed = damage >= defenderHp

  return {
    hit: true,
    damage,
    critical,
    killed,
  }
}

/**
 * Perform a full melee attack action with multiple attacks
 *
 * Number of attacks scales with level, STR, and class cap.
 * Each attack is resolved independently, damage accumulates.
 *
 * @param attacker - The attacking character
 * @param defender - The defending monster
 * @param knowledgeBonuses - Optional bestiary bonuses
 * @param armorPenetration - Flat armor penetration
 * @returns MultiAttackResult with aggregated stats
 */
export function meleeAttack(
  attacker: Character,
  defender: Monster,
  knowledgeBonuses?: KnowledgeBonuses,
  armorPenetration = 0
): MultiAttackResult {
  const attackCount = calculateAttackCount(attacker)
  const attacks: AttackResult[] = []
  let hits = 0
  let totalDamage = 0
  let criticals = 0
  let killed = false

  // Track remaining HP for accurate kill detection
  let remainingHp = defender.hp

  for (let i = 0; i < attackCount; i++) {
    // Skip if target already dead
    if (remainingHp <= 0) break

    // Create a temporary defender with remaining HP for kill detection
    const tempDefender = { ...defender, hp: remainingHp }

    const result = attack(attacker, tempDefender, undefined, knowledgeBonuses, armorPenetration)
    attacks.push(result)

    if (result.hit) {
      hits++
      totalDamage += result.damage
      remainingHp -= result.damage

      if (result.critical) {
        criticals++
      }

      if (result.killed || remainingHp <= 0) {
        killed = true
      }
    }
  }

  return {
    attackCount,
    hits,
    totalDamage,
    criticals,
    killed,
    attacks,
  }
}

/**
 * Format a multi-attack result into a single message
 */
export function formatMultiAttackMessage(
  defenderName: string,
  result: MultiAttackResult
): string {
  if (result.hits === 0) {
    if (result.attackCount === 1) {
      return `You miss ${defenderName}.`
    }
    return `You miss ${defenderName} ${result.attackCount} times.`
  }

  // Build message showing attack count and total damage
  let message: string

  if (result.killed) {
    if (result.attackCount === 1) {
      message = result.criticals > 0
        ? `You critically hit ${defenderName} for ${result.totalDamage} damage and kill it!`
        : `You hit ${defenderName} for ${result.totalDamage} damage and kill it!`
    } else {
      message = `You hit ${defenderName} ${result.hits}x for ${result.totalDamage} total damage and kill it!`
    }
  } else {
    if (result.attackCount === 1) {
      message = result.criticals > 0
        ? `You critically hit ${defenderName} for ${result.totalDamage} damage!`
        : `You hit ${defenderName} for ${result.totalDamage} damage.`
    } else {
      const critText = result.criticals > 0 ? ` (${result.criticals} crit)` : ''
      message = `You hit ${defenderName} ${result.hits}/${result.attackCount}x for ${result.totalDamage} damage${critText}.`
    }
  }

  return message
}

// ============================================================================
// DAMAGE APPLICATION
// ============================================================================

/**
 * Apply damage to an entity
 *
 * Handles HP reduction and sets death flags.
 * For characters: sets isDead flag
 * For monsters: should be removed from monster list by caller
 *
 * @param entity - The entity taking damage
 * @param damage - Amount of damage to apply
 * @returns true if the entity was killed
 */
export function applyDamage(entity: Character | Monster, damage: number): boolean {
  entity.hp = Math.max(0, entity.hp - damage)

  const killed = entity.hp <= 0

  if (killed && isCharacter(entity)) {
    entity.isDead = true
  }

  return killed
}

// ============================================================================
// COMBAT MESSAGES
// ============================================================================

/**
 * Format an attack message for display in the game log
 *
 * @param attackerName - Name of the attacker (e.g., "You" or "the Orc")
 * @param defenderName - Name of the defender (e.g., "You" or "the Orc")
 * @param result - The attack result
 * @returns Formatted message string
 */
export function formatAttackMessage(
  attackerName: string,
  defenderName: string,
  result: AttackResult
): string {
  const isPlayerAttacker = attackerName.toLowerCase() === 'you'
  const isPlayerDefender = defenderName.toLowerCase() === 'you'

  if (!result.hit) {
    // Miss message
    if (isPlayerAttacker) {
      return `You miss ${defenderName}.`
    } else {
      return `${attackerName} misses ${isPlayerDefender ? 'you' : defenderName}.`
    }
  }

  // Hit message
  let message: string

  if (result.killed) {
    // Kill message
    if (isPlayerAttacker) {
      message = `You kill ${defenderName}!`
    } else if (isPlayerDefender) {
      message = `${attackerName} kills you!`
    } else {
      message = `${attackerName} kills ${defenderName}!`
    }
  } else if (result.critical) {
    // Critical hit message
    if (isPlayerAttacker) {
      message = `You critically hit ${defenderName} for ${result.damage} damage!`
    } else {
      message = `${attackerName} critically hits ${isPlayerDefender ? 'you' : defenderName} for ${result.damage} damage!`
    }
  } else {
    // Normal hit message
    if (isPlayerAttacker) {
      message = `You hit ${defenderName} for ${result.damage} damage.`
    } else {
      message = `${attackerName} hits ${isPlayerDefender ? 'you' : defenderName} for ${result.damage} damage.`
    }
  }

  return message
}

/**
 * Convenience function to format attack message using entity objects
 */
export function formatAttackMessageFromEntities(
  attacker: Character | Monster,
  defender: Character | Monster,
  result: AttackResult
): string {
  const attackerName = isCharacter(attacker) ? 'You' : `The ${attacker.template.name}`
  const defenderName = isCharacter(defender) ? 'you' : `the ${defender.template.name}`

  return formatAttackMessage(attackerName, defenderName, result)
}

// ============================================================================
// RANGED COMBAT
// ============================================================================

/** Minimum range for ranged attacks (can't shoot adjacent targets) */
const MIN_RANGED_RANGE = 2

/** Maximum range for ranged attacks (bow range) */
const MAX_RANGED_RANGE = 8

/**
 * Check if character can perform a ranged attack on target
 *
 * Requirements:
 * - Has a bow equipped
 * - Target is not adjacent (distance >= 2)
 * - Target is within range (distance <= 8)
 */
export function canRangedAttack(character: Character, targetPos: Point): boolean {
  // Must have a bow equipped
  const bow = character.equipment.bow
  if (!bow) return false

  // Calculate distance
  const dx = Math.abs(targetPos.x - character.position.x)
  const dy = Math.abs(targetPos.y - character.position.y)
  const distance = Math.max(dx, dy) // Chebyshev distance

  // Must be at least MIN_RANGED_RANGE tiles away (not adjacent)
  if (distance < MIN_RANGED_RANGE) return false

  // Must be within bow range
  const range = bow.template.range ?? MAX_RANGED_RANGE
  if (distance > range) return false

  return true
}

/**
 * Get the range of the equipped bow
 */
export function getBowRange(character: Character): number {
  const bow = character.equipment.bow
  if (!bow) return 0
  return bow.template.range ?? MAX_RANGED_RANGE
}

/**
 * Resolve a ranged attack between character and monster
 *
 * Similar to melee attack but:
 * - Uses rangedDamage and rangedAccuracy
 * - Distance penalty: -5% hit chance per tile beyond 2
 * - Knowledge bonuses apply to damage
 */
export function rangedAttack(
  attacker: Character,
  defender: Monster,
  distance: number,
  knowledgeBonuses?: KnowledgeBonuses,
  armorPenetration = 0
): AttackResult {
  // Get ranged stats
  let accuracy = attacker.combat.rangedAccuracy
  let damage = attacker.combat.rangedDamage

  // Apply status effect bonuses
  accuracy += getStatusHitBonus(attacker)
  damage += getStatusDamageBonus(attacker)

  // Distance penalty: -5% hit chance per tile beyond 2
  const distancePenalty = Math.max(0, distance - 2) * 5
  accuracy -= distancePenalty

  // Get defender stats
  const defenderStats = getDefenderStats(defender)

  // Calculate hit chance (clamped between 5% and 95%)
  const baseHitChance = 50 + accuracy - defenderStats.evasion
  const hitChance = Math.max(5, Math.min(95, baseHitChance))

  // Roll for hit
  const hitRoll = random() * 100
  const hit = hitRoll < hitChance

  if (!hit) {
    return {
      hit: false,
      damage: 0,
      critical: false,
      killed: false,
    }
  }

  // Calculate base damage (minimum 1)
  // Apply armor penetration (flat reduction to defender armor)
  const effectiveArmor = Math.max(0, defenderStats.armor - armorPenetration)
  let baseDamage = Math.max(1, damage - effectiveArmor / 2)

  // Apply ranged deadliness multiplier (from bow enchantment + DEX + level)
  const deadliness = calculateRangedDeadliness(attacker)
  baseDamage = applyDeadliness(baseDamage, deadliness)

  // Apply variance (+/- 20%)
  const variance = 0.8 + random() * 0.4
  let finalDamage = Math.floor(baseDamage * variance)

  // Check for critical hit using scaled system (bow weight + level)
  const bowWeight = attacker.equipment.bow?.template.weight ?? 30 // Default to 3 lbs
  const critResult = calculateScaledCritical(bowWeight, attacker.level)
  const critical = critResult.isCritical
  if (critical) {
    finalDamage *= critResult.multiplier
  }

  // Apply knowledge bonus from bestiary (player attacking monster)
  if (knowledgeBonuses) {
    finalDamage = Math.floor(finalDamage * (1 + knowledgeBonuses.damagePercent / 100))
  }

  // Ensure minimum damage of 1 on a hit
  finalDamage = Math.max(1, finalDamage)

  // Check if defender would be killed
  const killed = finalDamage >= defender.hp

  return {
    hit: true,
    damage: finalDamage,
    critical,
    killed,
  }
}

/**
 * Format ranged attack message
 */
export function formatRangedAttackMessage(
  defenderName: string,
  result: AttackResult
): string {
  if (!result.hit) {
    return `Your arrow misses ${defenderName}.`
  }

  if (result.killed) {
    return `Your arrow kills ${defenderName}!`
  }

  if (result.critical) {
    return `Your arrow critically hits ${defenderName} for ${result.damage} damage!`
  }

  return `Your arrow hits ${defenderName} for ${result.damage} damage.`
}

/**
 * Perform a full ranged attack action with multiple shots
 *
 * FAST_SHOT: Rangers get +1 shot per 3 levels
 * Other classes: 1 shot
 *
 * @param attacker - The attacking character
 * @param defender - The defending monster
 * @param distance - Distance to target
 * @param knowledgeBonuses - Optional bestiary bonuses
 * @param armorPenetration - Flat armor penetration
 * @returns MultiAttackResult with aggregated stats
 */
export function multiRangedAttack(
  attacker: Character,
  defender: Monster,
  distance: number,
  knowledgeBonuses?: KnowledgeBonuses,
  armorPenetration = 0
): MultiAttackResult {
  const shotCount = calculateRangedAttackCount(attacker)
  const attacks: AttackResult[] = []
  let hits = 0
  let totalDamage = 0
  let criticals = 0
  let killed = false

  // Track remaining HP for accurate kill detection
  let remainingHp = defender.hp

  for (let i = 0; i < shotCount; i++) {
    // Skip if target already dead
    if (remainingHp <= 0) break

    // Create a temporary defender with remaining HP for kill detection
    const tempDefender = { ...defender, hp: remainingHp }

    const result = rangedAttack(attacker, tempDefender, distance, knowledgeBonuses, armorPenetration)
    attacks.push(result)

    if (result.hit) {
      hits++
      totalDamage += result.damage
      remainingHp -= result.damage

      if (result.critical) {
        criticals++
      }

      if (result.killed || remainingHp <= 0) {
        killed = true
      }
    }
  }

  return {
    attackCount: shotCount,
    hits,
    totalDamage,
    criticals,
    killed,
    attacks,
  }
}

/**
 * Format a multi-shot ranged attack result into a single message
 */
export function formatMultiRangedAttackMessage(
  defenderName: string,
  result: MultiAttackResult
): string {
  if (result.hits === 0) {
    if (result.attackCount === 1) {
      return `Your arrow misses ${defenderName}.`
    }
    return `Your arrows miss ${defenderName} ${result.attackCount} times.`
  }

  let message: string

  if (result.killed) {
    if (result.attackCount === 1) {
      message = result.criticals > 0
        ? `Your arrow critically hits ${defenderName} for ${result.totalDamage} damage and kills it!`
        : `Your arrow hits ${defenderName} for ${result.totalDamage} damage and kills it!`
    } else {
      message = `Your arrows hit ${defenderName} ${result.hits}x for ${result.totalDamage} total damage and kill it!`
    }
  } else {
    if (result.attackCount === 1) {
      message = result.criticals > 0
        ? `Your arrow critically hits ${defenderName} for ${result.totalDamage} damage!`
        : `Your arrow hits ${defenderName} for ${result.totalDamage} damage.`
    } else {
      const critText = result.criticals > 0 ? ` (${result.criticals} crit)` : ''
      message = `Your arrows hit ${defenderName} ${result.hits}/${result.attackCount}x for ${result.totalDamage} damage${critText}.`
    }
  }

  return message
}

// ============================================================================
// COMBAT LIFESTEAL
// ============================================================================

/**
 * Calculate lifesteal amount for a character based on damage dealt
 *
 * Sources of lifesteal:
 * - COMBAT_REGEN: Blackguard heals 10% of melee damage dealt (class ability)
 * - SHAPESHIFTING: Shadow Form grants 10% lifedrain (form ability)
 *
 * @param character - The attacking character
 * @param damage - Damage dealt to the enemy
 * @returns Amount of HP to heal (0 if no lifesteal source)
 */
export function calculateLifesteal(character: Character, damage: number): number {
  let lifestealPercent = 0

  // COMBAT_REGEN: Blackguard class ability
  const gameClass = getClassById(character.classId)
  if (gameClass?.combatLifesteal) {
    lifestealPercent += gameClass.combatLifesteal
  }

  // SHAPESHIFTING: Shadow Form lifedrain
  if (character.activeFormId) {
    const form = getFormById(character.activeFormId)
    if (form && hasLifedrain(form)) {
      lifestealPercent += 10 // Shadow Form grants 10% lifedrain
    }
  }

  if (lifestealPercent <= 0) return 0
  return Math.floor(damage * lifestealPercent / 100)
}
