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
import { applyDamage, resolveDefense } from '../combat'
import { getSpawnableMonsters, getMonsterByName } from '../data/monsters'
import {
  RIFT_SPAWNER_TEMPLATE,
  riftSpawnerHpPercent,
  RIFT_BOSS_HP_PERCENT,
  RIFT_GUARD_HP_PERCENT,
  getRiftBodies,
  getRiftBossBase,
  getMilestoneBossBase,
} from '../data/rift/monsters'
import {
  rollPrefix,
  rollRareAffixes,
  applyAffixesToClone,
  thornsPercentOf,
  deathSpawnOf,
  auraPercentOf,
} from '../data/rift/affixes'
import { shuffle, random, randomItem, randomInt } from '../rng'
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
/** Blue pack HP scalar (percent) on top of guard HP */
const BLUE_HP_PERCENT = 120
/** Emission annulus around the den (spread = gradient, zero per-tick cost) */
const EMIT_RING: [number, number] = [2, 4]
/** Per-den blue chance: 0.25 + tier, capped */
const BLUE_BASE_CHANCE = 0.25
const BLUE_PER_TIER = 0.02
const BLUE_MAX_CHANCE = 0.4
/** Rare-den chance per tier: one den hosts a rare instead of a plain pack */
const RARE_BASE_CHANCE = 0.3
const RARE_PER_TIER = 0.05
const RARE_MAX_CHANCE = 0.6
/** White guards ringing a rare */
const RARE_GUARDS: [number, number] = [2, 4]

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
 * Spawn a full rift tier: den spawners + packs (white, blue, or rare) + roamers.
 * Dens come from level geometry (level.riftDens, placed at gen).
 */
export function spawnRiftTier(
  level: DungeonLevel,
  tier: number,
  hpPercent: number,
  entry: Point
): Monster[] {
  const dens = level.riftDens ?? []
  const bodies = shuffle(getRiftBodies(tier))
  const rareDen = pickRareDen(dens.length, tier)
  const monsters: Monster[] = []
  for (let i = 0; i < dens.length; i++) {
    const den = dens[i]!
    const spawner = spawnDenSpawner(den, tier, hpPercent, i)
    if (spawner) monsters.push(spawner)
    if (i === rareDen) {
      monsters.push(...spawnRareDen(level, tier, hpPercent, den, i, bodies, monsters))
    } else {
      monsters.push(...spawnDenGuards(level, tier, hpPercent, den, i, bodies, monsters))
    }
  }
  const roamers = Math.min(ROAMER_BASE_COUNT + tier * ROAMER_PER_TIER, ROAMER_MAX_COUNT)
  monsters.push(...spawnRiftWhites(level, tier, hpPercent, entry, roamers))
  return monsters
}

/** Den body: deterministic per-den pick from the shuffled tier bodies. */
function denBody(
  bodies: ReturnType<typeof getRiftBodies>,
  denIndex: number
): ReturnType<typeof getRiftBodies>[number] | undefined {
  if (bodies.length === 0) return undefined
  return bodies[denIndex % bodies.length]
}

/** Which den (if any) hosts the tier rare. -1 = none. */
function pickRareDen(denCount: number, tier: number): number {
  if (denCount === 0) return -1
  const chance = Math.min(RARE_BASE_CHANCE + tier * RARE_PER_TIER, RARE_MAX_CHANCE)
  if (random() >= chance) return -1
  return randomInt(0, denCount - 1)
}

/** Shared pack spawner: copies of one body (plain or affixed clone) on a ring. */
function spawnGuardPack(
  level: DungeonLevel,
  body: ReturnType<typeof getRiftBodies>[number],
  hpPct: number,
  den: Point,
  packId: string,
  countRange: readonly [number, number],
  ringRadius: number,
  occupied: Monster[]
): Monster[] {
  const spots = freeRingTiles(level, den, 1, ringRadius, 8, occupied)
  const count = Math.min(randomInt(countRange[0], countRange[1]), spots.length)
  const pack: Monster[] = []
  for (let i = 0; i < count; i++) {
    const m = spawnMonster(body, spots[i]!, hpPct)
    m.packId = packId
    m.packHome = { ...den }
    pack.push(m)
  }
  return pack
}

