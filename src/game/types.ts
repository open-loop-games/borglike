/**
 * Unified game types for Borglike
 *
 * Core type definitions for game state, entities, and events.
 * Data types (Race, GameClass, etc.) are re-exported from data modules.
 */

// Import data types for use in this file
import type { Race, RaceAbility, StatModifiers } from './data/races'
import type { GameClass } from './data/classes'
import type { MonsterTemplate } from './data/monsters'
import type { ItemTemplate } from './data/items'
import type { ArtifactTemplate } from './data/artifacts'
import type { UpgradeBonuses } from './upgrade-effects'

// Re-export data types
export type {
  Race,
  RaceAbility,
  StatModifiers,
  GameClass,
  MonsterTemplate,
  ItemTemplate,
  ArtifactTemplate,
  UpgradeBonuses,
}

// ============================================================================
// GAME CONSTANTS
// ============================================================================

/** Maximum dungeon depth */
export const MAX_DEPTH = 50

/** Field of view radius */
export const FOV_RADIUS = 8

// ============================================================================
// COORDINATES & POSITIONING
// ============================================================================

/** 2D coordinate */
export interface Point {
  x: number
  y: number
}

/** Direction for movement (8-directional + wait) */
export type Direction = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | 'wait'

/** Direction vectors */
export const DIRECTION_VECTORS: Record<Direction, Point> = {
  n: { x: 0, y: -1 },
  s: { x: 0, y: 1 },
  e: { x: 1, y: 0 },
  w: { x: -1, y: 0 },
  ne: { x: 1, y: -1 },
  nw: { x: -1, y: -1 },
  se: { x: 1, y: 1 },
  sw: { x: -1, y: 1 },
  wait: { x: 0, y: 0 },
}

/**
 * Convert delta movement to direction
 */
export function getDirectionFromDelta(dx: number, dy: number): Direction | null {
  if (dx === 0 && dy === -1) return 'n'
  if (dx === 0 && dy === 1) return 's'
  if (dx === 1 && dy === 0) return 'e'
  if (dx === -1 && dy === 0) return 'w'
  if (dx === 1 && dy === -1) return 'ne'
  if (dx === -1 && dy === -1) return 'nw'
  if (dx === 1 && dy === 1) return 'se'
  if (dx === -1 && dy === 1) return 'sw'
  return null
}

// ============================================================================
// TILES & DUNGEON
// ============================================================================

/** Tile types in the dungeon */
export type TileType = 'wall' | 'floor' | 'door_closed' | 'door_open' | 'stairs_down' | 'stairs_up'

/** A single tile in the dungeon */
export interface Tile {
  type: TileType
  explored: boolean
  visible: boolean
}

/** Dungeon level */
export interface DungeonLevel {
  depth: number
  width: number
  height: number
  tiles: Tile[][]
  stairsUp: Point | null
  stairsDown: Point | null
}

// ============================================================================
// STATS & DERIVED VALUES
// ============================================================================

/** Core character stats */
export interface Stats {
  str: number // Strength - melee damage, carry capacity
  int: number // Intelligence - mana, magic device skill
  wis: number // Wisdom - mana regen, saving throws
  dex: number // Dexterity - accuracy, evasion, speed
  con: number // Constitution - HP, regen
}

/** Derived combat stats */
export interface CombatStats {
  maxHp: number
  maxMp: number
  armor: number // Damage reduction
  accuracy: number // Hit chance modifier
  evasion: number // Dodge chance modifier
  meleeDamage: number // Base melee damage
  speed: number // Action speed (100 = normal)
}

// ============================================================================
// ITEMS & EQUIPMENT
// ============================================================================

/** Equipment slot names */
export type EquipSlot =
  | 'weapon'
  | 'bow'
  | 'armor'
  | 'shield'
  | 'helm'
  | 'gloves'
  | 'boots'
  | 'ring1'
  | 'ring2'
  | 'amulet'
  | 'light'

/** An item instance in the game (not just template) */
export interface Item {
  id: string
  template: ItemTemplate
  /** For equipment: bonus beyond base (e.g., +2 sword) */
  enchantment: number
  /** Is this item identified? */
  identified: boolean
  /** Is this an artifact? */
  artifact: ArtifactTemplate | null
}

/** Item on the ground with position information */
export interface GroundItem extends Item {
  position: Point
}

/** Player's equipped items */
export type Equipment = Partial<Record<EquipSlot, Item>>

// ============================================================================
// CHARACTER
// ============================================================================

/** A player character */
export interface Character {
  // Identity
  id: string
  name: string
  raceId: string
  classId: string

