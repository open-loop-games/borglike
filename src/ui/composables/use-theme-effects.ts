/**
 * Theme / Font DOM Effects
 *
 * Applies fontSize / fontFamily / theme settings to document.documentElement.
 * Lazy-loads Google Fonts as <link> tags on first use.
 *
 * Vue-shell-only: imports document directly. Non-DOM shells (e.g. TUI) must not
 * import this. The settings store stays pure data so it can be consumed by any
 * shell; presentation effects live here.
 */

import { watch } from 'vue'
import { useSettingsStore, FONT_OPTIONS, type GameSettings } from '@/stores/settings'

const FONT_SCALE_MAP: Record<GameSettings['fontSize'], number> = {
  small: 0.85,
  medium: 1,
  large: 1.2,
}

const loadedFonts = new Set<string>()

function applyFontScale(size: GameSettings['fontSize']): void {
  document.documentElement.style.setProperty('--font-scale', String(FONT_SCALE_MAP[size]))
}

function applyFontFamily(fontId: GameSettings['fontFamily']): void {
  const option = FONT_OPTIONS.find((f) => f.id === fontId)
  if (!option) return

  if (option.googleFamily && !loadedFonts.has(option.googleFamily)) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = `https://fonts.googleapis.com/css2?family=${option.googleFamily}:wght@400;700&display=swap`
    document.head.appendChild(link)
    loadedFonts.add(option.googleFamily)
  }

  document.documentElement.style.setProperty('--font-mono', option.css)
}

function applyTheme(theme: GameSettings['theme']): void {
  document.documentElement.dataset.theme = theme
}

export function useThemeEffects(): void {
  const settingsStore = useSettingsStore()

  applyFontScale(settingsStore.settings.fontSize)
  applyFontFamily(settingsStore.settings.fontFamily)
  applyTheme(settingsStore.settings.theme)

  watch(() => settingsStore.settings.fontSize, applyFontScale)
  watch(() => settingsStore.settings.fontFamily, applyFontFamily)
  watch(() => settingsStore.settings.theme, applyTheme)
}
