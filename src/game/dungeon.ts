/**
 * Dungeon generation and utilities using rot.js
 *
 * Provides level generation, tile utilities, position utilities,
 * field of view computation, and pathfinding.
 */

import { Map as RotMap, FOV, Path } from 'rot-js'
import type { DungeonLevel, Point, Tile, TileType } from './types'
import { MAX_DEPTH } from './types'

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_WIDTH = 80
const DEFAULT_HEIGHT = 40

// ============================================================================
// LEVEL GENERATION
// ============================================================================

/**
 * Generate a dungeon level at the specified depth
 *
 * Uses rot.js Digger algorithm to create rooms connected by corridors.
 * Places stairs up (except depth 1) and stairs down (except max depth).
 *
 * @param depth - Dungeon depth (1-50)
 * @param width - Level width (default 80)
 * @param height - Level height (default 40)
 * @returns Generated dungeon level
 */
export function generateLevel(
  depth: number,
  width: number = DEFAULT_WIDTH,
  height: number = DEFAULT_HEIGHT
): DungeonLevel {
  // Initialize tiles as walls
  const tiles: Tile[][] = []
  for (let y = 0; y < height; y++) {
    const row: Tile[] = []
    tiles[y] = row
    for (let x = 0; x < width; x++) {
      row[x] = {
        type: 'wall',
        explored: false,
        visible: false,
      }
    }
  }

  // Use rot.js Digger to carve out rooms and corridors
  const digger = new RotMap.Digger(width, height, {
    roomWidth: [3, 9],
    roomHeight: [3, 5],
    corridorLength: [3, 10],
    dugPercentage: 0.3,
  })

  // Callback to set floor tiles
  digger.create((x: number, y: number, value: number) => {
    if (value === 0) {
      // 0 = floor (passable)
      const row = tiles[y]
      if (row) {
        const tile = row[x]
        if (tile) tile.type = 'floor'
      }
    }
    // 1 = wall (already set)
  })

  // Collect floor positions for stair placement
  const floorPositions: Point[] = []
  for (let y = 0; y < height; y++) {
    const row = tiles[y]
    if (!row) continue
    for (let x = 0; x < width; x++) {
      const tile = row[x]
      if (tile && tile.type === 'floor') {
        floorPositions.push({ x, y })
      }
    }
  }

  // Place stairs
  let stairsUp: Point | null = null
  let stairsDown: Point | null = null

  if (floorPositions.length > 0) {
    // Shuffle floor positions for random placement
    shuffleArray(floorPositions)

    // Place stairs up (except on depth 1)
    if (depth > 1 && floorPositions.length > 0) {
      const upPos = floorPositions.pop()!
      stairsUp = upPos
      const upRow = tiles[upPos.y]
      const upTile = upRow?.[upPos.x]
      if (upTile) upTile.type = 'stairs_up'
    }

    // Place stairs down (except on max depth)
    if (depth < MAX_DEPTH && floorPositions.length > 0) {
      const downPos = floorPositions.pop()!
      stairsDown = downPos
      const downRow = tiles[downPos.y]
      const downTile = downRow?.[downPos.x]
      if (downTile) downTile.type = 'stairs_down'
    }
  }

  return {
    depth,
    width,
    height,
    tiles,
    stairsUp,
    stairsDown,
  }
}

// ============================================================================
// TILE UTILITIES
// ============================================================================

/**
 * Get a tile at the specified position
 *
 * @param level - The dungeon level
 * @param x - X coordinate
 * @param y - Y coordinate
 * @returns The tile or null if out of bounds
 */
export function getTile(level: DungeonLevel, x: number, y: number): Tile | null {
  if (x < 0 || x >= level.width || y < 0 || y >= level.height) {
    return null
  }
  const row = level.tiles[y]
  return row ? (row[x] ?? null) : null
}

/**
 * Set the type of a tile at the specified position
 *
 * @param level - The dungeon level
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param type - The new tile type
 */
export function setTile(level: DungeonLevel, x: number, y: number, type: TileType): void {
  if (x < 0 || x >= level.width || y < 0 || y >= level.height) {
    return
  }
  const row = level.tiles[y]
  const tile = row?.[x]
  if (tile) tile.type = type
}

/**
 * Check if a tile is walkable (can be moved onto)
 *
 * @param tile - The tile to check
 * @returns True if walkable (floor, open door, stairs)
 */
export function isWalkable(tile: Tile): boolean {
  return (
    tile.type === 'floor' ||
    tile.type === 'door_open' ||
    tile.type === 'stairs_up' ||
    tile.type === 'stairs_down'
  )
}

/**
 * Check if a tile blocks light/vision
 *
 * @param tile - The tile to check
 * @returns True if opaque (wall, closed door)
 */
export function isOpaque(tile: Tile): boolean {
  return tile.type === 'wall' || tile.type === 'door_closed'
}

// ============================================================================
// POSITION UTILITIES
// ============================================================================