  // Core stats (base + race + class modifiers)
  baseStats: Stats
  stats: Stats // Computed with all modifiers

  // Resources
  hp: number
  maxHp: number
  mp: number
  maxMp: number

  // Progression
  level: number
  xp: number
  xpToNextLevel: number

  // Combat derived stats
  combat: CombatStats

  // Inventory
  equipment: Equipment
  inventory: Item[]
  gold: number

  // Position
  position: Point
  depth: number

  // State
  isDead: boolean
}

// ============================================================================
// MONSTERS
// ============================================================================

/** A monster instance in the game */
export interface Monster {
  id: string
  template: MonsterTemplate
  hp: number
  maxHp: number
  position: Point
  /** Turns until monster acts (for speed system) */
  energy: number
  /** Is the monster aware of the player? */
  isAwake: boolean
  /** Has this monster been seen by the player? */
  seen: boolean
}

// ============================================================================
// GAME STATE
// ============================================================================

/** Current run statistics */
export interface RunStats {
  kills: number
  goldCollected: number
  damageDealt: number
  damageTaken: number
  itemsFound: number
  turnsPlayed: number
  deepestDepth: number
  startTime: number
  endTime: number | null
}

/** Complete game state for a single run */
export interface GameState {
  // Run identity
  runId: string
  seed: number // RNG seed for reproducibility

  // Player
  character: Character

  // Dungeon
  currentLevel: DungeonLevel
  /** Cache of generated levels (for returning to previous depths) */
  levelCache: Map<number, DungeonLevel>

  // Entities on current level
  monsters: Monster[]
  items: GroundItem[] // Items on the ground

  // Game state
  turn: number
  isRunning: boolean
  isPaused: boolean
  isVictory: boolean

  // Statistics
  stats: RunStats

  // Message log (recent messages)
  messages: GameMessage[]

  // Meta-progression bonuses (from upgrades)
  upgradeBonuses?: UpgradeBonuses
}

/** A message in the game log */
export interface GameMessage {
  turn: number
  text: string
  type: 'info' | 'combat' | 'item' | 'danger' | 'good'
}

// ============================================================================
// ACTIONS
// ============================================================================

/** Actions the player/bot can take */
export type GameAction =
  | { type: 'move'; direction: Direction }
  | { type: 'attack'; targetId: string }
  | { type: 'pickup'; itemId: string }
  | { type: 'drop'; itemId: string }
  | { type: 'equip'; itemId: string }
  | { type: 'unequip'; slot: EquipSlot }
  | { type: 'use'; itemId: string }
  | { type: 'descend' }
  | { type: 'ascend' }
  | { type: 'wait' }

/** Result of processing an action */
export interface ActionResult {
  success: boolean
  message?: string
  /** Energy cost of the action (for speed system) */
  energyCost: number
}

// ============================================================================
// EVENTS (for UI updates)
// ============================================================================

/** Events emitted by the game for UI updates */
export type GameEvent =
  | { type: 'turn'; turn: number }
  | { type: 'move'; entityId: string; from: Point; to: Point }
  | { type: 'attack'; attackerId: string; defenderId: string; damage: number; killed: boolean }
  | { type: 'levelUp'; level: number }
  | { type: 'itemPickup'; item: Item }
  | { type: 'itemDrop'; item: Item }
  | { type: 'depthChange'; depth: number }
  | { type: 'message'; message: GameMessage }
  | { type: 'death'; character: Character }
  | { type: 'victory' }
  | { type: 'statChange'; stat: string; oldValue: number; newValue: number }

/** Event listener type */
export type GameEventListener = (event: GameEvent) => void

// ============================================================================
// BOT TYPES
// ============================================================================

/** Bot personality affecting decision making */
export type BotPersonality =
  | 'cautious' // Retreats early, uses items freely
  | 'aggressive' // Fights to low HP, hoards items
  | 'greedy' // Prioritizes gold/items over safety
  | 'speedrunner' // Beelines for stairs

/** Bot decision context */
export interface BotContext {
  game: GameState
  personality: BotPersonality
  visibleMonsters: Monster[]
  visibleItems: GroundItem[]
  knownStairs: Point | null
  unexploredTiles: Point[]
}

// ============================================================================
// RUN CONFIGURATION
// ============================================================================

/** Configuration for starting a new run */
export interface RunConfig {
  raceId: string
  classId: string
  seed?: number // Optional seed for reproducibility
  botPersonality?: BotPersonality
  upgradeBonuses?: UpgradeBonuses // Meta-progression bonuses
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/** Deep partial type for nested objects */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

/** Make specific keys required */
export type RequireKeys<T, K extends keyof T> = T & Required<Pick<T, K>>
