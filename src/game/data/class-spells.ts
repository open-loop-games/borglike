/**
 * Class Spell Lists for Borglike
 *
 * Maps classes to their available spells and the levels at which they learn them.
 */

import { getSpellById, type SpellTemplate } from './spells'

// ============================================================================
// TYPES
// ============================================================================

/** Spell entry with level requirement */
export interface ClassSpellEntry {
  spellId: string
  learnLevel: number // character level at which spell is learned
}

/** Class spell list definition */
export interface ClassSpellList {
  classId: string
  spells: ClassSpellEntry[]
}

// ============================================================================
// CLASS SPELL LISTS
// ============================================================================

/**
 * Mage - Full arcane caster (7 spells)
 * Gets Phase Door and Mage Armor at level 1 for early survival
 */
const mageSpells: ClassSpellList = {
  classId: 'mage',
  spells: [
    { spellId: 'magic_missile', learnLevel: 1 },
    { spellId: 'phase_door', learnLevel: 1 }, // Early escape spell
    { spellId: 'mage_armor', learnLevel: 1 }, // Early defense buff
    { spellId: 'frost_bolt', learnLevel: 5 },
    { spellId: 'lightning_bolt', learnLevel: 15 },
    { spellId: 'fireball', learnLevel: 20 },
    { spellId: 'teleport', learnLevel: 25 },
  ],
}

/**
 * Rogue - Limited arcane magic (3 spells)
 * Gets utility/escape spells
 */
const rogueSpells: ClassSpellList = {
  classId: 'rogue',
  spells: [
    { spellId: 'magic_missile', learnLevel: 3 },
    { spellId: 'phase_door', learnLevel: 8 },
    { spellId: 'frost_bolt', learnLevel: 15 },
  ],
}

/**
 * Archmage - Ultimate arcane caster (6 spells, learns faster)
 * Prestige class - more powerful versions
 */
const archmageSpells: ClassSpellList = {
  classId: 'archmage',
  spells: [
    { spellId: 'magic_missile', learnLevel: 1 },
    { spellId: 'phase_door', learnLevel: 1 }, // Early escape like Mage - essential for glass cannon
    { spellId: 'frost_bolt', learnLevel: 1 }, // Extra damage spell at L1
    { spellId: 'lightning_bolt', learnLevel: 5 },
    { spellId: 'fireball', learnLevel: 12 },
    { spellId: 'teleport', learnLevel: 18 },
  ],
}

/**
 * Priest - Full divine caster (6 spells)
 * Focused on healing and anti-evil
 */
const priestSpells: ClassSpellList = {
  classId: 'priest',
  spells: [
    { spellId: 'minor_heal', learnLevel: 1 },
    { spellId: 'bless', learnLevel: 5 },
    { spellId: 'cure_wounds', learnLevel: 10 },
    { spellId: 'smite_evil', learnLevel: 15 },
    { spellId: 'sanctuary', learnLevel: 25 },
    { spellId: 'holy_word', learnLevel: 35 },
  ],
}

/**
 * Paladin - Limited divine magic (4 spells)
 * Combat-focused divine warrior
 */
const paladinSpells: ClassSpellList = {
  classId: 'paladin',
  spells: [
    { spellId: 'minor_heal', learnLevel: 3 },
    { spellId: 'bless', learnLevel: 8 },
    { spellId: 'smite_evil', learnLevel: 12 },
    { spellId: 'cure_wounds', learnLevel: 20 },
  ],
}

/**
 * Druid - Nature caster (5 spells)
 * Nature magic with healing and elemental power
 */
const druidSpells: ClassSpellList = {
  classId: 'druid',
  spells: [
    { spellId: 'entangle', learnLevel: 1 },
    { spellId: 'natures_balm', learnLevel: 5 },
    { spellId: 'thorn_strike', learnLevel: 10 },
    { spellId: 'resist_elements', learnLevel: 18 },
    { spellId: 'lightning_storm', learnLevel: 28 },
  ],
}

/**
 * Ranger - Nature magic with companion (6 spells)
 * Gets wolf companion and root shot early for survival
 */
