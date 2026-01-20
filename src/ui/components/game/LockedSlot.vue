<script setup lang="ts">
import { computed } from 'vue'
import { useProgressionStore } from '@/stores/progression'

const props = defineProps<{
  slot: number
}>()

const progression = useProgressionStore()

// Map slot number to upgrade ID
const slotUpgradeId = computed(() => {
  switch (props.slot) {
    case 1:
      return 'run_slot_2'
    case 2:
      return 'run_slot_3'
    case 3:
      return 'run_slot_4'
    default:
      return null
  }
})

const upgradeInfo = computed(() => {
  if (!slotUpgradeId.value) return null
  return progression.allUpgrades.find((u) => u.id === slotUpgradeId.value)
})

const cost = computed(() => upgradeInfo.value?.cost ?? 0)
const canAfford = computed(() => progression.currency.essence >= cost.value)

function handleUnlock() {
  if (slotUpgradeId.value && canAfford.value) {
    progression.purchaseUpgrade(slotUpgradeId.value)
  }
}
</script>

<template>
  <div class="locked-slot">
    <div class="slot-header">
      <span class="slot-number">Slot {{ slot + 1 }}</span>
      <span class="locked-badge">LOCKED</span>
    </div>

    <div class="lock-content">
      <div class="lock-icon">&#x1F512;</div>

      <div class="unlock-info">
        <p class="unlock-text">Unlock this slot to run multiple dungeons simultaneously</p>

        <button
          class="unlock-btn"
          :class="{ 'can-afford': canAfford }"
          :disabled="!canAfford"
          @click="handleUnlock"
        >
          <span class="cost-icon">&#x25C6;</span>
          <span class="cost-amount">{{ cost.toLocaleString() }}</span>
          <span class="cost-label">Unlock</span>
        </button>

        <p v-if="!canAfford" class="need-more">
          Need {{ (cost - progression.currency.essence).toLocaleString() }} more essence
        </p>
      </div>
    </div>

    <div class="slot-decoration">
      <span class="deco-char">?</span>
    </div>
  </div>
</template>

<style scoped>
.locked-slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  background: linear-gradient(135deg, rgba(10, 10, 18, 0.95) 0%, rgba(18, 18, 31, 0.9) 100%);
  position: relative;
}

.slot-header {
  position: absolute;
  top: 12px;
  left: 12px;
  right: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.slot-number {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.locked-badge {
  font-family: var(--font-mono);
  font-size: 9px;
  padding: 2px 6px;
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 2px;
  color: var(--red);
  letter-spacing: 1px;
}

.lock-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  z-index: 1;
}

.lock-icon {
  font-size: 32px;
  opacity: 0.6;
}

.unlock-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  text-align: center;
  max-width: 200px;
}

.unlock-text {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.4;
}

.unlock-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  background: var(--highlight);
  border: 1px solid var(--border);
  border-radius: 4px;
  font-family: var(--font-mono);
  cursor: pointer;
  transition: all 0.2s;
}

.unlock-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.unlock-btn.can-afford {
  border-color: var(--purple);
}

.unlock-btn.can-afford:hover {
  background: var(--purple);
  box-shadow: 0 0 16px rgba(139, 92, 246, 0.3);
}

.cost-icon {
  font-size: 12px;
  color: var(--purple);
}

.unlock-btn.can-afford:hover .cost-icon {
  color: white;
}

.cost-amount {
  font-size: 14px;
  font-weight: bold;
  color: var(--purple);
}

.unlock-btn.can-afford:hover .cost-amount {
  color: white;
}

.cost-label {
  font-size: 11px;
  color: var(--text-secondary);
}

.unlock-btn.can-afford:hover .cost-label {
  color: rgba(255, 255, 255, 0.8);
}

.need-more {
  font-size: 10px;
  color: var(--text-dim);
  margin: 0;
  font-style: italic;
}

.slot-decoration {
  position: absolute;
  bottom: 15%;
  opacity: 0.03;
  pointer-events: none;
}

.deco-char {
  font-family: var(--font-mono);
  font-size: 150px;
  color: var(--text-dim);
}
</style>
