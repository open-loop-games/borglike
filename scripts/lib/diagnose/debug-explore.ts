/**
 * Debug Explore Mode
 *
 * Debugging tool for investigating EXPLORE goal breakdown at specific turns.
 */

import type { BotPersonality } from '../../../src/game/types'

export interface DebugExploreConfig {
  seed?: number
  targetTurn?: number
  race?: string
  classId?: string
  personality?: BotPersonality
}

export async function runDebugExplore(config: DebugExploreConfig = {}): Promise<void> {
  const seed = config.seed ?? Date.now()
  const targetTurn = config.targetTurn ?? 1000
  const race = config.race ?? 'human'
  const classId = config.classId ?? 'warrior'
  const personality = config.personality ?? 'cautious'

  console.log(`\nDEBUG EXPLORE: seed=${seed} target=${targetTurn}\n`)

  // Import needed functions dynamically
  const { createGame, processTurn } = await import('../../../src/game/game-loop.js')
  const { runBotTick, createBotState } = await import('../../../src/game/bot/index.js')
  const { buildBotContext } = await import('../../../src/game/bot/context.js')
  const { getExploreGoal, getFrontierPositions } = await import(
    '../../../src/game/bot/exploration.js'
  )
  const { computeFlow, getFlowCost } = await import('../../../src/game/bot/flow.js')
  const { MAX_FLOW_COST } = await import('../../../src/game/bot/types.js')

  // Create and run game to target turn
  const game = createGame({
    seed,
    raceId: race as any,
    classId: classId as any,
  })

  let botState = createBotState()
  for (let turn = 0; turn < targetTurn; turn++) {
    const action = runBotTick(game, personality, botState)

    processTurn(game, action)

    if (!game.isRunning) {
      console.log(`Game ended at turn ${turn}`)
      break
    }
  }

  // Debug at target turn
  console.log('=== GAME STATE ===')
  console.log(`Position: (${game.character.position.x}, ${game.character.position.y})`)
  console.log(`Depth: ${game.character.depth}`)
  console.log(`HP: ${game.character.hp}/${game.character.maxHp}`)
  console.log(`Turn: ${game.turn}`)

  const context = buildBotContext(game, personality, botState)

  console.log('\n=== UNEXPLORED TILES (from context) ===')
  console.log(`unexploredTiles.length: ${context.unexploredTiles.length}`)
  if (context.unexploredTiles.length > 0) {
    console.log(
      'First 10 unexplored:',
      context.unexploredTiles
        .slice(0, 10)
        .map((p) => `(${p.x},${p.y})`)
        .join(', ')
    )
  }

  console.log('\n=== FRONTIERS (from getFrontierPositions) ===')
  const frontiers = getFrontierPositions(game)
  console.log(`frontiers.length: ${frontiers.length}`)
  if (frontiers.length > 0) {
    console.log(
      'First 10 frontiers:',
      frontiers
        .slice(0, 10)
        .map((p) => `(${p.x},${p.y})`)
        .join(', ')
    )
  }

  console.log('\n=== EXPLORE GOAL ===')
  const exploreGoal = getExploreGoal(context)
  if (exploreGoal) {
    console.log(`Goal type: ${exploreGoal.type}`)
    console.log(`Target: (${exploreGoal.target?.x}, ${exploreGoal.target?.y})`)
    console.log(`Reason: ${exploreGoal.reason}`)
  } else {
    console.log('NO EXPLORE GOAL RETURNED')
  }

  if (botState) {
    console.log('\n=== BOT STATE ===')
    console.log(`currentGoal: ${botState.currentGoal?.type ?? 'null'}`)
    if (botState.currentGoal?.target) {
      console.log(`  target: (${botState.currentGoal.target.x}, ${botState.currentGoal.target.y})`)
    }
    console.log(`blacklistedTargets.size: ${botState.blacklistedTargets?.size ?? 0}`)
    if (botState.blacklistedTargets && botState.blacklistedTargets.size > 0) {
      const blacklisted = Array.from(botState.blacklistedTargets.entries())
      console.log(
        'First 10 blacklisted:',
        blacklisted
          .slice(0, 10)
          .map(([key, turn]) => `${key} (expires:${turn})`)
          .join(', ')
      )
    }
  }

  // Check reachability of first 5 frontiers
  if (frontiers.length > 0) {
    console.log('\n=== REACHABILITY CHECK ===')
    const pos = game.character.position
    const sampleFrontiers = frontiers.slice(0, 5)

    for (const frontier of sampleFrontiers) {
      const flow = computeFlow(game.currentLevel, frontier)
      const cost = getFlowCost(flow, pos)
      const unreachable = cost >= MAX_FLOW_COST
      console.log(
        `  (${frontier.x},${frontier.y}): cost=${cost} ${unreachable ? '[UNREACHABLE]' : ''}`
      )
    }
  }
}
