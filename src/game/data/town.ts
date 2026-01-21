/**
 * Town Data and Layout
 *
 * Defines the fixed Angband-style town layout with numbered shop buildings.
 * The town is a safe zone with healer, 5 specialized shops, and dungeon entrance.
 */

import type { Point } from '../types'

// ============================================================================
// TOWN LAYOUT
// ============================================================================

/**
 * Fixed ASCII town layout (40x9) - Angband style with numbered buildings
 *
 * Legend:
 * # = Wall
 * , = Cobblestone floor (walkable, visual variety)
 * 1-5 = Shop keeper positions (General, Armory, Weapons, Alchemy, Magic)
 * H = Healer position
 * < = Dungeon entrance (stairs to depth 1)
 * @ = Player spawn / portal spawn area
 * ~ = Well (decorative, walkable)
 */
export const TOWN_LAYOUT = `
########################################
#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#
#,,1,,,,2,,,,3,,,,4,,,,5,,,,H,,,,,,,~,,#
#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#
#,,,,,,,,,,,,,<,,,,,,,,@,,,,,,,,,,,,,,#
#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#
########################################
`.trim()

// ============================================================================
// TOWN DIMENSIONS
// ============================================================================

export const TOWN_WIDTH = 40
export const TOWN_HEIGHT = 7

// ============================================================================
// SHOP CONFIGURATION
// ============================================================================

/** Town shop IDs in order (1-5) */
export const TOWN_SHOP_IDS = [
  'town_general',
  'town_armory',
  'town_weapons',
  'town_alchemy',
  'town_magic',
] as const

export type TownShopId = typeof TOWN_SHOP_IDS[number]

/** Shop positions indexed by shop ID */
export const TOWN_SHOP_POSITIONS: Record<TownShopId, Point> = {
  town_general: { x: 3, y: 2 },
  town_armory: { x: 8, y: 2 },
  town_weapons: { x: 13, y: 2 },
  town_alchemy: { x: 18, y: 2 },
  town_magic: { x: 23, y: 2 },
}

// ============================================================================
// NPC AND FEATURE POSITIONS
// ============================================================================

/** Healer NPC position (H in layout) */
export const HEALER_POSITION: Point = { x: 28, y: 2 }

/** Dungeon entrance position (< in layout) */
export const DUNGEON_ENTRANCE_POSITION: Point = { x: 14, y: 4 }

/** Player/portal spawn position (@ in layout) */
export const PORTAL_SPAWN_POSITION: Point = { x: 21, y: 4 }

/** Well decoration position (~ in layout) */
export const WELL_POSITION: Point = { x: 36, y: 2 }

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
