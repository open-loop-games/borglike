/**
 * Bot State Management
 *
 * Functions for creating and updating BotState.
 */

import type { Point } from '../types'
import type { BotState, BotGoal } from './types'
import { STEP_HISTORY_LENGTH } from './types'

/**
 * Create a fresh bot state for a new run
 */
export function createBotState(): BotState {
  return {
    recentPositions: [],
    currentGoal: null,
    goalTarget: null,
    levelEnterTurn: 0,
    turnsOnLevel: 0,
    currentDepth: 0,  // Start at 0 so first dungeon entry (depth 1) triggers level change
    knownStairsDown: null,
    knownStairsUp: null,
    cachedFlow: null,
    cachedDanger: null,
    cachedSafetyFlow: null,
    twitchCounter: 0,
    lastProgressTurn: 0,
    fleeCooldownUntil: 0,
    // Town tracking
    isInTown: false,
    townEntryTurn: 0,
    healerVisited: false,
    // Multi-shop tracking
    shopsVisitedForSelling: new Set(),
    shopsVisitedForBuying: new Set(),
    // Corridor exploration
    corridorFollowingMode: false,
    corridorFacing: null,
    // Exploration blacklist
    blacklistedTargets: new Map(),
    // Farming loop state
    farmingMode: false,
    farmBlockedDepth: 0,
    farmGoldTarget: 0,
    farmStartTurn: 0,
    // Tethered exploration
    tetheredOrigin: null,
    tetheredRadius: 0,
    tetheredFlipCount: 0,
    lastFlipTurn: 0,
    seenThisVisit: new Set(),
    // Sweep exploration (casters)
    sweepMode: false,
    sweepDirection: null,
    sweepStartTurn: 0,
    // Unique hunt level flip
    huntingUniqueBlocker: null,
    uniqueHuntFlipDepth: null,
    // HP tracking
    previousHp: 0,
    hpHistory: [],
    hpRate: 0,
    // Performance caches
    cachedExplorationFlow: null,
    lastExploredCount: 0,
  }
}

/**
 * Reset state when entering a new level
 */
export function resetLevelState(state: BotState, newDepth: number, turn: number): void {
  state.recentPositions = []
  state.currentGoal = null
  state.goalTarget = null
  state.levelEnterTurn = turn
  state.turnsOnLevel = 0
  state.currentDepth = newDepth
  state.knownStairsDown = null
  state.cachedFlow = null
  state.cachedDanger = null
  state.cachedSafetyFlow = null
  state.twitchCounter = 0
  state.lastProgressTurn = turn
  // Town tracking - reset when entering any level
  state.isInTown = newDepth === 0
  state.townEntryTurn = newDepth === 0 ? turn : 0
  state.healerVisited = false
  // Multi-shop tracking - reset on town entry
  state.shopsVisitedForSelling.clear()
  state.shopsVisitedForBuying.clear()
  // Corridor exploration - reset on level change
  state.corridorFollowingMode = false
  state.corridorFacing = null
  // Exploration blacklist - clear on level change
  state.blacklistedTargets.clear()
  // Tethered exploration - reset seen tiles for this visit
  state.seenThisVisit.clear()
  // Performance caches - clear on level change
  state.cachedExplorationFlow = null
  state.lastExploredCount = 0
  // Sweep exploration - reset direction (will be re-initialized based on entry point)
  // Keep sweepMode active across levels (part of multi-level pattern)
  state.sweepDirection = null
}

/**
 * Record a position in step history (for anti-oscillation)
 */
export function recordPosition(state: BotState, pos: Point): void {
  state.recentPositions.push({ x: pos.x, y: pos.y })

  // Keep only last N positions
  if (state.recentPositions.length > STEP_HISTORY_LENGTH) {
    state.recentPositions.shift()
  }
}

/**
 * Set the current goal
 */
