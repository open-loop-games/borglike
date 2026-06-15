<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Icons } from '@/ui/icons'
import EssenceCard from './EssenceCard.vue'
import LevelPips from './LevelPips.vue'
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

const state = computed(() => {
  if (props.isMaxed) return 'maxed' as const
  return props.canAfford ? ('afford' as const) : ('cantafford' as const)
})

const costText = computed(() => props.cost.toLocaleString())

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

// Newly-affordable reveal: pulse once when a card crosses into affordable as
// essence ticks up — the genre's core dopamine beat.
const fresh = ref(false)
watch(
  () => props.canAfford,
  (now, prev) => {
    if (now && !prev && !props.isMaxed) {
      fresh.value = true
      setTimeout(() => (fresh.value = false), 1600)
    }
  }
)

function handlePurchase() {
  if (!props.isMaxed && props.canAfford) emit('purchase', props.id)
}
</script>

<template>
  <EssenceCard
    :icon="icon"
    :name="name"
    :state="state"
    :description="description"
    :fresh="fresh"
    :actionable="canAfford && !isMaxed"
    @action="handlePurchase"
  >
    <template #meta>
      <LevelPips :current="currentLevel" :max="maxLevel" :maxed="isMaxed" />
    </template>

    <template #cost>
      <template v-if="isMaxed">MAX</template>
      <template v-else>
        <Icon :name="Icons.essence" />
        <span>{{ costText }}</span>
      </template>
    </template>

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
  </EssenceCard>
</template>
