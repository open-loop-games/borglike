<script setup lang="ts">
import { computed } from 'vue'
import type { ItemTemplate } from '@/game/data/items'
import type { ArtifactTemplate } from '@/game/data/artifacts'
import type { ArmoryEntry } from '@/types/progression'

interface Props {
  item: ItemTemplate | ArtifactTemplate
  entry?: ArmoryEntry
  isArtifact?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  click: []
}>()

const isDiscovered = computed(() => !!props.entry)

// Get glyph for item type
function getGlyph(item: ItemTemplate | ArtifactTemplate): string {
  if ('slot' in item && !('type' in item)) {
    // Artifact - use slot to determine glyph
    const slotGlyphs: Record<string, string> = {
      weapon: '/',
      body: '[',
      shield: ')',
      helm: ']',
      gloves: '(',
      boots: '{',
      ring: '=',
      amulet: '"',
      light: '~',
    }
    return slotGlyphs[item.slot] ?? '*'
  }
  // Regular item template
  const typeGlyphs: Record<string, string> = {
    weapon: '/',
    bow: '}',
    armor: '[',
    shield: ')',
    helm: ']',
    gloves: '(',
    boots: '{',
    ring: '=',
    amulet: '"',
    light: '~',
    potion: '!',
    scroll: '?',
  }
  return typeGlyphs[(item as ItemTemplate).type] ?? '*'
}

// Get color based on tier
function getColor(item: ItemTemplate | ArtifactTemplate, isArtifact: boolean): string {
  if (isArtifact) return '#fbbf24' // Gold for artifacts
  const tier = (item as ItemTemplate).tier ?? 4
  const tierColors: Record<number, string> = {
    1: '#9ca3af', // Gray/white
    2: '#22c55e', // Green
    3: '#3b82f6', // Blue
    4: '#a855f7', // Purple
  }
  return tierColors[tier] ?? '#ffffff'
}

const glyph = computed(() => getGlyph(props.item))
const color = computed(() => getColor(props.item, props.isArtifact ?? false))
const itemName = computed(() => props.item.name)
const tier = computed(() => (props.item as ItemTemplate).tier ?? 4)
</script>

<template>
  <div
    class="item-card"
    :class="{ locked: !isDiscovered, artifact: isArtifact }"
    @click="emit('click')"
  >
    <div class="card-content">
      <div class="item-symbol" :style="{ color: isDiscovered ? color : '#4b5563' }">
        {{ isDiscovered ? glyph : '?' }}
      </div>
      <div class="item-name">
        {{ isDiscovered ? itemName : 'Unknown' }}
      </div>
      <div v-if="isDiscovered && entry" class="discovery-info">
        <span class="depth">D:{{ entry.firstFoundDepth }}</span>
      </div>
      <div v-if="isDiscovered && !isArtifact" class="tier-badge" :class="`tier-${tier}`">
        T{{ tier }}
      </div>
    </div>

    <div v-if="isDiscovered" class="discovered-badge">
      <span>&#x2713;</span>
    </div>
  </div>
</template>

<style scoped>
.item-card {
  background: var(--highlight);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  overflow: hidden;
}

.item-card:hover {
  background: var(--border);
  transform: translateY(-2px);
}

.item-card.locked {
  filter: grayscale(0.7);
  opacity: 0.6;
}

.item-card.artifact {
  border-color: #fbbf24;
  box-shadow: 0 0 8px rgba(251, 191, 36, 0.3);
}

.card-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.item-symbol {
  font-family: var(--font-mono);
  font-size: 32px;
  font-weight: bold;
  line-height: 1;
  text-shadow: 0 0 8px currentColor;
}

.item-name {
  font-size: 11px;
  color: var(--text-primary);
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.item-card.locked .item-name {
  color: var(--text-dim);
  font-style: italic;
}

.discovery-info {
  display: flex;
  gap: 8px;
  font-size: 10px;
  color: var(--text-dim);
  margin-top: 2px;
}

.depth {
  padding: 1px 4px;
  background: var(--void);
  border-radius: 2px;
}

.tier-badge {
  font-size: 9px;
  font-weight: bold;
  padding: 2px 6px;
  border-radius: 3px;
  margin-top: 4px;
}

.tier-badge.tier-1 {
  color: #9ca3af;
  background: rgba(156, 163, 175, 0.15);
}

.tier-badge.tier-2 {
  color: #22c55e;
  background: rgba(34, 197, 94, 0.15);
}

.tier-badge.tier-3 {
  color: #3b82f6;
  background: rgba(59, 130, 246, 0.15);
}

.tier-badge.tier-4 {
  color: #a855f7;
  background: rgba(168, 85, 247, 0.15);
}

.discovered-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 18px;
  height: 18px;
  background: var(--green);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: white;
}

.item-card.artifact .discovered-badge {
  background: #fbbf24;
}
</style>
