/**
 * Matrix Mode
 *
 * Runs a cartesian product of class/race/personality/upgrade/capability
 * configurations through the shared worker pool. Each combination gets
 * a full batch run; results are collected per-cell for comparison.
 */

import { runBatchDiagnosisParallel } from './runner'
import { BASELINE_CLASSES, BASELINE_RACES } from './baseline'
import type { BatchResult } from './types'
import type { BalanceOverrides } from '@game/types'

// ============================================================================
// TYPES
// ============================================================================

/** A single axis of variation in the matrix */
export type MatrixAxis = 'class' | 'race' | 'personality' | 'upgrades' | 'capabilities'

/** Configuration for a matrix run */
export interface MatrixConfig {
  classes: string[]
  races: string[]
  personalities: string[]
  upgradeTiers: string[]
  capabilityTiers: string[]
  runs: number
  maxTurns: number
  startSeed?: number
  threads: number
  boosters: string
  maxUpgrades: boolean
  balance?: Partial<BalanceOverrides>
  /** Custom header label (default: "MATRIX TEST") */
  headerLabel?: string
  /** When true, zip upgradeTiers and capabilityTiers instead of crossing them.
   *  e.g., [none,mid,full] × [none,mid,full] → 3 cells (none/none, mid/mid, full/full)
   *  instead of 9. Both arrays must have the same length. */
  pairedProgression?: boolean
}

/** One cell in the matrix (a single config combination) */
export interface MatrixCell {
  classId: string
  raceId: string
  personality: string
  upgrades: string
  capabilities: string
}

/** Result for one cell */
export interface MatrixCellResult {
  cell: MatrixCell
  label: string
  avgDepth: number
  maxDepth: number
  cbRate: number
  avgKills: number
  morgothKills: number
  avgTurns: number
  victoryCount: number
  batchResult: BatchResult
}

/** Full matrix result */
export interface MatrixResult {
  config: MatrixConfig
  cells: MatrixCellResult[]
  varyingAxes: MatrixAxis[]
  totalRuns: number
  totalTime: number
}

// ============================================================================
// CORE
// ============================================================================

/** Compute the cartesian product of all matrix axes (or zip progression tiers). */
function buildCells(config: MatrixConfig): MatrixCell[] {
  const cells: MatrixCell[] = []

  // When paired, zip upgrade and capability tiers together
  if (config.pairedProgression) {
    const tierPairs = config.upgradeTiers.map((upg, i) => ({
      upgrades: upg,
      capabilities: config.capabilityTiers[i] ?? upg,
    }))
    for (const classId of config.classes) {
      for (const raceId of config.races) {
        for (const personality of config.personalities) {
          for (const { upgrades, capabilities } of tierPairs) {
            cells.push({ classId, raceId, personality, upgrades, capabilities })
          }
        }
      }
    }
    return cells
  }

  // Default: full cartesian product
  for (const classId of config.classes) {
    for (const raceId of config.races) {
      for (const personality of config.personalities) {
        for (const upgrades of config.upgradeTiers) {
          for (const capabilities of config.capabilityTiers) {
            cells.push({ classId, raceId, personality, upgrades, capabilities })
          }
        }
      }
    }
  }
  return cells
}

/** Determine which axes have more than one value. */
function findVaryingAxes(config: MatrixConfig): MatrixAxis[] {
  const axes: MatrixAxis[] = []
  if (config.classes.length > 1) axes.push('class')
  if (config.races.length > 1) axes.push('race')
  if (config.personalities.length > 1) axes.push('personality')
  if (config.upgradeTiers.length > 1) axes.push('upgrades')
  if (config.capabilityTiers.length > 1) axes.push('capabilities')
  return axes
}

