/**
 * Instance Manager
 *
 * Manages multiple concurrent game instances, connecting the game engine
 * to the UI stores.
 */

import { useRunsStore, type DisplayItem, type EquipSlot } from '@/stores/runs'
import { useProgressionStore } from '@/stores/progression'
import { useSettingsStore } from '@/stores/settings'
import {
  computeUpgradeBonuses,
  createGameRunner,
  getTile,
  type RunResult,
  type GameState,
  type BotPersonality,
  type Item,
} from '@/game'
import { handleRunCompletion } from '@/core/run-completion-service'
import type { RunConfig } from '@/types'

interface GameInstance {
  runId: string
  slot: number
  runner: ReturnType<typeof createGameRunner>
  intervalId: number | null
  tickRate: number
}

const instances = new Map<string, GameInstance>()

// Map race/class display names to IDs
const RACE_IDS: Record<string, string> = {
  Human: 'human',
  Elf: 'elf',
  Dwarf: 'dwarf',
  Hobbit: 'hobbit',
  Gnome: 'gnome',
  'Half-Elf': 'half_elf',
  'Half-Orc': 'half_orc',
  Dunadan: 'dunadan',
  'High-Elf': 'high_elf',
  Kobold: 'kobold',
  'Dark Elf': 'dark_elf',
  Troll: 'troll',
  Vampire: 'vampire',
  Spectre: 'spectre',
}

const CLASS_IDS: Record<string, string> = {
  Warrior: 'warrior',
  Mage: 'mage',
  Priest: 'priest',
  Rogue: 'rogue',
  Ranger: 'ranger',
  Paladin: 'paladin',
  Necromancer: 'necromancer',
  Monk: 'monk',
  Artificer: 'artificer',
  Bard: 'bard',
  Berserker: 'berserker',
}

// Item display character by type
const ITEM_CHARS: Record<string, string> = {
  weapon: ')',
  armor: '[',
  shield: ']',
  helm: '^',
  gloves: '{',
  boots: '}',
  ring: '=',
  amulet: '"',
  light: '*',
  potion: '!',
  scroll: '?',
}

// Item color by tier
const TIER_COLORS: Record<number, number> = {
  1: 0x94a3b8,  // gray (common)
  2: 0x22c55e,  // green (uncommon)
  3: 0x3b82f6,  // blue (rare)
  4: 0xa855f7,  // purple (epic)
}

// Artifact color
const ARTIFACT_COLOR = 0xf59e0b  // amber

/**
 * Convert a game Item to a DisplayItem for the UI
 */
function toDisplayItem(item: Item): DisplayItem {
  const isArtifact = item.artifact !== null
  return {
    id: item.id,
    name: item.artifact?.name ?? item.template.name,
    char: ITEM_CHARS[item.template.type] ?? '*',
    color: isArtifact ? ARTIFACT_COLOR : TIER_COLORS[item.template.tier] ?? 0x94a3b8,
    enchantment: item.enchantment,
    isArtifact,
    tier: item.template.tier,
  }
}

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
  const settings = useSettingsStore()
  const raceName = config?.race || availableRaces[Math.floor(Math.random() * availableRaces.length)] || 'Human'
  const className = config?.class || availableClasses[Math.floor(Math.random() * availableClasses.length)] || 'Warrior'
  const personality: BotPersonality = (config?.personality as BotPersonality) || settings.settings.defaultPersonality

  const runConfig: RunConfig = {
    race: raceName,
    class: className,
    personality,
  }

  // Create the run in the store
  const runId = runs.createRun(slot, runConfig)

  // Get upgrade bonuses
  const bonuses = computeUpgradeBonuses(progression.upgradeLevels)

  // Create the actual game runner
  const runner = createGameRunner({
    raceId: RACE_IDS[raceName] || 'human',
    classId: CLASS_IDS[className] || 'warrior',
    botPersonality: personality,
    upgradeBonuses: bonuses,
    maxTurns: 0, // Unlimited
  })

  // Create instance
  const instance: GameInstance = {
    runId,
    slot,
    runner,
    intervalId: null,
    tickRate: 100,
  }

  instances.set(runId, instance)

  // Initialize run state from game
  const game = runner.getState()
  updateRunFromGame(runId, game)
  renderGameToGrid(runId, game)

  // Mark as running
  const runData = runs.getRun(runId)
  if (runData) {
    runData.state = 'running'
  }

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
  if (instance?.runner) {
    instance.runner.stop()
  }
  instances.delete(runId)
}

