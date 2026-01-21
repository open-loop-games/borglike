/**
 * Goal Selection and Priority System
 *
 * Implements smart goal selection with clear priority ordering
 * and goal persistence to prevent thrashing.
 */

// Type declaration for Node.js process (used for debug logging in scripts)
declare const process: { env: Record<string, string | undefined> } | undefined

import type { BotState, BotGoal, BotContext, GoalType, DangerMap } from './types'
import type { GameState } from '../types'
import { isAdjacent } from '../types'
import { getLocalDanger } from './danger'
import { findAdjacentMonster, hasRangedWeapon } from './combat'
import { isInTown, HEALER_POSITION, DUNGEON_ENTRANCE_POSITION, TOWN_SHOP_POSITIONS } from '../town'
import { type TownShopId } from '../data/town'

// Import evaluators from separate module
import {
  evaluateFlee,
  evaluateKite,
  evaluateRecover,
  evaluateKill,
  evaluateTake,
  evaluateDescend,
  evaluateExplore,
} from './goal-evaluators'

// Re-export evaluators for external use
export {
  evaluateFlee,
  evaluateKite,
  evaluateRecover,
  evaluateKill,
  evaluateTake,
  evaluateDescend,
  evaluateExplore,
  findBestItem,
} from './goal-evaluators'

// ============================================================================
// CONSTANTS
// ============================================================================

/** Minimum turns before forced goal re-evaluation */
const GOAL_REEVALUATE_INTERVAL = 10

/** Re-evaluation interval for exploration - longer to prevent ping-ponging
 * The exploration scoring system handles adapting to new discoveries via persistence bonus */
const EXPLORE_REEVALUATE_INTERVAL = 15

