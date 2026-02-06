/**
 * Movement and Step Selection
 *
 * Select the best step toward goal using flow costs and anti-oscillation.
 */

import type { Point, GameState, Direction } from '../types'
import { getTile, isWalkable, getAdjacentPositions } from '../dungeon'
import { getDirectionFromDelta, isAdjacent } from '../types'

// Re-export for convenience
export { isAdjacent }
import type { BotState } from './types'
import { CARDINAL_DIRECTIONS } from './types'
import type { FlowGrid } from './flow'
import { getFlowCost, MAX_FLOW_COST } from './flow'
import { getRecencyPenalty } from './state'

/** Step candidate with scoring info */
interface StepCandidate {
  pos: Point
  direction: Direction
  flowCost: number
  isCardinal: boolean
  visitPenalty: number
  totalScore: number
}

/**
 * Select the best step toward goal using flow costs
 *
 * @param game - Current game state
 * @param botState - Bot's persistent state (for history)
 * @param flowCosts - Pre-computed flow costs from goal
 * @returns Direction to move, or 'wait' if stuck
 */
export function selectStep(game: GameState, botState: BotState, flowCosts: FlowGrid): Direction {
  const pos = game.character.position
  const currentCost = getFlowCost(flowCosts, pos)

  // If we're at the goal (cost 0), don't move
  if (currentCost === 0) {
    return 'wait'
  }

  // Get all adjacent positions
  const adjacent = getAdjacentPositions(pos)
  const candidates: StepCandidate[] = []

  // Build occupied set (monster positions)
  const occupied = new Set<string>()
  for (const monster of game.monsters) {
    occupied.add(`${monster.position.x},${monster.position.y}`)
  }

  for (const adj of adjacent) {
    // Skip if out of bounds or not walkable
    const tile = getTile(game.currentLevel, adj.x, adj.y)
    if (!tile) continue

    // Allow closed doors (we'll bump to open them)
    const canEnter = isWalkable(tile) || tile.type === 'door_closed'
    if (!canEnter) continue

    // Skip if occupied by monster (combat handled separately)
    const adjKey = `${adj.x},${adj.y}`
    if (occupied.has(adjKey)) continue

    // Get direction
    const dx = adj.x - pos.x
    const dy = adj.y - pos.y
    const direction = getDirectionFromDelta(dx, dy)
    if (!direction) continue

    // Get flow cost
    const flowCost = getFlowCost(flowCosts, adj)

    // Skip if unreachable
    if (flowCost >= MAX_FLOW_COST) continue
    // Prefer moving toward goal, but allow sideways movement if no better option
    // (sideways = same cost, will be penalized in scoring)

    // Check if cardinal direction
    const isCardinal = CARDINAL_DIRECTIONS.includes(direction)

    // Calculate visit penalty (higher = more recently visited)
    // Uses recency-weighted penalty to strongly discourage oscillation
    const visitPenalty = getRecencyPenalty(botState, adj)

    // Calculate total score (lower is better)
    // Primary: flow cost (distance to goal)
    // Penalty for not improving: +50 for same cost, +100 for worse
    // Secondary: cardinal preference (-5 bonus)
    // Tertiary: avoid recently visited (+10 per visit)
    let progressPenalty = 0
    if (flowCost > currentCost) {
      progressPenalty = 100 // Moving away from goal - bad
    } else if (flowCost === currentCost) {
      progressPenalty = 50 // Sideways movement - acceptable but not preferred
    }
    const totalScore = flowCost + progressPenalty + (isCardinal ? -5 : 0) + visitPenalty

    candidates.push({
      pos: adj,
      direction,
      flowCost,
      isCardinal,
      visitPenalty,
      totalScore,
    })
  }

  // No valid moves? Wait
  if (candidates.length === 0) {
    return 'wait'
  }

  // Sort by total score (ascending - lower is better)
  candidates.sort((a, b) => a.totalScore - b.totalScore)

  // Return best candidate's direction
  return candidates[0]!.direction
}

/**
 * Get the direction to move toward a specific adjacent target
 * Used when we know exactly where we want to go
 */
export function getDirectionTo(from: Point, to: Point): Direction | null {
  const dx = to.x - from.x
  const dy = to.y - from.y

  // Must be adjacent
  if (Math.abs(dx) > 1 || Math.abs(dy) > 1) return null
  if (dx === 0 && dy === 0) return 'wait'

  return getDirectionFromDelta(dx, dy)
}

/**
 * Get all walkable adjacent positions
 */
export function getWalkableAdjacent(game: GameState, pos: Point): Point[] {
  const adjacent = getAdjacentPositions(pos)
  const walkable: Point[] = []

  for (const adj of adjacent) {
    const tile = getTile(game.currentLevel, adj.x, adj.y)
    if (tile && (isWalkable(tile) || tile.type === 'door_closed')) {
      walkable.push(adj)
    }
  }

  return walkable
}
