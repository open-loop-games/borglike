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
export function addMessage(game: GameState, text: string, type: GameMessage['type']): void {
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
  // Formulas scale with level to stay relevant in late game
  if (effect.includes('Light')) return 10 + level // L50: 60 HP
  if (effect.includes('Serious')) return 25 + level * 2 // L50: 125 HP
  if (effect.includes('Critical')) return 60 + level * 4 // L50: 260 HP (buffed from 50+3*L)
  if (effect.includes('Healing')) return 100 + level * 5 // L50: 350 HP
  if (effect.includes('*Healing*')) return Math.floor(level * 10)
  return 20 + level // Default
}
