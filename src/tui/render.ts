/**
 * Blessed Renderer
 *
 * Hybrid layout: thumbnail strip across the top showing all four slots at a
 * glance, focused-slot dungeon + stats below, message feed under that, and a
 * keybinding legend always visible at the bottom.
 *
 *   Row 0..2    thumbnails (bordered, content row in the middle)
 *   Row 3..36   dungeon (left, fixed 80×32+border) + stats sidebar (right)
 *   Row 37..-2  feed (flexible — grows on taller terminals)
 *   Row -1      status bar (single line)
 *
 * Subscribes to the runs store, progression store, feed store via
 * @vue/reactivity's watch. Focused slot is a TUI-local ref (state.ts) so
 * cycling keybinds can mutate it; watchers re-derive against it.
 *
 * Input handling lives here too (it's tied to the screen instance), with
 * action targets dispatching to instance-manager / Pinia stores. The kill-
 * confirm flow uses a 2s timer plus a reactive flag that the status bar
 * watches to swap its hint legend.
 */

import blessed from 'blessed'
import { watch } from 'vue'

import type { ActiveRun, GridCell } from '@/stores/runs'
import { useRunsStore } from '@/stores/runs'
import { useProgressionStore } from '@/stores/progression'
import { useFeedStore, type FeedEvent } from '@/stores/feed'
import { useEngineStateStore } from '@/stores/engine-state'
import { startRun, killRun, togglePause } from '@/engine/instance-manager'

import { focusedSlot, helpVisible, killConfirmSlot, KILL_CONFIRM_WINDOW_MS } from './state'

const GRID_COLS = 80
const GRID_ROWS = 32
const THUMBNAIL_HEIGHT = 3 // border + 1 content + border
const FEED_BOTTOM_OFFSET = 1 // reserve a row for the status bar

export interface RendererHandle {
  /** Tear down screen + watchers. Called on shutdown. */
  destroy(): void
}

