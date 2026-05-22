<script setup lang="ts">
import { computed } from 'vue'
import { useProgressionStore } from '@/stores/progression'
import { Icons } from '@/ui/icons'
import Icon from '../common/Icon.vue'

const props = defineProps<{
  slot: number
}>()

const progression = useProgressionStore()

// Slot index → upgrade id. Slot 1 has no unlock (always available).
const upgradeId = computed(() => `run_slot_${props.slot + 1}`)

const cost = computed(() => progression.getUpgradeCost(upgradeId.value))
const essence = computed(() => progression.currency.essence)
const canAfford = computed(() => progression.canAffordUpgrade(upgradeId.value))

const progress = computed(() => {
  if (cost.value === Infinity || cost.value === 0) return 0
  return Math.min(1, essence.value / cost.value)
})

const progressPct = computed(() => `${Math.floor(progress.value * 100)}%`)

function handleUnlock() {
  if (!canAfford.value) return
  progression.purchaseUpgrade(upgradeId.value)
}
</script>

<template>
  <div class="locked-slot">
    <div class="slot-header">
      <span class="slot-number">Slot {{ slot + 1 }}</span>
      <Icon class="lock-icon" :name="Icons.lock" />
    </div>

    <div class="slot-content">
      <div class="locked-body">
        <div class="cost-line">
          <Icon class="essence-icon" :name="Icons.essence" />
          <span class="essence-current">{{ essence.toLocaleString() }}</span>
          <span class="essence-sep">/</span>
          <span class="essence-target">{{ cost.toLocaleString() }}</span>
        </div>

        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: progressPct }"></div>
        </div>

        <button class="unlock-btn" :disabled="!canAfford" @click="handleUnlock">
          {{ canAfford ? 'Unlock' : 'Locked' }}
        </button>
      </div>
    </div>

    <div class="slot-decoration">
      <span class="deco-char">@</span>
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
  background: radial-gradient(
    ellipse at center,
    color-mix(in srgb, var(--text-dim) 4%, transparent) 0%,
    transparent 70%
  );
  position: relative;
  opacity: 0.85;
}

.slot-header {
  position: absolute;
  top: var(--space-3);
  left: var(--space-3);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.slot-number {
  font-size: var(--text-base);
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.lock-icon {
  font-size: var(--text-base);
  color: var(--text-dim);
}

.slot-content {
  z-index: 1;
}

.locked-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  min-width: 240px;
}

.cost-line {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-lg);
}

.essence-icon {
  color: var(--essence);
  font-size: var(--text-lg);
}

.essence-current {
  color: var(--text-primary);
  font-weight: bold;
}

.essence-sep {
  color: var(--text-dim);
}

.essence-target {
  color: var(--text-secondary);
}

.progress-bar {
  width: 220px;
  height: 6px;
  background: var(--bg-highlight);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--essence) 70%, transparent) 0%,
    var(--essence) 100%
  );
  transition: width 0.3s ease;
}

.unlock-btn {
  padding: var(--space-2) var(--space-5);
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-dim);
  font-size: var(--text-base);
  border-radius: var(--radius-md);
  cursor: not-allowed;
  transition: all 0.2s;
}

.unlock-btn:not(:disabled) {
  border-color: var(--essence);
  color: var(--essence);
  cursor: pointer;
  background: color-mix(in srgb, var(--essence) 10%, transparent);
}

.unlock-btn:not(:disabled):hover {
  background: color-mix(in srgb, var(--essence) 25%, transparent);
  box-shadow: 0 0 16px color-mix(in srgb, var(--essence) 30%, transparent);
}

.slot-decoration {
  position: absolute;
  bottom: 20%;
  opacity: 0.03;
  pointer-events: none;
}

.deco-char {
  font-size: 120px;
  color: var(--text-dim);
}
</style>
