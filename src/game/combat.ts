/**
 * Combat System for Borglike
 *
 * Handles attack resolution, damage calculation, and combat messages.
 * Functions are pure where possible - actual state mutation happens in the game loop.
 */

import type { Character, Monster, ResistanceType } from './types'

// ============================================================================
// TYPES
// ============================================================================

export interface AttackResult {
  hit: boolean
  damage: number
  critical: boolean
  killed: boolean
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
    return {
      accuracy: 50 + speedBonus,
      damage: entity.template.damage,
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
 * Get total resistance including temporary resistances
 */
export function getTotalResistance(character: Character, type: ResistanceType): number {
  const base = character.resistances[type] ?? 0
  const temp = character.tempResistances.find((r) => r.type === type)
  return base + (temp?.value ?? 0)
}

// ============================================================================
// COMBAT RESOLUTION
// ============================================================================

/**
 * Resolve an attack between two entities
 *
 * Hit chance: 50 + attackerAccuracy - defenderEvasion (clamped to 5-95%)
 * Damage: (attackerDamage - defenderArmor/2) * variance (minimum 1)
 * Variance: damage * (0.8 + Math.random() * 0.4) for +/-20%
 * Critical: 5% chance for double damage
 * Resistance: If defender has resistance to the damage type, damage is reduced
 *
 * @param attacker - The attacking entity
 * @param defender - The defending entity
 * @param abilityType - Optional damage type for resistance calculation (e.g., 'POISON', 'FIRE')
 * @returns AttackResult with hit, damage, critical, and killed flags
 */
export function attack(
  attacker: Character | Monster,
  defender: Character | Monster,
  abilityType?: ResistanceType
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
  const hitRoll = Math.random() * 100
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
  const effectiveArmor = defenderStats.armor + defenderACBonus
  const baseDamage = Math.max(1, attackerStats.damage + damageBonus - effectiveArmor / 2)

  // Apply variance (+/- 20%)
  const variance = 0.8 + Math.random() * 0.4
  let damage = Math.floor(baseDamage * variance)

  // Check for critical hit (5% chance)
  const critRoll = Math.random() * 100
  const critical = critRoll < 5

  if (critical) {
    damage *= 2
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