export function createRenderer(): RendererHandle {
  const runs = useRunsStore()
  const progression = useProgressionStore()
  const feed = useFeedStore()
  const engineState = useEngineStateStore()

  const screen = blessed.screen({
    smartCSR: true,
    title: 'Borglike',
    fullUnicode: true,
  })

  const thumbnails = blessed.box({
    parent: screen,
    top: 0,
    left: 0,
    right: 0,
    height: THUMBNAIL_HEIGHT,
    border: 'line',
    tags: true,
    style: { border: { fg: 'gray' } },
  })

  const dungeon = blessed.box({
    parent: screen,
    top: THUMBNAIL_HEIGHT,
    left: 0,
    width: GRID_COLS + 2,
    height: GRID_ROWS + 2,
    border: 'line',
    tags: true,
    style: { border: { fg: 'gray' } },
  })

  const stats = blessed.box({
    parent: screen,
    top: THUMBNAIL_HEIGHT,
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
    top: THUMBNAIL_HEIGHT + GRID_ROWS + 2,
    left: 0,
    right: 0,
    bottom: FEED_BOTTOM_OFFSET,
    border: 'line',
    tags: true,
    label: ' Feed ',
    scrollback: 200,
    mouse: true,
    keys: false,
    style: { border: { fg: 'gray' } },
  })

  const statusBar = blessed.box({
    parent: screen,
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    tags: true,
    // `inverse` swaps fg/bg using whatever the terminal's defaults are, so the
    // bar adapts to light/dark themes instead of being stuck with a fixed blue.
    style: { inverse: true },
  })

  const help = blessed.box({
    parent: screen,
    top: 'center',
    left: 'center',
    width: 50,
    height: 18,
    border: 'line',
    tags: true,
    hidden: true,
    label: ' Help ',
    style: { border: { fg: 'yellow' }, bg: 'black' },
    content: renderHelpContent(),
  })

  // ===========================================================================
  // SUBSCRIPTIONS
  // ===========================================================================

  const stopThumbnails = watch(
    () => {
      // Re-derive thumbnails on slot state, focus change, or run-state change.
      return {
        focus: focusedSlot.value,
        slotCount: progression.unlocks.runSlots,
        slots: runs.activeSlots.map((id) => {
          if (!id) return null
          const run = runs.runs.get(id)
          return run ? { state: run.state, depth: run.depth, hp: run.hp, maxHp: run.maxHp } : null
        }),
      }
    },
    (state) => {
      thumbnails.setContent(renderThumbnails(state.slots, state.focus, state.slotCount))
      screen.render()
    },
    { immediate: true, deep: true }
  )

  const stopDungeonLabel = watch(
    () => {
      const run = runs.getRunBySlot(focusedSlot.value)
      return {
        slot: focusedSlot.value,
        slotCount: progression.unlocks.runSlots,
        race: run?.config.race,
        cls: run?.config.class,
        state: run?.state,
        paused: engineState.isPaused,
        essence: progression.currency.essence,
      }
    },
    (s) => {
      const label = renderDungeonLabel(
        s.slot,
        s.slotCount,
        s.race,
        s.cls,
        s.state,
        s.paused,
        s.essence
      )
      dungeon.setLabel(label)
      screen.render()
    },
    { immediate: true, deep: true }
  )

  const stopDungeonGrid = watch(
    () => {
      const run = runs.getRunBySlot(focusedSlot.value)
      return { slot: focusedSlot.value, run, grid: run?.grid }
    },
    ({ slot, run, grid }) => {
      if (!run) {
        dungeon.setContent(renderEmptySlotPlaceholder(slot))
      } else {
        dungeon.setContent(grid ? renderGrid(grid) : '')
      }
      screen.render()
    },
    { immediate: true, deep: true }
  )

  const stopStats = watch(
    () => runs.getRunBySlot(focusedSlot.value),
    (run) => {
      stats.setContent(renderStats(run))
      screen.render()
    },
    { immediate: true, deep: true }
  )

  const stopStatusBar = watch(
    () => ({
      killPending: killConfirmSlot.value !== null,
      killSlot: killConfirmSlot.value,
    }),
    (s) => {
      statusBar.setContent(renderStatusBar(s.killPending, s.killSlot))
      screen.render()
    },
    { immediate: true }
  )

  const stopHelp = watch(helpVisible, (visible) => {
    if (visible) {
      help.show()
      help.setFront()
    } else {
      help.hide()
    }
    screen.render()
  })

  let lastLoggedId = -1
  const stopFeed = watch(
    () => feed.events[0]?.id ?? -1,
    () => {
      const fresh: FeedEvent[] = []
      for (const event of feed.events) {
        if (event.id <= lastLoggedId) break
        fresh.unshift(event)
      }
      for (const event of fresh) {
        feedBox.log(renderFeedLine(event))
      }
      if (feed.events[0]) lastLoggedId = feed.events[0].id
    },
    { immediate: true }
  )

  // ===========================================================================
  // INPUT
  // ===========================================================================

  let killConfirmTimer: ReturnType<typeof setTimeout> | null = null

  function clearKillConfirm(): void {
    if (killConfirmTimer) {
      clearTimeout(killConfirmTimer)
      killConfirmTimer = null
    }
    killConfirmSlot.value = null
  }

  function focusSlot(slot: number): void {
    if (slot < 0 || slot >= progression.unlocks.runSlots) return
    if (focusedSlot.value === slot) return
    focusedSlot.value = slot
    clearKillConfirm()
  }

  function cycleFocus(direction: 1 | -1): void {
    // Cycle only over slots that have an active (non-ended) run.
    const candidates: number[] = []
    for (let s = 0; s < progression.unlocks.runSlots; s++) {
      const run = runs.getRunBySlot(s)
      if (run && run.state === 'running') candidates.push(s)
    }
    if (candidates.length === 0) return

    const current = focusedSlot.value
    const currentIdx = candidates.indexOf(current)
    let nextIdx: number
    if (currentIdx === -1) {
      nextIdx = direction === 1 ? 0 : candidates.length - 1
    } else {
      nextIdx = (currentIdx + direction + candidates.length) % candidates.length
    }
    const next = candidates[nextIdx]
    if (next !== undefined) focusSlot(next)
  }

  function onTurboKey(): void {
    const run = runs.getRunBySlot(focusedSlot.value)
    if (run) runs.toggleTurbo(run.id)
    clearKillConfirm()
  }

  function onStartKey(): void {
    const existing = runs.getRunBySlot(focusedSlot.value)
    if (existing && existing.state === 'running') return
    try {
      startRun(focusedSlot.value)
    } catch (err) {
      // Slot locked or some other invariant. Surface via feed.
      console.error('[tui] startRun failed:', err)
    }
    clearKillConfirm()
  }

  function onKillKey(): void {
    const run = runs.getRunBySlot(focusedSlot.value)
    if (!run || run.state !== 'running') {
      clearKillConfirm()
      return
    }
    if (killConfirmSlot.value === focusedSlot.value) {
      // Second press within window — execute.
      clearKillConfirm()
      killRun(run.id)
      return
    }
    // First press — arm confirm.
    killConfirmSlot.value = focusedSlot.value
    if (killConfirmTimer) clearTimeout(killConfirmTimer)
    killConfirmTimer = setTimeout(() => {
      killConfirmSlot.value = null
      killConfirmTimer = null
    }, KILL_CONFIRM_WINDOW_MS)
  }

  function onPauseKey(): void {
    if (engineState.isCatchingUp) return
    togglePause()
    clearKillConfirm()
  }

  function onHelpKey(): void {
    helpVisible.value = !helpVisible.value
    clearKillConfirm()
  }

  function onEscapeKey(): void {
    if (helpVisible.value) {
      helpVisible.value = false
      return
    }
    if (killConfirmSlot.value !== null) {
      clearKillConfirm()
      return
    }
  }

  function onQuitKey(): void {
    process.kill(process.pid, 'SIGINT')
  }

  // While the help modal is open, every bound key (except ? and Escape, which
  // manage the modal directly) dismisses it without firing its underlying
  // action. Unbound keys do nothing — user uses ? or Esc to close.
  function gated(action: () => void): () => void {
    return () => {
      if (helpVisible.value) {
        helpVisible.value = false
        return
      }
      action()
    }
  }

  // Slot focus
  screen.key(
    ['1'],
    gated(() => focusSlot(0))
  )
  screen.key(
    ['2'],
    gated(() => focusSlot(1))
  )
  screen.key(
    ['3'],
    gated(() => focusSlot(2))
  )
  screen.key(
    ['4'],
    gated(() => focusSlot(3))
  )
  screen.key(
    ['tab'],
    gated(() => cycleFocus(1))
  )
  screen.key(
    ['S-tab'],
    gated(() => cycleFocus(-1))
  )

  // Run controls
  screen.key(['space'], gated(onPauseKey))
  screen.key(['t', 'T'], gated(onTurboKey))
  screen.key(['s', 'S'], gated(onStartKey))
  screen.key(['K'], gated(onKillKey)) // Shift+K

  // UI — these manage help / kill-confirm directly, no gating
  screen.key(['?'], onHelpKey)
  screen.key(['escape'], onEscapeKey)
  screen.key(['q', 'C-c'], onQuitKey)

  screen.render()

  return {
    destroy() {
      if (killConfirmTimer) clearTimeout(killConfirmTimer)
      stopThumbnails()
      stopDungeonLabel()
      stopDungeonGrid()
      stopStats()
      stopStatusBar()
      stopHelp()
      stopFeed()
      screen.destroy()
    },
  }
}

