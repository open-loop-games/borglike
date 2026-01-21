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
import type { BoosterBonuses } from './booster-effects'
import type { FountainTemplate, AltarTemplate } from './data/features'
import type { MerchantTemplate } from './data/merchants'
import type { GoldPileTemplate } from './data/gold'
import type { TrapTemplate } from './data/traps'
import type { VaultPlacement, GeneratorType } from './dungeon/types'
import type { BestiaryEntry } from '@/types/progression'

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
  BoosterBonuses,
  FountainTemplate,
  AltarTemplate,
  MerchantTemplate,
  GoldPileTemplate,
  TrapTemplate,
  BestiaryEntry,
  GeneratorType,
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

// ============================================================================
// POINT & DISTANCE UTILITIES
// ============================================================================

/** Convert point to string key for Map/Set usage */
export function posKey(p: Point): string {
  return `${p.x},${p.y}`
}

/** Chebyshev distance (king's move / diagonal distance) */
export function chebyshevDistance(a: Point, b: Point): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
}

/** Manhattan distance (taxicab / 4-directional distance) */
export function manhattanDistance(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

/** Check if two points are the same */
export function isSamePoint(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y
}

/** Check if two points are adjacent (including diagonals, excluding same point) */
export function isAdjacent(a: Point, b: Point): boolean {
  const dx = Math.abs(a.x - b.x)
  const dy = Math.abs(a.y - b.y)
  return dx <= 1 && dy <= 1 && (dx + dy) > 0
}

// ============================================================================
// DIRECTIONS
// ============================================================================

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
export type TileType =
  | 'wall'
  | 'floor'
  | 'door_closed'
  | 'door_open'
  | 'stairs_down'
  | 'stairs_up'
  | 'fountain'
  | 'fountain_empty'
  | 'altar'
  | 'portal'           // Active town portal
  | 'dungeon_entrance' // Town stairs to depth 1
  | 'healer'           // Healer NPC tile

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
  /** Generator type used to create this level (labyrinth, cavern, classic) */
  generatorType?: GeneratorType
  /** Vault placement data (if a vault was placed on this level) */
  vault?: VaultPlacement | null
}

// ============================================================================
// RESISTANCES
// ============================================================================

/** Types of damage/effects that can be resisted */
export type ResistanceType =
  | 'POISON'
  | 'FIRE'
  | 'COLD'
  | 'ACID'
  | 'LIGHTNING'
  | 'LIGHT'
  | 'DARK'
  | 'DRAIN'

/**
 * Resistance values for different damage types
 * 0 = none, 50 = half damage, 100 = immune, -50/-100 = vulnerable
 */
export type Resistances = Partial<Record<ResistanceType, number>>

// ============================================================================
// STATUS EFFECTS
// ============================================================================

/** Types of temporary status effects */
export type StatusEffectType = 'speed' | 'heroism' | 'berserk' | 'blessing' | 'protection' | 'stun'

/** A temporary status effect on the character */
export interface StatusEffect {
  type: StatusEffectType
  turnsRemaining: number
  value: number
}

/** A temporary resistance granted by consumables */
export interface TempResistance {
  type: ResistanceType
  turnsRemaining: number
  value: number
}

/** Poison damage over time status */
export interface PoisonStatus {
  damagePerTurn: number
  turnsRemaining: number
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
  rangedDamage: number // DEX-based bow damage
  rangedAccuracy: number // DEX-based hit bonus for ranged
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
  /** Shop price (set when item is from merchant) */
  shopPrice?: number
  /** For gold items: the gold pile template */
  goldTemplate?: GoldPileTemplate
  /** For gold items: pre-rolled gold value */
  goldValue?: number
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

  // Resistances (from race + equipment)
  resistances: Resistances

  // Status effects
  statusEffects: StatusEffect[]
  tempResistances: TempResistance[]
  poison: PoisonStatus | null

  // Inventory
  equipment: Equipment
  inventory: Item[]
  gold: number

  // Position
  position: Point
  depth: number

  // State
  isDead: boolean

  // Upgrade bonuses (stored for recalculation on level up/equip)
  upgradeBonuses?: UpgradeBonuses

  // Spells
  knownSpells: string[]
  spellCooldowns: Record<string, number> // spellId -> turn when spell becomes available
}

// ============================================================================
// MONSTERS
// ============================================================================

/** A debuff effect on a monster */
export interface MonsterDebuff {
  type: 'slow' | 'weaken' | 'blind'
  turnsRemaining: number
  value: number
}

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
  /** Active debuffs on this monster */
  debuffs: MonsterDebuff[]
}

/** Check if monster is a boss or unique (dangerous target) */
export function isBossOrUnique(m: Monster): boolean {
  return m.template.flags?.includes('UNIQUE') || m.template.flags?.includes('BOSS') || false
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
  monsterKills: Record<string, number> // monster name → kill count
}

