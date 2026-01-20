/**
 * Depth-based generation profiles
 *
 * Controls how dungeon generation scales with depth.
 */

import type { DepthProfile, GeneratorType } from './types'

/** Depth tier thresholds */
const SHALLOW_MAX = 10
const MID_MAX = 25
const DEEP_MAX = 40
// Abyss is 41-50

/** Profile for shallow depths (1-10) */
const SHALLOW_PROFILE: DepthProfile = {
  generatorWeights: { classic: 0.92, cavern: 0.06, labyrinth: 0.02 },
  roomCount: [4, 8],
  roomSize: [3, 7],
  corridorLength: [2, 6],
  dugPercentage: 0.25,
  doorChance: 0.1,
  vaultChance: 0,
}

/** Profile for mid depths (11-25) */
const MID_PROFILE: DepthProfile = {
  generatorWeights: { classic: 0.70, cavern: 0.20, labyrinth: 0.10 },
  roomCount: [5, 10],
  roomSize: [4, 9],
  corridorLength: [3, 8],
  dugPercentage: 0.30,
  doorChance: 0.25,
  vaultChance: 0.08,
}

/** Profile for deep depths (26-40) */
const DEEP_PROFILE: DepthProfile = {
  generatorWeights: { classic: 0.55, cavern: 0.30, labyrinth: 0.15 },
  roomCount: [6, 12],
  roomSize: [5, 11],
  corridorLength: [4, 10],
  dugPercentage: 0.35,
  doorChance: 0.40,
  vaultChance: 0.18,
}

/** Profile for abyss depths (41-50) */
const ABYSS_PROFILE: DepthProfile = {
  generatorWeights: { classic: 0.45, cavern: 0.35, labyrinth: 0.20 },
  roomCount: [7, 14],
  roomSize: [5, 13],
  corridorLength: [4, 12],
  dugPercentage: 0.38,
  doorChance: 0.50,
  vaultChance: 0.28,
}

/**
 * Get the generation profile for a given depth
 */
export function getDepthProfile(depth: number): DepthProfile {
  if (depth <= SHALLOW_MAX) {
    return SHALLOW_PROFILE
  } else if (depth <= MID_MAX) {
    return MID_PROFILE
  } else if (depth <= DEEP_MAX) {
    return DEEP_PROFILE
  } else {
    return ABYSS_PROFILE
  }
}

/**
 * Select a generator type based on depth profile weights
 */
export function selectGenerator(depth: number): GeneratorType {
  const profile = getDepthProfile(depth)
  const roll = Math.random()

  let cumulative = 0
  cumulative += profile.generatorWeights.classic
  if (roll < cumulative) return 'classic'

  cumulative += profile.generatorWeights.cavern
  if (roll < cumulative) return 'cavern'

  return 'labyrinth'
}

/**
 * Interpolate a value within a range based on depth
 * Useful for gradual scaling within a tier
 */
export function interpolateByDepth(
  depth: number,
  minDepth: number,
  maxDepth: number,
  minValue: number,
  maxValue: number
): number {
  const t = Math.max(0, Math.min(1, (depth - minDepth) / (maxDepth - minDepth)))
  return minValue + t * (maxValue - minValue)
}
