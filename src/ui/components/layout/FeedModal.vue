<script setup lang="ts">
import { ref, computed } from 'vue'
import type { FeedEvent, FeedEventType } from '@/stores/feed'
import { Icons } from '@/ui/icons'
import PanelFrame from '../common/PanelFrame.vue'
import Icon from '../common/Icon.vue'
import IconSelect from '../common/IconSelect.vue'

const props = defineProps<{
  events: FeedEvent[]
}>()

const emit = defineEmits<{
  close: []
}>()

// Filter state — slot values are stringified to satisfy IconSelect (string-only).
const searchQuery = ref('')
const slotFilter = ref<string>('all')
const typeFilter = ref<FeedEventType | 'all'>('all')

const slotOptions = [
  { value: 'all', label: 'All Slots' },
  { value: '-1', label: 'System' },
  { value: '0', label: 'Run 1' },
  { value: '1', label: 'Run 2' },
  { value: '2', label: 'Run 3' },
  { value: '3', label: 'Run 4' },
]

const typeOptions: { value: FeedEventType | 'all'; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'combat', label: 'Combat' },
  { value: 'item', label: 'Item' },
  { value: 'level', label: 'Level' },
  { value: 'death', label: 'Death' },
  { value: 'victory', label: 'Victory' },
  { value: 'good', label: 'Good' },
  { value: 'danger', label: 'Danger' },
  { value: 'info', label: 'Info' },
]

const filteredEvents = computed(() => {
  return props.events.filter((event) => {
    if (slotFilter.value !== 'all' && event.slot !== Number(slotFilter.value)) {
      return false
    }

    if (typeFilter.value !== 'all' && event.type !== typeFilter.value) {
      return false
    }

    // Search filter
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase()
      if (!event.message.toLowerCase().includes(query)) {
        return false
      }
    }

    return true
  })
})

function getSlotColor(slot: number): string {
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
  <PanelFrame class="feed-modal">
    <header class="modal-header">
      <h2>Event Log</h2>
      <button class="close-btn" @click="emit('close')"><Icon :name="Icons.close" /></button>
    </header>

    <div class="filters">
      <input
        v-model="searchQuery"
        type="text"
        class="search-input"
        placeholder="Search messages..."
      />

      <IconSelect v-model="slotFilter" :options="slotOptions" aria-label="Filter by slot" inline />

      <IconSelect
        v-model="typeFilter"
        :options="typeOptions"
        aria-label="Filter by event type"
        inline
      />

      <span class="event-count">{{ filteredEvents.length }} events</span>
    </div>

    <div class="event-list">
      <div
        v-for="event in filteredEvents"
        :key="event.id"
        class="event-row"
        :class="getTypeClass(event.type)"
      >
        <span class="event-timestamp">{{ formatTimestamp(event.timestamp) }}</span>
        <span class="event-slot" :style="{ color: getSlotColor(event.slot) }">
          [{{ getSlotLabel(event.slot) }}]
        </span>
        <span class="event-message">{{ event.message }}</span>
      </div>

      <div v-if="filteredEvents.length === 0" class="no-events">No events match your filters.</div>
    </div>
  </PanelFrame>
</template>

<style scoped>
.feed-modal {
  width: 100%;
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - var(--space-5) * 2);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--border);
  margin-bottom: var(--space-3);
}

.modal-header h2 {
  margin: 0;
  font-size: var(--text-xl);
  color: var(--text-primary);
}

.close-btn {
  background: none;
  border: none;
  color: var(--text-dim);
  font-size: var(--text-2xl);
  cursor: pointer;
  padding: var(--space-1) var(--space-2);
}

.close-btn:hover {
  color: var(--text-primary);
}

.filters {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  margin-bottom: var(--space-3);
  flex-wrap: wrap;
}

.search-input {
  flex: 1;
  min-width: 150px;
  padding: var(--space-2) var(--space-3);
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--text-base);
}

.search-input:focus {
  outline: none;
  border-color: var(--info);
}

.event-count {
  font-size: var(--text-base);
  color: var(--text-dim);
  margin-left: auto;
}

.event-list {
  flex: 1;
  overflow-y: auto;
  min-height: 300px;
  max-height: 500px;
}

.event-row {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  padding: var(--space-1) 0;
  font-size: var(--text-base);
  border-bottom: 1px solid var(--border-dim, rgba(255, 255, 255, 0.05));
}

.event-row:last-child {
  border-bottom: none;
}

.event-timestamp {
  color: var(--text-dim);
  font-size: var(--text-base);
  flex-shrink: 0;
}

.event-slot {
  font-weight: bold;
  flex-shrink: 0;
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

.no-events {
  padding: var(--space-6);
  text-align: center;
  color: var(--text-dim);
  font-style: italic;
}
</style>
