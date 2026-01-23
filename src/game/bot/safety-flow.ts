/**
 * Safety Flow - Inverted Dijkstra Maps for Flee Behavior
 *
 * Implements the "inverted Dijkstra" technique from "The Incredible Power of Dijkstra Maps":
 * 1. Compute distance map FROM all monster positions (multi-source BFS)
 * 2. Multiply all values by -1.2 (inversion coefficient)
 * 3. Re-scan to create flow toward safety maxima
 * 4. Bot "rolls downhill" toward intelligent escape routes
 *
 * The -1.2 coefficient (not -1.0) creates preference for global safety maxima
 * over local ones - a cornered bot recognizes that sprinting PAST danger
 * to a door is better than backing into a corner.
 */

import type { DungeonLevel, Point, Monster, Tile } from '../types'
import type { SafetyFlowResult } from './types'
import { getTile, isWalkable, getAdjacentPositions } from '../dungeon'

// ============================================================================
// CONSTANTS
// ============================================================================

/** Inversion coefficient - values > 1.0 prefer global maxima over local */
const SAFETY_INVERSION_COEFFICIENT = -1.2

/** Maximum steps to look ahead when rolling downhill */
const MAX_ESCAPE_LOOKAHEAD = 10

/** Tiles within this distance of global minimum become safety anchors */
const SAFETY_ANCHOR_THRESHOLD = 3

/** Maximum value for unreachable tiles */
const MAX_COST = 9999

// ============================================================================
// CORE ALGORITHM
// ============================================================================

/**
 * Compute safety flow and find escape target
 *
 * @param level - Current dungeon level
 * @param monsters - All monsters to flee from
 * @param playerPos - Player's current position
 * @param turn - Current game turn (for caching)
 * @returns SafetyFlowResult with escape target or null if surrounded
 */
export function computeSafetyFlow(
  level: DungeonLevel,
  monsters: Monster[],
  playerPos: Point,
  turn: number
): SafetyFlowResult {
  // Early exit if no monsters
  if (monsters.length === 0) {
    return { target: null, safetyMap: new Map(), computedAt: turn }
  }

  // Step 1: Compute monster distance map (multi-source BFS)
  const monsterDistMap = computeMonsterDistanceMap(level, monsters)

  // Step 2: Invert the map
  const invertedMap = invertMap(monsterDistMap)

  // Step 3: Re-scan to find safety basins
  const safetyMap = rescanInvertedMap(level, invertedMap)

  // Step 4: Roll downhill from player position to find escape target
  const target = findEscapeTarget(level, safetyMap, playerPos, monsters)

  return { target, safetyMap, computedAt: turn }
}

/**
 * Step 1: Multi-source BFS from all monster positions
 *
 * Each tile's value = distance to nearest monster
 */
function computeMonsterDistanceMap(level: DungeonLevel, monsters: Monster[]): Map<string, number> {
  const distMap = new Map<string, number>()
  const queue: Array<{ pos: Point; dist: number }> = []

  // Initialize all monster positions with distance 0
  for (const monster of monsters) {
    if (monster.hp <= 0) continue
    const key = `${monster.position.x},${monster.position.y}`
    if (!distMap.has(key)) {
      distMap.set(key, 0)
      queue.push({ pos: monster.position, dist: 0 })
    }
  }

  // BFS expansion
  while (queue.length > 0) {
    const current = queue.shift()!
    const currentDist = current.dist

    // Limit expansion to reasonable range
    if (currentDist >= 50) continue

    const neighbors = getAdjacentPositions(current.pos)
    for (const neighbor of neighbors) {
      const key = `${neighbor.x},${neighbor.y}`
      if (distMap.has(key)) continue

      const tile = getTile(level, neighbor.x, neighbor.y)
      if (!tile || !isPassable(tile)) continue

      distMap.set(key, currentDist + 1)
      queue.push({ pos: neighbor, dist: currentDist + 1 })
    }
  }

  return distMap
}

/**
 * Step 2: Invert the distance map
 *
 * inverted[tile] = monsterDist[tile] * -1.2
 * Tiles far from monsters become most negative
 */
function invertMap(distMap: Map<string, number>): Map<string, number> {
  const inverted = new Map<string, number>()

  for (const [key, dist] of distMap) {
    inverted.set(key, dist * SAFETY_INVERSION_COEFFICIENT)
  }

  return inverted
}

/**
 * Step 3: Re-scan the inverted map to create drainage basins
 *
 * Dijkstra from safety anchors (tiles near global minimum)
 * Creates smooth gradients flowing toward safety maxima
 */
