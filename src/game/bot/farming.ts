/**
 * Farming Domain
 *
 * Handles resource acquisition through tethered exploration and farming loops.
 * Used when descent is blocked by consumable requirements.
 *
 * Key concepts:
 * - Tethered mode: Exploring within radius of stairs to trigger spawns
 * - Farming loop: Yo-yo between depths to accumulate gold/XP
 * - Town trips: Portal to town when ready to restock
 */

import type { Point, GameState, Tile, Character } from '../types'
import type { BotState, BotGoal, BotContext } from './types'
import { getEffectiveCapabilities, seenGridHas } from './types'
import type { SeenGrid } from './types'
import { MAX_DEPTH } from '../types'
import { getTile } from '../dungeon'
import type { FlowGrid } from './flow'
import { computeFlow, getFlowCost, MAX_FLOW_COST } from './flow'
import { profile } from './profiler'
import { getDepthReadiness, getGoldTarget, isUnderLeveled, getEffectiveGold } from './preparation'
import { findTownPortalScroll } from './items'

// ============================================================================
// HELPERS - Stair Access
// ============================================================================

/**
 * Get stairs down, preferring known location over level default.
 * Falls back to current position if standing on stairs_down.
 */
export function getStairsDown(context: BotContext): Point | null {
  const { game, botState } = context
  const stairs = botState.knownStairsDown ?? game.currentLevel.stairsDown
  if (stairs) return stairs

  // Fallback: check if standing on stairs_down
  const pos = game.character.position
  const tile = getTile(game.currentLevel, pos.x, pos.y)
  if (tile?.type === 'stairs_down') return pos
  return null
}

/**
 * Get stairs up, preferring known location over level default.
 * Falls back to current position if standing on stairs_up.
 */
export function getStairsUp(context: BotContext): Point | null {
  const { game, botState } = context
  const stairs = botState.knownStairsUp ?? game.currentLevel.stairsUp
  if (stairs) return stairs

  // Fallback: check if standing on stairs_up
  const pos = game.character.position
  const tile = getTile(game.currentLevel, pos.x, pos.y)
  if (tile?.type === 'stairs_up') return pos
  return null
}

// ============================================================================
// HELPERS - Goal Factories
// ============================================================================

/**
 * Create a DESCEND goal to the given stairs.
 */
function makeDescendGoal(game: GameState, target: Point, reason: string): BotGoal {
  return {
    type: 'DESCEND',
    target,
    targetId: null,
    reason,
    startTurn: game.turn,
  }
}

/**
 * Create an ASCEND_TO_FARM goal to the given stairs.
 */
function makeAscendGoal(game: GameState, target: Point, reason: string): BotGoal {
  return {
    type: 'ASCEND_TO_FARM',
    target,
    targetId: null,
    reason,
    startTurn: game.turn,
  }
}

/**
 * Get navigation goal to reach a target depth via stairs.
 * Returns DESCEND if below target, ASCEND if above, null if at target.
 * Exported for use by progression.ts for Morgoth flip.
 */
export function getFlipNavigationGoal(
  context: BotContext,
  targetDepth: number,
  deeperDepth: number,
  reason: string
): BotGoal | null {
  const { game } = context
  const currentDepth = game.character.depth

  // At target - navigation complete
  if (currentDepth === targetDepth) return null

  // Below target (closer to surface) - descend
  if (currentDepth < targetDepth) {
    const stairs = getStairsDown(context)
    if (!stairs) return null
    return makeDescendGoal(game, stairs, reason)
  }

  // Above target (deeper) - ascend
  if (currentDepth > targetDepth && currentDepth <= deeperDepth) {
    const stairs = getStairsUp(context)
    if (!stairs) return null
    return makeAscendGoal(game, stairs, reason)
  }

  return null
}

// ============================================================================
// CONSTANTS

/**
 * Get available tether radii based on surf upgrade level.
 * L0: No tethering (face-rush only)
 * L1: 5×5 area
 * L2: 5×5 → 9×9
 * L3: 5×5 → 9×9 → 21×21
 */
export function getTetherRadii(surfLevel: number): readonly number[] {
  switch (surfLevel) {
    case 0:
      return []
    case 1:
      return [2]
    case 2:
      return [2, 4]
    case 3:
    default:
      return [2, 4, 10]
  }
}

/**
 * Check if character level is within surf level range.
 * {0, 0} = always eligible (default, no restriction).
 */
