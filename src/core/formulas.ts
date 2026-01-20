/**
 * Formulas Module for Borglike
 *
 * Mathematical formulas for incremental game mechanics including:
 * - Cost scaling for upgrades
 * - Essence calculations (prestige currency)
 * - Prestige/reset mechanics
 * - Pacing and beat timing
 * - XP/Level progression
 *
 * Sources:
 * - /work/open-loop-incremental/docs/research/patterns/tier-1-foundation/cost-scaling-patterns.md
 * - /work/open-loop-incremental/docs/research/patterns/tier-1-foundation/prestige-systems.md
 * - /work/open-loop-incremental/docs/research/techniques/phase-2-1-core-timing-formula.md
 * - /work/borglike/docs/ANGBAND-LITE-DESIGN.md
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Cost multiplier for mobile games (5-15 min sessions).
 * Beat time doubles every ~10 levels. Very gentle progression.
 * Source: Cost Scaling Patterns - Multiplier Spectrum table
 */
export const COST_MULTIPLIER_MOBILE = 1.07

/**
 * Cost multiplier for standard PC games (30-90 min sessions).
 * Beat time doubles every ~5 levels. Industry standard (Cookie Clicker, Antimatter Dimensions).
 * Source: Cost Scaling Patterns - "1.15 is the industry-proven baseline for PC incrementals"
 */
export const COST_MULTIPLIER_STANDARD = 1.15

/**
 * Cost multiplier for hardcore games (2-8 hour sessions).
 * Beat time doubles every ~2 levels. Aggressive progression for engaged players.
 * Source: Cost Scaling Patterns - Synergism uses 1.3-1.5
 */
export const COST_MULTIPLIER_AGGRESSIVE = 1.3

/**
 * Cost multiplier for extreme difficulty/challenge modes.
 * Source: Cost Scaling Patterns - Fundamental uses 10.0 in Stage 3
 */
export const COST_MULTIPLIER_HYPER = 2.0

/**
 * Default cost multiplier for Borglike upgrades.
 * Using standard PC multiplier since this is a browser game.
 */
export const DEFAULT_COST_MULTIPLIER = COST_MULTIPLIER_STANDARD

/**
 * Target beat times for different game phases (in seconds).
 * Source: Core Timing Formula - Flow channel targets
 */
export const BEAT_TIME_TARGETS = {
  /** Early game: quick purchases to teach mechanics (arousal channel) */
  EARLY: 10,
  /** Mid game: satisfying flow state (30-120 seconds optimal per Csikszentmihalyi) */
  MID: 60,
  /** Late game: triggers prestige motivation (boredom threshold) */
  LATE: 300,
  /** Maximum acceptable beat time before prestige feels mandatory */
  PRESTIGE_TRIGGER: 900,
} as const

/**
 * Prestige compression exponents for different formula types.
 * Higher compression = more diminishing returns = longer play before prestige.
 * Source: Prestige Systems - Formula Families section
 */
export const PRESTIGE_COMPRESSION = {
  /** Linear: 1:1 ratio. Too strong, trivializes runs. Avoid. */
  LINEAR: 1.0,
  /** Square root: 4x progress = 2x currency. Moderate compression. */
  SQUARE_ROOT: 0.5,
  /** Cube root: 8x progress = 2x currency. Cookie Clicker standard. */
  CUBE_ROOT: 1 / 3,
  /** Logarithmic: 10x progress = +1 currency. Strong compression for multi-tier. */
  LOGARITHMIC: 'log',
} as const

/**
 * XP curve exponent for character leveling.
 * Standard RPG progression: XP needed increases faster than linearly.
 * Source: Polynomial Scaling section - "n^1.818" from Check Back Mod
 */
export const XP_CURVE_EXPONENT = 1.5

/**
 * Base XP required for level 2.
 */
export const BASE_XP_REQUIREMENT = 100

/**
 * Maximum character level in a run.
 * Source: ANGBAND-LITE-DESIGN.md - "Expected Player Level 40+ at depth 50"
 */
export const MAX_CHARACTER_LEVEL = 50

/**
 * Dungeon depth constants from ANGBAND-LITE-DESIGN.md
 */
export const DUNGEON = {
  MAX_DEPTH: 50,
  SHALLOW_END: 10,
  MID_END: 25,
  DEEP_END: 40,
  BOSS_DEPTH: 50,
} as const

/**
 * Essence rewards from ANGBAND-LITE-DESIGN.md
 */
