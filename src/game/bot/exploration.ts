/**
 * Exploration Logic
 *
 * Handles efficient dungeon exploration with frontier detection,
 * smart target selection, and progress tracking.
 */

import type { GameState, Point, DungeonLevel, Tile } from '../types'
import type { BotState } from './types'
import { getTile, isWalkable, getAdjacentPositions } from '../dungeon'

// ============================================================================
// TYPES
// ============================================================================

/** A frontier tile with scoring information */
export interface FrontierTile {
  /** Position of the frontier tile */
  position: Point
  /** Number of unexplored neighbors (exploration potential) */
  unexploredNeighbors: number
  /** Distance from player position */
  distance: number
  /** Combined score (higher = better target) */
  score: number
}

/** Exploration cluster - group of nearby unexplored tiles */
export interface ExplorationCluster {
  /** Center of the cluster */
  center: Point
  /** Number of unexplored tiles in cluster */
  size: number
  /** Nearest explored walkable tile to reach cluster */
  entryPoint: Point | null
}

/** Exploration statistics */
export interface ExplorationStats {
  /** Total explorable tiles (floor, doors) */
  totalExplorableTiles: number
  /** Number of explored tiles */
  exploredTiles: number
  /** Exploration progress (0-100) */
  progress: number
  /** Number of frontier tiles */
  frontierSize: number
  /** Are stairs found? */
  stairsFound: boolean
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum distance to consider for exploration targets */
const MAX_EXPLORATION_DISTANCE = 50

/** Minimum cluster size to prioritize */
const MIN_CLUSTER_SIZE = 3

// ============================================================================
// FRONTIER DETECTION
// ============================================================================

/**
 * Find all frontier tiles with scoring
 * Frontier = unexplored tiles adjacent to explored walkable tiles
 */
export function findFrontierTiles(game: GameState): FrontierTile[] {
  const level = game.currentLevel
  const pos = game.character.position
  const frontier: FrontierTile[] = []

  for (let y = 0; y < level.height; y++) {
    const row = level.tiles[y]
    if (!row) continue

    for (let x = 0; x < level.width; x++) {
      const tile = row[x]
      if (!tile || tile.explored) continue

      // IMPORTANT: Only consider walkable tiles (floors, doors) as frontier
      // Walls and other non-walkable tiles cannot be explored
      if (!isWalkableOrDoor(tile) && tile.type !== 'stairs_down' && tile.type !== 'stairs_up') {
        continue
      }

      // Check if this unexplored tile is adjacent to explored walkable
      const neighbors = getAdjacentPositions({ x, y })
      let hasExploredWalkable = false
      let unexploredCount = 0

      for (const neighbor of neighbors) {
        const neighborTile = getTile(level, neighbor.x, neighbor.y)
        if (!neighborTile) continue

        if (neighborTile.explored && isWalkableOrDoor(neighborTile)) {
          hasExploredWalkable = true
        }
        if (!neighborTile.explored) {
          unexploredCount++
        }
      }

      if (hasExploredWalkable) {
        const distance = chebyshevDistance(pos, { x, y })

        // Score: prefer closer tiles with more unexplored potential
        // Higher unexploredCount = more tiles to reveal when we explore here
        const score = unexploredCount * 10 - distance

        frontier.push({
          position: { x, y },
          unexploredNeighbors: unexploredCount,
          distance,
          score,
        })
      }
    }
  }

  // Sort by score (descending)
  frontier.sort((a, b) => b.score - a.score)

  return frontier
}

/**
 * Find the best exploration target
 * Returns a walkable tile that will reveal new areas
 */
export function findExplorationTarget(
  game: GameState,
  botState: BotState
): Point | null {
  const level = game.currentLevel
  const pos = game.character.position

  // Get frontier tiles
  const frontier = findFrontierTiles(game)

  if (frontier.length === 0) {
    return null
  }

  // Find the best reachable target
  // We need to find an explored walkable tile adjacent to the frontier
  let bestTarget: Point | null = null
  let bestScore = -Infinity

  for (const f of frontier) {
    // Find the nearest explored walkable tile to this frontier tile
    const entryPoint = findNearestWalkableExplored(level, f.position)
    if (!entryPoint) continue

    // Calculate final score
    // Prefer: high potential (unexplored neighbors), close to us, not recently visited
    const distanceToEntry = chebyshevDistance(pos, entryPoint)
    if (distanceToEntry > MAX_EXPLORATION_DISTANCE) continue

    // Visit penalty: avoid recently explored areas
    const visitPenalty = getRecentVisitPenalty(botState, entryPoint)

    const finalScore = f.score - distanceToEntry - visitPenalty

    if (finalScore > bestScore) {
      bestScore = finalScore
      bestTarget = entryPoint
    }
  }

  return bestTarget
}

/**
 * Find nearest explored walkable tile to a position
 */
function findNearestWalkableExplored(level: DungeonLevel, pos: Point): Point | null {
  const neighbors = getAdjacentPositions(pos)

  for (const neighbor of neighbors) {
    const tile = getTile(level, neighbor.x, neighbor.y)
    if (tile?.explored && isWalkableOrDoor(tile)) {
      // Direct neighbor is best
      return neighbor
    }
  }

  // If no direct neighbor, return null and let caller handle
  return null
}

/**
 * Get penalty for recently visited positions
 */
function getRecentVisitPenalty(botState: BotState, pos: Point): number {
  let penalty = 0
  const recent = botState.recentPositions

  for (let i = 0; i < recent.length; i++) {
    const p = recent[i]
    if (!p) continue
    if (p.x === pos.x && p.y === pos.y) {
      // More recent = higher penalty
      penalty += 20 - i
    }
    // Also penalize nearby positions
    const dist = chebyshevDistance(p, pos)
    if (dist <= 2) {
      penalty += (5 - dist) * (recent.length - i) / recent.length
    }
  }

  return penalty
}

// ============================================================================
// EXPLORATION PROGRESS
// ============================================================================

/**
 * Calculate detailed exploration statistics
 */
export function getExplorationStats(game: GameState): ExplorationStats {
  const level = game.currentLevel
  let totalExplorable = 0
  let explored = 0

  for (let y = 0; y < level.height; y++) {
    const row = level.tiles[y]
    if (!row) continue

    for (let x = 0; x < level.width; x++) {
      const tile = row[x]
      if (!tile) continue

      // Count floor, doors as explorable
      if (isExplorableTile(tile)) {
        totalExplorable++
        if (tile.explored) {
          explored++
        }
      }
    }
  }

  const progress = totalExplorable > 0 ? Math.floor((explored / totalExplorable) * 100) : 100
  const frontier = findFrontierTiles(game)

  // Check if stairs are found
  const stairsFound = level.stairsDown
    ? getTile(level, level.stairsDown.x, level.stairsDown.y)?.explored ?? false
    : false

  return {
    totalExplorableTiles: totalExplorable,
    exploredTiles: explored,
    progress,
    frontierSize: frontier.length,
    stairsFound,
  }
}

/**
 * Get exploration progress as percentage (0-100)
 */
export function getExplorationProgress(game: GameState): number {
  return getExplorationStats(game).progress
}

/**
 * Check if exploration goal is met based on personality
 */
export function shouldStopExploring(
  game: GameState,
  botState: BotState,
  explorationThreshold: number,
  patienceThreshold: number
): boolean {
  const stats = getExplorationStats(game)

  // Stop if: explored enough
  if (stats.progress >= explorationThreshold) {
    return true
  }

  // Stop if: patience exceeded
  if (botState.turnsOnLevel >= patienceThreshold) {
    return true
  }

  // Stop if: no more frontier and stairs found
  if (stats.frontierSize === 0 && stats.stairsFound) {
    return true
  }

  return false
}

// ============================================================================
// CLUSTER DETECTION
// ============================================================================

/**
 * Find clusters of unexplored tiles
 * Useful for prioritizing exploration of larger unknown areas
 */
export function findExplorationClusters(game: GameState): ExplorationCluster[] {
  const level = game.currentLevel
  const visited = new Set<string>()
  const clusters: ExplorationCluster[] = []

  for (let y = 0; y < level.height; y++) {
    const row = level.tiles[y]
    if (!row) continue

    for (let x = 0; x < level.width; x++) {
      const key = `${x},${y}`
      if (visited.has(key)) continue

      const tile = row[x]
      if (!tile || tile.explored) continue

      // Found an unexplored tile - flood fill to find cluster
      const cluster = floodFillCluster(level, { x, y }, visited)
      if (cluster.size >= MIN_CLUSTER_SIZE) {
        clusters.push(cluster)
      }
    }
  }

  // Sort by size (largest first)
  clusters.sort((a, b) => b.size - a.size)

  return clusters
}

/**
 * Flood fill to find connected unexplored tiles
 */
function floodFillCluster(
  level: DungeonLevel,
  start: Point,
  globalVisited: Set<string>
): ExplorationCluster {
  const queue: Point[] = [start]
  const clusterTiles: Point[] = []
  let sumX = 0
  let sumY = 0
  let entryPoint: Point | null = null

  while (queue.length > 0) {
    const pos = queue.shift()!
    const key = `${pos.x},${pos.y}`

    if (globalVisited.has(key)) continue
    globalVisited.add(key)

    const tile = getTile(level, pos.x, pos.y)
    if (!tile || tile.explored) {
      // Check if this is a potential entry point
      if (tile?.explored && isWalkableOrDoor(tile)) {
        if (!entryPoint) {
          entryPoint = pos
        }
      }
      continue
    }

    clusterTiles.push(pos)
    sumX += pos.x
    sumY += pos.y

    // Add neighbors within cluster radius
    const neighbors = getAdjacentPositions(pos)
    for (const neighbor of neighbors) {
      const neighborKey = `${neighbor.x},${neighbor.y}`
      if (!globalVisited.has(neighborKey)) {
        queue.push(neighbor)
      }
    }
  }

  // Find entry point if not found during fill
  if (!entryPoint && clusterTiles.length > 0) {
    for (const clusterTile of clusterTiles) {
      entryPoint = findNearestWalkableExplored(level, clusterTile)
      if (entryPoint) break
    }
  }

  const center = clusterTiles.length > 0
    ? { x: Math.floor(sumX / clusterTiles.length), y: Math.floor(sumY / clusterTiles.length) }
    : start

  return {
    center,
    size: clusterTiles.length,
    entryPoint,
  }
}

/**
 * Find the best cluster to explore
 */
export function findBestCluster(
  game: GameState,
  botState: BotState
): ExplorationCluster | null {
  const clusters = findExplorationClusters(game)
  const pos = game.character.position

  if (clusters.length === 0) return null

  // Score clusters by size and distance
  let best: ExplorationCluster | null = null
  let bestScore = -Infinity

  for (const cluster of clusters) {
    if (!cluster.entryPoint) continue

    const distance = chebyshevDistance(pos, cluster.entryPoint)
    const visitPenalty = getRecentVisitPenalty(botState, cluster.entryPoint)
    // Prefer larger clusters, penalize distance and recent visits
    const score = cluster.size * 5 - distance - visitPenalty

    if (score > bestScore) {
      bestScore = score
      best = cluster
    }
  }

  return best
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Check if a tile is walkable or a closed door (can be opened)
 */
function isWalkableOrDoor(tile: Tile): boolean {
  return isWalkable(tile) || tile.type === 'door_closed'
}

/**
 * Check if a tile should be counted as explorable
 */
function isExplorableTile(tile: Tile): boolean {
  return tile.type === 'floor' || tile.type === 'door_open' || tile.type === 'door_closed'
}

/**
 * Chebyshev distance (king's move distance)
 */
function chebyshevDistance(a: Point, b: Point): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
}

// ============================================================================
// DEBUGGING
// ============================================================================

/**
 * Get exploration debug info
 */
export function getExplorationDebugInfo(game: GameState, botState: BotState): string {
  const stats = getExplorationStats(game)
  const target = findExplorationTarget(game, botState)
  const clusters = findExplorationClusters(game)

  const lines = [
    `Exploration: ${stats.progress}% (${stats.exploredTiles}/${stats.totalExplorableTiles})`,
    `Frontier: ${stats.frontierSize} tiles`,
    `Clusters: ${clusters.length} (largest: ${clusters[0]?.size ?? 0})`,
    `Stairs: ${stats.stairsFound ? 'FOUND' : 'not found'}`,
    `Target: ${target ? `(${target.x},${target.y})` : 'none'}`,
  ]

  return lines.join(' | ')
}
