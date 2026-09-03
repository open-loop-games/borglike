/**
 * Rift affix registry (ARPG dungeon).
 *
 * An affix is data: a name fragment, clone edits, and mechanic parameters.
 * Rares are cloned templates (never the shared base) with composed names;
 * mechanics resolve via flags + affixIds at runtime.
 *
 * Affixes carry their own tuning and eligibility rules, so adding one is a
 * table entry plus (for a new mechanic) one accessor — never a framework change.
 */

import type { MonsterTemplate } from '../monsters'
import type { AttackEffect, Element } from '../../types'
import { random } from '../../rng'

export interface AffixDef {
  id: string
  /** Name fragment: prefixes prepend ("Swift Ghoul"), suffixes append ("Ghoul of the Pit") */
  name: string
  /** Clone edits (stats only — flags/ids handled by the composer). Omit for data-only affixes. */
  apply?: (clone: MonsterTemplate) => void
  /** Template flags added (AI and combat read these) */
  flags?: string[]
  /** Melee reflect percent (Thorns-like). 0 = none. Melee only by design. */
  thornsPercent?: number
  /** Death-spawn count (Swarm-like). 0 = none. */
  deathSpawn?: number
  /** Lifesteal percent of damage dealt (Vampiric-like). 0 = none. */
  drainPercent?: number
  /** Damage bonus for nearby allies percent (Pack-like). 0 = none. */
  auraPercent?: number
  /** Gold drop multiplier (Greed-like). 1 = none. */
  goldMult?: number
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
  /** Requires at least one plain-damage attack (elemental converters) */
  needsHurtAttack?: boolean
  /**
   * Skipped for milestone uniques (their native HP curve is already
   * boss-grade — multipliers would double-dip).
   */
  noMilestone?: boolean
}

const SWIFT_SPEED_BONUS = 30
const SWIFT_SPEED_CAP = 140
const STONE_ARMOR_BONUS = 30
const STONE_SPEED_PENALTY = 20
const STONE_SPEED_FLOOR = 20
const PIT_HP_MULT = 2
const THORNS_REFLECT_PERCENT = 30
const SWARM_MINI_COUNT = 2
const VAMPIRIC_DRAIN_PERCENT = 50
const PACK_AURA_PERCENT = 25
const GREED_GOLD_MULT = 3
const GREED_HP_MULT = 0.8
const HEX_SPELL_FREQ = 4

const DIE_LADDER = [2, 3, 4, 6, 8, 10, 12, 20]

/** Bump every die one step (2d6 → 2d8). Unknown shapes pass through. */
function bumpDice(notation: string): string {
  const m = /^(\d+)d(\d+)([+-]\d+)?$/.exec(notation.trim())
  if (!m) return notation
  const sides = Number(m[2])
  const idx = DIE_LADDER.indexOf(sides)
  const next = idx >= 0 && idx < DIE_LADDER.length - 1 ? DIE_LADDER[idx + 1]! : sides
  return `${m[1]}d${next}${m[3] ?? ''}`
}

/** First plain-damage attack index, or -1. */
function firstHurtIndex(clone: MonsterTemplate): number {
  return clone.attacks.findIndex((a) => a.effect.type === 'HURT')
}

/** Convert the first plain attack to an element (keeps dice and method). */
function convertToElement(clone: MonsterTemplate, element: Element): void {
  const i = firstHurtIndex(clone)
  if (i < 0) return
  const attack = clone.attacks[i]!
  clone.attacks[i] = { ...attack, effect: { type: 'ELEMENTAL', element } }
  if (!clone.resist?.includes(element)) {
    clone.resist = [...(clone.resist ?? []), element]
  }
}

/** Grant a monster spell (appends to the clone's list or creates one). */
function grantSpell(clone: MonsterTemplate, spell: 'SLOW' | 'BO_FIRE'): void {
  if (clone.spells) {
    if (!clone.spells.list.includes(spell)) {
      clone.spells = { ...clone.spells, list: [...clone.spells.list, spell] }
    }
    return
  }
  clone.spells = { freq: HEX_SPELL_FREQ, list: [spell] }
}

export const PREFIXES: AffixDef[] = [
  {
    id: 'swift',
    name: 'Swift',
    apply: (clone) => {
      clone.speed = Math.min(SWIFT_SPEED_CAP, clone.speed + SWIFT_SPEED_BONUS)
    },
    weightEarly: 3,
    weightLate: 2,
    excludes: ['echoes'],
    notVsEffects: ['PARALYZE', 'CONFUSE', 'BLIND', 'TERRIFY'],
  },
  {
    id: 'burning',
    name: 'Burning',
    apply: (clone) => convertToElement(clone, 'FIRE'),
    weightEarly: 2,
    weightLate: 3,
    needsHurtAttack: true,
  },
  {
    id: 'frozen',
    name: 'Frozen',
    apply: (clone) => {
      const i = firstHurtIndex(clone)
      if (i < 0) return
      const attack = clone.attacks[i]!
      clone.attacks[i] = { ...attack, effect: { type: 'SLOW' } }
      if (!clone.resist?.includes('COLD')) {
        clone.resist = [...(clone.resist ?? []), 'COLD']
      }
    },
    weightEarly: 2,
    weightLate: 3,
    needsHurtAttack: true,
    notVsEffects: ['SLOW'],
  },
  {
    id: 'venomous',
    name: 'Venomous',
    apply: (clone) => convertToElement(clone, 'POISON'),
    weightEarly: 2,
    weightLate: 3,
    needsHurtAttack: true,
  },
  {
    id: 'brutal',
    name: 'Brutal',
    apply: (clone) => {
      clone.attacks = clone.attacks.map((a) => ({ ...a, dice: bumpDice(a.dice) }))
    },
    weightEarly: 3,
    weightLate: 3,
  },
  {
    id: 'hexing',
    name: 'Hexing',
    apply: (clone) => grantSpell(clone, 'SLOW'),
    weightEarly: 1,
    weightLate: 3,
  },
  {
    id: 'spitting',
    name: 'Spitting',
    apply: (clone) => grantSpell(clone, 'BO_FIRE'),
    weightEarly: 1,
    weightLate: 3,
  },
  {
    id: 'vampiric',
    name: 'Vampiric',
    flags: ['AFFIX_VAMPIRIC'],
    drainPercent: VAMPIRIC_DRAIN_PERCENT,
    weightEarly: 1,
    weightLate: 3,
    excludes: ['thorns'],
  },
]

