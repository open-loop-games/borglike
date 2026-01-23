<script setup lang="ts">
import { ref, computed } from 'vue'
import { useProgressionStore } from '@/stores/progression'
import RunHistoryRow from './RunHistoryRow.vue'

const progression = useProgressionStore()

const emit = defineEmits<{
  close: []
}>()

// Tab state
const activeTab = ref<'recent' | 'top'>('recent')

// Expanded row state
const expandedRunId = ref<string | null>(null)

function toggleExpanded(runId: string) {
  expandedRunId.value = expandedRunId.value === runId ? null : runId
}

// Computed data
const recentRuns = computed(() => progression.runHistory.slice(0, 50))

// Use independent top runs storage (persisted separately from recent history)
const topByDepth = computed(() => progression.topRunsByDepth)
const topByEssence = computed(() => progression.topRunsByEssence)
const topByKills = computed(() => progression.topRunsByKills)

// Format time ago helper
function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)

  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return new Date(timestamp).toLocaleDateString()
}
</script>

<template>
  <div class="run-history-modal">
    <header class="modal-header">
      <h2>Run History</h2>
      <button class="close-btn" @click="emit('close')">&times;</button>
    </header>

    <nav class="modal-tabs">
      <button :class="{ active: activeTab === 'recent' }" @click="activeTab = 'recent'">
        Recent ({{ recentRuns.length }})
      </button>
      <button :class="{ active: activeTab === 'top' }" @click="activeTab = 'top'">Top Runs</button>
    </nav>

    <div class="modal-content">
      <!-- Recent tab -->
      <div v-if="activeTab === 'recent'" class="recent-runs">
        <div v-if="recentRuns.length === 0" class="empty-state">
          No runs recorded yet. Complete a run to see it here.
        </div>
        <div v-else class="run-list">
          <RunHistoryRow
            v-for="run in recentRuns"
            :key="run.id"
            :run="run"
            :expanded="expandedRunId === run.id"
            :time-ago="formatTimeAgo(run.endTime ?? run.startTime)"
            @toggle="toggleExpanded(run.id)"
          />
        </div>
      </div>

      <!-- Top runs tab -->
      <div v-else class="top-runs">
        <section class="top-section">
          <h3>Deepest Runs</h3>
          <div class="run-list">
            <RunHistoryRow
              v-for="(run, index) in topByDepth"
              :key="run.id"
              :run="run"
              :rank="index + 1"
              :expanded="expandedRunId === run.id"
              :time-ago="formatTimeAgo(run.endTime ?? run.startTime)"
              @toggle="toggleExpanded(run.id)"
            />
          </div>
        </section>

        <section class="top-section">
          <h3>Most Essence</h3>
          <div class="run-list">
            <RunHistoryRow
              v-for="(run, index) in topByEssence"
              :key="run.id"
              :run="run"
              :rank="index + 1"
              :expanded="expandedRunId === run.id"
              :time-ago="formatTimeAgo(run.endTime ?? run.startTime)"
              @toggle="toggleExpanded(run.id)"
            />
          </div>
        </section>

        <section class="top-section">
          <h3>Most Kills</h3>
          <div class="run-list">
            <RunHistoryRow
              v-for="(run, index) in topByKills"
              :key="run.id"
              :run="run"
              :rank="index + 1"
              :expanded="expandedRunId === run.id"
              :time-ago="formatTimeAgo(run.endTime ?? run.startTime)"
              @toggle="toggleExpanded(run.id)"
            />
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.run-history-modal {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  max-height: 80vh;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}

.modal-header h2 {
  margin: 0;
  font-size: 18px;
  color: var(--text-primary);
}

.close-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-secondary);
  font-size: 20px;
  cursor: pointer;
  transition: all 0.2s;
}

.close-btn:hover {
  background: var(--highlight);
  color: var(--text-primary);
}

.modal-tabs {
  display: flex;
  gap: 4px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border);
  background: var(--void);
}

.modal-tabs button {
  padding: 8px 16px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.modal-tabs button:hover {
  background: var(--highlight);
  color: var(--text-primary);
}

.modal-tabs button.active {
  background: var(--highlight);
  border-color: var(--purple);
  color: var(--purple);
}

.modal-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-dim);
  font-style: italic;
}

.run-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.top-section {
  margin-bottom: 24px;
}

.top-section:last-child {
  margin-bottom: 0;
}

.top-section h3 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
</style>
