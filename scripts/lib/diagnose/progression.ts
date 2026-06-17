/**
 * Progression Mode
 *
 * Continuous progression simulator — no tier bucketing.
 *
 * Phase 1: Run batches at ~12 waypoints along the natural buy path.
 *          Each waypoint specifies exact upgrade levels and capability
 *          IDs, not presets. Waypoints are defined to capture the key
 *          inflection points (town_3 unlock, first stats, slot transitions).
 *
 * Phase 2: Simulate the buy loop. After each purchase, interpolate
 *          between the two nearest waypoints based on purchase completion
 *          fraction. Map to depth/kills/gold/turns → compute essence.
 *
 * Phase 3: Output timeline with milestones.
 */

import { runMatrix } from './matrix'
import { BASELINE_DEFAULTS, BASELINE_CLASSES } from './baseline'
import { essenceFromDeath, essenceFromVictory } from '@/core/formulas'
import { upgrades, calculateUpgradeCost } from '@game/data/upgrades'
import { BOT_UPGRADES } from '@game/data/bot-upgrades'
import type { BalanceOverrides } from '@game/types'
import type { BatchResult } from './types'

// ============================================================================
// TYPES
// ============================================================================

/** Measured run stats at a specific waypoint */
export interface WaypointStats {
  /** Waypoint name for display */
  name: string
  /** Exact upgrade string passed to worker */
  upgradeStr: string
  /** Exact capability string passed to worker */
  capStr: string
  /** Booster tier (none|early|mid|late|full) measured at this waypoint */
  boosterTier: string
  /** Number of purchases completed at this waypoint */
  purchaseCount: number
  avgDepth: number
  medianDepth: number
  avgKills: number
  medianKills: number
  medianGold: number
  medianTurns: number
  victories: number
  totalRuns: number
  medianEssencePerDeath: number
  medianEssencePerVictory: number
}

export interface Purchase {
  id: string
  name: string
  cost: number
  category: 'stat' | 'meta' | 'qol' | 'bot'
}

export interface Milestone {
  label: string
  totalEssence: number
  totalRuns: number
  wallMinutes: number
  essenceRate: number
  slots: number
}

export interface ProgressionResult {
  classId: string
  raceId: string
  waypoints: WaypointStats[]
  milestones: Milestone[]
  buyOrder: { purchase: Purchase; runsSoFar: number; essenceSoFar: number; wallMinutes: number }[]
  totalRuns: number
  totalEssence: number
  totalWallMinutes: number
  dataCollectionTime: number
}

export interface ProgressionConfig {
  classId?: string
  raceId?: string
  runs?: number
  turns?: number
  seed?: number
  threads?: number
  boosters?: string
  balance?: Partial<BalanceOverrides>
}

// ============================================================================
// WAYPOINT DEFINITIONS
// ============================================================================

interface WaypointDef {
  name: string
  upgrades: string     // Custom upgrade string or preset name
  capabilities: string // Custom capability string or preset name
  /** Booster tier matched to this stage (none|early|mid|late|full). Co-varies with
   *  upgrades/caps so the throughput curve isn't measured at top-tier boosters throughout. */
  boosters: string
  /** How many total purchases (bot + stat + meta + qol) a player has at this point.
   *  Used for interpolation — the sim looks up where it sits between waypoints. */
  purchaseCount: number
}

/**
 * Waypoints along the natural buy path. Each represents a snapshot of
 * the game state at a specific point in the progression. The upgrade
 * and capability strings are EXACT — no presets, no tier bucketing.
 *
 * Purchase counts are approximate and used only for interpolation.
 * They don't need to be exact — just monotonically increasing.
 */
