/**
 * Instance Manager
 *
 * Manages multiple concurrent game instances, connecting the game engine
 * to the UI stores.
 */

import { useRunsStore } from '@/stores/runs'
import { useProgressionStore } from '@/stores/progression'
import type { RunConfig } from '@/types'

interface GameInstance {
  runId: string
  slot: number
  intervalId: number | null
  tickRate: number
}

const instances = new Map<string, GameInstance>()

/**
 * Start a new run in the given slot
 */
export function startRun(slot: number, config?: Partial<RunConfig>): string {
  const runs = useRunsStore()
  const progression = useProgressionStore()

  // Check if slot is available
  if (slot >= progression.maxRunSlots) {
    throw new Error(`Slot ${slot} is locked`)
  }

  // Check if slot already has a run
  const existingRun = runs.getRunBySlot(slot)
  if (existingRun && existingRun.state !== 'dead') {
    throw new Error(`Slot ${slot} already has an active run`)
  }

  // Remove dead run if exists
  if (existingRun) {
    runs.removeRun(existingRun.id)
  }

  // Get available races/classes from progression
  const availableRaces = progression.availableRaces
  const availableClasses = progression.availableClasses

  // Create run config with defaults
  const runConfig: RunConfig = {
    race:
      config?.race || availableRaces[Math.floor(Math.random() * availableRaces.length)] || 'Human',
    class:
      config?.class ||
      availableClasses[Math.floor(Math.random() * availableClasses.length)] ||
      'Warrior',
    personality: config?.personality || 'cautious',
  }

  // Create the run in the store
  const runId = runs.createRun(slot, runConfig)

  // Start the game instance
  const instance: GameInstance = {
    runId,
    slot,
    intervalId: null,
    tickRate: 100, // ms between ticks
  }

  instances.set(runId, instance)

  // Initialize run state
  initializeRun(runId)

  // Start the game loop
  startGameLoop(runId)

  return runId
}

/**
 * Stop a running game instance
 */
export function stopRun(runId: string): void {
  const instance = instances.get(runId)
  if (instance?.intervalId) {
    clearInterval(instance.intervalId)
    instance.intervalId = null
  }
  instances.delete(runId)
}

/**
 * Initialize a new run with starting state
 */
function initializeRun(runId: string): void {
  const runs = useRunsStore()
  const run = runs.getRun(runId)
  if (!run) return

  // Set initial stats based on race/class
  // This is a simplified version - real implementation would use game engine
  runs.handleEvent(runId, { type: 'hp', current: 20, max: 20 })
  runs.handleEvent(runId, { type: 'depth', level: 1 })
  runs.handleEvent(runId, { type: 'gold', total: 0 })
  runs.handleEvent(runId, { type: 'xp', current: 0 })

  // Mark as running
  const runData = runs.getRun(runId)
  if (runData) {
    runData.state = 'running'
  }

  // Generate initial dungeon view
  generateDungeonView(runId)
}

/**
 * Generate a simple dungeon view for the run
 */
function generateDungeonView(runId: string): void {
  const runs = useRunsStore()

  // Clear the grid
  runs.clearGrid(runId)

  // Generate a simple room
  const roomWidth = 15
  const roomHeight = 10
  const startX = 32
  const startY = 7

  // Floor
  for (let y = startY; y < startY + roomHeight; y++) {
    for (let x = startX; x < startX + roomWidth; x++) {
      runs.updateCell(runId, y, x, '.', 0x64748b)
    }
  }

  // Walls
  for (let x = startX - 1; x <= startX + roomWidth; x++) {
    runs.updateCell(runId, startY - 1, x, '#', 0x94a3b8)
    runs.updateCell(runId, startY + roomHeight, x, '#', 0x94a3b8)
  }
  for (let y = startY - 1; y <= startY + roomHeight; y++) {
    runs.updateCell(runId, y, startX - 1, '#', 0x94a3b8)
    runs.updateCell(runId, y, startX + roomWidth, '#', 0x94a3b8)
  }

  // Stairs down
  runs.updateCell(runId, startY + roomHeight - 2, startX + roomWidth - 2, '>', 0x06b6d4)

  // Player start position
  const playerX = startX + 3
  const playerY = startY + 3
  runs.updateCell(runId, playerY, playerX, '@', 0x22c55e)
  runs.setCursor(runId, playerY, playerX)
}

/**
 * Start the game loop for a run
 */
