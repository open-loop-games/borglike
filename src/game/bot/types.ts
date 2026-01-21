/**
 * Bot AI Type Definitions
 *
 * All bot-specific types in one place for easy importing.
 */

import type { Point, GameState, Monster, GroundItem, BotPersonality, Direction } from '../types'
import type { ClassBehaviorProfile } from './class-profiles'

// ============================================================================
// GOAL TYPES
// ============================================================================

/** Bot goal types */
export type GoalType =
  | 'KILL'
  | 'TAKE'
  | 'DESCEND'
  | 'FLEE'
  | 'EXPLORE'
  | 'RECOVER'
  | 'WAIT'
  | 'KITE'
  // Town-related goals (order: sell → heal → buy)
  | 'SELL_TO_MERCHANT' // Sell loot first to get gold
  | 'VISIT_HEALER'     // Heal with gold from selling
  | 'BUY_FROM_MERCHANT' // Buy consumables after healing
  | 'RETURN_PORTAL'    // Return through portal
  | 'EXIT_TOWN'        // Use dungeon entrance (fallback)

/** A bot's current goal */
export interface BotGoal {
  type: GoalType
  target: Point | null // Where we're going (null for WAIT/RECOVER)
  targetId: string | null // Monster/item ID if applicable
  reason: string // For debugging
  startTurn: number // When goal was set
}

// ============================================================================
// FLOW TYPES
// ============================================================================

/** Cost map from reverse-BFS */
export type FlowMap = Map<string, number>

/** Flow computation result */
export interface FlowResult {
  goal: Point
  costs: FlowMap
  computedAt: number // Turn when computed
}

/** Danger map: "x,y" -> danger score */
export type DangerMap = Map<string, number>

/** Cached danger computation */
export interface DangerResult {
  dangers: DangerMap
  maxDanger: number
  computedAt: number // Turn when computed
}

/** Result of safety flow computation (inverted Dijkstra) */
export interface SafetyFlowResult {
  /** Target position to flee toward (null if surrounded) */
  target: Point | null
  /** The computed safety values (for debugging) */
  safetyMap: Map<string, number>
  /** Turn when computed */
  computedAt: number
}

// ============================================================================
// DANGER TIER TYPES (Angband-inspired 4-tier system)
// ============================================================================

/** Four-tier danger classification */
export type DangerTier = 'SAFE' | 'CAUTION' | 'DANGER' | 'CRITICAL'

/** Phase door safety evaluation result */
export interface PhaseDoorSafety {
  /** Is it safe enough to use phase door? */
  isSafe: boolean
  /** Ratio of safe landing zones (0-1) */
  safeRatio: number
  /** Average danger at potential landing spots */
  avgDanger: number
}

// ============================================================================
// BOT STATE
// ============================================================================

/** Persistent bot state for a single run */
export interface BotState {
  // Step history (anti-oscillation) - last 25 positions
  recentPositions: Point[]

  // Goal tracking
  currentGoal: BotGoal | null
  goalTarget: Point | null // Required by game-runner.ts

  // Level tracking
  levelEnterTurn: number
  turnsOnLevel: number
  currentDepth: number

  // Knowledge cache
  knownStairsDown: Point | null

  // Cached flow (invalidated on goal change)
  cachedFlow: FlowResult | null

  // Cached danger (recomputed each turn monsters change)
  cachedDanger: DangerResult | null

  // Cached safety flow for flee behavior (inverted Dijkstra)
  cachedSafetyFlow: SafetyFlowResult | null

  // Stuck detection (Phase 3 prep)
  twitchCounter: number
  lastProgressTurn: number

  // Flee cooldown (turn until which fleeing is disabled)
  fleeCooldownUntil: number

  // Town tracking
  isInTown: boolean
  townEntryTurn: number
  healerVisited: boolean

  // Multi-shop tracking (per-shop visited state)
  shopsVisitedForSelling: Set<string>  // Shop IDs where we sold items
  shopsVisitedForBuying: Set<string>   // Shop IDs where we bought items

  // Labyrinth/corridor exploration mode
  /** Whether we're actively following a corridor (for labyrinth exploration) */
  corridorFollowingMode: boolean
  /** Direction we're facing while corridor-following (for consistent movement) */
  corridorFacing: Direction | null

  // Exploration blacklist (unreachable targets)
  /** Targets that couldn't be reached - blacklisted until turn expires */
  blacklistedTargets: Map<string, number> // "x,y" -> expiry turn
}

// ============================================================================
// CONTEXT & PERSONALITY
// ============================================================================

/** Bot decision context (built each tick) */
export interface BotContext {
  game: GameState
  personality: BotPersonality
  config: PersonalityConfig

  // Class-aware fields
  classId: string
  classProfile: ClassBehaviorProfile
  effectiveConfig: PersonalityConfig // personality + class modifiers

  // Derived data
  visibleMonsters: Monster[]
  visibleItems: GroundItem[]
  knownStairs: Point | null
  unexploredTiles: Point[]

  // Current state reference
  botState: BotState
}

/** Personality configuration parameters (0-100 scale) */
export interface PersonalityConfig {
  aggression: number // How readily to engage (vs flee)
  greed: number // Detour distance for items
  caution: number // HP threshold for retreat (as %)
  exploration: number // How much to explore before descending
  patience: number // Turns before forcing descent
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum cost value (unreachable) */
export const MAX_FLOW_COST = 255

/** Step history length for anti-oscillation */
export const STEP_HISTORY_LENGTH = 25

/** Cardinal directions for preference ordering */
export const CARDINAL_DIRECTIONS: readonly string[] = ['n', 's', 'e', 'w']

/** All 8 directions */
export const ALL_DIRECTIONS: readonly string[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']
