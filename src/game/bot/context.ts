/**
 * Bot Context Building
 *
 * Functions to build BotContext and provide status/danger queries.
 */

import type { GameState, BotPersonality, Point, DungeonLevel } from '../types'
import type { BotContext, BotState, PersonalityConfig } from './types'
import { getTile, getAdjacentPositions } from '../dungeon'
import { getPersonalityConfig } from './personality'
import { getClassProfile } from './class-profiles'

// ============================================================================
// CONTEXT BUILDING
// ============================================================================

/**
 * Create minimal bot state for context when not provided
 */
function createMinimalBotState(): BotState {
  return {
    recentPositions: [],
    currentGoal: null,
    goalTarget: null,
    levelEnterTurn: 0,
    turnsOnLevel: 0,
    currentDepth: 1,
    knownStairsDown: null,
    cachedFlow: null,
    cachedDanger: null,
    twitchCounter: 0,
    lastProgressTurn: 0,
    fleeCooldownUntil: 0,
    // Town tracking
    isInTown: false,
    townEntryTurn: 0,
    healerVisited: false,
    itemsSold: false,
    itemsBought: false,
  }
}

/**
 * Build bot context for decision making
 */
export function buildBotContext(
  game: GameState,
  personality: BotPersonality,
  botState?: BotState
): BotContext {
  const config = getPersonalityConfig(personality)

  // Get class-aware information
  const classId = game.character.classId
  const classProfile = getClassProfile(classId)
  const effectiveConfig = computeEffectiveConfig(config, classProfile)

  // Find visible monsters
  const visibleMonsters = game.monsters.filter((m) => {
    const tile = getTile(game.currentLevel, m.position.x, m.position.y)
    return tile?.visible ?? false
  })

  // Find visible items
  const visibleItems = game.items.filter((item) => {
    const tile = getTile(game.currentLevel, item.position.x, item.position.y)
    return tile?.visible ?? false
  })

  // Find known stairs
  const knownStairs = findKnownStairs(game)

  // Find unexplored tiles (frontier)
  const unexploredTiles = findUnexploredTiles(game)

  return {
    game,
    personality,
    config,
    classId,
    classProfile,
    effectiveConfig,
    visibleMonsters,
    visibleItems,
    knownStairs,
    unexploredTiles,
    botState: botState ?? createMinimalBotState(),
  }
}

/**
 * Compute effective config by blending personality with class modifiers
 */
function computeEffectiveConfig(
  config: PersonalityConfig,
  profile: { aggressionMod: number; cautionMod: number }
): PersonalityConfig {
  return {
    aggression: clamp(config.aggression + profile.aggressionMod, 0, 100),
    greed: config.greed,
    caution: clamp(config.caution + profile.cautionMod, 0, 100),
    exploration: config.exploration,
    patience: config.patience,
  }
}

/**
 * Clamp a value between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Find explored stairs down position
 */
function findKnownStairs(game: GameState): Point | null {
  const level = game.currentLevel

  // Check if stairs down location is explored
  if (level.stairsDown) {
    const tile = getTile(level, level.stairsDown.x, level.stairsDown.y)
    if (tile?.explored) {
      return level.stairsDown
    }
  }

  return null
}

/**
 * Find unexplored tiles adjacent to explored tiles (frontier)
 */
function findUnexploredTiles(game: GameState): Point[] {
  const frontier: Point[] = []
  const level = game.currentLevel

  for (let y = 0; y < level.height; y++) {
    const row = level.tiles[y]
    if (!row) continue

    for (let x = 0; x < level.width; x++) {
      const tile = row[x]
      if (!tile) continue

      // We want unexplored tiles that are adjacent to explored tiles
      if (!tile.explored) {
        // Check if any adjacent tile is explored
        const hasExploredNeighbor = checkAdjacentExplored(level, x, y)
        if (hasExploredNeighbor) {
          frontier.push({ x, y })
        }
      }
    }
  }

  return frontier
}

/**
 * Check if any adjacent tile is explored
 */
function checkAdjacentExplored(level: DungeonLevel, x: number, y: number): boolean {
  const neighbors = getAdjacentPositions({ x, y })

  for (const neighbor of neighbors) {
    const tile = getTile(level, neighbor.x, neighbor.y)
    if (tile?.explored) return true
  }

  return false
}

// ============================================================================
// STATUS & DANGER
// ============================================================================

/**
 * Get bot status string for debugging
 */
export function getBotStatus(context: BotContext): string {
  const { game, botState } = context
  const pos = game.character.position
  const goal = botState.currentGoal

  const parts = [
    `Pos: (${pos.x},${pos.y})`,
    `Depth: ${game.character.depth}`,
    `HP: ${game.character.hp}/${game.character.maxHp}`,
    `Goal: ${goal?.type ?? 'NONE'}`,
  ]

  if (goal?.target) {
    parts.push(`Target: (${goal.target.x},${goal.target.y})`)
  }

  parts.push(`Monsters: ${context.visibleMonsters.length}`)
  parts.push(`Items: ${context.visibleItems.length}`)
  parts.push(`Turns: ${botState.turnsOnLevel}`)

  return parts.join(' | ')
}

/**
 * Evaluate current danger level
 * Phase 1: Simple stub based on visible monster count
 * Phase 2: Full danger grid implementation
 */
export function evaluateDanger(context: BotContext): number {
  // Simple danger evaluation for Phase 1
  // Just count visible monsters and their threat
  let danger = 0

  for (const monster of context.visibleMonsters) {
    // Base danger from monster depth/power
    danger += monster.template.minDepth * 10

    // Extra danger if monster is awake
    if (monster.isAwake) {
      danger += 20
    }

    // Extra danger if monster is adjacent
    const dist = manhattanDistance(context.game.character.position, monster.position)
    if (dist <= 1) {
      danger += 50
    } else if (dist <= 3) {
      danger += 20
    }
  }

  // Scale by HP ratio (lower HP = higher perceived danger)
  const hpRatio = context.game.character.hp / context.game.character.maxHp
  if (hpRatio < 0.5) {
    danger *= 1.5
  }
  if (hpRatio < 0.25) {
    danger *= 2
  }

  return Math.floor(danger)
}

/**
 * Calculate Manhattan distance between two points
 */
function manhattanDistance(a: Point, b: Point): number {
  return Math.abs(b.x - a.x) + Math.abs(b.y - a.y)
}
