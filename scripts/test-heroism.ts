/**
 * Heroism Potion Usage Investigation Test
 *
 * Tracks when heroism potions are picked up vs used to determine
 * if the bot AI is actually using them appropriately.
 *
 * Run with: npx tsx scripts/test-heroism.ts
 */

import { createGameRunner } from '../src/game/index'
import { computeDangerGrid, getLocalDanger, getMonsterThreat } from '../src/game/bot/danger'
import { isInCombat, countAdjacentMonsters } from '../src/game/bot/combat'
import { findBlessingScroll, findSpeedPotion, hasStatusEffect } from '../src/game/bot/items'
import type { GameState, BotPersonality } from '../src/game/types'

interface RunStats {
  turnsPlayed: number
  maxDepth: number
  kills: number
  reason: string
  maxLocalDanger: number
  heroismPickedUp: number
  heroismUsed: number
  heroismAtEnd: number
  consumablesAtEnd: string[]
  timesOver50Danger: number
  hadHeroismWhenOver50: number
  // Blessing tracking
  blessingScrollsPickedUp: number
  blessingUsed: number
  blessingAtEnd: number
  timesCouldUseBlessing: number  // inCombat && hasScroll && !hasEffect
  // Speed tracking
  speedPotionsPickedUp: number
  speedUsed: number
  speedAtEnd: number
  timesCouldUseSpeed: number  // adjacentCount >= 2 && hasPotion && !hasEffect
}

function runWithTracking(
  raceId: string,
  classId: string,
  personality: BotPersonality,
  maxTurns: number
): RunStats {
  const stats: RunStats = {
    turnsPlayed: 0,
    maxDepth: 0,
    kills: 0,
    reason: '',
    maxLocalDanger: 0,
    heroismPickedUp: 0,
    heroismUsed: 0,
    heroismAtEnd: 0,
    consumablesAtEnd: [],
    timesOver50Danger: 0,
    hadHeroismWhenOver50: 0,
    blessingScrollsPickedUp: 0,
    blessingUsed: 0,
    blessingAtEnd: 0,
    timesCouldUseBlessing: 0,
    speedPotionsPickedUp: 0,
    speedUsed: 0,
    speedAtEnd: 0,
    timesCouldUseSpeed: 0,
  }

  let game: GameState | null = null
  let lastHeroismCount = 0
  let lastBlessingCount = 0
  let lastSpeedCount = 0

  const runner = createGameRunner({
    raceId,
    classId,
    botPersonality: personality,
    maxTurns,
    onTurn: (g: GameState) => {
      game = g

      // Track danger
      const dangerResult = computeDangerGrid(g)
      const localDanger = getLocalDanger(dangerResult.dangers, g.character.position)
      if (localDanger > stats.maxLocalDanger) {
        stats.maxLocalDanger = localDanger
      }

      // Count heroism potions in inventory
      const heroismCount = g.character.inventory.filter(
        item => item.template.name.toLowerCase().includes('heroism')
      ).length

      // Track pickups (count increased)
      if (heroismCount > lastHeroismCount) {
        stats.heroismPickedUp += (heroismCount - lastHeroismCount)
      }

      // Track when over 50 danger
      if (localDanger > 50) {
        stats.timesOver50Danger++
        if (heroismCount > 0) {
          stats.hadHeroismWhenOver50++
        }
      }

      // Check for heroism effect (means it was used)
      const hasHeroismEffect = g.character.statusEffects.some(e => e.type === 'heroism')
      if (hasHeroismEffect && heroismCount < lastHeroismCount) {
        stats.heroismUsed++
      }

      lastHeroismCount = heroismCount

      // Track blessing scrolls
      const blessingCount = g.character.inventory.filter(
        item => item.template.name.toLowerCase().includes('blessing')
      ).length
      if (blessingCount > lastBlessingCount) {
        stats.blessingScrollsPickedUp += (blessingCount - lastBlessingCount)
      }
      const hasBlessingEffect = hasStatusEffect(g.character, 'blessing')
      if (hasBlessingEffect && blessingCount < lastBlessingCount) {
        stats.blessingUsed++
      }
      // Check if conditions met to use blessing but didn't
      // NEW condition: visible DANGEROUS monster (threat >= 100), NOT adjacent (pre-combat buff)
      const adjacentCount = countAdjacentMonsters(g, g.character.position)
      const visibleMonsters = g.monsters.filter(m => {
        if (m.hp <= 0) return false
        const tile = g.currentLevel.tiles[m.position.y]?.[m.position.x]
        return tile?.visible ?? false
      })
      // Check if any visible monster is dangerous (threat >= 100)
      const THREAT_THRESHOLD = 100
      const hasDangerousVisible = visibleMonsters.some(m => {
        const threat = getMonsterThreat(m, g.character)
        return threat >= THREAT_THRESHOLD
      })
      // Only count as "could use" if pre-combat (not adjacent) with dangerous visible monster
      if (adjacentCount === 0 && hasDangerousVisible && !hasBlessingEffect && findBlessingScroll(g.character)) {
        stats.timesCouldUseBlessing++
      }
      lastBlessingCount = blessingCount

      // Track speed potions
      const speedCount = g.character.inventory.filter(
        item => item.template.name.toLowerCase().includes('speed')
      ).length
      if (speedCount > lastSpeedCount) {
        stats.speedPotionsPickedUp += (speedCount - lastSpeedCount)
      }
      const hasSpeedEffect = hasStatusEffect(g.character, 'speed')
      if (hasSpeedEffect && speedCount < lastSpeedCount) {
        stats.speedUsed++
      }
      // Check if conditions met to use speed but didn't
      // NEW conditions: fleeing (danger but not adjacent) OR speedrunner exploring safely
      const inDanger = localDanger > 50
      const notInMelee = adjacentCount === 0
      if (notInMelee && inDanger && !hasSpeedEffect && findSpeedPotion(g.character)) {
        stats.timesCouldUseSpeed++
      }
      lastSpeedCount = speedCount
    },
  })

  const result = runner.runToCompletion()
  stats.turnsPlayed = result.turnsPlayed
  stats.maxDepth = result.maxDepth
  stats.kills = result.kills
  stats.reason = result.reason

  if (game) {
    stats.heroismAtEnd = game.character.inventory.filter(
      item => item.template.name.toLowerCase().includes('heroism')
    ).length
    stats.blessingAtEnd = game.character.inventory.filter(
      item => item.template.name.toLowerCase().includes('blessing')
    ).length
    stats.speedAtEnd = game.character.inventory.filter(
      item => item.template.name.toLowerCase().includes('speed')
    ).length
    stats.consumablesAtEnd = game.character.inventory
      .filter(item => item.template.type === 'potion' || item.template.type === 'scroll')
      .map(item => item.template.name)
  }

  return stats
}

