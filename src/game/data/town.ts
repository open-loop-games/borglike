/**
 * Town Data and Layout
 *
 * Defines the fixed town layout and positions of NPCs.
 * The town is a safe zone with healer, merchant, and dungeon entrance.
 */

import type { Point } from '../types'

// ============================================================================
// TOWN LAYOUT
// ============================================================================

/**
 * Fixed ASCII town layout (~25x15)
 *
 * Legend:
 * # = Wall
 * . = Floor
 * H = Healer position
 * M = Merchant position
 * < = Dungeon entrance (stairs to depth 1)
 * @ = Player spawn / portal spawn area
 */
export const TOWN_LAYOUT = `
#########################
#.......................#
#..H.................M..#
#.......................#
#...........<...........#
#.......................#
#..........@............#
#.......................#
#########################
`.trim()

// ============================================================================
// TOWN DIMENSIONS
// ============================================================================

export const TOWN_WIDTH = 25
export const TOWN_HEIGHT = 9

// ============================================================================
// NPC AND FEATURE POSITIONS
// ============================================================================

/** Healer NPC position (H in layout) */
export const HEALER_POSITION: Point = { x: 3, y: 2 }

/** Merchant NPC position (M in layout) */
export const MERCHANT_POSITION: Point = { x: 21, y: 2 }

/** Dungeon entrance position (< in layout) */
export const DUNGEON_ENTRANCE_POSITION: Point = { x: 12, y: 4 }

/** Player/portal spawn position (@ in layout) */
export const PORTAL_SPAWN_POSITION: Point = { x: 12, y: 6 }

// ============================================================================
// HEALER COSTS
// ============================================================================

/** Gold cost per HP healed (cheaper than potions) */
export const HEALER_COST_PER_HP = 0.25

// ============================================================================
// PORTAL CONSTANTS
// ============================================================================

/** Number of turns a town portal lasts */
export const PORTAL_DURATION = 1000