/**
 * Kill a running game instance (awards essence like normal death)
 */
export function killRun(runId: string): void {
  const instance = instances.get(runId)
  if (!instance) return

  const runs = useRunsStore()
  const run = runs.getRun(runId)
  if (!run || run.state === 'dead') return

  // Stop the game loop
  if (instance.intervalId) {
    clearInterval(instance.intervalId)
    instance.intervalId = null
  }

  // Get the result and trigger normal end handling
  const result = instance.runner.getResult()
  handleGameEnd(runId, result, run.config, run.slot)
}

/**
 * Update run store stats from game state
 */
function updateRunFromGame(runId: string, game: GameState): void {
  const runs = useRunsStore()

  runs.handleEvent(runId, { type: 'hp', current: game.character.hp, max: game.character.maxHp })
  runs.handleEvent(runId, { type: 'mp', current: game.character.mp, max: game.character.maxMp })
  runs.handleEvent(runId, { type: 'depth', level: game.character.depth })
  runs.handleEvent(runId, { type: 'gold', total: game.character.gold })
  runs.handleEvent(runId, { type: 'xp', current: game.character.xp })
  runs.handleEvent(runId, { type: 'tick', turn: game.turn })

  // Update kills from stats
  const run = runs.getRun(runId)
  if (run) {
    run.kills = game.stats.kills

    // Sync level
    run.level = game.character.level

    // Sync equipment
    run.equipment = {}
    for (const [slot, item] of Object.entries(game.character.equipment)) {
      if (item) {
        run.equipment[slot as EquipSlot] = toDisplayItem(item)
      }
    }

    // Sync inventory
    run.inventory = game.character.inventory.map(toDisplayItem)
  }
}

// Viewport dimensions
const VIEWPORT_WIDTH = 80
const VIEWPORT_HEIGHT = 24

/**
 * Calculate viewport offset to center on player
 */
function calculateViewport(
  playerX: number,
  playerY: number,
  levelWidth: number,
  levelHeight: number
): { offsetX: number; offsetY: number } {
  // Center viewport on player
  let offsetX = playerX - Math.floor(VIEWPORT_WIDTH / 2)
  let offsetY = playerY - Math.floor(VIEWPORT_HEIGHT / 2)

  // Clamp to level bounds
  offsetX = Math.max(0, Math.min(offsetX, levelWidth - VIEWPORT_WIDTH))
  offsetY = Math.max(0, Math.min(offsetY, levelHeight - VIEWPORT_HEIGHT))

  // Handle small levels
  if (levelWidth <= VIEWPORT_WIDTH) offsetX = 0
  if (levelHeight <= VIEWPORT_HEIGHT) offsetY = 0

  return { offsetX, offsetY }
}

/**
 * Render game state to the grid
 */
