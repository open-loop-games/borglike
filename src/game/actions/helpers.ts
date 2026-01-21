/**
 * Action Handler Helpers for Borglike
 *
 * Shared utilities used by action handlers.
 */

import type { GameState, GameMessage } from '../types'

// ============================================================================
// CONSTANTS
// ============================================================================

/** Base energy cost for actions (100 = 1 turn) */
export const BASE_ENERGY_COST = 100

// ============================================================================
// MESSAGE HELPERS
// ============================================================================

/**
 * Add a message to the game log
 */
export function addMessage(
  game: GameState,
  text: string,
  type: GameMessage['type']
): void {
  game.messages.push({
    turn: game.turn,
    text,
    type,
  })

  // Keep only last 100 messages
  if (game.messages.length > 100) {
    game.messages.shift()
  }
}

// ============================================================================
// HEALING HELPERS
// ============================================================================

/**
 * Get heal amount from potion effect description
 */
export function getHealAmount(effect: string, level: number): number {
  // Parse effect string for heal amounts
  if (effect.includes('Light')) return 10 + level
  if (effect.includes('Serious')) return 25 + level * 2
  if (effect.includes('Critical')) return 50 + level * 3
  if (effect.includes('Healing')) return 100 + level * 5
  if (effect.includes('*Healing*')) return Math.floor(level * 10)
  return 20 + level // Default
}