function isSurfLevelInRange(context: BotContext): boolean {
  const { start, end } = context.surfLevelRange
  // Default (no restriction)
  if (start === 0 && end === 0) return true
  const charLevel = context.game.character.level
  return charLevel >= start && (end === 0 || charLevel < end)
}

// ============================================================================
// HELPERS - Tile Counting
// ============================================================================

interface TileCountResult {
  total: number
  seen: number
}

/**
 * Count tiles in bounds, tracking total and seen-this-visit.
 * Used by both sweep (full level) and tethered (radius box) exploration.
 *
 * @param level - The current level
 * @param seenThisVisit - Set of "x,y" keys for tiles seen this visit
 * @param bounds - Optional origin + radius for bounded counting
 * @param filter - Tile filter (default: non-wall tiles)
 */
function countTilesInBounds(
  level: { width: number; height: number; tiles: Tile[][] },
  seenThisVisit: SeenGrid,
  bounds?: { origin: Point; radius: number },
  filter: (tile: Tile) => boolean = (t) => t.type !== 'wall'
): TileCountResult {
  let total = 0
  let seen = 0

  const minX = bounds ? Math.max(0, bounds.origin.x - bounds.radius) : 0
  const maxX = bounds ? Math.min(level.width - 1, bounds.origin.x + bounds.radius) : level.width - 1
  const minY = bounds ? Math.max(0, bounds.origin.y - bounds.radius) : 0
  const maxY = bounds
    ? Math.min(level.height - 1, bounds.origin.y + bounds.radius)
    : level.height - 1

  for (let y = minY; y <= maxY; y++) {
    const row = level.tiles[y]
    if (!row) continue

    for (let x = minX; x <= maxX; x++) {
      const tile = row[x]
      if (!tile || !filter(tile)) continue

      total++
      if (seenGridHas(seenThisVisit, x, y)) {
        seen++
      }
    }
  }

  return { total, seen }
}

// ============================================================================
// STATE TRANSITIONS - Farming Mode
// ============================================================================

/**
 * Enter farming mode - triggered when descent is blocked by consumable requirements.
 */
export function enterFarmingMode(
  botState: BotState,
  blockedDepth: number,
  goldTarget: number,
  currentTurn: number
): void {
  botState.farmingMode = true
  botState.farmBlockedDepth = blockedDepth
  botState.farmGoldTarget = goldTarget
  botState.farmStartTurn = currentTurn
}

/**
 * Exit farming mode - called when ready for the blocked depth.
 */
export function exitFarmingMode(botState: BotState): void {
  botState.farmingMode = false
  botState.farmBlockedDepth = 0
  botState.farmGoldTarget = 0
}

// ============================================================================
// STATE TRANSITIONS - Tethered Mode
// ============================================================================

/**
 * Enter tethered mode - exploring around a point (usually stairs).
 */
export function enterTetheredMode(
  botState: BotState,
  origin: Point,
  initialRadius: number = 2
): void {
  botState.tetheredOrigin = origin
  botState.tetheredRadius = initialRadius
  botState.tetheredFlipCount = 0
}

/**
 * Advance tether to next radius tier.
 */
export function advanceTetherRadius(botState: BotState, radii: readonly number[]): boolean {
  botState.tetheredFlipCount++
  if (botState.tetheredFlipCount < radii.length) {
    botState.tetheredRadius = radii[botState.tetheredFlipCount]!
    botState.tetheredOrigin = null // Will be set by tick.ts after descent
    return true
  }
  return false
}

/**
 * Exit tethered mode - clears all tether state.
 */
export function exitTetheredMode(botState: BotState): void {
  botState.tetheredOrigin = null
  botState.tetheredRadius = 0
  botState.tetheredFlipCount = 0
}

// ============================================================================
// QUERIES - Tether Geometry
// ============================================================================

/**
 * Check if a position is within tether radius of origin.
 */
function isWithinTether(pos: Point, origin: Point | null, radius: number): boolean {
  if (!origin) return true // Not tethered = all positions OK
  const dx = Math.abs(pos.x - origin.x)
  const dy = Math.abs(pos.y - origin.y)
  return Math.max(dx, dy) <= radius
}

/**
 * Find nearest unseen tile within tether using flow-based path distance.
 * Accepts optional precomputed flow to avoid redundant computations.
 */
