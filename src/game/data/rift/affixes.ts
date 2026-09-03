/**
 * Rift affix registry (ARPG dungeon).
 *
 * An affix is data: a name fragment, clone edits, and mechanic parameters.
 * Rares are cloned templates (never the shared base) with composed names;
 * mechanics resolve via flags + affixIds at runtime.
 *
 * First batch: Pit, Stone, Swift (clone-only), Thorns (melee reflect),
 * Swarm (death-spawns). The registry shape carries the rest (elemental
 * touches, dice, spell lists, blink, greed, auras, lifesteal) without
 * framework changes.
 */

import type { MonsterTemplate } from '../monsters'
import type { AttackEffect } from '../../types'
import { random } from '../../rng'

export type AffixKind = 'prefix' | 'suffix'

export interface AffixDef {
  id: string
  kind: AffixKind
  /** Name fragment: prefixes prepend ("Swift Ghoul"), suffixes append ("Ghoul of the Pit") */
  name: string
  /** Clone edits (stats only — flags/ids handled by the composer) */
  apply: (clone: MonsterTemplate) => void
  /** Template flags added (AI and combat read these) */
  flags?: string[]
  /** Melee reflect percent (Thorns-like). 0 = none. Melee only by design. */
  thornsPercent?: number
  /** Death-spawn count (Swarm-like). 0 = none. */
  deathSpawn?: number
  /** Tier weight endpoints; lerped by depthIntoScaling */
  weightEarly: number
  weightLate: number
  /** Incompatible affix ids (never co-occur on one rare) */
  excludes?: string[]
  /**
   * Attack effect types that disqualify a base body (e.g. speed affixes never
   * roll on hard-CC bodies — a swift paralyzer would stun-lock). Checked
   * against the base's attack effects before weighting.
   */
  notVsEffects?: AttackEffect['type'][]
}

const SWIFT_SPEED_BONUS = 30
const SWIFT_SPEED_CAP = 140
const STONE_ARMOR_BONUS = 30
const STONE_SPEED_PENALTY = 20
const STONE_SPEED_FLOOR = 20
const PIT_HP_MULT = 2
const THORNS_REFLECT_PERCENT = 30
const SWARM_MINI_COUNT = 2

export const PREFIXES: AffixDef[] = [
  {
    id: 'swift',
    kind: 'prefix',
    name: 'Swift',
    apply: (clone) => {
      clone.speed = Math.min(SWIFT_SPEED_CAP, clone.speed + SWIFT_SPEED_BONUS)
    },
    weightEarly: 3,
    weightLate: 2,
    excludes: ['echoes'],
    notVsEffects: ['PARALYZE', 'CONFUSE', 'BLIND', 'TERRIFY'],
  },
]

export const SUFFIXES: AffixDef[] = [
  {
    id: 'pit',
    kind: 'suffix',
    name: 'of the Pit',
    apply: (clone) => {
      clone.hp = Math.max(1, Math.floor(clone.hp * PIT_HP_MULT))
    },
    weightEarly: 3,
    weightLate: 2,
  },
  {
    id: 'stone',
    kind: 'suffix',
    name: 'of Stone',
    apply: (clone) => {
      clone.armor += STONE_ARMOR_BONUS
      clone.speed = Math.max(STONE_SPEED_FLOOR, clone.speed - STONE_SPEED_PENALTY)
    },
    weightEarly: 3,
    weightLate: 2,
  },
  {
    id: 'thorns',
    kind: 'suffix',
    name: 'of Thorns',
    apply: () => {},
    flags: ['AFFIX_THORNS'],
    thornsPercent: THORNS_REFLECT_PERCENT,
    weightEarly: 1,
    weightLate: 3,
    excludes: ['vampiric'],
  },
  {
    id: 'swarm',
    kind: 'suffix',
    name: 'of the Swarm',
    apply: () => {},
    flags: ['AFFIX_SWARM'],
    deathSpawn: SWARM_MINI_COUNT,
    weightEarly: 1,
    weightLate: 3,
  },
]

