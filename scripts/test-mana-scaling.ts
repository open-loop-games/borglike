/**
 * Mana Scaling Test Script
 *
 * Tests mana pool growth, regeneration rates, and spell cost balance
 * across different levels and classes.
 *
 * Run with: npx tsx scripts/test-mana-scaling.ts
 */

import {
  createGame,
  processTurn,
  runBotTick,
  createBotState,
  getSpellsForLevel,
  type BotPersonality,
} from '../src/game'

// ============================================================================
// TEST UTILITIES
// ============================================================================

function log(message: string): void {
  console.log(message)
}

function logSection(title: string): void {
  console.log('\n' + '='.repeat(60))
  console.log(title)
  console.log('='.repeat(60))
}


// ============================================================================
// MANA POOL SCALING TEST
// ============================================================================

function testManaPoolScaling(): void {
  logSection('Mana Pool Scaling by Level')

  const classes = ['mage', 'priest', 'necromancer', 'druid', 'rogue', 'paladin']

  for (const classId of classes) {
    log(`\n${classId.toUpperCase()}:`)
    log('Level | Max MP | Regen/Turn | Cheapest | Most Exp | Turns/Cheap')
    log('-'.repeat(65))

    const levels = [1, 5, 10, 15, 20, 25, 30]

    for (const level of levels) {
      const game = createGame({
        raceId: 'human',
        classId,
        seed: 12345,
      })

      // Manually set level and recalculate
      game.character.level = level
      game.character.maxMp = Math.floor(
        ((game.character.stats.int + game.character.stats.wis) * level) / 4
      )
      game.character.mp = game.character.maxMp

      // Get spells for this level
      const spells = getSpellsForLevel(classId, level)

      if (spells.length === 0) {
        log(`${level.toString().padStart(5)} | ${game.character.maxMp.toString().padStart(6)} | ${'N/A'.padStart(10)} | ${'N/A'.padStart(8)} | ${'N/A'.padStart(8)} | N/A`)
        continue
      }

      const cheapest = Math.min(...spells.map((s) => s.manaCost))
      const mostExpensive = Math.max(...spells.map((s) => s.manaCost))

      // Regen rate = 1 + WIS/10
      const regenRate = 1 + Math.floor(game.character.stats.wis / 10)

      // Turns to regen cheapest spell
      const turnsPerCheap = Math.ceil(cheapest / regenRate)

      log(
        `${level.toString().padStart(5)} | ` +
        `${game.character.maxMp.toString().padStart(6)} | ` +
        `${regenRate.toString().padStart(10)} | ` +
        `${cheapest.toString().padStart(8)} | ` +
        `${mostExpensive.toString().padStart(8)} | ` +
        `${turnsPerCheap}`
      )
    }
  }
}

// ============================================================================
// MANA SUSTAINABILITY TEST
// ============================================================================

function testManaSustainability(): void {
  logSection('Mana Sustainability in Extended Combat')

  const testCases = [
    { classId: 'mage', personality: 'cautious' as BotPersonality },
    { classId: 'priest', personality: 'cautious' as BotPersonality },
    { classId: 'necromancer', personality: 'aggressive' as BotPersonality },
  ]

  for (const { classId, personality } of testCases) {
    log(`\n${classId} (${personality}):`)

    const game = createGame({
      raceId: 'human',
      classId,
      seed: 54321,
    })

    const botState = createBotState()
    const maxTurns = 500
    const manaReadings: number[] = []
    const spellsCast: string[] = []

    let outOfManaTurns = 0

    for (let i = 0; i < maxTurns && game.isRunning; i++) {
      // Record mana every 10 turns
      if (i % 10 === 0) {
        manaReadings.push(game.character.mp)
      }

      // Check if out of mana
      if (game.character.mp < 2) {
        outOfManaTurns++
      }

      const action = runBotTick(game, personality, undefined, botState)

      if (action.type === 'cast') {
        spellsCast.push(action.spellId)
      }

      processTurn(game, action)

      if (game.character.isDead) break
    }

    const avgMana = manaReadings.reduce((a, b) => a + b, 0) / manaReadings.length

    log(`  Turns survived: ${game.stats.turnsPlayed}`)
    log(`  Spells cast: ${spellsCast.length}`)
    log(`  Out of mana turns: ${outOfManaTurns} (${(outOfManaTurns / game.stats.turnsPlayed * 100).toFixed(1)}%)`)
    log(`  Average mana: ${avgMana.toFixed(1)} / ${game.character.maxMp}`)
    log(`  Unique spells used: ${[...new Set(spellsCast)].join(', ')}`)

    // Check sustainability
    const sustainabilityRatio = 1 - (outOfManaTurns / game.stats.turnsPlayed)
    if (sustainabilityRatio > 0.8) {
      log(`  Sustainability: GOOD (${(sustainabilityRatio * 100).toFixed(0)}%)`)
    } else if (sustainabilityRatio > 0.5) {
      log(`  Sustainability: MODERATE (${(sustainabilityRatio * 100).toFixed(0)}%)`)
    } else {
      log(`  Sustainability: POOR (${(sustainabilityRatio * 100).toFixed(0)}%) - may need tuning`)
    }
  }
}

