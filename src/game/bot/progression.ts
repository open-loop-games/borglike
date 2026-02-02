/**
 * Progression Domain
 *
 * Manages dungeon descent: readiness checks, unique blockers, and Morgoth hunt.
 * Delegates farming/tether/sweep logic to farming.ts.
 *
 * Key concepts:
 * - Descent readiness: Check consumable/level requirements before going deeper
 * - Unique blockers: Hunt uniques that block descent to next depth
 * - Morgoth hunt: Endgame boss at depth 50, special flip-respawn logic
 *
 * Architecture:
 * - Queries: getDescentBlocker(), shouldAscendToFarm()
 * - Goal creators: getDescendGoal(), getMorgothHuntGoal()
 * - Main dispatcher: getProgressionGoal()
 */

import type { Point, GameState } from '../types'
import type { UpgradeBonuses } from '../upgrade-effects'
import { MAX_DEPTH } from '../types'
import type { BotState, BotGoal, BotContext } from './types'
import { SQUISHY_CLASSES, getEffectiveCapabilities } from './types'
import { getTile } from '../dungeon'
import { profile } from './profiler'
import {
  getExplorationProgress,
  isLabyrinthLevel,
  getLabyrinthExplorationThreshold,
} from './exploration'
import { getDepthReadiness, getUniqueBlocker, isUnderLeveled } from './preparation'
import { monsters as MONSTERS } from '../data/monsters'
import { handleActiveFarmingLoop, initiateFarmingLoop, getSweepGoal } from './farming'

// Re-export farming functions that other modules need
export { initializeSweepDirection } from './farming'

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get floor tile count for the current level (cached per level).
 * Floor tiles = all non-wall tiles (floor, doors, stairs, etc.)
 */
function getLevelFloorCount(context: BotContext): number {
  const { game, botState } = context

  // Return cached value if available
  if (botState.cachedLevelFloorCount > 0) {
    return botState.cachedLevelFloorCount
  }

  // Compute floor count
  const level = game.currentLevel
  let count = 0
  for (const row of level.tiles) {
    for (const tile of row) {
      if (tile.type !== 'wall') {
        count++
      }
    }
  }

  // Cache for future calls this level
  botState.cachedLevelFloorCount = count
  return count
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
  character: { level: number; depth: number; classId?: string; upgradeBonuses?: UpgradeBonuses },
  knownStairsUp: Point | null
): boolean {
  if (!knownStairsUp) return false
  if (character.depth <= 1) return false
  return isUnderLeveled(
    character.level,
    character.depth,
    character.classId,
    character.upgradeBonuses
  )
}

// ============================================================================
// GOAL CREATORS - Descent
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
 * Get DESCEND goal to return to unique hunt depth after level flip.
 */
