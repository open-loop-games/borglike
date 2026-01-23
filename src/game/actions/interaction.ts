/**
 * Interaction Action Handlers for Borglike
 *
 * Handles feature interactions: fountains, altars, merchants, healer, spells, portals.
 */

import type { GameState, ActionResult } from '../types'
import { useFountain, useAltar, buyFromMerchant, sellToMerchant } from '../features'
import { castSpell } from '../spell-resolution'
import { returnFromTown, useHealer, isOnPortal, isInTown, enterTown } from '../town'
import { addMessage, BASE_ENERGY_COST } from './helpers'

// ============================================================================
// FEATURE INTERACTIONS
// ============================================================================

/**
 * Handle using a fountain
 */
export function handleUseFountain(game: GameState): ActionResult {
  const success = useFountain(game)
  return { success, energyCost: success ? BASE_ENERGY_COST : 0 }
}

/**
 * Handle using an altar
 */
export function handleUseAltar(game: GameState): ActionResult {
  const success = useAltar(game)
  return { success, energyCost: success ? BASE_ENERGY_COST : 0 }
}

// ============================================================================
// MERCHANT INTERACTIONS
// ============================================================================

/**
 * Handle buying from a merchant
 */
export function handleShopBuy(
  game: GameState,
  merchantIndex: number,
  itemIndex: number
): ActionResult {
  const success = buyFromMerchant(game, merchantIndex, itemIndex)
  return { success, energyCost: success ? BASE_ENERGY_COST : 0 }
}

/**
 * Handle selling to a merchant
 */
export function handleShopSell(
  game: GameState,
  merchantIndex: number,
  inventoryIndex: number
): ActionResult {
  const success = sellToMerchant(game, merchantIndex, inventoryIndex)
  return { success, energyCost: success ? BASE_ENERGY_COST : 0 }
}

// ============================================================================
// SPELL CASTING
// ============================================================================

/**
 * Handle spell casting
 */
export function handleCast(game: GameState, spellId: string, targetId?: string): ActionResult {
  const result = castSpell(game, spellId, targetId)

  if (result.message) {
    const messageType = result.success ? (result.damage ? 'combat' : 'good') : 'info'
    addMessage(game, result.message, messageType)
  }

  return {
    success: result.success,
    message: result.message,
    energyCost: result.success ? BASE_ENERGY_COST : 0,
    damage: result.damage,
    healed: result.healed,
    targets: result.targets,
    events: result.events,
  }
}

// ============================================================================
// TOWN PORTAL
// ============================================================================

/**
 * Handle returning through town portal
 *
 * Player must be standing on a portal tile to use this.
 */
export function handleReturnPortal(game: GameState): ActionResult {
  // Check if standing on portal tile
  if (!isOnPortal(game)) {
    return { success: false, message: 'You are not on a portal.', energyCost: 0 }
  }

  // Check if portal exists
  if (!game.townPortal) {
    return { success: false, message: 'No active portal.', energyCost: 0 }
  }

  // If in town, return to dungeon
  if (isInTown(game)) {
    const result = returnFromTown(game)
    if (result.success) {
      addMessage(game, 'You return to the dungeon through the portal.', 'info')
    }
    return result
  }

  // If in dungeon standing on portal, enter town
  // This case is handled by the town portal scroll in consumables.ts
  // But if player walks back onto the portal, they can use it
  enterTown(game)
  addMessage(game, 'You step through the portal to town.', 'info')
  return { success: true, energyCost: BASE_ENERGY_COST }
}

// ============================================================================
// HEALER
// ============================================================================

/**
 * Handle using the healer in town
 *
 * Player must be adjacent to healer NPC.
 */
export function handleUseHealer(game: GameState): ActionResult {
  const result = useHealer(game)
  if (result.message) {
    addMessage(game, result.message, result.success ? 'good' : 'info')
  }
  return result
}