// ===========================================================================
// THUMBNAILS
// ===========================================================================

interface ThumbState {
  state: ActiveRun['state']
  depth: number
  hp: number
  maxHp: number
}

function renderThumbnails(
  slots: Array<ThumbState | null>,
  focusIdx: number,
  unlockedCount: number
): string {
  const parts: string[] = []
  for (let i = 0; i < 4; i++) {
    const focused = i === focusIdx
    const cell = renderThumbCell(i, slots[i] ?? null, i >= unlockedCount, focused)
    parts.push(cell)
  }
  return parts.join(' {gray-fg}│{/} ')
}

function renderThumbCell(
  slotIdx: number,
  state: ThumbState | null,
  locked: boolean,
  focused: boolean
): string {
  let body: string
  if (locked) {
    body = `[${slotIdx + 1}] {gray-fg}LOCKED{/}`
  } else if (!state) {
    body = `[${slotIdx + 1}] {gray-fg}empty{/}`
  } else {
    const hpPct = state.maxHp > 0 ? Math.round((state.hp / state.maxHp) * 100) : 0
    const color = stateColor(state.state)
    body = `[${slotIdx + 1}] {${color}-fg}${state.state}{/} D${state.depth} ${hpPct}%`
  }
  return focused ? `{bold}${body}{/bold}` : body
}

