/**
 * Stuck Detection and Recovery
 *
 * Detects when the bot is making no progress and provides
 * escalating recovery actions to break out of stuck states.
 */

import type { Point, GameState, Direction } from '../types'
import { getTile, isWalkable } from '../dungeon'
import type { BotState } from './types'

// ============================================================================
// CONSTANTS
// ============================================================================

/** Turns without progress before twitch level increases */
export const TWITCH_THRESHOLDS = {
  LEVEL_1: 5, // Start wall following quickly
  LEVEL_2: 12, // Clear history and retry
  LEVEL_3: 25, // Force descent if stairs known
  LEVEL_4: 50, // Give up, just wait
}

/** Number of recent positions to check for oscillation */
const OSCILLATION_WINDOW = 8

/** Response types for stuck situations */
export type StuckResponse =
  | 'normal'
  | 'wall_follow' // Follow walls to find new areas
  | 'clear_history' // Clear position history and re-evaluate
  | 'force_combat' // Attack nearest monster
  | 'force_descent' // Head to stairs ignoring exploration
  | 'stop_fleeing' // Stop fleeing and switch to combat/explore
  | 'wait' // Give up

// ============================================================================
// DETECTION
// ============================================================================

/**
 * Detect stuck level based on bot state
 *
 * @returns Twitch level 0-4 (0 = not stuck, 4 = severely stuck)
 */
export function detectStuckLevel(state: BotState, game: GameState): number {
  const turnsSinceProgress = game.turn - state.lastProgressTurn

  // Check for oscillation pattern (A-B-A-B)
  if (isOscillating(state)) {
    // Oscillation is treated as level 1 stuck immediately
    return Math.max(1, getTwitchLevel(turnsSinceProgress))
  }

  return getTwitchLevel(turnsSinceProgress)
}

/**
 * Get twitch level from turns since progress
 */
function getTwitchLevel(turnsSinceProgress: number): number {
  if (turnsSinceProgress >= TWITCH_THRESHOLDS.LEVEL_4) return 4
  if (turnsSinceProgress >= TWITCH_THRESHOLDS.LEVEL_3) return 3
  if (turnsSinceProgress >= TWITCH_THRESHOLDS.LEVEL_2) return 2
  if (turnsSinceProgress >= TWITCH_THRESHOLDS.LEVEL_1) return 1
  return 0
}

/**
 * Check if the bot is oscillating between positions
 * Detects A-B-A-B or A-B-C-A-B-C patterns
 */
export function isOscillating(state: BotState): boolean {
  const history = state.recentPositions
  if (history.length < 4) return false

  // Check for A-B-A-B pattern (period 2)
  const len = history.length
  if (len >= 4) {
    const a1 = history[len - 1]!
    const b1 = history[len - 2]!
    const a2 = history[len - 3]!
    const b2 = history[len - 4]!

    if (isSamePos(a1, a2) && isSamePos(b1, b2)) {
      return true
    }
  }

  // Check for A-B-C-A-B-C pattern (period 3)
  if (len >= 6) {
    const a1 = history[len - 1]!
    const b1 = history[len - 2]!
    const c1 = history[len - 3]!
    const a2 = history[len - 4]!
    const b2 = history[len - 5]!
    const c2 = history[len - 6]!

    if (isSamePos(a1, a2) && isSamePos(b1, b2) && isSamePos(c1, c2)) {
      return true
    }
  }

  return false
}

/**
 * Check if position appears too frequently in recent history
 */
export function isPositionOvervisited(state: BotState, pos: Point): boolean {
  const recentWindow = state.recentPositions.slice(-OSCILLATION_WINDOW)
  const visitCount = recentWindow.filter((p) => p.x === pos.x && p.y === pos.y).length

  // If we've visited this position more than 3 times in last 8 moves, it's overvisited
  return visitCount >= 3
}

// ============================================================================
// RECOVERY
// ============================================================================

/**
 * Get the appropriate response for a stuck level
 */
export function getStuckResponse(
  stuckLevel: number,
  hasAdjacentMonster: boolean,
  hasKnownStairs: boolean,
  isFleeing: boolean = false
): StuckResponse {
  switch (stuckLevel) {
    case 0:
      return 'normal'

    case 1:
      // If stuck while fleeing, stop fleeing early - we're not getting anywhere
      if (isFleeing) {
        return 'stop_fleeing'
      }
      // Try wall following to systematically find new areas
      return 'wall_follow'

    case 2:
      // If fleeing isn't working, stop and fight/explore
      if (isFleeing) {
        return 'stop_fleeing'
      }
      // Clear history and let normal pathfinding try again
      // Or fight if there's a monster blocking
      if (hasAdjacentMonster) {
        return 'force_combat'
      }
      return 'clear_history'

    case 3:
      // Force descent if stairs are known
      if (hasKnownStairs) {
        return 'force_descent'
      }
      if (hasAdjacentMonster) {
        return 'force_combat'
      }
      return 'clear_history'

    case 4:
    default:
      // Severely stuck - just wait and hope something changes
      return 'wait'
  }
}

/**
 * Wall following direction for stuck recovery
 *
 * Uses right-hand rule: keep wall on right side
 * Returns the direction to move to follow the wall
 */
