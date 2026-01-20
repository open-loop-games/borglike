/**
 * Door placement system
 *
 * Identifies valid door positions and places doors based on depth profile.
 */

import type { Tile, Point } from '../types'

/**
 * Find positions where doors can be validly placed
 *
 * A valid door position is a floor tile that:
 * - Has exactly 2 opposite walls (N/S or E/W)
 * - Has floor on the other 2 opposite sides
 * - Acts as a chokepoint between two areas
 */
export function findDoorCandidates(
  tiles: Tile[][],
  width: number,
  height: number
): Point[] {
  const candidates: Point[] = []

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const tile = tiles[y]?.[x]
      if (!tile || tile.type !== 'floor') continue

      // Get adjacent tiles
      const north = tiles[y - 1]?.[x]
      const south = tiles[y + 1]?.[x]
      const east = tiles[y]?.[x + 1]
      const west = tiles[y]?.[x - 1]

      if (!north || !south || !east || !west) continue

      // Check for horizontal corridor (walls N/S, floor E/W)
      const isHorizontalCorridor =
        isWallType(north.type) &&
        isWallType(south.type) &&
        isFloorType(east.type) &&
        isFloorType(west.type)

      // Check for vertical corridor (walls E/W, floor N/S)
      const isVerticalCorridor =
        isFloorType(north.type) &&
        isFloorType(south.type) &&
        isWallType(east.type) &&
        isWallType(west.type)

      if (isHorizontalCorridor || isVerticalCorridor) {
        candidates.push({ x, y })
      }
    }
  }

  return candidates
}

/**
 * Place doors at candidate positions based on chance
 */
export function placeDoors(
  tiles: Tile[][],
  candidates: Point[],
  doorChance: number
): Point[] {
  const placedDoors: Point[] = []

  // Shuffle candidates for random distribution
  const shuffled = [...candidates]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!]
  }

  // Track placed doors to avoid clustering
  const doorPositions = new Set<string>()

  for (const pos of shuffled) {
    // Skip if too close to another door (within 3 tiles)
    let tooClose = false
    for (const placed of placedDoors) {
      const dist = Math.abs(pos.x - placed.x) + Math.abs(pos.y - placed.y)
      if (dist < 4) {
        tooClose = true
        break
      }
    }

    if (tooClose) continue

    if (Math.random() < doorChance) {
      const tile = tiles[pos.y]?.[pos.x]
      if (tile) {
        tile.type = 'door_closed'
        placedDoors.push(pos)
        doorPositions.add(`${pos.x},${pos.y}`)
      }
    }
  }

  return placedDoors
}

function isWallType(type: string): boolean {
  return type === 'wall'
}

function isFloorType(type: string): boolean {
  return type === 'floor' || type === 'door_open' || type === 'door_closed'
}
