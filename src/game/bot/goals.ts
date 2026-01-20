/**
 * Goal Selection and Priority System
 *
 * Implements smart goal selection with clear priority ordering
 * and goal persistence to prevent thrashing.
 */

import type { GroundItem } from '../types'
import type { BotState, BotGoal, BotContext, GoalType, DangerMap } from './types'
import { getTile } from '../dungeon'
import { getLocalDanger } from './danger'
import { isSamePosition } from './movement'
import { selectTarget, shouldEngage, findAdjacentMonster } from './combat'
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

/** Minimum turns before forced goal re-evaluation */
const GOAL_REEVALUATE_INTERVAL = 10

/** Shorter re-evaluation interval for exploration (to adapt to newly discovered areas) */
const EXPLORE_REEVALUATE_INTERVAL = 5

/** Priority order for goals (higher = more important) */
const GOAL_PRIORITY: Record<GoalType, number> = {
  FLEE: 100,
  RECOVER: 80,
  KILL: 70,
  TAKE: 50,
  DESCEND: 40,
  EXPLORE: 30,
  WAIT: 0,
}

// ============================================================================
// MAIN GOAL SELECTION
// ============================================================================

/**
 * Select the best goal based on current situation
 *
 * Priority order:
 * 1. FLEE - HP < caution AND danger high
 * 2. RECOVER - HP < 50% AND no enemies AND can heal
 * 3. KILL - Adjacent enemy OR aggressive with target
 * 4. TAKE - Valuable item within reach
 * 5. DESCEND - Explored enough OR patience exceeded
 * 6. EXPLORE - Find unexplored areas
 * 7. WAIT - Nothing else possible
 */
export function selectGoal(
  context: BotContext,
  botState: BotState,
  dangers: DangerMap,
  dangerThreshold: number
): BotGoal | null {
  const { game } = context
  const turn = game.turn
  const pos = game.character.position

  // Check if current goal is still valid and high priority
  const currentGoal = botState.currentGoal
  if (currentGoal && isGoalStillValid(currentGoal, context, botState)) {
    // Check if we should keep the current goal
    const currentPriority = GOAL_PRIORITY[currentGoal.type]
    const turnsSinceGoalStart = turn - currentGoal.startTurn

    // Don't thrash - keep goal unless:
    // 1. A higher priority need arises
    // 2. We've been on this goal too long
    // Use shorter interval for EXPLORE to adapt to newly discovered areas
    const reevalInterval = currentGoal.type === 'EXPLORE'
      ? EXPLORE_REEVALUATE_INTERVAL
      : GOAL_REEVALUATE_INTERVAL
    if (turnsSinceGoalStart < reevalInterval) {
      // Check for higher priority override
      const overrideGoal = checkHighPriorityOverride(context, botState, dangers, dangerThreshold, currentPriority)
      if (overrideGoal) {
        return overrideGoal
      }
      // Keep current goal
      return currentGoal
    }
  }

  // Full goal evaluation
  const localDanger = getLocalDanger(dangers, pos)
  const hpRatio = game.character.hp / game.character.maxHp

  // 1. FLEE - HP critical and in danger
  const fleeGoal = evaluateFlee(context, dangers, dangerThreshold, localDanger, hpRatio)
  if (fleeGoal) return fleeGoal

  // 2. RECOVER - Low HP but safe
  const recoverGoal = evaluateRecover(context, dangerThreshold, localDanger, hpRatio)
  if (recoverGoal) return recoverGoal

  // 3. KILL - Adjacent monster or hunting
  const killGoal = evaluateKill(context, hpRatio)
  if (killGoal) return killGoal

  // 4. TAKE - Valuable item nearby
  const takeGoal = evaluateTake(context, dangers, dangerThreshold)
  if (takeGoal) return takeGoal

  // 5. DESCEND - Ready to go down
  const descendGoal = evaluateDescend(context, botState)
  if (descendGoal) return descendGoal

  // 6. EXPLORE - Default
  const exploreGoal = evaluateExplore(context)
  if (exploreGoal) return exploreGoal

  // 7. WAIT - Nothing possible
  return {
    type: 'WAIT',
    target: pos,
    targetId: null,
    reason: 'No valid goals',
    startTurn: turn,
  }
}

