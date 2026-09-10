<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Icons } from '@/ui/icons'
import { statLabel, type UpgradeEffect } from '@game/data/upgrades'
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
  /** Currency the cost is priced in. Star-tree nodes are bought with stars. */
  costIcon?: string
  // Stat-upgrade tooltip inputs — a numeric effect scaling with level. Absent
  // for behavioural BOT upgrades, which describe themselves through `tiers`.
  effectValue?: number
  costScaling?: number
  effect?: UpgradeEffect
  // BOT-upgrade tooltip inputs. A capability gained in discrete tiers, each with
  // its own behaviour — so the tooltip shows the ladder (owned / next / ahead)
  // instead of a meaningless "+1 per level" formula.
  summary?: string
  tiers?: {
    label: string
    desc: string
    owned: boolean
    isNext: boolean
    cost: number | null
  }[]
}>()

const emit = defineEmits<{
  purchase: [id: string]
}>()

const state = computed(() => {
  if (props.isMaxed) return 'maxed' as const
  return props.canAfford ? ('afford' as const) : ('cantafford' as const)
})

const costText = computed(() => props.cost.toLocaleString())

// One stat component (primary or secondary) as the cumulative bonus reached at
// a given level — e.g. "+16 armor" / "+8% armor". The description above states
// the per-level rule; this tooltip states the resulting total at that level.
type Component = {
  type: 'flat' | 'percent' | 'unlock'
  stat?: string
  baseValue: number
  perLevel: number
}
function formatComponent(comp: Component, level: number): string {
  const value = comp.baseValue + comp.perLevel * (level - 1)
  const unit = comp.type === 'percent' ? '%' : ''
  const label = statLabel(comp.stat)
  return `+${value}${unit}${label ? ` ${label}` : ''}`
}

// The level the effect figure describes: the one being bought, or the current
// (capped) level when maxed.
const effectLevel = computed(() => (props.isMaxed ? props.currentLevel : props.currentLevel + 1))

// Both components folded together, e.g. "+16 armor · +8% armor".
const effectText = computed(() => {
  const e = props.effect
  if (!e || e.type === 'unlock') return ''
  const parts = [formatComponent(e, effectLevel.value)]
  if (e.secondary) parts.push(formatComponent(e.secondary, effectLevel.value))
  return parts.join(' · ')
})

// Cost of the purchase after this one (drives the escalation preview).
const nextCost = computed(() => {
  if (props.currentLevel + 1 >= props.maxLevel) return null
  return Math.ceil(props.cost * (props.costScaling ?? 1))
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
    :tooltip-max-width="tiers ? 320 : effect?.secondary ? 300 : undefined"
    @action="handlePurchase"
  >
    <template #meta>
      <LevelPips :current="currentLevel" :max="maxLevel" :maxed="isMaxed" />
    </template>

    <template #cost>
      <template v-if="isMaxed">MAX</template>
      <template v-else>
        <Icon :name="costIcon ?? Icons.essence" />
        <span>{{ costText }}</span>
      </template>
    </template>

    <template #content>
      <div class="tt-header">{{ name }}</div>
      <span class="game-tooltip-text">{{ summary ?? description }}</span>
    </template>

    <!-- BOT upgrades: the capability ladder — what the bot already does (✓),
         what this purchase grants (▸ + cost), and what's still ahead. -->
    <template v-if="tiers" #extended>
      <div
        v-for="tier in tiers"
        :key="tier.label || 'on'"
        class="tt-tier"
        :class="{ 'tt-tier--owned': tier.owned, 'tt-tier--next': tier.isNext }"
      >
        <span class="tt-tier-mark">{{ tier.owned ? '✓' : tier.isNext ? '▸' : '' }}</span>
        <span class="tt-tier-text">
          <span v-if="tier.label" class="tt-tier-rank">{{ tier.label }}</span
          >{{ tier.desc }}
        </span>
        <span v-if="tier.isNext && tier.cost !== null" class="tt-tier-cost">
          <Icon :name="Icons.essence" /> {{ tier.cost.toLocaleString() }}
        </span>
      </div>
    </template>

    <!-- Stat / meta / qol upgrades: the effect you reach at the next level
         (grouped first), then the cost trajectory with cost-scaling inline. -->
    <template v-else-if="effect && effect.type !== 'unlock'" #extended>
      <div class="tt-row">
        <span class="tt-label">{{
          isMaxed ? `At max (Lv ${maxLevel})` : `At Lv ${currentLevel + 1}`
        }}</span>
        <span class="tt-val">{{ effectText }}</span>
      </div>
      <template v-if="!isMaxed">
        <div class="tt-row tt-row--group">
          <span class="tt-label">Cost</span>
          <span class="tt-val"><Icon :name="Icons.essence" /> {{ costText }}</span>
        </div>
        <div v-if="nextCost !== null" class="tt-row">
          <span class="tt-label">Next</span>
          <span class="tt-val">
            <Icon :name="Icons.essence" /> {{ nextCost.toLocaleString() }}
            <span class="tt-scale">&times;{{ costScaling }}</span>
          </span>
        </div>
      </template>
    </template>
  </EssenceCard>
</template>