// ============================================================================
// CASTER VS MELEE COMPARISON
// ============================================================================

function testCasterVsMelee(): void {
  logSection('Caster vs Melee Performance Comparison')

  const comparisons = [
    { caster: 'mage', melee: 'warrior' },
    { caster: 'priest', melee: 'warrior' },
    { caster: 'necromancer', melee: 'blackguard' },
  ]

  for (const { caster, melee } of comparisons) {
    log(`\n${caster.toUpperCase()} vs ${melee.toUpperCase()}:`)

    const runs = 5
    const casterResults: { depth: number; kills: number; turns: number }[] = []
    const meleeResults: { depth: number; kills: number; turns: number }[] = []

    for (let i = 0; i < runs; i++) {
      const seed = 10000 + i

      // Run caster
      const casterGame = createGame({ raceId: 'human', classId: caster, seed })
      const casterState = createBotState()
      runFullGame(casterGame, casterState, 'cautious')
      casterResults.push({
        depth: casterGame.stats.deepestDepth,
        kills: casterGame.stats.kills,
        turns: casterGame.stats.turnsPlayed,
      })

      // Run melee
      const meleeGame = createGame({ raceId: 'human', classId: melee, seed })
      const meleeState = createBotState()
      runFullGame(meleeGame, meleeState, 'aggressive')
      meleeResults.push({
        depth: meleeGame.stats.deepestDepth,
        kills: meleeGame.stats.kills,
        turns: meleeGame.stats.turnsPlayed,
      })
    }

    const casterAvgDepth = casterResults.reduce((a, b) => a + b.depth, 0) / runs
    const casterAvgKills = casterResults.reduce((a, b) => a + b.kills, 0) / runs
    const meleeAvgDepth = meleeResults.reduce((a, b) => a + b.depth, 0) / runs
    const meleeAvgKills = meleeResults.reduce((a, b) => a + b.kills, 0) / runs

    log(`  ${caster}: avg depth ${casterAvgDepth.toFixed(1)}, avg kills ${casterAvgKills.toFixed(1)}`)
    log(`  ${melee}: avg depth ${meleeAvgDepth.toFixed(1)}, avg kills ${meleeAvgKills.toFixed(1)}`)

    const depthDiff = ((casterAvgDepth - meleeAvgDepth) / meleeAvgDepth * 100).toFixed(1)
    const killsDiff = ((casterAvgKills - meleeAvgKills) / meleeAvgKills * 100).toFixed(1)

    log(`  Depth difference: ${depthDiff}%`)
    log(`  Kills difference: ${killsDiff}%`)
  }
}

function runFullGame(
  game: ReturnType<typeof createGame>,
  botState: ReturnType<typeof createBotState>,
  personality: BotPersonality
): void {
  const maxTurns = 2000

  for (let i = 0; i < maxTurns && game.isRunning; i++) {
    const action = runBotTick(game, personality, undefined, botState)
    processTurn(game, action)
  }
}

// ============================================================================
// SPELL COST ANALYSIS
// ============================================================================

function testSpellCostAnalysis(): void {
  logSection('Spell Cost vs Power Analysis')

  const classes = ['mage', 'priest', 'druid', 'necromancer']

  for (const classId of classes) {
    log(`\n${classId.toUpperCase()} Spells:`)
    log('Spell Name          | Cost | Level | Type         | Efficiency')
    log('-'.repeat(70))

    const spells = getSpellsForLevel(classId, 50) // Get all possible spells

    for (const spell of spells) {
      // Rough efficiency = level * 2 / cost (higher = better value)
      const efficiency = ((spell.level * 2) / spell.manaCost).toFixed(2)

      log(
        `${spell.name.padEnd(20)}| ` +
        `${spell.manaCost.toString().padStart(4)} | ` +
        `${spell.level.toString().padStart(5)} | ` +
        `${spell.effectType.padEnd(12)} | ` +
        `${efficiency}`
      )
    }
  }
}

// ============================================================================
// MAIN
// ============================================================================

function main(): void {
  console.log('Borglike Mana Scaling Tests')
  console.log('===========================')

  testManaPoolScaling()
  testSpellCostAnalysis()
  testManaSustainability()
  testCasterVsMelee()

  logSection('All Mana Scaling Tests Complete!')
}

main()
