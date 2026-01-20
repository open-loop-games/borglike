/**
 * Bot AI Type Definitions
 *
 * All bot-specific types in one place for easy importing.
 */

import type { Point, GameState, Monster, GroundItem, BotPersonality } from '../types'

// ============================================================================
// GOAL TYPES
// ============================================================================

/** Bot goal types */
export type GoalType = 'KILL' | 'TAKE' | 'DESCEND' | 'FLEE' | 'EXPLORE' | 'RECOVER' | 'WAIT'

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

  // Stuck detection (Phase 3 prep)
  twitchCounter: number
  lastProgressTurn: number

  // Flee cooldown (turn until which fleeing is disabled)
  fleeCooldownUntil: number
}

// ============================================================================
// CONTEXT & PERSONALITY
// ============================================================================

/** Bot decision context (built each tick) */
export interface BotContext {
  game: GameState
  personality: BotPersonality
  config: PersonalityConfig

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
