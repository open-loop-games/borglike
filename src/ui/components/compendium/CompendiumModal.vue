<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { TabsRoot, TabsList, TabsTrigger } from 'reka-ui'
import { useProgressionStore } from '@/stores/progression'
import { Icons } from '@/ui/icons'
import Icon from '../common/Icon.vue'
import RunHistoryPanel from '../history/RunHistoryModal.vue'
import AchievementsPanel from '../achievements/AchievementsModal.vue'
import BestiaryPanel from '../bestiary/BestiaryModal.vue'
import ItemArmoryPanel from '../armory/ItemArmoryModal.vue'
import HeroesPanel from '../heroes/HeroesPanel.vue'
import GuidePanel from '../help/GuidePanel.vue'

export type CompendiumTab = 'history' | 'achievements' | 'bestiary' | 'armory' | 'heroes' | 'guide'

const props = withDefaults(
  defineProps<{
    initialTab?: CompendiumTab
  }>(),
  { initialTab: 'history' }
)

const emit = defineEmits<{
  close: []
}>()

const progression = useProgressionStore()

const activeTab = ref<CompendiumTab>(props.initialTab)

// Re-sync if parent changes initialTab while the modal is open
watch(
  () => props.initialTab,
  (t) => {
    activeTab.value = t
  }
)

const tabs = computed(() => [
  { id: 'history' as const, label: 'History', icon: Icons.history },
  {
    id: 'achievements' as const,
    label: 'Achievements',
    icon: Icons.achievements,
    count: progression.achievementStats.unlocked,
    notification: progression.hasNewAchievements,
  },
  {
    id: 'bestiary' as const,
    label: 'Bestiary',
    icon: Icons.bestiary,
    count: progression.bestiaryStats.discovered,
  },
  {
    id: 'armory' as const,
    label: 'Armory',
    icon: Icons.armory,
    count: progression.armoryStats.discovered,
  },
  { id: 'heroes' as const, label: 'Heroes', icon: Icons.heroes },
  { id: 'guide' as const, label: 'Guide', icon: Icons.help },
])

const PANEL_BY_TAB = {
  history: RunHistoryPanel,
  achievements: AchievementsPanel,
  bestiary: BestiaryPanel,
  armory: ItemArmoryPanel,
  heroes: HeroesPanel,
  guide: GuidePanel,
} as const

const activePanel = computed(() => PANEL_BY_TAB[activeTab.value])
</script>

<template>
  <div class="compendium-modal">
    <header class="modal-header">
      <h2>Compendium</h2>
      <button class="close-btn" aria-label="Close" @click="emit('close')">
        <Icon :name="Icons.close" />
      </button>
    </header>

    <TabsRoot v-model="activeTab" class="tabs-root">
      <TabsList class="tab-strip">
        <TabsTrigger v-for="tab in tabs" :key="tab.id" :value="tab.id" class="tab-btn">
          <Icon class="tab-icon" :name="tab.icon" />
          <span class="tab-label">{{ tab.label }}</span>
          <span v-if="tab.count !== undefined" class="tab-count">{{ tab.count }}</span>
          <span v-if="tab.notification" class="notification-dot" aria-hidden="true"></span>
        </TabsTrigger>
      </TabsList>

      <div class="panel-host">
        <KeepAlive>
          <component :is="activePanel" />
        </KeepAlive>
      </div>
    </TabsRoot>
  </div>
</template>

<style scoped>
.compendium-modal {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  display: flex;
  flex-direction: column;
  height: 80vh;
  max-height: 80vh;
  position: relative;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--border);
}

.modal-header h2 {
  margin: 0;
  font-size: var(--text-2xl);
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
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: var(--text-3xl);
  cursor: pointer;
  transition: all 0.2s;
}

.close-btn:hover {
  background: var(--bg-highlight);
  color: var(--text-primary);
}

.tab-strip {
  display: flex;
  gap: 0;
  padding: 0 var(--space-2);
  border-bottom: 1px solid var(--border);
  background: var(--bg);
  overflow-x: auto;
  scrollbar-width: thin;
}

.tab-btn {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) 14px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  font-size: var(--text-md);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.tab-btn:hover {
  color: var(--text-primary);
}

.tab-btn[data-state='active'] {
  color: var(--essence);
  border-bottom-color: var(--essence);
}

.tab-icon {
  font-size: var(--text-lg);
}

.tab-label {
  font-weight: 500;
}

.tab-count {
  font-size: var(--text-sm);
  color: var(--text-dim);
  padding: 1px var(--space-2);
  background: var(--bg-highlight);
  border-radius: var(--radius-sm);
}

.tab-btn[data-state='active'] .tab-count {
  color: var(--essence);
  background: color-mix(in srgb, var(--essence) 15%, transparent);
}

.notification-dot {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 8px;
  height: 8px;
  background: var(--legendary);
  border-radius: 50%;
  box-shadow: 0 0 6px color-mix(in srgb, var(--legendary) 60%, transparent);
}

.panel-host {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.tabs-root {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

/* Stretch the active panel to fill the host */
.panel-host > * {
  flex: 1;
  min-height: 0;
}

/* Mobile: drop the desktop frame styling — MobilePageStack provides the chrome */
@media (max-width: 768px) {
  .compendium-modal {
    background: transparent;
    border: none;
    border-radius: 0;
    height: 100%;
    max-height: none;
  }

  .modal-header {
    display: none;
  }

  .tab-strip {
    padding: 0;
  }

  .tab-btn {
    flex: 1;
    justify-content: center;
    padding: var(--space-2) var(--space-2);
    font-size: var(--text-sm);
  }

  .tab-label {
    display: none;
  }

  .tab-icon {
    font-size: var(--text-xl);
  }
}
</style>
