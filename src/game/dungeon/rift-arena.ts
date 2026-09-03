/**
 * Rift arena generator for the ARPG dungeon.
 *
 * One large irregular cavern: high-fill cellular automata, pillar blobs for
 * kiting geometry, a guaranteed floor clearing at map center (player spawn,
 * boss arena). No doors, no rooms/corridors — packs need open ground.
 *
 * Fits the fast-path contract: default 60×30 = 1800 tiles ≤ MAX_LEVEL_TILES,
 * open diameter ~59 < u8 flow cap. All rolls via seeded rng (deterministic).
 */

import { Map as RotMap } from 'rot-js'
import type { Tile } from '../types'
import type { RoomData } from './types'
import { randomInt } from '../rng'
import { ensureConnectivity } from './validation'

export const RIFT_ARENA_WIDTH = 60
export const RIFT_ARENA_HEIGHT = 30

/** Radius of the guaranteed center clearing (spawn + boss arena) */
const CENTER_CLEARING_RADIUS = 4

/** Pillar blob count range */
const PILLAR_COUNT: [number, number] = [2, 4]

export interface RiftArenaResult {
  tiles: Tile[][]
  rooms: RoomData[] // Single center room (quadrant dens placed separately)
  center: { x: number; y: number }
}

/**
 * Generate a rift arena.
 */
export function generateRiftArena(
  width: number = RIFT_ARENA_WIDTH,
  height: number = RIFT_ARENA_HEIGHT
): RiftArenaResult {
  const tiles: Tile[][] = []
  for (let y = 0; y < height; y++) {
    const row: Tile[] = []
    tiles[y] = row
    for (let x = 0; x < width; x++) {
      row[x] = { type: 'wall', explored: false, visible: false }
    }
  }

  const cellular = new RotMap.Cellular(width, height, {
    born: [5, 6, 7, 8],
    survive: [4, 5, 6, 7, 8],
    topology: 8,
  })

  // High fill (~55% floor) for open fighting ground
  cellular.randomize(0.55)

  for (let i = 0; i < 4; i++) {
    cellular.create()
  }

  cellular.create((x: number, y: number, value: number) => {
    if (value === 1) {
      const tile = tiles[y]?.[x]
      if (tile) tile.type = 'floor'
    }
  })

  // Connect all floor regions
  cellular.connect((x: number, y: number, value: number) => {
    if (value === 1) {
      const tile = tiles[y]?.[x]
      if (tile) tile.type = 'floor'
    }
  }, 1)

  const center = { x: Math.floor(width / 2), y: Math.floor(height / 2) }

  // Center clearing: guaranteed safe spawn (cleared AFTER pillars so it wins)
  carveDisc(tiles, width, height, center.x, center.y, CENTER_CLEARING_RADIUS)

  // Pillar blobs: kiting geometry, kept off the center clearing
  const pillarCount = randomInt(PILLAR_COUNT[0], PILLAR_COUNT[1])
  let placed = 0
  for (let attempt = 0; attempt < pillarCount * 10 && placed < pillarCount; attempt++) {
    const px = randomInt(2, width - 3)
    const py = randomInt(2, height - 3)
    const distCenter = Math.max(Math.abs(px - center.x), Math.abs(py - center.y))
    if (distCenter < CENTER_CLEARING_RADIUS + 3) continue
    if (tiles[py]?.[px]?.type !== 'floor') continue
    stampPillar(tiles, width, height, px, py)
    placed++
  }

  // Seal border walls (cellular connect can open edges)
  for (let x = 0; x < width; x++) {
    const top = tiles[0]?.[x]
    const bottom = tiles[height - 1]?.[x]
    if (top) top.type = 'wall'
    if (bottom) bottom.type = 'wall'
  }
  for (let y = 0; y < height; y++) {
    const left = tiles[y]?.[0]
    const right = tiles[y]?.[width - 1]
    if (left) left.type = 'wall'
    if (right) right.type = 'wall'
  }

  // Reconnect anything pillars/border split. Same 4-way tool the classic path
  // uses (validation flood-fill is 4-way) — keeps one connectivity definition.
  ensureConnectivity(tiles, width, height)

  const rooms: RoomData[] = [
    {
      x: center.x - CENTER_CLEARING_RADIUS,
      y: center.y - CENTER_CLEARING_RADIUS,
      width: CENTER_CLEARING_RADIUS * 2 + 1,
      height: CENTER_CLEARING_RADIUS * 2 + 1,
      center: { ...center },
    },
  ]

  return { tiles, rooms, center }
}

/** Carve a floor disc (Chebyshev) — center clearing */
function carveDisc(
  tiles: Tile[][],
  width: number,
  height: number,
  cx: number,
  cy: number,
  radius: number
): void {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) > radius) continue
      const nx = cx + dx
      const ny = cy + dy
      if (nx < 1 || nx >= width - 1 || ny < 1 || ny >= height - 1) continue
      const tile = tiles[ny]?.[nx]
      if (tile) tile.type = 'floor'
    }
  }
}

/** Stamp a small wall blob (plus-shape, 3×3-ish) */
function stampPillar(tiles: Tile[][], width: number, height: number, px: number, py: number): void {
  const shape: Array<[number, number]> = [
    [0, 0],
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]
  for (const [dx, dy] of shape) {
    const nx = px + dx
    const ny = py + dy
    if (nx < 1 || nx >= width - 1 || ny < 1 || ny >= height - 1) continue
    const tile = tiles[ny]?.[nx]
    if (tile) tile.type = 'wall'
  }
}
