/**
 * Goal Evaluators
 *
 * Individual goal evaluation functions extracted from goals.ts.
 * Each evaluator determines if a specific goal type should be pursued.
 */

import type { GroundItem } from '../types'
import type { BotGoal, BotContext, DangerMap } from './types'
import { SQUISHY_CLASSES } from './types'
import { getTile } from '../dungeon'
import { getLocalDanger } from './danger'
import { isSamePosition } from './movement'
import { selectTarget, shouldEngage, findAdjacentMonster, hasRangedWeapon, findBestRangedTarget, findKitePosition, selectTargetForClass, findClosestMonster, getClosestMonsterDistance } from './combat'
import { getBowRange, canRangedAttack } from '../combat'
import { shouldRetreat, findBestEscapeRoute } from './survival'
import { computeSafetyFlow } from './safety-flow'
import { evaluateItem, shouldPickup } from './items'
import { countHealingPotions } from './merchant'
import { evaluateSweep } from './farming'
import {
  findExplorationTarget,
  findLabyrinthExplorationTarget,
  isLabyrinthLevel,
  resetCorridorFollowing,
} from './exploration'
import { getUniqueBlocker } from './preparation'
import { monsters as MONSTERS } from '../data/monsters'

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

  // Exit corridor-following mode when fleeing
  resetCorridorFollowing(botState)

  // Try safety flow first (inverted Dijkstra for global escape planning)
  const nearbyMonsters = game.monsters.filter(m => {
    if (m.hp <= 0) return false
    const dx = Math.abs(m.position.x - game.character.position.x)
    const dy = Math.abs(m.position.y - game.character.position.y)
    return dx <= 10 && dy <= 10
  })

  if (nearbyMonsters.length > 0) {
    const safetyResult = computeSafetyFlow(
      game.currentLevel,
      nearbyMonsters,
      game.character.position,
      game.turn
    )

    if (safetyResult.target) {
      // Cache for debugging
      botState.cachedSafetyFlow = safetyResult

      return {
        type: 'FLEE',
        target: safetyResult.target,
        targetId: null,
        reason: `${retreatEval.reason} (safety flow)`,
        startTurn: game.turn,
      }
    }
  }

  // Fallback to old escape route logic
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
// KITE EVALUATOR (RANGED COMBAT)
// ============================================================================

/**
 * Evaluate KITE goal - proactive ranged combat positioning
 *
 * For ranged classes with a bow equipped:
 * - distance < optimal → KITE goal to reposition away
 * - distance == optimal (within shooting range) → KITE goal to shoot from here
 * - distance > bowRange → return null (let KILL approach to optimal range)
 *
 * This is the primary combat goal for ranged classes, evaluated BEFORE KILL.
 */
