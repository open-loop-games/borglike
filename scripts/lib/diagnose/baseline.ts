/**
 * Baseline Mode
 *
 * Runs standardized baseline tests across all classes for performance tracking.
 */

import { runBatchDiagnosisParallel } from './runner'
import { createAllAnalyzers } from './analyzers'

/** Standard classes for baseline testing (alphabetical) */
export const BASELINE_CLASSES = [
  'archmage',
  'berserker',
  'blackguard',
  'druid',
  'mage',
  'necromancer',
  'paladin',
  'priest',
  'ranger',
  'rogue',
  'warrior',
] as const

/** Standard baseline parameters */
export const BASELINE_DEFAULTS = {
  runs: 100,
  turns: 30000,
  seed: 1000,
  threads: 20,
}

export interface BaselineConfig {
  runs?: number
  turns?: number
  seed?: number
  threads?: number
  race?: string
  personality?: string
  // Balance overrides
  monsterHp?: number
  monsterDamage?: number
  startPotions?: number
  potionRate?: number
  regen?: number
  armorPen?: number
  enchantRate?: number
  itemRate?: number
  levelupHp?: number
  xpRate?: number
  upgradePower?: number
  bestiary?: number
}

export interface BaselineResult {
  classId: string
  avgDepth: number
  maxDepth: number
  cbRate: number
  avgKills: number
  morgothKills: number
  avgTurns: number
}

export async function runBaseline(config: BaselineConfig = {}): Promise<BaselineResult[]> {
  const runs = config.runs ?? BASELINE_DEFAULTS.runs
  const turns = config.turns ?? BASELINE_DEFAULTS.turns
  const seed = config.seed ?? BASELINE_DEFAULTS.seed
  const threads = config.threads ?? BASELINE_DEFAULTS.threads
  const race = config.race ?? 'human'
  const personality = (config.personality ?? 'cautious') as any

  console.log(`\n${'='.repeat(60)}`)
  console.log('BASELINE TEST')
  console.log('='.repeat(60))
  console.log(`Parameters: ${runs} runs, ${turns} turns, seed=${seed}, ${threads} threads`)
  console.log(`Classes: ${BASELINE_CLASSES.length}`)
  console.log('='.repeat(60))

  const results: BaselineResult[] = []
  const startTime = Date.now()

  // Build balance config - always use max bestiary for baseline
  const effectiveBestiary = (config.bestiary ?? 0) > 0 ? config.bestiary : 25
  const balance = {
    monsterHpPercent: config.monsterHp ?? 100,
    monsterDamagePercent: config.monsterDamage ?? 100,
    startingPotions: config.startPotions ?? 3,
    potionRatePercent: config.potionRate ?? 100,
    regenPer10Turns: config.regen ?? 0,
    armorPenetration: config.armorPen ?? 0,
    enchantRatePercent: config.enchantRate ?? 100,
    itemRatePercent: config.itemRate ?? 100,
    levelupHpPercent: config.levelupHp ?? 100,
    xpRatePercent: config.xpRate ?? 100,
    upgradePowerPercent: config.upgradePower ?? 100,
    bestiaryBonusPercent: effectiveBestiary!,
  }

  for (const classId of BASELINE_CLASSES) {
    const classStart = Date.now()
    process.stdout.write(`\n${classId.padEnd(12)} `)

    const batchResult = await runBatchDiagnosisParallel({
      raceId: race,
      classId,
      personality,
      maxTurns: turns,
      analyzers: createAllAnalyzers(),
      maxUpgrades: true, // Always use max upgrades for baseline
      balance,
      runs,
      startSeed: seed,
      threads,
      onProgress: (completed, total) => {
        const pct = Math.floor((completed / total) * 20)
        process.stdout.write(
          `\r${classId.padEnd(12)} [${'█'.repeat(pct)}${'░'.repeat(20 - pct)}] ${completed}/${total}`
        )
      },
    })

    const depthMetrics = batchResult.aggregateMetrics['worker-metrics.maxDepth']
    const killMetrics = batchResult.aggregateMetrics['worker-metrics.kills']
    const turnMetrics = batchResult.aggregateMetrics['worker-metrics.totalTurns']

    const result: BaselineResult = {
      classId,
      avgDepth: depthMetrics?.avg ?? 0,
      maxDepth: depthMetrics?.max ?? 0,
      cbRate: (batchResult.circuitBreakerCount / runs) * 100,
      avgKills: killMetrics?.avg ?? 0,
      morgothKills: batchResult.morgothKillCount,
      avgTurns: turnMetrics?.avg ?? 0,
    }
    results.push(result)

    const elapsed = ((Date.now() - classStart) / 1000).toFixed(1)
    process.stdout.write(`\r${classId.padEnd(12)} [${'█'.repeat(20)}] done (${elapsed}s)\n`)
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)

  // Sort by avg depth descending
  results.sort((a, b) => b.avgDepth - a.avgDepth)

  // Print results table
  console.log(`\n${'='.repeat(60)}`)
  console.log('BASELINE RESULTS')
  console.log('='.repeat(60))
  console.log(`\n| Class | Avg Depth | Max Depth | CB Rate | Kills | Morgoth |`)
  console.log('|-------|-----------|-----------|---------|-------|---------|')
  for (const r of results) {
    const status = r.avgDepth >= 30 ? '✅' : r.avgDepth >= 10 ? '⚠️' : '❌'
    console.log(
      `| ${status} ${r.classId.padEnd(10)} | ${r.avgDepth.toFixed(1).padStart(9)} | ${r.maxDepth.toString().padStart(9)} | ${r.cbRate.toFixed(0).padStart(5)}%  | ${r.avgKills.toFixed(0).padStart(5)} | ${r.morgothKills.toString().padStart(7)} |`
    )
  }

  console.log(`\nTotal time: ${totalTime}s`)
  console.log(`\nCopy/paste for BALANCE-TEST-PLAN.md:`)
  console.log('```')
  console.log(`| Class | Avg Depth | Max Depth | CB Rate | Kills | Status |`)
  console.log('|-------|-----------|-----------|---------|-------|--------|')
  for (const r of results) {
    const status = r.avgDepth >= 30 ? '✅ Endgame' : r.avgDepth >= 10 ? '⚠️ Mid' : '⚠️ Early'
    console.log(
      `| **${r.classId.charAt(0).toUpperCase() + r.classId.slice(1)}** | ${r.avgDepth.toFixed(1)} | ${r.maxDepth} | ${r.cbRate.toFixed(0)}% | ${r.avgKills.toFixed(0)} | ${status} |`
    )
  }
  console.log('```')

  return results
}
