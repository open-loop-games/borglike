/**
 * Blessed Renderer
 *
 * Single-focused-slot layout: top header, dungeon grid (80x32 + border) on the
 * left, stats sidebar on the right, message feed across the bottom. Subscribes
 * to the runs store via @vue/reactivity's watch — each store mutation triggers
 * a re-render of the affected widget plus screen.render().
 *
 * Step 5: rendering only. Step 6 will add input handling (pause / speed /
 * slot-cycle / start-run). For now Ctrl-C / q quits.
 *
 * Terminal sizing: needs ~112 cols × 45 rows minimum to show the full grid
 * + stats + feed without clipping. Blessed clips gracefully if smaller.
 */

import blessed from 'blessed'
import { watch } from 'vue'

import type { ActiveRun, GridCell } from '@/stores/runs'
import { useRunsStore } from '@/stores/runs'
import { useProgressionStore } from '@/stores/progression'
import { useFeedStore, type FeedEvent } from '@/stores/feed'

const GRID_COLS = 80
const GRID_ROWS = 32

export interface RendererHandle {
  /** Tear down screen + watchers. Called on shutdown. */
  destroy(): void
}

/**
 * Create the blessed screen, wire reactive subscriptions, return a handle.
 *
 * @param focusedSlot The slot whose run is rendered in the dungeon pane.
 *                    Step 6 will let this change at runtime.
 */
export function createRenderer(focusedSlot: number): RendererHandle {
  const runs = useRunsStore()
  const progression = useProgressionStore()
  const feed = useFeedStore()

  const screen = blessed.screen({
    smartCSR: true,
    title: 'Borglike',
    fullUnicode: true,
  })

  const header = blessed.box({
    parent: screen,
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    tags: true,
    style: { fg: 'white', bg: 'blue' },
  })

  const dungeon = blessed.box({
    parent: screen,
    top: 1,
    left: 0,
    width: GRID_COLS + 2,
    height: GRID_ROWS + 2,
    border: 'line',
    tags: true,
    style: { border: { fg: 'gray' } },
  })

  const stats = blessed.box({
    parent: screen,
    top: 1,
    left: GRID_COLS + 2,
    right: 0,
    height: GRID_ROWS + 2,
    border: 'line',
    tags: true,
    label: ' Stats ',
    style: { border: { fg: 'gray' } },
  })

  const feedBox = blessed.log({
    parent: screen,
    top: GRID_ROWS + 3,
    left: 0,
    right: 0,
    bottom: 0,
    border: 'line',
    tags: true,
    label: ' Feed ',
    scrollback: 200,
    mouse: true,
    keys: false,
    style: { border: { fg: 'gray' } },
  })

  // Quit keys — proper input handling comes in step 6.
  screen.key(['q', 'C-c'], () => {
    process.kill(process.pid, 'SIGINT')
  })

  // ---- subscriptions ------------------------------------------------------

  const stopHeader = watch(
    () => ({
      essence: progression.currency.essence,
      slotCount: progression.unlocks.runSlots,
      focused: runs.getRunBySlot(focusedSlot),
      states: runs.activeSlots.map((id) => (id ? runs.runs.get(id)?.state : null)),
    }),
    (state) => {
      header.setContent(renderHeader(state.essence, state.slotCount, focusedSlot, state.focused))
      screen.render()
    },
    { immediate: true, deep: true }
  )

  const stopDungeon = watch(
    () => {
      const run = runs.getRunBySlot(focusedSlot)
      return run?.grid
    },
    (grid) => {
      dungeon.setContent(grid ? renderGrid(grid) : '')
      screen.render()
    },
    { immediate: true, deep: true }
  )

  const stopStats = watch(
    () => runs.getRunBySlot(focusedSlot),
    (run) => {
      stats.setContent(renderStats(run))
      screen.render()
    },
    { immediate: true, deep: true }
  )

  // Track the newest event id we've already logged. Feed events are stored
  // newest-first (unshift) with a fixed cap (oldest popped), so watching
  // events.length silently misses updates once the cap is reached. Watching
  // the front-of-array id triggers reliably for every new event.
  let lastLoggedId = -1
  const stopFeed = watch(
    () => feed.events[0]?.id ?? -1,
    () => {
      const fresh: FeedEvent[] = []
      for (const event of feed.events) {
        if (event.id <= lastLoggedId) break
        fresh.unshift(event) // reverse so we log oldest-first
      }
      for (const event of fresh) {
        feedBox.log(renderFeedLine(event))
      }
      if (feed.events[0]) lastLoggedId = feed.events[0].id
    },
    { immediate: true }
  )

  screen.render()

  return {
    destroy() {
      stopHeader()
      stopDungeon()
      stopStats()
      stopFeed()
      screen.destroy()
    },
  }
}