const WAYPOINTS: WaypointDef[] = [
  {
    name: 'bare',
    upgrades: 'none',
    capabilities: 'none',
    boosters: 'none',
    purchaseCount: 0,
  },
  {
    // Economy only: auto_restart + essence_boost 1-2. No combat effect.
    // Same depth as bare but models the first few purchases.
    name: 'economy',
    upgrades: 'none',
    capabilities: 'none',
    boosters: 'none',
    purchaseCount: 3,
  },
  {
    // First bot unlocks: cheap chains at tier 1
    name: 'early_bots',
    upgrades: 'none',
    capabilities: 'farming,town_1,town_2,preparedness_1,tactics_1,targeting_1,retreat_1',
    boosters: 'early',
    purchaseCount: 10,
  },
  {
    // Town_3 unlock (major inflection point)
    name: 'town3',
    upgrades: 'none',
    capabilities: 'farming,town_3,preparedness_1,tactics_1,targeting_1,retreat_1',
    boosters: 'early',
    purchaseCount: 11,
  },
  {
    // Mid bot capabilities + a few stat levels
    name: 'mid_bots',
    upgrades: 'none',
    capabilities: 'farming,town_3,preparedness_2,tactics_2,surf_1,kiting_1,targeting_2,retreat_2',
    boosters: 'mid',
    purchaseCount: 18,
  },
  {
    // All bot capabilities + first stat purchases
    name: 'all_bots',
    upgrades: 'none',
    capabilities: 'full',
    boosters: 'mid',
    purchaseCount: 25,
  },
  {
    // All bots + early stat upgrades
    name: 'early_stats',
    upgrades: 'vitality=2,might=2,resilience=1',
    capabilities: 'full',
    boosters: 'late',
    purchaseCount: 30,
  },
  {
    // All bots + mid stat upgrades
    name: 'mid_stats',
    upgrades: 'vitality=5,might=5,resilience=5,reflexes=4,precision=2,swiftness=2',
    capabilities: 'full',
    boosters: 'late',
    purchaseCount: 48,
  },
  {
    // All bots + late stat upgrades
    name: 'late_stats',
    upgrades: 'vitality=8,might=8,resilience=7,reflexes=6,precision=4,swiftness=4',
    capabilities: 'full',
    boosters: 'full',
    purchaseCount: 62,
  },
  {
    // Everything maxed
    name: 'full',
    upgrades: 'full',
    capabilities: 'full',
    boosters: 'full',
    purchaseCount: 126,  // all 126 purchasable items
  },
]

// ============================================================================
// CONSTANTS
// ============================================================================

const BASE_TURNS_PER_SECOND = 10
const INTER_RUN_SECONDS = 3

// ============================================================================
// HELPERS
// ============================================================================

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t))
}

/** Build all purchasable items.
 *  Note: boosters are NOT in this list — the buy-loop sim doesn't model booster
 *  purchase costs. Per-waypoint booster tiers improve measurement fidelity (each
 *  waypoint runs at a stage-matched loadout) but the economy timeline doesn't
 *  spend essence on them. Closing that gap is out of scope. */
function buildPurchaseList(): Purchase[] {
  const purchases: Purchase[] = []

  for (const upg of upgrades) {
    const cat = upg.category === 'stats' ? 'stat'
      : upg.category === 'meta' ? 'meta'
      : 'qol'
    for (let level = 0; level < upg.maxLevel; level++) {
      purchases.push({
        id: `${upg.id}_${level + 1}`,
        name: `${upg.name} ${level + 1}`,
        cost: calculateUpgradeCost(upg, level),
        category: cat,
      })
    }
  }

  for (const bot of BOT_UPGRADES) {
    purchases.push({
      id: bot.id,
      name: bot.name,
      cost: bot.cost,
      category: 'bot',
    })
  }

  return purchases
}

// ============================================================================
// ECONOMY HELPERS (rate multipliers from purchased items)
// ============================================================================

function getEssenceBoostMultiplier(purchasedIds: Set<string>): number {
  let level = 0
  for (let i = 1; i <= 10; i++) {
    if (purchasedIds.has(`essence_boost_${i}`)) level = i
  }
  return level === 0 ? 1 : 1 + (10 * level) / 100
}

function getRunSlots(purchasedIds: Set<string>): number {
  if (purchasedIds.has('run_slot_4_1')) return 4
  if (purchasedIds.has('run_slot_3_1')) return 3
  if (purchasedIds.has('run_slot_2_1')) return 2
  return 1
}