export function getWallFollowDirection(
  game: GameState,
  state: BotState
): Direction | null {
  const pos = game.character.position

  // Determine current facing based on last move
  const lastPos = state.recentPositions.length > 0
    ? state.recentPositions[state.recentPositions.length - 1]!
    : null

  // If no last position, pick initial direction based on nearby walls
  let facing = getInitialFacing(game, pos)

  if (lastPos && (lastPos.x !== pos.x || lastPos.y !== pos.y)) {
    // We moved - facing is direction we moved
    const dx = pos.x - lastPos.x
    const dy = pos.y - lastPos.y
    facing = deltaToDirection(dx, dy) ?? facing
  }

  // Right-hand rule: try directions in order (right, forward, left, back)
  const tryOrder = getRightHandOrder(facing)

  for (const dir of tryOrder) {
    const delta = directionToDelta(dir)
    const target = { x: pos.x + delta.x, y: pos.y + delta.y }

    const tile = getTile(game.currentLevel, target.x, target.y)
    if (!tile) continue
    if (!isWalkable(tile) && tile.type !== 'door_closed') continue

    // Check if occupied by monster
    const hasMonster = game.monsters.some(
      (m) => m.position.x === target.x && m.position.y === target.y
    )
    if (hasMonster) continue

    return dir
  }

  return null
}

/**
 * Get initial facing direction based on nearby walls
 */
function getInitialFacing(game: GameState, pos: Point): Direction {
  // Find a wall and face away from it
  const directions: Direction[] = ['n', 's', 'e', 'w']

  for (const dir of directions) {
    const delta = directionToDelta(dir)
    const adj = { x: pos.x + delta.x, y: pos.y + delta.y }
    const tile = getTile(game.currentLevel, adj.x, adj.y)

    if (!tile || tile.type === 'wall') {
      // Wall found in this direction, face opposite
      return oppositeDirection(dir)
    }
  }

  return 'e' // Default: face east
}

/**
 * Get directions to try in right-hand rule order
 */
function getRightHandOrder(facing: Direction): Direction[] {
  const cardinals: Direction[] = ['n', 'e', 's', 'w']
  const idx = cardinals.indexOf(facing as 'n' | 'e' | 's' | 'w')

  if (idx === -1) {
    // Diagonal facing - simplify to nearest cardinal
    if (facing === 'ne' || facing === 'se') return getRightHandOrder('e')
    if (facing === 'nw' || facing === 'sw') return getRightHandOrder('w')
    return ['e', 's', 'w', 'n']
  }

  // Right, Forward, Left, Back
  return [
    cardinals[(idx + 1) % 4]!, // Right
    cardinals[idx]!,           // Forward
    cardinals[(idx + 3) % 4]!, // Left
    cardinals[(idx + 2) % 4]!, // Back
  ]
}

function oppositeDirection(dir: Direction): Direction {
  const opposites: Record<Direction, Direction> = {
    n: 's', s: 'n', e: 'w', w: 'e',
    ne: 'sw', nw: 'se', se: 'nw', sw: 'ne',
    wait: 'wait',
  }
  return opposites[dir]
}

function directionToDelta(dir: Direction): Point {
  const deltas: Record<Direction, Point> = {
    n: { x: 0, y: -1 }, s: { x: 0, y: 1 },
    e: { x: 1, y: 0 }, w: { x: -1, y: 0 },
    ne: { x: 1, y: -1 }, nw: { x: -1, y: -1 },
    se: { x: 1, y: 1 }, sw: { x: -1, y: 1 },
    wait: { x: 0, y: 0 },
  }
  return deltas[dir]
}

function deltaToDirection(dx: number, dy: number): Direction | null {
  if (dx === 0 && dy === -1) return 'n'
  if (dx === 0 && dy === 1) return 's'
  if (dx === 1 && dy === 0) return 'e'
  if (dx === -1 && dy === 0) return 'w'
  if (dx === 1 && dy === -1) return 'ne'
  if (dx === -1 && dy === -1) return 'nw'
  if (dx === 1 && dy === 1) return 'se'
  if (dx === -1 && dy === 1) return 'sw'
  return null
}

/**
 * Clear position history to allow revisiting tiles
 */
export function clearPositionHistory(state: BotState): void {
  state.recentPositions = []
}

// ============================================================================
// HELPERS
// ============================================================================

function isSamePos(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y
}

/**
 * Check if bot has been on same position for too long
 */
export function isStationaryTooLong(state: BotState, threshold: number = 5): boolean {
  const history = state.recentPositions
  if (history.length < threshold) return false

  const current = history[history.length - 1]
  if (!current) return false

  // Check if last N positions are all the same
  for (let i = history.length - threshold; i < history.length; i++) {
    const pos = history[i]
    if (!pos || pos.x !== current.x || pos.y !== current.y) {
      return false
    }
  }

  return true
}

/**
 * Get debug info about stuck state
 */
export function getStuckDebugInfo(state: BotState, game: GameState): string {
  const stuckLevel = detectStuckLevel(state, game)
  const oscillating = isOscillating(state)
  const turnsSinceProgress = game.turn - state.lastProgressTurn

  return `Stuck L${stuckLevel} | Progress: ${turnsSinceProgress}t ago | Osc: ${oscillating} | Twitch: ${state.twitchCounter}`
}
