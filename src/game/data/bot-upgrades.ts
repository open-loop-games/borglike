/**
 * Bot Training Upgrade Definitions
 *
 * Per-slot upgrades that unlock bot capabilities.
 * Costs are essence-based, paid from the global essence pool.
 */

import type { BotCapabilities } from '../../types/progression'

export type BotUpgradeId =
  | 'town'
  | 'farming'
  | 'preparedness'
  | 'sweep_1'
  | 'sweep_2'
  | 'sweep_3'
  | 'surf_1'
  | 'surf_2'
  | 'surf_3'
  | 'kiting_1'
  | 'kiting_2'
  | 'kiting_3'

export interface BotUpgradeDefinition {
  id: BotUpgradeId
  name: string
  description: string
  cost: number
  requires?: BotUpgradeId // Prerequisite upgrade
  category: 'toggle' | 'graded'
  // For graded upgrades - which field and what level it grants
  targetField?: 'sweep' | 'surf' | 'kiting'
  targetLevel?: number
}

// =============================================================================
// TOGGLE UPGRADES (ON/OFF capabilities)
// =============================================================================

const townUpgrade: BotUpgradeDefinition = {
  id: 'town',
  name: 'Town Access',
  description: 'Bot can use town portal, visit healer, and shop',
  cost: 100,
  category: 'toggle',
}

const farmingUpgrade: BotUpgradeDefinition = {
  id: 'farming',
  name: 'Resource Farming',
  description: 'Bot will farm gold/XP when under-prepared for descent',
  cost: 200,
  category: 'toggle',
}

const preparednessUpgrade: BotUpgradeDefinition = {
  id: 'preparedness',
  name: 'Depth Readiness',
  description: 'Bot checks consumable requirements before descending',
  cost: 300,
  category: 'toggle',
}

// =============================================================================
// SWEEP UPGRADES (exploration thoroughness)
// =============================================================================

const sweep1: BotUpgradeDefinition = {
  id: 'sweep_1',
  name: 'Sweep I',
  description: 'Explore 60% of floor tiles before descent',
  cost: 150,
  category: 'graded',
  targetField: 'sweep',
  targetLevel: 1,
}

const sweep2: BotUpgradeDefinition = {
  id: 'sweep_2',
  name: 'Sweep II',
  description: 'Explore 75% of floor tiles before descent',
  cost: 270,
  requires: 'sweep_1',
  category: 'graded',
  targetField: 'sweep',
  targetLevel: 2,
}

const sweep3: BotUpgradeDefinition = {
  id: 'sweep_3',
  name: 'Sweep III',
  description: 'Explore 90% of floor tiles before descent',
  cost: 486,
  requires: 'sweep_2',
  category: 'graded',
  targetField: 'sweep',
  targetLevel: 3,
}

// =============================================================================
// SURF UPGRADES (tethered stair farming)
// =============================================================================

const surf1: BotUpgradeDefinition = {
  id: 'surf_1',
  name: 'Surf I',
  description: 'Farm within 5×5 area around stairs',
  cost: 200,
  category: 'graded',
  targetField: 'surf',
  targetLevel: 1,
}

const surf2: BotUpgradeDefinition = {
  id: 'surf_2',
  name: 'Surf II',
  description: 'Farm within 9×9 area around stairs',
  cost: 360,
  requires: 'surf_1',
  category: 'graded',
  targetField: 'surf',
  targetLevel: 2,
}

const surf3: BotUpgradeDefinition = {
  id: 'surf_3',
  name: 'Surf III',
  description: 'Farm within 21×21 area around stairs',
  cost: 648,
  requires: 'surf_2',
  category: 'graded',
  targetField: 'surf',
  targetLevel: 3,
}

// =============================================================================
// KITING UPGRADES (ranged positioning)
// =============================================================================

const kiting1: BotUpgradeDefinition = {
  id: 'kiting_1',
  name: 'Kiting I',
  description: 'Basic ranged positioning (2 tile distance)',
  cost: 250,
  requires: 'sweep_1', // Prerequisite: must have sweep first
  category: 'graded',
  targetField: 'kiting',
  targetLevel: 1,
}

const kiting2: BotUpgradeDefinition = {
  id: 'kiting_2',
  name: 'Kiting II',
  description: 'Improved ranged positioning (3 tile distance)',
  cost: 500,
  requires: 'kiting_1',
  category: 'graded',
  targetField: 'kiting',
  targetLevel: 2,
}

