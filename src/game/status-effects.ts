/**
 * Status Effects System for Borglike
 *
 * Centralized handling of status effects, temporary resistances, and poison.
 * Used by game-loop, spell-resolution, and other modules.
 */

import type {
  Character,
  StatusEffect,
  TempResistance,
  PoisonStatus,
  GameState,
  GameMessage,
} from './types'

// ============================================================================
// STATUS EFFECTS
// ============================================================================

/**
 * Add or replace a status effect on a character
 * Replaces existing effect of same type
 */
export function addStatusEffect(character: Character, effect: StatusEffect): void {
  character.statusEffects = character.statusEffects.filter((e) => e.type !== effect.type)
  character.statusEffects.push(effect)
}

/**
 * Remove a status effect by type
 */
export function removeStatusEffect(character: Character, type: StatusEffect['type']): void {
  character.statusEffects = character.statusEffects.filter((e) => e.type !== type)
}

/**
 * Check if character has a specific status effect
 */
export function hasStatusEffect(character: Character, type: StatusEffect['type']): boolean {
  return character.statusEffects.some((e) => e.type === type)
}

/**
 * Get a specific status effect if it exists
 */
export function getStatusEffect(
  character: Character,
  type: StatusEffect['type']
): StatusEffect | null {
  return character.statusEffects.find((e) => e.type === type) ?? null
}

/**
 * Tick down status effects, removing expired ones
 * Returns list of expired effect types
 */
export function tickStatusEffects(character: Character): StatusEffect['type'][] {
  const expired: StatusEffect['type'][] = []

  character.statusEffects = character.statusEffects.filter((effect) => {
    effect.turnsRemaining--
    if (effect.turnsRemaining <= 0) {
      expired.push(effect.type)
      return false
    }
    return true
  })

  return expired
}

// ============================================================================
// TEMPORARY RESISTANCES
// ============================================================================

/**
 * Add or replace a temporary resistance on a character
 */
export function addTempResistance(character: Character, resistance: TempResistance): void {
  character.tempResistances = character.tempResistances.filter((r) => r.type !== resistance.type)
  character.tempResistances.push(resistance)
}

/**
 * Remove a temporary resistance by type
 */
export function removeTempResistance(character: Character, type: TempResistance['type']): void {
  character.tempResistances = character.tempResistances.filter((r) => r.type !== type)
}

/**
 * Check if character has a specific temporary resistance
 */
export function hasTempResistance(character: Character, type: TempResistance['type']): boolean {
  return character.tempResistances.some((r) => r.type === type)
}

/**
 * Get a specific temporary resistance if it exists
 */
export function getTempResistance(
  character: Character,
  type: TempResistance['type']
): TempResistance | null {
  return character.tempResistances.find((r) => r.type === type) ?? null
}

/**
 * Tick down temporary resistances, removing expired ones
 * Returns list of expired resistance types
 */
export function tickTempResistances(character: Character): TempResistance['type'][] {
  const expired: TempResistance['type'][] = []

  character.tempResistances = character.tempResistances.filter((r) => {
    r.turnsRemaining--
    if (r.turnsRemaining <= 0) {
      expired.push(r.type)
      return false
    }
    return true
  })

  return expired
}

// ============================================================================
// POISON
// ============================================================================

/**
 * Apply poison to a character
 */
export function applyPoison(character: Character, poison: PoisonStatus): void {
  // If already poisoned, take the worse of the two
  if (character.poison) {
    character.poison = {
      damagePerTurn: Math.max(character.poison.damagePerTurn, poison.damagePerTurn),
      turnsRemaining: Math.max(character.poison.turnsRemaining, poison.turnsRemaining),
    }
  } else {
    character.poison = { ...poison }
  }
}

/**
 * Clear poison from a character
 */
export function clearPoison(character: Character): void {
  character.poison = null
}

/**
 * Check if character is poisoned
 */
export function isPoisoned(character: Character): boolean {
  return character.poison !== null
}

/**
 * Process poison damage and tick down duration
 * Returns damage dealt (0 if not poisoned)
 */
export function tickPoison(character: Character): number {
  const poison = character.poison
  if (!poison) return 0

  const damage = poison.damagePerTurn

  poison.turnsRemaining--
  if (poison.turnsRemaining <= 0) {
    character.poison = null
  }

  return damage
}

// ============================================================================
// GAME STATE HELPERS
// ============================================================================

/**
 * Process poison damage on a character within game context
 * Handles damage application, death check, and messaging
 */
export function processPoison(
  game: GameState,
  addMessage: (game: GameState, text: string, type: GameMessage['type']) => void
): void {
  const poison = game.character.poison
  if (!poison) return

  const damage = poison.damagePerTurn
  game.character.hp -= damage
  addMessage(game, `You suffer ${damage} poison damage!`, 'danger')

  poison.turnsRemaining--
  if (poison.turnsRemaining <= 0) {
    game.character.poison = null
    addMessage(game, 'The poison wears off.', 'info')
  }

  // Check for death from poison
  if (game.character.hp <= 0) {
    game.character.hp = 0
    game.character.isDead = true
  }
}

/**
 * Check and trigger Second Wind if applicable
 * Second Wind heals the character once when they drop to critical HP (≤20% max)
 */
export function checkSecondWind(
  game: GameState,
  addMessage: (game: GameState, text: string, type: GameMessage['type']) => void
): boolean {
  const bonuses = game.boosterBonuses
  if (!bonuses?.hasSecondWind) return false
  if (game.usedSecondWind) return false
  if (game.character.isDead) return false

  // Check if at or below critical threshold (20% of max HP)
  const criticalThreshold = Math.floor(game.character.maxHp * 0.2)
  if (game.character.hp > 0 && game.character.hp <= criticalThreshold) {
    // Trigger Second Wind
    const healAmount = Math.floor(game.character.maxHp * (bonuses.secondWindPercent / 100))
    game.character.hp = Math.min(game.character.hp + healAmount, game.character.maxHp)
    game.usedSecondWind = true
    addMessage(game, `Second Wind! You recover ${healAmount} HP!`, 'good')
    return true
  }

  return false
}
