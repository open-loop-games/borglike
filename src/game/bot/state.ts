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
    currentDepth: 1,
    knownStairsDown: null,
    cachedFlow: null,
    cachedDanger: null,
    twitchCounter: 0,
    lastProgressTurn: 0,
    fleeCooldownUntil: 0,
    // Town tracking
    isInTown: false,
    townEntryTurn: 0,
    healerVisited: false,
    itemsSold: false,
    itemsBought: false,
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
  state.twitchCounter = 0
  state.lastProgressTurn = turn
  // Town tracking - reset when entering any level
  state.isInTown = newDepth === 0
  state.townEntryTurn = newDepth === 0 ? turn : 0
  state.healerVisited = false
  state.itemsSold = false
  state.itemsBought = false
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
