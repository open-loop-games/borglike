/**
 * Personality Comparator
 *
 * Compares bot behavior across different personalities.
 * Runs batch diagnostics for each personality and analyzes:
 * - Behavioral distinctiveness
 * - Goal type preferences
 * - Combat aggression
 * - Exploration patterns
 * - Item collection bias
 */

import type { BotPersonality } from '@game/types'
import type { DiagnoseConfig, DiagnoseResult, BatchResult } from '../types'
import { runBatchDiagnosis } from '../runner'
import { createAllAnalyzers } from './index'

/** Personality comparison configuration */
export interface PersonalityCompareConfig {
  /** Personalities to compare */
  personalities: BotPersonality[]
  /** Runs per personality */
  runsPerPersonality: number
  /** Max turns per run */
  maxTurns: number
  /** Race to use */
  raceId: string
  /** Class to use */
  classId: string
}

const DEFAULT_CONFIG: PersonalityCompareConfig = {
  personalities: ['cautious', 'aggressive', 'greedy', 'speedrunner'],
  runsPerPersonality: 20,
  maxTurns: 2000,
  raceId: 'human',
  classId: 'warrior',
}

/** Metrics for a single personality */
export interface PersonalityMetrics {
  personality: BotPersonality
  runs: number

  // Core metrics
  avgDepth: number
  avgTurns: number
  avgKills: number
  avgGold: number

  // Exploration
  avgExplorationAtExit: number
  stairsFoundRate: number

  // Combat
  avgDamageDealt: number
  avgDamageTaken: number
  combatRate: number
  retreatRate: number

  // Movement
  moveRate: number
  oscillationRate: number
  jitterRate: number

  // Goals
  goalCompletionRate: number
  goalSwitchRate: number

  // Stuck
  stuckRate: number
  waitRate: number

  // Outcomes
  deathRate: number
  circuitBreakerRate: number
}

/** Comparison result */
export interface PersonalityCompareResult {
  config: PersonalityCompareConfig
  metrics: PersonalityMetrics[]
  distinctiveness: {
    score: number
    details: string[]
  }
  recommendations: string[]
}

/**
 * Extract metrics from batch result
 */
function extractMetrics(personality: BotPersonality, batch: BatchResult): PersonalityMetrics {
  const m = batch.aggregateMetrics
  const get = (key: string) => m[key]?.avg ?? 0

  // Count outcomes
  let deaths = 0
  let circuitBreakers = 0
  for (const run of batch.problemRuns) {
    if (run.endReason === 'death') deaths++
    if (run.endReason === 'circuit_breaker') circuitBreakers++
  }

  return {
    personality,
    runs: batch.totalRuns,

    avgDepth: get('exploration.maxDepth'),
    avgTurns: batch.problemRuns.length > 0
      ? batch.problemRuns.reduce((s, r) => s + r.finalState.turn, 0) / batch.problemRuns.length
      : 0,
    avgKills: get('combat.totalKills'),
    avgGold: 0, // Not tracked in current analyzers

    avgExplorationAtExit: get('exploration.avgExplorationAtExit'),
    stairsFoundRate: get('exploration.stairsFoundRate'),

    avgDamageDealt: get('combat.totalDamageDealt'),
    avgDamageTaken: get('combat.totalDamageTaken'),
    combatRate: get('combat.combatRate'),
    retreatRate: get('combat.retreatRate'),

    moveRate: get('movement.moveRate'),
    oscillationRate: get('movement.oscillationRate'),
    jitterRate: get('jitter.jitterRate'),

    goalCompletionRate: get('pathing.completionRate'),
    goalSwitchRate: get('goal.switchRate'),

    stuckRate: get('stuck.stuckEpisodes') / Math.max(1, batch.totalRuns),
    waitRate: get('stuck.waitRate'),

    deathRate: (deaths / batch.totalRuns) * 100,
    circuitBreakerRate: (circuitBreakers / batch.totalRuns) * 100,
  }
}

