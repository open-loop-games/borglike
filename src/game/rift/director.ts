/**
 * Rift spawn director (ARPG dungeon).
 *
 * M1: whites-only scattered spawn + clear-all portal trigger.
 * M2 grows this file: den placement, spawner entity, bounded trickle, guards,
 * boss spawn — the call sites (createGame, handleDescend, processTurn tail)
 * stay the same.
 */

import type { DungeonLevel, GameState, Monster, Point } from '../types'
import { chebyshevDistance } from '../types'
import { getTile, setTile, findOpenPositions } from '../dungeon'
import { spawnMonster } from '../monster-ai'
import { getSpawnableMonsters } from '../data/monsters'
import { shuffle } from '../rng'
import { addTaggedMessage } from '../actions/helpers'

/** M1 white count: 10 + 2/tier, capped inside the 30–50 active budget */
const WHITE_BASE_COUNT = 10
const WHITE_PER_TIER = 2
const WHITE_MAX_COUNT = 30

/** M1 white HP scalar (percent of template HP) */
const WHITE_HP_PERCENT = 70

/** Safe landing radius around the entry point (no spawns inside) */
const ENTRY_SAFE_RADIUS = 8

/**
 * Spawn M1 whites: weak non-unique bases from the tier's depth window,
 * scattered, kept off the entry clearing.
 */
export function spawnRiftWhites(
  level: DungeonLevel,
  tier: number,
  hpPercent: number,
  entry: Point
): Monster[] {
  const templates = getSpawnableMonsters(tier).filter((t) => !t.flags?.includes('UNIQUE'))
  if (templates.length === 0) return []

  const count = Math.min(WHITE_BASE_COUNT + tier * WHITE_PER_TIER, WHITE_MAX_COUNT)
  const positions = findOpenPositions(level, count + 10).filter((pos) => {
    if (chebyshevDistance(pos, entry) < ENTRY_SAFE_RADIUS) return false
    const tile = getTile(level, pos.x, pos.y)
    return !!tile && tile.type === 'floor'
  })

  // Seeded shuffle then round-robin: deterministic per seed, varied per tier.
  // (M2 replaces this with pack picks; rarity weighting returns there.)
  const shuffled = shuffle(templates)
  const monsters: Monster[] = []
  const spawnCount = Math.min(count, positions.length)
  for (let i = 0; i < spawnCount; i++) {
    const template = shuffled[i % shuffled.length]
    const pos = positions[i]
    if (template && pos) {
      monsters.push(spawnMonster(template, pos, Math.floor((hpPercent * WHITE_HP_PERCENT) / 100)))
    }
  }
  return monsters
}

/**
 * Open the advance portal at the arena center. Sets the tile, patches the
 * passability bitmap (portal opens at runtime, after gen-time bitmap build),
 * and records progress on the ruleset.
 */
export function openRiftPortal(game: GameState): void {
  const level = game.currentLevel
  const center = level.entryPoint ?? {
    x: Math.floor(level.width / 2),
    y: Math.floor(level.height / 2),
  }
  setTile(level, center.x, center.y, 'rift_portal')
  level.passable[center.y * level.width + center.x] = 1
  game.ruleset.portalOpen = true
  game.ruleset.portalPos = { ...center }
  addTaggedMessage(game, 'A rift portal tears open at the center of the arena!', 'good', {
    tags: ['progress'],
    importance: 4,
  })
}
