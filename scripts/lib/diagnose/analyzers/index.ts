/**
 * Analyzer Index
 *
 * Re-exports all analyzers and provides factory functions.
 */

// Core analyzers
export { StuckAnalyzer, createStuckAnalyzer } from './stuck'
export type { StuckAnalyzerConfig } from './stuck'

export { MovementAnalyzer, createMovementAnalyzer } from './movement'
export type { MovementAnalyzerConfig } from './movement'

export { PathingAnalyzer, createPathingAnalyzer } from './pathing'
export type { PathingAnalyzerConfig } from './pathing'

export { ExplorationAnalyzer, createExplorationAnalyzer } from './exploration'
export type { ExplorationAnalyzerConfig } from './exploration'

export { CombatAnalyzer, createCombatAnalyzer } from './combat'
export type { CombatAnalyzerConfig } from './combat'

// New analyzers
export { MapVisualizer, createMapVisualizer, formatMapSnapshot, formatFullMapSnapshot } from './map'
export type { MapVisualizerConfig, MapSnapshot, FormatMapOptions } from './map'

export { GoalAnalyzer, createGoalAnalyzer } from './goal'
export type { GoalAnalyzerConfig } from './goal'

export { JitterAnalyzer, createJitterAnalyzer } from './jitter'
export type { JitterAnalyzerConfig } from './jitter'

export { GoalDistanceAnalyzer, createGoalDistanceAnalyzer } from './goal-distance'
export type { GoalDistanceAnalyzerConfig } from './goal-distance'

export { OscillationAnalyzer, createOscillationAnalyzer } from './oscillation'
export type { OscillationAnalyzerConfig } from './oscillation'

export { StatsAnalyzer, createStatsAnalyzer } from './stats'

// Personality comparison (standalone utility)
export { comparePersonalities, formatPersonalityComparison } from './personality'
export type { PersonalityCompareConfig, PersonalityMetrics, PersonalityCompareResult } from './personality'

import type { Analyzer } from '../types'
import { createStuckAnalyzer } from './stuck'
import { createMovementAnalyzer } from './movement'
import { createPathingAnalyzer } from './pathing'
import { createExplorationAnalyzer } from './exploration'
import { createCombatAnalyzer } from './combat'
import { createMapVisualizer } from './map'
import { createGoalAnalyzer } from './goal'
import { createJitterAnalyzer } from './jitter'
import { createGoalDistanceAnalyzer } from './goal-distance'
import { createOscillationAnalyzer } from './oscillation'
import { createStatsAnalyzer } from './stats'

/** All available analyzer names */
export type AnalyzerName =
  | 'stuck'
  | 'movement'
  | 'pathing'
  | 'exploration'
  | 'combat'
  | 'map'
  | 'goal'
  | 'jitter'
  | 'goal-distance'
  | 'oscillation'
  | 'stats'

/** Create all standard analyzers */
export function createAllAnalyzers(): Analyzer[] {
  return [
    createStuckAnalyzer(),
    createMovementAnalyzer(),
    createPathingAnalyzer(),
    createExplorationAnalyzer(),
    createCombatAnalyzer(),
    createGoalAnalyzer(),
    createJitterAnalyzer(),
    createGoalDistanceAnalyzer(),
    createOscillationAnalyzer(),
    createStatsAnalyzer(),
    // Note: MapVisualizer not included by default (produces large output)
  ]
}

export interface MapAnalyzerOptions {
  /** Capture both explored and full map in snapshots */
  captureBothMaps?: boolean
  /** Show full map by default (all tiles revealed) */
  showFullMap?: boolean
}

/** Create all analyzers including map visualizer */
export function createAllAnalyzersWithMap(options: MapAnalyzerOptions = {}): Analyzer[] {
  return [
    ...createAllAnalyzers(),
    createMapVisualizer({
      captureBothMaps: options.captureBothMaps ?? false,
      showFullMap: options.showFullMap ?? false,
    }),
  ]
}

/** Create a subset of analyzers by name */
export function createAnalyzers(names: AnalyzerName[]): Analyzer[] {
  const factories: Record<AnalyzerName, () => Analyzer> = {
    stuck: createStuckAnalyzer,
    movement: createMovementAnalyzer,
    pathing: createPathingAnalyzer,
    exploration: createExplorationAnalyzer,
    combat: createCombatAnalyzer,
    map: createMapVisualizer,
    goal: createGoalAnalyzer,
    jitter: createJitterAnalyzer,
    'goal-distance': createGoalDistanceAnalyzer,
    oscillation: createOscillationAnalyzer,
    stats: createStatsAnalyzer,
  }

  return names.map((name) => factories[name]())
}