export function getReturnToUniqueHuntGoal(context: BotContext): BotGoal | null {
  const { game, botState } = context
  const character = game.character

  if (!botState.huntingUniqueBlocker || botState.uniqueHuntFlipDepth === null) {
    return null
  }

  if (character.depth === 0) return null

  if (character.depth === botState.uniqueHuntFlipDepth) {
    return null
  }

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

// ============================================================================
// MORGOTH HUNT
// ============================================================================

const MORGOTH_FLIP_EXPLORATION_THRESHOLD = 0.9

function getLevelFlipReturnGoal(
  context: BotContext,
  targetDepth: number,
  reason: string
): BotGoal | null {
  const { game, botState } = context
  const character = game.character

  if (character.depth === 0) return null

  if (character.depth === targetDepth) {
    return null
  }

  if (character.depth < targetDepth) {
    let stairsDown = botState.knownStairsDown ?? game.currentLevel.stairsDown

    if (!stairsDown) {
      const currentTile = getTile(game.currentLevel, character.position.x, character.position.y)
      if (currentTile?.type === 'stairs_down') {
        stairsDown = character.position
      }
    }

    if (!stairsDown) return null

    return {
      type: 'DESCEND',
      target: stairsDown,
      targetId: null,
      reason,
      startTurn: game.turn,
    }
  }

  if (character.depth > targetDepth) {
    const stairsUp = botState.knownStairsUp ?? game.currentLevel.stairsUp
    if (!stairsUp) return null

    return {
      type: 'ASCEND_TO_FARM',
      target: stairsUp,
      targetId: null,
      reason,
      startTurn: game.turn,
    }
  }

  return null
}

export function getMorgothFlipReturnGoal(context: BotContext): BotGoal | null {
  const { botState } = context

  if (!botState.morgothFlipActive || botState.morgothFlipTargetDepth === null) {
    return null
  }

  return getLevelFlipReturnGoal(
    context,
    botState.morgothFlipTargetDepth,
    'Returning to depth 50 to hunt Morgoth'
  )
}

export function getMorgothHuntGoal(context: BotContext): BotGoal | null {
  const { game, botState, visibleMonsters } = context
  const character = game.character

  if (character.depth !== MAX_DEPTH) return null

  const morgothVisible = visibleMonsters.some(
    (m) => m.template.name === 'Morgoth, Lord of Darkness' && m.hp > 0
  )
  if (morgothVisible) {
    botState.morgothFlipActive = false
    botState.morgothFlipTargetDepth = null
    return null
  }

  const totalFloor = getLevelFloorCount(context)
  const seenThisVisitRate = totalFloor > 0 ? botState.seenThisVisit.size / totalFloor : 0

  if (botState.morgothFlipActive && botState.morgothFlipTargetDepth === MAX_DEPTH) {
    if (seenThisVisitRate < MORGOTH_FLIP_EXPLORATION_THRESHOLD) {
      botState.morgothFlipActive = false
      botState.morgothFlipTargetDepth = null
      return null
    }

    const stairsUp = botState.knownStairsUp ?? game.currentLevel.stairsUp
    if (stairsUp) {
      return {
        type: 'ASCEND_TO_FARM',
        target: stairsUp,
        targetId: null,
        reason: 'Level flip to find Morgoth (continuing)',
        startTurn: game.turn,
      }
    }
    botState.morgothFlipActive = false
    botState.morgothFlipTargetDepth = null
    return null
  }

  if (seenThisVisitRate < MORGOTH_FLIP_EXPLORATION_THRESHOLD) {
    return null
  }

  const stairsUp = botState.knownStairsUp ?? game.currentLevel.stairsUp
  if (!stairsUp) return null

  botState.morgothFlipActive = true
  botState.morgothFlipTargetDepth = MAX_DEPTH

  return {
    type: 'ASCEND_TO_FARM',
    target: stairsUp,
    targetId: null,
    reason: `Level flip to find Morgoth (${Math.round(seenThisVisitRate * 100)}% seen)`,
    startTurn: game.turn,
  }
}

// ============================================================================
// MAIN DISPATCHER
// ============================================================================

export function getProgressionGoal(context: BotContext): BotGoal | null {
  const { game, botState, effectiveConfig } = context
  const character = game.character
  const nextDepth = character.depth + 1
  const effective = getEffectiveCapabilities(context)

  if (botState.farmingMode && botState.farmBlockedDepth > 0) {
    const farmingGoal = profile('prog.activeFarm', () => handleActiveFarmingLoop(context))
    if (farmingGoal) return farmingGoal
  }

  // GATE: Preparedness check only if capability is enabled
  // Face-rush mode skips consumable requirements entirely
  if (effective.preparedness) {
    const readinessIssue = profile('prog.depthReadiness', () =>
      getDepthReadiness(character, character.inventory, nextDepth, effectiveConfig.caution)
    )
    if (readinessIssue) {
      const farmingGoal = profile('prog.initFarm', () => initiateFarmingLoop(context))
      if (farmingGoal) return farmingGoal
    }
  }

  if (botState.sweepMode && SQUISHY_CLASSES.has(character.classId)) {
    const sweepGoal = getSweepGoal(context)
    if (sweepGoal) return sweepGoal
  }

  const descendGoal = profile('prog.getDescendGoal', () => getDescendGoal(context))
  return descendGoal
}

// ============================================================================
// VISIBLE TILE RECORDING
// ============================================================================

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
