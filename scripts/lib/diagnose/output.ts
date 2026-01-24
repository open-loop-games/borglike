/**
 * Output Formatting Utilities
 *
 * Formats diagnostic results for agent consumption.
 * Optimized for clarity and parseability.
 */

import type {
  DiagnoseResult,
  BatchResult,
  AnalyzerResult,
  DiagnosticIssue,
} from './types'
import type { TurnLogEntry } from './runner'

// ============================================================================
// FORMATTING HELPERS
// ============================================================================

function line(char: string, length: number = 60): string {
  return char.repeat(length)
}

function header(title: string): string {
  return `\n${line('=')} \n${title}\n${line('=')}`
}

function section(title: string): string {
  return `\n${title}\n${line('-', title.length)}`
}

// ============================================================================
// SINGLE RUN OUTPUT
// ============================================================================

/** Format a single diagnostic result */
export function formatResult(result: DiagnoseResult): string {
  const lines: string[] = []

  // Header
  lines.push(header(`DIAGNOSTIC RESULT: seed=${result.seed}`))

  // Configuration
  lines.push(section('Configuration'))
  lines.push(`  Race/Class: ${result.config.raceId}/${result.config.classId}`)
  lines.push(`  Personality: ${result.config.personality}`)
  lines.push(`  Max turns: ${result.config.maxTurns}`)

  // Final state
  lines.push(section('Final State'))
  lines.push(`  End reason: ${result.endReason}`)
  lines.push(`  Turn: ${result.finalState.turn}`)
  lines.push(`  Depth: ${result.finalState.depth}`)
  lines.push(`  HP: ${result.finalState.hp}/${result.finalState.maxHp}`)
  lines.push(`  Kills: ${result.finalState.kills}`)
  lines.push(`  Gold: ${result.finalState.gold}`)
  lines.push(`  Position: (${result.finalState.position.x}, ${result.finalState.position.y})`)

  // Issues summary
  if (result.allIssues.length > 0) {
    lines.push(section(`Issues (${result.allIssues.length})`))
    for (const issue of result.allIssues) {
      const prefix = issue.severity === 'error' ? '[ERROR]' : '[WARN]'
      const turnStr = issue.turn !== undefined ? ` (turn ${issue.turn})` : ''
      lines.push(`  ${prefix} ${issue.message}${turnStr}`)
    }
  } else {
    lines.push(section('Issues'))
    lines.push('  None detected')
  }

  // Analyzer results
  for (const ar of result.analyzerResults) {
    lines.push(formatAnalyzerResult(ar))
  }

  return lines.join('\n')
}

/** Format a single analyzer result */
export function formatAnalyzerResult(result: AnalyzerResult): string {
  const lines: string[] = []

  lines.push(section(`Analyzer: ${result.name}`))

  // Metrics
  for (const [key, value] of Object.entries(result.metrics)) {
    const formatted = typeof value === 'number' && !Number.isInteger(value)
      ? value.toFixed(1)
      : String(value)
    lines.push(`  ${key}: ${formatted}`)
  }

  // Details
  if (result.details && result.details.length > 0) {
    lines.push('')
    for (const detail of result.details) {
      lines.push(`  ${detail}`)
    }
  }

  return lines.join('\n')
}

// ============================================================================
// DEEP DIVE OUTPUT
// ============================================================================

/** Options for formatting turn log */
export interface TurnLogOptions {
  /** Maximum turns to display (default: 50, ignored if from/to specified) */
  maxTurns?: number
  /** Only show turns with flags */
  onlyFlagged?: boolean
  /** Start of turn range (inclusive) */
  from?: number
  /** End of turn range (inclusive) */
  to?: number
}

/** Format turn log for deep dive mode */
export function formatTurnLog(
  turnLog: TurnLogEntry[],
  options: TurnLogOptions = {}
): string {
  const { maxTurns = 50, onlyFlagged = false, from, to } = options
  const lines: string[] = []

  // Determine if we're using range mode
  const useRange = from !== undefined || to !== undefined
  const rangeFrom = from ?? 0
  const rangeTo = to ?? Infinity

  if (useRange) {
    lines.push(section(`Turn Log (turns ${rangeFrom}-${to ?? 'end'})`))
  } else {
    lines.push(section('Turn Log'))
  }

  let count = 0
  for (const entry of turnLog) {
    // Skip turns outside the range
    if (useRange) {
      if (entry.turn < rangeFrom) continue
      if (entry.turn > rangeTo) break
    } else {
      // Original maxTurns behavior when not using range
      if (count >= maxTurns) {
        lines.push(`  ... (${turnLog.length - count} more turns)`)
        break
      }
    }

    if (onlyFlagged && entry.flags.length === 0) continue

    const flagStr = entry.flags.length > 0 ? ` [${entry.flags.join(', ')}]` : ''
    const goalStr = entry.goal ? ` goal=${entry.goal}` : ''
    const mpStr = entry.maxMp > 0 ? ` MP=${entry.mp}/${entry.maxMp}` : ''

    lines.push(
      `  Turn ${String(entry.turn).padStart(4)}: ` +
        `pos=(${entry.position.x},${entry.position.y}) ` +
        `HP=${entry.hp}${mpStr} ` +
        `depth=${entry.depth} ` +
        `action=${entry.action}${goalStr}${flagStr}`
    )

    count++
  }

  if (count === 0) {
    lines.push('  No turns in specified range')
  }

  return lines.join('\n')
}

// ============================================================================
// BATCH OUTPUT
// ============================================================================

