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
  createRandomPotion,
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
  handleUseFountain,
  handleUseAltar,
  handleShopBuy,
  handleShopSell,
  handleCast,
  processMonsterTurns,
} from './game-loop'

// Features
export {
  useFountain,
  useAltar,
  buyFromMerchant,
  sellToMerchant,
  findAdjacentMerchant,
  isOnFountain,
  isOnAltar,
  getFountainAt,
  getAltarAt,
  awardMonsterGold,
  createGoldPile,
  pickupGold,
  initializeFountain,
  initializeAltar,
  initializeMerchant,
  // Trap functions
  initializeTrap,
  checkTrapDetection,
  triggerTrap,
  getRevealedTrapAt,
  getTrapAt,
} from './features'

// Bot AI
export {
  buildBotContext,
  runBotTick,
  evaluateDanger,
  getBotStatus,
  createBotState,
  getPersonalityConfig,
  BASE_CONFIGS,
} from './bot-ai'

// Bot AI Types
export type {
  BotState,
  BotGoal,
  PersonalityConfig,
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

// Upgrade Effects
export {
  computeUpgradeBonuses,
  applyDamageBonus,
  applyGoldBonus,
  mergeWithBoosterBonuses,
} from './upgrade-effects'
export type { CombinedBonuses } from './upgrade-effects'

// Booster Effects
export { computeBoosterBonuses, DEFAULT_BOOSTER_BONUSES } from './booster-effects'
export type { BoosterBonuses } from './booster-effects'

// Booster Data
export {
  boosters,
  boostersByCategory,
  getBoosterById,
  canUnlockBooster,
  getBoostersDependingOn,
} from './data/boosters'
export type { BoosterDefinition, BoosterCategory, BoosterEffect } from './data/boosters'

// Spell Resolution
export {
  castSpell,
  canCast,
  getKnownSpells,
  knowsSpell,
  isOnCooldown,
  getCooldownRemaining,
  getAvailableSpells,
  calculateSpellPower,
  selectAOETargets,
  findTarget,
  getNearestVisibleMonster,
  findTeleportDestination,
  type SpellCastResult,
} from './spell-resolution'
