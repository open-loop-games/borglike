/**
 * Goal Evaluators
 *
 * Individual goal evaluation functions extracted from goals.ts.
 * Each evaluator determines if a specific goal type should be pursued.
 */

import type { GroundItem, Point } from '../types'
import type { BotState, BotGoal, BotContext, DangerMap } from './types'
import { getTile } from '../dungeon'
import { getLocalDanger } from './danger'
import { isSamePosition } from './movement'
import { selectTarget, shouldEngage, findAdjacentMonster, hasRangedWeapon, findBestRangedTarget, findKitePosition, selectTargetForClass } from './combat'
import { getBowRange, canRangedAttack } from '../combat'
import { shouldRetreat, findBestEscapeRoute } from './survival'
import { computeSafetyFlow } from './safety-flow'
import { evaluateItem, shouldPickup } from './items'
import { countHealingPotions } from './merchant'
import {
  findExplorationTarget as findExploreTarget,
  findLabyrinthExplorationTarget,
  isLabyrinthLevel,
  getLabyrinthExplorationThreshold,
  getExplorationProgress,
  resetCorridorFollowing,
} from './exploration'
import {
  getDepthReadiness,
  getUniqueBlocker,
  getGoldTarget,
  isUnderLeveled,
  getEffectiveGold,
} from './preparation'
import { findTownPortalScroll } from './items'
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
  let closestMonster = visibleMonsters[0]
  let closestDist = Infinity

  for (const monster of visibleMonsters) {
    if (monster.hp <= 0) continue
    const dx = Math.abs(monster.position.x - pos.x)
    const dy = Math.abs(monster.position.y - pos.y)
    const dist = Math.max(dx, dy)
    if (dist < closestDist) {
      closestDist = dist
      closestMonster = monster
    }
  }

  if (!closestMonster) return null

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

    // Find closest visible monster
    let closestDist = Infinity
    for (const monster of visibleMonsters) {
      if (monster.hp <= 0) continue
      const dist = Math.max(
        Math.abs(monster.position.x - pos.x),
        Math.abs(monster.position.y - pos.y)
      )
      if (dist < closestDist) {
        closestDist = dist
      }
    }

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
    // Find closest visible monster
    let closestMonster = visibleMonsters[0]
    let closestDist = Infinity

    for (const monster of visibleMonsters) {
      if (monster.hp <= 0) continue
      const dist = Math.max(
        Math.abs(monster.position.x - pos.x),
        Math.abs(monster.position.y - pos.y)
      )
      if (dist < closestDist) {
        closestDist = dist
        closestMonster = monster
      }
    }

    // If monster is close, engage without shouldEngage check
    // For ranged classes, this means approaching to get in range
    if (closestMonster && closestDist <= CLOSE_ENGAGEMENT_RANGE) {
      resetCorridorFollowing(botState)
      return {
        type: 'KILL',
        target: closestMonster.position,
        targetId: closestMonster.id,
        reason: `Engaging nearby ${closestMonster.template.name}`,
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
// DESCEND EVALUATOR
// ============================================================================

/**
 * Evaluate DESCEND goal - go to next level
 *
 * Gates descent on:
 * 1. Known stairs location
 * 2. Unique blockers (2+ living uniques in depth range)
 * 3. Consumable readiness (healing, escapes, town portals)
 * 4. Exploration threshold or patience exceeded
 *
 * Uses lower exploration threshold for labyrinths (dead ends aren't worth exploring)
 */
export function evaluateDescend(context: BotContext, botState: BotState): BotGoal | null {
  const { game, config, effectiveConfig } = context
  const character = game.character

  // Need to know where stairs are
  if (!botState.knownStairsDown) return null

  const nextDepth = character.depth + 1

  // Check unique blockers (2+ living uniques blocks descent)
  const uniqueBlocker = getUniqueBlocker(
    character.depth,
    nextDepth,
    game.uniqueState,
    MONSTERS
  )
  if (uniqueBlocker) {
    // Don't descend - should hunt unique instead
    return null
  }

  // Check consumable readiness (scaled by personality caution)
  // Aggressive bots (low caution) can descend under-prepared
  // Cautious bots need more supplies before going deeper
  const readinessIssue = getDepthReadiness(
    character,
    character.inventory,
    nextDepth,
    effectiveConfig.caution
  )
  if (readinessIssue) {
    // Descent blocked - initiate farming loop
    // Priority: TOWN_TRIP > ASCEND_TO_FARM > FARM > (fall through to EXPLORE)

    const goldTarget = getGoldTarget(nextDepth, effectiveConfig.caution)

    // 1. If ready for town trip (gold + level), use portal
    const townTrip = evaluateTownTrip(context)
    if (townTrip) return townTrip

    // 2. If under-leveled, ascend to farm easier content
    const ascend = evaluateAscendToFarm(context)
    if (ascend) return ascend

    // 3. Farm on current level for gold/XP
    const farm = evaluateFarm(context, goldTarget)
    if (farm) return farm

    // 4. Fall through - EXPLORE will find more monsters/items
    return null
  }

  // Check if ready to descend (exploration or patience)
  const explorationProgress = getExplorationProgress(game)

  // Labyrinths use lower exploration threshold
  const explorationThreshold = isLabyrinthLevel(game)
    ? getLabyrinthExplorationThreshold(config.exploration)
    : config.exploration

  const shouldDescend =
    explorationProgress >= explorationThreshold ||
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
 * Uses labyrinth-aware exploration for maze levels
 */
export function evaluateExplore(context: BotContext): BotGoal | null {
  const { game, unexploredTiles, botState } = context

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
      target = findExploreTarget(game, botState)
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

// ============================================================================
// FARMING LOOP EVALUATORS
// ============================================================================

/**
 * Evaluate FARM goal - stay on level, prioritize kills/loot to gather gold
 *
 * FARM is activated when descent is blocked by consumable requirements.
 * Bot kills monsters and collects items to accumulate gold for a town trip.
 *
 * Target selection:
 * 1. Nearest visible monster (gold from kills)
 * 2. Nearest valuable item (sell value)
 * 3. Falls through to EXPLORE if nothing visible
 */
export function evaluateFarm(
  context: BotContext,
  goldTarget: number
): BotGoal | null {
  const { game, botState, visibleMonsters, visibleItems } = context
  const character = game.character
  const pos = character.position

  // Already have enough effective gold (gold + equipment sell value)? Don't need to farm
  if (getEffectiveGold(character) >= goldTarget) return null

  // Under-leveled for this depth? Should ascend, not farm here
  if (isUnderLeveled(character.level, character.depth)) return null

  // Set farming state
  botState.farmingMode = true
  botState.farmGoldTarget = goldTarget
  if (botState.farmStartTurn === 0) {
    botState.farmStartTurn = game.turn
  }

  // Priority 1: Nearest visible monster (gold from kills)
  if (visibleMonsters.length > 0) {
    let closest = visibleMonsters[0]!
    let closestDist = Infinity

    for (const monster of visibleMonsters) {
      if (monster.hp <= 0) continue
      const dist = Math.abs(monster.position.x - pos.x) + Math.abs(monster.position.y - pos.y)
      if (dist < closestDist) {
        closestDist = dist
        closest = monster
      }
    }

    return {
      type: 'FARM',
      target: closest.position,
      targetId: closest.id,
      reason: `Farming ${closest.template.name} (${character.gold}/${goldTarget}g)`,
      startTurn: game.turn,
    }
  }

  // Priority 2: Nearest valuable item (sell value)
  // Use larger radius than normal TAKE - we want all loot
  const farmableItems = visibleItems.filter(item => {
    // Skip consumables we want to keep
    if (item.template.type === 'potion' || item.template.type === 'scroll') {
      return false
    }
    return true
  })

  if (farmableItems.length > 0) {
    let closest = farmableItems[0]!
    let closestDist = Infinity

    for (const item of farmableItems) {
      const dist = Math.abs(item.position.x - pos.x) + Math.abs(item.position.y - pos.y)
      if (dist < closestDist) {
        closestDist = dist
        closest = item
      }
    }

    return {
      type: 'FARM',
      target: closest.position,
      targetId: closest.id,
      reason: `Farming ${closest.template.name} (${character.gold}/${goldTarget}g)`,
      startTurn: game.turn,
    }
  }

  // Nothing visible to farm - fall through to EXPLORE
  // EXPLORE will find more monsters/items
  return null
}

/**
 * Check if enough tiles are explored within a radius of a point.
 * Used for tethered exploration - must explore 80% of tiles in radius.
 */
function isTetheredExplorationComplete(context: BotContext, origin: Point, radius: number): boolean {
  const { game } = context
  const level = game.currentLevel

  let totalFloor = 0
  let exploredFloor = 0

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const x = origin.x + dx
      const y = origin.y + dy
      if (x < 0 || x >= level.width || y < 0 || y >= level.height) continue

      const tile = getTile(level, x, y)
      if (!tile || tile.type === 'wall') continue

      totalFloor++
      if (tile.explored) exploredFloor++
    }
  }

  // Need 80% explored to be "done" with this tether
  return totalFloor === 0 || (exploredFloor / totalFloor) >= 0.8
}

/** Tethered exploration radii: first flip = 2 (5x5), second = 4 (9x9) */
const TETHER_RADII = [2, 4]

/**
 * Evaluate ASCEND_TO_FARM goal - go up to easier levels when under-leveled
 *
 * Triggered when character level < depth (1:1 ratio).
 * Going up means easier monsters = safer farming = faster gold/XP.
 *
 * Tethered exploration: After each flip, must explore around the stairs
 * before flipping again. Radius increases: 5x5 → 9x9 → allow flip.
 */
export function evaluateAscendToFarm(context: BotContext): BotGoal | null {
  const { game, botState } = context
  const character = game.character

  // Can't ascend from depth 1
  if (character.depth <= 1) return null

  // Only ascend if under-leveled (level < depth)
  if (!isUnderLeveled(character.level, character.depth)) return null

  // Need known stairs up (set when we descended to this level)
  const stairsUp = botState.knownStairsUp
  if (!stairsUp) return null

  // Tethered exploration check: must explore around stairs before flipping again
  // Origin is set by tick.ts after each level change
  if (botState.tetheredRadius > 0 && botState.tetheredOrigin) {
    const done = isTetheredExplorationComplete(context, botState.tetheredOrigin, botState.tetheredRadius)
    if (!done) {
      // Not done exploring - don't allow ascent yet
      // Let FARM/EXPLORE continue
      return null
    }
    // Done exploring this radius - set next radius for after this flip
    botState.tetheredFlipCount++
    if (botState.tetheredFlipCount < TETHER_RADII.length) {
      botState.tetheredRadius = TETHER_RADII[botState.tetheredFlipCount]!
    } else {
      // Done with tether cycle, reset for next cycle
      botState.tetheredRadius = 0
      botState.tetheredFlipCount = 0
    }
  } else if (botState.farmingMode && botState.tetheredRadius === 0) {
    // Starting a new tether cycle - set initial radius for after this flip
    botState.tetheredRadius = TETHER_RADII[0]!
    botState.tetheredFlipCount = 0
  }

  // Check if previous level is in cache (ascend will fail without it)
  const prevDepth = character.depth - 1
  if (!game.levelCache.has(prevDepth)) {
    // Previous level evicted from cache - can't ascend
    // Bot should explore/farm current level or descend to rebuild cache
    return null
  }

  return {
    type: 'ASCEND_TO_FARM',
    target: stairsUp,
    targetId: null,
    reason: `Under-leveled (L${character.level} at D${character.depth}), ascending to farm`,
    startTurn: game.turn,
  }
}

/**
 * Evaluate TOWN_TRIP goal - use town portal when ready for shopping
 *
 * Triggered when:
 * - Gold >= target (can afford consumables)
 * - Level >= depth (not under-leveled, ready for town loop)
 * - Have a town portal scroll
 * - Not already in town
 */
export function evaluateTownTrip(context: BotContext): BotGoal | null {
  const { game, effectiveConfig, botState } = context
  const character = game.character

  // Already in town? Don't need this goal
  if (character.depth === 0) return null

  // Don't use if portal already active (we should use RETURN_PORTAL instead)
  if (game.townPortal) return null

  // Check if we have a town portal scroll
  const tpScroll = findTownPortalScroll(character)
  if (!tpScroll) return null

  // Calculate targets
  const goldTarget = getGoldTarget(character.depth + 1, effectiveConfig.caution)
  const levelTarget = character.depth // 1:1 ratio

  // Ready for town trip? Check effective gold (includes equipment sell value)
  const hasGold = getEffectiveGold(character) >= goldTarget
  const hasLevel = character.level >= levelTarget

  if (hasGold && hasLevel) {
    // Clear farming mode - we're done farming
    botState.farmingMode = false
    botState.farmGoldTarget = 0
    botState.farmStartTurn = 0
    // Clear tethered exploration state
    botState.tetheredOrigin = null
    botState.tetheredRadius = 0
    botState.tetheredFlipCount = 0

    return {
      type: 'TOWN_TRIP',
      target: character.position, // Use portal at current position
      targetId: tpScroll.id,
      reason: `Town trip ready (${character.gold}g, L${character.level})`,
      startTurn: game.turn,
    }
  }

  return null
}