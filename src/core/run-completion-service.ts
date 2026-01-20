/**
 * Run Completion Service
 *
 * Bridges the game engine (game-runner) to the Pinia stores (progression, runs).
 * Handles run end processing: calculating rewards, updating stats, and triggering unlocks.
 */

import type { RunResult } from '@/game/game-runner'
import type { RunStats } from '@/types/progression'
import { useProgressionStore } from '@stores/progression'

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
export function handleRunCompletion(result: RunResult): RunCompletionResult {
  const progression = useProgressionStore()
  const isVictory = result.reason === 'victory'

  // Convert RunResult to RunStats for storage
  const runStats = convertToRunStats(result, isVictory)

  // Calculate essence reward using the formula-based calculation
  const essenceEarned = progression.calculateEssenceReward(runStats, isVictory)
  runStats.essenceEarned = essenceEarned

  // Record the run in history
  progression.recordRun(runStats, isVictory)

  // Add essence to currency
  progression.addEssence(essenceEarned)

  // Check for and apply any milestone unlocks
  const newUnlocks = checkMilestoneUnlocks(result, progression)

  return {
    runStats,
    essenceEarned,
    isVictory,
    newUnlocks,
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
  }
}

/**
 * Determine the cause of death from game state
 */
function getDeathCause(game: RunResult['game']): string {
  // Check recent messages for death cause
  const recentMessages = game.messages.slice(-5)
  for (const msg of recentMessages) {
    if (msg.type === 'danger' && msg.text.includes('killed')) {
      return msg.text
    }
  }

  // Default death message
  return `Slain on depth ${game.character.depth}`
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