// ===========================================================================
// HEADER
// ===========================================================================

function renderHeader(
  essence: number,
  slotCount: number,
  focusedSlot: number,
  focused: ActiveRun | undefined
): string {
  const left = ` Borglike `
  const slotPart = `Slot ${focusedSlot + 1}/${slotCount}`
  const runPart = focused
    ? `${focused.config.race} ${focused.config.class} (${focused.state})`
    : 'no run'
  const essencePart = `essence ${essence}`
  return `{bold}${left}{/bold} ${slotPart} • ${runPart} • ${essencePart}`
}

// ===========================================================================
// DUNGEON GRID
// ===========================================================================

/**
 * Convert the 80x32 cell grid into a blessed-tagged string. Groups adjacent
 * same-color cells into a single tag span to keep the resulting string small.
 */
function renderGrid(grid: GridCell[][]): string {
  const lines: string[] = []
  for (let y = 0; y < GRID_ROWS; y++) {
    const row = grid[y]
    if (!row) {
      lines.push('')
      continue
    }
    lines.push(renderRow(row))
  }
  return lines.join('\n')
}

function renderRow(row: GridCell[]): string {
  let out = ''
  let openColor = -1
  for (let x = 0; x < row.length; x++) {
    const cell = row[x]
    if (!cell) continue
    if (cell.color !== openColor) {
      if (openColor !== -1) out += '{/}'
      out += `{#${cell.color.toString(16).padStart(6, '0')}-fg}`
      openColor = cell.color
    }
    out += escapeBlessed(cell.char)
  }
  if (openColor !== -1) out += '{/}'
  return out
}

/**
 * Blessed treats `{` and `}` as tag delimiters. The game uses both as item
 * glyphs (gloves, boots). Escape via blessed's documented markers.
 */
function escapeBlessed(char: string): string {
  if (char === '{') return '{open}'
  if (char === '}') return '{close}'
  return char
}

// ===========================================================================
// STATS
// ===========================================================================

function renderStats(run: ActiveRun | undefined): string {
  if (!run) return ' (no run)'

  const lines: string[] = []
  lines.push('')
  lines.push(`  {bold}${run.config.race} ${run.config.class}{/bold}`)
  lines.push(`  Lvl ${run.level}  •  D${run.depth}`)
  lines.push('')
  lines.push(`  HP   ${run.hp}/${run.maxHp}`)
  lines.push(`  MP   ${run.mp}/${run.maxMp}`)
  lines.push(`  XP   ${run.xp}`)
  lines.push(`  Gold ${run.gold}`)
  lines.push('')
  lines.push(`  STR ${run.stats.str}  DEX ${run.stats.dex}  CON ${run.stats.con}`)
  lines.push(`  INT ${run.stats.int}  WIS ${run.stats.wis}`)
  lines.push('')
  lines.push(`  AC ${run.combat.armor}  EVA ${run.combat.evasion}`)
  lines.push(`  DMG ${run.combat.meleeDamage}  SPD ${run.combat.speed}`)
  lines.push('')
  lines.push(`  Turn  ${run.turns}`)
  lines.push(`  Kills ${run.kills}`)
  lines.push('')

  if (run.botGoal) {
    lines.push(`  {gray-fg}Goal:{/}`)
    lines.push(`  ${run.botGoal}`)
  }
  if (run.depthBlocker) {
    lines.push('')
    lines.push(`  {yellow-fg}Prep:{/}`)
    lines.push(`  ${run.depthBlocker}`)
  }

  return lines.join('\n')
}

// ===========================================================================
// FEED
// ===========================================================================

function renderFeedLine(event: FeedEvent): string {
  const color = FEED_COLOR[event.type] ?? 'white'
  const slotTag = `{gray-fg}[${event.slot + 1}]{/}`
  return `${slotTag} {${color}-fg}${event.message}{/}`
}

const FEED_COLOR: Record<FeedEvent['type'], string> = {
  info: 'white',
  combat: 'red',
  item: 'cyan',
  level: 'yellow',
  death: 'red',
  victory: 'green',
  good: 'green',
  danger: 'red',
}