/** Format batch results */
export function formatBatchResult(result: BatchResult): string {
  const lines: string[] = []

  lines.push(header('BATCH DIAGNOSTIC RESULT'))

  // Key metrics summary (easy to compare)
  const depth = result.aggregateMetrics['worker-metrics.maxDepth']
  const kills = result.aggregateMetrics['worker-metrics.kills']
  const turns = result.aggregateMetrics['worker-metrics.totalTurns']

  // Count end reasons
  const circuitBreakers = result.problemRuns.filter(r => r.endReason === 'circuit_breaker').length

  lines.push(section('Key Metrics'))
  lines.push(`  Depth:  avg=${depth?.avg.toFixed(1) ?? '?'}  max=${depth?.max.toFixed(0) ?? '?'}`)
  lines.push(`  Kills:  avg=${kills?.avg.toFixed(1) ?? '?'}  max=${kills?.max.toFixed(0) ?? '?'}`)
  lines.push(`  Turns:  avg=${turns?.avg.toFixed(0) ?? '?'}`)
  lines.push(`  Runs:   ${result.totalRuns} total, ${circuitBreakers} circuit breakers (${(circuitBreakers/result.totalRuns*100).toFixed(0)}%)`)

  // Victory and Morgoth tracking
  if (result.victoryCount > 0 || result.morgothKillCount > 0) {
    lines.push(`  VICTORIES: ${result.victoryCount} (${(result.victoryCount/result.totalRuns*100).toFixed(0)}%)`)
    lines.push(`  Morgoth kills: ${result.morgothKillCount}`)
  }

  // Death causes
  if (result.deathCauses && result.deathCauses.length > 0) {
    lines.push(section('Top Killers'))
    for (const dc of result.deathCauses.slice(0, 10)) {
      const pct = (dc.count / result.totalRuns * 100).toFixed(0)
      lines.push(`  ${dc.count}x (${pct}%) ${dc.monster}`)
    }
  }

  // Aggregate metrics
  lines.push(section('Aggregate Metrics'))
  for (const [key, stats] of Object.entries(result.aggregateMetrics)) {
    lines.push(`  ${key}:`)
    lines.push(`    min=${stats.min.toFixed(1)} max=${stats.max.toFixed(1)} avg=${stats.avg.toFixed(1)}`)
  }

  // Common issues
  if (result.aggregateIssues.length > 0) {
    lines.push(section('Common Issues'))
    for (const issue of result.aggregateIssues.slice(0, 10)) {
      lines.push(`  ${issue.count}x: ${issue.message}`)
    }
  }

  // Problem seeds
  if (result.problemRuns.length > 0) {
    lines.push(section('Problem Seeds'))
    for (const run of result.problemRuns.slice(0, 10)) {
      const errorCount = run.allIssues.filter((i) => i.severity === 'error').length
      const warnCount = run.allIssues.filter((i) => i.severity === 'warning').length
      lines.push(`  seed=${run.seed}: ${errorCount} errors, ${warnCount} warnings, ended=${run.endReason}`)
    }
    if (result.problemRuns.length > 10) {
      lines.push(`  ... (${result.problemRuns.length - 10} more)`)
    }
  }

  // Summary table (markdown format for easy copy-paste)
  const className = result.config.classId ?? 'warrior'
  const avgDepth = depth?.avg.toFixed(1) ?? '?'
  const maxDepthVal = depth?.max.toFixed(0) ?? '?'
  const cbRate = ((circuitBreakers / result.totalRuns) * 100).toFixed(0)
  const avgKills = kills?.avg.toFixed(0) ?? '?'
  const victories = result.victoryCount

  lines.push(section('Summary'))
  lines.push('| Class | Avg Depth | Max Depth | CB Rate | Kills | Victories |')
  lines.push('|-------|-----------|-----------|---------|-------|-----------|')
  lines.push(`| **${className.charAt(0).toUpperCase() + className.slice(1)}** | ${avgDepth} | ${maxDepthVal} | ${cbRate}% | ${avgKills} | ${victories} |`)

  return lines.join('\n')
}

// ============================================================================
// ISSUE FORMATTING
// ============================================================================

/** Format issues list */
export function formatIssues(issues: DiagnosticIssue[]): string {
  if (issues.length === 0) {
    return 'No issues detected.'
  }

  const lines: string[] = []
  const errors = issues.filter((i) => i.severity === 'error')
  const warnings = issues.filter((i) => i.severity === 'warning')

  if (errors.length > 0) {
    lines.push(`ERRORS (${errors.length}):`)
    for (const issue of errors) {
      const turnStr = issue.turn !== undefined ? ` (turn ${issue.turn})` : ''
      lines.push(`  - ${issue.message}${turnStr}`)
    }
  }

  if (warnings.length > 0) {
    lines.push(`WARNINGS (${warnings.length}):`)
    for (const issue of warnings) {
      const turnStr = issue.turn !== undefined ? ` (turn ${issue.turn})` : ''
      lines.push(`  - ${issue.message}${turnStr}`)
    }
  }

  return lines.join('\n')
}

// ============================================================================
// COMPACT OUTPUT (for batch/quick checks)
// ============================================================================

/** Format a single-line summary */
export function formatOneLiner(result: DiagnoseResult): string {
  const status = result.hasErrors ? 'FAIL' : result.hasWarnings ? 'WARN' : 'OK'
  return (
    `[${status}] seed=${result.seed} ` +
    `depth=${result.finalState.depth} ` +
    `turns=${result.finalState.turn} ` +
    `kills=${result.finalState.kills} ` +
    `end=${result.endReason} ` +
    `issues=${result.allIssues.length}`
  )
}
