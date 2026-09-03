/**
 * Rift den placement (ARPG dungeon).
 *
 * One den per quadrant, on open floor: reuses cavern quadrant clustering,
 * then filters for center distance + wall margin + pairwise separation.
 * Missing quadrants fall back to snapped quadrant-center offsets, so this
 * always returns exactly 4 dens. Gen-time only; seeded RNG throughout.
 */

import type { Tile, Point } from '../types'
import { chebyshevDistance } from '../types'
import { findOpenAreas } from './cavern'
import { RIFT_ARENA_WIDTH, RIFT_ARENA_HEIGHT } from './rift-arena'

/** Dens keep clear of the entry (spawn safety + dive distance) */
const DEN_MIN_CENTER_DISTANCE = 10
/** Pairwise den separation (distinct beats, no shared aggro soup) */
const DEN_MIN_SEPARATION = 10
/** Wall margin for dens (kites need room) */
const DEN_WALL_MARGIN = 3
/** Snap-search radius for fallback dens */
const DEN_SNAP_RADIUS = 12

/**
 * Place 4 dens on a rift arena. Always returns 4 points on floor tiles.
 */
export function placeRiftDens(
  tiles: Tile[][],
  width: number = RIFT_ARENA_WIDTH,
  height: number = RIFT_ARENA_HEIGHT,
  entry: Point = { x: Math.floor(width / 2), y: Math.floor(height / 2) }
): Point[] {
  const dens: Point[] = []

  for (const room of findOpenAreas(tiles, width, height)) {
    const c = room.center
    if (c.x < DEN_WALL_MARGIN || c.x >= width - DEN_WALL_MARGIN) continue
    if (c.y < DEN_WALL_MARGIN || c.y >= height - DEN_WALL_MARGIN) continue
    if (tiles[c.y]?.[c.x]?.type !== 'floor') continue
    if (chebyshevDistance(c, entry) < DEN_MIN_CENTER_DISTANCE) continue
    if (dens.some((d) => chebyshevDistance(d, c) < DEN_MIN_SEPARATION)) continue
    dens.push({ ...c })
    if (dens.length === 4) break
  }

  // Fallbacks: quadrant centers snapped to nearest floor (fixed order = deterministic)
  const quadrantFallbacks: Point[] = [
    { x: Math.floor(width / 4), y: Math.floor(height / 4) },
    { x: Math.floor((3 * width) / 4), y: Math.floor(height / 4) },
    { x: Math.floor(width / 4), y: Math.floor((3 * height) / 4) },
    { x: Math.floor((3 * width) / 4), y: Math.floor((3 * height) / 4) },
  ]
  for (const fb of quadrantFallbacks) {
    if (dens.length === 4) break
    if (dens.some((d) => chebyshevDistance(d, fb) < DEN_MIN_SEPARATION)) continue
    const snapped = snapToFloor(tiles, width, height, fb, entry)
    if (snapped && !dens.some((d) => chebyshevDistance(d, snapped) < DEN_MIN_SEPARATION)) {
      dens.push(snapped)
    }
  }

  // Last resort (degenerate map): any floor far from entry + each other
  if (dens.length < 4) {
    outer: for (let y = DEN_WALL_MARGIN; y < height - DEN_WALL_MARGIN; y++) {
      for (let x = DEN_WALL_MARGIN; x < width - DEN_WALL_MARGIN; x++) {
        if (tiles[y]?.[x]?.type !== 'floor') continue
        const p = { x, y }
        if (chebyshevDistance(p, entry) < DEN_MIN_CENTER_DISTANCE) continue
        if (dens.some((d) => chebyshevDistance(d, p) < DEN_MIN_SEPARATION)) continue
        dens.push(p)
        if (dens.length === 4) break outer
      }
    }
  }

  return dens
}

/** Spiral-search (deterministic order) for the nearest floor tile */
function snapToFloor(
  tiles: Tile[][],
  width: number,
  height: number,
  near: Point,
  entry: Point
): Point | null {
  for (let r = 0; r <= DEN_SNAP_RADIUS; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
        const x = near.x + dx
        const y = near.y + dy
        if (x < DEN_WALL_MARGIN || x >= width - DEN_WALL_MARGIN) continue
        if (y < DEN_WALL_MARGIN || y >= height - DEN_WALL_MARGIN) continue
        if (tiles[y]?.[x]?.type !== 'floor') continue
        const p = { x, y }
        if (chebyshevDistance(p, entry) < DEN_MIN_CENTER_DISTANCE) continue
        return p
      }
    }
  }
  return null
}
