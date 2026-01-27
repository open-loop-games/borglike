#!/usr/bin/env tsx
/**
 * Caster Caution Sweep Test
 *
 * Systematically tests different cautionMod values for Mage, Archmage, and Necromancer
 * to find optimal settings for depth progression.
 *
 * Usage:
 *   pnpm tsx scripts/caster-caution-sweep.ts
 *   pnpm tsx scripts/caster-caution-sweep.ts --runs=30 --turns=30000
 *   pnpm tsx scripts/caster-caution-sweep.ts --caution=-20,-15,-10  # specific values
 */

import { spawn } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ============================================================================
// CONFIGURATION
// ============================================================================

const CLASS_PROFILES_PATH = path.join(__dirname, '../src/game/bot/class-profiles.ts')

// Default test parameters
const DEFAULT_RUNS = 50
const DEFAULT_TURNS = 50000
const DEFAULT_SEED = 1000
const MAX_PARALLEL = 2

// Classes to test
const CASTER_CLASSES = ['mage', 'archmage', 'necromancer'] as const

// CautionMod values to sweep (coarse first, can add finer values)
const DEFAULT_CAUTION_VALUES = [-30, -25, -20, -15, -10, 0]

// ============================================================================
// TYPES
// ============================================================================

interface TestResult {
  class: string
  cautionMod: number
  avgDepth: number
  maxDepth: number
  cbRate: number
  kills: number
  deaths: number
  victories: number
}

interface ParsedArgs {
  runs: number
  turns: number
  seed: number
  cautionValues: number[]
}

// ============================================================================
// FILE MANIPULATION
// ============================================================================

function readClassProfiles(): string {
  return fs.readFileSync(CLASS_PROFILES_PATH, 'utf-8')
}

function writeClassProfiles(content: string): void {
  fs.writeFileSync(CLASS_PROFILES_PATH, content)
}

function backupClassProfiles(): string {
  const content = readClassProfiles()
  const backupPath = CLASS_PROFILES_PATH + '.backup'
  fs.writeFileSync(backupPath, content)
  return backupPath
}

function restoreClassProfiles(backupPath: string): void {
  const content = fs.readFileSync(backupPath, 'utf-8')
  writeClassProfiles(content)
  fs.unlinkSync(backupPath)
}

/**
 * Update cautionMod for a specific class in the profiles file
 */
function setCautionMod(content: string, className: string, cautionMod: number): string {
  // Match the class profile block and update cautionMod
  const classPattern = new RegExp(
    `(const ${className}: ClassBehaviorProfile = \\{[^}]*cautionMod:)\\s*-?\\d+`,
    'g'
  )
  return content.replace(classPattern, `$1 ${cautionMod}`)
}

/**
 * Update all caster classes to the same cautionMod
 */
function setAllCastersCautionMod(cautionMod: number): void {
  let content = readClassProfiles()
  for (const cls of CASTER_CLASSES) {
    content = setCautionMod(content, cls, cautionMod)
  }
  writeClassProfiles(content)
}

// ============================================================================
// TEST EXECUTION
// ============================================================================

