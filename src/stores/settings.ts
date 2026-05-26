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
  | 'tokyo-night'
  | 'dark-indigo'
  | 'catppuccin-mocha'
  | 'dracula'
  | 'nord'
  | 'solarized-dark'
  | 'gruvbox-dark'
  | 'rose-pine'
  | 'forest'
  | 'cherry'
  | 'amber-crt'
  | 'high-contrast'

export interface ThemeOption {
  id: ThemeId
  label: string
}

export const THEME_OPTIONS: ThemeOption[] = [
  { id: 'tokyo-night', label: 'Tokyo Night' },
  { id: 'dark-indigo', label: 'Dark Indigo' },
  { id: 'catppuccin-mocha', label: 'Catppuccin Mocha' },
  { id: 'dracula', label: 'Dracula' },
  { id: 'nord', label: 'Nord' },
  { id: 'solarized-dark', label: 'Solarized Dark' },
  { id: 'gruvbox-dark', label: 'Gruvbox Dark' },
  { id: 'rose-pine', label: 'Rosé Pine' },
  { id: 'forest', label: 'Forest' },
  { id: 'cherry', label: 'Cherry' },
  { id: 'amber-crt', label: 'Amber CRT' },
  { id: 'high-contrast', label: 'High Contrast' },
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
  theme: 'tokyo-night',
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
  }

  return {
    settings,
    updateSetting,
    resetSettings,
    applyLoadedSettings,
  }
})