/**
 * Calculate how distinct personalities are from each other
 */
function calculateDistinctiveness(metrics: PersonalityMetrics[]): {
  score: number
  details: string[]
} {
  if (metrics.length < 2) {
    return { score: 100, details: ['Only one personality tested'] }
  }

  const details: string[] = []
  let totalVariance = 0
  let checkedMetrics = 0

  // Key metrics that should differ between personalities
  const keyMetrics: (keyof PersonalityMetrics)[] = [
    'avgDepth',
    'avgKills',
    'avgExplorationAtExit',
    'combatRate',
    'retreatRate',
    'goalSwitchRate',
    'stuckRate',
  ]

  for (const metricName of keyMetrics) {
    const values = metrics.map((m) => m[metricName] as number)
    const avg = values.reduce((a, b) => a + b, 0) / values.length
    const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length
    const stdDev = Math.sqrt(variance)
    const coefficientOfVariation = avg > 0 ? (stdDev / avg) * 100 : 0

    if (coefficientOfVariation > 20) {
      details.push(`✓ ${metricName}: Good variance (CV=${coefficientOfVariation.toFixed(1)}%)`)
    } else if (coefficientOfVariation > 10) {
      details.push(`~ ${metricName}: Moderate variance (CV=${coefficientOfVariation.toFixed(1)}%)`)
    } else {
      details.push(`✗ ${metricName}: Low variance (CV=${coefficientOfVariation.toFixed(1)}%)`)
    }

    totalVariance += Math.min(coefficientOfVariation, 50) // Cap contribution
    checkedMetrics++
  }

  // Score: 0-100 based on average coefficient of variation
  const avgVariance = totalVariance / checkedMetrics
  const score = Math.min(100, avgVariance * 2) // Scale up

  return { score, details }
}

/**
 * Generate recommendations based on comparison
 */
function generateRecommendations(metrics: PersonalityMetrics[]): string[] {
  const recommendations: string[] = []

  // Find extremes
  const byDepth = [...metrics].sort((a, b) => b.avgDepth - a.avgDepth)
  const byKills = [...metrics].sort((a, b) => b.avgKills - a.avgKills)
  const byStuck = [...metrics].sort((a, b) => b.stuckRate - a.stuckRate)

  // Check if aggressive is killing most
  const aggressive = metrics.find((m) => m.personality === 'aggressive')
  const cautious = metrics.find((m) => m.personality === 'cautious')

  if (aggressive && cautious) {
    if (aggressive.avgKills < cautious.avgKills) {
      recommendations.push(
        `Aggressive personality has fewer kills (${aggressive.avgKills.toFixed(1)}) than cautious (${cautious.avgKills.toFixed(1)}). Consider increasing aggression.`
      )
    }

    if (aggressive.retreatRate > cautious.retreatRate) {
      recommendations.push(
        `Aggressive personality retreats more often (${aggressive.retreatRate.toFixed(1)}%) than cautious (${cautious.retreatRate.toFixed(1)}%). Check retreat thresholds.`
      )
    }

    if (cautious.avgDepth > aggressive.avgDepth) {
      recommendations.push(
        `Cautious reaches deeper (${cautious.avgDepth.toFixed(1)}) than aggressive (${aggressive.avgDepth.toFixed(1)}). Aggressive may be too reckless.`
      )
    }
  }

  // Check speedrunner
  const speedrunner = metrics.find((m) => m.personality === 'speedrunner')
  if (speedrunner) {
    if (speedrunner.avgExplorationAtExit > 50) {
      recommendations.push(
        `Speedrunner explores too much (${speedrunner.avgExplorationAtExit.toFixed(1)}%). Should descend faster.`
      )
    }
  }

  // Check greedy
  const greedy = metrics.find((m) => m.personality === 'greedy')
  if (greedy && cautious) {
    // Greedy should have more gold/items (not tracked yet, but could be)
    if (greedy.avgKills < cautious.avgKills * 0.5) {
      recommendations.push(
        `Greedy personality may be avoiding combat too much. Consider balancing item pursuit with survival.`
      )
    }
  }

  // General stuck issues
  const worstStuck = byStuck[0]
  if (worstStuck && worstStuck.stuckRate > 0.5) {
    recommendations.push(
      `${worstStuck.personality} has high stuck rate (${worstStuck.stuckRate.toFixed(2)}). Investigate pathfinding.`
    )
  }

  if (recommendations.length === 0) {
    recommendations.push('All personalities appear to be behaving distinctly. No issues detected.')
  }

  return recommendations
}