/** Priority order for goals (higher = more important) */
const GOAL_PRIORITY: Record<GoalType, number> = {
  FLEE: 100,
  KITE: 90, // Higher than RECOVER, ranged classes prefer kiting
  // Town goals (order: sell → heal → buy → return)
  SELL_TO_MERCHANT: 88, // Sell loot first to get gold
  VISIT_HEALER: 85,     // Heal with gold from selling
  BUY_FROM_MERCHANT: 82, // Buy consumables after healing
  RETURN_PORTAL: 70,    // Return through portal
  EXIT_TOWN: 65,        // Fallback if no portal
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

    // Debug logging
    if (typeof process !== 'undefined' && process.env.DEBUG_GOALS) {
      console.log(`[GOALS] turn=${turn} currentGoal=${currentGoal.type}@(${currentGoal.target?.x},${currentGoal.target?.y}) startTurn=${currentGoal.startTurn} turnsSince=${turnsSinceGoalStart} reevalInterval=${reevalInterval}`)
    }

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
  const { classProfile } = context

  // 0. TOWN GOALS - If in town, handle town-specific behavior
  if (isInTown(game)) {
    const townGoal = selectTownGoal(context, botState, hpRatio)
    if (townGoal) return townGoal
  }

  // 1. FLEE - HP critical and in danger (skip for Berserker)
  if (!classProfile.neverRetreats) {
    const fleeGoal = evaluateFlee(context, dangers, dangerThreshold, localDanger, hpRatio)
    if (fleeGoal) return fleeGoal
  }

  // 1.5 KITE - Ranged classes maintain distance and shoot
  if (classProfile.prefersRanged && hasRangedWeapon(game)) {
    const kiteGoal = evaluateKite(context, dangers, dangerThreshold)
    if (kiteGoal) return kiteGoal
  }

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

    case 'KILL': {
      // Kill is valid if target still exists AND is still visible/adjacent
      if (!goal.targetId) return false

      const targetMonster = game.monsters.find((m) => m.id === goal.targetId && m.hp > 0)
      if (!targetMonster) return false

      // Check if monster is still visible or adjacent
      const isVisible = context.visibleMonsters.some((m) => m.id === goal.targetId)
      const isAdjacentToPlayer = isAdjacent(game.character.position, targetMonster.position)

      // Invalidate if monster went out of sight and isn't adjacent
      if (!isVisible && !isAdjacentToPlayer) return false

      // Update target position if monster moved (keeps flow computation accurate)
      if (goal.target &&
          (goal.target.x !== targetMonster.position.x || goal.target.y !== targetMonster.position.y)) {
        goal.target = { ...targetMonster.position }
      }

      return true
    }

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

    case 'KITE':
      // Kite is valid if we have a ranged weapon and visible monsters
      if (!hasRangedWeapon(game)) return false
      if (context.visibleMonsters.length === 0) return false
      // If target monster is dead, need new target
      if (goal.targetId) {
        return game.monsters.some((m) => m.id === goal.targetId && m.hp > 0)
      }
      return true

    case 'WAIT':
      return false // Always re-evaluate

    // Town goals
    case 'SELL_TO_MERCHANT':
      // Valid while in town, have unvisited sell shops, and still have items to sell
      if (!isInTown(game)) return false
      // Check if we've visited all relevant shops for selling
      return selectShopForSelling(game, botState) !== null

    case 'VISIT_HEALER':
      // Valid while in town and not yet healed
      return isInTown(game) && !botState.healerVisited && game.character.hp < game.character.maxHp

    case 'BUY_FROM_MERCHANT':
      // Valid while in town and have unvisited buy shops
      if (!isInTown(game)) return false
      return selectShopForBuying(game, botState) !== null

    case 'RETURN_PORTAL':
      // Valid while in town and portal exists
      return isInTown(game) && game.townPortal !== null

    case 'EXIT_TOWN':
      // Valid while in town (fallback when no portal)
      return isInTown(game)

    default:
      return false
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

  // No combat overrides in town - town goals handle everything
  if (isInTown(game)) {
    return null
  }

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
// TOWN GOAL SELECTION
// ============================================================================

/**
 * Select the appropriate shop for selling based on inventory contents
 *
 * Priority:
 * 1. Has weapons/bows? → town_weapons (better sell multiplier)
 * 2. Has armor? → town_armory
 * 3. Anything else? → town_general
 */
function selectShopForSelling(game: GameState, botState: BotState): TownShopId | null {
  const inventory = game.character.inventory
  const sellableItems = inventory.filter(item =>
    item.template.type !== 'potion' && item.template.type !== 'scroll'
  )

  // No items to sell
  if (sellableItems.length === 0) return null

  // Check what types of items we have
  const hasWeapons = sellableItems.some(item =>
    item.template.type === 'weapon' || item.template.type === 'bow'
  )
  const hasArmor = sellableItems.some(item =>
    ['armor', 'shield', 'helm', 'gloves', 'boots'].includes(item.template.type)
  )

  // Visit appropriate shops in order of value
  if (hasWeapons && !botState.shopsVisitedForSelling.has('town_weapons')) {
    return 'town_weapons'
  }
  if (hasArmor && !botState.shopsVisitedForSelling.has('town_armory')) {
    return 'town_armory'
  }
  if (!botState.shopsVisitedForSelling.has('town_general')) {
    return 'town_general'
  }

  return null
}

/**
 * Select the appropriate shop for buying based on character needs
 *
 * Priority:
 * 1. Need Town Portal (< 2)? → town_magic
 * 2. Need healing potions (< 3)? → town_alchemy
 * 3. Need escape scrolls (< 3)? → town_magic (if not visited for TP)
 */
function selectShopForBuying(game: GameState, botState: BotState): TownShopId | null {
  const inventory = game.character.inventory

  // Count consumables
  const tpCount = inventory.filter(item =>
    item.template.name === 'Scroll of Town Portal'
  ).length
  const healCount = inventory.filter(item =>
    item.template.name.includes('Cure') || item.template.name.includes('Healing')
  ).length
  const escapeCount = inventory.filter(item =>
    item.template.name.includes('Phase Door') || item.template.name.includes('Teleportation')
  ).length

  // Need Town Portal scrolls (primary escape)
  if (tpCount < 2 && !botState.shopsVisitedForBuying.has('town_magic')) {
    return 'town_magic'
  }

  // Need healing potions
  if (healCount < 3 && !botState.shopsVisitedForBuying.has('town_alchemy')) {
    return 'town_alchemy'
  }

  // Need escape scrolls (secondary)
  if (escapeCount < 3 && !botState.shopsVisitedForBuying.has('town_magic')) {
    return 'town_magic'
  }

  return null
}

/**
 * Select the appropriate town goal based on current state
 *
 * Town behavior priority (economically optimal):
 * 1. SELL_TO_MERCHANT - Sell loot at appropriate shops
 * 2. VISIT_HEALER - Heal with gold from selling
 * 3. BUY_FROM_MERCHANT - Buy consumables from appropriate shops
 * 4. RETURN_PORTAL - Return through active portal
 * 5. EXIT_TOWN - Fallback: use dungeon entrance
 */
function selectTownGoal(
  context: BotContext,
  botState: BotState,
  hpRatio: number
): BotGoal | null {
  const { game } = context
  const turn = game.turn

  // 1. Sell items first to get gold for healing
  const sellShop = selectShopForSelling(game, botState)
  if (sellShop) {
    const position = TOWN_SHOP_POSITIONS[sellShop]
    return {
      type: 'SELL_TO_MERCHANT',
      target: { ...position },
      targetId: sellShop,
      reason: `Selling loot at ${sellShop.replace('town_', '')}`,
      startTurn: turn,
    }
  }

  // 2. Visit healer if HP is not full and haven't visited yet
  // healerVisited is set when we reach the healer, regardless of heal outcome
  // This prevents getting stuck if we can't afford a full heal
  if (!botState.healerVisited && hpRatio < 1.0) {
    return {
      type: 'VISIT_HEALER',
      target: { ...HEALER_POSITION },
      targetId: null,
      reason: `Going to healer (HP: ${Math.round(hpRatio * 100)}%)`,
      startTurn: turn,
    }
  }

  // 3. Buy from appropriate shops after healing
  const buyShop = selectShopForBuying(game, botState)
  if (buyShop) {
    const position = TOWN_SHOP_POSITIONS[buyShop]
    return {
      type: 'BUY_FROM_MERCHANT',
      target: { ...position },
      targetId: buyShop,
      reason: `Buying supplies at ${buyShop.replace('town_', '')}`,
      startTurn: turn,
    }
  }

  // 4. Return through portal if active
  if (game.townPortal) {
    return {
      type: 'RETURN_PORTAL',
      target: { ...game.townPortal.townPosition },
      targetId: null,
      reason: `Returning through portal (${game.townPortal.turnsRemaining} turns left)`,
      startTurn: turn,
    }
  }

  // 5. Exit town via dungeon entrance (fallback)
  return {
    type: 'EXIT_TOWN',
    target: { ...DUNGEON_ENTRANCE_POSITION },
    targetId: null,
    reason: 'Exiting town',
    startTurn: turn,
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export { GOAL_PRIORITY, GOAL_REEVALUATE_INTERVAL }
