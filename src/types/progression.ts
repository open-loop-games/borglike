/**
 * Meta-progression types
 */

export interface Currency {
  essence: number // Primary currency from runs
  artifacts: number // Rare drops, used for prestige unlocks
}

export interface UnlockState {
  races: Set<string>
  classes: Set<string>
  runSlots: number // 1-4
  upgrades: Set<string>
}

export interface Upgrade {
  id: string
  name: string
  description: string
  category: UpgradeCategory
  maxLevel: number
  currentLevel: number
  baseCost: number
  costScaling: number // Multiplier per level
  effect: UpgradeEffect
}

export type UpgradeCategory =
  | 'stats' // Direct stat bonuses
  | 'borg' // AI behavior modifications
  | 'meta' // XP/gold multipliers
  | 'qol' // Quality of life (turbo speed, auto-restart)

export interface UpgradeEffect {
  type: 'flat' | 'percent' | 'unlock'
  stat?: string
  value: number
}

export interface RunStats {
  id: string
  startTime: number
  endTime?: number
  race: string
  class: string
  maxDepth: number
  kills: number
  goldEarned: number
  xpEarned: number
  deathCause?: string
  essenceEarned: number
}

export interface GlobalStats {
  totalRuns: number
  totalDeaths: number
  totalKills: number
  totalGold: number
  totalEssence: number
  maxDepthEver: number
  fastestDepth10?: number // Turns to reach depth 10
  longestRun?: number // Most turns survived
}