export function evaluateKite(
  context: BotContext,
  _dangers: DangerMap,
  _dangerThreshold: number
): BotGoal | null {
  const { game, classProfile, visibleMonsters } = context
  const character = game.character
  const pos = character.position

  // Only for ranged classes
  if (!classProfile.prefersRanged) return null

  // Need ranged weapon and visible targets
  if (!hasRangedWeapon(game)) return null
  if (visibleMonsters.length === 0) return null

  const bowRange = getBowRange(character)
  const optimalRange = classProfile.engageDistance || 3

  // Find closest visible monster to evaluate positioning
  const closest = findClosestMonster(visibleMonsters, pos)
  if (!closest) return null

  const closestMonster = closest.monster
  const closestDist = closest.distance

  // Case 1: Too far to shoot - let KILL goal handle approach
  if (closestDist > bowRange) {
    return null
  }

  // Case 2: Too close - need to kite away
  if (closestDist < optimalRange) {
    const kiteDirection = findKitePosition(game, closestMonster, classProfile)

    if (kiteDirection) {
      // Calculate the position we'd move to
      const dx = kiteDirection === 'e' || kiteDirection === 'ne' || kiteDirection === 'se' ? 1 :
                 kiteDirection === 'w' || kiteDirection === 'nw' || kiteDirection === 'sw' ? -1 : 0
      const dy = kiteDirection === 's' || kiteDirection === 'se' || kiteDirection === 'sw' ? 1 :
                 kiteDirection === 'n' || kiteDirection === 'ne' || kiteDirection === 'nw' ? -1 : 0
      const newPos = { x: pos.x + dx, y: pos.y + dy }

      return {
        type: 'KITE',
        target: newPos,
        targetId: closestMonster.id,
        reason: `Kiting away from ${closestMonster.template.name} (dist ${closestDist})`,
        startTurn: game.turn,
      }
    }

    // Can't kite away - if we can still shoot (dist >= 2), shoot
    if (closestDist >= 2 && canRangedAttack(character, closestMonster.position)) {
      return {
        type: 'KITE',
        target: closestMonster.position,
        targetId: closestMonster.id,
        reason: `Shooting ${closestMonster.template.name} (can't kite)`,
        startTurn: game.turn,
      }
    }

    // Adjacent and can't kite - let melee handle it
    return null
  }

  // Case 3: At or beyond optimal range but within bow range - shoot!
  // Find best target to shoot at (might be different from closest)
  const target = findBestRangedTarget(game, visibleMonsters)
  if (target && canRangedAttack(character, target.position)) {
    return {
      type: 'KITE',
      target: target.position,
      targetId: target.id,
      reason: `Shooting ${target.template.name} at range`,
      startTurn: game.turn,
    }
  }

  return null
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
 *
 * Creates KILL goals for:
 * 1. Adjacent monsters (always, for any class)
 * 2. Close monsters within engagement range (bypass shouldEngage for nearby threats)
 * 3. Distant monsters if shouldEngage approves
 *
 * For ranged classes: Don't create KILL goal if already at shooting range.
 * Let KITE handle shooting - KILL is for approaching distant targets.
 */
export function evaluateKill(
  context: BotContext,
  hpRatio: number
): BotGoal | null {
  const { game, config, botState, visibleMonsters, classProfile } = context
  const pos = game.character.position
  const character = game.character

  // Check for adjacent monster first (always attack, any class)
  const adjacentMonster = findAdjacentMonster(game)
  if (adjacentMonster) {
    // Exit corridor-following mode when in combat
    resetCorridorFollowing(botState)
    return {
      type: 'KILL',
      target: adjacentMonster.position,
      targetId: adjacentMonster.id,
      reason: 'Adjacent monster',
      startTurn: game.turn,
    }
  }

  // For ranged classes with a bow: check if we should let KITE handle this
  if (classProfile.prefersRanged && hasRangedWeapon(game) && visibleMonsters.length > 0) {
    const bowRange = getBowRange(character)

    // Find distance to closest visible monster
    const closestDist = getClosestMonsterDistance(visibleMonsters, pos)

    // If already within shooting range (dist >= 2 and <= bowRange), let KITE handle it
    if (closestDist >= 2 && closestDist <= bowRange) {
      return null // KITE goal will handle shooting
    }
  }

  // For close monsters (within 4 tiles), always create KILL goal to approach
  // This prevents the "stuck at distance 2" bug where bot won't close the gap
  // Exception: critically low HP (< 25%) should still flee instead
  const CLOSE_ENGAGEMENT_RANGE = 4
  if (visibleMonsters.length > 0 && hpRatio >= 0.25) {
    const closest = findClosestMonster(visibleMonsters, pos)

    // If monster is close, engage without shouldEngage check
    // For ranged classes, this means approaching to get in range
    if (closest && closest.distance <= CLOSE_ENGAGEMENT_RANGE) {
      resetCorridorFollowing(botState)
      return {
        type: 'KILL',
        target: closest.monster.position,
        targetId: closest.monster.id,
        reason: `Engaging nearby ${closest.monster.template.name}`,
        startTurn: game.turn,
      }
    }
  }

  // For distant monsters, use full shouldEngage evaluation
  // Use class-aware target selection for better scoring
  const targetSelection = classProfile.prefersRanged
    ? selectTargetForClass(context, classProfile, false)
    : selectTarget(context, false)
  if (!targetSelection) return null

  // Check if we should engage this target
  if (!shouldEngage(game, targetSelection.target, config)) {
    return null
  }

  // Exit corridor-following mode when hunting
  resetCorridorFollowing(botState)

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
// EXPLORE EVALUATOR
// ============================================================================

/**
 * Evaluate EXPLORE goal - find unexplored areas
 * Uses labyrinth-aware exploration for maze levels
 * Delegates to sweep exploration for casters in sweepMode
 */
export function evaluateExplore(context: BotContext): BotGoal | null {
  const { game, unexploredTiles, botState } = context
  const character = game.character

  // Caster sweep mode: when active, use sweep exploration instead of frontier
  if (botState.sweepMode && SQUISHY_CLASSES.has(character.classId)) {
    return evaluateSweep(context)
  }

  if (unexploredTiles.length === 0) return null

  let target

  if (USE_EXPLORATION_MODULE) {
    // Use labyrinth-aware exploration for maze levels
    if (isLabyrinthLevel(game)) {
      target = findLabyrinthExplorationTarget(game, botState)
    } else {
      // Standard exploration for other level types
      // Reset corridor-following if we were in a labyrinth before
      resetCorridorFollowing(botState)
      target = findExplorationTarget(game, botState)
    }
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
    reason: isLabyrinthLevel(game) ? 'Exploring labyrinth' : 'Exploring dungeon',
    startTurn: game.turn,
  }
}

// ============================================================================
// HUNT_UNIQUE EVALUATOR
// ============================================================================

/**
 * Evaluate HUNT_UNIQUE goal - hunt unique monsters blocking descent
 *
 * If 2+ living uniques block descent to next depth, create a goal to hunt
 * the one on the current level (if visible/known).
 */
export function evaluateHuntUnique(context: BotContext): BotGoal | null {
  const { game, visibleMonsters } = context
  const character = game.character
  const nextDepth = character.depth + 1

  // Check for unique blocker
  const uniqueBlocker = getUniqueBlocker(
    character.depth,
    nextDepth,
    game.uniqueState,
    MONSTERS
  )

  if (!uniqueBlocker) return null

  // Check if the blocking unique is visible on current level
  const uniqueMonster = visibleMonsters.find(m =>
    m.template.name === uniqueBlocker &&
    m.template.flags?.includes('UNIQUE') &&
    m.hp > 0
  )

  if (uniqueMonster) {
    return {
      type: 'HUNT_UNIQUE',
      target: uniqueMonster.position,
      targetId: uniqueMonster.id,
      reason: `Hunting ${uniqueBlocker} to unlock descent`,
      startTurn: game.turn,
    }
  }

  // Unique exists but not visible - explore to find it
  // This falls through to EXPLORE goal
  return null
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

// ============================================================================
// ALTAR EVALUATOR
// ============================================================================

/** Minimum gold buffer to keep for emergencies (potions, escapes) */
const ALTAR_GOLD_BUFFER = 300

/**
 * Evaluate USE_ALTAR goal - use dungeon altars for benefits
 *
 * Priority order:
 * 1. Enchantment Altar (200g) - +1 to weapon, best gold sink
 * 2. Blessing Altar (50g) - Full heal + mana restore
 * 3. Knowledge Altar (25g) - Identify all items
 *
 * Only uses altar if:
 * - Can afford the cost AND maintain gold buffer
 * - The altar's effect would be beneficial
 * - No monsters visible (safe to interact)
 */
export function evaluateUseAltar(
  context: BotContext,
  dangerThreshold: number,
  localDanger: number
): BotGoal | null {
  const { game, visibleAltars, visibleMonsters } = context
  const character = game.character

  // Don't use altars if monsters are visible
  if (visibleMonsters.length > 0) return null

  // Don't use altars if in danger
  if (localDanger > dangerThreshold * 0.3) return null

  // No altars visible
  if (visibleAltars.length === 0) return null

  // Evaluate each visible altar
  let bestAltar = null
  let bestPriority = -1
  let bestReason = ''

  for (const altar of visibleAltars) {
    const template = altar.template
    const cost = template.cost

    // Can we afford this altar while keeping buffer?
    if (character.gold < cost + ALTAR_GOLD_BUFFER) continue

    // Evaluate based on altar type
    let priority = 0
    let reason = ''

    switch (template.effect) {
      case 'enchant': {
        // Enchantment altar: +1 to weapon
        // Highest priority gold sink - always use if affordable
        const weapon = character.equipment.weapon
        if (weapon) {
          // Higher priority for lower enchantment (bigger relative gain)
          priority = 100 - weapon.enchantment * 5
          reason = `Enchanting ${weapon.template.name} (+${weapon.enchantment} → +${weapon.enchantment + 1})`
        }
        break
      }

      case 'bless': {
        // Blessing altar: Full heal + mana
        // Use if HP < 70% or MP < 50%
        const hpRatio = character.hp / character.maxHp
        const mpRatio = character.maxMp > 0 ? character.mp / character.maxMp : 1
        if (hpRatio < 0.7 || mpRatio < 0.5) {
          priority = 50
          reason = `Blessing (HP: ${Math.round(hpRatio * 100)}%, MP: ${Math.round(mpRatio * 100)}%)`
        }
        break
      }

      case 'identify': {
        // Knowledge altar: Identify all items
        // Use if we have 3+ unidentified items
        const unidentifiedCount = character.inventory.filter(item => !item.identified).length
        if (unidentifiedCount >= 3) {
          priority = 20
          reason = `Identifying ${unidentifiedCount} items`
        }
        break
      }

      case 'curse_remove': {
        // Purification altar: Remove curses
        // Skip for now - curses not implemented
        break
      }
    }

    if (priority > bestPriority) {
      bestPriority = priority
      bestAltar = altar
      bestReason = reason
    }
  }

  if (!bestAltar || bestPriority <= 0) return null

  return {
    type: 'USE_ALTAR',
    target: bestAltar.position,
    targetId: bestAltar.template.id,
    reason: bestReason,
    startTurn: game.turn,
  }
}

// ============================================================================
// VISIT MERCHANT EVALUATOR (Dungeon Merchants)
// ============================================================================

/**
 * Evaluate VISIT_MERCHANT goal - visit dungeon merchants for supplies/gear
 *
 * Priority scoring:
 * - Shady Dealer (black market) - highest priority for T3-4 gear
 * - Alchemist - high priority if low on healing potions
 * - Weapon/Armor dealers - moderate priority if gold available
 * - General/Mixed - low priority for general supplies
 *
 * Only visits when:
 * - No monsters visible (safe to shop)
 * - Low danger level
 * - Not in town (town has its own shop goals)
 */
export function evaluateVisitMerchant(
  context: BotContext,
  dangerThreshold: number,
  localDanger: number
): BotGoal | null {
  const { game, visibleMerchants, visibleMonsters } = context
  const character = game.character

  // Safety checks
  if (visibleMonsters.length > 0) return null
  if (localDanger > dangerThreshold * 0.3) return null
  if (visibleMerchants.length === 0) return null
  if (game.character.depth === 0) return null  // Town handled separately

  // Score each merchant
  let bestMerchant = null
  let bestScore = 0
  let bestReason = ''

  for (const merchant of visibleMerchants) {
    let score = 0
    let reason = ''

    // Shady Dealer (black market) - highest priority for late-game gear
    if (merchant.template.id === 'black_market') {
      // High priority if we have gold for T3-4 gear
      if (character.gold > 500) {
        score = 100
        reason = 'Black market (T3-4 gear)'
      }
    }
    // Alchemist - if low on healing
    else if (merchant.template.shopType === 'potion') {
      const healingCount = countHealingPotions(character)
      if (healingCount < 3) {
        score = 60
        reason = 'Need healing potions'
      } else if (character.gold > 300) {
        score = 20
        reason = 'Checking potion supplies'
      }
    }
    // Weapon/Armor dealers - if gold available
    else if (merchant.template.shopType === 'weapon' || merchant.template.shopType === 'armor') {
      if (character.gold > 500) {
        score = 40
        reason = `Checking ${merchant.template.shopType} upgrades`
      }
    }
    // Scroll merchant - if need escape/utility scrolls
    else if (merchant.template.shopType === 'scroll') {
      if (character.gold > 200) {
        score = 35
        reason = 'Checking scroll supplies'
      }
    }
    // Mixed/general - moderate priority
    else {
      if (character.gold > 200) {
        score = 20
        reason = 'General supplies'
      }
    }

    if (score > bestScore) {
      bestScore = score
      bestMerchant = merchant
      bestReason = reason
    }
  }

  if (!bestMerchant || bestScore <= 0) return null

  return {
    type: 'VISIT_MERCHANT',
    target: bestMerchant.position,
    targetId: bestMerchant.template.id,
    reason: bestReason,
    startTurn: game.turn,
  }
}