/**
 * Game data exports
 *
 * Re-exports all game data (races, classes, items, monsters, etc.)
 */

// Stat modifiers type (canonical export from races)
export type { StatModifiers } from './races'

// Races
export {
  races,
  startingRaces,
  unlockableRaces,
  prestigeRaces,
  getRaceById,
  type Race,
  type RaceAbility,
} from './races'

// Classes
export {
  classes,
  startingClasses,
  unlockableClasses,
  prestigeClasses,
  getClassById,
  calculateHitdie,
  type GameClass,
} from './classes'

// Monsters
export {
  monsters,
  COLORS,
  MONSTER_COUNTS,
  getMonstersForDepth,
  getSpawnableMonsters,
  getMonsterByName,
  getUniques,
  type MonsterTemplate,
} from './monsters'

// Items
export {
  WEAPONS,
  ARMOR,
  SHIELDS,
  HELMS,
  GLOVES,
  BOOTS,
  RINGS,
  AMULETS,
  LIGHTS,
  POTIONS,
  SCROLLS,
  ALL_EQUIPMENT,
  ALL_CONSUMABLES,
  ALL_ITEMS,
  getItemsByTier,
  getItemsByType,
  getItemsForDepth,
  type ItemTemplate,
} from './items'

// Artifacts
export {
  ARTIFACTS,
  getArtifactsForDepth,
  getArtifactsBySlot,
  getArtifactByName,
  getEarlyGameArtifacts,
  getMidGameArtifacts,
  getLateGameArtifacts,
  type ArtifactTemplate,
} from './artifacts'
