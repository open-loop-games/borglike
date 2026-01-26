/**
 * Bot Activation Decision Making
 *
 * Handles decisions for using artifact and racial activations.
 * Determines when to use damage activations, haste, and racial abilities.
 */

import type { GameState, GameAction, Monster } from '../types'
import type { PersonalityConfig } from './types'
import { getEquippedActivations, canUseRacialAbility } from '../actions/activation'
import { getActivationById } from '../data/activations'
import { countAdjacentMonsters } from './combat'

// ============================================================================
// DAMAGE ACTIVATIONS
// ============================================================================

/**
 * Get action to use a damage activation (Fire Ball, Cold Ball, etc.)
 *
 * Use when:
 * - 2+ enemies visible
 * - Activation off cooldown
 *
 * @returns GameAction to use damage activation, or null if not appropriate
 */
export function getDamageActivationAction(
  game: GameState,
  _config: PersonalityConfig,
  visibleMonsters: Monster[]
): GameAction | null {
  const character = game.character

  // Need at least 2 visible enemies to justify using activation
  if (visibleMonsters.length < 2) return null

  // Get equipped activations that are damage-oriented and ready
  const equippedActivations = getEquippedActivations(character, game.turn)

  for (const activation of equippedActivations) {
    if (!activation.ready) continue

    const template = getActivationById(activation.activationId)
    if (!template) continue

    // Only use damage activations
    if (template.effectType !== 'aoe_damage' && template.effectType !== 'damage') continue

    // Use it!
    return {
      type: 'activate',
      itemId: activation.itemId,
    }
  }

  return null
}

// ============================================================================
// HASTE ACTIVATION
// ============================================================================

/**
 * Get action to use haste activation (Boots of Feanor)
 *
 * Use when:
 * - HP < 50% (need speed to escape or fight)
 * - OR 2+ adjacent enemies (tactical advantage)
 *
 * @returns GameAction to use haste activation, or null if not appropriate
 */
export function getHasteActivationAction(
  game: GameState,
  _config: PersonalityConfig,
  _visibleMonsters: Monster[]
): GameAction | null {
  const character = game.character
  const hpRatio = character.hp / character.maxHp

  // Check if we need haste
  const adjacentCount = countAdjacentMonsters(game, character.position)
  const needsHaste = hpRatio < 0.5 || adjacentCount >= 2

  if (!needsHaste) return null

  // Get equipped activations
  const equippedActivations = getEquippedActivations(character, game.turn)

  for (const activation of equippedActivations) {
    if (!activation.ready) continue

    const template = getActivationById(activation.activationId)
    if (!template) continue

    // Only use haste activations
    if (template.effectType !== 'haste') continue

    // Use it!
    return {
      type: 'activate',
      itemId: activation.itemId,
    }
  }

  return null
}

// ============================================================================
// RACIAL ACTIVATIONS
// ============================================================================

/**
 * Get action to use racial ability (Draconian breath weapon)
 *
 * Use when:
 * - 2+ enemies visible
 * - HP > 10 (can pay HP cost)
 * - Off rest interval
 *
 * @returns GameAction to use racial ability, or null if not appropriate
 */
export function getRacialActivationAction(
  game: GameState,
  _config: PersonalityConfig,
  visibleMonsters: Monster[]
): GameAction | null {
  const character = game.character

  // Only Draconians have racial activations
  if (character.raceId !== 'draconian') return null

  // Need at least 2 visible enemies
  if (visibleMonsters.length < 2) return null

  // Check if we can use it
  if (!canUseRacialAbility(character, game.turn)) return null

  // Use it!
  return {
    type: 'racial_ability',
  }
}

// ============================================================================
// UTILITY ACTIVATIONS
// ============================================================================

/**
 * Get action to use any utility activation (illuminate, detect, etc.)
 *
 * Lower priority than combat activations - mainly used when exploring
 *
 * @returns GameAction to use utility activation, or null if not appropriate
 */
export function getUtilityActivationAction(
  game: GameState,
  _config: PersonalityConfig,
  visibleMonsters: Monster[]
): GameAction | null {
  const character = game.character

  // Don't use utility activations in combat
  if (visibleMonsters.length > 0) return null

  // Get equipped activations
  const equippedActivations = getEquippedActivations(character, game.turn)

  for (const activation of equippedActivations) {
    if (!activation.ready) continue

    const template = getActivationById(activation.activationId)
    if (!template) continue

    // Use detect_all or illuminate when exploring
    if (template.effectType === 'detect' || template.effectType === 'illuminate') {
      return {
        type: 'activate',
        itemId: activation.itemId,
      }
    }
  }

  return null
}

// ============================================================================
// COMBINED ACTIVATION CHECK
// ============================================================================

/**
 * Get the best activation action to use right now
 *
 * Checks in priority order:
 * 1. Haste (if low HP or surrounded)
 * 2. Damage activations (if 2+ enemies)
 * 3. Racial ability (if 2+ enemies)
 * 4. Utility activations (if exploring)
 *
 * @returns Best activation action, or null if none appropriate
 */
export function getBestActivationAction(
  game: GameState,
  config: PersonalityConfig,
  visibleMonsters: Monster[]
): GameAction | null {
  // Priority 1: Haste when in danger
  const hasteAction = getHasteActivationAction(game, config, visibleMonsters)
  if (hasteAction) return hasteAction

  // Priority 2: Damage activations
  const damageAction = getDamageActivationAction(game, config, visibleMonsters)
  if (damageAction) return damageAction

  // Priority 3: Racial ability
  const racialAction = getRacialActivationAction(game, config, visibleMonsters)
  if (racialAction) return racialAction

  // Priority 4: Utility activations when not in combat
  const utilityAction = getUtilityActivationAction(game, config, visibleMonsters)
  if (utilityAction) return utilityAction

  return null
}
