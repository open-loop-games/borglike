/**
 * Upgrade Effects Module
 *
 * Pure functions for computing bonuses from upgrade levels.
 * Used to apply meta-progression upgrades to gameplay.
 */

import { getUpgradeById, calculateUpgradeEffect } from './data/upgrades'

// ============================================================================
// TYPES
// ============================================================================

/** Computed stat bonuses from upgrades */
export interface UpgradeBonuses {
  // Stat bonuses
  maxHpBonus: number // Flat HP bonus (from vitality)
  damagePercent: number // Damage multiplier percent (from might)
  armorBonus: number // Flat armor bonus (from resilience)
  dodgePercent: number // Dodge chance percent (from swiftness)

  // Meta bonuses (multipliers)
  xpMultiplier: number // XP gain multiplier (from fast_learner)
  goldMultiplier: number // Gold gain multiplier (from gold_digger)
  essenceMultiplier: number // Essence gain multiplier (from essence_boost)

  // Bot/AI bonuses
  trapVisionBonus: number // Extra trap detection range (from sharp_eyes)
  identifySpeedPercent: number // Item identification speed (from quick_learner)
  retreatIQBonus: number // Better retreat decisions (from tactician)
  lootIQBonus: number // Better loot prioritization (from pack_rat)
  hasDangerSense: boolean // Factor resistances into danger assessment (from danger_sense)
  hasEfficientHealing: boolean // Use appropriate potion tier (from efficient_healer)
  battleInstinctBonus: number // Smarter combat scoring (from battle_instinct)

  // QoL bonuses
  turboSpeedPercent: number // Extra turbo speed (from turbo_mode)
  hasAutoRestart: boolean // Auto-restart enabled (from auto_restart)
}

/** Upgrade level state (typically from Pinia store) */
export interface UpgradeLevels {
  [upgradeId: string]: number
}

// ============================================================================
// COMPUTE BONUSES
// ============================================================================

/**
 * Compute all upgrade bonuses from current upgrade levels
 *
 * @param levels - Current upgrade level state
 * @returns Computed bonuses ready to apply to gameplay
 */
export function computeUpgradeBonuses(levels: UpgradeLevels): UpgradeBonuses {
  return {
    // Stat bonuses
    maxHpBonus: getEffectValue(levels, 'vitality'),
    damagePercent: getEffectValue(levels, 'might'),
    armorBonus: getEffectValue(levels, 'resilience'),
    dodgePercent: getEffectValue(levels, 'swiftness'),

    // Meta bonuses
    xpMultiplier: 1 + getEffectValue(levels, 'fast_learner') / 100,
    goldMultiplier: 1 + getEffectValue(levels, 'gold_digger') / 100,
    essenceMultiplier: 1 + getEffectValue(levels, 'essence_boost') / 100,

    // Bot/AI bonuses
    trapVisionBonus: getEffectValue(levels, 'sharp_eyes'),
    identifySpeedPercent: getEffectValue(levels, 'quick_learner'),
    retreatIQBonus: getEffectValue(levels, 'tactician'),
    lootIQBonus: getEffectValue(levels, 'pack_rat'),
    hasDangerSense: (levels['danger_sense'] || 0) > 0,
    hasEfficientHealing: (levels['efficient_healer'] || 0) > 0,
    battleInstinctBonus: getEffectValue(levels, 'battle_instinct'),

    // QoL bonuses
    turboSpeedPercent: getEffectValue(levels, 'turbo_mode'),
    hasAutoRestart: (levels['auto_restart'] || 0) > 0,
  }
}

/**
 * Get the computed effect value for a specific upgrade
 */
function getEffectValue(levels: UpgradeLevels, upgradeId: string): number {
  const level = levels[upgradeId] || 0
  if (level <= 0) return 0

  const upgrade = getUpgradeById(upgradeId)
  if (!upgrade) return 0

  return calculateUpgradeEffect(upgrade, level)
}