// ============================================================================
// GOAL VALIDATORS
// ============================================================================

/**
 * Check if current goal is still valid
 */
function isGoalStillValid(goal: BotGoal, context: BotContext, botState: BotState): boolean {
  const { game } = context

  switch (goal.type) {
    case 'FLEE':
      // Flee is valid while danger persists AND we haven't reached the target
      if (context.visibleMonsters.length === 0) return false
      // If we're at the flee target, goal is complete - need new evaluation
      const fleePos = game.character.position
      if (goal.target && fleePos.x === goal.target.x && fleePos.y === goal.target.y) {
        return false
      }
      return true

    case 'RECOVER':
      // Recover until full HP or enemies appear
      return (
        game.character.hp < game.character.maxHp &&
        context.visibleMonsters.length === 0
      )

    case 'KILL':
      // Kill is valid if target still exists
      if (!goal.targetId) return false
      return game.monsters.some((m) => m.id === goal.targetId && m.hp > 0)

    case 'TAKE':
      // Take is valid if item still exists
      if (!goal.targetId) return false
      return game.items.some((item) => item.id === goal.targetId)

    case 'DESCEND':
      // Descend is valid if we know stairs location
      return botState.knownStairsDown !== null

    case 'EXPLORE':
      // Explore is valid if unexplored areas exist AND we haven't reached the target
      if (context.unexploredTiles.length === 0) return false
      // If we're at the target, goal is complete - need new target
      const pos = game.character.position
      if (goal.target && pos.x === goal.target.x && pos.y === goal.target.y) {
        return false
      }
      return true

    case 'WAIT':
      return false // Always re-evaluate
  }
}

/**
 * Check if a higher priority goal should override current
 */
function checkHighPriorityOverride(
  context: BotContext,
  _botState: BotState,
  dangers: DangerMap,
  dangerThreshold: number,
  currentPriority: number
): BotGoal | null {
  const { game } = context
  const pos = game.character.position
  const localDanger = getLocalDanger(dangers, pos)
  const hpRatio = game.character.hp / game.character.maxHp

  // Check FLEE (priority 100)
  if (currentPriority < GOAL_PRIORITY.FLEE) {
    const fleeGoal = evaluateFlee(context, dangers, dangerThreshold, localDanger, hpRatio)
    if (fleeGoal) return fleeGoal
  }

  // Check RECOVER (priority 80)
  if (currentPriority < GOAL_PRIORITY.RECOVER) {
    const recoverGoal = evaluateRecover(context, dangerThreshold, localDanger, hpRatio)
    if (recoverGoal) return recoverGoal
  }

  // Check KILL for adjacent monsters (priority 70)
  if (currentPriority < GOAL_PRIORITY.KILL) {
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
  }

  return null
}

// ============================================================================
// GOAL EVALUATORS
// ============================================================================

/**
 * Evaluate FLEE goal - escape from danger
 */
function evaluateFlee(
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

/**
 * Evaluate RECOVER goal - rest to heal
 */
function evaluateRecover(
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

/**
 * Evaluate KILL goal - hunt monsters
 */
function evaluateKill(
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

/**
 * Evaluate TAKE goal - pick up items
 */
function evaluateTake(
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

/**
 * Evaluate DESCEND goal - go to next level
 */
function evaluateDescend(context: BotContext, botState: BotState): BotGoal | null {
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

/**
 * Evaluate EXPLORE goal - find unexplored areas
 */
function evaluateExplore(context: BotContext): BotGoal | null {
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
function findBestItem(context: BotContext, maxDistance: number): GroundItem | null {
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


// ============================================================================
// EXPORTS
// ============================================================================

export { GOAL_PRIORITY, GOAL_REEVALUATE_INTERVAL }
