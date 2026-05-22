<script setup lang="ts">
import { computed } from 'vue'
import { Icons } from '@/ui/icons'
import ProgressBar from '../common/ProgressBar.vue'
import GameTooltip from '../common/GameTooltip.vue'
import Icon from '../common/Icon.vue'

const props = defineProps<{
  id: string
  name: string
  description: string
  icon: string
  currentLevel: number
  maxLevel: number
  cost: number
  canAfford: boolean
  isMaxed: boolean
  effectValue: number
  costScaling: number
  effect: {
    type: 'flat' | 'percent' | 'unlock'
    stat?: string
    baseValue: number
    perLevel: number
  }
}>()

const emit = defineEmits<{
  purchase: [id: string]
}>()

const effectText = computed(() => {
  if (props.effect.type === 'unlock') {
    return props.currentLevel > 0 ? 'Unlocked' : 'Locked'
  }
  if (props.effectValue === 0) return 'Not purchased'
  const suffix = props.effect.type === 'percent' ? '%' : ''
  return `+${props.effectValue}${suffix}`
})

const costText = computed(() => {
  if (props.isMaxed) return 'MAX'
  return props.cost.toLocaleString()
})

// Extended tooltip: next level effect value
const nextLevelEffect = computed(() => {
  if (props.isMaxed || props.effect.type === 'unlock') return null
  const nextLevel = props.currentLevel + 1
  return props.effect.baseValue + props.effect.perLevel * (nextLevel - 1)
})

// Extended tooltip: next level cost (for level after current purchase)
const nextNextCost = computed(() => {
  if (props.currentLevel + 1 >= props.maxLevel) return null
  return Math.ceil(props.cost * props.costScaling)
})

function handlePurchase() {
  if (!props.isMaxed && props.canAfford) {
    emit('purchase', props.id)
  }
}
</script>

<template>
  <GameTooltip
    class="upgrade-item"
    :class="{
      'is-maxed': isMaxed,
      'can-afford': canAfford && !isMaxed,
      'cannot-afford': !canAfford && !isMaxed,
    }"
    position="left"
    :max-width="260"
  >
    <div class="upgrade-icon"><Icon :name="icon" /></div>

    <div class="upgrade-info">
      <div class="upgrade-header">
        <span class="upgrade-name">{{ name }}</span>
        <span class="upgrade-level">{{ currentLevel }}/{{ maxLevel }}</span>
      </div>

      <div class="upgrade-desc">{{ description }}</div>

      <div class="upgrade-progress">
        <ProgressBar :current="currentLevel" :max="maxLevel" variant="upgrade" size="sm" />
      </div>
    </div>

    <div class="upgrade-action">
      <div class="effect-value">{{ effectText }}</div>
      <button class="purchase-btn" :disabled="isMaxed || !canAfford" @click="handlePurchase">
        <Icon v-if="!isMaxed" class="cost-icon" :name="Icons.essence" />
        <span class="cost-text">{{ costText }}</span>
      </button>
    </div>

    <template #content>
      <div class="tt-header">{{ name }}</div>
      <span class="game-tooltip-text">{{ description }}</span>
    </template>

    <template v-if="effect.type !== 'unlock'" #extended>
      <div class="tt-row">
        <span class="tt-label">Formula</span>
        <span class="tt-val">{{ effect.baseValue }} + {{ effect.perLevel }}/lvl</span>
      </div>
      <div v-if="effect.stat" class="tt-row">
        <span class="tt-label">Stat</span>
        <span class="tt-val">{{ effect.stat }}</span>
      </div>
      <div class="tt-row">
        <span class="tt-label">Scaling</span>
        <span class="tt-val">&times;{{ costScaling }} per level</span>
      </div>
      <template v-if="!isMaxed">
        <div v-if="nextLevelEffect !== null" class="tt-row">
          <span class="tt-label">Next (Lv{{ currentLevel + 1 }})</span>
          <span class="tt-val"
            >+{{ nextLevelEffect }}{{ effect.type === 'percent' ? '%' : '' }}</span
          >
        </div>
        <div v-if="nextNextCost !== null" class="tt-row">
          <span class="tt-label">After that</span>
          <span class="tt-val"
            ><Icon :name="Icons.essence" /> {{ nextNextCost.toLocaleString() }}</span
          >
        </div>
      </template>
    </template>
  </GameTooltip>
</template>

<style scoped>
.upgrade-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2);
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--bg-elevated) 95%, transparent) 0%,
    color-mix(in srgb, var(--bg-panel) 98%, transparent) 100%
  );
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  transition: all 0.2s;
}

.upgrade-item.can-afford {
  border-color: var(--essence);
  cursor: pointer;
}

.upgrade-item.can-afford:hover {
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--essence) 10%, transparent) 0%,
    color-mix(in srgb, var(--bg-elevated) 95%, transparent) 100%
  );
  box-shadow: 0 0 12px color-mix(in srgb, var(--essence) 20%, transparent);
}

.upgrade-item.is-maxed {
  opacity: 0.8;
}

.upgrade-item.cannot-afford {
  border-color: var(--border);
}

.cannot-afford .upgrade-name {
  color: var(--text-secondary);
}

.cannot-afford .upgrade-icon {
  opacity: 0.5;
}

.upgrade-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-2xl);
  background: var(--bg-highlight);
  border-radius: var(--radius-md);
  flex-shrink: 0;
}

.can-afford .upgrade-icon {
  color: var(--essence);
  text-shadow: 0 0 8px color-mix(in srgb, var(--essence) 60%, transparent);
}

.is-maxed .upgrade-icon {
  color: var(--success);
  text-shadow: 0 0 8px color-mix(in srgb, var(--success) 60%, transparent);
}

.upgrade-info {
  flex: 1;
  min-width: 0;
}

.upgrade-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2px;
}

.upgrade-name {
  font-size: var(--text-base);
  font-weight: bold;
  color: var(--text-primary);
}

.upgrade-level {
  font-size: var(--text-base);
  color: var(--text-dim);
}

.upgrade-desc {
  font-size: var(--text-base);
  color: var(--text-secondary);
  margin-bottom: var(--space-1);
}

.upgrade-progress {
  max-width: 120px;
}

.upgrade-action {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-1);
  flex-shrink: 0;
}

.effect-value {
  font-size: var(--text-base);
  color: var(--info);
}

.is-maxed .effect-value {
  color: var(--success);
  text-shadow: 0 0 6px color-mix(in srgb, var(--success) 40%, transparent);
}

.purchase-btn {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  background: var(--bg-highlight);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.purchase-btn:not(:disabled):hover {
  background: var(--essence);
  border-color: var(--essence);
  color: white;
}

.purchase-btn:disabled {
  cursor: not-allowed;
}

.cost-icon {
  color: var(--essence);
  font-size: var(--text-base);
}

.cannot-afford .cost-icon {
  opacity: 0.5;
  filter: saturate(0.5);
}

.purchase-btn:not(:disabled):hover .cost-icon {
  color: white;
}

.is-maxed .purchase-btn {
  background: color-mix(in srgb, var(--success) 15%, transparent);
  border-color: var(--success);
  color: var(--success);
}
</style>
