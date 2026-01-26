/**
 * Action Handler Helpers for Borglike
 *
 * Shared utilities used by action handlers.
 */

import type { GameState, GameMessage } from '../types'
import type { ItemTemplate } from '../data/items'

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
 * Get heal amount from potion template
 * Uses structured healBase + healPerLevel * level formula
 */
export function getHealAmount(template: ItemTemplate, level: number): number {
  return (template.healBase ?? 0) + (template.healPerLevel ?? 0) * level
}