function getTurboMultiplier(purchasedIds: Set<string>): number {
  let level = 0
  for (let i = 1; i <= 4; i++) {
    if (purchasedIds.has(`turbo_mode_${i}`)) level = i
  }
  return 1 + 0.25 * level
}

function hasAutoRestart(purchasedIds: Set<string>): boolean {
  return purchasedIds.has('auto_restart_1')
}

// ============================================================================
// DATA COLLECTION
// ============================================================================

/** Extract WaypointStats from a batch result */
function extractWaypointStats(
  name: string,
  upgradeStr: string,
  capStr: string,
  boosterTier: string,
  purchaseCount: number,
  batch: BatchResult,
  runsPerCell: number,
): WaypointStats {
  const depths = batch.runs.map(r => r.depth)
  const kills = batch.runs.map(r => r.kills)
  const golds = batch.runs.map(r => r.gold)
  const turnCounts = batch.runs.map(r => r.turns)

  const deathEssences = batch.runs
    .filter(r => r.endReason === 'death')
    .map(r => essenceFromDeath(r.depth, r.kills, r.gold))

  const victoryEssences = batch.runs
    .filter(r => r.endReason === 'victory')
    .map(r => essenceFromVictory(r.depth, r.kills, r.turns))

  return {
    name,
    upgradeStr,
    capStr,
    boosterTier,
    purchaseCount,
    avgDepth: batch.aggregateMetrics['worker-metrics.maxDepth']?.avg ?? 0,
    medianDepth: median(depths),
    avgKills: batch.aggregateMetrics['worker-metrics.kills']?.avg ?? 0,
    medianKills: median(kills),
    medianGold: median(golds),
    medianTurns: median(turnCounts),
    victories: batch.victories,
    totalRuns: runsPerCell,
    medianEssencePerDeath: median(deathEssences),
    medianEssencePerVictory: victoryEssences.length > 0 ? median(victoryEssences) : 0,
  }
}

/** Merge waypoint stats across multiple classes (average) */
function mergeWaypointStats(perClassWaypoints: WaypointStats[][]): WaypointStats[] {
  // All classes have the same waypoint count/order
  const numWaypoints = perClassWaypoints[0]!.length
  const numClasses = perClassWaypoints.length
  const merged: WaypointStats[] = []

  for (let wi = 0; wi < numWaypoints; wi++) {
    const matching = perClassWaypoints.map(cls => cls[wi]!)
    const n = numClasses

    const withVic = matching.filter(w => w.medianEssencePerVictory > 0)
    merged.push({
      name: matching[0]!.name,
      upgradeStr: matching[0]!.upgradeStr,
      capStr: matching[0]!.capStr,
      boosterTier: matching[0]!.boosterTier,
      purchaseCount: matching[0]!.purchaseCount,
      avgDepth: matching.reduce((s, w) => s + w.avgDepth, 0) / n,
      medianDepth: matching.reduce((s, w) => s + w.medianDepth, 0) / n,
      avgKills: matching.reduce((s, w) => s + w.avgKills, 0) / n,
      medianKills: matching.reduce((s, w) => s + w.medianKills, 0) / n,
      medianGold: matching.reduce((s, w) => s + w.medianGold, 0) / n,
      medianTurns: matching.reduce((s, w) => s + w.medianTurns, 0) / n,
      victories: matching.reduce((s, w) => s + w.victories, 0),
      totalRuns: matching.reduce((s, w) => s + w.totalRuns, 0),
      medianEssencePerDeath: matching.reduce((s, w) => s + w.medianEssencePerDeath, 0) / n,
      medianEssencePerVictory: withVic.length > 0
        ? withVic.reduce((s, w) => s + w.medianEssencePerVictory, 0) / withVic.length
        : 0,
    })
  }

  return merged
}

