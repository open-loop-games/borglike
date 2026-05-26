<script setup lang="ts">
import { ref, computed } from 'vue'
import { TabsRoot, TabsList, TabsTrigger } from 'reka-ui'
import { useProgressionStore } from '@/stores/progression'
import { ALL_ITEMS, type ItemTemplate } from '@game/data/items'
import { ARTIFACTS, type ArtifactTemplate } from '@game/data/artifacts'
import ItemCard from './ItemCard.vue'
import ItemDetailPanel from './ItemDetailPanel.vue'

const progression = useProgressionStore()

// Filter state
const categoryFilter = ref<string>('all')
const sortBy = ref<'tier' | 'name' | 'found'>('tier')
const searchQuery = ref('')

// Tab state (items vs artifacts)
const activeTab = ref<'items' | 'artifacts'>('items')

// Selected item for detail panel
const selectedItem = ref<{ item: ItemTemplate | ArtifactTemplate; isArtifact: boolean } | null>(
  null
)

function selectItem(item: ItemTemplate | ArtifactTemplate, isArtifact: boolean) {
  selectedItem.value = { item, isArtifact }
}

function clearSelection() {
  selectedItem.value = null
}

// Item categories for filtering
const itemCategories = computed(() => {
  const categories = new Set<string>()
  for (const item of ALL_ITEMS) {
    if (['weapon', 'bow'].includes(item.type)) {
      categories.add('weapons')
    } else if (['armor', 'shield', 'helm', 'gloves', 'boots'].includes(item.type)) {
      categories.add('armor')
    } else if (['ring', 'amulet', 'light'].includes(item.type)) {
      categories.add('accessories')
    } else if (['potion', 'scroll'].includes(item.type)) {
      categories.add('consumables')
    }
  }
  return ['all', ...Array.from(categories).sort()]
})

// Get category for an item
function getItemCategory(item: ItemTemplate): string {
  if (['weapon', 'bow'].includes(item.type)) return 'weapons'
  if (['armor', 'shield', 'helm', 'gloves', 'boots'].includes(item.type)) return 'armor'
  if (['ring', 'amulet', 'light'].includes(item.type)) return 'accessories'
  if (['potion', 'scroll'].includes(item.type)) return 'consumables'
  return 'other'
}

// Filter and sort items
const filteredItems = computed(() => {
  let result = [...ALL_ITEMS]

  // Apply category filter
  if (categoryFilter.value !== 'all') {
    result = result.filter((item) => getItemCategory(item) === categoryFilter.value)
  }

  // Apply search filter
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter((item) => item.name.toLowerCase().includes(query))
  }

  // Sort
  switch (sortBy.value) {
    case 'tier':
      result.sort((a, b) => {
        if (a.tier !== b.tier) return a.tier - b.tier
        return a.name.localeCompare(b.name)
      })
      break
    case 'name':
      result.sort((a, b) => a.name.localeCompare(b.name))
      break
    case 'found':
      result.sort((a, b) => {
        const foundA = progression.itemArmory[a.name]?.firstFoundTime ?? Infinity
        const foundB = progression.itemArmory[b.name]?.firstFoundTime ?? Infinity
        return foundA - foundB
      })
      break
  }

  return result
})

// Filter and sort artifacts
const filteredArtifacts = computed(() => {
  let result = [...ARTIFACTS]

  // Apply search filter
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter((artifact) => artifact.name.toLowerCase().includes(query))
  }

  // Sort by depth requirement
  result.sort((a, b) => a.minDepth - b.minDepth)

  return result
})

// Discovery stats
const itemStats = computed(() => {
  const discovered = ALL_ITEMS.filter((item) => progression.itemArmory[item.name]).length
  return {
    discovered,
    total: ALL_ITEMS.length,
  }
})

const artifactStats = computed(() => {
  const discovered = ARTIFACTS.filter((artifact) => progression.itemArmory[artifact.name]).length
  return {
    discovered,
    total: ARTIFACTS.length,
  }
})
</script>