/**
 * Den guards: white pack, or a blue pack sharing one prefix clone when the
 * tier roll says so (blues hit slightly harder through BLUE_HP_PERCENT).
 */
export function spawnDenGuards(
  level: DungeonLevel,
  tier: number,
  hpPercent: number,
  den: Point,
  denIndex: number,
  bodies: ReturnType<typeof getRiftBodies>,
  occupied: Monster[]
): Monster[] {
  const base = denBody(bodies, denIndex)
  if (!base) return []
  const packId = `t${tier}d${denIndex}`
  const blueChance = Math.min(BLUE_BASE_CHANCE + tier * BLUE_PER_TIER, BLUE_MAX_CHANCE)
  if (random() < blueChance) {
    const prefix = rollPrefix(tier, base)
    const body = prefix ? applyAffixesToClone(base, { prefix }) : base
    const hpPct = Math.floor((hpPercent * RIFT_GUARD_HP_PERCENT * BLUE_HP_PERCENT) / 10000)
    return spawnGuardPack(
      level,
      body,
      hpPct,
      den,
      packId,
      GUARDS_PER_DEN,
      GUARD_RING_RADIUS,
      occupied
    )
  }
  const hpPct = Math.floor((hpPercent * RIFT_GUARD_HP_PERCENT) / 100)
  return spawnGuardPack(
    level,
    base,
    hpPct,
    den,
    packId,
    GUARDS_PER_DEN,
    GUARD_RING_RADIUS,
    occupied
  )
}

/**
 * Rare den: one prefix+suffix rare of the den body, ringed by white guards.
 */