const kiting3: BotUpgradeDefinition = {
  id: 'kiting_3',
  name: 'Kiting III',
  description: 'Optimal ranged positioning (4 tile distance)',
  cost: 1000,
  requires: 'kiting_2',
  category: 'graded',
  targetField: 'kiting',
  targetLevel: 3,
}

// =============================================================================
// EXPORTS
// =============================================================================

export const BOT_UPGRADES: BotUpgradeDefinition[] = [
  // Toggle upgrades
  townUpgrade,
  farmingUpgrade,
  preparednessUpgrade,
  // Sweep upgrades
  sweep1,
  sweep2,
  sweep3,
  // Surf upgrades
  surf1,
  surf2,
  surf3,
  // Kiting upgrades
  kiting1,
  kiting2,
  kiting3,
]

/** Toggle upgrade IDs for type narrowing */
export const TOGGLE_UPGRADE_IDS = ['town', 'farming', 'preparedness'] as const
export type ToggleUpgradeId = (typeof TOGGLE_UPGRADE_IDS)[number]

export function getBotUpgradeById(id: BotUpgradeId): BotUpgradeDefinition | undefined {
  return BOT_UPGRADES.find((u) => u.id === id)
}

/** Check if a toggle upgrade is unlocked */
function isToggleUnlocked(id: ToggleUpgradeId, capabilities: BotCapabilities): boolean {
  return capabilities[id]
}

/** Check if a graded upgrade level is unlocked */
function isGradedUnlocked(
  field: 'sweep' | 'surf' | 'kiting',
  level: number,
  capabilities: BotCapabilities
): boolean {
  return capabilities[field] >= level
}

/** Check if prerequisite is met */
function isPrerequisiteMet(upgrade: BotUpgradeDefinition, capabilities: BotCapabilities): boolean {
  if (!upgrade.requires) return true

  const prereq = getBotUpgradeById(upgrade.requires)
  if (!prereq) return false

  if (prereq.category === 'toggle') {
    return isToggleUnlocked(prereq.id as ToggleUpgradeId, capabilities)
  }

  if (prereq.targetField && prereq.targetLevel) {
    return isGradedUnlocked(prereq.targetField, prereq.targetLevel, capabilities)
  }

  return false
}

/** Check if an upgrade is already purchased */
function isAlreadyPurchased(upgrade: BotUpgradeDefinition, capabilities: BotCapabilities): boolean {
  if (upgrade.category === 'toggle') {
    return isToggleUnlocked(upgrade.id as ToggleUpgradeId, capabilities)
  }

  if (upgrade.targetField && upgrade.targetLevel) {
    return isGradedUnlocked(upgrade.targetField, upgrade.targetLevel, capabilities)
  }

  return false
}

/** Check if an upgrade can be purchased given current capabilities and essence */
export function canPurchaseBotUpgrade(
  id: BotUpgradeId,
  capabilities: BotCapabilities,
  essence: number
): boolean {
  const upgrade = getBotUpgradeById(id)
  if (!upgrade) return false

  // Check cost
  if (essence < upgrade.cost) return false

  // Check if already purchased
  if (isAlreadyPurchased(upgrade, capabilities)) return false

  // Check prerequisite
  if (!isPrerequisiteMet(upgrade, capabilities)) return false

  return true
}

/** Get the next purchasable upgrade for a graded field, or null if maxed */
export function getNextGradedUpgrade(
  field: 'sweep' | 'surf' | 'kiting',
  capabilities: BotCapabilities
): BotUpgradeDefinition | null {
  const currentLevel = capabilities[field]
  const nextLevel = currentLevel + 1

  if (nextLevel > 3) return null

  const upgradeId = `${field}_${nextLevel}` as BotUpgradeId
  return getBotUpgradeById(upgradeId) ?? null
}

/** Apply a purchased upgrade to capabilities (returns new capabilities) */
export function applyBotUpgrade(id: BotUpgradeId, capabilities: BotCapabilities): BotCapabilities {
  const upgrade = getBotUpgradeById(id)
  if (!upgrade) return capabilities

  const newCapabilities = { ...capabilities }

  if (upgrade.category === 'toggle') {
    newCapabilities[upgrade.id as ToggleUpgradeId] = true
  } else if (upgrade.targetField && upgrade.targetLevel) {
    newCapabilities[upgrade.targetField] = upgrade.targetLevel
  }

  return newCapabilities
}
