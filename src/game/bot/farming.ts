/**
 * Farming Domain
 *
 * Handles resource acquisition through tethered exploration, sweep mode,
 * and farming loops. Used when descent is blocked by consumable requirements.
 *
 * Key concepts:
 * - Tethered mode: Exploring within radius of stairs to trigger spawns
 * - Sweep mode: Full-level re-exploration for casters (no stair-surfing)
 * - Farming loop: Yo-yo between depths to accumulate gold/XP
 * - Town trips: Portal to town when ready to restock
 */

import type { Point, GameState, Tile } from '../types'
import type { BotState, BotGoal, BotContext } from './types'
import { SQUISHY_CLASSES, CASTER_STAIR_SURF_MIN_LEVEL, getEffectiveCapabilities } from './types'
import { MAX_DEPTH } from '../types'
import { getTile } from '../dungeon'
import type { FlowGrid } from './flow'
import { computeFlow, getFlowCost, MAX_FLOW_COST } from './flow'
import { profile } from './profiler'
import { findExplorationTarget } from './exploration'
import { getDepthReadiness, getGoldTarget, isUnderLeveled, getEffectiveGold } from './preparation'
import { findTownPortalScroll } from './items'

// ============================================================================
// CONSTANTS
// ============================================================================

/** Tethered exploration radii: 5x5 -> 9x9 -> 21x21 */
export const TETHER_RADII = [2, 4, 10] as const

/** Base sweep threshold (% of floor tiles seen this visit) - used when sweep disabled */
const SWEEP_BASE_THRESHOLD = 100 // Effectively disabled at L0

/** Sweep completion thresholds by level: L0=disabled, L1=60%, L2=75%, L3=90% */
const SWEEP_THRESHOLDS = [100, 60, 75, 90] as const

/** Get sweep completion threshold based on capability level */
export function getSweepCompletionThreshold(sweepLevel: number): number {
  return SWEEP_THRESHOLDS[sweepLevel] ?? SWEEP_BASE_THRESHOLD
}

/** Max turns before sweep times out */
const SWEEP_TIMEOUT = 500

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
// STATE TRANSITIONS - Sweep Mode
// ============================================================================

/**
 * Exit sweep mode - clears all sweep state.
 */
export function exitSweepMode(botState: BotState): void {
  botState.sweepMode = false
  botState.sweepDirection = null
  botState.sweepStartTurn = 0
}

/**
 * Set sweep direction toward level center (away from entry point).
 * Called when initializing sweep mode for casters.
 */
export function initializeSweepDirection(game: GameState, botState: BotState): void {
  const pos = game.character.position
  const level = game.currentLevel

  // Find center of level
  const centerX = Math.floor(level.width / 2)
  const centerY = Math.floor(level.height / 2)

  // Direction from player to center
  const dx = centerX - pos.x
  const dy = centerY - pos.y

  // Choose primary direction based on larger delta
  if (Math.abs(dx) > Math.abs(dy)) {
    botState.sweepDirection = dx > 0 ? 'e' : 'w'
  } else if (dy !== 0) {
    botState.sweepDirection = dy > 0 ? 's' : 'n'
  } else {
    // At center, default to east
    botState.sweepDirection = 'e'
  }
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
      const key = `${x},${y}`
      if (botState.seenThisVisit.has(key)) continue

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
  const level = game.currentLevel

  let totalFloor = 0
  let seenFloor = 0

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const x = origin.x + dx
      const y = origin.y + dy
      if (x < 0 || x >= level.width || y < 0 || y >= level.height) continue

      const tile = getTile(level, x, y)
      if (!tile || tile.type === 'wall') continue

      totalFloor++
      // Check seenThisVisit (FOV coverage this visit) instead of tile.explored
      if (botState.seenThisVisit.has(`${x},${y}`)) seenFloor++
    }
  }

  // Need 80% seen this visit to be "done" with this tether
  return totalFloor === 0 || seenFloor / totalFloor >= 0.8
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

// ============================================================================
// QUERIES - Sweep Mode
// ============================================================================

/**
 * Check if a tile should be counted as explorable (floor or door).
 */
function isExplorableTile(tile: Tile): boolean {
  return tile.type === 'floor' || tile.type === 'door_open' || tile.type === 'door_closed'
}

