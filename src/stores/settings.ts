import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export interface GameSettings {
  // Display
  showGrid: boolean
  showMinimap: boolean
  animationSpeed: 'slow' | 'normal' | 'fast' | 'instant'
  fontSize: 'small' | 'medium' | 'large'

  // Gameplay
  defaultPersonality: 'cautious' | 'aggressive' | 'greedy' | 'speedrunner'
  autoRestart: boolean
  turboByDefault: boolean

  // Audio
  soundEnabled: boolean
  musicEnabled: boolean
  volume: number

  // Advanced
  showFPS: boolean
  debugMode: boolean
}

/** Panel collapse states for the expanded run view */
export interface PanelStates {
  vitals: boolean
  stats: boolean
  combat: boolean
  resist: boolean
  status: boolean
  equipment: boolean
  inventory: boolean
}

const DEFAULT_PANEL_STATES: PanelStates = {
  vitals: true,
  stats: true,
  combat: true,
  resist: false,
  status: true,
  equipment: true,
  inventory: true,
}

const DEFAULT_SETTINGS: GameSettings = {
  showGrid: true,
  showMinimap: true,
  animationSpeed: 'normal',
  fontSize: 'medium',
  defaultPersonality: 'cautious',
  autoRestart: false,
  turboByDefault: true,
  soundEnabled: true,
  musicEnabled: false,
  volume: 0.7,
  showFPS: false,
  debugMode: false,
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<GameSettings>({ ...DEFAULT_SETTINGS })
  const panelStates = ref<PanelStates>({ ...DEFAULT_PANEL_STATES })

  // Load settings from localStorage on init
  function loadSettings() {
    try {
      const saved = localStorage.getItem('borglike-settings')
      if (saved) {
        const parsed = JSON.parse(saved)
        settings.value = { ...DEFAULT_SETTINGS, ...parsed }
      }
    } catch (e) {
      console.warn('Failed to load settings:', e)
    }
  }

  // Load panel states from localStorage
  function loadPanelStates() {
    try {
      const saved = localStorage.getItem('borglike-panel-states')
      if (saved) {
        const parsed = JSON.parse(saved)
        panelStates.value = { ...DEFAULT_PANEL_STATES, ...parsed }
      }
    } catch (e) {
      console.warn('Failed to load panel states:', e)
    }
  }

  // Save settings to localStorage
  function saveSettings() {
    try {
      localStorage.setItem('borglike-settings', JSON.stringify(settings.value))
    } catch (e) {
      console.warn('Failed to save settings:', e)
    }
  }

  // Save panel states to localStorage
  function savePanelStates() {
    try {
      localStorage.setItem('borglike-panel-states', JSON.stringify(panelStates.value))
    } catch (e) {
      console.warn('Failed to save panel states:', e)
    }
  }

  // Update a single setting (watcher handles persistence)
  function updateSetting<K extends keyof GameSettings>(key: K, value: GameSettings[K]) {
    settings.value[key] = value
  }

  // Toggle a panel's expanded/collapsed state
  function togglePanel(panel: keyof PanelStates) {
    panelStates.value[panel] = !panelStates.value[panel]
  }

  // Reset to defaults (watcher handles persistence)
  function resetSettings() {
    settings.value = { ...DEFAULT_SETTINGS }
  }

  // Watch for changes and auto-save (single source of truth for persistence)
  watch(settings, saveSettings, { deep: true })
  watch(panelStates, savePanelStates, { deep: true })

  // Load on init
  loadSettings()
  loadPanelStates()

  return {
    settings,
    panelStates,
    updateSetting,
    togglePanel,
    resetSettings,
    loadSettings,
    saveSettings,
  }
})