function renderGameToGrid(runId: string, game: GameState): void {
  const runs = useRunsStore()
  const level = game.currentLevel
  const playerPos = game.character.position

  // Calculate viewport centered on player
  const { offsetX, offsetY } = calculateViewport(
    playerPos.x,
    playerPos.y,
    level.width,
    level.height
  )

  // Clear grid first
  runs.clearGrid(runId)

  // Render tiles (only explored ones, with visibility)
  for (let screenY = 0; screenY < VIEWPORT_HEIGHT; screenY++) {
    for (let screenX = 0; screenX < VIEWPORT_WIDTH; screenX++) {
      const worldX = screenX + offsetX
      const worldY = screenY + offsetY

      const tile = getTile(level, worldX, worldY)
      if (!tile) continue

      // Skip unexplored tiles
      if (!tile.explored) continue

      // Get character and color based on tile type and visibility
      let char = ' '
      let color = 0x64748b // dim gray

      switch (tile.type) {
        case 'wall':
          char = '#'
          color = tile.visible ? 0x94a3b8 : 0x475569
          break
        case 'floor':
          char = '.'
          color = tile.visible ? 0x64748b : 0x334155
          break
        case 'door_closed':
          char = '+'
          color = tile.visible ? 0xf59e0b : 0x92400e
          break
        case 'door_open':
          char = '/'
          color = tile.visible ? 0xf59e0b : 0x92400e
          break
        case 'stairs_down':
          char = '>'
          color = tile.visible ? 0x06b6d4 : 0x0e7490
          break
        case 'stairs_up':
          char = '<'
          color = tile.visible ? 0x06b6d4 : 0x0e7490
          break
      }

      runs.updateCell(runId, screenY, screenX, char, color)
    }
  }

  // Render fountains (only visible)
  for (const fountain of game.fountains.values()) {
    const tile = getTile(level, fountain.position.x, fountain.position.y)
    if (!tile?.visible) continue

    const screenX = fountain.position.x - offsetX
    const screenY = fountain.position.y - offsetY
    if (screenX < 0 || screenX >= VIEWPORT_WIDTH || screenY < 0 || screenY >= VIEWPORT_HEIGHT) continue

    const char = fountain.usesRemaining > 0 ? '≈' : '~'
    runs.updateCell(runId, screenY, screenX, char, fountain.template.color)
  }

  // Render altars (only visible)
  for (const altar of game.altars.values()) {
    const tile = getTile(level, altar.position.x, altar.position.y)
    if (!tile?.visible) continue

    const screenX = altar.position.x - offsetX
    const screenY = altar.position.y - offsetY
    if (screenX < 0 || screenX >= VIEWPORT_WIDTH || screenY < 0 || screenY >= VIEWPORT_HEIGHT) continue

    runs.updateCell(runId, screenY, screenX, '_', altar.template.color)
  }

  // Render merchants (only visible)
  for (const merchant of game.merchants) {
    const tile = getTile(level, merchant.position.x, merchant.position.y)
    if (!tile?.visible) continue

    const screenX = merchant.position.x - offsetX
    const screenY = merchant.position.y - offsetY
    if (screenX < 0 || screenX >= VIEWPORT_WIDTH || screenY < 0 || screenY >= VIEWPORT_HEIGHT) continue

    runs.updateCell(runId, screenY, screenX, 'P', 0xf59e0b) // amber
  }

  // Render revealed traps (only visible and not triggered)
  for (const trap of game.traps.values()) {
    if (!trap.revealed) continue
    if (trap.triggered) continue

    const tile = getTile(level, trap.position.x, trap.position.y)
    if (!tile?.visible) continue

    const screenX = trap.position.x - offsetX
    const screenY = trap.position.y - offsetY
    if (screenX < 0 || screenX >= VIEWPORT_WIDTH || screenY < 0 || screenY >= VIEWPORT_HEIGHT) continue

    runs.updateCell(runId, screenY, screenX, '^', trap.template.color)
  }

  // Render items (only visible)
  for (const item of game.items) {
    const tile = getTile(level, item.position.x, item.position.y)
    if (!tile?.visible) continue

    // Convert world to screen coordinates
    const screenX = item.position.x - offsetX
    const screenY = item.position.y - offsetY
    if (screenX < 0 || screenX >= VIEWPORT_WIDTH || screenY < 0 || screenY >= VIEWPORT_HEIGHT) continue

    // Use different symbols for item types
    let char = '*'
    let color = 0xf59e0b // amber

    // Gold items
    if (item.goldValue) {
      char = '$'
      color = 0xfbbf24 // amber/gold
    } else if (item.template.type === 'potion') {
      char = '!'
      color = 0x8b5cf6 // purple
    } else if (item.template.type === 'scroll') {
      char = '?'
      color = 0xffffff // white
    } else if (item.template.slot === 'weapon') {
      char = ')'
      color = 0x64748b // gray
    } else if (item.template.slot === 'body') {
      char = '['
      color = 0x22c55e // green
    }

    runs.updateCell(runId, screenY, screenX, char, color)
  }

  // Render monsters (only visible)
  for (const monster of game.monsters) {
    const tile = getTile(level, monster.position.x, monster.position.y)
    if (!tile?.visible) continue

    // Convert world to screen coordinates
    const screenX = monster.position.x - offsetX
    const screenY = monster.position.y - offsetY
    if (screenX < 0 || screenX >= VIEWPORT_WIDTH || screenY < 0 || screenY >= VIEWPORT_HEIGHT) continue

    // Use first letter of monster name
    const char = monster.template.name.charAt(0)
    // Color based on danger level (using minDepth as proxy for difficulty)
    let color = 0xef4444 // red
    if (monster.template.minDepth < game.character.depth) {
      color = 0xf97316 // orange - weaker monster
    } else if (monster.template.minDepth > game.character.depth + 5) {
      color = 0xdc2626 // dark red - dangerous monster
    }

    runs.updateCell(runId, screenY, screenX, char, color)
  }

  // Render player (convert world to screen coordinates)
  const playerScreenX = playerPos.x - offsetX
  const playerScreenY = playerPos.y - offsetY
  if (playerScreenX >= 0 && playerScreenX < VIEWPORT_WIDTH && playerScreenY >= 0 && playerScreenY < VIEWPORT_HEIGHT) {
    runs.updateCell(runId, playerScreenY, playerScreenX, '@', 0x22c55e)
    runs.setCursor(runId, playerScreenY, playerScreenX)
  }
}

