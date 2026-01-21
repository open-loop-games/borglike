/**
 * Goal Evaluators
 *
 * Individual goal evaluation functions extracted from goals.ts.
 * Each evaluator determines if a specific goal type should be pursued.
 */

import type { GroundItem } from '../types'
import type { BotState, BotGoal, BotContext, DangerMap } from './types'
import { getTile } from '../dungeon'
import { getLocalDanger } from './danger'
import { isSamePosition } from './movement'
import { selectTarget, shouldEngage, findAdjacentMonster, hasRangedWeapon, findBestRangedTarget, findKitePosition } from './combat'
import { shouldRetreat, findBestEscapeRoute } from './survival'
import { evaluateItem, shouldPickup } from './items'
import {
  findExplorationTarget as findExploreTarget,
  getExplorationProgress,
} from './exploration'

// ============================================================================
// CONSTANTS
// ============================================================================

/** Toggle to disable exploration module for A/B testing */
const USE_EXPLORATION_MODULE = true

// ============================================================================
// FLEE EVALUATOR
// ============================================================================

/**
 * Evaluate FLEE goal - escape from danger
 */
export function evaluateFlee(
  context: BotContext,
  dangers: DangerMap,
  _dangerThreshold: number,
  _localDanger: number,
  _hpRatio: number
): BotGoal | null {
  const { game, config, botState } = context

  // Check flee cooldown (set after stop_fleeing to prevent immediately fleeing again)
  if (game.turn < botState.fleeCooldownUntil) {
    return null
  }

  // Use survival module for retreat decision
  const retreatEval = shouldRetreat(game, config, dangers)

  if (!retreatEval.shouldRetreat) return null

  // Find best escape route using survival module
  const escapeRoute = findBestEscapeRoute(game, dangers)
  if (!escapeRoute) {
    // No escape - try stairs as last resort
    if (game.currentLevel.stairsDown) {
      const stairsTile = getTile(
        game.currentLevel,
        game.currentLevel.stairsDown.x,
        game.currentLevel.stairsDown.y
      )
      if (stairsTile?.explored) {
        return {
          type: 'FLEE',
          target: game.currentLevel.stairsDown,
          targetId: null,
          reason: retreatEval.reason,
          startTurn: game.turn,
        }
      }
    }
    return null
  }

  return {
    type: 'FLEE',
    target: escapeRoute.target,
    targetId: null,
    reason: retreatEval.reason,
    startTurn: game.turn,
  }
}

// ============================================================================
// KITE EVALUATOR
// ============================================================================

/**
 * Evaluate KITE goal - maintain distance while shooting
 *
 * For ranged classes with a bow equipped:
 * - Find a target to shoot
 * - If too close, move away while maintaining line of sight
 * - If at good range, stay and shoot
 */
export function evaluateKite(
  context: BotContext,
  _dangers: DangerMap,
  _dangerThreshold: number
): BotGoal | null {
  const { game, classProfile, visibleMonsters } = context

  // Need ranged weapon and visible targets
  if (!hasRangedWeapon(game)) return null
  if (visibleMonsters.length === 0) return null

  // Find best ranged target
  const target = findBestRangedTarget(game, visibleMonsters)
  if (!target) return null

  // Check if we need to reposition (kite)
  const kiteDirection = findKitePosition(game, target, classProfile)

  if (kiteDirection) {
    // We need to move - set a kite goal
    // Calculate the position we'd move to
    const pos = game.character.position
    const dx = kiteDirection === 'e' || kiteDirection === 'ne' || kiteDirection === 'se' ? 1 :
               kiteDirection === 'w' || kiteDirection === 'nw' || kiteDirection === 'sw' ? -1 : 0
    const dy = kiteDirection === 's' || kiteDirection === 'se' || kiteDirection === 'sw' ? 1 :
               kiteDirection === 'n' || kiteDirection === 'ne' || kiteDirection === 'nw' ? -1 : 0
    const newPos = { x: pos.x + dx, y: pos.y + dy }

    return {
      type: 'KITE',
      target: newPos,
      targetId: target.id,
      reason: `Kiting ${target.template.name}`,
      startTurn: game.turn,
    }
  }

  // We're at good range - target for shooting (handled by main loop)
  return {
    type: 'KITE',
    target: target.position,
    targetId: target.id,
    reason: `Shooting ${target.template.name}`,
    startTurn: game.turn,
  }
}

// ============================================================================
// RECOVER EVALUATOR
// ============================================================================

/**
 * Evaluate RECOVER goal - rest to heal
 */
export function evaluateRecover(
  context: BotContext,
  dangerThreshold: number,
  localDanger: number,
  hpRatio: number
): BotGoal | null {
  const { game } = context
  const pos = game.character.position

  // Recover if: HP < 50% AND safe AND no visible monsters
  const shouldRecover =
    hpRatio < 0.5 &&
    localDanger < dangerThreshold * 0.5 &&
    context.visibleMonsters.length === 0

  if (!shouldRecover) return null

  // Stay in place to recover
  return {
    type: 'RECOVER',
    target: pos,
    targetId: null,
    reason: `Recovering (HP: ${Math.round(hpRatio * 100)}%)`,
    startTurn: game.turn,
  }
}

