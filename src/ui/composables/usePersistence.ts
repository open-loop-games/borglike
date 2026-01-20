/**
 * Persistence Composable
 *
 * Integrates IndexedDB persistence with Pinia stores.
 * Handles auto-save, auto-load, and debounced persistence.
 */

import { watch, onMounted } from 'vue'
import { useProgressionStore } from '@/stores/progression'
import { useSettingsStore } from '@/stores/settings'
import {
  initDB,
  saveProgression,
  loadProgression,
  saveSettings,
  loadSettings,
  isIndexedDBAvailable,
  type ProgressionSaveData,
} from '@/core/persistence'

let initialized = false
let saveTimeout: number | null = null
const SAVE_DEBOUNCE_MS = 1000

/**
 * Initialize persistence and load saved data
 */
export async function initPersistence(): Promise<void> {
  if (initialized) return
  if (!isIndexedDBAvailable()) {
    console.warn('IndexedDB not available, persistence disabled')
    return
  }

  try {
    await initDB()
    await loadSavedData()
    setupAutoSave()
    initialized = true
    console.log('Persistence initialized')
  } catch (error) {
    console.error('Failed to initialize persistence:', error)
  }
}

/**
 * Load saved data into stores
 */
async function loadSavedData(): Promise<void> {
  const progression = useProgressionStore()
  const settings = useSettingsStore()

  // Load progression
  const savedProgression = await loadProgression()
  if (savedProgression) {
    applyProgressionData(progression, savedProgression)
    console.log('Progression data loaded')
  }

  // Load settings (already handled by settings store via localStorage,
  // but we could migrate to IndexedDB)
  const savedSettings = await loadSettings()
  if (savedSettings) {
    Object.assign(settings.settings, savedSettings)
    console.log('Settings data loaded')
  }
}

/**
 * Apply loaded progression data to the store
 */
function applyProgressionData(
  store: ReturnType<typeof useProgressionStore>,
  data: ProgressionSaveData
): void {
  // Currency
  store.currency.essence = data.currency.essence
  store.currency.artifacts = data.currency.artifacts

  // Unlocks (convert arrays back to Sets)
  store.unlocks.races = new Set(data.unlocks.races)
  store.unlocks.classes = new Set(data.unlocks.classes)
  store.unlocks.runSlots = data.unlocks.runSlots
  store.unlocks.upgrades = new Set(data.unlocks.upgrades)

  // Upgrade levels
  Object.assign(store.upgradeLevels, data.upgradeLevels)

  // Global stats
  Object.assign(store.globalStats, data.globalStats)

  // Prestige
  store.prestigeLevel = data.prestigeLevel
  store.lifetimeEssence = data.lifetimeEssence
  store.totalVictories = data.totalVictories
}

/**
 * Extract progression data for saving
 */
function extractProgressionData(
  store: ReturnType<typeof useProgressionStore>
): ProgressionSaveData {
  return {
    currency: {
      essence: store.currency.essence,
      artifacts: store.currency.artifacts,
    },
    unlocks: {
      races: Array.from(store.unlocks.races),
      classes: Array.from(store.unlocks.classes),
      runSlots: store.unlocks.runSlots,
      upgrades: Array.from(store.unlocks.upgrades),
    },
    upgradeLevels: { ...store.upgradeLevels },
    globalStats: { ...store.globalStats },
    prestigeLevel: store.prestigeLevel,
    lifetimeEssence: store.lifetimeEssence,
    totalVictories: store.totalVictories,
  }
}

/**
 * Set up automatic saving on state changes
 */
function setupAutoSave(): void {
  const progression = useProgressionStore()
  const settings = useSettingsStore()

  // Watch progression changes
  watch(
    () => ({
      currency: progression.currency,
      unlocks: progression.unlocks,
      upgradeLevels: progression.upgradeLevels,
      globalStats: progression.globalStats,
      prestigeLevel: progression.prestigeLevel,
      lifetimeEssence: progression.lifetimeEssence,
    }),
    () => {
      debouncedSave()
    },
    { deep: true }
  )

  // Watch settings changes
  watch(
    () => settings.settings,
    async () => {
      try {
        await saveSettings(settings.settings)
      } catch (error) {
        console.error('Failed to save settings:', error)
      }
    },
    { deep: true }
  )
}

/**
 * Debounced save function
 */
function debouncedSave(): void {
  if (saveTimeout) {
    clearTimeout(saveTimeout)
  }

  saveTimeout = window.setTimeout(async () => {
    try {
      const progression = useProgressionStore()
      const data = extractProgressionData(progression)
      await saveProgression(data)
      console.log('Progress auto-saved')
    } catch (error) {
      console.error('Failed to auto-save:', error)
    }
  }, SAVE_DEBOUNCE_MS)
}

/**
 * Force immediate save (for critical moments like prestige)
 */
export async function forceSave(): Promise<void> {
  if (saveTimeout) {
    clearTimeout(saveTimeout)
    saveTimeout = null
  }

  try {
    const progression = useProgressionStore()
    const settings = useSettingsStore()

    await Promise.all([
      saveProgression(extractProgressionData(progression)),
      saveSettings(settings.settings),
    ])
    console.log('Progress force-saved')
  } catch (error) {
    console.error('Failed to force-save:', error)
  }
}

/**
 * Composable for components that need persistence
 */
export function usePersistence() {
  onMounted(() => {
    initPersistence()
  })

  return {
    forceSave,
    initialized: () => initialized,
  }
}