/** Build a subfolder/label from a cell, only including varying dimensions. */
export function buildCellLabel(cell: MatrixCell, varyingAxes: MatrixAxis[]): string {
  const parts: string[] = []
  if (varyingAxes.includes('class')) parts.push(cell.classId)
  if (varyingAxes.includes('race')) parts.push(cell.raceId)
  if (varyingAxes.includes('personality')) parts.push(cell.personality)
  if (varyingAxes.includes('upgrades')) parts.push(`upg_${cell.upgrades}`)
  if (varyingAxes.includes('capabilities')) parts.push(`cap_${cell.capabilities}`)
  return parts.join('-') || 'default'
}

/** Run the full matrix. */
export async function runMatrix(config: MatrixConfig): Promise<MatrixResult> {
  const startTime = Date.now()
  const cells = buildCells(config)
  const varyingAxes = findVaryingAxes(config)
  const results: MatrixCellResult[] = []

  const label = config.headerLabel ?? 'MATRIX TEST'
  console.log(`\n${'='.repeat(60)}`)
  console.log(label)
  console.log('='.repeat(60))

  // Describe dimensions
  const dimParts: string[] = []
  if (config.classes.length > 1) dimParts.push(`${config.classes.length} classes`)
  if (config.races.length > 1) dimParts.push(`${config.races.length} races`)
  if (config.personalities.length > 1) dimParts.push(`${config.personalities.length} personalities`)
  if (config.pairedProgression && config.upgradeTiers.length > 1) {
    dimParts.push(`${config.upgradeTiers.length} progression tiers`)
  } else {
    if (config.upgradeTiers.length > 1) dimParts.push(`${config.upgradeTiers.length} upgrade tiers`)
    if (config.capabilityTiers.length > 1) dimParts.push(`${config.capabilityTiers.length} cap tiers`)
  }
  console.log(`Cells: ${cells.length} (${dimParts.join(' x ') || 'single config'})`)
  console.log(`Per cell: ${config.runs} runs, ${config.maxTurns} turns, ${config.threads} threads`)
  console.log('='.repeat(60))

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]!
    const cellLabel = buildCellLabel(cell, varyingAxes)
    const cellStart = Date.now()
    const padLen = Math.max(20, cellLabel.length + 2)
    process.stdout.write(`\n${cellLabel.padEnd(padLen)} `)

    const batchResult = await runBatchDiagnosisParallel({
      raceId: cell.raceId,
      classId: cell.classId,
      personality: cell.personality as any,
      maxTurns: config.maxTurns,
      runs: config.runs,
      startSeed: config.startSeed,
      threads: config.threads,
      maxUpgrades: config.maxUpgrades,
      upgrades: cell.upgrades,
      capabilities: cell.capabilities,
      boosters: config.boosters,
      balance: config.balance as any,
      onProgress: (completed, total) => {
        const pct = Math.floor((completed / total) * 20)
        process.stdout.write(
          `\r${cellLabel.padEnd(padLen)} [${'█'.repeat(pct)}${'░'.repeat(20 - pct)}] ${completed}/${total}`
        )
      },
    })

    const depthMetrics = batchResult.aggregateMetrics['worker-metrics.maxDepth']
    const killMetrics = batchResult.aggregateMetrics['worker-metrics.kills']
    const turnMetrics = batchResult.aggregateMetrics['worker-metrics.totalTurns']

    const cellResult: MatrixCellResult = {
      cell,
      label: cellLabel,
      avgDepth: depthMetrics?.avg ?? 0,
      maxDepth: depthMetrics?.max ?? 0,
      cbRate: (batchResult.circuitBreakerCount / config.runs) * 100,
      avgKills: killMetrics?.avg ?? 0,
      morgothKills: batchResult.morgothKillCount,
      avgTurns: turnMetrics?.avg ?? 0,
      victoryCount: batchResult.victoryCount,
      batchResult,
    }
    results.push(cellResult)

    const elapsed = ((Date.now() - cellStart) / 1000).toFixed(1)
    process.stdout.write(`\r${cellLabel.padEnd(padLen)} [${'█'.repeat(20)}] done (${elapsed}s) depth=${cellResult.avgDepth.toFixed(1)}\n`)
  }

  return {
    config,
    cells: results,
    varyingAxes,
    totalRuns: cells.length * config.runs,
    totalTime: (Date.now() - startTime) / 1000,
  }
}