function stateColor(state: ActiveRun['state']): string {
  switch (state) {
    case 'running':
      return 'green'
    case 'dead':
      return 'red'
    case 'victory':
      return 'yellow'
    case 'starting':
      return 'cyan'
    default:
      return 'white'
  }
}

// ===========================================================================
// DUNGEON LABEL + GRID
// ===========================================================================

function renderDungeonLabel(
  slot: number,
  slotCount: number,
  race: string | undefined,
  cls: string | undefined,
  state: ActiveRun['state'] | undefined,
  paused: boolean,
  essence: number
): string {
  const identity = race && cls ? `${race} ${cls}` : 'no run'
  const stateStr = state ?? '—'
  const flags: string[] = []
  if (paused) flags.push('PAUSED')
  const flagStr = flags.length ? ` [${flags.join(' ')}]` : ''
  return ` Slot ${slot + 1}/${slotCount} • ${identity} • ${stateStr}${flagStr} • essence ${essence} `
}

function renderEmptySlotPlaceholder(slot: number): string {
  const lines: string[] = []
  for (let i = 0; i < GRID_ROWS; i++) lines.push('')
  const middle = Math.floor(GRID_ROWS / 2)
  const message = `Slot ${slot + 1} empty — press {bold}S{/bold} to start a run`
  lines[middle] = centerLine(message, GRID_COLS)
  return lines.join('\n')
}

function centerLine(content: string, width: number): string {
  // Strip blessed tags for width calc — they don't render as cells.
  const visible = content.replace(/\{[^}]+\}/g, '')
  const pad = Math.max(0, Math.floor((width - visible.length) / 2))
  return ' '.repeat(pad) + content
}

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

function escapeBlessed(char: string): string {
  if (char === '{') return '{open}'
  if (char === '}') return '{close}'
  return char
}

// ===========================================================================
// STATS
// ===========================================================================

function renderStats(run: ActiveRun | undefined): string {
  if (!run) return '\n  {gray-fg}(no run){/}'

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

  if (run.botGoal) {
    lines.push('')
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
// STATUS BAR
// ===========================================================================

const IDLE_HINTS =
  ' [Space]pause  [1-4/Tab]focus  [T]turbo  [S]start  [{bold}⇧K{/bold}]kill  [?]help  [q]quit'

function renderStatusBar(killPending: boolean, killSlot: number | null): string {
  if (killPending && killSlot !== null) {
    // High-contrast alert palette — overrides the bar's inverse style so the
    // confirm prompt is obviously a different mode.
    return ` {red-bg}{white-fg}{bold} ⇧K again to confirm kill of slot ${killSlot + 1} {/} [Esc cancels] `
  }
  return IDLE_HINTS
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

// ===========================================================================
// HELP
// ===========================================================================

function renderHelpContent(): string {
  const lines = [
    '',
    '  {bold}Slot focus{/bold}',
    '    {cyan-fg}1{/}-{cyan-fg}4{/}        focus slot directly',
    '    {cyan-fg}Tab{/}        cycle forward through active runs',
    '    {cyan-fg}⇧Tab{/}       cycle backward',
    '',
    '  {bold}Run control{/bold}',
    '    {cyan-fg}Space{/}      toggle pause (all runs)',
    '    {cyan-fg}T{/}          toggle turbo on focused run',
    '    {cyan-fg}S{/}          start new run in focused slot',
    '    {cyan-fg}⇧K{/}         kill focused run (tap twice within 2s)',
    '',
    '  {bold}UI{/bold}',
    '    {cyan-fg}?{/}          this help',
    '    {cyan-fg}Esc{/}        cancel modal / pending kill',
    '    {cyan-fg}q{/}, {cyan-fg}^C{/}     quit',
  ]
  return lines.join('\n')
}
