/**
 * Rift spawn director (ARPG dungeon).
 *
 * Owns tier population (roamers, den guards, spawners), spawner emission,
 * and boss spawn. Call sites (createGame, handleDescend, processTurn tail)
 * stay stable as this grows.
 */

import type { DungeonLevel, GameState, Monster, Point } from '../types'
import { chebyshevDistance, isMonsterAt } from '../types'
import { getTile, setTile, findOpenPositions } from '../dungeon'
import { spawnMonster } from '../monster-ai'
import { getSpawnableMonsters } from '../data/monsters'
import {
  RIFT_SPAWNER_TEMPLATE,
  riftSpawnerHpPercent,
  RIFT_BOSS_HP_PERCENT,
  RIFT_GUARD_HP_PERCENT,
  getRiftBodies,
  getRiftBossBase,
} from '../data/rift/monsters'
import { shuffle, randomItem, randomInt } from '../rng'
import { addTaggedMessage } from '../actions/helpers'

/** Roamers: small roaming population alongside dens */
const ROAMER_BASE_COUNT = 6
const ROAMER_PER_TIER = 1
const ROAMER_MAX_COUNT = 12

/** White HP scalar (percent of template HP) */
const WHITE_HP_PERCENT = 70

/** Safe landing radius around the entry point (no spawns inside) */
const ENTRY_SAFE_RADIUS = 8

/** Active monster cap — emissions stop here (keeps the 30–50 budget) */
export const RIFT_ACTIVE_CAP = 50

/** Guards per den */
const GUARDS_PER_DEN: [number, number] = [3, 5]
/** Guard ring radius around the den */
const GUARD_RING_RADIUS = 3
/** Emission annulus around the den (spread = gradient, zero per-tick cost) */
const EMIT_RING: [number, number] = [2, 4]

/**
 * Spawn roaming whites: weak non-unique bases from the tier's depth window,
 * scattered, kept off the entry clearing.
 */
