<script setup lang="ts">
import { computed } from 'vue'
import type { StatModifiers, RaceAbility } from '@game/data/races'
import { Icons } from '@/ui/icons'
import EssenceCard from './EssenceCard.vue'
import Icon from '../common/Icon.vue'
import { classSymbol, heroCategoryLabel, letterGlyph } from '../heroes/hero-symbols'

const props = defineProps<{
  id: string
  name: string
  description: string
  isUnlocked: boolean
  cost: number
  canAfford: boolean
  unlockCondition?: string
  mythic?: boolean
  meetsCondition?: boolean
  type: 'race' | 'class' | 'booster'
  /** Icon for boosters (carried in data). Races/classes resolve their own. */
  icon?: string
  /** Pre-formatted prerequisite name(s), e.g. "Sharpened Blade". */
  prereq?: string
  // Extended data for tooltips (race/class only)
  stats?: StatModifiers
  hitdie?: number
  infravision?: number
  expPenalty?: number
  abilities?: RaceAbility[]
  maxAttacks?: number
  primaryStat?: string
  usesMagic?: boolean
  botBehavior?: string
}>()

const emit = defineEmits<{
  unlock: [id: string]
}>()

const canUnlock = computed(
  () => !props.isUnlocked && props.canAfford && props.meetsCondition !== false
)

// Classes carry an iconify symbol; races fall back to a first-letter glyph;
// boosters bring their own icon from data. Mirrors the Heroes compendium.
const resolvedIcon = computed(() => {
  if (props.type === 'class') return classSymbol(props.id) ?? undefined
  if (props.type === 'booster') return props.icon
  return undefined
})
const resolvedGlyph = computed(() => {
  if (props.type === 'race') return letterGlyph(props.name)
  if (props.type === 'class' && !classSymbol(props.id)) return letterGlyph(props.name)
  return undefined
})

const state = computed(() => {
  if (props.isUnlocked) return 'unlocked' as const
  if (props.meetsCondition === false) return 'locked' as const
  return canUnlock.value ? ('afford' as const) : ('cantafford' as const)
})

const hasDetail = computed(() => props.stats !== undefined)

function formatStat(value: number): string {
  return value > 0 ? `+${value}` : String(value)
}
function statClass(value: number): string {
  if (value > 0) return 'stat-positive'
  if (value < 0) return 'stat-negative'
  return 'stat-neutral'
}

function handleUnlock() {
  if (canUnlock.value) emit('unlock', props.id)
}
</script>

<template>
  <EssenceCard
    :icon="resolvedIcon"
    :glyph="resolvedGlyph"
    :name="name"
    :state="state"
    :actionable="canUnlock"
    :clamp-sub="false"
    cost-placement="header"
    :edge="mythic"
    @action="handleUnlock"
  >
    <template v-if="mythic" #corner>{{ heroCategoryLabel('mythic') }}</template>

    <template #sub>
      <div class="unlock-desc">{{ description }}</div>
      <div v-if="!isUnlocked && prereq" class="unlock-prereq">Requires: {{ prereq }}</div>
      <div v-if="!isUnlocked && meetsCondition === false && unlockCondition" class="unlock-cond">
        {{ unlockCondition }}
      </div>
    </template>

    <template #cost>
      <template v-if="isUnlocked"><Icon :name="Icons.check" /></template>
      <template v-else>
        <Icon :name="Icons.essence" />
        <span>{{ cost.toLocaleString() }}</span>
      </template>
    </template>

    <template #content>
      <div class="tt-header">{{ name }}</div>
      <span class="game-tooltip-text">{{ description }}</span>
    </template>

    <template v-if="hasDetail" #extended>
      <div v-if="stats" class="tt-stats">
        <span :class="statClass(stats.str)">STR {{ formatStat(stats.str) }}</span>
        <span :class="statClass(stats.int)">INT {{ formatStat(stats.int) }}</span>
        <span :class="statClass(stats.wis)">WIS {{ formatStat(stats.wis) }}</span>
        <span :class="statClass(stats.dex)">DEX {{ formatStat(stats.dex) }}</span>
        <span :class="statClass(stats.con)">CON {{ formatStat(stats.con) }}</span>
      </div>

      <template v-if="type === 'race'">
        <div class="tt-row">
          <span class="tt-label">Hit Die</span><span class="tt-val">+{{ hitdie }}</span>
        </div>
        <div v-if="infravision && infravision > 0" class="tt-row">
          <span class="tt-label">Infravision</span
          ><span class="tt-val">{{ infravision * 10 }}ft</span>
        </div>
        <div v-if="expPenalty && expPenalty !== 100" class="tt-row">
          <span class="tt-label">XP Cost</span><span class="tt-val">{{ expPenalty }}%</span>
        </div>
      </template>

      <template v-if="type === 'class'">
        <div class="tt-row">
          <span class="tt-label">Hit Die</span>
          <span class="tt-val"
            >{{ hitdie !== undefined && hitdie >= 0 ? '+' : '' }}{{ hitdie }}</span
          >
        </div>
        <div class="tt-row">
          <span class="tt-label">Max Attacks</span
          ><span class="tt-val">{{ maxAttacks }}/round</span>
        </div>
        <div class="tt-row">
          <span class="tt-label">Primary</span
          ><span class="tt-val">{{ primaryStat?.toUpperCase() }}</span>
        </div>
        <div class="tt-row">
          <span class="tt-label">Magic</span
          ><span class="tt-val">{{ usesMagic ? 'Yes' : 'No' }}</span>
        </div>
      </template>

      <div v-if="abilities && abilities.length > 0" class="tt-block">
        <div class="tt-block-head">Abilities</div>
        <div v-for="ability in abilities" :key="ability.id" class="tt-ability">
          <span class="tt-ability-name">{{ ability.name }}</span>
          <span class="tt-muted">{{ ability.description }}</span>
        </div>
      </div>

      <div v-if="botBehavior" class="tt-block">
        <div class="tt-block-head">Bot AI</div>
        <span class="tt-muted">{{ botBehavior }}</span>
      </div>
    </template>
  </EssenceCard>
</template>

<style scoped>
.unlock-desc {
  font-size: var(--text-base);
  color: var(--text-secondary);
  line-height: 1.4;
}

.unlock-prereq {
  font-size: var(--text-sm);
  color: var(--warning);
  font-style: italic;
  margin-top: 2px;
}

.unlock-cond {
  font-size: var(--text-sm);
  color: var(--warning);
  font-style: italic;
  opacity: 0.85;
  margin-top: 2px;
}

/* tooltip detail blocks (rendered inside GameTooltip's teleported node, but
   these elements carry this component's scope id, so scoped rules apply) */
.tt-stats {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-3);
  margin-bottom: var(--space-2);
  font-size: var(--text-base);
}
.stat-positive {
  color: var(--success);
}
.stat-negative {
  color: var(--danger);
}
.stat-neutral {
  color: var(--text-dim);
}
.tt-block {
  margin-top: var(--space-2);
  padding-top: var(--space-1);
  border-top: 1px solid var(--border);
}
.tt-block-head {
  font-size: var(--text-sm);
  color: var(--essence);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: var(--space-1);
}
.tt-ability {
  display: flex;
  flex-direction: column;
  margin-bottom: var(--space-1);
}
.tt-ability-name {
  font-weight: bold;
  color: var(--info);
}
</style>