async function collectWaypointStats(config: ProgressionConfig): Promise<{
  waypoints: WaypointStats[]
  dataCollectionTime: number
}> {
  const startTime = Date.now()
  const classId = config.classId ?? 'warrior'
  const raceId = config.raceId ?? 'human'
  const runs = config.runs ?? 20
  const turns = config.turns ?? BASELINE_DEFAULTS.turns
  const seed = config.seed ?? BASELINE_DEFAULTS.seed
  const threads = config.threads ?? BASELINE_DEFAULTS.threads
  const boosters = config.boosters ?? 'class'
  const balance: Partial<BalanceOverrides> = { ...(config.balance ?? {}) }

  const isRandom = classId === 'random' || classId === 'all'
  const classes = isRandom ? [...BASELINE_CLASSES] : [classId]

  // Deduplicate waypoints with identical upgrade+cap+booster strings
  // (e.g., 'bare' and 'economy' both have none/none/none)
  const uniqueConfigs: { upgrades: string; capabilities: string; boosters: string; waypointIndices: number[] }[] = []
  for (let i = 0; i < WAYPOINTS.length; i++) {
    const wp = WAYPOINTS[i]!
    const existing = uniqueConfigs.find(c => c.upgrades === wp.upgrades && c.capabilities === wp.capabilities && c.boosters === wp.boosters)
    if (existing) {
      existing.waypointIndices.push(i)
    } else {
      uniqueConfigs.push({ upgrades: wp.upgrades, capabilities: wp.capabilities, boosters: wp.boosters, waypointIndices: [i] })
    }
  }

  // Run matrix with unique configs as "tiers"
  // Using paired mode: upgradeTiers[i] pairs with capabilityTiers[i] and boosterTiers[i]
  const upgradeTiers = uniqueConfigs.map(c => c.upgrades)
  const capabilityTiers = uniqueConfigs.map(c => c.capabilities)
  const boosterTiers = uniqueConfigs.map(c => c.boosters)

  const result = await runMatrix({
    classes,
    races: [raceId],
    personalities: ['cautious'],
    upgradeTiers,
    capabilityTiers,
    runs,
    maxTurns: turns,
    startSeed: seed,
    threads,
    boosters,
    boosterTiers,
    maxUpgrades: false,
    balance,
    pairedProgression: true,
    headerLabel: isRandom
      ? `PROGRESSION WAYPOINTS (${classes.length} classes × ${uniqueConfigs.length} waypoints)`
      : `PROGRESSION WAYPOINTS (${uniqueConfigs.length} waypoints)`,
  })

  // Map matrix cells back to waypoints
  if (isRandom) {
    // Group cells by class
    const byClass = new Map<string, typeof result.cells>()
    for (const cell of result.cells) {
      if (!byClass.has(cell.cell.classId)) byClass.set(cell.cell.classId, [])
      byClass.get(cell.cell.classId)!.push(cell)
    }

    const perClassWaypoints: WaypointStats[][] = []
    for (const [, classCells] of byClass) {
      const classWaypoints = buildWaypointsFromCells(classCells, uniqueConfigs, runs)
      perClassWaypoints.push(classWaypoints)
    }

    return {
      waypoints: mergeWaypointStats(perClassWaypoints),
      dataCollectionTime: (Date.now() - startTime) / 1000,
    }
  }

  const waypoints = buildWaypointsFromCells(result.cells, uniqueConfigs, runs)
  return {
    waypoints,
    dataCollectionTime: (Date.now() - startTime) / 1000,
  }
}

/** Build waypoint stats from matrix cells, mapping unique configs back to (possibly duplicate) waypoints */
function buildWaypointsFromCells(
  cells: { cell: { upgrades: string; capabilities: string; boosters: string }; batchResult: BatchResult; avgDepth: number; avgKills: number; avgTurns: number }[],
  uniqueConfigs: { upgrades: string; capabilities: string; boosters: string; waypointIndices: number[] }[],
  runs: number,
): WaypointStats[] {
  const waypoints: WaypointStats[] = new Array(WAYPOINTS.length)

  for (let ci = 0; ci < uniqueConfigs.length; ci++) {
    const config = uniqueConfigs[ci]!
    const cell = cells.find(c => c.cell.upgrades === config.upgrades && c.cell.capabilities === config.capabilities && c.cell.boosters === config.boosters)
    if (!cell) continue

    for (const wi of config.waypointIndices) {
      const wp = WAYPOINTS[wi]!
      waypoints[wi] = extractWaypointStats(
        wp.name, wp.upgrades, wp.capabilities, wp.boosters, wp.purchaseCount,
        cell.batchResult, runs,
      )
    }
  }

  return waypoints
}

