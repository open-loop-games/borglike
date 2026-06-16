/**
 * Meta-progression upgrades that persist between runs
 *
 * Categories:
 * - stats: Direct stat bonuses (HP, damage, etc.)
 * - meta: XP/gold/essence multipliers
 * - qol: Quality of life (turbo speed, auto-restart)
 */

/** A per-level stat component: value at level L = baseValue + perLevel*(L-1). */
export interface UpgradeEffect {
  type: 'flat' | 'percent' | 'unlock'
  stat?: string
  baseValue: number // Value at level 1
  perLevel: number // Additional value per level
  /**
   * Optional second component shown alongside the primary (e.g. Resilience's
   * +1%/lvl armor on top of its flat +2/lvl). Read by computeUpgradeBonuses so
   * the data stays the single source of truth for both the tooltip and runtime.
   */
  secondary?: {
    type: 'flat' | 'percent'
    stat?: string
    baseValue: number
    perLevel: number
  }
}

export interface UpgradeDefinition {
  id: string
  name: string
  description: string
  category: 'stats' | 'meta' | 'qol'
  maxLevel: number
  baseCost: number
  costScaling: number // Multiplier per level (e.g., 1.5 = 50% more each level)
  effect: UpgradeEffect
  /** Iconify ID (e.g. 'game-icons:health-normal'); must be registered in src/ui/icons.ts */
  icon: string
}

/** Display labels for the internal stat keys used in effects. */
const STAT_LABELS: Record<string, string> = {
  maxHp: 'max HP',
  damage: 'damage',
  armor: 'armor',
  evasion: 'evasion',
  dodge: 'dodge',
  armorPen: 'armor pen',
  speed: 'speed',
  essenceGain: 'essence',
  goldGain: 'gold',
  xpGain: 'XP',
  merchantPrices: 'merchant prices',
  bestiaryCap: 'bestiary cap',
  townShopTier: 'shop tier',
  turboSpeed: 'turbo speed',
  autoRestartDepth: 'restart depth',
  runSlots: 'run slots',
}

export function statLabel(stat: string | undefined): string {
  return stat ? (STAT_LABELS[stat] ?? stat) : ''
}

// =============================================================================
// STAT UPGRADES
// =============================================================================

const vitality: UpgradeDefinition = {
  id: 'vitality',
  name: 'Vitality',
  description: '+15 HP and +1% max HP per level',
  category: 'stats',
  maxLevel: 10,
  baseCost: 100,
  costScaling: 1.8,
  effect: {
    type: 'flat',
    stat: 'maxHp',
    baseValue: 15,
    perLevel: 10,
    secondary: { type: 'percent', stat: 'maxHp', baseValue: 1, perLevel: 1 },
  },
  icon: 'game-icons:health-normal',
}

const might: UpgradeDefinition = {
  id: 'might',
  name: 'Might',
  description: '+2% all damage per level',
  category: 'stats',
  maxLevel: 10,
  baseCost: 100,
  costScaling: 2.0,
  effect: {
    type: 'percent',
    stat: 'damage',
    baseValue: 2,
    perLevel: 2,
  },
  icon: 'game-icons:crossed-swords',
}

const resilience: UpgradeDefinition = {
  id: 'resilience',
  name: 'Resilience',
  description: '+2 armor and +1% armor per level',
  category: 'stats',
  maxLevel: 10,
  baseCost: 100,
  costScaling: 1.8,
  effect: {
    type: 'flat',
    stat: 'armor',
    baseValue: 2,
    perLevel: 2,
    secondary: { type: 'percent', stat: 'armor', baseValue: 1, perLevel: 1 },
  },
  icon: 'game-icons:shield',
}

const reflexes: UpgradeDefinition = {
  id: 'reflexes',
  name: 'Reflexes',
  description: '+2 evasion and +1% dodge per level',
  category: 'stats',
  maxLevel: 10,
  baseCost: 100,
  costScaling: 1.8,
  // Primary is a flat evasion bonus (applied as a flat modifier); the dodge-
  // chance % is the secondary. Reflects how computeUpgradeBonuses consumes it.
  effect: {
    type: 'flat',
    stat: 'evasion',
    baseValue: 2,
    perLevel: 2,
    secondary: { type: 'percent', stat: 'dodge', baseValue: 1, perLevel: 1 },
  },
  icon: 'game-icons:wingfoot',
}

const precision: UpgradeDefinition = {
  id: 'precision',
  name: 'Precision',
  description: '+1% armor penetration per level',
  category: 'stats',
  maxLevel: 10,
  baseCost: 100,
  costScaling: 1.8,
  effect: {
    type: 'percent',
    stat: 'armorPen',
    baseValue: 1,
    perLevel: 1,
  },
  icon: 'game-icons:targeted',
}

const swiftness: UpgradeDefinition = {
  id: 'swiftness',
  name: 'Swiftness',
  description: '+2 speed per level',
  category: 'stats',
  maxLevel: 10,
  baseCost: 100,
  costScaling: 1.8,
  effect: {
    type: 'flat',
    stat: 'speed',
    baseValue: 2,
    perLevel: 2,
  },
  icon: 'game-icons:lightning-storm',
}

// =============================================================================
// META UPGRADES
// =============================================================================

const essenceBoost: UpgradeDefinition = {
  id: 'essence_boost',
  name: 'Essence Boost',
  description: '+10% essence from runs per level',
  category: 'meta',
  maxLevel: 10,
  baseCost: 100,
  costScaling: 1.8,
  effect: {
    type: 'percent',
    stat: 'essenceGain',
    baseValue: 10,
    perLevel: 10,
  },
  icon: 'game-icons:cut-diamond',
}

