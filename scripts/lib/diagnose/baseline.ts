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

/** Standard races for baseline testing (grouped by tier) */
export const BASELINE_RACES = [
  // Starter (average)
  'human',
  'dwarf',
  'elf',
  // Unlockable (spread)
  'half_elf',
  'hobbit',
  'gnome',
  'half_orc',
  'half_troll',
  'dunadan',
  'high_elf',
  'kobold',
] as const

/** Standard baseline parameters */
export const BASELINE_DEFAULTS = {
  runs: 100,
  turns: 50000,
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
  /** Use max upgrades (default: true for baseline) */
  maxUpgrades?: boolean
  /** Upgrade preset: 'none', 'early', 'mid', 'late', 'full' */
  upgrades?: string
  /** Booster preset: 'none', 'class', or comma-separated IDs */
  boosters?: string
  /** Bot capabilities spec: 'none', 'full', or comma-separated IDs */
  capabilities?: string
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
  hpFraction?: number
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

export interface BaselineRaceResult {
  raceId: string
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
  const maxUpgrades = config.maxUpgrades ?? true
  const capabilities = config.capabilities ?? 'full'
  const upgrades = config.upgrades ?? 'full'
  const boosters = config.boosters ?? 'class'

  console.log(`\n${'='.repeat(60)}`)
  console.log('BASELINE TEST')
  console.log('='.repeat(60))
  console.log(`Parameters: ${runs} runs, ${turns} turns, seed=${seed}, ${threads} threads`)
  console.log(`Personality: ${personality}, Max Upgrades: ${maxUpgrades}, Capabilities: ${capabilities}`)
  console.log(`Classes: ${BASELINE_CLASSES.length}`)
  console.log('='.repeat(60))

  const results: BaselineResult[] = []

  // Build balance config - use max bestiary if maxUpgrades enabled
  const effectiveBestiary = (config.bestiary ?? 0) > 0 ? config.bestiary : (maxUpgrades ? 25 : 0)
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
    baseHpFraction: (config.hpFraction ?? 70) / 100,
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
      maxUpgrades,
      upgrades,
      boosters,
      capabilities,
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

  // Sort by avg depth descending
  results.sort((a, b) => b.avgDepth - a.avgDepth)

  return results
}

// ============================================================================
// BASELINE RACES MODE
// ============================================================================

export interface BaselineRacesConfig extends BaselineConfig {
  /** Fixed class for race comparison (default: warrior) */
  classId?: string
}

export async function runBaselineRaces(config: BaselineRacesConfig = {}): Promise<BaselineRaceResult[]> {
  const runs = config.runs ?? BASELINE_DEFAULTS.runs
  const turns = config.turns ?? BASELINE_DEFAULTS.turns
  const seed = config.seed ?? BASELINE_DEFAULTS.seed
  const threads = config.threads ?? BASELINE_DEFAULTS.threads
  const classId = config.classId ?? 'warrior'
  const personality = (config.personality ?? 'cautious') as any
  const maxUpgrades = config.maxUpgrades ?? true
  const capabilities = config.capabilities ?? 'full'
  const upgrades = config.upgrades ?? 'full'
  const boosters = config.boosters ?? 'class'

  console.log(`\n${'='.repeat(60)}`)
  console.log('BASELINE RACES TEST')
  console.log('='.repeat(60))
  console.log(`Parameters: ${runs} runs, ${turns} turns, seed=${seed}, ${threads} threads`)
  console.log(`Class: ${classId}, Personality: ${personality}, Max Upgrades: ${maxUpgrades}`)
  console.log(`Races: ${BASELINE_RACES.length}`)
  console.log('='.repeat(60))

  const results: BaselineRaceResult[] = []

  // Build balance config
  const effectiveBestiary = (config.bestiary ?? 0) > 0 ? config.bestiary : (maxUpgrades ? 25 : 0)
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
    baseHpFraction: (config.hpFraction ?? 70) / 100,
  }

  for (const raceId of BASELINE_RACES) {
    const raceStart = Date.now()
    process.stdout.write(`\n${raceId.padEnd(12)} `)

    const batchResult = await runBatchDiagnosisParallel({
      raceId,
      classId,
      personality,
      maxTurns: turns,
      analyzers: createAllAnalyzers(),
      maxUpgrades,
      upgrades,
      boosters,
      capabilities,
      balance,
      runs,
      startSeed: seed,
      threads,
      onProgress: (completed, total) => {
        const pct = Math.floor((completed / total) * 20)
        process.stdout.write(
          `\r${raceId.padEnd(12)} [${'█'.repeat(pct)}${'░'.repeat(20 - pct)}] ${completed}/${total}`
        )
      },
    })

    const depthMetrics = batchResult.aggregateMetrics['worker-metrics.maxDepth']
    const killMetrics = batchResult.aggregateMetrics['worker-metrics.kills']
    const turnMetrics = batchResult.aggregateMetrics['worker-metrics.totalTurns']

    const result: BaselineRaceResult = {
      raceId,
      avgDepth: depthMetrics?.avg ?? 0,
      maxDepth: depthMetrics?.max ?? 0,
      cbRate: (batchResult.circuitBreakerCount / runs) * 100,
      avgKills: killMetrics?.avg ?? 0,
      morgothKills: batchResult.morgothKillCount,
      avgTurns: turnMetrics?.avg ?? 0,
    }
    results.push(result)

    const elapsed = ((Date.now() - raceStart) / 1000).toFixed(1)
    process.stdout.write(`\r${raceId.padEnd(12)} [${'█'.repeat(20)}] done (${elapsed}s)\n`)
  }

  // Sort by avg depth descending
  results.sort((a, b) => b.avgDepth - a.avgDepth)

  return results
}
