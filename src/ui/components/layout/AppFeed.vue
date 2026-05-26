<script setup lang="ts">
import { ref } from 'vue'
import { useFeedStore, type FeedEventType, type FeedEvent } from '@/stores/feed'
import { useSettingsStore } from '@/stores/settings'
import FeedModal from './FeedModal.vue'
import AppModal from '../common/AppModal.vue'

const feedStore = useFeedStore()
const settingsStore = useSettingsStore()

// Modal state
const showModal = ref(false)
const frozenEvents = ref<FeedEvent[]>([])

function openModal() {
  // Freeze current events snapshot
  frozenEvents.value = [...feedStore.events]
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  frozenEvents.value = []
}

function getSlotColor(slot: number): string {
  // -1 is system message
  if (slot < 0) return 'var(--text-dim)'
  const colors = ['var(--info)', 'var(--success)', 'var(--warning)', 'var(--essence)']
  return colors[slot % colors.length] ?? 'var(--text-secondary)'
}

function getSlotLabel(slot: number): string {
  return slot < 0 ? 'SYS' : String(slot + 1)
}

function getTypeClass(type: FeedEventType): string {
  return `event-${type}`
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('en-US', { hour12: false })
}
</script>

<template>
  <footer class="app-feed">
    <div class="feed-label">FEED</div>
    <div class="feed-scroll">
      <TransitionGroup name="feed" tag="div" class="feed-events">
        <div
          v-for="event in feedStore.recentEvents"
          :key="event.id"
          class="feed-event"
          :class="getTypeClass(event.type)"
        >
          <span v-if="settingsStore.settings.feedShowTimestamps" class="event-timestamp">
            {{ formatTimestamp(event.timestamp) }}
          </span>
          <span class="event-slot" :style="{ color: getSlotColor(event.slot) }">
            [{{ getSlotLabel(event.slot) }}]
          </span>
          <span class="event-message">{{ event.message }}</span>
        </div>
      </TransitionGroup>
      <div v-if="!feedStore.hasEvents" class="feed-empty">Waiting for events...</div>
    </div>
    <button class="feed-expand-btn" title="View Event Log" @click="openModal">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>

    <AppModal v-model:open="showModal" title="Event Log">
      <FeedModal :events="frozenEvents" @close="closeModal" />
    </AppModal>
  </footer>
</template>

<style scoped>
.app-feed {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 0 var(--space-4);
  background: var(--bg-panel);
  border-top: 1px solid var(--border);
  overflow: hidden;
}

.feed-label {
  font-size: var(--text-base);
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
  gap: var(--space-6);
  white-space: nowrap;
}

.feed-event {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-base);
}

.event-timestamp {
  color: var(--text-dim);
  font-size: var(--text-base);
}

.event-slot {
  font-weight: bold;
}

.event-message {
  color: var(--text-secondary);
}

.event-combat .event-message {
  color: var(--danger);
}

.event-item .event-message {
  color: var(--warning);
}

.event-level .event-message {
  color: var(--info);
}

.event-death .event-message {
  color: var(--danger);
  text-shadow: 0 0 6px color-mix(in srgb, var(--danger) 50%, transparent);
}

.event-good .event-message {
  color: var(--success);
}

.event-danger .event-message {
  color: var(--danger);
  font-weight: bold;
}

.event-victory .event-message {
  color: var(--warning);
  text-shadow: 0 0 8px color-mix(in srgb, var(--warning) 60%, transparent);
  font-weight: bold;
}

.feed-empty {
  font-size: var(--text-base);
  color: var(--text-dim);
  font-style: italic;
}

.feed-expand-btn {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  padding: var(--space-1);
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--text-dim);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.feed-expand-btn:hover {
  background: var(--bg);
  color: var(--text-primary);
  border-color: var(--text-dim);
}

.feed-expand-btn svg {
  width: 16px;
  height: 16px;
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