function findUnseenTileInTether(
  context: BotContext,
  origin: Point,
  radius: number,
  precomputedFlow?: FlowGrid
): Point | null {
  const { game, botState } = context
  const level = game.currentLevel
  const pos = game.character.position

  // Use precomputed flow or compute fresh
  const flowCosts = precomputedFlow ?? computeFlow(level, pos)

  // Cap path distance - allow longer paths if bot is displaced from origin
  // (e.g., by teleport/phase door). This ensures we can still find targets
  // within the tether geometry even when starting from outside the tether.
  const distFromOrigin = Math.max(Math.abs(pos.x - origin.x), Math.abs(pos.y - origin.y))
  const basePathDist = radius * 2
  const maxPathDist = Math.max(basePathDist, distFromOrigin + radius + 5)

  let bestTarget: Point | null = null
  let bestDist = Infinity

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const x = origin.x + dx
      const y = origin.y + dy
      if (x < 0 || x >= level.width || y < 0 || y >= level.height) continue

      const tile = getTile(level, x, y)
      if (!tile || tile.type === 'wall') continue

      // Check if NOT seen this visit
      if (seenGridHas(botState.seenThisVisit, x, y)) continue

      // Use actual path distance from flow field
      const pathDist = getFlowCost(flowCosts, { x, y })
      if (pathDist >= MAX_FLOW_COST) continue // Unreachable
      if (pathDist > maxPathDist) continue // Too far to walk

      if (pathDist < bestDist) {
        bestDist = pathDist
        bestTarget = { x, y }
      }
    }
  }

  return bestTarget
}

/**
 * 80% of floor tiles in radius must be SEEN THIS VISIT (not just explored).
 * Using seenThisVisit forces the bot to walk around on each flip, finding new spawns.
 */
function isTetheredExplorationComplete(
  context: BotContext,
  origin: Point,
  radius: number
): boolean {
  const { game, botState } = context
  const { total, seen } = countTilesInBounds(game.currentLevel, botState.seenThisVisit, {
    origin,
    radius,
  })
  // Need 80% seen this visit to be "done" with this tether
  return total === 0 || seen / total >= 0.8
}

// ============================================================================
// QUERIES - Distance Helpers
// ============================================================================

/**
 * Find closest entity from position using Manhattan distance.
 * Generic helper for monsters, items, or any positioned entity.
 */
function findClosestByManhattan<T extends { position: Point }>(
  entities: T[],
  pos: Point
): T | null {
  if (entities.length === 0) return null

  let closest = entities[0]!
  let closestDist = Infinity

  for (const entity of entities) {
    const dist = Math.abs(entity.position.x - pos.x) + Math.abs(entity.position.y - pos.y)
    if (dist < closestDist) {
      closestDist = dist
      closest = entity
    }
  }

  return closest
}

/**
 * Find the depth that blocks descent due to readiness requirements.
 *
 * When farming: use the stored farmBlockedDepth
 * Otherwise: scan forward from current depth until readiness fails
 */
function findBlockedDepth(context: BotContext): number {
  const { game, botState, effectiveConfig, capabilities } = context
  const character = game.character

  // In farming mode: use the depth we're blocked at (don't recalculate)
  if (botState.farmingMode && botState.farmBlockedDepth > 0) {
    return botState.farmBlockedDepth
  }

  // Not farming: scan forward until readiness fails
  let blockedDepth = character.depth + 1
  while (blockedDepth <= MAX_DEPTH) {
    const readinessIssue = getDepthReadiness(
      character,
      character.inventory,
      blockedDepth,
      effectiveConfig.caution,
      capabilities.preparedness,
      context.depthGateOffset
    )
    if (readinessIssue) break
    blockedDepth++
  }
  return blockedDepth
}

// ============================================================================
// QUERIES - Town Trip Readiness
// ============================================================================

/**
 * Check if ready for town trip (has gold target and portal).
 */
export function isTownTripReady(character: Character, goldTarget: number): boolean {
  if (character.depth === 0) return false // Already in town
  const effectiveGold = getEffectiveGold(character)
  if (effectiveGold < goldTarget) return false
  if (character.level < character.depth) return false
  const tpScroll = findTownPortalScroll(character)
  return tpScroll !== null
}

// ============================================================================
// GOAL CREATORS - Farm
// ============================================================================

/**
 * Get FARM goal for monsters/items within tether radius.
 */
