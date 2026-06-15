<script setup lang="ts">
import GameTooltip from '../common/GameTooltip.vue'
import Icon from '../common/Icon.vue'

// Shared card grammar for everything bought with essence — leveled upgrades and
// binary unlocks alike. Layout: icon | (title + meta) row, (description + cost
// pill) row. Affordance is carried by the cost pill's weight + glow, not a 1px
// border hue, so it survives the theme-swap palettes and reads at squint size.
type CardState = 'afford' | 'cantafford' | 'maxed' | 'unlocked' | 'locked'

const props = defineProps<{
  /** Iconify name for the icon box. Ignored when `glyph` is set. */
  icon?: string
  /** Plaintext glyph (e.g. a race's first letter) used when there's no icon. */
  glyph?: string
  name: string
  state: CardState
  description?: string
  /** Plays the essence-flush reveal pulse once (newly-affordable beat). */
  fresh?: boolean
  /** Whether the cost pill / card click fires the action. */
  actionable?: boolean
  /** Clamp the description to 2 lines (default). Unlock cards stack a
      "Requires:" line below the description and opt out. */
  clampSub?: boolean
  /** Where the cost pill / check sits. Upgrades keep it in the footer next to
      the pips; unlocks (no pips, taller body) lift it onto the header line, and
      prestige docks it into the bottom-right corner. */
  costPlacement?: 'footer' | 'header' | 'corner'
  /** Warning-toned edge decoration — marks prestige unlocks. */
  edge?: boolean
  tooltipMaxWidth?: number
}>()

const emit = defineEmits<{ action: [] }>()

function fire() {
  if (props.actionable) emit('action')
}
</script>

<template>
  <GameTooltip
    class="ec"
    :class="[
      `ec--${state}`,
      `ec--cost-${costPlacement ?? 'footer'}`,
      { 'ec--fresh': fresh, 'ec--noclamp': clampSub === false, 'ec--edge': edge },
    ]"
    position="left"
    :max-width="tooltipMaxWidth ?? 260"
    :disabled="!$slots.extended"
    @click="fire"
  >
    <div class="ec-icon">
      <Icon v-if="icon" :name="icon" />
      <span v-else-if="glyph" class="ec-glyph">{{ glyph }}</span>
    </div>
    <div class="ec-name">{{ name }}</div>
    <div class="ec-meta"><slot name="meta" /></div>
    <div class="ec-sub">
      <slot name="sub">{{ description }}</slot>
    </div>
    <button class="ec-cost" type="button" :disabled="!actionable" @click.stop="fire">
      <slot name="cost" />
    </button>
    <div v-if="$slots.corner" class="ec-corner"><slot name="corner" /></div>

    <template v-if="$slots.content" #content><slot name="content" /></template>
    <template v-if="$slots.extended" #extended><slot name="extended" /></template>
  </GameTooltip>
</template>

<style scoped>
.ec {
  position: relative;
  display: grid;
  grid-template-columns: 30px 1fr auto;
  gap: 3px var(--space-3);
  align-items: baseline;
  padding: var(--space-2) var(--space-3);
  border: 1px solid transparent;
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--bg-elevated) 60%, transparent);
  transition:
    background 0.2s,
    border-color 0.2s;
}

.ec-icon {
  grid-area: 1 / 1 / 3 / 2;
  align-self: center;
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  background: var(--bg-highlight);
  border-radius: var(--radius-md);
  font-size: var(--text-2xl);
  color: var(--text-muted);
}

.ec-glyph {
  font-size: var(--text-lg);
  font-weight: bold;
}

.ec-name {
  grid-area: 1 / 2;
  font-weight: bold;
  font-size: var(--text-base);
  color: var(--text-primary);
}

.ec-meta {
  grid-area: 1 / 3;
  justify-self: end;
  align-self: center;
}

