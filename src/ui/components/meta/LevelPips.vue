<script setup lang="ts">
import { computed } from 'vue'

// Discrete level readout that stays pip-shaped at every scale. Up to 5 levels
// each pip is one level (2-state). Past that (the maxLevel-10 chains) each pip
// covers 2 levels and renders empty / half / full — so 10 levels read as 5
// three-state pips rather than switching grammar to a smooth bar.
const PIP_CAP = 5

const props = defineProps<{
  current: number
  max: number
  maxed?: boolean
}>()

const groupSize = computed(() => (props.max > PIP_CAP ? Math.ceil(props.max / PIP_CAP) : 1))
const pips = computed(() => {
  const g = groupSize.value
  const count = Math.ceil(props.max / g)
  return Array.from({ length: count }, (_, i) => {
    const filled = Math.min(g, Math.max(0, props.current - i * g))
    return filled / g // 0, 0.5 (half), or 1
  })
})
</script>

<template>
  <span class="lvl-pips" :class="{ 'is-maxed': maxed }">
    <span class="pip-row">
      <span
        v-for="(frac, i) in pips"
        :key="i"
        class="pip"
        :class="{ full: frac >= 1, partial: frac > 0 && frac < 1 }"
      >
        <span class="pip-fill" :style="{ width: frac * 100 + '%' }" />
      </span>
    </span>
    <span class="count">{{ current }}/{{ max }}</span>
  </span>
</template>

<style scoped>
.lvl-pips {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  white-space: nowrap;
}

.pip-row {
  display: inline-flex;
  gap: 3px;
}

.pip {
  width: 8px;
  height: 8px;
  border-radius: 1px;
  border: 1px solid var(--text-dim);
  overflow: hidden;
}

.pip-fill {
  display: block;
  height: 100%;
  background: var(--essence-light);
}

.pip.full {
  border-color: var(--essence-light);
  box-shadow: 0 0 4px color-mix(in srgb, var(--essence) 60%, transparent);
}

.pip.partial {
  border-color: color-mix(in srgb, var(--essence-light) 65%, var(--text-dim));
}

.is-maxed .pip-fill {
  background: var(--success);
}

.is-maxed .pip.full {
  border-color: var(--success);
  box-shadow: 0 0 4px color-mix(in srgb, var(--success) 60%, transparent);
}

.count {
  font-size: var(--text-sm);
  color: var(--text-dim);
  font-variant-numeric: tabular-nums;
}

.is-maxed .count {
  color: var(--success);
}
</style>
