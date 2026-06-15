/**
 * Notifications Store
 *
 * Transient ceremonial toast queue — a channel parallel to the feed
 * (src/stores/feed.ts), not a promoted feed event. The feed is a high-volume
 * scrolling log gated by verbosity; toasts are rare, deliberately unfiltered,
 * and auto-dismiss. A caller may fire both for a moment that also deserves a
 * log line (notify() + feed.addSystemMessage()).
 *
 * Mechanism only: which moments toast vs. stay pip-only is the caller's reveal
 * grammar (policy), never the queue's.
 *
 * Ephemeral by design — never persisted. "Don't re-fire on reload" belongs to
 * the caller's own persisted state (e.g. progression's toasted-reveal set), not
 * here; a fresh page load starts with an empty queue.
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'

/** Severity drives styling off the `.glow-*` utilities in base.css. */
export type ToastKind = 'essence' | 'info' | 'success' | 'warning' | 'danger' | 'accent'

/** A single transient notification. */
export interface Toast {
  id: number
  kind: ToastKind
  title: string
  body?: string
  /** Auto-dismiss after this many ms; `false` = sticky (manual dismiss only). */
  durationMs: number | false
  /** Repeat fires with the same key refresh the live toast instead of stacking. */
  dedupeKey?: string
}

/** Arguments to the public `notify()` entry point. */
export interface NotifyOptions {
  title: string
  kind?: ToastKind
  body?: string
  durationMs?: number | false
  dedupeKey?: string
}

const DEFAULT_DURATION_MS = 5000
/** Max simultaneously visible; older overflow drops off the top of the stack. */
const MAX_VISIBLE = 4

let toastIdCounter = 0

export const useNotificationsStore = defineStore('notifications', () => {
  const toasts = ref<Toast[]>([])

  // Per-toast auto-dismiss timers, tracked so we can cancel on manual dismiss,
  // dedupe-refresh, or overflow-drop without leaking handles.
  const timers = new Map<number, ReturnType<typeof setTimeout>>()

  function clearTimer(id: number) {
    const handle = timers.get(id)
    if (handle !== undefined) {
      clearTimeout(handle)
      timers.delete(id)
    }
  }

  function armTimer(toast: Toast) {
    clearTimer(toast.id)
    if (toast.durationMs === false) return
    timers.set(
      toast.id,
      setTimeout(() => dismiss(toast.id), toast.durationMs)
    )
  }

  /** Remove a toast (manual close or auto-dismiss). */
  function dismiss(id: number) {
    clearTimer(id)
    const idx = toasts.value.findIndex((t) => t.id === id)
    if (idx !== -1) toasts.value.splice(idx, 1)
  }

  /**
   * Typed entry point for every system that wants a ceremonial toast
   * (disclosure reveals, prestige, achievements, run completion). Returns the
   * toast id so a caller can dismiss it early.
   */
  function notify(options: NotifyOptions): number {
    const kind = options.kind ?? 'info'
    const durationMs = options.durationMs ?? DEFAULT_DURATION_MS

    // Dedupe: a repeat fire refreshes the existing toast and restarts its timer
    // rather than stacking a duplicate.
    if (options.dedupeKey !== undefined) {
      const existing = toasts.value.find((t) => t.dedupeKey === options.dedupeKey)
      if (existing) {
        existing.kind = kind
        existing.title = options.title
        existing.body = options.body
        existing.durationMs = durationMs
        armTimer(existing)
        return existing.id
      }
    }

    const toast: Toast = {
      id: toastIdCounter++,
      kind,
      title: options.title,
      body: options.body,
      durationMs,
      dedupeKey: options.dedupeKey,
    }
    toasts.value.push(toast)

    // Cap the visible stack — drop the oldest overflow and cancel its timer.
    while (toasts.value.length > MAX_VISIBLE) {
      const dropped = toasts.value.shift()
      if (dropped) clearTimer(dropped.id)
    }

    armTimer(toast)
    return toast.id
  }

  /** Drop every toast at once (e.g. on a hard reset). */
  function clearAll() {
    for (const id of [...timers.keys()]) clearTimer(id)
    toasts.value = []
  }

  return {
    toasts,
    notify,
    dismiss,
    clearAll,
  }
})