// ============================================================================
// KILL EVALUATOR
// ============================================================================

/**
 * Evaluate KILL goal - hunt monsters
 */
export function evaluateKill(
  context: BotContext,
  _hpRatio: number
): BotGoal | null {
  const { game, config } = context

  // Check for adjacent monster first (always attack)
  const adjacentMonster = findAdjacentMonster(game)
  if (adjacentMonster) {
    return {
      type: 'KILL',
      target: adjacentMonster.position,
      targetId: adjacentMonster.id,
      reason: 'Adjacent monster',
      startTurn: game.turn,
    }
  }

  // Use combat module for target selection
  const targetSelection = selectTarget(context, false)
  if (!targetSelection) return null

  // Check if we should engage this target
  if (!shouldEngage(game, targetSelection.target, config)) {
    return null
  }

  return {
    type: 'KILL',
    target: targetSelection.target.position,
    targetId: targetSelection.target.id,
    reason: `Hunting ${targetSelection.target.template.name} (${targetSelection.reason})`,
    startTurn: game.turn,
  }
}

// ============================================================================
// TAKE EVALUATOR
// ============================================================================

/**
 * Evaluate TAKE goal - pick up items
 */
export function evaluateTake(
  context: BotContext,
  dangers: DangerMap,
  dangerThreshold: number
): BotGoal | null {
  const { game, config } = context
  const pos = game.character.position

  // Check for item at current position first
  const itemHere = game.items.find((item) => isSamePosition(item.position, pos))
  if (itemHere) {
    return {
      type: 'TAKE',
      target: pos,
      targetId: itemHere.id,
      reason: 'Item at position',
      startTurn: game.turn,
    }
  }

  // Check if safe enough to detour for items
  const localDanger = getLocalDanger(dangers, pos)
  if (localDanger > dangerThreshold) return null

  // Find best item within greed radius
  const maxDetour = Math.floor(config.greed / 10) + 3
  const nearestItem = findBestItem(context, maxDetour)
  if (!nearestItem) return null

  return {
    type: 'TAKE',
    target: nearestItem.position,
    targetId: nearestItem.id,
    reason: 'Collecting item',
    startTurn: game.turn,
  }
}

// ============================================================================
// DESCEND EVALUATOR
// ============================================================================

/**
 * Evaluate DESCEND goal - go to next level
 */
export function evaluateDescend(context: BotContext, botState: BotState): BotGoal | null {
  const { game, config } = context

  // Need to know where stairs are
  if (!botState.knownStairsDown) return null

  // Check if ready to descend
  const explorationProgress = getExplorationProgress(game)
  const shouldDescend =
    explorationProgress >= config.exploration ||
    botState.turnsOnLevel >= config.patience

  if (!shouldDescend) return null

  return {
    type: 'DESCEND',
    target: botState.knownStairsDown,
    targetId: null,
    reason: `Descending (${explorationProgress}% explored)`,
    startTurn: game.turn,
  }
}

// ============================================================================
// EXPLORE EVALUATOR
// ============================================================================

/**
 * Evaluate EXPLORE goal - find unexplored areas
 */
export function evaluateExplore(context: BotContext): BotGoal | null {
  const { game, unexploredTiles, botState } = context

  if (unexploredTiles.length === 0) return null

  let target

  if (USE_EXPLORATION_MODULE) {
    // Use smart exploration target selection
    target = findExploreTarget(game, botState)
  } else {
    // Simple: pick nearest unexplored tile
    const pos = game.character.position
    let nearest = unexploredTiles[0]!
    let nearestDist = Math.abs(nearest.x - pos.x) + Math.abs(nearest.y - pos.y)

    for (const tile of unexploredTiles) {
      const dist = Math.abs(tile.x - pos.x) + Math.abs(tile.y - pos.y)
      if (dist < nearestDist) {
        nearestDist = dist
        nearest = tile
      }
    }
    target = nearest
  }

  if (!target) return null

  return {
    type: 'EXPLORE',
    target,
    targetId: null,
    reason: 'Exploring dungeon',
    startTurn: game.turn,
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Find best item within distance using smart evaluation
 */
export function findBestItem(context: BotContext, maxDistance: number): GroundItem | null {
  const { game, visibleItems, config } = context
  const pos = game.character.position
  const character = game.character

  let best: GroundItem | null = null
  let bestScore = -Infinity

  for (const item of visibleItems) {
    const dx = Math.abs(item.position.x - pos.x)
    const dy = Math.abs(item.position.y - pos.y)
    const distance = dx + dy

    if (distance > maxDistance) continue

    // Check if we should pick up this item
    if (!shouldPickup(item, character, config)) continue

    // Evaluate item value
    const evaluation = evaluateItem(item, character)

    // Score = value - distance penalty
    // Upgrades get big bonus to encourage pickup
    let score = evaluation.score
    if (evaluation.isUpgrade) {
      score += 50
    }
    score -= distance * 3 // Distance penalty

    if (score > bestScore) {
      bestScore = score
      best = item
    }
  }

  return best
}
