#!/usr/bin/env npx tsx
/**
 * Bot Diagnostic CLI
 *
 * Unified diagnostic toolkit for investigating bot behavior issues.
 *
 * Usage:
 *   pnpm diagnose [mode] [options]
 *
 * Modes:
 *   deep [seed]     - Deep dive on a single seed with full turn log and map
 *   quick [seed]    - Quick check on a single seed (summary only)
 *   batch [runs]    - Run multiple seeds and aggregate results
 *   find            - Find problematic seeds
 *   compare         - Compare behavior across personalities
 *   baseline        - Run full baseline test across all classes (100 runs, 30k turns)
 *   help            - Show this help message
 *
 * Options:
 *   --seed=N        - Specific seed to test
 *   --runs=N        - Number of runs for batch mode (default: 50)
 *   --turns=N       - Max turns per run (default: 5000)
 *   --race=ID       - Race ID (default: human)
 *   --class=ID      - Class ID (default: warrior)
 *   --personality=P - Bot personality (default: cautious)
 *   --analyzers=A,B - Comma-separated analyzer names (default: all)
 *   --map           - Include map visualization (for deep mode)
 *   --from=N        - Start of turn range for output (deep mode)
 *   --to=N          - End of turn range for output (deep mode)
 *   --log-only      - Only show turn log, skip analyzer output (deep mode)
 *
 * Examples:
 *   pnpm diagnose deep 1768965560201
 *   pnpm diagnose quick --seed=12345
 *   pnpm diagnose batch --runs=100 --personality=aggressive
 *   pnpm diagnose find --runs=500
 *   pnpm diagnose compare --runs=20
 */

import {
  runDiagnosis,
  runBatchDiagnosisParallel,
  runDeepDiagnosis,
  createAllAnalyzers,
  createAllAnalyzersWithMap,
  createAnalyzers,
  formatResult,
  formatBatchResult,
  formatTurnLog,
  formatOneLiner,
  formatMapSnapshot,
  compareVariants,
  formatVariantComparison,
  DEFAULT_RACES,
  MapVisualizer,
  runBaseline,
  runBaselineRaces,
  runSensitivityTest,
  CAPABILITY_PRESETS,
} from './lib/diagnose'
import type { CompareVariant } from './lib/diagnose'
import type { AnalyzerName } from './lib/diagnose'
import type { BotPersonality } from '@game/types'

// ============================================================================
// ARGUMENT PARSING
// ============================================================================

interface Args {
  mode: 'deep' | 'quick' | 'batch' | 'find' | 'compare' | 'baseline' | 'baseline-races' | 'sensitivity' | 'help'
  seed?: number
  runs: number
  turns: number
  race: string
  classId: string
  personality: BotPersonality
  analyzers: AnalyzerName[]
  includeMap: boolean
  /** Show full map (all tiles revealed) */
  fullMap: boolean
  /** Start of turn range for output (deep mode) */
  from?: number
  /** End of turn range for output (deep mode) */
  to?: number
  /** Only show turn log, skip analyzer output (deep mode) */
  logOnly: boolean
  /** Number of worker threads for parallel batch runs */
  threads: number
  /** Use max upgrade bonuses */
  maxUpgrades: boolean
  /** Upgrade IDs to exclude when maxUpgrades is true (for isolation testing) */
  excludeUpgrades: string[]
  /** Randomize race/class/personality per run */
  randomize: boolean
  /** Compare races instead of personalities (for compare mode) */
  compareRaces: boolean
  /** Specific races to compare (comma-separated, or empty for defaults) */
  raceList: string[]
  /** Bot capabilities spec: 'none', 'full', or comma-separated upgrade IDs */
  capabilities: string
  /** Upgrade preset: 'none', 'early', 'mid', 'late', 'full' */
  upgrades: string
  /** Booster preset: 'none', 'class', or comma-separated booster IDs */
  boosters: string
  // Balance overrides (Tier 1)
  monsterHp: number
  monsterDamage: number
  startPotions: number
  potionRate: number
  regen: number
  armorPen: number
  // Balance overrides (Tier 2)
  enchantRate: number
  itemRate: number
  levelupHp: number
  // Balance overrides (Tier 3)
  xpRate: number
  upgradePower: number
  // Knowledge system
  bestiary: number
}

const ALL_ANALYZERS: AnalyzerName[] = [
  'stuck',
  'movement',
  'pathing',
  'exploration',
  'combat',
  'goal',
  'jitter',
  'goal-distance',
  'oscillation',
  'frontier',
  'stats',
  'step-debug',
]