export function spawnRareDen(
  level: DungeonLevel,
  tier: number,
  hpPercent: number,
  den: Point,
  denIndex: number,
  bodies: ReturnType<typeof getRiftBodies>,
  occupied: Monster[]
): Monster[] {
  const base = denBody(bodies, denIndex)
  if (!base) return []
  const packId = `t${tier}d${denIndex}`
  const out: Monster[] = []
  const rareBody = applyAffixesToClone(base, rollRareAffixes(tier, base))
  const spots = freeRingTiles(level, den, 1, GUARD_RING_RADIUS, 8, occupied)
  if (spots.length === 0) return out
  // Rare takes the innermost free spot (closest to the den)
  const rare = spawnMonster(
    rareBody,
    spots[0]!,
    Math.floor((hpPercent * RIFT_GUARD_HP_PERCENT) / 100)
  )
  rare.packId = packId
  rare.packHome = { ...den }
  out.push(rare)
  const rest = spots.slice(1)
  const guardCount = Math.min(randomInt(RARE_GUARDS[0], RARE_GUARDS[1]), rest.length)
  for (let i = 0; i < guardCount; i++) {
    const g = spawnMonster(base, rest[i]!, Math.floor((hpPercent * RIFT_GUARD_HP_PERCENT) / 100))
    g.packId = packId
    g.packHome = { ...den }
    out.push(g)
  }
  return out
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
 * Rift boss: milestone unique bodies at native stats (already tier-true),
 * else promoted trash at 300%. Both roll prefix+suffix affixes.
 * No pack home (unleashed).
 */
export function spawnRiftBoss(game: GameState): void {
  const tier = game.character.depth
  const milestone = getMilestoneBossBase(tier)
  const base = milestone ?? getRiftBossBase(tier) ?? getRiftBodies(tier)[0]
  if (!base) return
  const body = applyAffixesToClone(base, rollRareAffixes(tier, base, milestone !== undefined))
  // Milestones bring their own HP curve; trash needs the multiplier
  const hpPct = milestone
    ? game.balance.monsterHpPercent
    : Math.floor((game.balance.monsterHpPercent * RIFT_BOSS_HP_PERCENT) / 100)
  const level = game.currentLevel
  const center = level.entryPoint ?? {
    x: Math.floor(level.width / 2),
    y: Math.floor(level.height / 2),
  }
  const spots = freeRingTiles(level, center, 0, 3, 1, game.monsters)
  const spot = spots[0] ?? center
  const boss = spawnMonster(body, spot, hpPct)
  boss.riftRole = 'boss'
  game.monsters.push(boss)
  addTaggedMessage(game, `A ${body.name} erupts at the center of the arena!`, 'danger', {
    tags: ['progress'],
    importance: 5,
  })
}

/**
 * Pack aura multiplier for a monster's attacks: same-pack allies within 4
 * tiles carrying a Pack-like affix lend their bonus (max wins, no stacking).
 */
export function packAuraMult(game: GameState, monster: Monster): number {
  if (!monster.packId) return 1
  let best = 0
  for (const ally of game.monsters) {
    if (ally.hp <= 0 || ally.id === monster.id) continue
    if (ally.packId !== monster.packId) continue
    const dist = Math.max(
      Math.abs(ally.position.x - monster.position.x),
      Math.abs(ally.position.y - monster.position.y)
    )
    if (dist > 4) continue
    best = Math.max(best, auraPercentOf(ally.template))
  }
  return best > 0 ? 1 + best / 100 : 1
}
/**
 * Melee-only thorns retaliation (affix design decision: thorns punish blades;
 * spells, arrows, and minions bypass). Call after dealing melee damage.
 */
/**
 * Melee-only thorns retaliation (thorns punish blades; spells, arrows, and
 * minions bypass). Resolves as physical damage through the standard defense
 * pipeline — armor mitigates (up to half), so plate answers thorns and the
 * affix stays a gear check rather than a melee ban.
 * Call after dealing melee damage.
 */
export function applyThornsReflect(game: GameState, monster: Monster, damageDealt: number): void {
  if (damageDealt <= 0 || monster.hp < 0) return
  const percent = thornsPercentOf(monster.template)
  if (percent <= 0) return
  const raw = Math.max(1, Math.floor((damageDealt * percent) / 100))
  const { finalDamage } = resolveDefense(game.character, {
    rawDamage: raw,
    attackerMonster: monster,
  })
  const killed = applyDamage(game.character, finalDamage)
  void killed // processTurn death check settles it
  game.stats.damageTaken += finalDamage
  game.stats.damageByMethod.melee += finalDamage
  addTaggedMessage(
    game,
    `The ${monster.template.name}'s thorns bite back for ${finalDamage} damage!`,
    'combat',
    { tags: ['damage.taken'], importance: 2 }
  )
}

/**
 * Affix death effects (Swarm-like minis). Cap-respecting; minis inherit the
 * parent's pack so leash and aggro stay coherent.
 */
export function handleAffixDeath(game: GameState, monster: Monster): void {
  const count = deathSpawnOf(monster.template)
  if (count <= 0) return
  const baseName = monster.template.baseName ?? monster.template.name
  const base = getMonsterByName(baseName)
  if (!base) return
  const spots = freeRingTiles(game.currentLevel, monster.position, 1, 3, count, game.monsters)
  let spawned = 0
  for (const spot of spots) {
    if (game.monsters.length >= RIFT_ACTIVE_CAP) break
    const mini = spawnMonster(
      base,
      spot,
      Math.floor((game.balance.monsterHpPercent * WHITE_HP_PERCENT) / 100)
    )
    mini.packId = monster.packId
    mini.packHome = monster.packHome ? { ...monster.packHome } : undefined
    game.monsters.push(mini)
    spawned++
  }
  if (spawned > 0) {
    addTaggedMessage(
      game,
      `The ${monster.template.name} bursts, releasing ${spawned} minis!`,
      'combat',
      { tags: ['combat.kill'], importance: 2 }
    )
  }
}

/**
 * Free floor tiles in a Chebyshev annulus around a point, in fixed scan
 * order (deterministic). Occupancy comes from the caller's array: the
 * in-progress batch at gen time, game.monsters at runtime.
 */
export function freeRingTiles(
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
