/**
 * Prestige star-tree definitions (studio/borglike#3).
 *
 * Stars are the spent prestige currency: minted by `prestige()` from the
 * cube-root of lifetime essence, spent on permanent nodes that survive every
 * reset. Kept deliberately small — a never-resetting economy never
 * self-corrects, so each node must stay sane at any star count.
 */

export interface StarUpgradeDefinition {
  id: string
  name: string
  description: string
  maxLevel: number
  /** Star price per level (index = level being bought, 0-based). */
  costs: number[]
}

const stellarFlow: StarUpgradeDefinition = {
  id: 'stellar_flow',
  name: 'Stellar Flow',
  description: '+15% essence from runs per level',
  maxLevel: 5,
  costs: [1, 1, 2, 2, 3],
}

const deepPockets: StarUpgradeDefinition = {
  id: 'deep_pockets',
  name: 'Deep Pockets',
  description: 'Prestige resets essence to a floor instead of zero',
  maxLevel: 3,
  costs: [1, 2, 3],
}

/** Essence floor granted by Deep Pockets at each owned level. */
export const DEEP_POCKETS_FLOORS = [0, 500, 1500, 3000]

const etchedKnowledge: StarUpgradeDefinition = {
  id: 'etched_knowledge',
  name: 'Etched Knowledge',
  description: 'Keep Essence Boost levels through prestige resets',
  maxLevel: 1,
  costs: [2],
}

export const STAR_UPGRADES: StarUpgradeDefinition[] = [stellarFlow, deepPockets, etchedKnowledge]

export function getStarUpgradeById(id: string): StarUpgradeDefinition | undefined {
  return STAR_UPGRADES.find((u) => u.id === id)
}

/** Star price of the next level, or null when maxed/unknown. */
export function starUpgradeCost(id: string, currentLevel: number): number | null {
  const def = getStarUpgradeById(id)
  if (!def || currentLevel >= def.maxLevel) return null
  return def.costs[currentLevel] ?? null
}

/** +15% essence per Stellar Flow level, as a multiplier. */
export function stellarFlowMultiplier(level: number): number {
  return 1 + 0.15 * Math.max(0, level)
}
