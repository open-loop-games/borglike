/**
 * Diagnostic Toolkit
 *
 * A modular framework for diagnosing bot behavior issues.
 *
 * Usage:
 *   import { runDiagnosis, createAllAnalyzers, formatResult } from './lib/diagnose'
 *
 *   const result = runDiagnosis({
 *     seed: 12345,
 *     analyzers: createAllAnalyzers(),
 *   })
 *   console.log(formatResult(result))
 */

// Core runner
export { runDiagnosis, runBatchDiagnosis, runBatchDiagnosisParallel, runDeepDiagnosis } from './runner'
export type { TurnLogEntry, ParallelBatchConfig } from './runner'

// Types
export type {
  Analyzer,
  AnalyzerResult,
  DiagnosticIssue,
  DiagnoseConfig,
  DiagnoseResult,
  BatchConfig,
  BatchResult,
  TurnContext,
  PostTurnContext,
  EndReason,
  MovementPattern,
  TimestampedPosition,
} from './types'

// Analyzers
export {
  // Factory functions
  createAllAnalyzers,
  createAllAnalyzersWithMap,
  createAnalyzers,
  // Core analyzers
  StuckAnalyzer,
  createStuckAnalyzer,
  MovementAnalyzer,
  createMovementAnalyzer,
  PathingAnalyzer,
  createPathingAnalyzer,
  ExplorationAnalyzer,
  createExplorationAnalyzer,
  CombatAnalyzer,
  createCombatAnalyzer,
  // New analyzers
  MapVisualizer,
  createMapVisualizer,
  formatMapSnapshot,
  formatFullMapSnapshot,
  GoalAnalyzer,
  createGoalAnalyzer,
  JitterAnalyzer,
  createJitterAnalyzer,
  // Personality comparison
  comparePersonalities,
  formatPersonalityComparison,
} from './analyzers'

export type {
  AnalyzerName,
  MapAnalyzerOptions,
  StuckAnalyzerConfig,
  MovementAnalyzerConfig,
  PathingAnalyzerConfig,
  ExplorationAnalyzerConfig,
  CombatAnalyzerConfig,
  MapVisualizerConfig,
  MapSnapshot,
  FormatMapOptions,
  GoalAnalyzerConfig,
  JitterAnalyzerConfig,
  PersonalityCompareConfig,
  PersonalityMetrics,
  PersonalityCompareResult,
} from './analyzers'

// Output formatting
export {
  formatResult,
  formatAnalyzerResult,
  formatTurnLog,
  formatBatchResult,
  formatIssues,
  formatOneLiner,
} from './output'
export type { TurnLogOptions } from './output'
