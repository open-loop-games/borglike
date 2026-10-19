/**
 * Ascension star tree (studio/borglike#8).
 *
 * Stars are minted one per Morgoth kill and spent on permanent nodes. Nothing
 * resets. Classic 1→50 is tuned to a low single-digit win rate, so no node may
 * change a classic run: power nodes apply only inside the Rift.
 *
 * Node *effects* resolve here rather than in the store, mirroring how
 * `UpgradeDefinition.effect` and `BoosterDefinition.effect` keep their families'
 * behaviour beside their data. The resolvers take the whole level map so no
 * caller has to name a node id — a typo'd literal in the store would otherwise
 * fail silently to a no-op.
 */

import type { DungeonMode } from '@/types/progression'

export type StarUpgradeId = 'rift_gate' | 'rift_vigor' | 'rift_fury' | 'rift_ward'

/** Owned level per star node; absent keys read as 0. */
export type StarLevels = Readonly<Record<string, number>>

export interface StarUpgradeDefinition {
  id: StarUpgradeId
  name: string
  description: string
  maxLevel: number
  /** Star price per level (index = level being bought, 0-based). */
  costs: number[]
  /** Node that must be owned before this one can be bought. */
  requires?: StarUpgradeId
  /** Essence upgrade whose level this node extends past its cap, in Rift runs only. */
  riftExtends?: string
}

const riftGate: StarUpgradeDefinition = {
  id: 'rift_gate',
  name: 'Rift Gate',
  description: 'Open the Rift: an endless dungeon of packs, rares and tier bosses, chosen per slot',
  maxLevel: 1,
  costs: [1],
}

const riftVigor: StarUpgradeDefinition = {
  id: 'rift_vigor',
  name: 'Rift Vigor',
  description: '+1 Vitality level past its cap per level, in the Rift only',
  maxLevel: 5,
  costs: [1, 1, 2, 2, 3],
  requires: 'rift_gate',
  riftExtends: 'vitality',
}

const riftFury: StarUpgradeDefinition = {
  id: 'rift_fury',
  name: 'Rift Fury',
  description: '+1 Might level past its cap per level, in the Rift only',
  maxLevel: 5,
  costs: [1, 1, 2, 2, 3],
  requires: 'rift_gate',
  riftExtends: 'might',
}

const riftWard: StarUpgradeDefinition = {
  id: 'rift_ward',
  name: 'Rift Ward',
  description: '+1 Resilience level past its cap per level, in the Rift only',
  maxLevel: 5,
  costs: [1, 1, 2, 2, 3],
  requires: 'rift_gate',
  riftExtends: 'resilience',
}

export const STAR_UPGRADES: StarUpgradeDefinition[] = [riftGate, riftVigor, riftFury, riftWard]

function starUpgradeById(id: string): StarUpgradeDefinition | undefined {
  return STAR_UPGRADES.find((u) => u.id === id)
}

function levelOf(levels: StarLevels, id: StarUpgradeId): number {
  return levels[id] || 0
}

/** Star price of the next level, or null when maxed, locked or unknown. */
export function starUpgradeCost(id: string, levels: StarLevels): number | null {
  const def = starUpgradeById(id)
  if (!def) return null
  if (def.requires && levelOf(levels, def.requires) === 0) return null
  const currentLevel = levels[id] || 0
  if (currentLevel >= def.maxLevel) return null
  return def.costs[currentLevel] ?? null
}

/** Whether a node's prerequisite is owned. */
export function isStarUpgradeUnlocked(id: string, levels: StarLevels): boolean {
  const def = starUpgradeById(id)
  return !!def && (!def.requires || levelOf(levels, def.requires) > 0)
}

/** Stars spent across every owned node level. */
export function starsSpent(levels: StarLevels): number {
  let spent = 0
  for (const def of STAR_UPGRADES) {
    const level = Math.min(levelOf(levels, def.id), def.maxLevel)
    for (let l = 0; l < level; l++) spent += def.costs[l] ?? 0
  }
  return spent
}

/** Whether Rift Gate is owned, so slots may choose the Rift. */
export function hasRiftAccess(levels: StarLevels): boolean {
  return levelOf(levels, 'rift_gate') > 0
}

/** The dungeon a slot actually runs: a Rift choice without Rift Gate runs classic. */
export function effectiveDungeonMode(
  chosen: DungeonMode | undefined,
  levels: StarLevels
): DungeonMode {
  return chosen === 'rift' && hasRiftAccess(levels) ? 'rift' : 'classic'
}

/**
 * Essence-upgrade levels a run uses. Rift runs add the power nodes' levels on
 * top of the owned levels, past each upgrade's cap; classic runs get the owned
 * levels unchanged.
 */
export function runUpgradeLevels(
  upgradeLevels: Readonly<Record<string, number>>,
  starLevels: StarLevels,
  mode: DungeonMode
): Record<string, number> {
  const levels = { ...upgradeLevels }
  if (mode !== 'rift') return levels
  for (const def of STAR_UPGRADES) {
    if (!def.riftExtends) continue
    levels[def.riftExtends] = (levels[def.riftExtends] || 0) + levelOf(starLevels, def.id)
  }
  return levels
}
