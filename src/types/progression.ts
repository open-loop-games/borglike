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
  boosters: Set<string> // Unlocked booster IDs
}

/** Loadout for a run - selected boosters (max 2) */
export interface RunLoadout {
  boosters: [string | null, string | null] // Max 2 active boosters
}

/** Per-slot configuration - remembers last used settings */
export interface SlotConfig {
  race: string
  class: string
  personality: 'cautious' | 'aggressive' | 'greedy' | 'speedrunner'
  boosters: [string | null, string | null]
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

/** Equipment snapshot for run history display */
export interface EquipmentSnapshot {
  slot: string // EquipSlot name
  name: string // Item or artifact name
  enchantment: number // +1, +2, etc.
  isArtifact: boolean
}

/** Bestiary entry tracking kills per monster */
export interface BestiaryEntry {
  kills: number
  firstKillTime: number
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
  // Extended fields for run history
  equipment?: EquipmentSnapshot[]
  inventory?: string[] // Item names at death
  turns?: number // Total turns played
  personality?: string // Bot personality used
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

/** Achievement tracking state */
export interface AchievementState {
  unlocked: Set<string> // Completed achievement IDs
  progress: Record<string, number> // Cumulative progress tracking
  newUnlocks: Set<string> // Recently unlocked (for notification dot)
}
