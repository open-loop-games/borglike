/**
 * Dungeon generation module
 *
 * Provides depth-scaled dungeon generation with multiple generator types,
 * door placement, and vault system.
 */

import type { DungeonLevel, Tile, Point } from '../types'
import { MAX_DEPTH } from '../types'
import type { GeneratorType, RoomData, VaultPlacement } from './types'
import { getDepthProfile, selectGenerator } from './profiles'
import { generateClassic } from './classic'
import { generateCavern } from './cavern'
import { generateLabyrinth } from './labyrinth'
import { findDoorCandidates, placeDoors } from './doors'
import { validateConnectivity, ensureConnectivity } from './validation'
import { tryPlaceVault } from './vaults'

// Re-export types
export type { GeneratorType, RoomData, VaultPlacement } from './types'
export type { DepthProfile } from './types'
export { getDepthProfile, selectGenerator } from './profiles'
export { VAULTS } from './vaults'

const DEFAULT_WIDTH = 80
const DEFAULT_HEIGHT = 40

export interface GenerationResult {
  level: DungeonLevel
  generatorType: GeneratorType
  rooms: RoomData[]
  vault: VaultPlacement | null
  doorsPlaced: number
}

/**
 * Generate a dungeon level at the specified depth
 *
 * Uses depth-based profiles to select generator type and parameters.
 * Applies post-processing: doors, vaults, connectivity validation, stairs.
 */
export function generateLevel(
  depth: number,
  width: number = DEFAULT_WIDTH,
  height: number = DEFAULT_HEIGHT
): DungeonLevel {
  const result = generateLevelWithInfo(depth, width, height)
  return result.level
}

/**
 * Generate a dungeon level with full generation info
 * Useful for debugging or when you need metadata about the generation
 */
export function generateLevelWithInfo(
  depth: number,
  width: number = DEFAULT_WIDTH,
  height: number = DEFAULT_HEIGHT
): GenerationResult {
  const profile = getDepthProfile(depth)
  const generatorType = selectGenerator(depth)

  // Generate base tiles using selected generator
  let tiles: Tile[][]
  let rooms: RoomData[]

  switch (generatorType) {
    case 'cavern': {
      const result = generateCavern(width, height, profile)
      tiles = result.tiles
      rooms = result.rooms
      break
    }
    case 'labyrinth': {
      const result = generateLabyrinth(width, height, profile)
      tiles = result.tiles
      rooms = result.rooms
      break
    }
    case 'classic':
    default: {
      const result = generateClassic(width, height, profile)
      tiles = result.tiles
      rooms = result.rooms
      break
    }
  }

  // Ensure connectivity before other processing
  if (!validateConnectivity(tiles, width, height)) {
    ensureConnectivity(tiles, width, height)
  }

  // Try to place a vault (depth-dependent chance)
  const vault = tryPlaceVault(tiles, rooms, width, height, depth, profile.vaultChance)

  // Place doors at corridor chokepoints
  const doorCandidates = findDoorCandidates(tiles, width, height)
  const placedDoors = placeDoors(tiles, doorCandidates, profile.doorChance)

  // Place stairs
  const { stairsUp, stairsDown } = placeStairs(tiles, width, height, depth)

  const level: DungeonLevel = {
    depth,
    width,
    height,
    tiles,
    stairsUp,
    stairsDown,
  }

  return {
    level,
    generatorType,
    rooms,
    vault,
    doorsPlaced: placedDoors.length,
  }
}

/**
 * Place stairs up and down on the level
 */
function placeStairs(
  tiles: Tile[][],
  width: number,
  height: number,
  depth: number
): { stairsUp: Point | null; stairsDown: Point | null } {
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

  // Shuffle for random placement
  shuffleArray(floorPositions)

  let stairsUp: Point | null = null
  let stairsDown: Point | null = null

  if (floorPositions.length > 0) {
    // Place stairs up (except on depth 1)
    if (depth > 1 && floorPositions.length > 0) {
      const upPos = floorPositions.pop()!
      stairsUp = upPos
      const upTile = tiles[upPos.y]?.[upPos.x]
      if (upTile) upTile.type = 'stairs_up'
    }

    // Place stairs down (except on max depth)
    if (depth < MAX_DEPTH && floorPositions.length > 0) {
      const downPos = floorPositions.pop()!
      stairsDown = downPos
      const downTile = tiles[downPos.y]?.[downPos.x]
      if (downTile) downTile.type = 'stairs_down'
    }
  }

  return { stairsUp, stairsDown }
}

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
