/**
 * Diagnose Item Spam - Track chained consumable usage
 *
 * Detects when the bot uses multiple potions/scrolls in rapid succession
 * and captures the game state context to understand why.
 *
 * Run with: npx tsx scripts/diagnose-item-spam.ts
 */

import { createGameRunner } from '../src/game/index'
import { computeDangerGrid, getLocalDanger, getDangerTier, calculateAvoidance, getImmediateDanger, getImmediateDangerTier } from '../src/game/bot/danger'
import { getPersonalityConfig } from '../src/game/bot'
import { isInCombat, countAdjacentMonsters } from '../src/game/bot/combat'
import type { GameState, BotPersonality } from '../src/game/types'

interface ItemUse {
  turn: number
  itemName: string
  itemType: 'potion' | 'scroll'
  hp: number
  maxHp: number
  hpRatio: number
  localDanger: number
  localTier: string
  immediateDanger: number
  immediateTier: string
  depth: number
  avoidance: number
  potionsRemaining: number
  scrollsRemaining: number
  adjacentMonsters: number
  inCombat: boolean
}

interface RunStats {
  turnsPlayed: number
  maxDepth: number
  kills: number
  reason: string
  itemUses: ItemUse[]
  chains: ItemUse[][]  // Groups of uses within 3 turns of each other
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
    itemUses: [],
    chains: [],
  }

  let game: GameState | null = null
  const config = getPersonalityConfig(personality)

  // Track previous inventory to detect usage
  let lastPotionCount = 0
  let lastScrollCount = 0
  let lastPotionNames: string[] = []
  let lastScrollNames: string[] = []

  // Store previous turn's state to capture BEFORE item use
  let prevState: {
    hp: number
    maxHp: number
    hpRatio: number
    localDanger: number
    localTier: string
    immediateDanger: number
    immediateTier: string
    avoidance: number
    adjacentMonsters: number
    inCombat: boolean
    depth: number
    turn: number
  } | null = null

  const runner = createGameRunner({
    raceId,
    classId,
    botPersonality: personality,
    maxTurns,
    onTurn: (g: GameState) => {
      game = g

      // Count current consumables
      const potions = g.character.inventory.filter(i => i.template.type === 'potion')
      const scrolls = g.character.inventory.filter(i => i.template.type === 'scroll')
      const potionNames = potions.map(i => i.template.name)
      const scrollNames = scrolls.map(i => i.template.name)

      // Detect potion usage (count decreased) - use PREVIOUS state
      if (potions.length < lastPotionCount && prevState) {
        // Find which potion was used
        const usedName = lastPotionNames.find(name => {
          const prevCount = lastPotionNames.filter(n => n === name).length
          const currCount = potionNames.filter(n => n === name).length
          return currCount < prevCount
        }) || 'Unknown Potion'

        stats.itemUses.push({
          turn: prevState.turn,
          itemName: usedName,
          itemType: 'potion',
          hp: prevState.hp,
          maxHp: prevState.maxHp,
          hpRatio: prevState.hpRatio,
          localDanger: prevState.localDanger,
          localTier: prevState.localTier,
          immediateDanger: prevState.immediateDanger,
          immediateTier: prevState.immediateTier,
          depth: prevState.depth,
          avoidance: prevState.avoidance,
          potionsRemaining: potions.length,
          scrollsRemaining: scrolls.length,
          adjacentMonsters: prevState.adjacentMonsters,
          inCombat: prevState.inCombat,
        })
      }

      // Detect scroll usage (count decreased) - use PREVIOUS state
      if (scrolls.length < lastScrollCount && prevState) {
        const usedName = lastScrollNames.find(name => {
          const prevCount = lastScrollNames.filter(n => n === name).length
          const currCount = scrollNames.filter(n => n === name).length
          return currCount < prevCount
        }) || 'Unknown Scroll'

        stats.itemUses.push({
          turn: prevState.turn,
          itemName: usedName,
          itemType: 'scroll',
          hp: prevState.hp,
          maxHp: prevState.maxHp,
          hpRatio: prevState.hpRatio,
          localDanger: prevState.localDanger,
          localTier: prevState.localTier,
          immediateDanger: prevState.immediateDanger,
          immediateTier: prevState.immediateTier,
          depth: prevState.depth,
          avoidance: prevState.avoidance,
          potionsRemaining: potions.length,
          scrollsRemaining: scrolls.length,
          adjacentMonsters: prevState.adjacentMonsters,
          inCombat: prevState.inCombat,
        })
      }

      // Capture current state for next turn's comparison
      const dangerResult = computeDangerGrid(g)
      const localDanger = getLocalDanger(dangerResult.dangers, g.character.position)
      const avoidance = calculateAvoidance(g, config)
      const localTier = getDangerTier(localDanger, avoidance)
      const immDanger = getImmediateDanger(g)
      const immTier = getImmediateDangerTier(immDanger, g.character.hp, g.character.maxHp)
      const adjCount = countAdjacentMonsters(g, g.character.position)
      const combat = isInCombat(g)

      prevState = {
        hp: g.character.hp,
        maxHp: g.character.maxHp,
        hpRatio: g.character.hp / g.character.maxHp,
        localDanger,
        localTier,
        immediateDanger: immDanger,
        immediateTier: immTier,
        avoidance,
        adjacentMonsters: adjCount,
        inCombat: combat,
        depth: g.character.depth,
        turn: g.turn,
      }

      // Update tracking
      lastPotionCount = potions.length
      lastScrollCount = scrolls.length
      lastPotionNames = potionNames
      lastScrollNames = scrollNames
    },
  })

  const result = runner.runToCompletion()
  stats.turnsPlayed = result.turnsPlayed
  stats.maxDepth = result.maxDepth
  stats.kills = result.kills
  stats.reason = result.reason

  // Detect chains (items used within 3 turns of each other)
  let currentChain: ItemUse[] = []
  for (const use of stats.itemUses) {
    if (currentChain.length === 0) {
      currentChain.push(use)
    } else {
      const last = currentChain[currentChain.length - 1]!
      if (use.turn - last.turn <= 3) {
        currentChain.push(use)
      } else {
        if (currentChain.length >= 2) {
          stats.chains.push(currentChain)
        }
        currentChain = [use]
      }
    }
  }
  if (currentChain.length >= 2) {
    stats.chains.push(currentChain)
  }

  return stats
}