/** Active fountain state */
export interface FountainState {
  template: FountainTemplate
  position: Point
  usesRemaining: number
}

/** Active altar state */
export interface AltarState {
  template: AltarTemplate
  position: Point
}

/** Active merchant state */
export interface MerchantState {
  template: MerchantTemplate
  position: Point
  /** Items for sale */
  inventory: Item[]
  /** Gold the merchant has for buying items */
  gold: number
}

/** Active trap state */
export interface TrapState {
  template: TrapTemplate
  position: Point
  /** Has the trap been revealed to the player? */
  revealed: boolean
  /** Has the trap been triggered? */
  triggered: boolean
  /** Turn when trap will rearm (null = won't rearm or already ready) */
  rearmTurn: number | null
}

/** Cached entity state for a dungeon level (monsters, items, features) */
export interface LevelEntityState {
  monsters: Monster[]
  items: GroundItem[]
  fountains: Map<string, FountainState>
  altars: Map<string, AltarState>
  merchants: MerchantState[]
  traps: Map<string, TrapState>
}

/** Town portal state - tracks active portal between town and dungeon */
export interface TownPortalState {
  /** Position in dungeon where portal was opened */
  dungeonPosition: Point
  /** Dungeon depth where portal was opened */
  dungeonDepth: number
  /** Turn when portal was created */
  createdTurn: number
  /** Turns remaining before portal expires */
  turnsRemaining: number
  /** Position of portal in town */
  townPosition: Point
}

/** Healer NPC state in town */
export interface HealerState {
  /** Position of healer in town */
  position: Point
  /** Gold cost per HP healed */
  costPerHP: number
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
  /** Cache of entity state per level (monsters, items, features) */
  entityCache: Map<number, LevelEntityState>

  // Entities on current level
  monsters: Monster[]
  items: GroundItem[] // Items on the ground

  // Features on current level (keyed by "x,y")
  fountains: Map<string, FountainState>
  altars: Map<string, AltarState>
  merchants: MerchantState[]
  traps: Map<string, TrapState>

  // Town portal system
  townPortal: TownPortalState | null
  healer: HealerState | null

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

  // Per-run booster bonuses
  boosterBonuses?: BoosterBonuses

  // Second Wind tracking (auto-heal once when critical)
  usedSecondWind?: boolean

  // Bestiary data (injected from progression store for knowledge bonuses)
  bestiary?: Record<string, BestiaryEntry>
}

/** A message in the game log */
export interface GameMessage {
  turn: number
  text: string
  type: 'info' | 'combat' | 'item' | 'danger' | 'good'
}

// ============================================================================
// SPELLS
// ============================================================================

/** Spell schools - determine which stat affects power */
export type SpellSchool = 'arcane' | 'divine' | 'nature' | 'shadow'

/** Types of spell effects */
export type SpellEffectType =
  | 'damage'
  | 'aoe_damage'
  | 'heal'
  | 'buff'
  | 'debuff'
  | 'lifedrain'
  | 'teleport'

/** Damage types for spells */
export type SpellDamageType = 'fire' | 'cold' | 'lightning' | 'holy' | 'dark' | 'nature' | 'arcane'

// ============================================================================
// ACTIONS
// ============================================================================

/** Actions the player/bot can take */
export type GameAction =
  | { type: 'move'; direction: Direction }
  | { type: 'attack'; targetId: string }
  | { type: 'ranged_attack'; targetId: string }
  | { type: 'pickup'; itemId: string }
  | { type: 'drop'; itemId: string }
  | { type: 'equip'; itemId: string }
  | { type: 'unequip'; slot: EquipSlot }
  | { type: 'use'; itemId: string }
  | { type: 'descend' }
  | { type: 'ascend' }
  | { type: 'wait' }
  // Feature interactions
  | { type: 'use_fountain' }
  | { type: 'use_altar' }
  // Merchant interactions
  | { type: 'shop_buy'; merchantIndex: number; itemIndex: number }
  | { type: 'shop_sell'; merchantIndex: number; inventoryIndex: number }
  // Spell casting
  | { type: 'cast'; spellId: string; targetId?: string }
  // Town portal interactions
  | { type: 'use_return_portal' }
  | { type: 'use_healer' }

/** Result of processing an action (unified type for all game actions including spells) */
export interface ActionResult {
  success: boolean
  message?: string
  /** Energy cost of the action (for speed system). Required for action handlers, optional for internal functions. */
  energyCost?: number
  /** Damage dealt (for combat/spell actions) */
  damage?: number
  /** HP healed (for healing actions) */
  healed?: number
  /** Monster IDs affected (for targeted/AOE actions) */
  targets?: string[]
  /** Events generated by this action (for UI updates) */
  events?: GameEvent[]
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
  boosterBonuses?: BoosterBonuses // Per-run booster bonuses
  bestiary?: Record<string, BestiaryEntry> // Lifetime kill data for knowledge bonuses
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