export const ESSENCE_REWARDS = {
  /** Base essence from death at each depth milestone */
  DEATH_DEPTH_10: 50,
  DEATH_DEPTH_25: 200,
  DEATH_DEPTH_40: 500,
  /** Victory bonus */
  VICTORY_BASE: 2000,
  /** Monster kill range: 1-10 scaling with depth */
  KILL_MIN: 1,
  KILL_MAX: 10,
} as const

// ============================================================================
// COST SCALING FORMULAS
// ============================================================================

/**
 * Calculate exponential upgrade cost.
 *
 * Formula: Cost(n) = baseCost * multiplier^n
 *
 * This is the industry standard (76% of incremental games use exponential scaling).
 * Creates natural pacing where beat times expand predictably.
 *
 * @param baseCost - Cost of first purchase (level 0)
 * @param level - Current upgrade level (0-indexed)
 * @param multiplier - Growth factor per level (default: 1.15 standard)
 * @returns Cost for the next upgrade
 *
 * @example
 * upgradeCost(100, 0)  // 100 (first purchase)
 * upgradeCost(100, 10) // 404.56 (with 1.15 multiplier)
 * upgradeCost(100, 10, 1.07) // 196.72 (mobile multiplier)
 *
 * Source: Cost Scaling Patterns - "Cost(n) = baseCost x multiplier^n"
 */
export function upgradeCost(
  baseCost: number,
  level: number,
  multiplier: number = DEFAULT_COST_MULTIPLIER
): number {
  if (level < 0) return 0
  if (multiplier <= 1.0) {
    throw new Error('Multiplier must be > 1.0 for exponential scaling')
  }
  return baseCost * Math.pow(multiplier, level)
}

/**
 * Calculate total cost to reach a target level from current level.
 *
 * Sum of geometric series: baseCost * m^current + baseCost * m^(current+1) + ... + baseCost * m^(target-1)
 * = baseCost * m^current * (m^(target-current) - 1) / (m - 1)
 *
 * @param baseCost - Cost of first purchase
 * @param currentLevel - Current upgrade level
 * @param targetLevel - Target upgrade level
 * @param multiplier - Growth factor per level
 * @returns Total cost to reach target level
 *
 * Source: Core Timing Formula - "T_total(N) = (baseCost / Production) * m * (m^N - 1) / (m - 1)"
 */
export function totalCostToLevel(
  baseCost: number,
  currentLevel: number,
  targetLevel: number,
  multiplier: number = DEFAULT_COST_MULTIPLIER
): number {
  if (targetLevel <= currentLevel) return 0
  if (multiplier <= 1.0) {
    throw new Error('Multiplier must be > 1.0')
  }

  const levels = targetLevel - currentLevel
  const startCost = upgradeCost(baseCost, currentLevel, multiplier)
  return (startCost * (Math.pow(multiplier, levels) - 1)) / (multiplier - 1)
}

/**
 * Calculate time to afford next purchase given current production rate.
 *
 * Formula: T(n) = Cost(n) / ProductionRate
 *
 * This is the fundamental pacing beat equation that determines the "heartbeat"
 * of incremental games.
 *
 * @param cost - Cost of next purchase
 * @param productionRate - Current production per second
 * @returns Time in seconds to afford the purchase
 *
 * Source: Core Timing Formula - "T(n) = Cost(n) / ProductionRate(n)"
 */
export function timeToAfford(cost: number, productionRate: number): number {
  if (productionRate <= 0) return Infinity
  return cost / productionRate
}

/**
 * Calculate how many levels until beat time doubles.
 *
 * Formula: doublingLevels = ln(2) / ln(multiplier)
 *
 * @param multiplier - Cost growth multiplier
 * @returns Number of levels for beat time to double
 *
 * @example
 * levelDoublingTime(1.15) // ~5 levels
 * levelDoublingTime(1.07) // ~10 levels
 * levelDoublingTime(2.0)  // 1 level
 *
 * Source: Core Timing Formula - Doubling Time section
 */
export function levelDoublingTime(multiplier: number): number {
  if (multiplier <= 1.0) {
    throw new Error('Multiplier must be > 1.0')
  }
  return Math.log(2) / Math.log(multiplier)
}

/**
 * Calculate beat expansion ratio: how much longer level N takes vs level 1.
 *
 * Formula: BeatExpansion(n) = m^(n-1)
 *
 * @param level - Target level
 * @param multiplier - Cost multiplier
 * @returns Ratio of beat time at level N vs level 1
 *
 * @example
 * beatExpansion(10, 1.15)  // 3.52x slower than level 1
 * beatExpansion(25, 1.15)  // 28.63x slower
 * beatExpansion(50, 1.15)  // 1083.66x slower
 *
 * Source: Core Timing Formula - Beat Expansion Analysis
 */
