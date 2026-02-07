/**
 * UI Event types for communication between game engine and stores
 */

/**
 * Events emitted by the game runner for UI state updates.
 * These are simplified versions of game events for the runs store.
 */
export type AngbandEvent =
  | { type: 'depth'; level: number }
  | { type: 'hp'; current: number; max: number }
  | { type: 'mp'; current: number; max: number }
  | { type: 'gold'; total: number }
  | { type: 'xp'; current: number }
  | { type: 'kill'; monsterId?: string; monsterName?: string }
  | { type: 'tick'; turn: number }
  | { type: 'death'; cause?: string }
  | { type: 'victory' }
  | { type: 'levelUp'; level: number }
  | { type: 'item'; action: 'pickup' | 'drop' | 'equip'; itemName: string }

/**
 * Configuration for starting a new run
 */
export interface RunConfig {
  race: string
  class: string
  personality?: 'cautious' | 'aggressive' | 'greedy' | 'speedrunner' | 'custom'
  seed?: number
}
