/**
 * Prestige star-tree definitions (studio/borglike#3).
 *
 * Stars are the spent prestige currency: minted by `prestige()` from the
 * cube-root of lifetime essence, spent on permanent nodes that survive every
 * reset. Kept deliberately small — a never-resetting economy never
 * self-corrects, so each node must stay sane at any star count.
 *
 * Node *effects* resolve here rather than in the store, mirroring how
 * `UpgradeDefinition.effect` and `BoosterDefinition.effect` keep their families'
 * behaviour beside their data. The resolvers take the whole level map so no
 * caller has to name a node id — a typo'd literal in the store would otherwise
 * fail silently to a no-op.
 */

export type StarUpgradeId = 'stellar_flow' | 'deep_pockets' | 'etched_knowledge'

/** Owned level per star node; absent keys read as 0. */
export type StarLevels = Readonly<Record<string, number>>

export interface StarUpgradeDefinition {
  id: StarUpgradeId
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

const etchedKnowledge: StarUpgradeDefinition = {
  id: 'etched_knowledge',
  name: 'Etched Knowledge',
  description: 'Keep Essence Boost levels through prestige resets',
  maxLevel: 1,
  costs: [2],
}

export const STAR_UPGRADES: StarUpgradeDefinition[] = [stellarFlow, deepPockets, etchedKnowledge]

function starUpgradeById(id: string): StarUpgradeDefinition | undefined {
  return STAR_UPGRADES.find((u) => u.id === id)
}

function levelOf(levels: StarLevels, id: StarUpgradeId): number {
  return levels[id] || 0
}

/** Star price of the next level, or null when maxed/unknown. */
export function starUpgradeCost(id: string, currentLevel: number): number | null {
  const def = starUpgradeById(id)
  if (!def || currentLevel >= def.maxLevel) return null
  return def.costs[currentLevel] ?? null
}

/** Run-essence multiplier granted by Stellar Flow: +15% per owned level. */
export function starEssenceMultiplier(levels: StarLevels): number {
  return 1 + 0.15 * levelOf(levels, 'stellar_flow')
}

/** Essence floor Deep Pockets leaves behind at each owned level (index = level - 1). */
const DEEP_POCKETS_FLOORS = [500, 1500, 3000]

/** Essence a prestige reset floors at, rather than zero. 0 without Deep Pockets. */
export function starEssenceFloor(levels: StarLevels): number {
  return DEEP_POCKETS_FLOORS[levelOf(levels, 'deep_pockets') - 1] ?? 0
}

/** Upgrade ids whose levels survive the prestige wipe (Etched Knowledge). */
export function starKeptUpgradeIds(levels: StarLevels): string[] {
  return levelOf(levels, 'etched_knowledge') > 0 ? ['essence_boost'] : []
}