// ============================================================================
// BUY SIMULATION
// ============================================================================

const ECONOMY_IDS = new Set([
  'auto_restart_1',
  ...Array.from({ length: 10 }, (_, i) => `essence_boost_${i + 1}`),
  'run_slot_2_1', 'run_slot_3_1', 'run_slot_4_1',
  ...Array.from({ length: 4 }, (_, i) => `turbo_mode_${i + 1}`),
])

const BOT_IDS = new Set<string>(BOT_UPGRADES.map(b => b.id))

/**
 * Pick next purchase based on waypoint-informed strategy.
 *
 * Key insight from waypoint data:
 * - early_bots with no stats = no improvement (or regression)
 * - mid_bots (town_3 + tier 2 chains) = 5x essence jump
 * - all_bots with no stats = REGRESSION from mid_bots (longer runs, same depth)
 * - early_stats with full bots = 2x essence jump
 *
 * Strategy:
 * 1. Economy items (auto restart, essence boost, turbo, slots) always get
 *    priority at their cost tier — they multiply everything.
 * 2. Cheap bots (<500 ess) are bought before stats — they're prerequisites
 *    for the mid_bots waypoint which is the big inflection.
 * 3. Expensive bots (>=500 ess, tier 3 chains) compete with stats on equal
 *    footing by cost — the data shows they don't help without stats.
 * 4. Slots get an effective cost discount (they multiply all income).
 */
function pickNextPurchase(available: Purchase[], totalBotPurchases: number): Purchase {
  const autoRestart = available.find(p => p.id === 'auto_restart_1')
  if (autoRestart) return autoRestart

  const econAvailable = available.filter(p => ECONOMY_IDS.has(p.id)).sort((a, b) => a.cost - b.cost)
  // Split bots into cheap (tier 1-2, <500) and expensive (tier 3, >=500)
  const cheapBotAvailable = available.filter(p => BOT_IDS.has(p.id) && p.cost < 500).sort((a, b) => a.cost - b.cost)
  const expensiveBotAvailable = available.filter(p => BOT_IDS.has(p.id) && p.cost >= 500).sort((a, b) => a.cost - b.cost)
  const statAvailable = available.filter(p => !ECONOMY_IDS.has(p.id) && !BOT_IDS.has(p.id)).sort((a, b) => a.cost - b.cost)

  const cheapEcon = econAvailable[0]
  const cheapBot = cheapBotAvailable[0]
  const expBot = expensiveBotAvailable[0]
  const cheapStat = statAvailable[0]

  // Phase-based strategy informed by waypoint data:
  //
  // Phase A (botPurchases < 15): Economy and bots only — stats don't help
  //   without bots (waypoint: early_bots ≈ bare). Rush to mid_bots inflection.
  //   Exception: let very cheap econ items through (essence boost, turbo).
  //
  // Phase B (botPurchases >= 15): Bots have reached mid-level, stats start
  //   compounding. Interleave everything by cost. Expensive bot tier 3 chains
  //   compete equally with stats.

  const candidates: { purchase: Purchase; effectiveCost: number }[] = []

  if (cheapEcon) {
    const isSlot = cheapEcon.id.startsWith('run_slot_')
    candidates.push({ purchase: cheapEcon, effectiveCost: isSlot ? cheapEcon.cost * 0.3 : cheapEcon.cost })
  }

  // All phases: economy always competes (already in candidates above).
  // The question is when bots vs stats enter.

  if (totalBotPurchases < 15) {
    // Phase A: Economy + cheap bots. Rush to mid_bots inflection.
    // No stats — data shows they don't help without bots.
    if (cheapBot) candidates.push({ purchase: cheapBot, effectiveCost: cheapBot.cost })
    if (expBot) candidates.push({ purchase: expBot, effectiveCost: expBot.cost })
  } else {
    // Phase B: Bot mid-level reached. Stats NOW compound with bots.
    // Mix stats + remaining expensive bots by cost.
    if (cheapBot) candidates.push({ purchase: cheapBot, effectiveCost: cheapBot.cost })
    if (expBot) candidates.push({ purchase: expBot, effectiveCost: expBot.cost })
    if (cheapStat) candidates.push({ purchase: cheapStat, effectiveCost: cheapStat.cost })
  }

  if (candidates.length === 0) return available[0]!

  candidates.sort((a, b) => a.effectiveCost - b.effectiveCost)
  return candidates[0]!.purchase
}