function getFarmGoal(context: BotContext, goldTarget: number): BotGoal | null {
  const { game, botState, visibleMonsters, visibleItems } = context
  const character = game.character
  const pos = character.position

  // Already have enough effective gold? Don't need to farm
  if (getEffectiveGold(character) >= goldTarget) return null

  // Under-leveled check: only matters if NOT already in farming mode
  // When farming (yo-yoing between depths), being under-leveled for current depth is expected
  if (
    !botState.farmingMode &&
    isUnderLeveled(
      character.level,
      character.depth,
      character.classId,
      character.upgradeBonuses,
      context.depthGateOffset
    )
  )
    return null

  // Tether constraints
  const isTethered = botState.tetheredOrigin !== null && botState.tetheredRadius > 0
  const tetherOrigin = botState.tetheredOrigin
  const tetherRadius = botState.tetheredRadius

  // Priority 1: Nearest visible monster (within tether if tethered)
  const tetheredMonsters = visibleMonsters.filter(
    (m) => m.hp > 0 && isWithinTether(m.position, tetherOrigin, tetherRadius)
  )
  const closestMonster = findClosestByManhattan(tetheredMonsters, pos)
  if (closestMonster) {
    return {
      type: 'FARM',
      target: closestMonster.position,
      targetId: closestMonster.id,
      reason: `Farming ${closestMonster.template.name} (${character.gold}/${goldTarget}g)`,
      startTurn: game.turn,
    }
  }

  // Priority 2: Nearest valuable item (within tether if tethered)
  const farmableItems = visibleItems.filter((item) => {
    // Skip consumables we want to keep
    if (item.template.type === 'potion' || item.template.type === 'scroll') {
      return false
    }
    return isWithinTether(item.position, tetherOrigin, tetherRadius)
  })

  const closestItem = findClosestByManhattan(farmableItems, pos)
  if (closestItem) {
    return {
      type: 'FARM',
      target: closestItem.position,
      targetId: closestItem.id,
      reason: `Farming ${closestItem.template.name} (${character.gold}/${goldTarget}g)`,
      startTurn: game.turn,
    }
  }

  // Priority 3: If tethered, walk to unseen tiles within tether radius
  if (isTethered && tetherOrigin) {
    const unseenTarget = findUnseenTileInTether(context, tetherOrigin, tetherRadius)
    if (unseenTarget) {
      return {
        type: 'FARM',
        target: unseenTarget,
        targetId: null,
        reason: `Sweeping tether area (${character.gold}/${goldTarget}g)`,
        startTurn: game.turn,
      }
    }
  }

  // Nothing to farm in tether area
  return null
}

// ============================================================================
// GOAL CREATORS - Town Trip
// ============================================================================

/**
 * Use town portal when gold/level targets met and have TP scroll.
 */
export function getTownTripGoal(context: BotContext): BotGoal | null {
  const { game, effectiveConfig, botState } = context
  const character = game.character

  // Already in town?
  if (character.depth === 0) return null

  // At depth 1, just walk up stairs
  if (character.depth === 1) return null

  // Don't use if portal already active
  if (game.townPortal) return null

  // Check if we have a town portal scroll
  const tpScroll = findTownPortalScroll(character)
  if (!tpScroll) return null

  // Calculate targets
  const goldTarget = getGoldTarget(character.depth + 1, effectiveConfig.caution)
  const levelTarget = character.depth

  // Ready for town trip?
  const hasGold = getEffectiveGold(character) >= goldTarget
  const hasLevel = character.level >= levelTarget

  if (hasGold && hasLevel) {
    exitFarmingMode(botState)
    exitTetheredMode(botState)

    return {
      type: 'TOWN_TRIP',
      target: character.position,
      targetId: tpScroll.id,
      reason: `Town trip ready (${character.gold}g, L${character.level})`,
      startTurn: game.turn,
    }
  }

  return null
}

// ============================================================================
// GOAL CREATORS - Ascend to Farm
// ============================================================================

/**
 * Ascend to easier levels when under-leveled for the BLOCKED depth.
 *
 * Key: Check against blocked depth (where readiness fails), not current depth.
 * This prevents stair surfing between N and N-1 when blocked at N+1.
 *
 */
