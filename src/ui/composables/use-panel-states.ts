/**
 * Panel States Composable
 *
 * Owns the expanded/collapsed state of stats panels in RunStatsAside.
 * Desktop-Vue UI concern — TUI shells have their own layout model.
 *
 * Singleton via module-level ref so multiple consumers share one state.
 * Persists to localStorage under 'borglike-panel-states'.
 */

import { ref, watch } from 'vue'

export interface PanelStates {
  vitals: boolean
  stats: boolean
  combat: boolean
  resist: boolean
  status: boolean
  equipment: boolean
  consumables: boolean
  inventory: boolean
}

const DEFAULT_PANEL_STATES: PanelStates = {
  vitals: true,
  stats: true,
  combat: true,
  resist: false,
  status: true,
  equipment: true,
  consumables: true,
  inventory: true,
}

const STORAGE_KEY = 'borglike-panel-states'

const panelStates = ref<PanelStates>({ ...DEFAULT_PANEL_STATES })

let initialized = false

function loadPanelStates(): void {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      panelStates.value = { ...DEFAULT_PANEL_STATES, ...parsed }
    }
  } catch (e) {
    console.warn('Failed to load panel states:', e)
  }
}

function savePanelStates(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(panelStates.value))
  } catch (e) {
    console.warn('Failed to save panel states:', e)
  }
}

function init(): void {
  if (initialized) return
  initialized = true
  loadPanelStates()
  watch(panelStates, savePanelStates, { deep: true })
}

export function usePanelStates() {
  init()

  function togglePanel(panel: keyof PanelStates): void {
    panelStates.value[panel] = !panelStates.value[panel]
  }

  return {
    panelStates,
    togglePanel,
  }
}