/**
 * Interpolate run stats between waypoints based on purchase count.
 * Returns blended essence/run and turn duration.
 */
function interpolateStats(
  purchaseCount: number,
  waypoints: WaypointStats[],
): { essencePerRun: number; medianTurns: number; hasVictories: boolean } {
  // Find the two waypoints we're between
  let lo = 0
  let hi = waypoints.length - 1

  for (let i = 0; i < waypoints.length - 1; i++) {
    if (purchaseCount >= waypoints[i]!.purchaseCount && purchaseCount <= waypoints[i + 1]!.purchaseCount) {
      lo = i
      hi = i + 1
      break
    }
    if (purchaseCount > waypoints[i]!.purchaseCount) {
      lo = i
      hi = Math.min(i + 1, waypoints.length - 1)
    }
  }

  const wpLo = waypoints[lo]!
  const wpHi = waypoints[hi]!

  // Compute interpolation fraction
  const range = wpHi.purchaseCount - wpLo.purchaseCount
  const t = range > 0 ? (purchaseCount - wpLo.purchaseCount) / range : 0

  // Blend essence per run
  const loVicRate = wpLo.victories / wpLo.totalRuns
  const hiVicRate = wpHi.victories / wpHi.totalRuns
  const vicRate = lerp(loVicRate, hiVicRate, t)

  const loEss = loVicRate > 0 && wpLo.medianEssencePerVictory > 0
    ? wpLo.medianEssencePerDeath * (1 - loVicRate) + wpLo.medianEssencePerVictory * loVicRate
    : wpLo.medianEssencePerDeath
  const hiEss = hiVicRate > 0 && wpHi.medianEssencePerVictory > 0
    ? wpHi.medianEssencePerDeath * (1 - hiVicRate) + wpHi.medianEssencePerVictory * hiVicRate
    : wpHi.medianEssencePerDeath

  return {
    essencePerRun: lerp(loEss, hiEss, t),
    medianTurns: lerp(wpLo.medianTurns, wpHi.medianTurns, t),
    hasVictories: vicRate > 0,
  }
}

