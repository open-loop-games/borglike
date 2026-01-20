/**
 * Cavern generator using cellular automata
 *
 * Uses rot.js Cellular to create organic cave-like formations.
 */

import { Map as RotMap } from 'rot-js'
import type { Tile } from '../types'
import type { DepthProfile, RoomData } from './types'

export interface CavernResult {
  tiles: Tile[][]
  rooms: RoomData[] // Caverns don't have distinct rooms, but we identify open areas
}

/**
 * Generate a cavern-style level using cellular automata
 */
export function generateCavern(
  width: number,
  height: number,
  _profile: DepthProfile
): CavernResult {
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

  // Configure Cellular automata
  // born: neighbor counts that create new floor
  // survive: neighbor counts that keep existing floor
  const cellular = new RotMap.Cellular(width, height, {
    born: [5, 6, 7, 8],
    survive: [4, 5, 6, 7, 8],
    topology: 8,
  })

  // Initialize with random values (~45% floor)
  cellular.randomize(0.45)

  // Run several iterations to smooth out the caves
  for (let i = 0; i < 4; i++) {
    cellular.create()
  }

  // Final pass with callback to set tiles
  cellular.create((x: number, y: number, value: number) => {
    if (value === 1) {
      // 1 = floor in Cellular
      const row = tiles[y]
      if (row) {
        const tile = row[x]
        if (tile) tile.type = 'floor'
      }
    }
  })

  // Ensure connectivity - connect all floor regions
  cellular.connect((x: number, y: number, value: number) => {
    if (value === 1) {
      const row = tiles[y]
      if (row) {
        const tile = row[x]
        if (tile) tile.type = 'floor'
      }
    }
  }, 1)

  // Identify the largest open areas as pseudo-rooms for stair placement
  const rooms = findOpenAreas(tiles, width, height)

  return { tiles, rooms }
}

/**
 * Find large open areas in the cavern for stair/item placement
 * Uses flood fill to find connected regions, returns largest ones
 */
function findOpenAreas(
  tiles: Tile[][],
  width: number,
  height: number
): RoomData[] {
  const visited = new Set<string>()
  const areas: { tiles: { x: number; y: number }[] }[] = []

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const key = `${x},${y}`
      const tile = tiles[y]?.[x]

      if (tile?.type === 'floor' && !visited.has(key)) {
        // Flood fill to find connected area
        const area: { x: number; y: number }[] = []
        const queue = [{ x, y }]

        while (queue.length > 0) {
          const pos = queue.shift()!
          const posKey = `${pos.x},${pos.y}`

          if (visited.has(posKey)) continue
          const posTile = tiles[pos.y]?.[pos.x]
          if (!posTile || posTile.type !== 'floor') continue

          visited.add(posKey)
          area.push(pos)

          // Check 4 cardinal neighbors
          queue.push({ x: pos.x - 1, y: pos.y })
          queue.push({ x: pos.x + 1, y: pos.y })
          queue.push({ x: pos.x, y: pos.y - 1 })
          queue.push({ x: pos.x, y: pos.y + 1 })
        }

        if (area.length >= 20) {
          areas.push({ tiles: area })
        }
      }
    }
  }

  // Convert areas to RoomData (using bounding box)
  const rooms: RoomData[] = areas.slice(0, 5).map((area) => {
    let minX = Infinity,
      maxX = -Infinity
    let minY = Infinity,
      maxY = -Infinity

    for (const pos of area.tiles) {
      minX = Math.min(minX, pos.x)
      maxX = Math.max(maxX, pos.x)
      minY = Math.min(minY, pos.y)
      maxY = Math.max(maxY, pos.y)
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
      center: {
        x: Math.floor((minX + maxX) / 2),
        y: Math.floor((minY + maxY) / 2),
      },
    }
  })

  return rooms
}
