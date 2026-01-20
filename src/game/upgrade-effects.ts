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
