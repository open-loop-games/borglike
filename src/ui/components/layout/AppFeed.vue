<script setup lang="ts">
import { ref } from 'vue'

interface FeedEvent {
  id: number
  slot: number
  message: string
  type: 'info' | 'combat' | 'item' | 'level' | 'death'
  timestamp: number
}

const events = ref<FeedEvent[]>([])
let eventId = 0

// Demo events for now - will be wired to actual game events
function addEvent(slot: number, message: string, type: FeedEvent['type'] = 'info') {
  events.value.unshift({
    id: eventId++,
    slot,
    message,
    type,
    timestamp: Date.now(),
  })
  // Keep only last 50 events
  if (events.value.length > 50) {
    events.value.pop()
  }
}

// Expose for external use
defineExpose({ addEvent })

function getSlotColor(slot: number): string {
  const colors = ['var(--cyan)', 'var(--green)', 'var(--amber)', 'var(--purple)']
  return colors[slot % colors.length] ?? 'var(--text-secondary)'
}

function getTypeClass(type: FeedEvent['type']): string {
  return `event-${type}`
}
</script>

<template>
  <footer class="app-feed">
    <div class="feed-label">FEED</div>
    <div class="feed-scroll">
      <TransitionGroup name="feed" tag="div" class="feed-events">
        <div
          v-for="event in events.slice(0, 10)"
          :key="event.id"
          class="feed-event"
          :class="getTypeClass(event.type)"
        >
          <span class="event-slot" :style="{ color: getSlotColor(event.slot) }">
            [{{ event.slot + 1 }}]
          </span>
          <span class="event-message">{{ event.message }}</span>
        </div>
      </TransitionGroup>
      <div v-if="events.length === 0" class="feed-empty">Waiting for events...</div>
    </div>
  </footer>
</template>

<style scoped>
.app-feed {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  background: var(--panel);
  border-top: 1px solid var(--border);
  overflow: hidden;
}

.feed-label {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 1px;
  flex-shrink: 0;
}

.feed-scroll {
  flex: 1;
  overflow: hidden;
}

.feed-events {
  display: flex;
  gap: 24px;
  white-space: nowrap;
}

.feed-event {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-mono);
  font-size: 12px;
}

.event-slot {
  font-weight: bold;
}

.event-message {
  color: var(--text-secondary);
}

.event-combat .event-message {
  color: var(--red);
}

.event-item .event-message {
  color: var(--amber);
}

.event-level .event-message {
  color: var(--cyan);
}

.event-death .event-message {
  color: var(--red);
  text-shadow: 0 0 6px rgba(239, 68, 68, 0.5);
}

.feed-empty {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-dim);
  font-style: italic;
}

/* Transition animations */
.feed-enter-active {
  transition: all 0.3s ease;
}

.feed-leave-active {
  transition: all 0.2s ease;
}

.feed-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}

.feed-leave-to {
  opacity: 0;
}
</style>
