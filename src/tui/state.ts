/**
 * TUI-Local Reactive State
 *
 * Refs that don't belong in any Pinia store because they're shell-specific
 * (which slot the TUI viewer is focused on, whether the help modal is open,
 * pending kill-confirm). The render layer watches these alongside Pinia state;
 * the input layer mutates them.
 *
 * Vue stores own cross-shell concepts (a Web user might also have a notion of
 * "focused slot" — see runs.focusedSlot — but that's tied to the Vue UI's
 * expand-vs-grid switch, which doesn't map cleanly to the TUI's always-shown
 * thumbnails + always-focused layout). Keep them separate.
 */

import { ref } from 'vue'

/** Currently focused slot index (0..3). The TUI always has a focused slot. */
export const focusedSlot = ref(0)

/** True while help modal is on screen. Input handlers no-op when set. */
export const helpVisible = ref(false)

/**
 * Slot that has a pending kill-confirm, or null. Set by Shift+K on first
 * press, cleared by the 2s timeout, a second Shift+K (which then kills),
 * Escape, or focus change.
 */
export const killConfirmSlot = ref<number | null>(null)

/** Kill-confirm window in ms. After this, the pending kill quietly clears. */
export const KILL_CONFIRM_WINDOW_MS = 2000
