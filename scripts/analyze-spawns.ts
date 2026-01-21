/**
 * Monster spawn analysis script for balance pass
 * Analyzes death causes and monster encounter frequency
 */

import { runDeepDiagnosis, createAnalyzers } from './lib/diagnose'

interface MonsterStats {
  deathCauses: Record<string, number>
  monsterEncounters: Record<string, number>
  killsByDepth: Record<number, Record<string, number>>
  deathsByDepth: Record<number, number>
  avgDepth: number
  totalRuns: number
}

function analyzeSpawns(numRuns: number = 50): MonsterStats {
  const stats: MonsterStats = {
    deathCauses: {},
    monsterEncounters: {},
    killsByDepth: {},
    deathsByDepth: {},
    avgDepth: 0,
    totalRuns: numRuns,
  }

  let totalDepth = 0

  for (let i = 0; i < numRuns; i++) {
    const seed = Date.now() + i * 7
    const result = runDeepDiagnosis({
      seed,
      maxTurns: 3000,
      analyzers: createAnalyzers(['combat']),
    })

    // Track depth at death
    const finalDepth = result.finalState.depth
    totalDepth += finalDepth
    stats.deathsByDepth[finalDepth] = (stats.deathsByDepth[finalDepth] ?? 0) + 1

    // Find last enemy fought (death cause)
    for (let j = result.turnLog.length - 1; j >= 0; j--) {
      const entry = result.turnLog[j]
      if (entry?.action?.startsWith('attack:')) {
        const monster = entry.action.replace('attack:', '')
        stats.deathCauses[monster] = (stats.deathCauses[monster] ?? 0) + 1
        break
      }
    }

    // Count all monster encounters and track by depth
    let currentDepth = 1
    for (const entry of result.turnLog) {
      // Track depth changes
      if (entry.flags?.includes('DESCENDED')) {
        currentDepth++
      }

      if (entry?.action?.startsWith('attack:')) {
        const monster = entry.action.replace('attack:', '')
        stats.monsterEncounters[monster] = (stats.monsterEncounters[monster] ?? 0) + 1

        // Track by depth
        if (!stats.killsByDepth[currentDepth]) {
          stats.killsByDepth[currentDepth] = {}
        }
        stats.killsByDepth[currentDepth]![monster] =
          (stats.killsByDepth[currentDepth]![monster] ?? 0) + 1
      }
    }
  }

  stats.avgDepth = totalDepth / numRuns
  return stats
}

function printStats(stats: MonsterStats): void {
  console.log('\n' + '='.repeat(60))
  console.log('MONSTER SPAWN ANALYSIS')
  console.log('='.repeat(60))

  console.log(`\nTotal runs: ${stats.totalRuns}`)
  console.log(`Average death depth: ${stats.avgDepth.toFixed(1)}`)

  console.log('\n--- DEATH CAUSES (last enemy fought) ---')
  Object.entries(stats.deathCauses)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .forEach(([name, count]) => {
      const pct = ((count / stats.totalRuns) * 100).toFixed(0)
      console.log(`  ${count.toString().padStart(3)}x (${pct.padStart(2)}%) ${name}`)
    })

  console.log('\n--- DEATHS BY DEPTH ---')
  Object.entries(stats.deathsByDepth)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .forEach(([depth, count]) => {
      const pct = ((count / stats.totalRuns) * 100).toFixed(0)
      console.log(`  D:${depth.padStart(2)} - ${count.toString().padStart(3)} deaths (${pct}%)`)
    })

  console.log('\n--- MONSTER ENCOUNTER FREQUENCY (top 20) ---')
  const totalEncounters = Object.values(stats.monsterEncounters).reduce((a, b) => a + b, 0)
  Object.entries(stats.monsterEncounters)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .forEach(([name, count]) => {
      const pct = ((count / totalEncounters) * 100).toFixed(1)
      console.log(`  ${count.toString().padStart(4)}x (${pct.padStart(5)}%) ${name}`)
    })

  // Identify uniques in encounters
  const uniques = ['Bullroarer the Hobbit', 'Wormtongue, Agent of Saruman', 'Grishnakh, the Hill Orc', 'Bolg, Son of Azog', 'Azog, Enemy of the Dwarves']
  console.log('\n--- UNIQUE ENCOUNTER RATE ---')
  let uniqueEncounters = 0
  for (const unique of uniques) {
    const count = stats.monsterEncounters[unique] ?? 0
    uniqueEncounters += count
    if (count > 0) {
      const pct = ((count / totalEncounters) * 100).toFixed(1)
      console.log(`  ${count.toString().padStart(4)}x (${pct.padStart(5)}%) ${unique}`)
    }
  }
  console.log(`\n  Total unique encounters: ${uniqueEncounters} / ${totalEncounters} (${((uniqueEncounters / totalEncounters) * 100).toFixed(1)}%)`)

  console.log('\n--- ENCOUNTERS BY DEPTH (top 5 per depth) ---')
  Object.entries(stats.killsByDepth)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .forEach(([depth, monsters]) => {
      console.log(`\n  Depth ${depth}:`)
      Object.entries(monsters)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .forEach(([name, count]) => {
          console.log(`    ${count.toString().padStart(3)}x ${name}`)
        })
    })
}

// Run analysis
const numRuns = parseInt(process.argv[2] ?? '50', 10)
console.log(`Running ${numRuns} games for spawn analysis...`)
const stats = analyzeSpawns(numRuns)
printStats(stats)
