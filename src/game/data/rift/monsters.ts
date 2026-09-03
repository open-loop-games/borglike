/**
 * Rift monster data (ARPG dungeon) — first file of the data/rift split.
 *
 * Extends the classic tables, never modifies them: all helpers build on
 * data/monsters.ts queries. Classic spawn code paths cannot see these
 * (separate array, separate getters).
 */

import type { MonsterTemplate } from '../monsters'
import { getSpawnableMonsters } from '../monsters'

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
