/**
 * Labyrinth/maze generator
 *
 * Uses rot.js IceyMaze for maze-like dungeon layouts.
 */

import { Map as RotMap } from 'rot-js'
import type { Tile } from '../types'
import type { DepthProfile, RoomData } from './types'

export interface LabyrinthResult {
  tiles: Tile[][]
  rooms: RoomData[] // Labyrinths have few/no rooms, but we create some open spaces
}

/**
 * Generate a labyrinth-style level using maze algorithm
 */
export function generateLabyrinth(
  width: number,
  height: number,
  _profile: DepthProfile
): LabyrinthResult {
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

  // IceyMaze needs odd dimensions for proper maze generation
  const mazeWidth = width % 2 === 0 ? width - 1 : width
  const mazeHeight = height % 2 === 0 ? height - 1 : height

  // Create maze with moderate regularity (0 = chaotic, 1 = very regular)
  const maze = new RotMap.IceyMaze(mazeWidth, mazeHeight, 3)

  // Generate and apply maze
  maze.create((x: number, y: number, value: number) => {
    if (value === 0) {
      // 0 = floor in IceyMaze
      const row = tiles[y]
      if (row) {
        const tile = row[x]
        if (tile) tile.type = 'floor'
      }
    }
  })

  // Create some open spaces by removing walls in a few areas
  // This makes the labyrinth more interesting and less claustrophobic
  const rooms = createOpenSpaces(tiles, width, height)

  // Remove some dead-end walls to create shortcuts (5-8% of walls)
  removeDeadEndWalls(tiles, width, height, 0.06)

  return { tiles, rooms }
}

/**
 * Create a few small open rooms in the labyrinth
 */
function createOpenSpaces(
  tiles: Tile[][],
  width: number,
  height: number
): RoomData[] {
  const rooms: RoomData[] = []
  const roomCount = 2 + Math.floor(Math.random() * 3) // 2-4 rooms

  for (let i = 0; i < roomCount; i++) {
    // Random position avoiding edges
    const roomWidth = 3 + Math.floor(Math.random() * 3) // 3-5
    const roomHeight = 3 + Math.floor(Math.random() * 3) // 3-5

    const x = 3 + Math.floor(Math.random() * (width - roomWidth - 6))
    const y = 3 + Math.floor(Math.random() * (height - roomHeight - 6))

    // Carve out the room
    for (let ry = y; ry < y + roomHeight && ry < height - 1; ry++) {
      for (let rx = x; rx < x + roomWidth && rx < width - 1; rx++) {
        const tile = tiles[ry]?.[rx]
        if (tile) tile.type = 'floor'
      }
    }

    rooms.push({
      x,
      y,
      width: roomWidth,
      height: roomHeight,
      center: {
        x: Math.floor(x + roomWidth / 2),
        y: Math.floor(y + roomHeight / 2),
      },
    })
  }

  return rooms
}

/**
 * Remove some walls to create shortcuts and reduce dead ends
 */
function removeDeadEndWalls(
  tiles: Tile[][],
  width: number,
  height: number,
  removalChance: number
): void {
  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      const tile = tiles[y]?.[x]
      if (tile?.type !== 'wall') continue

      // Check if this wall separates two floor areas
      const north = tiles[y - 1]?.[x]?.type === 'floor'
      const south = tiles[y + 1]?.[x]?.type === 'floor'
      const east = tiles[y]?.[x + 1]?.type === 'floor'
      const west = tiles[y]?.[x - 1]?.type === 'floor'

      // If wall separates two floor areas, maybe remove it
      if ((north && south) || (east && west)) {
        if (Math.random() < removalChance) {
          tile.type = 'floor'
        }
      }
    }
  }
}
