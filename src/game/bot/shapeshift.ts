/**
 * Druid Shapeshift Bot AI
 *
 * Implements the battle-healer pattern for druid:
 * - Bear Form: Tanking melee combat
 * - Raven Form: Escape mechanism (replaces teleport spells)
 * - Base Form: Gap-closing spellcasting
 *
 * Combat Pattern:
 * 1. See enemy at distance -> Cast entangle (slow) + damage spells
 * 2. Enemy reaches melee -> Enter Bear Form
 * 3. In Bear -> melee + thorn_strike + heal as needed
 * 4. If overwhelmed -> Raven Form -> outrun -> heal -> return
 */

import type { GameState, GameAction, Monster } from '../types'
import type { BotState, BotContext, DangerResult, DangerTier, DangerMap } from './types'
import { recordProgress } from './state'
import { getAvailableSpells } from '../spell-resolution'
import { getLocalDanger } from './danger'
import { getHealingSpellAction, getDamageSpellAction, getDebuffSpellAction } from './spells'
import { countAdjacentMonsters, findClosestMonster } from './combat'
import { canTransform } from '../actions/shapeshift'

// ============================================================================
// CONSTANTS
// ============================================================================

/** HP threshold to enter Raven Form (desperate escape) */
const RAVEN_ESCAPE_HP_THRESHOLD = 0.25

/** HP threshold to exit Raven Form (recovered enough) */
const RAVEN_EXIT_HP_THRESHOLD = 0.5

/** Enter Raven if this many adjacent enemies */
const RAVEN_ESCAPE_ADJACENT = 3

/** Enter Bear when enemy within this distance */
const BEAR_ENGAGE_DISTANCE = 2

/** Mana buffer required for Bear (10 form + 5 for emergency heal) */
const BEAR_MANA_BUFFER = 15

// ============================================================================
// QUERIES
// ============================================================================

/** Check if class uses shapeshifting */
export function isShapeshifterClass(classId: string): boolean {
  return classId === 'druid'
}

/** Check if character is in Bear Form */
export function isInBearForm(character: { activeFormId: string | null }): boolean {
  return character.activeFormId === 'bear_form'
}

/** Check if character is in Raven Form */
export function isInRavenForm(character: { activeFormId: string | null }): boolean {
  return character.activeFormId === 'raven_form'
}

/** Check if character is in any shapeshift form */
export function isInAnyForm(character: { activeFormId: string | null }): boolean {
  return character.activeFormId !== null
}

/** Check if Bear Form is available (level + mana) */
export function canEnterBearForm(game: GameState): boolean {
  return canTransform(game, 'bear_form')
}

/** Check if Raven Form is available (level + mana) */
export function canEnterRavenForm(game: GameState): boolean {
  return canTransform(game, 'raven_form')
}

// ============================================================================
// DECISION LOGIC
// ============================================================================

/**
 * Should the druid enter Bear Form?
 *
 * Enter Bear when:
 * - Adjacent enemy (melee range)
 * - OR enemy approaching within 2 tiles
 * - AND have mana buffer for post-entry healing
 */
export function shouldEnterBearForm(
  game: GameState,
  visibleMonsters: Monster[],
  adjacentCount: number
): boolean {
  const character = game.character

  // Already in Bear Form
  if (isInBearForm(character)) return false

  // Can't enter Bear Form
  if (!canEnterBearForm(game)) return false

  // Need mana buffer for healing after entering
  if (character.mp < BEAR_MANA_BUFFER) return false

  // Enter if adjacent enemy
  if (adjacentCount > 0) return true

  // Enter if enemy within engage distance (2 tiles) and approaching
  if (visibleMonsters.length > 0) {
    const closest = findClosestMonster(visibleMonsters, character.position)
    if (closest && closest.distance <= BEAR_ENGAGE_DISTANCE && closest.monster.isAwake) {
      return true
    }
  }

  return false
}

/**
 * Should the druid enter Raven Form?
 *
 * Enter Raven when (emergency escape):
 * - HP < 25% with any visible threat
 * - OR 3+ adjacent enemies (surrounded)
 * - OR high danger + low HP combination
 */
