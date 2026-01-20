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

const DEFAULT_SETTINGS: GameSettings = {
  showGrid: true,
  showMinimap: true,
  animationSpeed: 'normal',
  fontSize: 'medium',
  defaultPersonality: 'cautious',
  autoRestart: false,
  turboByDefault: false,
  soundEnabled: true,
  musicEnabled: false,
  volume: 0.7,
  showFPS: false,
  debugMode: false,
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<GameSettings>({ ...DEFAULT_SETTINGS })

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

  // Save settings to localStorage
  function saveSettings() {
    try {
      localStorage.setItem('borglike-settings', JSON.stringify(settings.value))
    } catch (e) {
      console.warn('Failed to save settings:', e)
    }
  }

  // Update a single setting (watcher handles persistence)
  function updateSetting<K extends keyof GameSettings>(key: K, value: GameSettings[K]) {
    settings.value[key] = value
  }

  // Reset to defaults (watcher handles persistence)
  function resetSettings() {
    settings.value = { ...DEFAULT_SETTINGS }
  }

  // Watch for changes and auto-save (single source of truth for persistence)
  watch(settings, saveSettings, { deep: true })

  // Load on init
  loadSettings()

  return {
    settings,
    updateSetting,
    resetSettings,
    loadSettings,
    saveSettings,
  }
})