const goldDigger: UpgradeDefinition = {
  id: 'gold_digger',
  name: 'Gold Digger',
  description: '+15% gold found per level',
  category: 'meta',
  maxLevel: 5,
  baseCost: 150,
  costScaling: 2.0,
  effect: {
    type: 'percent',
    stat: 'goldGain',
    baseValue: 15,
    perLevel: 15,
  },
  icon: 'game-icons:gold-bar',
}

const fastLearner: UpgradeDefinition = {
  id: 'fast_learner',
  name: 'Fast Learner',
  description: '+5% XP gain per level',
  category: 'meta',
  maxLevel: 10,
  baseCost: 100,
  costScaling: 2.0,
  effect: {
    type: 'percent',
    stat: 'xpGain',
    baseValue: 5,
    perLevel: 5,
  },
  icon: 'game-icons:stars-stack',
}

const haggler: UpgradeDefinition = {
  id: 'haggler',
  name: 'Haggler',
  description: '5% better merchant prices per level',
  category: 'meta',
  maxLevel: 5,
  baseCost: 100,
  costScaling: 2.0,
  effect: {
    type: 'percent',
    stat: 'merchantPrices',
    baseValue: 5,
    perLevel: 5,
  },
  icon: 'game-icons:scales',
}

const bestiaryMastery: UpgradeDefinition = {
  id: 'bestiary_mastery',
  name: 'Bestiary Mastery',
  description: '+5% bestiary bonus cap per level (base 10%)',
  category: 'meta',
  maxLevel: 3,
  baseCost: 2500,
  costScaling: 5.0,
  effect: {
    type: 'percent',
    stat: 'bestiaryCap',
    baseValue: 5,
    perLevel: 5,
  },
  icon: 'game-icons:spell-book',
}

const townStock: UpgradeDefinition = {
  id: 'town_stock',
  name: 'Town Stock',
  description: 'Town shops stock higher-tier equipment',
  category: 'meta',
  maxLevel: 3,
  baseCost: 2000,
  costScaling: 3.0,
  effect: {
    type: 'flat',
    stat: 'townShopTier',
    baseValue: 1,
    perLevel: 1,
  },
  icon: 'game-icons:village',
}

// =============================================================================
// QOL UPGRADES
// =============================================================================

const turboMode: UpgradeDefinition = {
  id: 'turbo_mode',
  name: 'Turbo Mode',
  description: '+25% game speed in turbo per level',
  category: 'qol',
  maxLevel: 4,
  baseCost: 300,
  costScaling: 2.0,
  effect: {
    type: 'percent',
    stat: 'turboSpeed',
    baseValue: 25,
    perLevel: 25,
  },
  icon: 'game-icons:rocket',
}

const autoRestart: UpgradeDefinition = {
  id: 'auto_restart',
  name: 'Auto Restart',
  description: 'Auto-restart shallow deaths; +10 restart depth per level',
  category: 'qol',
  maxLevel: 4,
  baseCost: 250,
  costScaling: 2.0,
  effect: {
    type: 'flat',
    stat: 'autoRestartDepth',
    baseValue: 10,
    perLevel: 10,
  },
  icon: 'ph:arrow-counter-clockwise',
}

const runSlot2: UpgradeDefinition = {
  id: 'run_slot_2',
  name: 'Second Slot',
  description: 'Unlock second simultaneous run',
  category: 'qol',
  maxLevel: 1,
  baseCost: 1000,
  costScaling: 1,
  effect: {
    type: 'unlock',
    stat: 'runSlots',
    baseValue: 2,
    perLevel: 0,
  },
  icon: 'ph:number-circle-two',
}

const runSlot3: UpgradeDefinition = {
  id: 'run_slot_3',
  name: 'Third Slot',
  description: 'Unlock third simultaneous run',
  category: 'qol',
  maxLevel: 1,
  baseCost: 5000,
  costScaling: 1,
  effect: {
    type: 'unlock',
    stat: 'runSlots',
    baseValue: 3,
    perLevel: 0,
  },
  icon: 'ph:number-circle-three',
}

const runSlot4: UpgradeDefinition = {
  id: 'run_slot_4',
  name: 'Fourth Slot',
  description: 'Unlock fourth simultaneous run',
  category: 'qol',
  maxLevel: 1,
  baseCost: 25000,
  costScaling: 1,
  effect: {
    type: 'unlock',
    stat: 'runSlots',
    baseValue: 4,
    perLevel: 0,
  },
  icon: 'ph:number-circle-four',
}

// =============================================================================
// EXPORTS
// =============================================================================

export const upgrades: UpgradeDefinition[] = [
  // Stats
  vitality,
  might,
  resilience,
  reflexes,
  precision,
  swiftness,
  // Meta
  essenceBoost,
  goldDigger,
  fastLearner,
  haggler,
  bestiaryMastery,
  townStock,
  // QoL
  autoRestart,
  turboMode,
  runSlot2,
  runSlot3,
  runSlot4,
]

export const upgradesByCategory = {
  stats: upgrades.filter((u) => u.category === 'stats'),
  meta: upgrades.filter((u) => u.category === 'meta'),
  qol: upgrades.filter((u) => u.category === 'qol'),
}

export function getUpgradeById(id: string): UpgradeDefinition | undefined {
  return upgrades.find((u) => u.id === id)
}

export function calculateUpgradeCost(upgrade: UpgradeDefinition, currentLevel: number): number {
  if (currentLevel >= upgrade.maxLevel) return Infinity
  return Math.floor(upgrade.baseCost * Math.pow(upgrade.costScaling, currentLevel))
}

export function calculateUpgradeEffect(upgrade: UpgradeDefinition, level: number): number {
  if (level <= 0) return 0
  return upgrade.effect.baseValue + upgrade.effect.perLevel * (level - 1)
}