export function shouldEnterRavenForm(
  game: GameState,
  dangers: DangerMap,
  adjacentCount: number,
  visibleMonsters: Monster[]
): boolean {
  const character = game.character

  // Already in Raven Form
  if (isInRavenForm(character)) return false

  // Can't enter Raven Form
  if (!canEnterRavenForm(game)) return false

  const hpRatio = character.hp / character.maxHp

  // Surrounded - escape!
  if (adjacentCount >= RAVEN_ESCAPE_ADJACENT) return true

  // Critical HP with any threat
  if (hpRatio < RAVEN_ESCAPE_HP_THRESHOLD && visibleMonsters.length > 0) return true

  // High local danger + hurt
  const localDanger = getLocalDanger(dangers, character.position)
  if (hpRatio < 0.4 && localDanger > 100) return true

  return false
}

/**
 * Should the druid exit current form?
 *
 * Bear Form exit when:
 * - No adjacent enemies AND closest > 5 tiles (gap to exploit)
 *
 * Raven Form exit when:
 * - HP > 50% AND no adjacent enemies (recovered and safe)
 */
export function shouldExitCurrentForm(
  game: GameState,
  visibleMonsters: Monster[],
  adjacentCount: number
): boolean {
  const character = game.character

  // Not in any form
  if (!isInAnyForm(character)) return false

  if (isInBearForm(character)) {
    // Exit Bear when no adjacent and gap to exploit
    if (adjacentCount > 0) return false

    if (visibleMonsters.length === 0) return true

    const closest = findClosestMonster(visibleMonsters, character.position)
    return closest !== null && closest.distance > 5
  }

  if (isInRavenForm(character)) {
    // Exit Raven when recovered and no adjacent
    const hpRatio = character.hp / character.maxHp
    return hpRatio >= RAVEN_EXIT_HP_THRESHOLD && adjacentCount === 0
  }

  return false
}

// ============================================================================
// ACTION GETTERS
// ============================================================================

/**
 * Get shapeshift action if form change is needed.
 * Priority: Raven (emergency) > Bear (engage) > Exit (disengage)
 */
export function getShapeshiftAction(
  game: GameState,
  context: BotContext,
  dangers: DangerMap
): GameAction | null {
  const { visibleMonsters } = context
  const adjacentCount = countAdjacentMonsters(game, game.character.position)

  // Priority 1: Emergency escape via Raven
  if (shouldEnterRavenForm(game, dangers, adjacentCount, visibleMonsters)) {
    return { type: 'shapeshift', formId: 'raven_form' }
  }

  // Priority 2: Engage via Bear
  if (shouldEnterBearForm(game, visibleMonsters, adjacentCount)) {
    return { type: 'shapeshift', formId: 'bear_form' }
  }

  // Priority 3: Exit form if safe/recovered
  if (shouldExitCurrentForm(game, visibleMonsters, adjacentCount)) {
    // Exit current form by "shifting" to it again (toggle off)
    return { type: 'shapeshift', formId: game.character.activeFormId! }
  }

  return null
}

/**
 * Get druid tier-specific action.
 * Integrates with the tier system for class-specific combat behavior.
 */
export function getDruidTierAction(
  game: GameState,
  context: BotContext,
  botState: BotState,
  dangerResult: DangerResult,
  tier: DangerTier,
  adjacentMonster: Monster | null
): GameAction | null {
  const character = game.character
  const pos = character.position
  const localDanger = getLocalDanger(dangerResult.dangers, pos)

  // Check for shapeshift action first (highest priority for druid)
  const shapeshiftAction = getShapeshiftAction(game, context, dangerResult.dangers)
  if (shapeshiftAction) {
    recordProgress(botState, game.turn)
    return shapeshiftAction
  }

  // Form-specific combat behavior
  if (isInBearForm(character)) {
    return getBearFormCombatAction(game, context, botState, localDanger, tier, adjacentMonster)
  }

  if (isInRavenForm(character)) {
    return getRavenFormAction(game, context, botState, localDanger, tier)
  }

  // Base form: Gap-closing behavior
  return getBaseFormAction(game, context, botState, localDanger, tier, adjacentMonster)
}

/**
 * Bear Form combat: melee-focused with heal support
 */