/**
 * Run personality comparison
 */
export function comparePersonalities(
  config: Partial<PersonalityCompareConfig> = {}
): PersonalityCompareResult {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const allMetrics: PersonalityMetrics[] = []

  console.log(`Comparing ${cfg.personalities.length} personalities...`)

  for (const personality of cfg.personalities) {
    process.stdout.write(`  Testing ${personality}...`)

    const batch = runBatchDiagnosis({
      raceId: cfg.raceId,
      classId: cfg.classId,
      personality,
      maxTurns: cfg.maxTurns,
      runs: cfg.runsPerPersonality,
      analyzers: createAllAnalyzers(),
    })

    const metrics = extractMetrics(personality, batch)
    allMetrics.push(metrics)

    console.log(` done (depth=${metrics.avgDepth.toFixed(1)}, kills=${metrics.avgKills.toFixed(1)})`)
  }

  const distinctiveness = calculateDistinctiveness(allMetrics)
  const recommendations = generateRecommendations(allMetrics)

  return {
    config: cfg,
    metrics: allMetrics,
    distinctiveness,
    recommendations,
  }
}

/**
 * Format comparison result for output
 */
export function formatPersonalityComparison(result: PersonalityCompareResult): string {
  const lines: string[] = []

  lines.push('='.repeat(70))
  lines.push('PERSONALITY COMPARISON')
  lines.push('='.repeat(70))
  lines.push('')

  // Summary table
  lines.push('Metric'.padEnd(25) + result.metrics.map((m) => m.personality.padStart(12)).join(''))
  lines.push('-'.repeat(25 + result.metrics.length * 12))

  const metricRows: [string, (m: PersonalityMetrics) => string][] = [
    ['Avg Depth', (m) => m.avgDepth.toFixed(1)],
    ['Avg Kills', (m) => m.avgKills.toFixed(1)],
    ['Exploration %', (m) => m.avgExplorationAtExit.toFixed(1)],
    ['Stairs Found %', (m) => m.stairsFoundRate.toFixed(1)],
    ['Combat Rate %', (m) => m.combatRate.toFixed(1)],
    ['Retreat Rate %', (m) => m.retreatRate.toFixed(1)],
    ['Move Rate %', (m) => m.moveRate.toFixed(1)],
    ['Goal Completion %', (m) => m.goalCompletionRate.toFixed(1)],
    ['Stuck Episodes', (m) => m.stuckRate.toFixed(2)],
    ['Death Rate %', (m) => m.deathRate.toFixed(1)],
  ]

  for (const [name, getter] of metricRows) {
    const values = result.metrics.map((m) => getter(m).padStart(12)).join('')
    lines.push(name.padEnd(25) + values)
  }

  lines.push('')
  lines.push('Distinctiveness')
  lines.push('-'.repeat(70))
  lines.push(`Score: ${result.distinctiveness.score.toFixed(1)}/100`)
  lines.push('')
  for (const detail of result.distinctiveness.details) {
    lines.push(`  ${detail}`)
  }

  lines.push('')
  lines.push('Recommendations')
  lines.push('-'.repeat(70))
  for (const rec of result.recommendations) {
    lines.push(`  • ${rec}`)
  }

  return lines.join('\n')
}
