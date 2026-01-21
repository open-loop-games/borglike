/**
 * Flow-Based Pathfinding
 *
 * Computes reverse-BFS flow from destination.
 * The bot follows decreasing costs to reach the goal.
 */

import type { DungeonLevel, Point, Tile } from '../types'
import { getTile, isWalkable, getAdjacentPositions } from '../dungeon'
import type { FlowMap, FlowResult } from './types'
import { MAX_FLOW_COST } from './types'

/**
 * Check if tile is walkable or a closed door (bot can open doors)
 */
function isPassable(tile: Tile): boolean {
  return isWalkable(tile) || tile.type === 'door_closed'
}

/**
 * Compute reverse-BFS flow from goal
 *
 * Returns a map where each tile's value is its distance from the goal.
 * The bot navigates by following decreasing costs.
 *
 * @param level - Dungeon level to compute flow on
 * @param goal - Destination point
 * @param avoid - Set of "x,y" keys to exclude from pathing (danger/icky tiles)
 * @returns FlowMap with costs for all reachable tiles
 */
export function computeFlow(
  level: DungeonLevel,
  goal: Point,
  avoid: Set<string> = new Set()
): FlowMap {
  const costs: FlowMap = new Map()
  const queue: Array<{ pos: Point; cost: number }> = []

  // Start at goal with cost 0
  const goalKey = `${goal.x},${goal.y}`

  // Verify goal is valid (passable or at least exists)
  const goalTile = getTile(level, goal.x, goal.y)
  if (!goalTile) {
    return costs // Empty map if goal is out of bounds
  }

  // Allow goal even if not strictly walkable (e.g., closed door, stairs)
  costs.set(goalKey, 0)
  queue.push({ pos: goal, cost: 0 })

  // BFS expansion
  while (queue.length > 0) {
    const current = queue.shift()!
    const currentCost = costs.get(`${current.pos.x},${current.pos.y}`)!

    // Don't expand beyond MAX_FLOW_COST
    if (currentCost >= MAX_FLOW_COST - 1) continue

    // Expand to neighbors
    const neighbors = getAdjacentPositions(current.pos)

    for (const neighbor of neighbors) {
      const neighborKey = `${neighbor.x},${neighbor.y}`

      // Skip if already visited
      if (costs.has(neighborKey)) continue

      // Skip if in avoid set
      if (avoid.has(neighborKey)) continue

      // Check if passable
      const tile = getTile(level, neighbor.x, neighbor.y)
      if (!tile || !isPassable(tile)) continue

      // Set cost and enqueue
      const neighborCost = currentCost + 1
      costs.set(neighborKey, neighborCost)
      queue.push({ pos: neighbor, cost: neighborCost })
    }
  }

  return costs
}

/**
 * Create a FlowResult with metadata
 */
export function createFlowResult(goal: Point, costs: FlowMap, turn: number): FlowResult {
  return {
    goal: { x: goal.x, y: goal.y },
    costs,
    computedAt: turn,
  }
}

/**
 * Check if a flow result is still valid for a given goal
 */
export function isFlowValid(
  flow: FlowResult | null,
  goal: Point,
  currentTurn: number,
  maxAge: number = 10
): boolean {
  if (!flow) return false

  // Check if goal matches
  if (flow.goal.x !== goal.x || flow.goal.y !== goal.y) return false

  // Check if too old
  if (currentTurn - flow.computedAt > maxAge) return false

  return true
}

/**
 * Get cost to reach goal from a position
 * Returns MAX_FLOW_COST if unreachable
 */
export function getFlowCost(costs: FlowMap, pos: Point): number {
  const key = `${pos.x},${pos.y}`
  return costs.get(key) ?? MAX_FLOW_COST
}

/**
 * Check if a position is reachable (has a valid cost)
 */
export function isReachable(costs: FlowMap, pos: Point): boolean {
  return getFlowCost(costs, pos) < MAX_FLOW_COST
}

/**
 * Compute multi-goal flow for exploration (Dijkstra map approach)
 *
 * All frontier tiles (unexplored adjacent to explored) are goals with cost 0.
 * The bot follows decreasing costs toward the nearest unexplored area.
 * No target selection needed - just roll downhill.
 *
 * @param level - Dungeon level
 * @param frontierTiles - Array of frontier tile positions (unexplored but reachable)
 * @param avoid - Set of "x,y" keys to exclude from pathing
 * @returns FlowMap with costs to nearest frontier from any position
 */
export function computeExplorationFlow(
  level: DungeonLevel,
  frontierTiles: Point[],
  avoid: Set<string> = new Set()
): FlowMap {
  const costs: FlowMap = new Map()
  const queue: Array<{ pos: Point; cost: number }> = []

  // Start BFS from ALL frontier tiles simultaneously (cost 0)
  for (const frontier of frontierTiles) {
    const key = `${frontier.x},${frontier.y}`
    if (!costs.has(key)) {
      costs.set(key, 0)
      queue.push({ pos: frontier, cost: 0 })
    }
  }

  // BFS expansion outward from all frontiers
  while (queue.length > 0) {
    const current = queue.shift()!
    const currentCost = costs.get(`${current.pos.x},${current.pos.y}`)!

    if (currentCost >= MAX_FLOW_COST - 1) continue

    const neighbors = getAdjacentPositions(current.pos)

    for (const neighbor of neighbors) {
      const neighborKey = `${neighbor.x},${neighbor.y}`

      if (costs.has(neighborKey)) continue
      if (avoid.has(neighborKey)) continue

      const tile = getTile(level, neighbor.x, neighbor.y)
      // For exploration flow, only expand through EXPLORED passable tiles
      // (we're computing distance from frontiers back to where the bot can be)
      if (!tile || !tile.explored || !isPassable(tile)) continue

      const neighborCost = currentCost + 1
      costs.set(neighborKey, neighborCost)
      queue.push({ pos: neighbor, cost: neighborCost })
    }
  }

  return costs
}