const rangerSpells: ClassSpellList = {
  classId: 'ranger',
  spells: [
    { spellId: 'summon_wolf', learnLevel: 1 }, // Wolf companion from start
    { spellId: 'root_shot', learnLevel: 1 }, // Stun shot for kiting
    { spellId: 'natures_balm', learnLevel: 5 }, // Early heal for sustain
    { spellId: 'entangle', learnLevel: 10 },
    { spellId: 'thorn_strike', learnLevel: 15 },
    { spellId: 'resist_elements', learnLevel: 25 },
  ],
}

/**
 * Necromancer - Shadow caster with minions (6 spells)
 * Dark magic with life drain and skeleton summon from L1
 */
const necromancerSpells: ClassSpellList = {
  classId: 'necromancer',
  spells: [
    { spellId: 'drain_life', learnLevel: 1 },
    { spellId: 'summon_skeleton', learnLevel: 1 }, // Skeleton from start for early survival
    { spellId: 'shadow_bolt', learnLevel: 5 },
    { spellId: 'weaken', learnLevel: 12 },
    { spellId: 'dark_pact', learnLevel: 18 },
    { spellId: 'soul_rend', learnLevel: 28 },
  ],
}

/**
 * Blackguard - Limited shadow magic (4 spells)
 * Dark warrior with life steal
 */
const blackguardSpells: ClassSpellList = {
  classId: 'blackguard',
  spells: [
    { spellId: 'drain_life', learnLevel: 3 },
    { spellId: 'shadow_bolt', learnLevel: 8 },
    { spellId: 'weaken', learnLevel: 15 },
    { spellId: 'dark_pact', learnLevel: 22 },
  ],
}

// ============================================================================
// SPELL LIST COLLECTION
// ============================================================================

/** All class spell lists, indexed by class ID */
export const CLASS_SPELL_LISTS: Record<string, ClassSpellList> = {
  mage: mageSpells,
  rogue: rogueSpells,
  archmage: archmageSpells,
  priest: priestSpells,
  paladin: paladinSpells,
  druid: druidSpells,
  ranger: rangerSpells,
  necromancer: necromancerSpells,
  blackguard: blackguardSpells,
}

/** Classes that have no spells */
export const NON_CASTER_CLASSES = ['warrior', 'berserker']

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the spell list for a class
 */
export function getClassSpellList(classId: string): ClassSpellList | undefined {
  return CLASS_SPELL_LISTS[classId]
}

/**
 * Check if a class can cast spells
 */
export function classCanCast(classId: string): boolean {
  return CLASS_SPELL_LISTS[classId] !== undefined
}

/**
 * Get spells available to a class at a given level
 */
export function getSpellsForLevel(classId: string, level: number): SpellTemplate[] {
  const spellList = CLASS_SPELL_LISTS[classId]
  if (!spellList) return []

  return spellList.spells
    .filter((entry) => entry.learnLevel <= level)
    .map((entry) => getSpellById(entry.spellId))
    .filter((spell): spell is SpellTemplate => spell !== undefined)
}

/**
 * Get spell IDs available to a class at a given level
 */
export function getSpellIdsForLevel(classId: string, level: number): string[] {
  const spellList = CLASS_SPELL_LISTS[classId]
  if (!spellList) return []

  return spellList.spells.filter((entry) => entry.learnLevel <= level).map((entry) => entry.spellId)
}

/**
 * Get newly learned spells when leveling up
 */
export function getNewSpellsAtLevel(classId: string, level: number): SpellTemplate[] {
  const spellList = CLASS_SPELL_LISTS[classId]
  if (!spellList) return []

  return spellList.spells
    .filter((entry) => entry.learnLevel === level)
    .map((entry) => getSpellById(entry.spellId))
    .filter((spell): spell is SpellTemplate => spell !== undefined)
}

/**
 * Get the primary school for a class (for UI/theme purposes)
 */
export function getClassPrimarySchool(
  classId: string
): 'arcane' | 'divine' | 'nature' | 'shadow' | null {
  switch (classId) {
    case 'mage':
    case 'rogue':
    case 'archmage':
      return 'arcane'
    case 'priest':
    case 'paladin':
      return 'divine'
    case 'druid':
    case 'ranger':
      return 'nature'
    case 'necromancer':
    case 'blackguard':
      return 'shadow'
    default:
      return null
  }
}
