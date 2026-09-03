/**
 * Rift monster data (ARPG dungeon) — first file of the data/rift split.
 *
 * Extends the classic tables, never modifies them: all helpers build on
 * data/monsters.ts queries. Classic spawn code paths cannot see these
 * (separate array, separate getters).
 */

import type { MonsterTemplate } from '../monsters'
import { getSpawnableMonsters, getMonsterByName } from '../monsters'
import { randomItem } from '../../rng'

/**
 * The rift spawner: an immobile structure-monster, one per den.
 *
 * Emission clock reuses the energy loop: speed 7 ≈ 6 energy/player turn ≈
 * one emission per ~17 turns, fully deterministic, no new timers.
 * attacks: [] is null-safe downstream (average damage 0, never attacks —
 * the director's emission branch runs before decideAction).
 */
export const RIFT_SPAWNER_TEMPLATE: MonsterTemplate = {
  name: 'Rift Spawner',
  char: 'S',
  color: 'red',
  minDepth: 1,
  hp: 40,
  speed: 7,
  armor: 0,
  experience: 10,
  flags: [],
  attacks: [],
}

/** Rift spawner HP scales per tier: base 40 × tier (via spawn hpPercent) */
export function riftSpawnerHpPercent(tier: number): number {
  return 100 * Math.max(1, tier)
}

/** Rift boss HP: 300% of the promoted base */
export const RIFT_BOSS_HP_PERCENT = 300

/** Den guard HP: 150% of the same-body base */
export const RIFT_GUARD_HP_PERCENT = 150

/** Non-unique classic bodies valid at this tier (whites, guards, boss base) */
export function getRiftBodies(tier: number): MonsterTemplate[] {
  return getSpawnableMonsters(tier).filter((t) => !t.flags?.includes('UNIQUE'))
}

/**
 * Boss base: the highest-XP non-unique body in the tier window.
 * Deterministic (no roll); ties resolve to the first listed.
 */
export function getRiftBossBase(tier: number): MonsterTemplate | undefined {
  let best: MonsterTemplate | undefined
  for (const t of getRiftBodies(tier)) {
    if (!best || t.experience > best.experience) best = t
  }
  return best
}

/**
 * Milestone boss bodies: native classic uniques at tiers matching their
 * depth (tier ≈ depth/3). T3 and T17+ pools roll one body per run (seeded).
 * Morgoth is deliberately excluded — killing him by name triggers victory.
 */
const MILESTONE_BOSSES: Record<number, string[]> = {
  2: ['Bullroarer the Hobbit'],
  3: ['Wormtongue, Agent of Saruman', 'Grishnakh, the Hill Orc'],
  7: ['Bolg, Son of Azog'],
  8: ['Azog, Enemy of the Dwarves'],
  9: ['Lugdush, Uruk Captain'],
  12: ['Lokkak, the Ogre Chieftain'],
}

const DEEP_BOSSES = ['Gothmog, High Captain of Balrogs', 'Sauron, the Sorcerer', 'Smaug the Golden']

export const DEEP_BOSS_TIER = 17

/** Milestone unique body for this tier, or undefined for promoted-trash tiers. */
export function getMilestoneBossBase(tier: number): MonsterTemplate | undefined {
  const pool = MILESTONE_BOSSES[tier] ?? (tier >= DEEP_BOSS_TIER ? DEEP_BOSSES : undefined)
  if (!pool) return undefined
  const name = randomItem(pool)
  return name ? getMonsterByName(name) : undefined
}
