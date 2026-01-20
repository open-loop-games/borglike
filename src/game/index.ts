/**
 * Game Module Exports
 *
 * Re-exports all game systems for easy importing.
 */

// Types
export * from './types'

// Data
export * from './data/index'

// Core Systems
export {
  createCharacter,
  gainXP,
  equipItem,
  unequipItem,
  calculateStats,
  calculateCombatStats,
} from './character'
export {
  generateLevel,
  getTile,
  setTile,
  isWalkable,
  isOpaque,
  findOpenPosition,
  findOpenPositions,
  getAdjacentPositions,
  distance,
  manhattanDistance,
  computeFOV,
  findPath,
} from './dungeon'
export {
  attack,
  applyDamage,
  isCharacter,
  isMonster,
  formatAttackMessage,
  formatAttackMessageFromEntities,
  getAttackerStats,
  getDefenderStats,
} from './combat'
export {
  spawnMonster,
  spawnMonstersForLevel,
  canSeePlayer,
  wakeNearbyMonsters,
  decideAction as decideMonsterAction,
  findMoveTowardPlayer,
  findRandomMove,
  updateMonsterEnergy,
  resetMonsterEnergy,
  canMonsterAct,
} from './monster-ai'

// Items
export {
  createItem,
  createArtifact,
  createGroundItem,
  spawnItemsForLevel,
  getItemsAtPosition,
  findGroundItemById,
  removeGroundItem,
  dropItemOnGround,
  getItemDisplayName,
  getItemGlyph,
  getItemColor,
  createHealingPotions,
  createTeleportScrolls,
  createStartingEquipment,
} from './items'
// Note: GroundItem is exported from './types'

// Game Loop
export {
  createGame,
  processTurn,
  handleMove,
  handleAttack,
  handleDescend,
  handleAscend,
  handlePickup,
  handleUse,
  handleEquip,
  handleDrop,
  handleUnequip,
  handleWait,
  processMonsterTurns,
} from './game-loop'

// Bot AI
export {
  buildBotContext,
  decideAction as decideBotAction,
  runBotTick,
  evaluateDanger,
  getBotStatus,
} from './bot-ai'

// Game Runner
export {
  createGameRunner,
  calculateEssence,
  runBatchGames,
  quickRun,
  type RunnerConfig,
  type RunResult,
  type BatchResult,
} from './game-runner'
