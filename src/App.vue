<script setup lang="ts">
import { ref } from 'vue'
import AppHeader from './ui/components/layout/AppHeader.vue'
import AppFeed from './ui/components/layout/AppFeed.vue'
import Sidebar from './ui/components/Sidebar.vue'
import RunArea from './ui/components/RunArea.vue'
import SettingsPanel from './ui/components/settings/SettingsPanel.vue'
import { useKeyboard } from './ui/composables/useKeyboard'
import { usePersistence } from './ui/composables/usePersistence'

// Enable keyboard shortcuts
useKeyboard()

// Enable persistence (auto-save/load)
usePersistence()

// Modal state
const showSettings = ref(false)

function handleOpenSettings() {
  showSettings.value = true
}

function handleCloseSettings() {
  showSettings.value = false
}

function handleOpenHelp() {
  // Help modal could be implemented similarly
  console.log('Help requested')
}
</script>

<template>
  <div class="app-layout">
    <AppHeader class="header" @open-settings="handleOpenSettings" @open-help="handleOpenHelp" />
    <main class="game">
      <RunArea />
    </main>
    <aside class="sidebar">
      <Sidebar />
    </aside>
    <AppFeed class="feed" />

    <!-- Settings Modal -->
    <Teleport to="body">
      <div v-if="showSettings" class="modal-overlay" @click="handleCloseSettings">
        <div class="modal-container" @click.stop>
          <SettingsPanel @close="handleCloseSettings" />
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.app-layout {
  display: grid;
  grid-template-rows: 48px 1fr 48px;
  grid-template-columns: 1fr 280px;
  grid-template-areas:
    'header  header'
    'game    sidebar'
    'feed    feed';
  height: 100vh;
  gap: 1px;
  background: var(--border);
}

.header {
  grid-area: header;
}

.game {
  grid-area: game;
  background: var(--void);
  overflow: hidden;
}

.sidebar {
  grid-area: sidebar;
  background: var(--panel);
  overflow-y: auto;
}

.feed {
  grid-area: feed;
}

/* Responsive: narrower screens */
@media (max-width: 1199px) {
  .app-layout {
    grid-template-columns: 1fr 240px;
  }
}

/* Mobile: hide sidebar */
@media (max-width: 768px) {
  .app-layout {
    grid-template-columns: 1fr;
    grid-template-areas:
      'header'
      'game'
      'feed';
  }

  .sidebar {
    display: none;
  }
}

/* Modal styles */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(10, 10, 18, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-container {
  width: 100%;
  max-width: 600px;
  max-height: 80vh;
  margin: 20px;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}
</style>