/**
 * Start the game loop for a run
 */
function startGameLoop(runId: string): void {
  const instance = instances.get(runId)
  if (!instance) return

  const tick = () => {
    const runs = useRunsStore()
    const run = runs.getRun(runId)

    if (!run || run.state === 'dead') {
      stopRun(runId)
      return
    }

    // Check turbo mode for speed (apply turbo upgrade bonus)
    const progression = useProgressionStore()
    const bonuses = computeUpgradeBonuses(progression.upgradeLevels)
    const baseTurboTick = 20
    const turboTick = Math.max(5, Math.floor(baseTurboTick / (1 + bonuses.turboSpeedPercent / 100)))
    const newTickRate = run.turbo ? turboTick : 100
    if (instance.tickRate !== newTickRate) {
      instance.tickRate = newTickRate
      if (instance.intervalId) {
        clearInterval(instance.intervalId)
      }
      instance.intervalId = window.setInterval(tick, newTickRate) as unknown as number
      return
    }

    // Run one game step
    if (!instance.runner.isActive()) {
      // Game ended
      const result = instance.runner.getResult()
      handleGameEnd(runId, result, run.config, run.slot)
      return
    }

    // Process turn
    instance.runner.step()
    const game = instance.runner.getState()

    // Update UI
    updateRunFromGame(runId, game)
    renderGameToGrid(runId, game)
  }

  instance.intervalId = window.setInterval(tick, instance.tickRate) as unknown as number
}

/**
 * Handle game end
 */
async function handleGameEnd(runId: string, result: RunResult, _config: RunConfig, slot: number): Promise<void> {
  const runs = useRunsStore()

  // Mark run as dead
  runs.handleEvent(runId, { type: 'death' })

  // Use the run-completion-service to handle all run end logic
  // This includes: converting to RunStats, calculating essence, recording the run,
  // adding essence to currency, and checking milestone unlocks
  // AWAIT to ensure persistence completes before continuing
  const completion = await handleRunCompletion(result)

  // Store the completion result for the UI (RunSummary component)
  const run = runs.getRun(runId)
  if (run) {
    runs.setRunStats(runId, completion.runStats)
  }

  // Stop the instance
  stopRun(runId)

  // Check auto-restart (uses saved slot config)
  checkAutoRestart(slot)
}

/**
 * Check if auto-restart is enabled and start a new run if so
 */
function checkAutoRestart(slot: number): void {
  const progression = useProgressionStore()
  const settings = useSettingsStore()

  const bonuses = computeUpgradeBonuses(progression.upgradeLevels)
  if (!bonuses.hasAutoRestart) return
  if (!settings.settings.autoRestart) return

  // Load the saved slot config (includes race, class, personality, boosters)
  const slotConfig = progression.getSlotConfig(slot)

  setTimeout(() => {
    const runs = useRunsStore()
    const existingRun = runs.getRunBySlot(slot)
    if (existingRun && existingRun.state !== 'dead') return

    if (existingRun) {
      runs.removeRun(existingRun.id)
    }

    // Set active boosters from saved slot config
    progression.setActiveBooster(0, slotConfig.boosters[0])
    progression.setActiveBooster(1, slotConfig.boosters[1])

    startRun(slot, {
      race: slotConfig.race,
      class: slotConfig.class,
      personality: slotConfig.personality,
    })
  }, 1500)
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