function main() {
  console.log('='.repeat(70))
  console.log('Item Spam Diagnosis - Detecting Chained Consumable Usage')
  console.log('='.repeat(70))
  console.log()

  const numRuns = 20
  const maxTurns = 5000

  console.log(`Running ${numRuns} games (${maxTurns} turns max each)...`)
  console.log()

  let totalItemUses = 0
  let totalChains = 0
  const allChains: { runNum: number; chain: ItemUse[] }[] = []
  const highHpHeals: ItemUse[] = []
  const highHpEscapes: ItemUse[] = []

  for (let i = 0; i < numRuns; i++) {
    const stats = runWithTracking('human', 'warrior', 'cautious', maxTurns)
    totalItemUses += stats.itemUses.length
    totalChains += stats.chains.length

    for (const chain of stats.chains) {
      allChains.push({ runNum: i + 1, chain })
    }

    // Track suspicious uses
    for (const use of stats.itemUses) {
      if (use.hpRatio > 0.6) {
        if (use.itemType === 'potion' && use.itemName.includes('Cure')) {
          highHpHeals.push(use)
        }
        if (use.itemType === 'scroll' && (use.itemName.includes('Phase') || use.itemName.includes('Teleport'))) {
          highHpEscapes.push(use)
        }
      }
    }

    process.stdout.write(`\rRun ${i + 1}/${numRuns}: T${stats.turnsPlayed} D${stats.maxDepth} | ${stats.itemUses.length} items, ${stats.chains.length} chains`)
  }
  console.log('\n')

  console.log('='.repeat(70))
  console.log('SUMMARY')
  console.log('-'.repeat(70))
  console.log(`Total item uses across ${numRuns} runs: ${totalItemUses}`)
  console.log(`Total chains (2+ items within 3 turns): ${totalChains}`)
  console.log(`High HP heals (>60%): ${highHpHeals.length}`)
  console.log(`High HP escapes (>60%): ${highHpEscapes.length}`)
  console.log()

  // Show all chains sorted by length
  allChains.sort((a, b) => b.chain.length - a.chain.length)

  if (allChains.length > 0) {
    console.log('='.repeat(70))
    console.log('CHAINS DETECTED (sorted by length)')
    console.log('-'.repeat(70))

    for (const { runNum, chain } of allChains.slice(0, 30)) {
      console.log()
      console.log(`Run ${runNum} - ${chain.length} items (T${chain[0]!.turn}-T${chain[chain.length-1]!.turn}):`)
      for (const u of chain) {
        const combatStr = u.inCombat ? 'COMBAT' : 'safe'
        const adjStr = `adj=${u.adjacentMonsters}`
        console.log(`  T${u.turn}: ${u.itemName.padEnd(20)} | HP ${(u.hpRatio*100).toFixed(0).padStart(3)}% | local:${u.localTier.padEnd(8)} imm:${u.immediateTier.padEnd(8)} | ${combatStr} ${adjStr} | pot=${u.potionsRemaining} scr=${u.scrollsRemaining}`)
      }
    }
  }

  if (highHpHeals.length > 0) {
    console.log()
    console.log('='.repeat(70))
    console.log('HIGH HP HEALS (>60% HP) - Suspicious')
    console.log('-'.repeat(70))
    for (const u of highHpHeals.slice(0, 20)) {
      const combatStr = u.inCombat ? 'COMBAT' : 'safe'
      console.log(`  T${u.turn}: ${u.itemName.padEnd(20)} | HP ${(u.hpRatio*100).toFixed(0).padStart(3)}% | local:${u.localTier.padEnd(8)} imm:${u.immediateTier.padEnd(8)} | ${combatStr} adj=${u.adjacentMonsters}`)
    }
  }

  if (highHpEscapes.length > 0) {
    console.log()
    console.log('='.repeat(70))
    console.log('HIGH HP ESCAPES (>60% HP) - Suspicious')
    console.log('-'.repeat(70))
    for (const u of highHpEscapes.slice(0, 20)) {
      const combatStr = u.inCombat ? 'COMBAT' : 'safe'
      console.log(`  T${u.turn}: ${u.itemName.padEnd(20)} | HP ${(u.hpRatio*100).toFixed(0).padStart(3)}% | local:${u.localTier.padEnd(8)} imm:${u.immediateTier.padEnd(8)} | ${combatStr} adj=${u.adjacentMonsters}`)
    }
  }

  console.log()
  console.log('='.repeat(70))
  console.log('Done!')
}

main()