export function setGoal(state: BotState, goal: BotGoal): void {
  // Only invalidate flow if goal target changed
  const oldTarget = state.goalTarget
  const newTarget = goal.target

  const targetChanged =
    !oldTarget || !newTarget || oldTarget.x !== newTarget.x || oldTarget.y !== newTarget.y

  state.currentGoal = goal
  state.goalTarget = goal.target

  // Invalidate cached flow when goal changes
  if (targetChanged) {
    state.cachedFlow = null
  }
}

/**
 * Clear the current goal
 */
export function clearGoal(state: BotState): void {
  state.currentGoal = null
  state.goalTarget = null
  state.cachedFlow = null
}

/** Duration (in turns) to blacklist unreachable targets */
const BLACKLIST_DURATION = 100

/** Radius to blacklist around an unreachable target (region-based) */
const BLACKLIST_RADIUS = 3

/**
 * Add a target to the exploration blacklist (unreachable)
 */
export function blacklistTarget(state: BotState, target: Point, currentTurn: number): void {
  const key = `${target.x},${target.y}`
  state.blacklistedTargets.set(key, currentTurn + BLACKLIST_DURATION)
}

/**
 * Blacklist a region around an unreachable target
 * This prevents the bot from trying adjacent tiles that are also likely unreachable
 */
export function blacklistRegion(state: BotState, center: Point, currentTurn: number): void {
  const expiry = currentTurn + BLACKLIST_DURATION
  for (let dy = -BLACKLIST_RADIUS; dy <= BLACKLIST_RADIUS; dy++) {
    for (let dx = -BLACKLIST_RADIUS; dx <= BLACKLIST_RADIUS; dx++) {
      // Use Chebyshev distance for the region
      if (Math.max(Math.abs(dx), Math.abs(dy)) <= BLACKLIST_RADIUS) {
        const key = `${center.x + dx},${center.y + dy}`
        state.blacklistedTargets.set(key, expiry)
      }
    }
  }
}

/**
 * Check if a target is blacklisted
 */
export function isTargetBlacklisted(state: BotState, target: Point, currentTurn: number): boolean {
  const key = `${target.x},${target.y}`
  const expiry = state.blacklistedTargets.get(key)
  if (expiry === undefined) return false
  if (currentTurn >= expiry) {
    // Expired - remove and return false
    state.blacklistedTargets.delete(key)
    return false
  }
  return true
}

/**
 * Clean up expired blacklist entries
 */
export function cleanupBlacklist(state: BotState, currentTurn: number): void {
  for (const [key, expiry] of state.blacklistedTargets) {
    if (currentTurn >= expiry) {
      state.blacklistedTargets.delete(key)
    }
  }
}

/**
 * Record progress (for stuck detection)
 */
export function recordProgress(state: BotState, turn: number): void {
  state.twitchCounter = 0
  state.lastProgressTurn = turn
}

/**
 * Increment turnsOnLevel counter
 */
export function incrementTurn(state: BotState): void {
  state.turnsOnLevel++
}

/**
 * Increment twitch counter (called when no progress made)
 */
export function incrementTwitch(state: BotState): void {
  state.twitchCounter++
}

/**
 * Check if position is in recent history
 */
export function isRecentlyVisited(state: BotState, pos: Point): boolean {
  return state.recentPositions.some((p) => p.x === pos.x && p.y === pos.y)
}

/**
 * Count how many times position appears in recent history
 */
export function getVisitCount(state: BotState, pos: Point): number {
  return state.recentPositions.filter((p) => p.x === pos.x && p.y === pos.y).length
}

/**
 * Get recency-weighted visit penalty
 * More recent visits get higher penalties
 */
export function getRecencyPenalty(state: BotState, pos: Point): number {
  let penalty = 0
  const history = state.recentPositions

  for (let i = history.length - 1; i >= 0; i--) {
    const p = history[i]
    if (!p) continue
    if (p.x === pos.x && p.y === pos.y) {
      // More recent = higher penalty (index from end)
      // Last position (i = length-1) gets highest penalty
      const recency = history.length - i
      penalty += Math.max(50 - recency * 2, 10)
    }
  }

  return penalty
}