/**
 * Find a random walkable position on the level
 *
 * @param level - The dungeon level
 * @returns A random walkable position
 * @throws Error if no walkable positions exist
 */
export function findOpenPosition(level: DungeonLevel): Point {
  const positions = findOpenPositions(level, 1)
  if (positions.length === 0 || !positions[0]) {
    throw new Error('No walkable positions found on level')
  }
  return positions[0]
}

/**
 * Find multiple random walkable positions on the level
 *
 * @param level - The dungeon level
 * @param count - Number of positions to find
 * @returns Array of walkable positions (may be fewer than requested)
 */
export function findOpenPositions(level: DungeonLevel, count: number): Point[] {
  const walkable: Point[] = []

  for (let y = 0; y < level.height; y++) {
    const row = level.tiles[y]
    if (!row) continue
    for (let x = 0; x < level.width; x++) {
      const tile = row[x]
      if (tile && isWalkable(tile)) {
        walkable.push({ x, y })
      }
    }
  }

  // Shuffle and return requested count
  shuffleArray(walkable)
  return walkable.slice(0, count)
}

/**
 * Get all 8 adjacent positions (including diagonals)
 *
 * Note: Does not check bounds or walkability
 *
 * @param pos - The center position
 * @returns Array of 8 adjacent positions
 */
export function getAdjacentPositions(pos: Point): Point[] {
  return [
    { x: pos.x - 1, y: pos.y - 1 }, // NW
    { x: pos.x, y: pos.y - 1 }, // N
    { x: pos.x + 1, y: pos.y - 1 }, // NE
    { x: pos.x - 1, y: pos.y }, // W
    { x: pos.x + 1, y: pos.y }, // E
    { x: pos.x - 1, y: pos.y + 1 }, // SW
    { x: pos.x, y: pos.y + 1 }, // S
    { x: pos.x + 1, y: pos.y + 1 }, // SE
  ]
}

/**
 * Calculate Euclidean distance between two points
 *
 * @param a - First point
 * @param b - Second point
 * @returns Euclidean distance
 */
export function distance(a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Calculate Manhattan distance between two points
 *
 * @param a - First point
 * @param b - Second point
 * @returns Manhattan distance
 */
export function manhattanDistance(a: Point, b: Point): number {
  return Math.abs(b.x - a.x) + Math.abs(b.y - a.y)
}

// ============================================================================
// FIELD OF VIEW
// ============================================================================

/**
 * Compute field of view from a position
 *
 * Uses rot.js PreciseShadowcasting algorithm.
 * Updates tile.visible and tile.explored flags.
 *
 * @param level - The dungeon level
 * @param origin - The origin point for FOV
 * @param radius - Vision radius
 * @returns Set of visible tile keys (e.g., "10,20")
 */
export function computeFOV(level: DungeonLevel, origin: Point, radius: number): Set<string> {
  const visible = new Set<string>()

  // Reset visibility for all tiles
  for (let y = 0; y < level.height; y++) {
    const row = level.tiles[y]
    if (!row) continue
    for (let x = 0; x < level.width; x++) {
      const tile = row[x]
      if (tile) tile.visible = false
    }
  }

  // Create FOV calculator
  const fov = new FOV.PreciseShadowcasting((x: number, y: number) => {
    const tile = getTile(level, x, y)
    return tile !== null && !isOpaque(tile)
  })

  // Compute visible tiles
  fov.compute(
    origin.x,
    origin.y,
    radius,
    (x: number, y: number, _r: number, visibility: number) => {
      if (visibility > 0) {
        const tile = getTile(level, x, y)
        if (tile) {
          tile.visible = true
          tile.explored = true
          visible.add(`${x},${y}`)
        }
      }
    }
  )

  return visible
}

// ============================================================================
// PATHFINDING
// ============================================================================

/**
 * Find a path between two points using A* algorithm
 *
 * @param level - The dungeon level
 * @param from - Starting position
 * @param to - Target position
 * @returns Array of points from start to end (empty if no path)
 */
export function findPath(level: DungeonLevel, from: Point, to: Point): Point[] {
  const path: Point[] = []

  // Check if start and end are valid
  const startTile = getTile(level, from.x, from.y)
  const endTile = getTile(level, to.x, to.y)

  if (!startTile || !endTile) {
    return []
  }

  if (!isWalkable(startTile) || !isWalkable(endTile)) {
    return []
  }

  // Passability callback
  const passableCallback = (x: number, y: number): boolean => {
    const tile = getTile(level, x, y)
    return tile !== null && isWalkable(tile)
  }

  // Create A* pathfinder (topology 8 = 8-directional movement)
  const astar = new Path.AStar(to.x, to.y, passableCallback, { topology: 8 })

  // Compute path
  astar.compute(from.x, from.y, (x: number, y: number) => {
    path.push({ x, y })
  })

  return path
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Fisher-Yates shuffle (in-place)
 */
function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = array[i]!
    array[i] = array[j]!
    array[j] = temp
  }
}
