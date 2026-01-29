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

/** Bot capability levels - unlocked through per-slot training */
export interface BotCapabilities {
  // ON/OFF flags (unlocked or not)
  town: boolean // Can use town portal, visit healer/shops
  farming: boolean // Can initiate farming loops when under-prepared
  preparedness: boolean // Checks depth readiness before descent

  // Graded levels (0-3)
  sweep: number // 0=disabled, 1-3=exploration thoroughness
  surf: number // 0=disabled, 1-3=HP thresholds for stair surfing
  kiting: number // 0=disabled, 1-3=engage distance for ranged classes
}

/** User toggles for ON/OFF capabilities (can disable even when unlocked) */
export interface BotToggles {
  town: boolean
  farming: boolean
  preparedness: boolean
}

/** Default capabilities - face-rush mode (all disabled) */
export const DEFAULT_BOT_CAPABILITIES: BotCapabilities = {
  town: false,
  farming: false,
  preparedness: false,
  sweep: 0,
  surf: 0,
  kiting: 0,
}

/** Full capabilities - for migration of existing saves */
export const FULL_BOT_CAPABILITIES: BotCapabilities = {
  town: true,
  farming: true,
  preparedness: true,
  sweep: 3,
  surf: 3,
  kiting: 3,
}

/** Default toggles - all ON when unlocked */
export const DEFAULT_BOT_TOGGLES: BotToggles = {
  town: true,
  farming: true,
  preparedness: true,
}

/** Per-slot configuration - remembers last used settings */
export interface SlotConfig {
  race: string
  class: string
  personality: 'cautious' | 'aggressive' | 'greedy' | 'speedrunner'
  boosters: [string | null, string | null]
  // Per-slot bot training
  capabilities: BotCapabilities
  toggles: BotToggles
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

/** Bestiary entry tracking kills and deaths per monster */
export interface BestiaryEntry {
  kills: number
  firstKillTime: number
  deaths: number // How many times this monster has killed the player
  firstDeathTime?: number
}

/** Item armory entry tracking item discovery */
export interface ArmoryEntry {
  firstFoundTime: number
  firstFoundDepth: number
  isArtifact: boolean
}

/** Snapshot of the monster that killed the player */
export interface KillerMonsterSnapshot {
  name: string
  level: number // Monster's effective depth level
  hp: number // Monster's max HP
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
  seed?: number // RNG seed for reproducibility
  // Combat stats
  level?: number // Character level at death
  damageDealt?: number
  damageTaken?: number
  // Economy stats
  goldSpent?: number
  itemsBought?: number
  itemsSold?: number
  // Ability usage
  spellsCast?: number
  abilitiesUsed?: number
  // Death details
  killerMonster?: KillerMonsterSnapshot
  deathDepth?: number // Depth where death occurred (may differ from maxDepth)
  // Loadout
  boosters?: string[] // Booster names used this run
}

export interface GlobalStats {
  totalRuns: number
  totalDeaths: number
  totalKills: number
  totalGold: number
  totalEssence: number
  totalFloorsVisited: number
  maxDepthEver: number
  fastestDepth10?: number // Turns to reach depth 10
  longestRun?: number // Most turns survived
  // Prestige unlock tracking
  victoriesPerRace?: Record<string, number> // race name → win count
  victoriesPerClass?: Record<string, number> // class name → win count
}

/** Context passed to prestige unlock condition predicates */
export interface UnlockContext {
  globalStats: GlobalStats
  bestiary: Record<string, BestiaryEntry>
}

/** Achievement tracking state */
export interface AchievementState {
  unlocked: Set<string> // Completed achievement IDs
  collected: Set<string> // Achievements where essence has been claimed
  progress: Record<string, number> // Cumulative progress tracking
  newUnlocks: Set<string> // Recently unlocked (for notification dot)
}
