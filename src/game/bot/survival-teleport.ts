/**
 * Teleport and Phase Door Logic
 *
 * Handles town portal decisions, phase door safety evaluation,
 * and escape-vs-heal priority decisions.
 */

import type { GameState } from '../types'
import type { PersonalityConfig, DangerMap, PhaseDoorSafety, DangerTier } from './types'
import { getTile, isWalkable } from '../dungeon'
import { getTileDanger } from './danger'
import { getHitsTillDeath } from './survival-retreat'
import {
  findHealingPotion,
  findEscapeScroll,
  findTownPortalScroll,
} from './items'
import { isInTown } from '../town'

// ============================================================================
// TYPES
// ============================================================================

/**
 * Decision result for town portal usage
 */
export interface TownPortalDecision {
  shouldUse: boolean
  reason: string
}

// ============================================================================
// TOWN PORTAL DECISIONS
// ============================================================================

/**
 * Evaluate whether to use a Town Portal scroll
 *
 * Personality-driven thresholds:
 * - cautious: HP < 50% AND no healing, OR HP < 30%
 * - aggressive: HP < 20% AND no healing AND no escape
 * - greedy: HP < 40% OR 5+ sellable items
 * - speedrunner: HP < 15%, last resort
 */
export function shouldUseTownPortal(
  game: GameState,
  _config: PersonalityConfig,
  personality: string
): TownPortalDecision {
  // Never use in town (can't use there anyway)
  if (isInTown(game)) {
    return { shouldUse: false, reason: 'Already in town' }
  }

  // Don't use if portal already active
  if (game.townPortal) {
    return { shouldUse: false, reason: 'Portal already active' }
  }

  // Check if we have a scroll
  const scroll = findTownPortalScroll(game.character)
  if (!scroll) {
    return { shouldUse: false, reason: 'No scroll available' }
  }

  const character = game.character
  const hpRatio = character.hp / character.maxHp
  const hasHealing = findHealingPotion(character) !== null
  const hasEscape = findEscapeScroll(character) !== null

  // Count sellable items (non-equipped equipment in inventory)
  const sellableItems = character.inventory.filter(item =>
    item.template.slot !== undefined && item.template.type !== 'potion' && item.template.type !== 'scroll'
  ).length

  // Personality-specific thresholds
  switch (personality) {
    case 'cautious':
      // Very careful - portals to town when moderately hurt
      if (hpRatio < 0.3) {
        return { shouldUse: true, reason: 'HP critical (cautious)' }
      }
      if (hpRatio < 0.5 && !hasHealing) {
        return { shouldUse: true, reason: 'HP low, no healing (cautious)' }
      }
      break

    case 'aggressive':
      // Only uses portal as last resort
      if (hpRatio < 0.2 && !hasHealing && !hasEscape) {
        return { shouldUse: true, reason: 'HP critical, no options (aggressive)' }
      }
      break

    case 'greedy':
      // Uses portal to sell gear or when hurt
      if (hpRatio < 0.4) {
        return { shouldUse: true, reason: 'HP low (greedy)' }
      }
      if (sellableItems >= 5) {
        return { shouldUse: true, reason: 'Inventory full of loot (greedy)' }
      }
      break

    case 'speedrunner':
      // Avoids town trips - only absolute emergency
      if (hpRatio < 0.15) {
        return { shouldUse: true, reason: 'HP critical (speedrunner)' }
      }
      break

    default:
      // Default behavior (balanced)
      if (hpRatio < 0.35 && !hasHealing) {
        return { shouldUse: true, reason: 'HP low, no healing' }
      }
  }

  return { shouldUse: false, reason: '' }
}

// ============================================================================
// PHASE DOOR SAFETY
// ============================================================================

/**
 * Evaluate if phase door (short-range teleport) is safe to use
 *
 * Samples tiles within range 10 and counts "safe" zones where
 * danger < avoidance × 0.5. Returns safe if:
 * - >= 25% of landing zones are safe, OR
 * - Average danger is < 50% of current position danger
 */
export function evaluatePhaseDoorSafety(
  game: GameState,
  dangers: DangerMap,
  avoidance: number
): PhaseDoorSafety {
  const pos = game.character.position
  const level = game.currentLevel
  const safeThreshold = avoidance * 0.5
  const currentDanger = getTileDanger(dangers, pos)

  // Sample tiles within phase door range (10 squares)
  const range = 10
  let totalSamples = 0
  let safeSamples = 0
  let totalDanger = 0

  for (let dy = -range; dy <= range; dy++) {
    for (let dx = -range; dx <= range; dx++) {
      const dist = Math.max(Math.abs(dx), Math.abs(dy))
      if (dist === 0 || dist > range) continue

      const x = pos.x + dx
      const y = pos.y + dy

      // Check if tile is walkable
      const tile = getTile(level, x, y)
      if (!tile || !isWalkable(tile)) continue

      // Check if occupied by monster
      const hasMonster = game.monsters.some(
        m => m.position.x === x && m.position.y === y && m.hp > 0
      )
      if (hasMonster) continue

      totalSamples++
      const tileDanger = getTileDanger(dangers, { x, y })
      totalDanger += tileDanger

      if (tileDanger < safeThreshold) {
        safeSamples++
      }
    }
  }

  if (totalSamples === 0) {
    return { isSafe: false, safeRatio: 0, avgDanger: Infinity }
  }

  const safeRatio = safeSamples / totalSamples
  const avgDanger = totalDanger / totalSamples

  // Safe if >= 25% safe zones OR average danger < 50% of current
  const isSafe = safeRatio >= 0.25 || avgDanger < currentDanger * 0.5

  return { isSafe, safeRatio, avgDanger }
}

/**
 * Determine if escape should take priority over healing
 *
 * Escape beats healing when:
 * - CRITICAL tier AND HP < 30%
 * - OR surrounded (3+ adjacent monsters)
 * - OR hitsTillDeath <= 1 with 2+ adjacent
 */
export function shouldEscapeOverHeal(
  game: GameState,
  tier: DangerTier,
  adjacentCount: number
): boolean {
  const hpRatio = game.character.hp / game.character.maxHp
  const hitsTillDeath = getHitsTillDeath(game)

  // CRITICAL tier with low HP - escape is priority
  if (tier === 'CRITICAL' && hpRatio < 0.3) {
    return true
  }

  // Surrounded by 3+ monsters - escape is needed
  if (adjacentCount >= 3) {
    return true
  }

  // About to die with multiple adjacent threats
  if (hitsTillDeath <= 1 && adjacentCount >= 2) {
    return true
  }

  return false
}