function parseArgs(): Args {
  const args = process.argv.slice(2)
  const result: Args = {
    mode: 'help',
    runs: 50,
    turns: 5000,
    race: 'human',
    classId: 'warrior',
    personality: 'cautious',
    analyzers: ALL_ANALYZERS,
    includeMap: false,
    fullMap: false,
    logOnly: false,
    threads: 8,
    maxUpgrades: false,
    excludeUpgrades: [],
    randomize: false,
    compareRaces: false,
    raceList: [],
    capabilities: 'full',
    upgrades: 'full',
    boosters: 'class',
    // Balance defaults (100 = normal)
    monsterHp: 100,
    monsterDamage: 100,
    startPotions: 3,
    potionRate: 100,
    regen: 0,
    armorPen: 0,
    enchantRate: 100,
    itemRate: 100,
    levelupHp: 100,
    xpRate: 100,
    upgradePower: 100,
    bestiary: 0,
  }

  // Parse mode (first positional arg)
  const mode = args[0]
  if (
    mode === 'deep' ||
    mode === 'quick' ||
    mode === 'batch' ||
    mode === 'find' ||
    mode === 'compare' ||
    mode === 'baseline' ||
    mode === 'baseline-races' ||
    mode === 'sensitivity' ||
    mode === 'help'
  ) {
    result.mode = mode
  } else if (mode && !mode.startsWith('--')) {
    // Assume it's a seed for deep mode
    result.mode = 'deep'
    result.seed = parseInt(mode, 10)
  }

  // Check for seed as second positional arg
  if (args[1] && !args[1].startsWith('--')) {
    result.seed = parseInt(args[1], 10)
  }

  // Parse named options
  for (const arg of args) {
    if (arg.startsWith('--seed=')) {
      result.seed = parseInt(arg.slice(7), 10)
    } else if (arg.startsWith('--runs=')) {
      result.runs = parseInt(arg.slice(7), 10)
    } else if (arg.startsWith('--turns=')) {
      result.turns = parseInt(arg.slice(8), 10)
    } else if (arg.startsWith('--race=')) {
      result.race = arg.slice(7)
    } else if (arg.startsWith('--class=')) {
      result.classId = arg.slice(8)
    } else if (arg.startsWith('--personality=')) {
      result.personality = arg.slice(14) as BotPersonality
    } else if (arg.startsWith('--analyzers=')) {
      const names = arg.slice(12).split(',')
      result.analyzers = names.filter((n) =>
        [...ALL_ANALYZERS, 'map'].includes(n)
      ) as AnalyzerName[]
    } else if (arg === '--map') {
      result.includeMap = true
    } else if (arg === '--full-map') {
      result.includeMap = true
      result.fullMap = true
    } else if (arg.startsWith('--from=')) {
      result.from = parseInt(arg.slice(7), 10)
    } else if (arg.startsWith('--to=')) {
      result.to = parseInt(arg.slice(5), 10)
    } else if (arg === '--log-only') {
      result.logOnly = true
    } else if (arg.startsWith('--threads=')) {
      result.threads = parseInt(arg.slice(10), 10)
    } else if (arg === '--max-upgrades') {
      result.maxUpgrades = true
    } else if (arg.startsWith('--exclude-upgrade=')) {
      result.excludeUpgrades = arg.slice(18).split(',').filter(Boolean)
    } else if (arg === '--randomize') {
      result.randomize = true
    } else if (arg === '--races') {
      result.compareRaces = true
    } else if (arg.startsWith('--races=')) {
      result.compareRaces = true
      result.raceList = arg.slice(8).split(',').filter(Boolean)
    } else if (arg.startsWith('--capabilities=')) {
      result.capabilities = arg.slice(15)
    } else if (arg.startsWith('--upgrades=')) {
      result.upgrades = arg.slice(11)
    } else if (arg.startsWith('--boosters=')) {
      result.boosters = arg.slice(11)
    // Balance overrides (Tier 1)
    } else if (arg.startsWith('--monster-hp=')) {
      result.monsterHp = parseInt(arg.slice(13), 10)
    } else if (arg.startsWith('--monster-damage=')) {
      result.monsterDamage = parseInt(arg.slice(17), 10)
    } else if (arg.startsWith('--start-potions=')) {
      result.startPotions = parseInt(arg.slice(16), 10)
    } else if (arg.startsWith('--potion-rate=')) {
      result.potionRate = parseInt(arg.slice(14), 10)
    } else if (arg.startsWith('--regen=')) {
      result.regen = parseInt(arg.slice(8), 10)
    } else if (arg.startsWith('--armor-pen=')) {
      result.armorPen = parseInt(arg.slice(12), 10)
    // Balance overrides (Tier 2)
    } else if (arg.startsWith('--enchant-rate=')) {
      result.enchantRate = parseInt(arg.slice(15), 10)
    } else if (arg.startsWith('--item-rate=')) {
      result.itemRate = parseInt(arg.slice(12), 10)
    } else if (arg.startsWith('--levelup-hp=')) {
      result.levelupHp = parseInt(arg.slice(13), 10)
    // Balance overrides (Tier 3)
    } else if (arg.startsWith('--xp-rate=')) {
      result.xpRate = parseInt(arg.slice(10), 10)
    } else if (arg.startsWith('--upgrade-power=')) {
      result.upgradePower = parseInt(arg.slice(16), 10)
    } else if (arg.startsWith('--bestiary=')) {
      result.bestiary = parseInt(arg.slice(11), 10)
    }
  }

  return result
}