/**
 * Get sweep exploration progress (% of floor tiles seen this visit).
 * Used by casters to re-cover previously explored levels.
 */
export function getSweepProgress(game: GameState, botState: BotState): number {
  const level = game.currentLevel
  let totalFloor = 0
  let seenFloor = 0

  for (let y = 0; y < level.height; y++) {
    const row = level.tiles[y]
    if (!row) continue

    for (let x = 0; x < level.width; x++) {
      const tile = row[x]
      if (!tile) continue

      // Count explorable tiles (floor, doors)
      if (isExplorableTile(tile)) {
        totalFloor++
        if (botState.seenThisVisit.has(`${x},${y}`)) {
          seenFloor++
        }
      }
    }
  }

  return totalFloor > 0 ? Math.floor((seenFloor / totalFloor) * 100) : 100
}

/**
 * Check if sweep is complete (progress >= threshold).
 * @param sweepLevel - Capability level (0=disabled, 1-3=levels)
 */
export function isSweepComplete(
  game: GameState,
  botState: BotState,
  sweepLevel: number = 3
): boolean {
  const threshold = getSweepCompletionThreshold(sweepLevel)
  return getSweepProgress(game, botState) >= threshold
}

/**
 * Check if sweep has timed out (too many turns without completion).
 */
export function isSweepTimedOut(game: GameState, botState: BotState): boolean {
  if (botState.sweepStartTurn === 0) return false
  return game.turn - botState.sweepStartTurn > SWEEP_TIMEOUT
}

// ============================================================================
// QUERIES - Caster Behavior
// ============================================================================

/**
 * Check if bot is in early-game caster sweep mode.
 * Early-game casters (level < 10) use sweep exploration instead of
 * stair-surfing because respawns reset monsters, which is deadly for low-HP classes.
 */
function isEarlyCasterSweeping(
  character: { classId: string; level: number },
  botState: { sweepMode: boolean }
): boolean {
  return (
    botState.sweepMode &&
    SQUISHY_CLASSES.has(character.classId) &&
    character.level < CASTER_STAIR_SURF_MIN_LEVEL
  )
}

/**
 * Find the depth that blocks descent due to readiness requirements.
 *
 * When farming: use the stored farmBlockedDepth
 * Otherwise: scan forward from current depth until readiness fails
 */