export function beatExpansion(level: number, multiplier: number = DEFAULT_COST_MULTIPLIER): number {
  if (level <= 1) return 1
  return Math.pow(multiplier, level - 1)
}

// ============================================================================
// ESSENCE FORMULAS (PRESTIGE CURRENCY)
// ============================================================================

/**
 * Calculate essence earned from killing a monster.
 *
 * Scales with dungeon depth to reward deeper exploration.
 * Base formula: essence = 1 + floor((depth / MAX_DEPTH) * (KILL_MAX - KILL_MIN))
 *
 * @param monsterDepth - Depth where monster was killed (1-50)
 * @param monsterXP - Optional XP value of monster (for bonus)
 * @returns Essence earned from the kill
 *
 * Source: ANGBAND-LITE-DESIGN.md - "Kill monster: 1-10 (scales with depth)"
 */
export function essenceFromKill(monsterDepth: number, monsterXP: number = 0): number {
  const clampedDepth = Math.max(1, Math.min(monsterDepth, DUNGEON.MAX_DEPTH))
  const depthRatio = clampedDepth / DUNGEON.MAX_DEPTH

  // Base essence from depth: 1 at depth 1, 10 at depth 50
  const baseEssence =
    ESSENCE_REWARDS.KILL_MIN +
    Math.floor(depthRatio * (ESSENCE_REWARDS.KILL_MAX - ESSENCE_REWARDS.KILL_MIN))

  // Small bonus for high-XP monsters (uniques, bosses)
  const xpBonus = monsterXP > 100 ? Math.floor(Math.log10(monsterXP)) : 0

  return baseEssence + xpBonus
}

/**
 * Calculate essence earned from death.
 *
 * Death rewards scale with progress made during the run.
 * Uses piecewise formula based on depth milestones.
 *
 * @param depth - Depth at death
 * @param kills - Total monster kills this run
 * @param gold - Gold collected this run
 * @returns Total essence earned from this death
 *
 * Source: ANGBAND-LITE-DESIGN.md - Death rewards table
 */
export function essenceFromDeath(depth: number, kills: number, gold: number): number {
  let baseEssence = 0

  // Depth-based milestone rewards (piecewise)
  if (depth >= DUNGEON.DEEP_END) {
    baseEssence = ESSENCE_REWARDS.DEATH_DEPTH_40
  } else if (depth >= DUNGEON.MID_END) {
    baseEssence = ESSENCE_REWARDS.DEATH_DEPTH_25
  } else if (depth >= DUNGEON.SHALLOW_END) {
    baseEssence = ESSENCE_REWARDS.DEATH_DEPTH_10
  } else {
    // Shallow death: small consolation prize
    baseEssence = Math.floor(depth * 2)
  }

  // Bonus for kills (diminishing returns with sqrt)
  const killBonus = Math.floor(Math.sqrt(kills) * 2)

  // Bonus for gold (strong diminishing returns with log)
  const goldBonus = gold > 0 ? Math.floor(Math.log10(gold + 1) * 5) : 0

  return baseEssence + killBonus + goldBonus
}

/**
 * Calculate essence earned from victory (completing depth 50).
 *
 * Victory provides a large base bonus plus scaling rewards.
 *
 * @param depth - Always 50 for victory, but passed for consistency
 * @param kills - Total monster kills this run
 * @param turnsTaken - Optional: fewer turns = bonus (speedrun reward)
 * @returns Total essence earned from victory
 *
 * Source: ANGBAND-LITE-DESIGN.md - "Win (depth 50): 2000 + bonuses"
 */
export function essenceFromVictory(_depth: number, kills: number, turnsTaken: number = 0): number {
  const baseEssence = ESSENCE_REWARDS.VICTORY_BASE

  // Kill bonus (linear scaling for victory)
  const killBonus = Math.floor(kills * 0.5)

  // Speedrun bonus: fewer turns = more essence
  // Target: ~18000 turns for "normal" win (30 min at ~10 turns/sec)
  const speedrunBonus = turnsTaken > 0 ? Math.max(0, Math.floor((18000 - turnsTaken) / 100)) : 0

  return baseEssence + killBonus + speedrunBonus
}

// ============================================================================
// PRESTIGE FORMULAS
// ============================================================================

