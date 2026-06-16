import { defineStore } from 'pinia'
import { ref } from 'vue'

/** Feed verbosity levels for filtering messages */
export type FeedVerbosity = 'minimal' | 'normal' | 'verbose' | 'all'

export type FontFamily =
  | 'jetbrains-mono'
  | 'fira-code'
  | 'source-code-pro'
  | 'ibm-plex-mono'
  | 'inconsolata'
  | 'roboto-mono'
  | 'space-mono'
  | 'system'

export interface FontOption {
  id: FontFamily
  label: string
  css: string
  googleFamily?: string
}

export const FONT_OPTIONS: FontOption[] = [
  { id: 'jetbrains-mono', label: 'JetBrains Mono', css: "'JetBrains Mono', monospace" },
  { id: 'fira-code', label: 'Fira Code', css: "'Fira Code', monospace", googleFamily: 'Fira+Code' },
  {
    id: 'source-code-pro',
    label: 'Source Code Pro',
    css: "'Source Code Pro', monospace",
    googleFamily: 'Source+Code+Pro',
  },
  {
    id: 'ibm-plex-mono',
    label: 'IBM Plex Mono',
    css: "'IBM Plex Mono', monospace",
    googleFamily: 'IBM+Plex+Mono',
  },
  {
    id: 'inconsolata',
    label: 'Inconsolata',
    css: "'Inconsolata', monospace",
    googleFamily: 'Inconsolata',
  },
  {
    id: 'roboto-mono',
    label: 'Roboto Mono',
    css: "'Roboto Mono', monospace",
    googleFamily: 'Roboto+Mono',
  },
  {
    id: 'space-mono',
    label: 'Space Mono',
    css: "'Space Mono', monospace",
    googleFamily: 'Space+Mono',
  },
  { id: 'system', label: 'System Mono', css: 'monospace' },
]

export type ThemeId =
  // High contrast
  | 'high-contrast'
  | 'green-phosphor'
  | 'amber-crt'
  // Mid contrast
  | 'dark-indigo'
  | 'crimson'
  | 'gruvbox-dark'
  // Low contrast
  | 'tokyo-night'
  | 'nord'
  | 'rose-pine'

export interface ThemeOption {
  id: ThemeId
  label: string
}

// Roster grouped by contrast tier (3 high / 3 mid / 3 low). Order is the
// surfaced order in the settings dropdown.
export const THEME_OPTIONS: ThemeOption[] = [
  { id: 'high-contrast', label: 'High Contrast' },
  { id: 'green-phosphor', label: 'Green Phosphor' },
  { id: 'amber-crt', label: 'Amber CRT' },
  { id: 'dark-indigo', label: 'Dark Indigo' },
  { id: 'crimson', label: 'Crimson' },
  { id: 'gruvbox-dark', label: 'Gruvbox Dark' },
  { id: 'tokyo-night', label: 'Tokyo Night' },
  { id: 'nord', label: 'Nord' },
  { id: 'rose-pine', label: 'Rosé Pine' },
]

export interface GameSettings {
  // Display
  showGrid: boolean
  showMinimap: boolean
  animationSpeed: 'slow' | 'normal' | 'fast' | 'instant'
  fontSize: 'small' | 'medium' | 'large'
  fontFamily: FontFamily
  theme: ThemeId

  // Gameplay
  defaultPersonality: 'cautious' | 'aggressive' | 'greedy' | 'speedrunner'
  autoRestart: boolean
  pauseOnVictory: boolean
  turboByDefault: boolean

  // Feed
  feedVerbosity: FeedVerbosity
  feedShowTimestamps: boolean

  // Audio
  soundEnabled: boolean
  musicEnabled: boolean
  volume: number

  // Advanced
  showFPS: boolean
  cheatMode: boolean
}

const DEFAULT_SETTINGS: GameSettings = {
  showGrid: true,
  showMinimap: true,
  animationSpeed: 'normal',
  fontSize: 'medium',
  fontFamily: 'jetbrains-mono',
  theme: 'dark-indigo',
  defaultPersonality: 'cautious',
  autoRestart: false,
  pauseOnVictory: true,
  turboByDefault: true,
  feedVerbosity: 'normal',
  feedShowTimestamps: false,
  soundEnabled: true,
  musicEnabled: false,
  volume: 0.7,
  showFPS: false,
  cheatMode: false,
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<GameSettings>({ ...DEFAULT_SETTINGS })

  function updateSetting<K extends keyof GameSettings>(key: K, value: GameSettings[K]) {
    settings.value[key] = value
  }

  function resetSettings() {
    settings.value = { ...DEFAULT_SETTINGS }
  }

  /**
   * Patch the store with externally-loaded settings. Called by the persistence
   * layer during init; merges over defaults so missing keys (added in newer
   * versions) fall back to default rather than undefined.
   */
  function applyLoadedSettings(loaded: Partial<GameSettings>) {
    settings.value = { ...DEFAULT_SETTINGS, ...loaded }
    // A theme id saved before the roster was trimmed would dangle; coerce
    // unknown ids back to the default rather than render the bare :root fallback
    // while the dropdown shows a stale selection.
    if (!THEME_OPTIONS.some((t) => t.id === settings.value.theme)) {
      settings.value.theme = DEFAULT_SETTINGS.theme
    }
  }

  return {
    settings,
    updateSetting,
    resetSettings,
    applyLoadedSettings,
  }
})