function findBlockedDepth(context: BotContext): number {
  const { game, botState, effectiveConfig } = context
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
      effectiveConfig.caution
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
export function isTownTripReady(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  character: { depth: number; gold: number; inventory: any[]; level: number },
  goldTarget: number
): boolean {
  if (character.depth === 0) return false // Already in town
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const effectiveGold = getEffectiveGold(character as any)
  if (effectiveGold < goldTarget) return false
  if (character.level < character.depth) return false
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tpScroll = findTownPortalScroll(character as any)
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

  // Early-game casters in sweep mode use sweep exploration instead of tethered farming
  if (isEarlyCasterSweeping(character, botState)) return null

  // Already have enough effective gold? Don't need to farm
  if (getEffectiveGold(character) >= goldTarget) return null

  // Under-leveled check: only matters if NOT already in farming mode
  // When farming (yo-yoing between depths), being under-leveled for current depth is expected
  if (!botState.farmingMode && isUnderLeveled(character.level, character.depth, character.classId))
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
// GOAL CREATORS - Sweep
// ============================================================================

/**
 * Get SWEEP goal - sweep exploration for casters.
 * Walk through entire level to trigger spawns.
 * Targets tiles explored but NOT seen this visit (monsters spawn on sight).
 */
export function getSweepGoal(context: BotContext): BotGoal | null {
  const { game, botState } = context
  const character = game.character

  // Only for casters in sweep mode
  if (!botState.sweepMode) return null
  if (!SQUISHY_CLASSES.has(character.classId)) return null

  const progress = getSweepProgress(game, botState)

  // Check if sweep is complete (70% of floor tiles seen this visit)
  if (isSweepComplete(game, botState)) {
    exitSweepMode(botState)
    return null
  }

  // Check for timeout (prevent infinite sweep on weird maps)
  if (isSweepTimedOut(game, botState)) {
    exitSweepMode(botState)
    return null
  }

  // Find sweep target using standard exploration logic with sweep mode
  const target = findExplorationTarget(game, botState, true)
  if (!target) {
    // No reachable unseen tiles left - sweep considered complete (may be blocked by terrain)
    exitSweepMode(botState)
    return null
  }

  return {
    type: 'EXPLORE',
    target,
    targetId: null,
    reason: `Sweep exploration (${progress}% seen)`,
    startTurn: game.turn,
  }
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
 * Casters skip stair-surfing in early game (Angband borg-inspired) since
 * it resets spawns, which is deadly for low-HP classes. They use sweep instead.
 */
export function getAscendToFarmGoal(context: BotContext): BotGoal | null {
  const { game, botState, effectiveConfig } = context
  const character = game.character

  // Can't ascend from depth 1
  if (character.depth <= 1) return null

  // CASTER SWEEP MODE: Casters must complete sweep before ascending again
  if (isEarlyCasterSweeping(character, botState)) {
    const sweepGoal = getSweepGoal(context)
    if (sweepGoal) return sweepGoal
    // Sweep complete - getSweepGoal already called exitSweepMode
  }

  // Find the "blocked depth" - use stored value when farming, else scan forward
  const blockedDepth = findBlockedDepth(context)

  // Only ascend if under-leveled for the BLOCKED depth
  if (!isUnderLeveled(character.level, blockedDepth, character.classId)) return null

  // If leveled enough for CURRENT depth, explore it fully before ascending
  if (!isUnderLeveled(character.level, character.depth, character.classId)) return null

  // Farming depth floor: only farm on depths (blockedDepth - 2) to (blockedDepth - 1)
  const farmingFloor = Math.max(1, blockedDepth - 2)
  if (character.depth <= farmingFloor) return null

  // Need known stairs up
  const stairsUp = botState.knownStairsUp
  if (!stairsUp) return null

  // Early-game casters use sweep instead of tethered exploration
  if (isEarlyCasterSweeping(character, botState)) {
    if (!botState.farmingMode) {
      enterFarmingMode(
        botState,
        blockedDepth,
        getGoldTarget(blockedDepth, effectiveConfig.caution),
        game.turn
      )
    }
  } else {
    // Tethered exploration check
    if (botState.tetheredRadius > 0 && botState.tetheredOrigin) {
      const done = isTetheredExplorationComplete(
        context,
        botState.tetheredOrigin,
        botState.tetheredRadius
      )
      if (!done) return null

      if (!advanceTetherRadius(botState, TETHER_RADII)) {
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
      botState.tetheredRadius = TETHER_RADII[0]!
      botState.tetheredFlipCount = 0
    }
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

  let radius = botState.tetheredRadius || TETHER_RADII[0]!
  let flipCount = botState.tetheredFlipCount

  // Compute flow once - reuse for all radius checks
  const flowCosts = profile('tether.computeFlow', () =>
    computeFlow(game.currentLevel, game.character.position)
  )

  // Keep advancing radius until we find unseen tiles or exhaust all radii
  while (flipCount < TETHER_RADII.length) {
    radius = TETHER_RADII[flipCount]!
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
  const { game, botState, effectiveConfig } = context
  const character = game.character
  const goldTarget =
    botState.farmGoldTarget || getGoldTarget(botState.farmBlockedDepth, effectiveConfig.caution)

  // Check if ready for blocked depth
  const blockedReadiness = profile('farm.readiness', () =>
    getDepthReadiness(
      character,
      character.inventory,
      botState.farmBlockedDepth,
      effectiveConfig.caution
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
  if (botState.tetheredOrigin && !isEarlyCasterSweeping(character, botState)) {
    const sweepGoal = profile('farm.tetherSweep', () => handleTetherSweep(context, goldTarget))
    if (sweepGoal) return sweepGoal
  }

  // 5. At farming floor with complete tether? Allow descent
  const farmingFloor = Math.max(1, botState.farmBlockedDepth - 2)
  if (character.depth <= farmingFloor && botState.tetheredOrigin) {
    if (isTetheredExplorationComplete(context, botState.tetheredOrigin, botState.tetheredRadius)) {
      // Advance tether radius for after descent
      if (!advanceTetherRadius(botState, TETHER_RADII)) {
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