function rescanInvertedMap(
  level: DungeonLevel,
  invertedMap: Map<string, number>
): Map<string, number> {
  // Find global minimum (most negative = safest spots)
  let globalMin = 0
  for (const value of invertedMap.values()) {
    if (value < globalMin) {
      globalMin = value
    }
  }

  // Find all tiles within threshold of global minimum (safety anchors)
  const anchors: Point[] = []
  const anchorThreshold = globalMin + SAFETY_ANCHOR_THRESHOLD

  for (const [key, value] of invertedMap) {
    if (value <= anchorThreshold) {
      const [x, y] = key.split(',').map(Number)
      anchors.push({ x: x!, y: y! })
    }
  }

  // If no anchors found, return original map
  if (anchors.length === 0) {
    return invertedMap
  }

  // Dijkstra from anchors to create smooth gradient
  const safetyMap = new Map<string, number>()
  const queue: Array<{ pos: Point; cost: number }> = []

  // Initialize anchors with their inverted values
  for (const anchor of anchors) {
    const key = `${anchor.x},${anchor.y}`
    const value = invertedMap.get(key) ?? 0
    safetyMap.set(key, value)
    queue.push({ pos: anchor, cost: value })
  }

  // Sort queue by cost (priority queue simulation)
  queue.sort((a, b) => a.cost - b.cost)

  // Dijkstra expansion
  while (queue.length > 0) {
    const current = queue.shift()!
    const currentKey = `${current.pos.x},${current.pos.y}`
    const currentCost = safetyMap.get(currentKey)

    // Skip if we've found a better path
    if (currentCost !== undefined && currentCost < current.cost) continue

    const neighbors = getAdjacentPositions(current.pos)
    for (const neighbor of neighbors) {
      const neighborKey = `${neighbor.x},${neighbor.y}`

      // Only expand to tiles in the original map
      if (!invertedMap.has(neighborKey)) continue

      const tile = getTile(level, neighbor.x, neighbor.y)
      if (!tile || !isPassable(tile)) continue

      // Cost increases as we move away from anchors
      const newCost = current.cost + 1

      const existingCost = safetyMap.get(neighborKey)
      if (existingCost === undefined || newCost < existingCost) {
        safetyMap.set(neighborKey, newCost)
        queue.push({ pos: neighbor, cost: newCost })
        // Re-sort (simple priority queue)
        queue.sort((a, b) => a.cost - b.cost)
      }
    }
  }

  return safetyMap
}

/**
 * Step 4: Roll downhill from player position to find escape target
 *
 * Follow decreasing safety values to find the best escape route
 */
function findEscapeTarget(
  level: DungeonLevel,
  safetyMap: Map<string, number>,
  playerPos: Point,
  monsters: Monster[]
): Point | null {
  // Build set of monster positions for quick lookup
  const monsterPositions = new Set<string>()
  for (const monster of monsters) {
    if (monster.hp > 0) {
      monsterPositions.add(`${monster.position.x},${monster.position.y}`)
    }
  }

  let current = playerPos
  let currentKey = `${current.x},${current.y}`
  let currentCost = safetyMap.get(currentKey) ?? MAX_COST

  // Track visited to avoid loops
  const visited = new Set<string>([currentKey])

  // Roll downhill for up to MAX_ESCAPE_LOOKAHEAD steps
  for (let step = 0; step < MAX_ESCAPE_LOOKAHEAD; step++) {
    const neighbors = getAdjacentPositions(current)
    let bestNeighbor: Point | null = null
    let bestCost = currentCost

    for (const neighbor of neighbors) {
      const neighborKey = `${neighbor.x},${neighbor.y}`

      // Skip visited
      if (visited.has(neighborKey)) continue

      // Skip monster positions
      if (monsterPositions.has(neighborKey)) continue

      // Check walkability
      const tile = getTile(level, neighbor.x, neighbor.y)
      if (!tile || !isPassable(tile)) continue

      const neighborCost = safetyMap.get(neighborKey) ?? MAX_COST

      // Look for lower cost (more negative = safer)
      if (neighborCost < bestCost) {
        bestCost = neighborCost
        bestNeighbor = neighbor
      }
    }

    // If no better neighbor found, we've reached a local minimum
    if (!bestNeighbor) break

    // Move to best neighbor
    current = bestNeighbor
    currentKey = `${current.x},${current.y}`
    currentCost = bestCost
    visited.add(currentKey)
  }

  // If we didn't move at all, we're surrounded
  if (current.x === playerPos.x && current.y === playerPos.y) {
    return null
  }

  return current
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Check if tile is passable (walkable or closed door)
 */
function isPassable(tile: Tile): boolean {
  return isWalkable(tile) || tile.type === 'door_closed'
}