export function getAscendToFarmGoal(context: BotContext): BotGoal | null {
  const { game, botState, effectiveConfig } = context
  const character = game.character

  // Can't ascend from depth 1
  if (character.depth <= 1) return null

  // Find the "blocked depth" - use stored value when farming, else scan forward
  const blockedDepth = findBlockedDepth(context)

  // Only ascend if under-leveled for the BLOCKED depth
  const underForBlocked = isUnderLeveled(
    character.level,
    blockedDepth,
    character.classId,
    character.upgradeBonuses,
    context.depthGateOffset
  )
  if (!underForBlocked) return null

  // If leveled enough for CURRENT depth, explore it fully before ascending
  const underForCurrent = isUnderLeveled(
    character.level,
    character.depth,
    character.classId,
    character.upgradeBonuses,
    context.depthGateOffset
  )
  if (!underForCurrent) return null

  // Farming depth floor: only farm on depths (blockedDepth - 2) to (blockedDepth - 1)
  const farmingFloor = Math.max(1, blockedDepth - 2)
  if (character.depth <= farmingFloor) return null

  // Need known stairs up
  const stairsUp = botState.knownStairsUp
  if (!stairsUp) return null

  // Tethered exploration check
  const effective = getEffectiveCapabilities(context)
  const radii = getTetherRadii(effective.surf)

  // No tethering available at this surf level or out of surf range - skip farming loop
  if (radii.length === 0 || !isSurfLevelInRange(context)) {
    return null
  }

  if (botState.tetheredRadius > 0 && botState.tetheredOrigin) {
    const done = isTetheredExplorationComplete(
      context,
      botState.tetheredOrigin,
      botState.tetheredRadius
    )
    if (!done) return null

    if (!advanceTetherRadius(botState, radii)) {
      exitTetheredMode(botState)
    }
  } else if (botState.tetheredRadius === 0) {
    // Starting a new tether cycle
    enterFarmingMode(
      botState,
      blockedDepth,
      getGoldTarget(blockedDepth, effectiveConfig.caution),
      game.turn
    )
    botState.tetheredRadius = radii[0]!
    botState.tetheredFlipCount = 0
  }

  // Check if previous level is in cache
  const prevDepth = character.depth - 1
  if (!game.levelCache.has(prevDepth)) {
    return null
  }

  return {
    type: 'ASCEND_TO_FARM',
    target: stairsUp,
    targetId: null,
    reason: `Under-leveled for D${blockedDepth} (L${character.level}), ascending to farm`,
    startTurn: game.turn,
  }
}

// ============================================================================
// FARMING LOOP ORCHESTRATION
// ============================================================================

/**
 * Handle tether sweep within active farming loop.
 */
function handleTetherSweep(context: BotContext, goldTarget: number): BotGoal | null {
  const { game, botState } = context
  const character = game.character
  const effective = getEffectiveCapabilities(context)
  const radii = getTetherRadii(effective.surf)

  // No tethering available
  if (radii.length === 0) return null

  let radius = botState.tetheredRadius || radii[0]!
  let flipCount = botState.tetheredFlipCount

  // Compute flow once - reuse for all radius checks
  const flowCosts = profile('tether.computeFlow', () =>
    computeFlow(game.currentLevel, game.character.position)
  )

  // Keep advancing radius until we find unseen tiles or exhaust all radii
  while (flipCount < radii.length) {
    radius = radii[flipCount]!
    const unseenTarget = profile('tether.findUnseen', () =>
      findUnseenTileInTether(context, botState.tetheredOrigin!, radius, flowCosts)
    )

    if (unseenTarget) {
      // Found unseen tiles - update state and return sweep goal
      botState.tetheredRadius = radius
      botState.tetheredFlipCount = flipCount
      const size = radius * 2 + 1
      return {
        type: 'FARM',
        target: unseenTarget,
        targetId: null,
        reason: `Sweeping tether ${size}x${size} (${character.gold}/${goldTarget}g)`,
        startTurn: game.turn,
      }
    }

    // This radius is fully seen, try next larger radius
    flipCount++
  }

  // All radii exhausted - exit tether mode
  exitTetheredMode(botState)
  return null
}

/**
 * Get goal for walking to town from depth 1 (saves TP scroll).
 * Returns ASCEND_TO_FARM goal to walk up stairs, or null if not ready.
 */
function getTownWalkGoal(context: BotContext): BotGoal | null {
  const { game, botState, effectiveConfig } = context
  const character = game.character

  // Only at depth 1 - walk up to town instead of using TP scroll
  if (character.depth !== 1) return null

  const townGoldTarget = getGoldTarget(character.depth + 1, effectiveConfig.caution)
  const hasGold = getEffectiveGold(character) >= townGoldTarget
  const hasLevel = character.level >= character.depth

  if (!hasGold || !hasLevel) return null
  if (!botState.knownStairsUp) return null

  // Clear farming mode - heading to town
  exitFarmingMode(botState)
  exitTetheredMode(botState)

  return {
    type: 'ASCEND_TO_FARM',
    target: botState.knownStairsUp,
    targetId: null,
    reason: `Walking to town (${character.gold}g, L${character.level})`,
    startTurn: game.turn,
  }
}

