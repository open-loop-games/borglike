/**
 * Farming Loop System
 *
 * Manages the "yo-yo" farming pattern: when descent is blocked by consumable
 * requirements, the bot farms gold by surfing between depths, then town-trips
 * to restock. Includes sweep exploration for squishy casters who can't safely
 * stair-surf in early game.
 */

import type { Point, GameState } from '../types'
import { MAX_DEPTH } from '../types'
import type { BotState, BotGoal, BotContext } from './types'
import { SQUISHY_CLASSES, CASTER_STAIR_SURF_MIN_LEVEL, MAX_FLOW_COST } from './types'
import { getTile } from '../dungeon'
import { computeFlow, getFlowCost } from './flow'
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
const TETHER_RADII = [2, 4, 10]

// ============================================================================
// DESCEND EVALUATOR
// ============================================================================

/**
 * PROACTIVE readiness check triggers farming BEFORE reaching stairs,
 * preventing death from attrition while exploring. When blocked, chains
 * to TOWN_TRIP > ASCEND_TO_FARM > FARM in priority order.
 */
export function evaluateDescend(context: BotContext, botState: BotState): BotGoal | null {
  const { game, config, effectiveConfig } = context
  const character = game.character
  const nextDepth = character.depth + 1

  // ============================================================================
  // PROACTIVE READINESS CHECK - Must happen BEFORE requiring known stairs
  // This lets farming trigger even while exploring for stairs
  // ============================================================================

  // If in farming mode, check if ready for blocked depth
  // This prevents yo-yo: at depth 3, readiness for 4 passes but we're blocked at 5
  if (botState.farmingMode && botState.farmBlockedDepth > 0) {
    const blockedReadiness = getDepthReadiness(
      character,
      character.inventory,
      botState.farmBlockedDepth,
      effectiveConfig.caution
    )
    if (blockedReadiness) {
      // Still not ready for blocked depth - continue farming loop
      // Priority: TOWN_TRIP > ASCEND_TO_FARM > FARM
      const goldTarget = getGoldTarget(botState.farmBlockedDepth, effectiveConfig.caution)

      // 1. If ready for town trip, use portal (unless at depth 1 - just walk)
      const townTrip = evaluateTownTrip(context)
      if (townTrip) return townTrip

      // 1b. At depth 1 and ready for town? Walk up stairs instead of using TP
      if (character.depth === 1) {
        const townGoldTarget = getGoldTarget(character.depth + 1, effectiveConfig.caution)
        const hasGold = getEffectiveGold(character) >= townGoldTarget
        const hasLevel = character.level >= character.depth
        if (hasGold && hasLevel && botState.knownStairsUp) {
          // Clear farming mode - heading to town
          botState.farmingMode = false
          botState.farmGoldTarget = 0
          botState.tetheredOrigin = null
          botState.tetheredRadius = 0
          botState.tetheredFlipCount = 0
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
      const ascend = evaluateAscendToFarm(context)
      if (ascend) return ascend

      // 3. Farm on current level (monsters/items within tether)
      const farm = evaluateFarm(context, goldTarget)
      if (farm) return farm

      // 4. Tether sweep - actively walk to unseen tiles within tether radius
      // This is the key farming exploration: walk around stairs to find spawns
      // Uses FARM goal to indicate "explore this area for farming purposes"
      // Skip for early-game casters - they use sweep exploration instead
      const skipTetherForSweep = botState.sweepMode &&
        SQUISHY_CLASSES.has(character.classId) &&
        character.level < CASTER_STAIR_SURF_MIN_LEVEL
      if (botState.tetheredOrigin && !skipTetherForSweep) {
        // Try current radius, advance if FOV already covers it
        let radius = botState.tetheredRadius || TETHER_RADII[0]!
        let flipCount = botState.tetheredFlipCount

        // Keep advancing radius until we find unseen tiles or exhaust all radii
        while (flipCount < TETHER_RADII.length) {
          radius = TETHER_RADII[flipCount]!
          const unseenTarget = findUnseenTileInTether(context, botState.tetheredOrigin, radius)

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

        // All radii exhausted - tether cycle complete, clear for descent
        botState.tetheredRadius = 0
        botState.tetheredFlipCount = 0
        botState.tetheredOrigin = null
        // Fall through to allow descent
      }

      // 5. At farming floor, can't ascend further - check if tether is complete
      // If tether is complete, advance to next radius and allow descent
      // Farming floor = blockedDepth - 2 (e.g., depth 3 for blocked at 5)
      const farmingFloor = Math.max(1, botState.farmBlockedDepth - 2)
      if (character.depth <= farmingFloor && botState.tetheredOrigin) {
        if (isTetheredExplorationComplete(context, botState.tetheredOrigin, botState.tetheredRadius)) {
          // Tether complete - advance to next radius for after descent
          botState.tetheredFlipCount++
          if (botState.tetheredFlipCount < TETHER_RADII.length) {
            // Set next radius (e.g., 5x5 -> 9x9), origin will be set by tick.ts after descent
            botState.tetheredRadius = TETHER_RADII[botState.tetheredFlipCount]!
            botState.tetheredOrigin = null // Will be set by tick.ts
          } else {
            // Done with tether cycle, reset for next cycle
            botState.tetheredRadius = 0
            botState.tetheredFlipCount = 0
            botState.tetheredOrigin = null
          }
          // Fall through to DESCEND
        }
      }

      // 5. Nothing to farm visible - return null to let EXPLORE find content
      // (or fall through to DESCEND if tether was cleared above)
      if (botState.tetheredOrigin) {
        return null // Still tethered, need to explore
      }
      // Tether cleared or no tether - fall through to normal descent check
    } else {
      // Ready for blocked depth - clear farming mode and continue normally
      botState.farmingMode = false
      botState.farmBlockedDepth = 0
      botState.farmGoldTarget = 0
    }
  }

  // Check consumable readiness for NEXT depth PROACTIVELY
  // This triggers farming even before we find the stairs, preventing death from attrition
  const readinessIssue = getDepthReadiness(
    character,
    character.inventory,
    nextDepth,
    effectiveConfig.caution
  )
  if (readinessIssue) {
    // Descent will be blocked - initiate farming loop NOW (even without known stairs)
    // Priority: TOWN_TRIP > ASCEND_TO_FARM > FARM > (fall through to EXPLORE)

    const goldTarget = getGoldTarget(nextDepth, effectiveConfig.caution)

    // Track that we're farming for this depth (prevents repeated checks)
    if (!botState.farmingMode) {
      botState.farmingMode = true
      botState.farmBlockedDepth = nextDepth
      botState.farmGoldTarget = goldTarget
      botState.farmStartTurn = game.turn
    }

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
    // Don't return null here - we still want to explore while farming
    // The farming mode flag will ensure we keep checking readiness
  }

  // ============================================================================
  // STANDARD DESCENT CHECKS - Only proceed if ready for next depth
  // ============================================================================

  // Casters in sweep mode must complete sweep before descending
  if (botState.sweepMode && SQUISHY_CLASSES.has(character.classId)) {
    if (!isSweepComplete(game, botState)) {
      return null // Let sweep exploration continue
    }
    // Sweep complete - clear mode and allow descent
    botState.sweepMode = false
    botState.sweepDirection = null
    botState.sweepStartTurn = 0
  }

  // Need to know where stairs are to actually descend
  if (!botState.knownStairsDown) return null

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
// FARM EVALUATOR
// ============================================================================

/**
 * Farm monsters/items within tether radius to accumulate gold.
 * When tethered, walks to unseen tiles within radius to trigger spawns.
 */
export function evaluateFarm(
  context: BotContext,
  goldTarget: number
): BotGoal | null {
  const { game, botState, visibleMonsters, visibleItems } = context
  const character = game.character
  const pos = character.position

  // Early-game casters in sweep mode use sweep exploration instead of tethered farming
  if (botState.sweepMode &&
      SQUISHY_CLASSES.has(character.classId) &&
      character.level < CASTER_STAIR_SURF_MIN_LEVEL) {
    return null // Let evaluateSweep handle exploration
  }

  // Already have enough effective gold (gold + equipment sell value)? Don't need to farm
  if (getEffectiveGold(character) >= goldTarget) return null

  // Under-leveled check: only matters if NOT already in farming mode
  // When farming (yo-yoing between depths), being under-leveled for current depth is expected
  // The goal is to farm until ready for farmBlockedDepth, not until level >= current depth
  if (!botState.farmingMode && isUnderLeveled(character.level, character.depth, character.classId)) return null

  // Set farming state
  botState.farmingMode = true
  botState.farmGoldTarget = goldTarget
  if (botState.farmStartTurn === 0) {
    botState.farmStartTurn = game.turn
  }

  // Check if we're in tethered mode (after a level flip)
  const isTethered = botState.tetheredOrigin !== null && botState.tetheredRadius > 0
  const tetherOrigin = botState.tetheredOrigin
  const tetherRadius = botState.tetheredRadius

  // Helper to check if a position is within tether radius
  const isWithinTether = (p: Point): boolean => {
    if (!isTethered || !tetherOrigin) return true // Not tethered = all positions OK
    const dx = Math.abs(p.x - tetherOrigin.x)
    const dy = Math.abs(p.y - tetherOrigin.y)
    return Math.max(dx, dy) <= tetherRadius
  }

  // Priority 1: Nearest visible monster (within tether if tethered)
  const tetheredMonsters = visibleMonsters.filter(m => m.hp > 0 && isWithinTether(m.position))
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
  const farmableItems = visibleItems.filter(item => {
    // Skip consumables we want to keep
    if (item.template.type === 'potion' || item.template.type === 'scroll') {
      return false
    }
    return isWithinTether(item.position)
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
  // This ensures we traverse the area to populate seenThisVisit and find new spawns
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

  // Nothing to farm in tether area - fall through
  return null
}

// ============================================================================
// ASCEND_TO_FARM EVALUATOR
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
  // Sweep is initialized by tick.ts when RE-ENTERING a level during farming
  // Here we just gate ascent on sweep completion (if sweep is active)
  if (SQUISHY_CLASSES.has(character.classId) && character.level < CASTER_STAIR_SURF_MIN_LEVEL) {
    if (botState.sweepMode) {
      // Sweep is active - block ascent until complete
      if (!isSweepComplete(game, botState) && !isSweepTimedOut(game, botState)) {
        return null // Keep sweeping
      }
      // Sweep complete or timed out - clear mode and allow ascent
      botState.sweepMode = false
      botState.sweepDirection = null
      botState.sweepStartTurn = 0
    }
    // Not in sweep mode, or sweep just completed - allow ascent
    // tick.ts will initialize sweep on the destination level
  }

  // Find the "blocked depth" - scan forward until readiness fails
  // This is the depth we're ultimately trying to reach but can't
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

  // Only ascend if under-leveled for the BLOCKED depth
  if (!isUnderLeveled(character.level, blockedDepth, character.classId)) return null

  // If leveled enough for CURRENT depth, explore it fully before ascending
  // This ensures the bot actually plays depth N when they reach level N
  if (!isUnderLeveled(character.level, character.depth, character.classId)) return null

  // Farming depth floor: only farm on depths (blockedDepth - 2) to (blockedDepth - 1)
  // Don't ascend below the farming floor - that's too easy, wasting time
  const farmingFloor = Math.max(1, blockedDepth - 2)
  if (character.depth <= farmingFloor) return null

  // Need known stairs up (set when we descended to this level)
  const stairsUp = botState.knownStairsUp
  if (!stairsUp) return null

  // Early-game casters use sweep instead of tethered exploration
  // Just set farming mode and skip tether logic
  const isCasterFarming = SQUISHY_CLASSES.has(character.classId) && character.level < CASTER_STAIR_SURF_MIN_LEVEL
  if (isCasterFarming) {
    // Ensure farming mode is on for casters
    if (!botState.farmingMode) {
      botState.farmingMode = true
      botState.farmBlockedDepth = blockedDepth
      botState.farmGoldTarget = getGoldTarget(blockedDepth, effectiveConfig.caution)
      botState.farmStartTurn = game.turn
    }
    // Skip tether - casters use sweep exploration via tick.ts
  } else {
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
    } else if (botState.tetheredRadius === 0) {
      // Starting a new tether cycle - set initial radius for after this flip
      // Origin will be set by tick.ts after the level change
      // Also ensure farming mode is on (we're ascending to farm)
      botState.farmingMode = true
      botState.farmBlockedDepth = blockedDepth
      botState.farmGoldTarget = getGoldTarget(blockedDepth, effectiveConfig.caution)
      botState.farmStartTurn = game.turn
      botState.tetheredRadius = TETHER_RADII[0]!
      botState.tetheredFlipCount = 0
    }
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
    reason: `Under-leveled for D${blockedDepth} (L${character.level}), ascending to farm`,
    startTurn: game.turn,
  }
}

// ============================================================================
// TOWN_TRIP EVALUATOR
// ============================================================================

/** Use town portal when gold/level targets met and have TP scroll. */
export function evaluateTownTrip(context: BotContext): BotGoal | null {
  const { game, effectiveConfig, botState } = context
  const character = game.character

  // Already in town? Don't need this goal
  if (character.depth === 0) return null

  // At depth 1, just walk up stairs - don't waste a TP scroll
  if (character.depth === 1) return null

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

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/** Find nearest unseen tile within tether using flow-based path distance. */
function findUnseenTileInTether(
  context: BotContext,
  origin: Point,
  radius: number
): Point | null {
  const { game, botState } = context
  const level = game.currentLevel
  const pos = game.character.position

  // Compute flow from character position to get actual path distances
  const flowCosts = computeFlow(level, pos)

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
function isTetheredExplorationComplete(context: BotContext, origin: Point, radius: number): boolean {
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
  return totalFloor === 0 || (seenFloor / totalFloor) >= 0.8
}

// ============================================================================
// SWEEP EXPLORATION
// ============================================================================

const SWEEP_COMPLETION_THRESHOLD = 70
const SWEEP_TIMEOUT = 500
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

export function isSweepComplete(game: GameState, botState: BotState): boolean {
  return getSweepProgress(game, botState) >= SWEEP_COMPLETION_THRESHOLD
}

export function isSweepTimedOut(game: GameState, botState: BotState): boolean {
  if (botState.sweepStartTurn === 0) return false
  return game.turn - botState.sweepStartTurn > SWEEP_TIMEOUT
}

/** Set sweep direction toward level center (away from entry point). */
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
// SWEEP EVALUATOR
// ============================================================================

/**
 * For casters in early game: walk through entire level to trigger spawns.
 * Targets tiles explored but NOT seen this visit (monsters spawn on sight).
 */
export function evaluateSweep(context: BotContext): BotGoal | null {
  const { game, botState } = context
  const character = game.character

  // Only for casters in sweep mode
  if (!botState.sweepMode) return null
  if (!SQUISHY_CLASSES.has(character.classId)) return null

  const progress = getSweepProgress(game, botState)

  // Check if sweep is complete (70% of floor tiles seen this visit)
  if (isSweepComplete(game, botState)) {
    // Clear sweep mode - allow normal exploration/descent
    botState.sweepMode = false
    botState.sweepDirection = null
    botState.sweepStartTurn = 0
    return null
  }

  // Check for timeout (prevent infinite sweep on weird maps)
  if (isSweepTimedOut(game, botState)) {
    botState.sweepMode = false
    botState.sweepDirection = null
    botState.sweepStartTurn = 0
    return null
  }

  // Find sweep target using standard exploration logic with sweep mode
  const target = findExplorationTarget(game, botState, true)
  if (!target) {
    // No reachable unseen tiles left - sweep considered complete (may be blocked by terrain)
    botState.sweepMode = false
    botState.sweepDirection = null
    botState.sweepStartTurn = 0
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
// VISIBLE TILE RECORDING
// ============================================================================

/** Track tiles seen THIS visit (vs cached exploration that persists across visits). */
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

// ============================================================================
// HELPERS
// ============================================================================

function isExplorableTile(tile: { type: string }): boolean {
  return tile.type === 'floor' || tile.type === 'door_open' || tile.type === 'door_closed'
}