<template>
  <TabsRoot v-model="activeTab" class="armory-panel">
    <TabsList class="subtab-bar">
      <TabsTrigger value="items" class="subtab-btn">
        Items ({{ itemStats.discovered }}/{{ itemStats.total }})
      </TabsTrigger>
      <TabsTrigger value="artifacts" class="subtab-btn">
        Artifacts ({{ artifactStats.discovered }}/{{ artifactStats.total }})
      </TabsTrigger>
    </TabsList>

    <div class="filter-bar">
      <select v-if="activeTab === 'items'" v-model="categoryFilter" class="filter-select">
        <option v-for="cat in itemCategories" :key="cat" :value="cat">
          {{ cat === 'all' ? 'All Categories' : cat.charAt(0).toUpperCase() + cat.slice(1) }}
        </option>
      </select>
      <select v-if="activeTab === 'items'" v-model="sortBy" class="filter-select">
        <option value="tier">Sort by Tier</option>
        <option value="name">Sort by Name</option>
        <option value="found">Sort by Found</option>
      </select>
      <input
        v-model="searchQuery"
        type="text"
        class="search-input"
        :placeholder="activeTab === 'items' ? 'Search items...' : 'Search artifacts...'"
      />
    </div>

    <div class="panel-body">
      <div class="panel-content">
        <!-- Items Grid -->
        <div v-if="activeTab === 'items'" class="item-grid">
          <ItemCard
            v-for="item in filteredItems"
            :key="item.name"
            :item="item"
            :entry="progression.itemArmory[item.name]"
            :is-artifact="false"
            :class="{ selected: selectedItem?.item.name === item.name }"
            @click="selectItem(item, false)"
          />
        </div>

        <!-- Artifacts Grid -->
        <div v-else class="item-grid">
          <ItemCard
            v-for="artifact in filteredArtifacts"
            :key="artifact.name"
            :item="artifact"
            :entry="progression.itemArmory[artifact.name]"
            :is-artifact="true"
            :class="{ selected: selectedItem?.item.name === artifact.name }"
            @click="selectItem(artifact, true)"
          />
        </div>
      </div>

      <!-- Detail Panel -->
      <ItemDetailPanel
        v-if="selectedItem"
        :item="selectedItem.item"
        :entry="progression.itemArmory[selectedItem.item.name]"
        :is-artifact="selectedItem.isArtifact"
        @close="clearSelection"
      />
    </div>
  </TabsRoot>
</template>

<style scoped>
.armory-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  position: relative;
  overflow: hidden;
}

.subtab-bar {
  display: flex;
  gap: 0;
  padding: 0 var(--space-5);
  border-bottom: 1px solid var(--border);
  background: var(--bg);
}

.subtab-btn {
  padding: var(--space-3) var(--space-5);
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  font-size: var(--text-md);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.subtab-btn:hover {
  color: var(--text-primary);
}

.subtab-btn[data-state='active'] {
  color: var(--essence);
  border-bottom-color: var(--essence);
}

.filter-bar {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-5);
  border-bottom: 1px solid var(--border);
  background: var(--bg);
}

.filter-select {
  padding: var(--space-2) var(--space-3);
  background: var(--bg-highlight);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  color: var(--text-primary);
  cursor: pointer;
}

.filter-select:focus {
  outline: none;
  border-color: var(--essence);
}

.search-input {
  flex: 1;
  padding: var(--space-2) var(--space-3);
  background: var(--bg-highlight);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  color: var(--text-primary);
}

.search-input:focus {
  outline: none;
  border-color: var(--essence);
}

.search-input::placeholder {
  color: var(--text-dim);
}

.panel-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-4);
}

.item-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: var(--space-3);
}

/* Selected item highlight */
.item-grid :deep(.item-card.selected) {
  outline: 2px solid var(--essence);
  outline-offset: -2px;
}

.item-grid :deep(.item-card.selected.artifact) {
  outline-color: var(--legendary);
}
</style>