function simulateBuyLoop(waypoints: WaypointStats[]): {
  milestones: Milestone[]
  buyOrder: ProgressionResult['buyOrder']
  totalRuns: number
  totalEssence: number
  totalWallMinutes: number
} {
  const allPurchases = buildPurchaseList()
  const purchaseMap = new Map(allPurchases.map(p => [p.id, p]))
  const purchasedIds = new Set<string>()
  const buyOrder: ProgressionResult['buyOrder'] = []
  const milestones: Milestone[] = []

  let totalEssence = 0
  let totalRuns = 0
  let totalWallSeconds = 0
  let currentEssence = 0
  let purchaseCount = 0

  function runCycle(): { essencePerCycle: number; wallSeconds: number } {
    const { essencePerRun, medianTurns } = interpolateStats(purchaseCount, waypoints)
    const essenceBoost = getEssenceBoostMultiplier(purchasedIds)
    const slots = getRunSlots(purchasedIds)
    const turboMult = getTurboMultiplier(purchasedIds)
    const turnsPerSec = BASE_TURNS_PER_SECOND * turboMult
    const autoRestart = hasAutoRestart(purchasedIds)
    const interRunTime = autoRestart ? 1 : INTER_RUN_SECONDS

    const essPerRun = Math.floor(essencePerRun * essenceBoost)
    const runSeconds = medianTurns / turnsPerSec + interRunTime

    return {
      essencePerCycle: essPerRun * slots,
      wallSeconds: runSeconds,
    }
  }

  function addMilestone(label: string) {
    const { essencePerCycle, wallSeconds } = runCycle()
    const wallMinutes = wallSeconds / 60
    const essenceRate = wallMinutes > 0 ? essencePerCycle / wallMinutes : 0
    milestones.push({
      label,
      totalEssence,
      totalRuns,
      wallMinutes: totalWallSeconds / 60,
      essenceRate,
      slots: getRunSlots(purchasedIds),
    })
  }

  addMilestone('Start')

  let firstVictoryLogged = false
  let allBotsLogged = false
  let allStatsLogged = false
  let totalBotPurchases = 0
  let totalStatLevels = 0
  const slotMilestones = new Set<number>()

  const unpurchased = new Set(allPurchases.map(p => p.id))

  while (unpurchased.size > 0) {
    const available = [...unpurchased].map(id => purchaseMap.get(id)!).filter(Boolean)
    const next = pickNextPurchase(available, totalBotPurchases)

    while (currentEssence < next.cost) {
      const { essencePerCycle, wallSeconds } = runCycle()
      const slots = getRunSlots(purchasedIds)
      currentEssence += essencePerCycle
      totalEssence += essencePerCycle
      totalRuns += slots
      totalWallSeconds += wallSeconds
    }

    currentEssence -= next.cost
    purchasedIds.add(next.id)
    unpurchased.delete(next.id)
    purchaseCount++

    if (next.category === 'stat') totalStatLevels++
    if (next.category === 'bot') totalBotPurchases++

    buyOrder.push({
      purchase: next,
      runsSoFar: totalRuns,
      essenceSoFar: totalEssence,
      wallMinutes: totalWallSeconds / 60,
    })

    // Milestones
    if (next.id === 'auto_restart_1') addMilestone('Auto Restart')

    const slots = getRunSlots(purchasedIds)
    if (slots >= 2 && !slotMilestones.has(2)) { addMilestone('2 Run Slots'); slotMilestones.add(2) }
    if (slots >= 3 && !slotMilestones.has(3)) { addMilestone('3 Run Slots'); slotMilestones.add(3) }
    if (slots >= 4 && !slotMilestones.has(4)) { addMilestone('4 Run Slots'); slotMilestones.add(4) }

    if (!firstVictoryLogged) {
      const { hasVictories } = interpolateStats(purchaseCount, waypoints)
      if (hasVictories) {
        firstVictoryLogged = true
        addMilestone('First Victory Window')
      }
    }

    if (!allBotsLogged && totalBotPurchases >= BOT_UPGRADES.length) {
      allBotsLogged = true
      addMilestone('All Bot Capabilities')
    }

    if (!allStatsLogged && totalStatLevels >= 60) {
      allStatsLogged = true
      addMilestone('All Stat Upgrades')
    }
  }

  addMilestone('All Purchased')
  return { milestones, buyOrder, totalRuns, totalEssence, totalWallMinutes: totalWallSeconds / 60 }
}

// ============================================================================
// PUBLIC API
// ============================================================================

export async function runProgression(config: ProgressionConfig = {}): Promise<ProgressionResult> {
  const classId = config.classId ?? 'warrior'
  const raceId = config.raceId ?? 'human'

  const { waypoints, dataCollectionTime } = await collectWaypointStats(config)
  const { milestones, buyOrder, totalRuns, totalEssence, totalWallMinutes } = simulateBuyLoop(waypoints)

  return {
    classId: (classId === 'all' || classId === 'random') ? 'random' : classId,
    raceId,
    waypoints,
    milestones,
    buyOrder,
    totalRuns,
    totalEssence,
    totalWallMinutes,
    dataCollectionTime,
  }
}