function runBatchTest(
  className: string,
  runs: number,
  turns: number,
  seed: number
): Promise<TestResult | null> {
  return new Promise((resolve) => {
    const args = [
      'diagnose',
      'batch',
      `--runs=${runs}`,
      `--seed=${seed}`,
      `--class=${className}`,
      '--max-upgrades',
      `--turns=${turns}`,
    ]

    let output = ''
    const proc = spawn('pnpm', args, {
      cwd: path.join(__dirname, '..'),
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    proc.stdout.on('data', (data) => {
      output += data.toString()
    })

    proc.stderr.on('data', (data) => {
      output += data.toString()
    })

    proc.on('close', (code) => {
      if (code !== 0) {
        console.error(`  [ERROR] ${className} test failed with code ${code}`)
        resolve(null)
        return
      }

      // Parse results from output
      const result = parseTestOutput(output, className)
      resolve(result)
    })
  })
}

function parseTestOutput(output: string, className: string): TestResult | null {
  // Look for the summary line: | **Mage** | 38.3 | 46 | 0% | 652 | 0 |
  const summaryMatch = output.match(
    /\|\s*\*\*(\w+)\*\*\s*\|\s*([\d.]+)\s*\|\s*(\d+)\s*\|\s*(\d+)%\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|/
  )

  if (!summaryMatch) {
    console.error(`  [ERROR] Could not parse results for ${className}`)
    return null
  }

  // Count deaths from "ended=death" lines
  const deathMatches = output.match(/ended=death/g)
  const deaths = deathMatches ? deathMatches.length : 0

  return {
    class: className,
    cautionMod: 0, // Will be set by caller
    avgDepth: parseFloat(summaryMatch[2]),
    maxDepth: parseInt(summaryMatch[3]),
    cbRate: parseInt(summaryMatch[4]),
    kills: parseInt(summaryMatch[5]),
    deaths,
    victories: parseInt(summaryMatch[6]),
  }
}

/**
 * Run tests for multiple classes in parallel (up to MAX_PARALLEL)
 */
async function runParallelTests(
  classes: readonly string[],
  runs: number,
  turns: number,
  seed: number
): Promise<(TestResult | null)[]> {
  const results: (TestResult | null)[] = []

  // Process in batches of MAX_PARALLEL
  for (let i = 0; i < classes.length; i += MAX_PARALLEL) {
    const batch = classes.slice(i, i + MAX_PARALLEL)
    const batchPromises = batch.map((cls) => runBatchTest(cls, runs, turns, seed))
    const batchResults = await Promise.all(batchPromises)
    results.push(...batchResults)
  }

  return results
}

// ============================================================================
// RESULTS FORMATTING
// ============================================================================

function formatResultsTable(results: TestResult[]): string {
  const lines: string[] = []

  lines.push('')
  lines.push('| Class | cautionMod | Avg Depth | Max Depth | CB Rate | Kills | Deaths | Victories |')
  lines.push('|-------|------------|-----------|-----------|---------|-------|--------|-----------|')

  // Sort by class, then by cautionMod
  const sorted = [...results].sort((a, b) => {
    if (a.class !== b.class) return a.class.localeCompare(b.class)
    return b.cautionMod - a.cautionMod // Higher (less negative) first
  })

  for (const r of sorted) {
    lines.push(
      `| ${r.class} | ${r.cautionMod} | ${r.avgDepth.toFixed(1)} | ${r.maxDepth} | ${r.cbRate}% | ${r.kills} | ${r.deaths} | ${r.victories} |`
    )
  }

  return lines.join('\n')
}

function findBestSettings(results: TestResult[]): void {
  console.log('\n=== BEST SETTINGS BY CLASS ===\n')

  for (const cls of CASTER_CLASSES) {
    const classResults = results.filter((r) => r.class === cls)
    if (classResults.length === 0) continue

    // Find best by avg depth
    const bestAvg = classResults.reduce((a, b) => (a.avgDepth > b.avgDepth ? a : b))
    // Find best by max depth
    const bestMax = classResults.reduce((a, b) => (a.maxDepth > b.maxDepth ? a : b))

    console.log(`${cls.toUpperCase()}:`)
    console.log(`  Best avg depth: ${bestAvg.avgDepth.toFixed(1)} @ cautionMod=${bestAvg.cautionMod}`)
    console.log(`  Best max depth: ${bestMax.maxDepth} @ cautionMod=${bestMax.cautionMod}`)
    console.log()
  }
}

// ============================================================================
// ARGUMENT PARSING
// ============================================================================

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2)
  let runs = DEFAULT_RUNS
  let turns = DEFAULT_TURNS
  let seed = DEFAULT_SEED
  let cautionValues = DEFAULT_CAUTION_VALUES

  for (const arg of args) {
    const [key, value] = arg.split('=')
    if (!value) continue

    if (key === '--runs') {
      runs = parseInt(value)
    } else if (key === '--turns') {
      turns = parseInt(value)
    } else if (key === '--seed') {
      seed = parseInt(value)
    } else if (key === '--caution') {
      cautionValues = value.split(',').map((v) => parseInt(v.trim()))
    }
  }

  return { runs, turns, seed, cautionValues }
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  const { runs, turns, seed, cautionValues } = parseArgs()

  console.log('=== CASTER CAUTION SWEEP TEST ===')
  console.log(`Classes: ${CASTER_CLASSES.join(', ')}`)
  console.log(`Caution values: ${cautionValues.join(', ')}`)
  console.log(`Runs per config: ${runs}`)
  console.log(`Turns per run: ${turns}`)
  console.log(`Seed: ${seed}`)
  console.log(`Parallel: ${MAX_PARALLEL}`)
  console.log()

  const totalConfigs = cautionValues.length * CASTER_CLASSES.length
  const estimatedMinutes = Math.ceil((totalConfigs * 3) / MAX_PARALLEL) // ~3 min per batch
  console.log(`Total configurations: ${totalConfigs}`)
  console.log(`Estimated time: ~${estimatedMinutes} minutes`)
  console.log()

  // Backup original file
  const backupPath = backupClassProfiles()
  console.log(`Backed up class-profiles.ts to ${backupPath}`)
  console.log()

  const allResults: TestResult[] = []

  try {
    for (const cautionMod of cautionValues) {
      console.log(`\n>>> Testing cautionMod = ${cautionMod} <<<`)

      // Update all caster classes to this cautionMod
      setAllCastersCautionMod(cautionMod)
      console.log(`  Updated class-profiles.ts`)

      // Run tests for all classes (2 at a time)
      console.log(`  Running tests (${MAX_PARALLEL} parallel)...`)
      const results = await runParallelTests(CASTER_CLASSES, runs, turns, seed)

      // Store results with cautionMod
      for (const result of results) {
        if (result) {
          result.cautionMod = cautionMod
          allResults.push(result)
          console.log(
            `  ${result.class}: avg=${result.avgDepth.toFixed(1)} max=${result.maxDepth} cb=${result.cbRate}% deaths=${result.deaths}`
          )
        }
      }
    }

    // Print final results
    console.log('\n' + '='.repeat(60))
    console.log('FINAL RESULTS')
    console.log('='.repeat(60))
    console.log(formatResultsTable(allResults))

    findBestSettings(allResults)

  } finally {
    // Always restore original file
    console.log('\nRestoring original class-profiles.ts...')
    restoreClassProfiles(backupPath)
    console.log('Done.')
  }
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