/**
 * Calculate prestige currency earned from total essence.
 *
 * Uses cube root compression (Cookie Clicker standard):
 * - 8x essence = 2x prestige currency
 * - Creates satisfying 90% time reduction per prestige
 *
 * Formula: prestige = (totalEssence / threshold)^(1/3)
 *
 * @param totalEssence - Total essence ever earned
 * @param threshold - Essence required for first prestige point (default: 10000)
 * @returns Prestige currency (stars/prestiges)
 *
 * Source: Prestige Systems - "Cube Root Family: 16% of games"
 */
export function prestigeCurrency(totalEssence: number, threshold: number = 10000): number {
  if (totalEssence < threshold) return 0
  return Math.floor(Math.pow(totalEssence / threshold, PRESTIGE_COMPRESSION.CUBE_ROOT))
}

/**
 * Calculate essence needed for next prestige point.
 *
 * Inverse of prestigeCurrency: threshold * (targetPrestige)^3
 *
 * @param currentPrestige - Current prestige level
 * @param threshold - Essence required for first prestige
 * @returns Essence needed to reach next prestige level
 *
 * Source: Prestige Systems - Inverse formula section
 */
export function essenceForNextPrestige(currentPrestige: number, threshold: number = 10000): number {
  const targetPrestige = currentPrestige + 1
  return Math.ceil(threshold * Math.pow(targetPrestige, 3))
}

/**
 * Calculate the global multiplier from prestige level.
 *
 * Each prestige provides compounding bonuses to essence gain.
 * Based on ANGBAND-LITE-DESIGN.md prestige table.
 *
 * @param prestigeLevel - Current prestige level (0 = no prestige yet)
 * @returns Essence multiplier (1.0 = no bonus)
 *
 * Source: ANGBAND-LITE-DESIGN.md - Prestige System table
 */
export function prestigeMultiplier(prestigeLevel: number): number {
  if (prestigeLevel <= 0) return 1.0

  // Prestige 1-4 have specific values
  const baseMultipliers = [1.0, 1.5, 2.0, 3.0, 4.5]

  if (prestigeLevel < baseMultipliers.length) {
    return baseMultipliers[prestigeLevel]!
  }

  // Prestige 5+: +1.5x per level after 4
  return 4.5 + (prestigeLevel - 4) * 1.5
}

/**
 * Calculate time reduction percentage from prestige.
 *
 * Based on speedup: timeReduction = 1 - 1/multiplier
 *
 * @param prestigeLevel - Current prestige level
 * @returns Time reduction as percentage (0-1)
 *
 * Source: Cost Scaling Patterns - Prestige Interactions section
 */
export function prestigeTimeReduction(prestigeLevel: number): number {
  const multiplier = prestigeMultiplier(prestigeLevel)
  return 1 - 1 / multiplier
}

// ============================================================================
// CHARACTER PROGRESSION FORMULAS
// ============================================================================

/**
 * Calculate XP required to reach a given level.
 *
 * Uses polynomial scaling: XP(level) = baseXP * level^exponent
 * This creates a faster-than-linear but manageable curve.
 *
 * @param level - Target level (1-50)
 * @returns Total XP needed to reach that level
 *
 * @example
 * xpForLevel(2)  // 100 (base requirement)
 * xpForLevel(10) // ~3162 (with 1.5 exponent)
 * xpForLevel(50) // ~35355
 *
 * Source: Cost Scaling Patterns - Polynomial Scaling section
 */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0
  const clampedLevel = Math.min(level, MAX_CHARACTER_LEVEL)
  return Math.floor(BASE_XP_REQUIREMENT * Math.pow(clampedLevel - 1, XP_CURVE_EXPONENT))
}

/**
 * Calculate XP needed to go from current level to next level.
 *
 * @param currentLevel - Current character level
 * @returns XP needed to level up
 */
export function xpToNextLevel(currentLevel: number): number {
  if (currentLevel >= MAX_CHARACTER_LEVEL) return Infinity
  return xpForLevel(currentLevel + 1) - xpForLevel(currentLevel)
}

/**
 * Calculate XP earned from defeating a monster.
 *
 * Scales with monster depth and player level (penalty for overleveling).
 *
 * @param monsterXP - Base XP value of the monster
 * @param monsterDepth - Depth where monster spawned
 * @param playerLevel - Current player level
 * @returns Actual XP earned
 *
 * Source: Polynomial Scaling - level difference penalties are common in RPGs
 */
