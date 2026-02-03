/**
 * Feed Store
 *
 * Manages the event feed that displays game messages across all active runs.
 * Messages are filtered to show only interesting events.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

/** Feed event type (maps from GameMessage types) */
export type FeedEventType = 'info' | 'combat' | 'item' | 'level' | 'death' | 'good' | 'danger'

/** A single event in the feed */
export interface FeedEvent {
  id: number
  slot: number
  message: string
  type: FeedEventType
  timestamp: number
}

/** Message types to always show */
const ALWAYS_SHOW_TYPES = new Set(['combat', 'danger', 'good', 'item'])

/** Message patterns to filter out (even if type matches) */
const FILTER_PATTERNS = [
  /^You open the door\.$/,
  /^You pick up .* gold\.$/, // Gold pickups are too noisy
  /^The .* misses you\.$/, // Misses are less interesting
  /^The .* misses[.!]$/, // Monster misses (no target specified)
  /^You miss the .*\.$/,
  /^You suffer \d+ poison damage/, // Poison tick damage is noisy
  /^You hit the .* for \d+ damage/, // Regular hits are too noisy
  /^You hit the .* \d+.*x for \d+.*damage/, // Multi-hit melee
  /^Your arrow hits .* for \d+ damage/, // Ranged hits also noisy
  /^Your arrows? .* \d+.*x for \d+.*damage/, // Multi-shot ranged
  /^The .* (hits|bites|claws|touches|stings|crushes|gazes at|gazes|engulfs) you for \d+ damage/, // Getting hit is noisy
  /^The .* attacks \d+ times for \d+ damage/, // Multi-attack messages
  /^You critically hit/, // Even crits can be noisy
  /^You cast .* for \d+ damage/, // Spell damage is noisy
  /^You cast .* hitting \d+ enemies/, // AOE spells
  /^Your .* beams through/, // Beam spells
  /^You drain \d+ HP/, // Lifesteal is noisy
  /^You cast .+\. You feel/, // Self-buff spells (Light Orb, etc)
]

/** Message patterns that should always show (even if type is 'info') */
const IMPORTANT_INFO_PATTERNS = [
  /^You descend to depth/,
  /^You ascend to depth/,
  /^Welcome to the dungeon/,
  /^You have died/,
  /^Congratulations/,
  /reached level/,
  /^Second Wind/,
]

let eventIdCounter = 0

export const useFeedStore = defineStore('feed', () => {
  // State
  const events = ref<FeedEvent[]>([])
  const MAX_EVENTS = 50

  // Track last processed message index per run (to avoid duplicates)
  const lastMessageIndex = ref<Map<string, number>>(new Map())

  // Computed
  const recentEvents = computed(() => events.value.slice(0, 10))
  const hasEvents = computed(() => events.value.length > 0)

  /**
   * Check if a message should be displayed in the feed
   */
  function shouldShowMessage(text: string, type: string): boolean {
    // Check if explicitly filtered out
    for (const pattern of FILTER_PATTERNS) {
      if (pattern.test(text)) {
        return false
      }
    }

    // Always show certain types
    if (ALWAYS_SHOW_TYPES.has(type)) {
      return true
    }

    // Check important info patterns
    for (const pattern of IMPORTANT_INFO_PATTERNS) {
      if (pattern.test(text)) {
        return true
      }
    }

    // Filter out generic info messages
    return false
  }

  /**
   * Map GameMessage type to FeedEventType
   */
  function mapMessageType(type: string, text: string): FeedEventType {
    if (text.includes('died') || text.includes('death')) {
      return 'death'
    }
    if (text.includes('reached level') || text.includes('Level ')) {
      return 'level'
    }
    if (type === 'danger') {
      return 'danger'
    }
    if (type === 'good') {
      return 'good'
    }
    if (type === 'combat') {
      return 'combat'
    }
    if (type === 'item') {
      return 'item'
    }
    return 'info'
  }

  /**
   * Add an event to the feed
   */
  function addEvent(slot: number, message: string, type: FeedEventType) {
    events.value.unshift({
      id: eventIdCounter++,
      slot,
      message,
      type,
      timestamp: Date.now(),
    })

    // Trim to max events
    if (events.value.length > MAX_EVENTS) {
      events.value.pop()
    }
  }

  /**
   * Process new messages from a game state
   * Called by instance-manager on each tick
   */
  function processMessages(
    runId: string,
    slot: number,
    messages: Array<{ text: string; type: string; turn: number }>
  ) {
    const lastIndex = lastMessageIndex.value.get(runId) ?? -1
    let newLastIndex = lastIndex

    // Process messages in order (oldest to newest for this batch)
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i]
      if (!msg) continue

      // Use turn as a proxy for index (messages have turn numbers)
      // We want to show messages we haven't seen yet
      if (i <= lastIndex) continue

      newLastIndex = i

      // Filter messages
      if (!shouldShowMessage(msg.text, msg.type)) {
        continue
      }

      // Map type and add to feed
      const feedType = mapMessageType(msg.type, msg.text)
      addEvent(slot, msg.text, feedType)
    }

    // Update last index
    if (newLastIndex > lastIndex) {
      lastMessageIndex.value.set(runId, newLastIndex)
    }
  }

  /**
   * Clear tracking for a run (call when run ends/restarts)
   */
  function clearRunTracking(runId: string) {
    lastMessageIndex.value.delete(runId)
  }

  /**
   * Clear all events
   */
  function clearEvents() {
    events.value = []
    lastMessageIndex.value.clear()
  }

  /**
   * Add a system message (not tied to a specific run)
   */
  function addSystemMessage(message: string, type: FeedEventType = 'info') {
    addEvent(-1, message, type)
  }

  return {
    // State
    events,

    // Computed
    recentEvents,
    hasEvents,

    // Actions
    addEvent,
    processMessages,
    clearRunTracking,
    clearEvents,
    addSystemMessage,
  }
})