function startGameLoop(runId: string): void {
  const instance = instances.get(runId)
  if (!instance) return

  instance.intervalId = window.setInterval(() => {
    const runs = useRunsStore()
    const run = runs.getRun(runId)

    if (!run || run.state === 'dead') {
      stopRun(runId)
      return
    }

    // Check turbo mode for speed
    const tickRate = run.turbo ? 20 : 100
    if (instance.tickRate !== tickRate) {
      instance.tickRate = tickRate
      clearInterval(instance.intervalId!)
      instance.intervalId = window.setInterval(() => gameLoopTick(runId), tickRate)
      return
    }

    gameLoopTick(runId)
  }, instance.tickRate) as unknown as number
}

const turnCounters = new Map<string, number>()
const playerPositions = new Map<string, { x: number; y: number }>()

function gameLoopTick(runId: string): void {
  const runs = useRunsStore()
  const run = runs.getRun(runId)

  if (!run || run.state === 'dead') {
    stopRun(runId)
    return
  }

  // Initialize turn counter
  if (!turnCounters.has(runId)) {
    turnCounters.set(runId, 0)
    playerPositions.set(runId, { x: 35, y: 10 })
  }

  const turn = turnCounters.get(runId)! + 1
  turnCounters.set(runId, turn)

  const pos = playerPositions.get(runId)!

  // Emit tick event
  runs.handleEvent(runId, { type: 'tick', turn })

  // Simulate movement
  const directions = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
    { dx: 1, dy: 1 },
    { dx: -1, dy: -1 },
  ]

  const dir = directions[Math.floor(Math.random() * directions.length)]!
  const newX = Math.max(32, Math.min(46, pos.x + dir.dx))
  const newY = Math.max(7, Math.min(16, pos.y + dir.dy))

  // Clear old position
  runs.updateCell(runId, pos.y, pos.x, '.', 0x64748b)

  // Update position
  pos.x = newX
  pos.y = newY

  // Draw player
  runs.updateCell(runId, pos.y, pos.x, '@', 0x22c55e)
  runs.setCursor(runId, pos.y, pos.x)

  // Random events
  if (Math.random() < 0.05) {
    // Gold pickup
    const goldAmount = Math.floor(Math.random() * 10) + 1
    runs.handleEvent(runId, { type: 'gold', total: run.gold + goldAmount })
  }

  if (Math.random() < 0.02) {
    // Kill a monster
    runs.handleEvent(runId, { type: 'kill' })
    runs.handleEvent(runId, { type: 'xp', current: run.xp + 10 })
  }

  if (Math.random() < 0.03) {
    // Take damage
    const damage = Math.floor(Math.random() * 3) + 1
    const newHp = Math.max(0, run.hp - damage)
    runs.handleEvent(runId, { type: 'hp', current: newHp, max: run.maxHp })

    // Check for death
    if (newHp <= 0) {
      runs.handleEvent(runId, { type: 'death' })
      recordRunEnd(runId)
      stopRun(runId)
      return
    }
  }

  if (Math.random() < 0.005) {
    // Heal
    const heal = Math.floor(Math.random() * 3) + 1
    const newHp = Math.min(run.maxHp, run.hp + heal)
    runs.handleEvent(runId, { type: 'hp', current: newHp, max: run.maxHp })
  }

  // Descend every ~200 turns
  if (turn % 200 === 0 && turn > 0) {
    const newDepth = run.depth + 1
    runs.handleEvent(runId, { type: 'depth', level: newDepth })

    // Increase max HP on depth
    const newMaxHp = run.maxHp + 5
    runs.handleEvent(runId, { type: 'hp', current: Math.min(run.hp + 10, newMaxHp), max: newMaxHp })
  }
}

/**
 * Record run end statistics
 */
function recordRunEnd(runId: string): void {
  const runs = useRunsStore()
  const progression = useProgressionStore()

  const run = runs.getRun(runId)
  if (!run) return

  // Calculate essence earned
  const stats = {
    id: runId,
    startTime: run.startTime,
    endTime: Date.now(),
    race: run.config.race,
    class: run.config.class,
    maxDepth: run.depth,
    kills: run.kills,
    goldEarned: run.gold,
    xpEarned: run.xp,
    deathCause: 'combat',
    essenceEarned: 0,
  }

  const essenceEarned = progression.calculateEssenceReward(stats, false)
  stats.essenceEarned = essenceEarned

  // Record the run
  progression.recordRun(stats, false)

  // Award essence
  progression.addEssence(essenceEarned)

  // Cleanup
  turnCounters.delete(runId)
  playerPositions.delete(runId)
}

/**
 * Get all active instances
 */
export function getActiveInstances(): string[] {
  return Array.from(instances.keys())
}

/**
 * Check if a slot has an active instance
 */
export function isSlotActive(slot: number): boolean {
  const runs = useRunsStore()
  const run = runs.getRunBySlot(slot)
  return run !== undefined && run.state !== 'dead'
}
