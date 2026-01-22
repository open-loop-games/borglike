/**
 * Instance Manager
 *
 * Manages multiple concurrent game instances, connecting the game engine
 * to the UI stores.
 */

import { useRunsStore, type DisplayItem, type EquipSlot } from '@/stores/runs'
import { useProgressionStore } from '@/stores/progression'
import { useSettingsStore } from '@/stores/settings'
import { useFeedStore } from '@/stores/feed'
import {
  computeUpgradeBonuses,
  computeBoosterBonuses,
  createGameRunner,
  getTile,
  type RunResult,
  type GameState,
  type BotPersonality,
  type Item,
} from '@/game'
import { randomInt } from '@/game/rng'
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

// Track pending auto-restart timeouts by slot (to cancel on manual stop)
const autoRestartTimeouts = new Map<number, ReturnType<typeof setTimeout>>()

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
  Druid: 'druid',
  Blackguard: 'blackguard',
  Necromancer: 'necromancer',
  Berserker: 'berserker',
  Archmage: 'archmage',
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

// Monster colors (matching Angband color names to hex)
const MONSTER_COLORS: Record<string, number> = {
  white: 0xffffff,
  red: 0xef4444,
  green: 0x22c55e,
  blue: 0x3b82f6,
  yellow: 0xeab308,
  orange: 0xf97316,
  purple: 0x8b5cf6,
  violet: 0xa78bfa,
  umber: 0x92400e,
  lightUmber: 0xd97706,
  slate: 0x64748b,
  lightDark: 0x374151,
  lightRed: 0xf87171,
  lightGreen: 0x4ade80,
  lightBlue: 0x60a5fa,
  lightPurple: 0xc084fc,
  lightSlate: 0x94a3b8,
  black: 0x1f2937,
}

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
  const raceName = config?.race || availableRaces[randomInt(0, availableRaces.length - 1)] || 'Human'
  const className = config?.class || availableClasses[randomInt(0, availableClasses.length - 1)] || 'Warrior'
  const personality: BotPersonality = (config?.personality as BotPersonality) || settings.settings.defaultPersonality

  const runConfig: RunConfig = {
    race: raceName,
    class: className,
    personality,
  }

  // Create the run in the store
  const runId = runs.createRun(slot, runConfig)

  // Get upgrade bonuses and booster bonuses
  const bonuses = computeUpgradeBonuses(progression.upgradeLevels)
  const boosterBonuses = computeBoosterBonuses(progression.getActiveBoosterIds())

  // Get bestiary data for knowledge bonuses
  const bestiary = progression.bestiary

  // Get max depth ever for merchant scaling
  const maxDepthEver = progression.globalStats.maxDepthEver

  // Create the actual game runner
  const runner = createGameRunner({
    raceId: RACE_IDS[raceName] || 'human',
    classId: CLASS_IDS[className] || 'warrior',
    botPersonality: personality,
    upgradeBonuses: bonuses,
    boosterBonuses,
    bestiary,
    maxDepthEver,
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
  if (!instance) {
    instances.delete(runId)
    return
  }

  // Cancel any pending auto-restart timeout for this slot
  const pendingTimeout = autoRestartTimeouts.get(instance.slot)
  if (pendingTimeout) {
    clearTimeout(pendingTimeout)
    autoRestartTimeouts.delete(instance.slot)
  }

  if (instance.intervalId) {
    clearInterval(instance.intervalId)
    instance.intervalId = null
  }
  if (instance.runner) {
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

    // Sync core stats (STR, DEX, etc.)
    run.stats = {
      str: game.character.stats.str,
      int: game.character.stats.int,
      wis: game.character.stats.wis,
      dex: game.character.stats.dex,
      con: game.character.stats.con,
    }

    // Sync combat stats
    run.combat = {
      armor: game.character.combat.armor,
      accuracy: game.character.combat.accuracy,
      evasion: game.character.combat.evasion,
      meleeDamage: game.character.combat.meleeDamage,
      speed: game.character.combat.speed,
    }

    // Sync resistances (only non-zero values)
    run.resistances = {}
    for (const [type, value] of Object.entries(game.character.resistances)) {
      if (value !== 0) {
        run.resistances[type] = value
      }
    }

    // Sync status effects
    run.statusEffects = game.character.statusEffects.map(effect => ({
      type: effect.type,
      turnsRemaining: effect.turnsRemaining,
      value: effect.value,
    }))

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

// Grid cell type for local building
interface LocalGridCell {
  char: string
  color: number
}

// Create empty local grid (not reactive)
function createLocalGrid(): LocalGridCell[][] {
  const grid: LocalGridCell[][] = []
  for (let y = 0; y < VIEWPORT_HEIGHT; y++) {
    const row: LocalGridCell[] = []
    for (let x = 0; x < VIEWPORT_WIDTH; x++) {
      row.push({ char: ' ', color: 0xffffff })
    }
    grid.push(row)
  }
  return grid
}

// Set cell in local grid (bounds-checked)
function setLocalCell(grid: LocalGridCell[][], row: number, col: number, char: string, color: number): void {
  if (row < 0 || row >= VIEWPORT_HEIGHT || col < 0 || col >= VIEWPORT_WIDTH) return
  const rowArray = grid[row]
  if (rowArray) rowArray[col] = { char, color }
}

/**
 * Render a collection of entities to the grid with common visibility and bounds checks.
 * Returns null from getDisplay to skip rendering an entity.
 */
function renderEntities<T>(
  grid: LocalGridCell[][],
  entities: Iterable<T>,
  level: GameState['currentLevel'],
  offsetX: number,
  offsetY: number,
  getPosition: (entity: T) => { x: number; y: number },
  getDisplay: (entity: T) => { char: string; color: number } | null
): void {
  for (const entity of entities) {
    const pos = getPosition(entity)
    const tile = getTile(level, pos.x, pos.y)
    if (!tile?.visible) continue

    const screenX = pos.x - offsetX
    const screenY = pos.y - offsetY
    if (screenX < 0 || screenX >= VIEWPORT_WIDTH || screenY < 0 || screenY >= VIEWPORT_HEIGHT) continue

    const display = getDisplay(entity)
    if (!display) continue

    setLocalCell(grid, screenY, screenX, display.char, display.color)
  }
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

  // Build grid locally (not reactive - avoids 1920 individual store mutations)
  const grid = createLocalGrid()

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
        // Town-related tiles
        case 'portal':
          char = 'O'
          color = tile.visible ? 0xa855f7 : 0x7e22ce // purple
          break
        case 'dungeon_entrance':
          char = '>'
          color = tile.visible ? 0x06b6d4 : 0x0e7490 // cyan (like stairs)
          break
        case 'healer':
          char = '.'
          color = tile.visible ? 0x64748b : 0x334155 // floor (healer NPC rendered separately)
          break
      }

      setLocalCell(grid, screenY, screenX, char, color)
    }
  }

  // Render fountains
  renderEntities(grid, game.fountains.values(), level, offsetX, offsetY,
    f => f.position,
    f => ({ char: f.usesRemaining > 0 ? '≈' : '~', color: f.template.color })
  )

  // Render altars
  renderEntities(grid, game.altars.values(), level, offsetX, offsetY,
    a => a.position,
    a => ({ char: '_', color: a.template.color })
  )

  // Render merchants
  renderEntities(grid, game.merchants, level, offsetX, offsetY,
    m => m.position,
    () => ({ char: 'P', color: 0xf59e0b }) // amber
  )

  // Render healer NPC (wrap single entity in array)
  if (game.healer) {
    renderEntities(grid, [game.healer], level, offsetX, offsetY,
      h => h.position,
      () => ({ char: 'H', color: 0x22c55e }) // green
    )
  }

  // Render revealed traps (filter in getDisplay)
  renderEntities(grid, game.traps.values(), level, offsetX, offsetY,
    t => t.position,
    t => (!t.revealed || t.triggered) ? null : { char: '^', color: t.template.color }
  )

  // Render items
  renderEntities(grid, game.items, level, offsetX, offsetY,
    i => i.position,
    item => {
      if (item.goldValue) return { char: '$', color: 0xfbbf24 }
      if (item.template.type === 'potion') return { char: '!', color: 0x8b5cf6 }
      if (item.template.type === 'scroll') return { char: '?', color: 0xffffff }
      if (item.template.slot === 'weapon') return { char: ')', color: 0x64748b }
      if (item.template.slot === 'body') return { char: '[', color: 0x22c55e }
      return { char: '*', color: 0xf59e0b }
    }
  )

  // Render monsters
  renderEntities(grid, game.monsters, level, offsetX, offsetY,
    m => m.position,
    m => ({ char: m.template.char, color: MONSTER_COLORS[m.template.color] ?? 0xef4444 })
  )

  // Render player (convert world to screen coordinates)
  const playerScreenX = playerPos.x - offsetX
  const playerScreenY = playerPos.y - offsetY
  let cursorX = 0
  let cursorY = 0
  if (playerScreenX >= 0 && playerScreenX < VIEWPORT_WIDTH && playerScreenY >= 0 && playerScreenY < VIEWPORT_HEIGHT) {
    setLocalCell(grid, playerScreenY, playerScreenX, '@', 0x22c55e)
    cursorX = playerScreenX
    cursorY = playerScreenY
  }

  // Assign entire grid to store in one operation (triggers single reactive update)
  runs.setGrid(runId, grid, cursorX, cursorY)
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
    const baseTurboTick = 50
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

    // Process new messages for feed
    const feed = useFeedStore()
    feed.processMessages(runId, run.slot, game.messages)
  }

  instance.intervalId = window.setInterval(tick, instance.tickRate) as unknown as number
}

/**
 * Handle game end
 */
async function handleGameEnd(runId: string, result: RunResult, _config: RunConfig, slot: number): Promise<void> {
  const runs = useRunsStore()
  const feed = useFeedStore()

  // Mark run as dead
  runs.handleEvent(runId, { type: 'death' })

  // Clear feed tracking for this run
  feed.clearRunTracking(runId)

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

  // Cancel any existing timeout for this slot (prevents duplicates)
  const existingTimeout = autoRestartTimeouts.get(slot)
  if (existingTimeout) {
    clearTimeout(existingTimeout)
  }

  // Load the saved slot config (includes race, class, personality, boosters)
  const slotConfig = progression.getSlotConfig(slot)

  const timeoutId = setTimeout(() => {
    // Clean up tracking when timeout executes
    autoRestartTimeouts.delete(slot)

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

  // Track the timeout so it can be cancelled if needed
  autoRestartTimeouts.set(slot, timeoutId)
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
