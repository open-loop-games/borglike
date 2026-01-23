/**
 * Run Completion Service
 *
 * Bridges the game engine (game-runner) to the Pinia stores (progression, runs).
 * Handles run end processing: calculating rewards, updating stats, and triggering unlocks.
 */

import type { RunResult } from '@/game/game-runner'
import type { RunStats, EquipmentSnapshot } from '@/types/progression'
import { useProgressionStore } from '@stores/progression'
import { saveRun } from '@stores/persistence'

// ============================================================================
// TYPES
// ============================================================================

/** Result returned after processing a completed run */
export interface RunCompletionResult {
  /** The RunStats record stored in history */
  runStats: RunStats
  /** Total essence earned this run (after all multipliers) */
  essenceEarned: number
  /** Whether this was a victory */
  isVictory: boolean
  /** New unlocks earned (if any) */
  newUnlocks: {
    races: string[]
    classes: string[]
  }
  /** New achievements earned this run */
  newAchievements: string[]
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Handle the completion of a game run
 *
 * Converts the game engine's RunResult into store-compatible data,
 * calculates rewards, updates progression, and returns a summary.
 *
 * @param result - The RunResult from game-runner
 * @returns RunCompletionResult with earned rewards and stats
 */
export async function handleRunCompletion(result: RunResult): Promise<RunCompletionResult> {
  const progression = useProgressionStore()
  const isVictory = result.reason === 'victory'

  // Convert RunResult to RunStats for storage
  const runStats = convertToRunStats(result, isVictory)

  // Calculate essence reward using the formula-based calculation
  const essenceEarned = progression.calculateEssenceReward(runStats, isVictory)
  runStats.essenceEarned = essenceEarned

  // Record the run in history (memory)
  progression.recordRun(runStats, isVictory)

  // Persist run to IndexedDB - AWAIT to ensure run is saved before progression
  try {
    await saveRun(runStats)
  } catch (err) {
    console.error('[RunCompletion] Failed to save run:', err)
  }

  // Record monster kills to bestiary
  if (result.game.stats.monsterKills) {
    progression.recordMonsterKills(result.game.stats.monsterKills)
  }

  // Record monster death (which monster killed the player)
  if (!isVictory && runStats.deathCause) {
    const killerMonster = extractKillerMonster(runStats.deathCause)
    if (killerMonster) {
      progression.recordMonsterDeath(killerMonster)
    }
  }

  // Add essence to currency
  progression.addEssence(essenceEarned)

  // Check for and apply any milestone unlocks
  const newUnlocks = checkMilestoneUnlocks(result, progression)

  // Check for and award any achievements
  const newAchievements = checkAchievements(result, progression)

  return {
    runStats,
    essenceEarned,
    isVictory,
    newUnlocks,
    newAchievements,
  }
}

// ============================================================================
// CONVERSION
// ============================================================================

/**
 * Convert a game-runner RunResult to a progression store RunStats
 */
function convertToRunStats(result: RunResult, isVictory: boolean): RunStats {
  const game = result.game
  const char = game.character

  // Extract equipment snapshot
  const equipment: EquipmentSnapshot[] = []
  for (const [slot, item] of Object.entries(char.equipment)) {
    if (item) {
      equipment.push({
        slot,
        name: item.artifact?.name ?? item.template.name,
        enchantment: item.enchantment,
        isArtifact: !!item.artifact,
      })
    }
  }

  // Extract inventory item names
  const inventory = char.inventory.map(
    (item) => item.artifact?.name ?? item.template.name
  )

  return {
    id: game.runId,
    startTime: game.stats.startTime,
    endTime: game.stats.endTime ?? Date.now(),
    race: char.raceId,
    class: char.classId,
    maxDepth: result.maxDepth,
    kills: result.kills,
    goldEarned: game.stats.goldCollected,
    xpEarned: char.xp,
    deathCause: isVictory ? undefined : getDeathCause(game),
    essenceEarned: 0, // Will be filled in after calculation
    // Extended fields
    equipment,
    inventory,
    turns: game.turn,
    personality: game.upgradeBonuses ? undefined : undefined, // Note: personality not stored on GameState
    seed: game.seed,
  }
}

/**
 * Determine the cause of death from game state
 */
function getDeathCause(game: RunResult['game']): string {
  // Check recent messages for death cause
  const recentMessages = game.messages.slice(-5)
  for (const msg of recentMessages) {
    // Check for "kills you" format (monster-ai sends as 'danger', combat sends as 'combat')
    if ((msg.type === 'danger' || msg.type === 'combat') && msg.text.includes('kills you')) {
      return msg.text
    }
  }

  // Default death message
  return `Slain on depth ${game.character.depth}`
}

/**
 * Extract the monster name that killed the player from a death message
 * Format: "The Monster Name kills you!" -> "Monster Name"
 */
function extractKillerMonster(deathCause: string): string | null {
  // Match "The X kills you!" pattern
  const killMatch = deathCause.match(/^The (.+) kills you!?$/i)
  if (killMatch && killMatch[1]) {
    return killMatch[1]
  }
  return null
}

// ============================================================================
// MILESTONE UNLOCKS
// ============================================================================

/** Milestone definitions for automatic unlocks */
interface Milestone {
  condition: (result: RunResult, progression: ReturnType<typeof useProgressionStore>) => boolean
  unlock: {
    type: 'race' | 'class'
    id: string
  }
}

const MILESTONES: Milestone[] = [
  // Reach depth 10 → unlock Ranger
  {
    condition: (r) => r.maxDepth >= 10,
    unlock: { type: 'class', id: 'Ranger' },
  },
  // Reach depth 15 → unlock Rogue
  {
    condition: (r) => r.maxDepth >= 15,
    unlock: { type: 'class', id: 'Rogue' },
  },
  // Reach depth 20 → unlock Mage
  {
    condition: (r) => r.maxDepth >= 20,
    unlock: { type: 'class', id: 'Mage' },
  },
  // Reach depth 25 → unlock Priest
  {
    condition: (r) => r.maxDepth >= 25,
    unlock: { type: 'class', id: 'Priest' },
  },
  // Reach depth 30 → unlock Paladin
  {
    condition: (r) => r.maxDepth >= 30,
    unlock: { type: 'class', id: 'Paladin' },
  },
  // Get 100 kills in one run → unlock Dwarf
  {
    condition: (r) => r.kills >= 100,
    unlock: { type: 'race', id: 'Dwarf' },
  },
  // Get 50 kills in one run → unlock Elf
  {
    condition: (r) => r.kills >= 50,
    unlock: { type: 'race', id: 'Elf' },
  },
  // Victory → unlock Half-Orc and Necromancer
  {
    condition: (r) => r.reason === 'victory',
    unlock: { type: 'race', id: 'Half-Orc' },
  },
  {
    condition: (r) => r.reason === 'victory',
    unlock: { type: 'class', id: 'Necromancer' },
  },
]

/**
 * Check and apply any milestone-based unlocks
 */
function checkMilestoneUnlocks(
  result: RunResult,
  progression: ReturnType<typeof useProgressionStore>
): { races: string[]; classes: string[] } {
  const newRaces: string[] = []
  const newClasses: string[] = []

  for (const milestone of MILESTONES) {
    if (milestone.condition(result, progression)) {
      const { type, id } = milestone.unlock

      if (type === 'race') {
        // Check if already unlocked
        if (!progression.unlocks.races.has(id)) {
          progression.unlockRace(id, 0) // Free unlock from milestone
          newRaces.push(id)
        }
      } else {
        if (!progression.unlocks.classes.has(id)) {
          progression.unlockClass(id, 0) // Free unlock from milestone
          newClasses.push(id)
        }
      }
    }
  }

  return { races: newRaces, classes: newClasses }
}

// ============================================================================
// ACHIEVEMENT CHECKING
// ============================================================================

/**
 * Check and award achievements based on the run result and global stats
 */
function checkAchievements(
  result: RunResult,
  progression: ReturnType<typeof useProgressionStore>
): string[] {
  const newAchievements: string[] = []

  // Helper to check and award
  const checkAndAward = (id: string): boolean => {
    if (progression.awardAchievement(id)) {
      newAchievements.push(id)
      return true
    }
    return false
  }

  // Progress achievements (per-run checks)
  if (result.kills >= 1) checkAndAward('first_blood')
  if (result.maxDepth >= 10) checkAndAward('depth_10')
  if (result.maxDepth >= 25) checkAndAward('depth_25')
  if (result.maxDepth >= 50) checkAndAward('depth_50')
  if (result.reason === 'victory') checkAndAward('first_victory')

  // Challenge achievements (single-run challenges)
  if (result.kills >= 50) checkAndAward('massacre')
  if (result.game.stats.goldCollected >= 1000) checkAndAward('treasure_hunter')

  // Speed demon: reach depth 10 in under 500 turns
  if (result.maxDepth >= 10 && result.game.turn < 500) {
    checkAndAward('speed_demon')
  }

  // Cumulative achievements (global stat checks)
  // Note: globalStats have already been updated by recordRun at this point

  // Monster kill tiers
  if (progression.globalStats.totalKills >= 100) checkAndAward('centurion')
  if (progression.globalStats.totalKills >= 1000) checkAndAward('slayer')
  if (progression.globalStats.totalKills >= 5000) checkAndAward('butcher')
  if (progression.globalStats.totalKills >= 25000) checkAndAward('annihilator')
  if (progression.globalStats.totalKills >= 100000) checkAndAward('genocide')

  // Gold tiers
  if (progression.globalStats.totalGold >= 10000) checkAndAward('millionaire')
  if (progression.globalStats.totalGold >= 100000) checkAndAward('tycoon')
  if (progression.globalStats.totalGold >= 500000) checkAndAward('mogul')
  if (progression.globalStats.totalGold >= 1000000) checkAndAward('dragons_hoard')

  // Death tiers
  if (progression.globalStats.totalDeaths >= 100) checkAndAward('frequent_dier')
  if (progression.globalStats.totalDeaths >= 500) checkAndAward('professional_corpse')
  if (progression.globalStats.totalDeaths >= 1000) checkAndAward('death_enthusiast')
  if (progression.globalStats.totalDeaths >= 5000) checkAndAward('immortally_mortal')

  // Run completion tiers
  if (progression.globalStats.totalRuns >= 50) checkAndAward('veteran')
  if (progression.globalStats.totalRuns >= 100) checkAndAward('seasoned')
  if (progression.globalStats.totalRuns >= 250) checkAndAward('grizzled')
  if (progression.globalStats.totalRuns >= 500) checkAndAward('eternal')
  if (progression.globalStats.totalRuns >= 1000) checkAndAward('timeless')

  return newAchievements
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate the total essence earned in all recorded runs
 */
export function getTotalRunEssence(): number {
  const progression = useProgressionStore()
  return progression.runHistory.reduce((sum, run) => sum + run.essenceEarned, 0)
}

/**
 * Get statistics summary from run history
 */
export function getRunStatsSummary(): {
  totalRuns: number
  totalVictories: number
  avgDepth: number
  avgKills: number
  bestDepth: number
  totalEssence: number
} {
  const progression = useProgressionStore()
  const history = progression.runHistory

  if (history.length === 0) {
    return {
      totalRuns: 0,
      totalVictories: 0,
      avgDepth: 0,
      avgKills: 0,
      bestDepth: 0,
      totalEssence: 0,
    }
  }

  const totalRuns = history.length
  const totalVictories = progression.totalVictories
  const avgDepth = history.reduce((sum, r) => sum + r.maxDepth, 0) / totalRuns
  const avgKills = history.reduce((sum, r) => sum + r.kills, 0) / totalRuns
  const bestDepth = Math.max(...history.map((r) => r.maxDepth))
  const totalEssence = history.reduce((sum, r) => sum + r.essenceEarned, 0)

  return {
    totalRuns,
    totalVictories,
    avgDepth: Math.round(avgDepth * 10) / 10,
    avgKills: Math.round(avgKills * 10) / 10,
    bestDepth,
    totalEssence,
  }
}
