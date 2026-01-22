/**
 * Shapeshift Form Definitions for Borglike
 *
 * SHAPESHIFTING: Druid and Necromancer can transform into alternate forms
 * that provide stat modifiers and special abilities.
 *
 * Forms are toggled on/off - only one form can be active at a time.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface ShapeformTemplate {
  id: string
  name: string
  /** Which class can use this form */
  classId: string
  /** Minimum character level required */
  minLevel: number
  /** Mana cost to activate (0 = free toggle) */
  manaCost: number
  /** Duration in turns (0 = toggle, stays until cancelled) */
  duration: number
  /** Stat modifiers while in form */
  statMods: ShapeformStatMods
  /** Special flags for unique abilities */
  specialFlags?: string[]
  /** Description for UI */
  description: string
}

export interface ShapeformStatMods {
  /** STR modifier */
  strMod?: number
  /** DEX modifier */
  dexMod?: number
  /** CON modifier */
  conMod?: number
  /** INT modifier */
  intMod?: number
  /** WIS modifier */
  wisMod?: number
  /** Flat armor modifier */
  armorMod?: number
  /** Speed modifier (added to base 100) */
  speedMod?: number
  /** Evasion modifier */
  evasionMod?: number
  /** Melee damage percent modifier */
  meleeDamageMod?: number
}

// ============================================================================
// FORM DEFINITIONS
// ============================================================================

/**
 * Bear Form - Druid's melee combat form
 *
 * Increases STR and armor at the cost of speed.
 * Best for tanking and dealing melee damage.
 */
const bearForm: ShapeformTemplate = {
  id: 'bear_form',
  name: 'Bear Form',
  classId: 'druid',
  minLevel: 5,
  manaCost: 10,
  duration: 0, // Toggle
  statMods: {
    strMod: 4,
    armorMod: 10,
    speedMod: -10,
    meleeDamageMod: 20, // +20% melee damage
  },
  description: 'Transform into a powerful bear, gaining strength and armor but losing speed.',
}

/**
 * Raven Form - Druid's evasion/mobility form
 *
 * Increases DEX and evasion with a speed boost.
 * Best for exploration and avoiding danger.
 */
const ravenForm: ShapeformTemplate = {
  id: 'raven_form',
  name: 'Raven Form',
  classId: 'druid',
  minLevel: 10,
  manaCost: 8,
  duration: 0, // Toggle
  statMods: {
    dexMod: 4,
    speedMod: 20,
    evasionMod: 15,
  },
  description: 'Transform into a swift raven, gaining speed and evasion.',
}

/**
 * Shadow Form - Necromancer's stealth/lifedrain form
 *
 * Increases evasion and grants lifedrain on attacks.
 * Best for sustained combat with self-healing.
 */
const shadowForm: ShapeformTemplate = {
  id: 'shadow_form',
  name: 'Shadow Form',
  classId: 'necromancer',
  minLevel: 15,
  manaCost: 15,
  duration: 0, // Toggle
  statMods: {
    evasionMod: 15,
    dexMod: 2,
  },
  specialFlags: ['lifedrain'], // 10% lifesteal while active
  description: 'Become a living shadow, harder to hit and draining life from foes.',
}

// ============================================================================
// FORM REGISTRY
// ============================================================================

export const SHAPEFORMS: ShapeformTemplate[] = [
  bearForm,
  ravenForm,
  shadowForm,
]

/**
 * Get a shapeform by ID
 */
export function getFormById(formId: string): ShapeformTemplate | undefined {
  return SHAPEFORMS.find(f => f.id === formId)
}

/**
 * Get all forms available to a specific class
 */
export function getFormsForClass(classId: string): ShapeformTemplate[] {
  return SHAPEFORMS.filter(f => f.classId === classId)
}

/**
 * Get all forms available to a character (class + level check)
 */
export function getAvailableForms(classId: string, level: number): ShapeformTemplate[] {
  return SHAPEFORMS.filter(f => f.classId === classId && level >= f.minLevel)
}

/**
 * Check if a character can use shapeshifting at all
 */
export function canShapeshift(classId: string): boolean {
  return SHAPEFORMS.some(f => f.classId === classId)
}

/**
 * Check if a form has the lifedrain flag
 */
export function hasLifedrain(form: ShapeformTemplate): boolean {
  return form.specialFlags?.includes('lifedrain') ?? false
}