export function spawnRiftWhites(
  level: DungeonLevel,
  tier: number,
  hpPercent: number,
  entry: Point,
  count: number = ROAMER_MAX_COUNT
): Monster[] {
  const templates = getSpawnableMonsters(tier).filter((t) => !t.flags?.includes('UNIQUE'))
  if (templates.length === 0) return []

  const wanted = Math.min(count, ROAMER_MAX_COUNT)
  const positions = findOpenPositions(level, wanted + 10).filter((pos) => {
    if (chebyshevDistance(pos, entry) < ENTRY_SAFE_RADIUS) return false
    const tile = getTile(level, pos.x, pos.y)
    return !!tile && tile.type === 'floor'
  })

  // Seeded shuffle then round-robin: deterministic per seed, varied per tier.
  const shuffled = shuffle(templates)
  const monsters: Monster[] = []
  const spawnCount = Math.min(wanted, positions.length)
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
 * Rift kill progress: spawner count → boss at 3 of 4; boss kill opens the portal.
 * Called from handleMonsterKill (the single kill path). Boss-kill replaces the
 * clear-all trigger — trickle keeps the 4th den populated, so clear-all can
 * never fire once spawners exist.
 */
export function handleRiftKillProgress(game: GameState, monster: Monster): void {
  if (monster.riftRole === 'spawner') {
    game.ruleset.spawnersKilled = (game.ruleset.spawnersKilled ?? 0) + 1
    if (game.ruleset.spawnersKilled === 3) {
      spawnRiftBoss(game)
    }
  } else if (monster.riftRole === 'boss') {
    game.ruleset.bossKilled = true
  }
}

/**
 * Open the advance portal once the boss is down. Called from the processTurn
 * tail; the portal + advance path itself is unchanged.
 */
export function checkRiftAdvance(game: GameState): void {
  if (!game.ruleset.portalOpen && game.isRunning && game.ruleset.bossKilled) {
    openRiftPortal(game)
  }
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

// ============================================================================
// DENS, SPAWNERS, BOSS
// ============================================================================

/**
 * Spawn a full rift tier: den spawners + guards + a small roaming population.
 * Dens come from level geometry (level.riftDens, placed at gen).
 */
export function spawnRiftTier(
  level: DungeonLevel,
  tier: number,
  hpPercent: number,
  entry: Point
): Monster[] {
  const dens = level.riftDens ?? []
  const monsters: Monster[] = []
  for (let i = 0; i < dens.length; i++) {
    const den = dens[i]!
    const spawner = spawnDenSpawner(den, tier, hpPercent, i)
    if (spawner) {
      monsters.push(spawner)
      monsters.push(...spawnDenGuards(level, tier, hpPercent, den, i, monsters))
    }
  }
  const roamers = Math.min(ROAMER_BASE_COUNT + tier * ROAMER_PER_TIER, ROAMER_MAX_COUNT)
  monsters.push(...spawnRiftWhites(level, tier, hpPercent, entry, roamers))
  return monsters
}

/**
 * Den guards: 3–5 copies of one tier body at 150% HP, ringed on the den
 * (radius 1–3; the spawner holds the center).
 */
export function spawnDenGuards(
  level: DungeonLevel,
  tier: number,
  hpPercent: number,
  den: Point,
  denIndex: number,
  occupied: Monster[]
): Monster[] {
  const bodies = getRiftBodies(tier)
  if (bodies.length === 0) return []
  const shuffled = shuffle(bodies)
  const base = shuffled[denIndex % shuffled.length]!
  const packId = `t${tier}d${denIndex}`
  const guardHp = Math.floor((hpPercent * RIFT_GUARD_HP_PERCENT) / 100)

  const spots = freeRingTiles(level, den, 1, GUARD_RING_RADIUS, 8, occupied)
  const count = Math.min(randomInt(GUARDS_PER_DEN[0], GUARDS_PER_DEN[1]), spots.length)
  const guards: Monster[] = []
  for (let i = 0; i < count; i++) {
    const m = spawnMonster(base, spots[i]!, guardHp)
    m.packId = packId
    m.packHome = { ...den }
    guards.push(m)
  }
  return guards
}

/** Den spawner: immobile structure-monster on the den tile, HP scaled per tier. */
export function spawnDenSpawner(
  den: Point,
  tier: number,
  hpPercent: number,
  denIndex: number
): Monster | null {
  const m = spawnMonster(
    RIFT_SPAWNER_TEMPLATE,
    den,
    Math.floor((hpPercent * riftSpawnerHpPercent(tier)) / 100)
  )
  m.packId = `t${tier}d${denIndex}`
  m.packHome = { ...den }
  m.riftRole = 'spawner'
  return m
}

/**
 * Spawner emission: one white into the den annulus (radius 2–4), if the
 * active cap allows. Deterministic: fixed ring scan order + seeded body pick.
 * Returns true if anything spawned.
 */
export function trySpawnerEmission(game: GameState, spawner: Monster): boolean {
  if (game.monsters.length >= RIFT_ACTIVE_CAP) return false
  const den = spawner.packHome ?? spawner.position
  const spots = freeRingTiles(game.currentLevel, den, EMIT_RING[0], EMIT_RING[1], 1, game.monsters)
  const spot = spots[0]
  if (!spot) return false

  const tier = game.character.depth
  const body = randomItem(getRiftBodies(tier))
  if (!body) return false

  const m = spawnMonster(
    body,
    spot,
    Math.floor((game.balance.monsterHpPercent * WHITE_HP_PERCENT) / 100)
  )
  m.packId = spawner.packId
  m.packHome = { ...den }
  game.monsters.push(m)
  return true
}

/**
 * Rift boss: promoted tier base (highest-XP body) at 300% HP, spawned near
 * the arena center on the 3rd spawner kill. No pack home (unleashed).
 */
export function spawnRiftBoss(game: GameState): void {
  const tier = game.character.depth
  const base = getRiftBossBase(tier) ?? getRiftBodies(tier)[0]
  if (!base) return
  const level = game.currentLevel
  const center = level.entryPoint ?? {
    x: Math.floor(level.width / 2),
    y: Math.floor(level.height / 2),
  }
  const spots = freeRingTiles(level, center, 0, 3, 1, game.monsters)
  const spot = spots[0] ?? center
  const boss = spawnMonster(
    base,
    spot,
    Math.floor((game.balance.monsterHpPercent * RIFT_BOSS_HP_PERCENT) / 100)
  )
  boss.riftRole = 'boss'
  game.monsters.push(boss)
  addTaggedMessage(game, `A Riftlord ${base.name} erupts at the center of the arena!`, 'danger', {
    tags: ['progress'],
    importance: 5,
  })
}

/**
 * Free floor tiles in a Chebyshev annulus around a point, in fixed scan
 * order (deterministic). Occupancy comes from the caller's array: the
 * in-progress batch at gen time, game.monsters at runtime.
 */
function freeRingTiles(
  level: DungeonLevel,
  center: Point,
  rMin: number,
  rMax: number,
  limit: number,
  occupied: Monster[]
): Point[] {
  const out: Point[] = []
  for (let r = rMin; r <= rMax && out.length < limit; r++) {
    for (let dy = -r; dy <= r && out.length < limit; dy++) {
      for (let dx = -r; dx <= r && out.length < limit; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
        const x = center.x + dx
        const y = center.y + dy
        if (x < 1 || x >= level.width - 1 || y < 1 || y >= level.height - 1) continue
        const tile = getTile(level, x, y)
        if (!tile || tile.type !== 'floor') continue
        if (isMonsterAt(occupied, { x, y })) continue
        out.push({ x, y })
      }
    }
  }
  return out
}
