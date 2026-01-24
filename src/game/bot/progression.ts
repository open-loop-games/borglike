/**
 * Progression Domain
 *
 * Manages dungeon progression: descent readiness, farming loops, and tethered
 * exploration. Handles the "yo-yo" pattern where bots farm gold, ascend/descend,
 * and town-trip to restock consumables before pushing deeper.
 *
 * Key concepts:
 * - Farming mode: When blocked by consumable requirements
 * - Tethered mode: Exploring around stairs to trigger spawns
 * - Town trips: Portal to town when ready to restock
 * - Sweep mode: Full-level exploration for early-game casters
 *
 * Architecture:
 * - State transitions: enterFarmingMode(), exitFarmingMode(), etc.
 * - Queries: getDescentBlocker(), shouldAscendToFarm(), etc.
 * - Goal creators: getProgressionGoal() dispatches to sub-functions
 */

import type { Point, GameState, Tile } from '../types'
import { MAX_DEPTH } from '../types'
import type { BotState, BotGoal, BotContext } from './types'
import { SQUISHY_CLASSES, CASTER_STAIR_SURF_MIN_LEVEL, MAX_FLOW_COST } from './types'
import { getTile } from '../dungeon'
import { computeFlow, getFlowCost } from './flow'
import { profile } from './profiler'
import {
  getExplorationProgress,
  isLabyrinthLevel,
  getLabyrinthExplorationThreshold,
  findExplorationTarget,
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

/** Tethered exploration radii: 5x5 -> 9x9 -> 21x21 */
const TETHER_RADII = [2, 4, 10] as const

/** Threshold for sweep completion (% of floor tiles seen this visit) */
const SWEEP_COMPLETION_THRESHOLD = 70

/** Max turns before sweep times out */
const SWEEP_TIMEOUT = 500

// ============================================================================
// STATE TRANSITIONS
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
// QUERIES - Readiness
// ============================================================================

/**
 * Get the reason descent is blocked, or null if ready.
 */
export function getDescentBlocker(
  character: {
    depth: number
    inventory: { template: { type: string; name: string; tier: number } }[]
    hp: number
    maxHp: number
    level: number
    classId?: string
  },
  caution: number
): string | null {
  const nextDepth = character.depth + 1
  if (nextDepth > MAX_DEPTH) return 'At max depth'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return getDepthReadiness(character as any, character.inventory as any, nextDepth, caution)
}

/**
 * Check if should ascend to farm easier content (under-leveled).
 */
export function shouldAscendToFarm(
  character: { level: number; depth: number; classId?: string },
  knownStairsUp: Point | null
): boolean {
  if (!knownStairsUp) return false
  if (character.depth <= 1) return false
  return isUnderLeveled(character.level, character.depth, character.classId)
}

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

/** Flow map type for tether search */
type FlowMap = Map<string, number>

/**
 * Find nearest unseen tile within tether using flow-based path distance.
 * Accepts optional precomputed flow to avoid redundant computations.
 */
function findUnseenTileInTether(
  context: BotContext,
  origin: Point,
  radius: number,
  precomputedFlow?: FlowMap
): Point | null {
  const { game, botState } = context
  const level = game.currentLevel
  const pos = game.character.position

  // Use precomputed flow or compute fresh
  const flowCosts = precomputedFlow ?? computeFlow(level, pos)

  // Cap path distance: don't walk further than 2x the tether radius
  const maxPathDist = radius * 2

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
 */
export function isSweepComplete(game: GameState, botState: BotState): boolean {
  return getSweepProgress(game, botState) >= SWEEP_COMPLETION_THRESHOLD
}

/**
 * Check if sweep has timed out (too many turns without completion).
 */
export function isSweepTimedOut(game: GameState, botState: BotState): boolean {
  if (botState.sweepStartTurn === 0) return false
  return game.turn - botState.sweepStartTurn > SWEEP_TIMEOUT
}

// ============================================================================
// GOAL CREATORS - Simple
// ============================================================================

/**
 * Get DESCEND goal if exploration/patience threshold met.
 * Does NOT check consumable readiness - caller must ensure ready.
 */
export function getDescendGoal(context: BotContext): BotGoal | null {
  const { game, config, botState } = context
  const character = game.character
  const nextDepth = character.depth + 1

  // Need to know where stairs are to actually descend
  if (!botState.knownStairsDown) return null

  // Check unique blockers (2+ living uniques blocks descent)
  const uniqueBlocker = getUniqueBlocker(character.depth, nextDepth, game.uniqueState, MONSTERS)
  if (uniqueBlocker) {
    return null // Should hunt unique instead
  }

  // Check if ready to descend (exploration or patience)
  const explorationProgress = getExplorationProgress(game)

  // Labyrinths use lower exploration threshold
  const explorationThreshold = isLabyrinthLevel(game)
    ? getLabyrinthExplorationThreshold(config.exploration)
    : config.exploration

  const shouldDescend =
    explorationProgress >= explorationThreshold || botState.turnsOnLevel >= config.patience

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
 * Get ASCEND_TO_FARM goal if under-leveled.
 */
export function getAscendToFarmGoal(context: BotContext): BotGoal | null {
  const { game, botState } = context
  const character = game.character

  if (!shouldAscendToFarm(character, botState.knownStairsUp)) return null

  return {
    type: 'ASCEND_TO_FARM',
    target: botState.knownStairsUp!,
    targetId: null,
    reason: `Under-leveled (L${character.level} at depth ${character.depth})`,
    startTurn: game.turn,
  }
}

/**
 * Get DESCEND goal to return to unique hunt depth after level flip.
 *
 * When hunting a unique blocker, bot may flip levels (ascend/descend) to trigger
 * new spawns. This goal ensures bot returns to the original depth to continue hunt.
 */
export function getReturnToUniqueHuntGoal(context: BotContext): BotGoal | null {
  const { game, botState } = context
  const character = game.character

  // Check if we're in unique hunt flip mode
  if (!botState.huntingUniqueBlocker || botState.uniqueHuntFlipDepth === null) {
    return null
  }

  // Skip in town
  if (character.depth === 0) return null

  // If we're back at the flip depth, clear state and let normal hunt resume
  if (character.depth === botState.uniqueHuntFlipDepth) {
    // Don't clear state yet - let getHuntUniqueGoal handle it when unique found/killed
    return null
  }

  // If we're above the flip depth, descend back
  if (character.depth < botState.uniqueHuntFlipDepth) {
    const stairsDown = botState.knownStairsDown ?? game.currentLevel.stairsDown
    if (!stairsDown) return null

    return {
      type: 'DESCEND',
      target: stairsDown,
      targetId: null,
      reason: `Returning to depth ${botState.uniqueHuntFlipDepth} to hunt ${botState.huntingUniqueBlocker}`,
      startTurn: game.turn,
    }
  }

  // If we're below flip depth somehow, ascend back
  if (character.depth > botState.uniqueHuntFlipDepth) {
    const stairsUp = botState.knownStairsUp ?? game.currentLevel.stairsUp
    if (!stairsUp) return null

    return {
      type: 'ASCEND_TO_FARM',
      target: stairsUp,
      targetId: null,
      reason: `Returning to depth ${botState.uniqueHuntFlipDepth} to hunt ${botState.huntingUniqueBlocker}`,
      startTurn: game.turn,
    }
  }

  return null
}

/**
 * Get TOWN_TRIP goal if ready to portal to town.
 */
export function getTownTripGoal(context: BotContext): BotGoal | null {
  const { game, botState, effectiveConfig } = context
  const character = game.character

  // Can't trip from town
  if (character.depth === 0) return null

  // Need portal scroll
  const tpScroll = findTownPortalScroll(character)
  if (!tpScroll) return null

  // Check gold and level requirements
  const goldTarget =
    botState.farmGoldTarget || getGoldTarget(character.depth + 1, effectiveConfig.caution)
  const effectiveGold = getEffectiveGold(character)

  // Need enough gold to buy supplies
  if (effectiveGold < goldTarget) return null

  // Need at least depth level to ensure XP gains
  if (character.level < character.depth) return null

  // Casters in sweep mode should complete sweep before town trip
  if (botState.sweepMode && SQUISHY_CLASSES.has(character.classId)) {
    if (!isSweepComplete(game, botState)) return null
  }

  return {
    type: 'TOWN_TRIP',
    target: character.position, // Use in place
    targetId: tpScroll.id,
    reason: `Town trip (${character.gold}g, need ${goldTarget}g)`,
    startTurn: game.turn,
  }
}

/**
 * Get FARM goal for monsters/items within tether radius.
 */
function getFarmGoal(context: BotContext, goldTarget: number): BotGoal | null {
  const { game, botState, visibleMonsters, visibleItems } = context
  const character = game.character
  const pos = character.position

  // Early-game casters in sweep mode use sweep exploration instead of tethered farming
  if (
    botState.sweepMode &&
    SQUISHY_CLASSES.has(character.classId) &&
    character.level < CASTER_STAIR_SURF_MIN_LEVEL
  ) {
    return null // Let sweep handle exploration
  }

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
  if (tetheredMonsters.length > 0) {
    let closest = tetheredMonsters[0]!
    let closestDist = Infinity

    for (const monster of tetheredMonsters) {
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

  // Priority 2: Nearest valuable item (within tether if tethered)
  const farmableItems = visibleItems.filter((item) => {
    // Skip consumables we want to keep
    if (item.template.type === 'potion' || item.template.type === 'scroll') {
      return false
    }
    return isWithinTether(item.position, tetherOrigin, tetherRadius)
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
// FARMING LOOP ORCHESTRATION
// ============================================================================

/**
 * Handle active farming loop when already in farming mode.
 * Priority: TOWN_TRIP > ASCEND_TO_FARM > FARM > tether sweep
 */
function handleActiveFarmingLoop(context: BotContext): BotGoal | null {
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
  const townTrip = profile('farm.townTrip', () => evaluateTownTrip(context))
  if (townTrip) return townTrip

  // 1b. At depth 1 and ready for town? Walk up stairs instead of using TP
  if (character.depth === 1) {
    const townGoldTarget = getGoldTarget(character.depth + 1, effectiveConfig.caution)
    const hasGold = getEffectiveGold(character) >= townGoldTarget
    const hasLevel = character.level >= character.depth
    if (hasGold && hasLevel && botState.knownStairsUp) {
      // Clear farming mode - heading to town
      exitFarmingMode(botState)
      exitTetheredMode(botState)
      return {
        type: 'ASCEND_TO_FARM', // Reuse this goal type - it ascends
        target: botState.knownStairsUp,
        targetId: null,
        reason: `Walking to town (${character.gold}g, L${character.level})`,
        startTurn: game.turn,
      }
    }
  }

  // 2. If under-leveled, ascend to farm easier content
  const ascend = profile('farm.ascend', () => evaluateAscendToFarm(context))
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
  const skipTetherForSweep =
    botState.sweepMode &&
    SQUISHY_CLASSES.has(character.classId) &&
    character.level < CASTER_STAIR_SURF_MIN_LEVEL
  if (botState.tetheredOrigin && !skipTetherForSweep) {
    const sweepGoal = profile('farm.tetherSweep', () => handleTetherSweep(context, goldTarget))
    if (sweepGoal) return sweepGoal
  }

  // 5. At farming floor with complete tether? Allow descent
  const farmingFloor = Math.max(1, botState.farmBlockedDepth - 2)
  if (character.depth <= farmingFloor && botState.tetheredOrigin) {
    if (isTetheredExplorationComplete(context, botState.tetheredOrigin, botState.tetheredRadius)) {
      // Advance tether radius for after descent
      botState.tetheredFlipCount++
      if (botState.tetheredFlipCount < TETHER_RADII.length) {
        botState.tetheredRadius = TETHER_RADII[botState.tetheredFlipCount]!
        botState.tetheredOrigin = null // Will be set by tick.ts
      } else {
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

  // All radii exhausted - tether cycle complete
  exitTetheredMode(botState)
  return null
}

/**
 * Initiate farming loop when descent is blocked.
 */
function initiateFarmingLoop(context: BotContext): BotGoal | null {
  const { game, botState, effectiveConfig } = context
  const character = game.character
  const nextDepth = character.depth + 1
  const goldTarget = getGoldTarget(nextDepth, effectiveConfig.caution)

  // Track that we're farming for this depth
  if (!botState.farmingMode) {
    enterFarmingMode(botState, nextDepth, goldTarget, game.turn)
  }

  // 1. If ready for town trip, use portal
  const townTrip = evaluateTownTrip(context)
  if (townTrip) return townTrip

  // 2. If under-leveled, ascend to farm easier content
  const ascend = evaluateAscendToFarm(context)
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

/**
 * Main entry point for progression goals.
 * Replaces evaluateDescend with cleaner dispatch logic.
 */
export function getProgressionGoal(context: BotContext): BotGoal | null {
  const { game, botState, effectiveConfig } = context
  const character = game.character
  const nextDepth = character.depth + 1

  // FARMING MODE: Handle active farming loop
  if (botState.farmingMode && botState.farmBlockedDepth > 0) {
    const farmingGoal = profile('prog.activeFarm', () => handleActiveFarmingLoop(context))
    if (farmingGoal) return farmingGoal
    // If null, farming mode was cleared - continue to standard descent
  }

  // PROACTIVE CHECK: Descent blocked by consumable requirements?
  const readinessIssue = profile('prog.depthReadiness', () =>
    getDepthReadiness(character, character.inventory, nextDepth, effectiveConfig.caution)
  )
  if (readinessIssue) {
    const farmingGoal = profile('prog.initFarm', () => initiateFarmingLoop(context))
    if (farmingGoal) return farmingGoal
    // Fall through to EXPLORE if no farming goal
  }

  // SWEEP MODE: Casters in sweep mode get sweep goal
  if (botState.sweepMode && SQUISHY_CLASSES.has(character.classId)) {
    const sweepGoal = getSweepGoal(context)
    if (sweepGoal) return sweepGoal
    // Sweep complete or no target - getSweepGoal already called exitSweepMode
  }

  // STANDARD DESCENT: Check exploration/patience thresholds
  return profile('prog.getDescendGoal', () => getDescendGoal(context))
}

// ============================================================================
// ASCEND TO FARM EVALUATOR
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
export function evaluateAscendToFarm(context: BotContext): BotGoal | null {
  const { game, botState, effectiveConfig } = context
  const character = game.character

  // Can't ascend from depth 1
  if (character.depth <= 1) return null

  // CASTER SWEEP MODE: Casters must complete sweep before ascending again
  if (SQUISHY_CLASSES.has(character.classId) && character.level < CASTER_STAIR_SURF_MIN_LEVEL) {
    if (botState.sweepMode) {
      const sweepGoal = getSweepGoal(context)
      if (sweepGoal) return sweepGoal
      // Sweep complete - getSweepGoal already called exitSweepMode
    }
  }

  // Find the "blocked depth" - use stored value when farming, else scan forward
  let blockedDepth: number
  if (botState.farmingMode && botState.farmBlockedDepth > 0) {
    // In farming mode: use the depth we're blocked at (don't recalculate)
    blockedDepth = botState.farmBlockedDepth
  } else {
    // Not farming: scan forward until readiness fails
    blockedDepth = character.depth + 1
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
  }

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
  const isCasterFarming =
    SQUISHY_CLASSES.has(character.classId) && character.level < CASTER_STAIR_SURF_MIN_LEVEL
  if (isCasterFarming) {
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

      botState.tetheredFlipCount++
      if (botState.tetheredFlipCount < TETHER_RADII.length) {
        botState.tetheredRadius = TETHER_RADII[botState.tetheredFlipCount]!
      } else {
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
// TOWN TRIP EVALUATOR
// ============================================================================

/**
 * Use town portal when gold/level targets met and have TP scroll.
 */
export function evaluateTownTrip(context: BotContext): BotGoal | null {
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
// SWEEP GOAL
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

/**
 * Evaluate sweep goal - alias for backward compatibility.
 */
export function evaluateSweep(context: BotContext): BotGoal | null {
  return getSweepGoal(context)
}

// ============================================================================
// FARM EVALUATOR (public wrapper)
// ============================================================================

/**
 * Farm monsters/items within tether radius to accumulate gold.
 * Public wrapper that ensures farming state is set.
 */
export function evaluateFarm(context: BotContext, goldTarget: number): BotGoal | null {
  const { botState, game } = context

  // Ensure farming state is set
  if (!botState.farmingMode) {
    botState.farmingMode = true
    botState.farmGoldTarget = goldTarget
    if (botState.farmStartTurn === 0) {
      botState.farmStartTurn = game.turn
    }
  }

  return getFarmGoal(context, goldTarget)
}

// ============================================================================
// DESCEND EVALUATOR (main entry point)
// ============================================================================

/**
 * PROACTIVE readiness check triggers farming BEFORE reaching stairs.
 * Main entry point that dispatches to getProgressionGoal().
 */
export function evaluateDescend(context: BotContext, _botState: BotState): BotGoal | null {
  return getProgressionGoal(context)
}

// ============================================================================
// VISIBLE TILE RECORDING
// ============================================================================

/**
 * Track tiles seen THIS visit (vs cached exploration that persists across visits).
 */
export function recordVisibleTiles(game: GameState, botState: BotState): void {
  const level = game.currentLevel
  for (let y = 0; y < level.height; y++) {
    const row = level.tiles[y]
    if (!row) continue
    for (let x = 0; x < level.width; x++) {
      const tile = row[x]
      if (tile?.visible) {
        botState.seenThisVisit.add(`${x},${y}`)
      }
    }
  }
}