// ============================================================================
// HELP
// ============================================================================

function showHelp(): void {
  console.log(`
Bot Diagnostic CLI
==================

Unified toolkit for investigating bot behavior issues.

USAGE:
  pnpm diagnose [mode] [options]

MODES:
  deep [seed]     Deep dive on a single seed with full turn log
  quick [seed]    Quick check on a single seed (summary only)
  batch           Run multiple seeds and aggregate results
  find            Find problematic seeds automatically
  compare         Compare behavior across all personalities
  baseline        Run full baseline across all 11 classes (100 runs, 50k turns)
  baseline-races  Run full baseline across all 11 races (100 runs, 50k turns)
  sensitivity     Test per-upgrade impact on performance
  help            Show this help message

OPTIONS:
  --seed=N        Specific seed to test (default: random)
  --runs=N        Number of runs for batch/find/compare modes (default: 50)
  --turns=N       Max turns per run (default: 5000)
  --threads=N     Worker threads for batch/find modes (default: 8)
  --race=ID       Race ID (default: human)
  --class=ID      Class ID (default: warrior)
  --personality=P Bot personality (default: cautious)
                  Options: cautious, aggressive, greedy, speedrunner
  --analyzers=A,B Comma-separated analyzer names (default: all)
  --map           Include map visualization (explored tiles only)
  --full-map      Include full map visualization (all tiles revealed)
  --from=N        Start of turn range for output (deep mode only)
  --to=N          End of turn range for output (deep mode only)
  --log-only      Only show turn log, skip analyzer output (deep mode)
  --max-upgrades  Apply all upgrades at max level (legacy, prefer --upgrades=full)
  --upgrades=X    Upgrade preset (default: full)
                  Presets: none, early, mid, late, full
  --boosters=X    Booster preset (default: class)
                  Presets: none, class (primary stat + CON)
                  Or comma-separated IDs: str_superior,con_superior
  --capabilities=X Bot capabilities (default: full)
                  Presets: none, early, mid, late, full
                  Or comma-separated IDs: town,farming,sweep_1,surf_2,etc.
  --randomize     Randomize race/class/personality per run (batch mode)
  --races         Compare races instead of personalities (compare mode)
  --races=a,b,c   Compare specific races (e.g., --races=human,dwarf,elf)

EXAMPLES:
  # Deep dive on a specific problematic seed with explored map
  pnpm diagnose deep 1768965560201 --map

  # Deep dive with full map (all tiles revealed) for dungeon layout analysis
  pnpm diagnose deep 1768965560201 --full-map

  # Deep dive showing only turns 500-600
  pnpm diagnose deep 1768965560201 --from=500 --to=600

  # Quick check with custom config
  pnpm diagnose quick --seed=12345 --class=mage

  # Batch analysis across 100 runs
  pnpm diagnose batch --runs=100

  # Find problematic seeds for aggressive personality
  pnpm diagnose find --runs=500 --personality=aggressive

  # Compare all personalities
  pnpm diagnose compare --runs=20

  # Compare races
  pnpm diagnose compare --races --runs=20 --class=warrior

  # Compare specific races
  pnpm diagnose compare --races=human,dwarf,elf,half_orc --runs=20

  # Run race baseline (all 11 races)
  pnpm diagnose baseline-races --seed=1000 --max-upgrades

  # Test upgrade sensitivity
  pnpm diagnose sensitivity --seed=1000 --class=warrior

  # Test with mid-game capabilities
  pnpm diagnose batch --runs=50 --capabilities=mid --class=warrior

ANALYZERS:
  stuck       - Detects repeated actions, waits, twitch counter issues
  movement    - Detects oscillation (A-B-A-B patterns), move rate
  pathing     - Tracks path efficiency, unreachable targets, goal completion
  exploration - Tracks stairs discovery, exploration progress per level
  combat      - Tracks damage, kills, retreats, death causes
  goal        - Tracks goal lifecycle, persistence, type distribution
  jitter      - Detects bot confined to small area (bounding box analysis)
  frontier    - Frontier reachability, door blocking, goal generation failures
  stats       - Worker metrics aggregation (used internally for batch runs)
  map         - Captures dungeon map snapshots (use --map flag for deep mode)
`)
}