export const SUFFIXES: AffixDef[] = [
  {
    id: 'pit',
    name: 'of the Pit',
    apply: (clone) => {
      clone.hp = Math.max(1, Math.floor(clone.hp * PIT_HP_MULT))
    },
    weightEarly: 3,
    weightLate: 2,
    noMilestone: true,
  },
  {
    id: 'stone',
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
    name: 'of Thorns',
    flags: ['AFFIX_THORNS'],
    thornsPercent: THORNS_REFLECT_PERCENT,
    weightEarly: 1,
    weightLate: 3,
    excludes: ['vampiric'],
  },
  {
    id: 'swarm',
    name: 'of the Swarm',
    flags: ['AFFIX_SWARM'],
    deathSpawn: SWARM_MINI_COUNT,
    weightEarly: 1,
    weightLate: 3,
  },
  {
    id: 'wisp',
    name: 'of the Wisp',
    flags: ['AFFIX_WISP'],
    weightEarly: 1,
    weightLate: 3,
  },
  {
    id: 'greed',
    name: 'of Greed',
    apply: (clone) => {
      clone.hp = Math.max(1, Math.floor(clone.hp * GREED_HP_MULT))
    },
    flags: ['AFFIX_GREED'],
    goldMult: GREED_GOLD_MULT,
    weightEarly: 2,
    weightLate: 2,
  },
  {
    id: 'pack',
    name: 'of the Pack',
    flags: ['AFFIX_PACK'],
    auraPercent: PACK_AURA_PERCENT,
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
  const hasHurt = baseEffects.has('HURT')
  const options = pool.filter(
    (a) =>
      !exclude.includes(a.id) &&
      !(a.notVsEffects ?? []).some((e) => baseEffects.has(e)) &&
      (!a.needsHurtAttack || hasHurt)
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

/** Prefix + suffix with exclusion rules, checked both directions (rares, bosses). */
export function rollRareAffixes(
  tier: number,
  base: MonsterTemplate,
  milestone = false
): RolledAffixes {
  const prefix = weightedRoll(PREFIXES, tier, base)
  // Exclude the prefix's bans plus any suffix that bans the prefix
  const banned = new Set(prefix?.excludes ?? [])
  for (const s of SUFFIXES) {
    if (prefix && s.excludes?.includes(prefix.id)) banned.add(s.id)
    if (milestone && s.noMilestone) banned.add(s.id)
  }
  const suffix = weightedRoll(SUFFIXES, tier, base, [...banned])
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
    rolled.prefix.apply?.(clone)
    if (rolled.prefix.flags) clone.flags.push(...rolled.prefix.flags)
  }
  if (rolled.suffix) {
    rolled.suffix.apply?.(clone)
    if (rolled.suffix.flags) clone.flags.push(...rolled.suffix.flags)
  }
  return clone
}

/**
 * Sum a stacking affix stat across a template's affixes.
 *
 * Hot: runs per melee exchange for every monster, affixed or not. The bare
 * `affixIds` test keeps the unaffixed path (every classic monster, every rift
 * white) free of the array-and-iterator allocation `?? []` would cost.
 */
function sumAffix(
  template: MonsterTemplate,
  key: 'thornsPercent' | 'deathSpawn' | 'drainPercent'
): number {
  const ids = template.affixIds
  if (!ids) return 0
  let total = 0
  for (let i = 0; i < ids.length; i++) {
    total += AFFIXES[ids[i]!]?.[key] ?? 0
  }
  return total
}

/** Best of a non-stacking affix stat across a template's affixes (max wins). */
function maxAffix(
  template: MonsterTemplate,
  key: 'auraPercent' | 'goldMult',
  identity: number
): number {
  const ids = template.affixIds
  if (!ids) return identity
  let best = identity
  for (let i = 0; i < ids.length; i++) {
    best = Math.max(best, AFFIXES[ids[i]!]?.[key] ?? identity)
  }
  return best
}

/** Total melee reflect percent on a template (sums Thorns-like affixes). */
export function thornsPercentOf(template: MonsterTemplate): number {
  return sumAffix(template, 'thornsPercent')
}

/** Total death-spawn count on a template (sums Swarm-like affixes). */
export function deathSpawnOf(template: MonsterTemplate): number {
  return sumAffix(template, 'deathSpawn')
}

/** Lifesteal percent of damage dealt (Vampiric-like). */
export function drainPercentOf(template: MonsterTemplate): number {
  return sumAffix(template, 'drainPercent')
}

/** Damage bonus for nearby allies percent (Pack-like, non-stacking — max wins). */
export function auraPercentOf(template: MonsterTemplate): number {
  return maxAffix(template, 'auraPercent', 0)
}

/** Gold drop multiplier (Greed-like, non-stacking — max wins). */
export function greedMultOf(template: MonsterTemplate): number {
  return maxAffix(template, 'goldMult', 1)
}
