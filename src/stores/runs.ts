import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { RunConfig, AngbandEvent } from '../types'

export interface ActiveRun {
  id: string
  slot: number
  config: RunConfig
  state: 'starting' | 'running' | 'dead'
  turbo: boolean
  startTime: number

  // Live stats
  depth: number
  hp: number
  maxHp: number
  gold: number
  xp: number
  kills: number
  turns: number

  // Grid state (80x24)
  grid: GridCell[][]
  cursorX: number
  cursorY: number
}

export interface GridCell {
  char: string
  color: number
}

function createEmptyGrid(): GridCell[][] {
  return Array.from({ length: 24 }, () =>
    Array.from({ length: 80 }, () => ({ char: ' ', color: 0xffffff }))
  )
}

export const useRunsStore = defineStore('runs', () => {
  const runs = ref<Map<string, ActiveRun>>(new Map())
  const activeSlots = ref<(string | null)[]>([null, null, null, null])

  // Focus state: which slot is expanded to full view (null = grid view)
  const focusedSlot = ref<number | null>(null)

  const activeRuns = computed(() => Array.from(runs.value.values()))
  const runCount = computed(() => runs.value.size)
  const focusedRun = computed(() => {
    if (focusedSlot.value === null) return null
    return getRunBySlot(focusedSlot.value)
  })

  function createRun(slot: number, config: RunConfig): string {
    const id = `run-${Date.now()}-${slot}`

    const run: ActiveRun = {
      id,
      slot,
      config,
      state: 'starting',
      turbo: false,
      startTime: Date.now(),
      depth: 0,
      hp: 0,
      maxHp: 0,
      gold: 0,
      xp: 0,
      kills: 0,
      turns: 0,
      grid: createEmptyGrid(),
      cursorX: 0,
      cursorY: 0,
    }

    runs.value.set(id, run)
    activeSlots.value[slot] = id

    return id
  }

  function removeRun(id: string) {
    const run = runs.value.get(id)
    if (run) {
      activeSlots.value[run.slot] = null
      runs.value.delete(id)
    }
  }

  function getRun(id: string): ActiveRun | undefined {
    return runs.value.get(id)
  }

  function getRunBySlot(slot: number): ActiveRun | undefined {
    const id = activeSlots.value[slot]
    return id ? runs.value.get(id) : undefined
  }

  function handleEvent(runId: string, event: AngbandEvent) {
    const run = runs.value.get(runId)
    if (!run) return

    switch (event.type) {
      case 'depth':
        run.depth = event.level
        break
      case 'hp':
        run.hp = event.current
        run.maxHp = event.max
        break
      case 'gold':
        run.gold = event.total
        break
      case 'xp':
        run.xp = event.current
        break
      case 'kill':
        run.kills++
        break
      case 'tick':
        run.turns = event.turn
        break
      case 'death':
        run.state = 'dead'
        break
    }
  }

  function updateCell(runId: string, row: number, col: number, char: string, color: number) {
    const run = runs.value.get(runId)
    if (!run) return
    if (row < 0 || row >= 24 || col < 0 || col >= 80) return
    const gridRow = run.grid[row]
    if (gridRow) {
      gridRow[col] = { char, color }
    }
  }

  function setCursor(runId: string, row: number, col: number) {
    const run = runs.value.get(runId)
    if (!run) return
    run.cursorX = col
    run.cursorY = row
  }

  function clearGrid(runId: string) {
    const run = runs.value.get(runId)
    if (!run) return
    run.grid = createEmptyGrid()
  }

  // Focus management
  function setFocusedSlot(slot: number | null) {
    focusedSlot.value = slot
  }

  function toggleFocus(slot: number) {
    if (focusedSlot.value === slot) {
      focusedSlot.value = null
    } else {
      focusedSlot.value = slot
    }
  }

  function clearFocus() {
    focusedSlot.value = null
  }

  // Toggle turbo mode for a run
  function toggleTurbo(runId: string) {
    const run = runs.value.get(runId)
    if (run) {
      run.turbo = !run.turbo
    }
  }

  return {
    runs,
    activeSlots,
    activeRuns,
    runCount,
    focusedSlot,
    focusedRun,
    createRun,
    removeRun,
    getRun,
    getRunBySlot,
    handleEvent,
    updateCell,
    setCursor,
    clearGrid,
    setFocusedSlot,
    toggleFocus,
    clearFocus,
    toggleTurbo,
  }
})