// ============================================================================
// CLI-SPECIFIC HELPERS
// ============================================================================

// (Kept minimal - complex logic lives in lib/)

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  const args = parseArgs()

  if (args.mode === 'help') {
    showHelp()
    return
  }

  // Handle compare mode separately
  if (args.mode === 'compare') {
    const variant: CompareVariant = args.compareRaces ? 'race' : 'personality'
    const variantLabel = variant === 'race' ? 'race' : 'personality'
    console.log(`Running ${variantLabel} comparison...\n`)

    const result = await compareVariants({
      variant,
      ...(args.compareRaces && args.raceList.length > 0 ? { ids: args.raceList } : {}),
      runsPerVariant: args.runs,
      maxTurns: args.turns,
      raceId: args.race,
      classId: args.classId,
      personality: args.personality,
      threads: args.threads,
      seed: args.seed,
      maxUpgrades: args.maxUpgrades,
      upgrades: args.upgrades,
      boosters: args.boosters,
    })
    console.log(formatVariantComparison(result))
    return
  }

  // Handle baseline mode - run all classes with standard parameters
  if (args.mode === 'baseline') {
    await runBaseline({
      runs: args.runs !== 50 ? args.runs : undefined,
      turns: args.turns !== 5000 ? args.turns : undefined,
      seed: args.seed,
      threads: args.threads !== 8 ? args.threads : undefined,
      race: args.race,
      personality: args.personality,
      maxUpgrades: args.maxUpgrades,
      upgrades: args.upgrades,
      boosters: args.boosters,
      monsterHp: args.monsterHp,
      monsterDamage: args.monsterDamage,
      startPotions: args.startPotions,
      potionRate: args.potionRate,
      regen: args.regen,
      armorPen: args.armorPen,
      enchantRate: args.enchantRate,
      itemRate: args.itemRate,
      levelupHp: args.levelupHp,
      xpRate: args.xpRate,
      upgradePower: args.upgradePower,
      bestiary: args.bestiary,
    })
    return
  }

  // Handle baseline-races mode - run all races with standard parameters
  if (args.mode === 'baseline-races') {
    await runBaselineRaces({
      runs: args.runs !== 50 ? args.runs : undefined,
      turns: args.turns !== 5000 ? args.turns : undefined,
      seed: args.seed,
      threads: args.threads !== 8 ? args.threads : undefined,
      classId: args.classId,
      personality: args.personality,
      maxUpgrades: args.maxUpgrades,
      upgrades: args.upgrades,
      boosters: args.boosters,
      capabilities: args.capabilities,
      monsterHp: args.monsterHp,
      monsterDamage: args.monsterDamage,
      startPotions: args.startPotions,
      potionRate: args.potionRate,
      regen: args.regen,
      armorPen: args.armorPen,
      enchantRate: args.enchantRate,
      itemRate: args.itemRate,
      levelupHp: args.levelupHp,
      xpRate: args.xpRate,
      upgradePower: args.upgradePower,
      bestiary: args.bestiary,
    })
    return
  }

  // Handle sensitivity mode - test upgrade impact
  if (args.mode === 'sensitivity') {
    await runSensitivityTest({
      runs: args.runs !== 50 ? args.runs : undefined,
      turns: args.turns !== 5000 ? args.turns : undefined,
      seed: args.seed,
      threads: args.threads !== 8 ? args.threads : undefined,
      classId: args.classId,
      raceId: args.race,
      personality: args.personality,
    })
    return
  }

  // Build analyzers list
  const analyzers = args.includeMap
    ? createAllAnalyzersWithMap({
        showFullMap: args.fullMap,
        captureBothMaps: args.fullMap, // Capture both when full map requested
      })
    : args.analyzers.length === ALL_ANALYZERS.length
      ? createAllAnalyzers()
      : createAnalyzers(args.analyzers)

  // Build balance overrides from args
  // When --max-upgrades is used, default bestiary to 25% (hard cap) unless explicitly set
  const effectiveBestiary = args.bestiary > 0 ? args.bestiary : (args.maxUpgrades ? 25 : 0)
  const balance = {
    monsterHpPercent: args.monsterHp,
    monsterDamagePercent: args.monsterDamage,
    startingPotions: args.startPotions,
    potionRatePercent: args.potionRate,
    regenPer10Turns: args.regen,
    armorPenetration: args.armorPen,
    enchantRatePercent: args.enchantRate,
    itemRatePercent: args.itemRate,
    levelupHpPercent: args.levelupHp,
    xpRatePercent: args.xpRate,
    upgradePowerPercent: args.upgradePower,
    bestiaryBonusPercent: effectiveBestiary,
  }

  const baseConfig = {
    raceId: args.race,
    classId: args.classId,
    personality: args.personality,
    maxTurns: args.turns,
    analyzers,
    maxUpgrades: args.maxUpgrades,
    excludeUpgrades: args.excludeUpgrades,
    upgrades: args.upgrades,
    boosters: args.boosters,
    randomize: args.randomize,
    balance,
    capabilities: args.capabilities,
  }

  switch (args.mode) {
    case 'deep': {
      const seed = args.seed ?? Date.now()
      console.log(`Running deep diagnosis on seed ${seed}...`)
      const result = runDeepDiagnosis({ ...baseConfig, seed })

      if (!args.logOnly) {
        console.log(formatResult(result))
      } else {
        // Brief header for log-only mode
        console.log(`Seed: ${result.seed} | End: ${result.endReason} | Turn: ${result.finalState.turn} | Depth: ${result.finalState.depth}`)
      }

      console.log(formatTurnLog(result.turnLog, {
        maxTurns: args.logOnly ? Infinity : 100,
        onlyFlagged: false,
        from: args.from,
        to: args.to,
      }))

      // Show map if included
      if (args.includeMap) {
        const mapAnalyzer = analyzers.find((a) => a.name === 'map') as MapVisualizer | undefined
        if (mapAnalyzer) {
          const lastMap = mapAnalyzer.getLastMap()
          if (lastMap) {
            console.log('\n' + formatMapSnapshot(lastMap, {
              showExplored: !args.fullMap, // Only show explored if not showing full
              showFull: args.fullMap,
            }))
          }
        }
      }
      break
    }

    case 'quick': {
      const seed = args.seed ?? Date.now()
      console.log(`Running quick diagnosis on seed ${seed}...`)
      const result = runDiagnosis({ ...baseConfig, seed })
      console.log(formatResult(result))
      break
    }

    case 'batch': {
      console.log(`Running batch diagnosis (${args.runs} runs, ${args.threads} threads)...`)
      runBatchDiagnosisParallel({
        ...baseConfig,
        runs: args.runs,
        startSeed: args.seed,
        threads: args.threads,
        onProgress: (completed, total) => {
          process.stdout.write(`\rProgress: ${completed}/${total}`)
        },
      }).then((result) => {
        console.log('\n')
        console.log(formatBatchResult(result))
      })
      break
    }

    case 'find': {
      console.log(`Searching for problematic seeds (${args.runs} runs, ${args.threads} threads)...`)
      runBatchDiagnosisParallel({
        ...baseConfig,
        runs: args.runs,
        startSeed: args.seed,
        onlyProblems: true,
        threads: args.threads,
        onProgress: (completed, total) => {
          process.stdout.write(`\rProgress: ${completed}/${total}`)
        },
      }).then((result) => {
        console.log('\n')
        if (result.problemRuns.length === 0) {
          console.log('No problematic runs found!')
        } else {
          console.log(`Found ${result.problemRuns.length} problematic runs:\n`)
          for (const run of result.problemRuns) {
            console.log(formatOneLiner(run))
          }
          console.log('\nRun with "deep <seed>" for detailed analysis.')
        }
      })
      break
    }

  }
}

main()