export function xpFromMonster(
  monsterXP: number,
  monsterDepth: number,
  playerLevel: number
): number {
  // Base XP from monster
  let xp = monsterXP

  // Depth bonus: monsters deeper than expected give more XP
  const expectedLevel = Math.ceil(monsterDepth * 0.8) // Rough depth-to-level ratio
  if (playerLevel < expectedLevel) {
    xp *= 1 + (expectedLevel - playerLevel) * 0.1 // +10% per level below expected
  }

  // Overlevel penalty: reduce XP if player is too strong for this depth
  const levelDiff = playerLevel - expectedLevel
  if (levelDiff > 0) {
    xp *= Math.max(0.1, 1 - levelDiff * 0.1) // -10% per level above, min 10%
  }

  return Math.floor(xp)
}

// ============================================================================
// PACING/TIMING FORMULAS
// ============================================================================

/**
 * Calculate optimal cost multiplier to achieve target beat time at a specific level.
 *
 * Inverse of beat expansion: m = (T_target / T_base)^(1/(n-1))
 *
 * @param baseBeatTime - Beat time at level 1 (seconds)
 * @param targetBeatTime - Desired beat time at target level (seconds)
 * @param targetLevel - Level at which to achieve target beat time
 * @returns Recommended cost multiplier
 *
 * Source: Core Timing Formula - Appendix: Formula Derivations
 */
export function optimalMultiplier(
  baseBeatTime: number,
  targetBeatTime: number,
  targetLevel: number
): number {
  if (targetLevel <= 1) return DEFAULT_COST_MULTIPLIER
  if (targetBeatTime <= baseBeatTime) return 1.01 // Minimum meaningful multiplier

  const ratio = targetBeatTime / baseBeatTime
  const exponent = 1 / (targetLevel - 1)
  return Math.pow(ratio, exponent)
}

/**
 * Classify the current beat time into a flow channel.
 *
 * Based on Csikszentmihalyi's Flow Theory:
 * - Arousal: Very fast (< 30s) - exciting but potentially overwhelming
 * - Flow: Optimal (30-120s) - engaged and satisfied
 * - Boredom: Slow (> 120s) - triggers prestige desire
 * - Frustration: Very slow (> 300s) - may cause abandonment
 *
 * @param beatTimeSeconds - Current time between purchases
 * @returns Flow channel classification
 *
 * Source: Cost Scaling Patterns - "30-120s beats hit flow channel (Csikszentmihalyi 1990)"
 */
export function classifyFlowChannel(
  beatTimeSeconds: number
): 'arousal' | 'flow' | 'boredom' | 'frustration' {
  if (beatTimeSeconds < 30) return 'arousal'
  if (beatTimeSeconds <= 120) return 'flow'
  if (beatTimeSeconds <= 300) return 'boredom'
  return 'frustration'
}

/**
 * Calculate percentage of total time spent in last K levels.
 *
 * For exponential costs, late levels dominate total time:
 * "75% of time is in last 10 levels!"
 *
 * @param totalLevels - Total levels achieved
 * @param lastKLevels - Number of late levels to measure
 * @param multiplier - Cost multiplier
 * @returns Percentage of time spent in last K levels (0-1)
 *
 * Source: Core Timing Formula - Cumulative Time Analysis
 */
export function timeInLastLevels(
  totalLevels: number,
  lastKLevels: number,
  multiplier: number = DEFAULT_COST_MULTIPLIER
): number {
  if (lastKLevels >= totalLevels) return 1.0
  if (totalLevels <= 1) return 1.0

  const totalSum = (Math.pow(multiplier, totalLevels) - 1) / (multiplier - 1)
  const earlySum = (Math.pow(multiplier, totalLevels - lastKLevels) - 1) / (multiplier - 1)
  const lateSum = totalSum - earlySum

  return lateSum / totalSum
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format large numbers for display (e.g., "1.5K", "2.3M", "4.5B").
 *
 * @param value - Number to format
 * @param decimals - Decimal places to show (default: 1)
 * @returns Formatted string
 */
export function formatNumber(value: number, decimals: number = 1): string {
  if (value < 1000) return value.toFixed(decimals === 0 ? 0 : decimals)

  const suffixes = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc']
  const tier = Math.floor(Math.log10(Math.abs(value)) / 3)
  const suffix = suffixes[Math.min(tier, suffixes.length - 1)]
  const scale = Math.pow(10, tier * 3)

  return (value / scale).toFixed(decimals) + suffix
}

/**
 * Format time duration for display (e.g., "30s", "5m 30s", "2h 15m").
 *
 * @param seconds - Duration in seconds
 * @returns Formatted string
 */
export function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)

  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
  }

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60

  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
}
