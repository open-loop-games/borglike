<script setup lang="ts">
const props = defineProps<{
  id: string
  name: string
  description: string
  isUnlocked: boolean
  cost: number
  canAfford: boolean
  unlockCondition?: string
  prestige?: boolean
  type: 'race' | 'class'
}>()

const emit = defineEmits<{
  unlock: [id: string, type: 'race' | 'class']
}>()

function handleUnlock() {
  if (!props.isUnlocked && props.canAfford) {
    emit('unlock', props.name, props.type)
  }
}
</script>

<template>
  <div
    class="unlock-item"
    :class="{
      'is-unlocked': isUnlocked,
      'can-afford': canAfford && !isUnlocked,
      'cannot-afford': !canAfford && !isUnlocked,
      'is-prestige': prestige,
    }"
    @click="handleUnlock"
  >
    <div class="unlock-badge">
      <span v-if="isUnlocked" class="badge-icon unlocked">&#x2713;</span>
      <span v-else-if="prestige" class="badge-icon prestige">&#x2605;</span>
      <span v-else class="badge-icon locked">&#x25CF;</span>
    </div>

    <div class="unlock-info">
      <div class="unlock-header">
        <span class="unlock-name">{{ name }}</span>
        <span v-if="prestige" class="prestige-tag">Prestige</span>
      </div>
      <div class="unlock-desc">{{ description }}</div>
    </div>

    <div class="unlock-status">
      <span v-if="isUnlocked" class="status-unlocked">&#x2713;</span>
      <template v-else>
        <button class="unlock-btn" :disabled="!canAfford">
          <span class="cost-icon">&#x25C6;</span>
          <span>{{ cost.toLocaleString() }}</span>
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.unlock-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: linear-gradient(135deg, rgba(26, 26, 46, 0.95) 0%, rgba(18, 18, 31, 0.98) 100%);
  border: 1px solid var(--border);
  border-radius: 4px;
  transition: all 0.2s;
}

.unlock-item.can-afford {
  cursor: pointer;
  border-color: var(--cyan);
}

.unlock-item.can-afford:hover {
  background: linear-gradient(135deg, rgba(6, 182, 212, 0.1) 0%, rgba(26, 26, 46, 0.95) 100%);
  box-shadow: 0 0 12px rgba(6, 182, 212, 0.2);
}

.unlock-item.is-unlocked {
  opacity: 0.6;
}

.unlock-item.cannot-afford {
  opacity: 0.5;
}

.unlock-item.is-prestige {
  border-color: var(--amber);
}

.unlock-item.is-prestige.can-afford:hover {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(26, 26, 46, 0.95) 100%);
  box-shadow: 0 0 12px rgba(245, 158, 11, 0.2);
}

.unlock-badge {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.badge-icon {
  font-size: 14px;
}

.badge-icon.unlocked {
  color: var(--green);
  text-shadow: 0 0 6px rgba(34, 197, 94, 0.6);
}

.badge-icon.prestige {
  color: var(--amber);
  text-shadow: 0 0 6px rgba(245, 158, 11, 0.6);
}

.badge-icon.locked {
  color: var(--text-dim);
}

.unlock-info {
  flex: 1;
  min-width: 0;
}

.unlock-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
}

.unlock-name {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: bold;
  color: var(--text-primary);
}

.is-unlocked .unlock-name {
  color: var(--text-secondary);
}

.prestige-tag {
  font-size: 8px;
  padding: 1px 4px;
  background: rgba(245, 158, 11, 0.2);
  border: 1px solid var(--amber);
  border-radius: 2px;
  color: var(--amber);
  text-transform: uppercase;
}

.unlock-desc {
  font-size: 10px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.unlock-status {
  flex-shrink: 0;
}

.status-unlocked {
  color: var(--green);
  font-size: 16px;
  text-shadow: 0 0 6px rgba(34, 197, 94, 0.5);
}

.unlock-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: var(--highlight);
  border: 1px solid var(--border);
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.unlock-btn:not(:disabled):hover {
  background: var(--cyan);
  border-color: var(--cyan);
  color: white;
}

.is-prestige .unlock-btn:not(:disabled):hover {
  background: var(--amber);
  border-color: var(--amber);
}

.unlock-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.cost-icon {
  color: var(--purple);
  font-size: 9px;
}

.unlock-btn:not(:disabled):hover .cost-icon {
  color: white;
}
</style>