// ============================================================================
// FORMATTING
// ============================================================================

/** Map MatrixAxis to display header */
function axisHeader(axis: MatrixAxis): string {
  switch (axis) {
    case 'class': return 'Class'
    case 'race': return 'Race'
    case 'personality': return 'Personality'
    case 'upgrades': return 'Upgrades'
    case 'capabilities': return 'Caps'
  }
}

/** Get axis value from a cell */
function axisValue(cell: MatrixCell, axis: MatrixAxis): string {
  switch (axis) {
    case 'class': return cell.classId
    case 'race': return cell.raceId
    case 'personality': return cell.personality
    case 'upgrades': return cell.upgrades
    case 'capabilities': return cell.capabilities
  }
}

/** Format the matrix summary as a comparison table. */
export function formatMatrixSummary(result: MatrixResult): string {
  const lines: string[] = []
  lines.push(`\n${'='.repeat(60)}`)
  lines.push('MATRIX RESULTS')
  lines.push('='.repeat(60))
  lines.push(`Total cells: ${result.cells.length}, Total runs: ${result.totalRuns}`)
  lines.push(`Time: ${result.totalTime.toFixed(1)}s`)
  lines.push('')

  const axisHeaders = result.varyingAxes.map(axisHeader)
  const metricHeaders = ['Avg Depth', 'Max Depth', 'CB Rate', 'Kills', 'Morgoth', 'Turns']

  // Header
  lines.push(`| ${[...axisHeaders, ...metricHeaders].join(' | ')} |`)
  lines.push(`|${[...axisHeaders, ...metricHeaders].map(h => '-'.repeat(h.length + 2)).join('|')}|`)

  // Sort by avg depth descending
  const sorted = [...result.cells].sort((a, b) => b.avgDepth - a.avgDepth)

  for (const cell of sorted) {
    const axisVals = result.varyingAxes.map(a => axisValue(cell.cell, a))
    const metricVals = [
      cell.avgDepth.toFixed(1),
      String(cell.maxDepth),
      `${cell.cbRate.toFixed(0)}%`,
      cell.avgKills.toFixed(0),
      String(cell.morgothKills),
      cell.avgTurns.toFixed(0),
    ]
    lines.push(`| ${[...axisVals, ...metricVals].join(' | ')} |`)
  }

  lines.push('')
  lines.push(`Copy/paste for BALANCE.md:`)
  lines.push('```')
  lines.push(`| ${[...axisHeaders, ...metricHeaders].join(' | ')} |`)
  lines.push(`|${[...axisHeaders, ...metricHeaders].map(h => '-'.repeat(h.length + 2)).join('|')}|`)
  for (const cell of sorted) {
    const axisVals = result.varyingAxes.map(a => {
      const v = axisValue(cell.cell, a)
      return `**${v.charAt(0).toUpperCase() + v.slice(1)}**`
    })
    const metricVals = [
      cell.avgDepth.toFixed(1),
      String(cell.maxDepth),
      `${cell.cbRate.toFixed(0)}%`,
      cell.avgKills.toFixed(0),
      String(cell.morgothKills),
      cell.avgTurns.toFixed(0),
    ]
    lines.push(`| ${[...axisVals, ...metricVals].join(' | ')} |`)
  }
  lines.push('```')

  return lines.join('\n')
}

// ============================================================================
// CONSTANTS (re-exported for CLI arg resolution)
// ============================================================================

export { BASELINE_CLASSES, BASELINE_RACES }
export const ALL_CAPABILITY_TIERS = ['none', 'early', 'mid', 'late', 'full'] as const
export const ALL_UPGRADE_TIERS = ['none', 'early', 'mid', 'late', 'full'] as const
export const ALL_PERSONALITIES = ['cautious', 'aggressive', 'greedy', 'speedrunner'] as const