.ec-sub {
  grid-area: 2 / 2;
  font-size: var(--text-base);
  color: var(--text-muted);
  line-height: 1.4;
  /* Bound card height — the long behavioural BOT lines run 4 deep otherwise.
     Full text is always one hover away in the tooltip. */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.ec--noclamp .ec-sub {
  display: block;
  -webkit-line-clamp: none;
  line-clamp: none;
  overflow: visible;
}

.ec-cost {
  grid-area: 2 / 3;
  justify-self: end;
  align-self: center;
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: 4px var(--space-2);
  border-radius: var(--radius-md);
  font-family: inherit;
  font-size: var(--text-base);
  font-weight: bold;
  font-variant-numeric: tabular-nums;
  background: var(--bg-highlight);
  border: 1px solid var(--border);
  color: var(--text-dim);
  cursor: default;
  transition: all 0.2s;
}

.ec-cost:disabled {
  cursor: default;
}

/* ---- cost placement: header (unlocks) ---- */
/* Lift the pill onto the title line and centre the name against its taller box
   so name and cost read on one inline row. */
.ec--cost-header .ec-cost {
  grid-area: 1 / 3;
  align-self: center;
}
.ec--cost-header .ec-name {
  align-self: center;
}
.ec--cost-header .ec-sub {
  grid-column: 2 / 4;
}

/* ---- corner badge: docked flush to the bottom-right (prestige tag) ---- */
.ec-corner {
  position: absolute;
  right: 0;
  bottom: 0;
  padding: 2px var(--space-2);
  font-size: var(--text-2xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--warning);
  background: color-mix(in srgb, var(--warning) 18%, transparent);
  border-top: 1px solid color-mix(in srgb, var(--warning) 45%, transparent);
  border-left: 1px solid color-mix(in srgb, var(--warning) 45%, transparent);
  border-top-left-radius: var(--radius-md);
  border-bottom-right-radius: var(--radius-lg);
}

/* ---- edge decoration (prestige) ---- */
.ec--edge {
  position: relative;
  /* reserve room so a full last description line clears the docked corner tag */
  padding-bottom: 18px;
  border-color: color-mix(in srgb, var(--warning) 45%, var(--border));
}
.ec--edge::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--warning);
  border-radius: var(--radius-lg) 0 0 var(--radius-lg);
}

/* Icon stays neutral in every state — state colour is carried by the pips
   (level) and the cost pill (affordance), not a whole-card hue flip. */

/* ---- affordable: lit pill + faint essence wash ---- */
.ec--afford {
  cursor: pointer;
  background: color-mix(in srgb, var(--essence) 8%, transparent);
}
.ec--afford:hover {
  background: color-mix(in srgb, var(--essence) 14%, transparent);
}
.ec--afford .ec-cost {
  cursor: pointer;
  background: color-mix(in srgb, var(--essence) 22%, transparent);
  border-color: var(--essence-light);
  color: #fff;
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--essence) 40%, transparent),
    0 0 10px color-mix(in srgb, var(--essence) 30%, transparent);
}
.ec--afford .ec-cost:hover {
  background: var(--essence);
}

/* ---- maxed (leveled, fully bought): pips already read green + the card
   dims; the pill would only repeat that, so drop it entirely. ---- */
.ec--maxed {
  opacity: 0.7;
}
.ec--maxed .ec-cost {
  display: none;
}

/* ---- unlocked (binary, owned) ---- */
.ec--unlocked {
  opacity: 0.65;
}
.ec--unlocked .ec-cost {
  background: transparent;
  border-color: transparent;
  color: var(--success);
}

/* ---- locked (condition not met) ---- */
.ec--locked {
  opacity: 0.55;
}

/* ---- can't afford: neutral; title steps back ---- */
.ec--cantafford .ec-name {
  color: var(--text-secondary);
}

/* ---- newly-affordable reveal pulse ---- */
@keyframes ec-flush {
  0% {
    background: color-mix(in srgb, var(--essence) 8%, transparent);
  }
  25% {
    background: color-mix(in srgb, var(--essence) 32%, transparent);
  }
  100% {
    background: color-mix(in srgb, var(--essence) 8%, transparent);
  }
}
.ec--fresh {
  animation: ec-flush 1.6s ease-out 1;
}
</style>