/**
 * Handle active farming loop when already in farming mode.
 * Priority: TOWN_TRIP > ASCEND_TO_FARM > FARM > tether sweep
 */
export function handleActiveFarmingLoop(context: BotContext): BotGoal | null {
  const { game, botState, effectiveConfig, capabilities } = context
  const character = game.character
  const goldTarget =
    botState.farmGoldTarget || getGoldTarget(botState.farmBlockedDepth, effectiveConfig.caution)

  // Check if ready for blocked depth
  const blockedReadiness = profile('farm.readiness', () =>
    getDepthReadiness(
      character,
      character.inventory,
      botState.farmBlockedDepth,
      effectiveConfig.caution,
      capabilities.preparedness,
      context.depthGateOffset
    )
  )

  if (!blockedReadiness) {
    // Ready for blocked depth - exit farming mode
    exitFarmingMode(botState)
    return null // Fall through to normal descent
  }

  // 1. If ready for town trip, use portal (unless at depth 1 - just walk)
  const townTrip = profile('farm.townTrip', () => getTownTripGoal(context))
  if (townTrip) return townTrip

  // 1b. At depth 1 and ready for town? Walk up stairs instead of using TP
  const townWalk = getTownWalkGoal(context)
  if (townWalk) return townWalk

  // 2. If under-leveled, ascend to farm easier content
  const ascend = profile('farm.ascend', () => getAscendToFarmGoal(context))
  if (ascend) return ascend

  // 3. Farm on current level (monsters/items within tether)
  const farm = profile('farm.getFarmGoal', () => getFarmGoal(context, goldTarget))
  if (farm) {
    // Set farming state for goal validator
    botState.farmingMode = true
    botState.farmGoldTarget = goldTarget
    if (botState.farmStartTurn === 0) {
      botState.farmStartTurn = game.turn
    }
    return farm
  }

  // 4. Tether sweep - actively walk to unseen tiles within tether radius
  if (botState.tetheredOrigin) {
    const sweepGoal = profile('farm.tetherSweep', () => handleTetherSweep(context, goldTarget))
    if (sweepGoal) return sweepGoal
  }

  // 5. At farming floor with complete tether? Allow descent
  const farmingFloor = Math.max(1, botState.farmBlockedDepth - 2)
  if (character.depth <= farmingFloor && botState.tetheredOrigin) {
    if (isTetheredExplorationComplete(context, botState.tetheredOrigin, botState.tetheredRadius)) {
      // Advance tether radius for after descent
      const effective = getEffectiveCapabilities(context)
      const radii = getTetherRadii(effective.surf)
      if (radii.length === 0 || !advanceTetherRadius(botState, radii)) {
        exitTetheredMode(botState)
      }
      // Fall through to descent
    }
  }

  // Still tethered? Need to explore
  if (botState.tetheredOrigin) {
    return null // Let EXPLORE find content
  }

  // Tether cleared - fall through to normal descent
  return null
}

/**
 * Initiate farming loop when descent is blocked.
 */
export function initiateFarmingLoop(context: BotContext): BotGoal | null {
  // GATE: Farming capability must be unlocked AND enabled
  const effective = getEffectiveCapabilities(context)
  if (!effective.farming) {
    return null // Face-rush mode: just descend unprepared
  }

  const { game, botState, effectiveConfig } = context
  const character = game.character
  const nextDepth = character.depth + 1
  const goldTarget = getGoldTarget(nextDepth, effectiveConfig.caution)

  // Track that we're farming for this depth
  if (!botState.farmingMode) {
    enterFarmingMode(botState, nextDepth, goldTarget, game.turn)
  }

  // 1. If ready for town trip, use portal
  const townTrip = getTownTripGoal(context)
  if (townTrip) return townTrip

  // 2. If under-leveled, ascend to farm easier content
  const ascend = getAscendToFarmGoal(context)
  if (ascend) return ascend

  // 3. Farm on current level for gold/XP
  const farm = getFarmGoal(context, goldTarget)
  if (farm) {
    botState.farmingMode = true
    botState.farmGoldTarget = goldTarget
    if (botState.farmStartTurn === 0) {
      botState.farmStartTurn = game.turn
    }
    return farm
  }

  // 4. Fall through - EXPLORE will find more monsters/items
  return null
}
