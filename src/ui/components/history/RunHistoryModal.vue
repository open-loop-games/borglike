<script setup lang="ts">
import { ref, computed } from 'vue'
import { TabsRoot, TabsList, TabsTrigger, TabsContent } from 'reka-ui'
import { useProgressionStore } from '@/stores/progression'
import RunHistoryRow from './RunHistoryRow.vue'

const progression = useProgressionStore()

// Tab state
const activeTab = ref<'recent' | 'wins' | 'top'>('recent')

// Expanded row state
const expandedRunId = ref<string | null>(null)

function toggleExpanded(runId: string) {
  expandedRunId.value = expandedRunId.value === runId ? null : runId
}

// Computed data
const recentRuns = computed(() => progression.runHistory.slice(0, 50))
const wins = computed(() => progression.winHistory)

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
  <TabsRoot v-model="activeTab" class="run-history-panel">
    <TabsList class="subtab-bar">
      <TabsTrigger value="recent">Recent ({{ recentRuns.length }})</TabsTrigger>
      <TabsTrigger value="wins">Wins ({{ wins.length }})</TabsTrigger>
      <TabsTrigger value="top">Top Runs</TabsTrigger>
    </TabsList>

    <div class="panel-body">
      <TabsContent value="recent" class="recent-runs">
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
      </TabsContent>

      <TabsContent value="wins" class="wins-runs">
        <div v-if="wins.length === 0" class="empty-state">
          No victories yet. Defeat Morgoth to record a win!
        </div>
        <div v-else class="run-list">
          <RunHistoryRow
            v-for="(run, index) in wins"
            :key="run.id"
            :run="run"
            :rank="index + 1"
            :expanded="expandedRunId === run.id"
            :time-ago="formatTimeAgo(run.endTime ?? run.startTime)"
            @toggle="toggleExpanded(run.id)"
          />
        </div>
      </TabsContent>

      <TabsContent value="top" class="top-runs">
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
      </TabsContent>
    </div>
  </TabsRoot>
</template>

<style scoped>
.run-history-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.subtab-bar {
  display: flex;
  gap: var(--space-1);
  padding: var(--space-3) var(--space-5);
  border-bottom: 1px solid var(--border);
  background: var(--bg);
}

.subtab-bar button {
  padding: var(--space-2) var(--space-4);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  font-size: var(--text-md);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.subtab-bar button:hover {
  background: var(--bg-highlight);
  color: var(--text-primary);
}

.subtab-bar button[data-state='active'] {
  background: var(--bg-highlight);
  border-color: var(--essence);
  color: var(--essence);
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-4);
}

.empty-state {
  text-align: center;
  padding: 40px var(--space-5);
  color: var(--text-dim);
  font-style: italic;
}

.run-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.top-section {
  margin-bottom: var(--space-6);
}

.top-section:last-child {
  margin-bottom: 0;
}

.top-section h3 {
  margin: 0 0 var(--space-3) 0;
  font-size: var(--text-lg);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
</style>
