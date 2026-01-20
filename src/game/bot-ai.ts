/**
 * Bot AI for Borglike Auto-Player
 *
 * This file is a compatibility wrapper that re-exports from the new modular bot system.
 * All logic has been moved to src/game/bot/ directory.
 */

// Re-export everything from the new modular system
export {
  runBotTick,
  createBotState,
  resetLevelState,
  getPersonalityConfig,
  BASE_CONFIGS,
  buildBotContext,
  getBotStatus,
  evaluateDanger,
} from './bot'

// Type exports
export type {
  BotState,
  BotContext,
  BotGoal,
  PersonalityConfig,
} from './bot'

// Note: The default runBotTick export now accepts optional upgrades and state parameters.
// Existing code calling runBotTick(game, personality) will continue to work.
