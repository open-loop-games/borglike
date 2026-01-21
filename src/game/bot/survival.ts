/**
 * Survival Logic - Barrel Export
 *
 * Re-exports all survival-related functionality from sub-modules:
 * - survival-retreat.ts: Retreat decisions, escape routes, HP monitoring
 * - survival-consumables.ts: Consumable usage (healing, buffs, utility)
 * - survival-teleport.ts: Town portal, phase door safety
 */

// ============================================================================
// RETREAT & ESCAPE
// ============================================================================

export {
  // Types
  type RetreatEvaluation,
  type EscapeRoute,
  // Retreat decisions
  shouldRetreat,
  isCriticalHP,
  needsHealing,
  // Escape routes
  findBestEscapeRoute,
  findEscapeDirection,
  // HP monitoring
  getHPStatus,
  getHitsTillDeath,
  // Class-aware retreat
  shouldClassRetreat,
} from './survival-retreat'

// ============================================================================
// TELEPORT & PHASE DOOR
// ============================================================================

export {
  // Types
  type TownPortalDecision,
  // Town portal
  shouldUseTownPortal,
  // Phase door safety
  evaluatePhaseDoorSafety,
  shouldEscapeOverHeal,
} from './survival-teleport'

// ============================================================================
// CONSUMABLES
// ============================================================================

export {
  // Survival consumables
  getSurvivalConsumableAction,
  // Pre-combat buffs
  getPreCombatBuffAction,
  // Combat buffs
  getCombatBuffAction,
  // Utility consumables
  getUtilityConsumableAction,
} from './survival-consumables'