export const AFFIXES: Record<string, AffixDef> = Object.fromEntries(
  [...PREFIXES, ...SUFFIXES].map((a) => [a.id, a])
)

/** 0 at tier 1 → 1 at tier 10+ (deeper tiers unlock behavior affixes) */
function tierBlend(tier: number): number {
  return Math.max(0, Math.min(1, (tier - 1) / 9))
}

function weightOf(def: AffixDef, tier: number): number {
  const t = tierBlend(tier)
  return def.weightEarly + t * (def.weightLate - def.weightEarly)
}

function weightedRoll(
  pool: AffixDef[],
  tier: number,
  base: MonsterTemplate,
  exclude: string[] = []
): AffixDef | undefined {
  const baseEffects = new Set(base.attacks.map((a) => a.effect.type))
  const options = pool.filter(
    (a) => !exclude.includes(a.id) && !(a.notVsEffects ?? []).some((e) => baseEffects.has(e))
  )
  let total = 0
  for (const a of options) total += weightOf(a, tier)
  if (total <= 0) return undefined
  let roll = random() * total
  for (const a of options) {
    roll -= weightOf(a, tier)
    if (roll <= 0) return a
  }
  return options[options.length - 1]
}

export interface RolledAffixes {
  prefix?: AffixDef
  suffix?: AffixDef
}

/** One prefix (shared across blue packs). Base-aware: ineligible affixes excluded. */
export function rollPrefix(tier: number, base: MonsterTemplate): AffixDef | undefined {
  return weightedRoll(PREFIXES, tier, base)
}

/** Prefix + suffix with exclusion rules (rares, bosses). */
export function rollRareAffixes(tier: number, base: MonsterTemplate): RolledAffixes {
  const prefix = weightedRoll(PREFIXES, tier, base)
  const suffix = weightedRoll(SUFFIXES, tier, base, prefix?.excludes ?? [])
  return { prefix, suffix }
}

/**
 * Clone a base body with affixes applied: composed display name, baseName for
 * bestiary/bonuses, merged flags, affix ids for mechanic resolution.
 */
export function applyAffixesToClone(base: MonsterTemplate, rolled: RolledAffixes): MonsterTemplate {
  let name = base.name
  if (rolled.prefix) name = `${rolled.prefix.name} ${name}`
  if (rolled.suffix) name = `${name} ${rolled.suffix.name}`

  const clone: MonsterTemplate = {
    ...base,
    name,
    baseName: base.baseName ?? base.name,
    attacks: base.attacks.map((a) => ({ ...a, effect: { ...a.effect } })),
    flags: [...base.flags],
    affixIds: [
      ...(base.affixIds ?? []),
      ...(rolled.prefix ? [rolled.prefix.id] : []),
      ...(rolled.suffix ? [rolled.suffix.id] : []),
    ],
  }
  if (rolled.prefix) {
    rolled.prefix.apply(clone)
    if (rolled.prefix.flags) clone.flags.push(...rolled.prefix.flags)
  }
  if (rolled.suffix) {
    rolled.suffix.apply(clone)
    if (rolled.suffix.flags) clone.flags.push(...rolled.suffix.flags)
  }
  return clone
}

/** Total melee reflect percent on a template (sums Thorns-like affixes). */
export function thornsPercentOf(template: MonsterTemplate): number {
  let total = 0
  for (const id of template.affixIds ?? []) {
    total += AFFIXES[id]?.thornsPercent ?? 0
  }
  return total
}

/** Total death-spawn count on a template (sums Swarm-like affixes). */
export function deathSpawnOf(template: MonsterTemplate): number {
  let total = 0
  for (const id of template.affixIds ?? []) {
    total += AFFIXES[id]?.deathSpawn ?? 0
  }
  return total
}
