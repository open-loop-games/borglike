/**
 * Upgrade Sensitivity Testing
 *
 * Runs baseline with all upgrades, then with each upgrade excluded,
 * to measure per-upgrade impact on bot performance.
 */

import { runBatchDiagnosisParallel } from './runner'
import { createAllAnalyzers } from './analyzers'

/** Stat upgrades that affect bot combat performance (exclude QoL-only) */
export const SENSITIVITY_UPGRADES = [
  'vitality',
  'might',
  'resilience',
  'swiftness',
  'precision',
  'celerity',
] as const

/** Display names for upgrades */
const UPGRADE_NAMES: Record<string, string> = {
  vitality: 'Vitality (+HP)',
  might: 'Might (+Dmg%)',
  resilience: 'Resilience (+Armor)',
  swiftness: 'Swiftness (+Dodge)',
  precision: 'Precision (+Acc)',
  celerity: 'Celerity (+Speed)',
}

export interface SensitivityConfig {
  /** Runs per test (default: 50) */
  runs?: number
  /** Max turns per run (default: 30000) */
  turns?: number
  /** Starting seed (default: 1000) */
  seed?: number
  /** Worker threads (default: 20) */
  threads?: number
  /** Class to test (default: warrior) */
  classId?: string
  /** Race to test (default: human) */
  raceId?: string
  /** Personality (default: cautious) */
  personality?: string
}

export interface UpgradeImpact {
  upgradeId: string
  upgradeName: string
  excludedDepth: number
  depthDelta: number
  percentImpact: number
}

export interface SensitivityResult {
  baselineAvgDepth: number
  impacts: UpgradeImpact[]
}

const SENSITIVITY_DEFAULTS = {
  runs: 50,
  turns: 30000,
  seed: 1000,
  threads: 20,
}

export async function runSensitivityTest(config: SensitivityConfig = {}): Promise<SensitivityResult> {
  const runs = config.runs ?? SENSITIVITY_DEFAULTS.runs
  const turns = config.turns ?? SENSITIVITY_DEFAULTS.turns
  const seed = config.seed ?? SENSITIVITY_DEFAULTS.seed
  const threads = config.threads ?? SENSITIVITY_DEFAULTS.threads
  const classId = config.classId ?? 'warrior'
  const raceId = config.raceId ?? 'human'
  const personality = (config.personality ?? 'cautious') as any

  console.log(`\n${'='.repeat(60)}`)
  console.log('UPGRADE SENSITIVITY TEST')
  console.log('='.repeat(60))
  console.log(`Parameters: ${runs} runs, ${turns} turns, seed=${seed}, ${threads} threads`)
  console.log(`Class: ${classId}, Race: ${raceId}, Personality: ${personality}`)
  console.log(`Testing ${SENSITIVITY_UPGRADES.length + 1} configurations (baseline + ${SENSITIVITY_UPGRADES.length} exclusions)`)
  console.log('='.repeat(60))

  // Build base config
  const baseConfig = {
    raceId,
    classId,
    personality,
    maxTurns: turns,
    analyzers: createAllAnalyzers(),
    maxUpgrades: true,
    runs,
    startSeed: seed,
    threads,
    balance: {
      bestiaryBonusPercent: 25, // Max bestiary for consistency
    },
  }

  // Step 1: Run baseline (all upgrades)
  process.stdout.write(`\nbaseline     `)
  const baselineResult = await runBatchDiagnosisParallel({
    ...baseConfig,
    onProgress: (completed, total) => {
      const pct = Math.floor((completed / total) * 20)
      process.stdout.write(
        `\rbaseline     [${'█'.repeat(pct)}${'░'.repeat(20 - pct)}] ${completed}/${total}`
      )
    },
  })
  const baselineDepth = baselineResult.aggregateMetrics['worker-metrics.maxDepth']?.avg ?? 0
  process.stdout.write(`\rbaseline     [${'█'.repeat(20)}] done depth=${baselineDepth.toFixed(1)}\n`)

  // Step 2: Run with each upgrade excluded
  const impacts: UpgradeImpact[] = []

  for (const upgradeId of SENSITIVITY_UPGRADES) {
    const displayName = UPGRADE_NAMES[upgradeId] ?? upgradeId
    process.stdout.write(`\n-${upgradeId.padEnd(11)} `)

    const result = await runBatchDiagnosisParallel({
      ...baseConfig,
      excludeUpgrades: [upgradeId],
      onProgress: (completed, total) => {
        const pct = Math.floor((completed / total) * 20)
        process.stdout.write(
          `\r-${upgradeId.padEnd(11)} [${'█'.repeat(pct)}${'░'.repeat(20 - pct)}] ${completed}/${total}`
        )
      },
    })

    const excludedDepth = result.aggregateMetrics['worker-metrics.maxDepth']?.avg ?? 0
    const depthDelta = excludedDepth - baselineDepth
    const percentImpact = baselineDepth > 0 ? (depthDelta / baselineDepth) * 100 : 0

    impacts.push({
      upgradeId,
      upgradeName: displayName,
      excludedDepth,
      depthDelta,
      percentImpact,
    })

    process.stdout.write(`\r-${upgradeId.padEnd(11)} [${'█'.repeat(20)}] done depth=${excludedDepth.toFixed(1)} (${depthDelta >= 0 ? '+' : ''}${depthDelta.toFixed(1)})\n`)
  }

  // Sort by impact (most negative first = most important upgrade)
  impacts.sort((a, b) => a.depthDelta - b.depthDelta)

  return {
    baselineAvgDepth: baselineDepth,
    impacts,
  }
}