async function main() {
  console.log('='.repeat(60))
  console.log('Heroism Potion Usage Investigation')
  console.log('='.repeat(60))
  console.log()

  // Run multiple tests
  const numRuns = 30
  const maxTurns = 20000

  console.log(`Running ${numRuns} games (${maxTurns} turns each)...`)
  console.log()

  // Heroism tracking
  let heroismPickedUp = 0
  let heroismUsed = 0
  let heroismAtEnd = 0
  // Blessing tracking
  let blessingPickedUp = 0
  let blessingUsed = 0
  let blessingAtEnd = 0
  let timesCouldUseBlessing = 0
  // Speed tracking
  let speedPickedUp = 0
  let speedUsed = 0
  let speedAtEnd = 0
  let timesCouldUseSpeed = 0
  // General
  let maxDangerSeen = 0
  const allConsumables: string[] = []

  for (let i = 0; i < numRuns; i++) {
    const stats = runWithTracking('human', 'warrior', 'cautious', maxTurns)
    heroismPickedUp += stats.heroismPickedUp
    heroismUsed += stats.heroismUsed
    heroismAtEnd += stats.heroismAtEnd
    blessingPickedUp += stats.blessingScrollsPickedUp
    blessingUsed += stats.blessingUsed
    blessingAtEnd += stats.blessingAtEnd
    timesCouldUseBlessing += stats.timesCouldUseBlessing
    speedPickedUp += stats.speedPotionsPickedUp
    speedUsed += stats.speedUsed
    speedAtEnd += stats.speedAtEnd
    timesCouldUseSpeed += stats.timesCouldUseSpeed
    if (stats.maxLocalDanger > maxDangerSeen) {
      maxDangerSeen = stats.maxLocalDanger
    }
    allConsumables.push(...stats.consumablesAtEnd)

    // Show progress
    process.stdout.write(`\rRun ${i + 1}/${numRuns}: depth=${stats.maxDepth}, blessing=${stats.blessingUsed}/${stats.blessingScrollsPickedUp}, speed=${stats.speedUsed}/${stats.speedPotionsPickedUp}`)
  }
  console.log('\n')

  console.log('Summary:')
  console.log('-'.repeat(50))
  console.log('HEROISM:')
  console.log(`  Picked up: ${heroismPickedUp}, Used: ${heroismUsed}, Left: ${heroismAtEnd}`)
  console.log()
  console.log('BLESSING SCROLLS:')
  console.log(`  Picked up: ${blessingPickedUp}, Used: ${blessingUsed}, Left: ${blessingAtEnd}`)
  console.log(`  Times conditions met but NOT used: ${timesCouldUseBlessing}`)
  console.log()
  console.log('SPEED POTIONS:')
  console.log(`  Picked up: ${speedPickedUp}, Used: ${speedUsed}, Left: ${speedAtEnd}`)
  console.log(`  Times conditions met but NOT used: ${timesCouldUseSpeed}`)
  console.log()

  // Show all unique consumables found at end of runs
  const uniqueConsumables = [...new Set(allConsumables)].sort()
  console.log('Consumables left in inventory at end of runs:')
  if (uniqueConsumables.length === 0) {
    console.log('  (none)')
  } else {
    const counts: Record<string, number> = {}
    for (const c of allConsumables) {
      counts[c] = (counts[c] || 0) + 1
    }
    for (const c of uniqueConsumables) {
      console.log(`  ${c}: ${counts[c]}`)
    }
  }

  console.log()
  console.log('='.repeat(60))
  console.log('Investigation complete!')
  console.log('='.repeat(60))
}

main().catch(console.error)