function getBearFormCombatAction(
  game: GameState,
  context: BotContext,
  botState: BotState,
  localDanger: number,
  tier: DangerTier,
  adjacentMonster: Monster | null
): GameAction | null {
  const { config } = context
  const character = game.character

  // Priority 1: Heal if needed (Bear has good armor, can sustain while healing)
  if (tier === 'CRITICAL' || tier === 'DANGER') {
    const healAction = getHealingSpellAction(game, config, localDanger, true)
    if (healAction) {
      recordProgress(botState, game.turn)
      return healAction
    }
  }

  // Priority 2: Thorn Strike for extra damage (if adjacent and spell available)
  if (adjacentMonster) {
    const available = getAvailableSpells(character, game.turn)
    const thornStrike = available.find((e) => e.canCast && e.spell.id === 'thorn_strike')
    if (thornStrike) {
      recordProgress(botState, game.turn)
      return { type: 'cast', spellId: 'thorn_strike', targetId: adjacentMonster.id }
    }
  }

  // Priority 3: Melee attack (Bear Form has +20% melee damage)
  if (adjacentMonster) {
    recordProgress(botState, game.turn)
    return { type: 'attack', targetId: adjacentMonster.id }
  }

  // No adjacent - proactive healing in CAUTION/SAFE
  if (tier === 'CAUTION' || tier === 'SAFE') {
    const hpRatio = character.hp / character.maxHp
    if (hpRatio < 0.7) {
      const healAction = getHealingSpellAction(game, config, localDanger, true)
      if (healAction) {
        recordProgress(botState, game.turn)
        return healAction
      }
    }
  }

  return null
}

/**
 * Raven Form: Escape and heal, no combat
 */
function getRavenFormAction(
  game: GameState,
  context: BotContext,
  botState: BotState,
  localDanger: number,
  _tier: DangerTier
): GameAction | null {
  const { config } = context

  // In Raven, focus on healing to recover
  // Movement is handled by goal system (flee behavior)
  const healAction = getHealingSpellAction(game, config, localDanger, true)
  if (healAction) {
    recordProgress(botState, game.turn)
    return healAction
  }

  // Raven has +15 evasion and +20 speed - let movement system handle escape
  return null
}

/**
 * Base Form: Gap-closing with spells, then engage
 */
function getBaseFormAction(
  game: GameState,
  context: BotContext,
  botState: BotState,
  localDanger: number,
  tier: DangerTier,
  adjacentMonster: Monster | null
): GameAction | null {
  const { config, visibleMonsters } = context
  const character = game.character

  // Priority 1: Heal if in danger
  if (tier === 'CRITICAL' || tier === 'DANGER') {
    const healAction = getHealingSpellAction(game, config, localDanger, true)
    if (healAction) {
      recordProgress(botState, game.turn)
      return healAction
    }
  }

  // Gap-closing phase: Cast spells at distant enemies
  if (visibleMonsters.length > 0 && !adjacentMonster) {
    // Entangle to slow approaching enemies
    const debuffAction = getDebuffSpellAction(game, config, visibleMonsters)
    if (debuffAction) {
      recordProgress(botState, game.turn)
      return debuffAction
    }

    // Damage spells while closing
    const damageAction = getDamageSpellAction(game, config, visibleMonsters)
    if (damageAction) {
      recordProgress(botState, game.turn)
      return damageAction
    }
  }

  // If adjacent in base form and can't enter Bear, use thorn_strike
  if (adjacentMonster) {
    const available = getAvailableSpells(character, game.turn)
    const thornStrike = available.find((e) => e.canCast && e.spell.id === 'thorn_strike')
    if (thornStrike) {
      recordProgress(botState, game.turn)
      return { type: 'cast', spellId: 'thorn_strike', targetId: adjacentMonster.id }
    }
  }

  // Proactive healing when safe
  if ((tier === 'CAUTION' || tier === 'SAFE') && !adjacentMonster) {
    const hpRatio = character.hp / character.maxHp
    if (hpRatio < 0.6) {
      const healAction = getHealingSpellAction(game, config, localDanger, true)
      if (healAction) {
        recordProgress(botState, game.turn)
        return healAction
      }
    }
  }

  return null
}