// ============================================================================
// DEFAULT BONUSES
// ============================================================================

/**
 * Default bonuses when no upgrades are purchased
 */
export const DEFAULT_BONUSES: UpgradeBonuses = {
  maxHpBonus: 0,
  damagePercent: 0,
  armorBonus: 0,
  dodgePercent: 0,
  xpMultiplier: 1,
  goldMultiplier: 1,
  essenceMultiplier: 1,
  trapVisionBonus: 0,
  identifySpeedPercent: 0,
  retreatIQBonus: 0,
  lootIQBonus: 0,
  hasDangerSense: false,
  hasEfficientHealing: false,
  battleInstinctBonus: 0,
  turboSpeedPercent: 0,
  hasAutoRestart: false,
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Apply damage multiplier to a base damage value
 */
export function applyDamageBonus(baseDamage: number, bonuses: UpgradeBonuses): number {
  return Math.floor(baseDamage * (1 + bonuses.damagePercent / 100))
}

/**
 * Apply XP multiplier to earned XP
 */
export function applyXPBonus(baseXP: number, bonuses: UpgradeBonuses): number {
  return Math.floor(baseXP * bonuses.xpMultiplier)
}

/**
 * Apply gold multiplier to found gold
 */
export function applyGoldBonus(baseGold: number, bonuses: UpgradeBonuses): number {
  return Math.floor(baseGold * bonuses.goldMultiplier)
}

// ============================================================================
// BOOSTER INTEGRATION
// ============================================================================

import type { BoosterBonuses } from './booster-effects'
import { DEFAULT_BOOSTER_BONUSES } from './booster-effects'

/** Combined bonuses from both upgrades and boosters */
export interface CombinedBonuses extends UpgradeBonuses {
  // Booster-specific bonuses
  strBonus: number
  dexBonus: number
  conBonus: number
  intBonus: number
  wisBonus: number
  startingWeaponBonus: number
  startingArmorBonus: number
  startsWithPotion: boolean
  hasSecondWind: boolean
  secondWindPercent: number
  inventoryBonus: number
}

/**
 * Merge upgrade bonuses with booster bonuses
 *
 * - Stat bonuses from boosters are passed through for character creation
 * - Equipment bonuses are passed through for starting gear
 * - Multipliers stack multiplicatively
 * - Special effects are combined
 *
 * @param upgradeBonuses - Bonuses from meta-progression upgrades
 * @param boosterBonuses - Bonuses from active per-run boosters
 * @returns Combined bonuses ready for game systems
 */
export function mergeWithBoosterBonuses(
  upgradeBonuses: UpgradeBonuses,
  boosterBonuses: BoosterBonuses = DEFAULT_BOOSTER_BONUSES
): CombinedBonuses {
  return {
    // Pass through all upgrade bonuses
    ...upgradeBonuses,

    // Multipliers stack multiplicatively
    xpMultiplier: upgradeBonuses.xpMultiplier * boosterBonuses.xpMultiplier,
    goldMultiplier: upgradeBonuses.goldMultiplier * boosterBonuses.goldMultiplier,

    // Booster-specific stat bonuses (passed through to character creation)
    strBonus: boosterBonuses.strBonus,
    dexBonus: boosterBonuses.dexBonus,
    conBonus: boosterBonuses.conBonus,
    intBonus: boosterBonuses.intBonus,
    wisBonus: boosterBonuses.wisBonus,

    // Equipment bonuses
    startingWeaponBonus: boosterBonuses.startingWeaponBonus,
    startingArmorBonus: boosterBonuses.startingArmorBonus,

    // Special effects
    startsWithPotion: boosterBonuses.startsWithPotion,
    hasSecondWind: boosterBonuses.hasSecondWind,
    secondWindPercent: boosterBonuses.secondWindPercent,
    inventoryBonus: boosterBonuses.inventoryBonus,
  }
}
