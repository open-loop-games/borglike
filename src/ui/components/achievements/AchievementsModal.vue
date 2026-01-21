<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useProgressionStore } from '@/stores/progression'
import { achievements, type Achievement } from '@/game/data/achievements'
import AchievementCard from './AchievementCard.vue'

const progression = useProgressionStore()

const emit = defineEmits<{
  close: []
}>()

// Clear new achievement notifications when modal is opened
onMounted(() => {
  progression.clearNewAchievements()
})

// Filter state
const categoryFilter = ref<'all' | Achievement['category']>('all')
const sortBy = ref<'name' | 'reward' | 'status'>('status')
const searchQuery = ref('')

// Categories for filter
const categories = ['all', 'progress', 'challenge', 'cumulative'] as const

// Filter and sort achievements
const filteredAchievements = computed(() => {
  let result = [...achievements]

  // Apply category filter
  if (categoryFilter.value !== 'all') {
    result = result.filter((a) => a.category === categoryFilter.value)
  }

  // Apply search filter
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(
      (a) =>
        a.name.toLowerCase().includes(query) ||
        a.description.toLowerCase().includes(query)
    )
  }

  // Sort
  switch (sortBy.value) {
    case 'name':
      result.sort((a, b) => a.name.localeCompare(b.name))
      break
    case 'reward':
      result.sort((a, b) => b.reward - a.reward)
      break
    case 'status':
      // Show unlocked first, then by category order
      result.sort((a, b) => {
        const aUnlocked = progression.isAchievementUnlocked(a.id) ? 0 : 1
        const bUnlocked = progression.isAchievementUnlocked(b.id) ? 0 : 1
        if (aUnlocked !== bUnlocked) return aUnlocked - bUnlocked
        // Then by hidden status (non-hidden first)
        const aHidden = a.hidden ? 1 : 0
        const bHidden = b.hidden ? 1 : 0
        if (aHidden !== bHidden) return aHidden - bHidden
        return a.name.localeCompare(b.name)
      })
      break
  }

  return result
})

// Get progress for cumulative achievements
function getProgress(achievement: Achievement): number | undefined {
  if (achievement.category !== 'cumulative') return undefined

  // Map achievement IDs to their progress source
  switch (achievement.id) {
    case 'centurion':
    case 'slayer':
      return progression.globalStats.totalKills
    case 'millionaire':
      return progression.globalStats.totalGold
    case 'frequent_dier':
      return progression.globalStats.totalDeaths
    case 'veteran':
      return progression.globalStats.totalRuns
    default:
      return progression.getAchievementProgress(achievement.id)
  }
}

// Stats summary
const stats = computed(() => ({
  unlocked: progression.achievementStats.unlocked,
  total: progression.achievementStats.total,
  essenceEarned: progression.achievementStats.essenceEarned,
}))

// Selected achievement for detail view (future enhancement)
const selectedAchievement = ref<Achievement | null>(null)

function selectAchievement(achievement: Achievement) {
  // For now, just toggle selection for potential detail view
  selectedAchievement.value =
    selectedAchievement.value?.id === achievement.id ? null : achievement
}
</script>

<template>
  <div class="achievements-modal">
    <header class="modal-header">
      <div class="header-title">
        <h2>Achievements</h2>
        <span class="achievement-count">
          {{ stats.unlocked }}/{{ stats.total }} Unlocked
        </span>
        <span class="essence-earned">
          <span class="essence-icon">&#x25C6;</span>
          {{ stats.essenceEarned }} earned
        </span>
      </div>
      <button class="close-btn" @click="emit('close')">&times;</button>
    </header>

    <div class="filter-bar">
      <select v-model="categoryFilter" class="filter-select">
        <option v-for="cat in categories" :key="cat" :value="cat">
          {{ cat === 'all' ? 'All Categories' : cat.charAt(0).toUpperCase() + cat.slice(1) }}
        </option>
      </select>
      <select v-model="sortBy" class="filter-select">
        <option value="status">Sort by Status</option>
        <option value="reward">Sort by Reward</option>
        <option value="name">Sort by Name</option>
      </select>
      <input
        v-model="searchQuery"
        type="text"
        class="search-input"
        placeholder="Search achievements..."
      />
    </div>

    <div class="modal-content">
      <div class="achievement-grid">
        <AchievementCard
          v-for="achievement in filteredAchievements"
          :key="achievement.id"
          :achievement="achievement"
          :is-unlocked="progression.isAchievementUnlocked(achievement.id)"
          :progress="getProgress(achievement)"
          @click="selectAchievement(achievement)"
        />
      </div>

      <div v-if="filteredAchievements.length === 0" class="empty-state">
        <p>No achievements match your filters.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.achievements-modal {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  max-height: 80vh;
  position: relative;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}

.header-title {
  display: flex;
  align-items: center;
  gap: 16px;
}

.modal-header h2 {
  margin: 0;
  font-size: 18px;
  color: var(--text-primary);
}

.achievement-count {
  font-size: 13px;
  color: var(--text-secondary);
  padding: 4px 10px;
  background: var(--highlight);
  border-radius: 4px;
}

.essence-earned {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--purple);
  padding: 4px 10px;
  background: rgba(139, 92, 246, 0.15);
  border-radius: 4px;
}

.essence-icon {
  font-size: 12px;
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

.filter-bar {
  display: flex;
  gap: 12px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border);
  background: var(--void);
}

.filter-select {
  padding: 6px 12px;
  background: var(--highlight);
  border: 1px solid var(--border);
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-primary);
  cursor: pointer;
}

.filter-select:focus {
  outline: none;
  border-color: var(--purple);
}

.search-input {
  flex: 1;
  padding: 6px 12px;
  background: var(--highlight);
  border: 1px solid var(--border);
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-primary);
}

.search-input:focus {
  outline: none;
  border-color: var(--purple);
}

.search-input::placeholder {
  color: var(--text-dim);
}

.modal-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.achievement-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: var(--text-dim);
}
</style>
