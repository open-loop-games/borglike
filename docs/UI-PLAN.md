# UI Plan: Vue + CSS Grid

**Status:** Planning
**Aesthetic:** 2000s Enlightenment terminal - purple/blue gradients, glass panels, tmux-style splits
**Stack:** Vue 3 + TypeScript + CSS Grid + Pinia

---

## Design System

### Color Palette

```css
:root {
  /* Background layers (dark to light) */
  --void:       #0a0a12;  /* Deepest background */
  --panel:      #12121f;  /* Main panel fill */
  --elevated:   #1a1a2e;  /* Active/focused panels */
  --highlight:  #252540;  /* Hover states, subtle borders */
  --border:     #3a3a5c;  /* Panel borders */

  /* Accent spectrum */
  --indigo:     #6366f1;  /* Primary accent, focused borders */
  --purple:     #8b5cf6;  /* Secondary accent, headers */
  --cyan:       #06b6d4;  /* Info, stats, navigation */
  --green:      #22c55e;  /* Health, success, player */
  --amber:      #f59e0b;  /* Warnings, gold, items */
  --red:        #ef4444;  /* Danger, enemies, damage */

  /* Text hierarchy */
  --text-primary:   #e2e8f0;  /* Main text */
  --text-secondary: #94a3b8;  /* Muted text, borders */
  --text-dim:       #64748b;  /* Disabled, background */

  /* Semantic aliases */
  --hp-full:    var(--green);
  --hp-mid:     var(--amber);
  --hp-low:     var(--red);
  --essence:    var(--purple);
  --gold:       var(--amber);
  --xp:         var(--cyan);
}
```

### Typography

```css
:root {
  /* Monospace throughout for terminal feel */
  --font-mono: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;

  /* Sizes */
  --text-xs:   11px;   /* Dense info */
  --text-sm:   12px;   /* Log, secondary */
  --text-base: 13px;   /* Default UI */
  --text-lg:   14px;   /* Dungeon grid */
  --text-xl:   16px;   /* Headers */
  --text-2xl:  20px;   /* Title */

  /* Line heights */
  --leading-none:  1;
  --leading-tight: 1.25;
  --leading-normal: 1.5;
}

body {
  font-family: var(--font-mono);
  font-size: var(--text-base);
  line-height: var(--leading-normal);
  color: var(--text-primary);
  background: var(--void);
}
```

### Glass Panel Effect

```css
.panel {
  background: linear-gradient(
    135deg,
    rgba(26, 26, 46, 0.95) 0%,
    rgba(18, 18, 31, 0.98) 100%
  );
  border: 1px solid var(--border);
  border-top-color: #4a4a6a;    /* Light edge */
  border-left-color: #4a4a6a;
  border-radius: 4px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.03),
    0 4px 12px rgba(0, 0, 0, 0.4);
}

.panel--focused {
  border-color: var(--indigo);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.05),
    0 0 20px rgba(99, 102, 241, 0.15);
}
```

### Glow Effects

```css
/* Text glow for important elements */
.glow-green  { text-shadow: 0 0 6px var(--green); }
.glow-red    { text-shadow: 0 0 6px var(--red); }
.glow-amber  { text-shadow: 0 0 6px var(--amber); }
.glow-cyan   { text-shadow: 0 0 6px var(--cyan); }
.glow-purple { text-shadow: 0 0 6px var(--purple); }

/* Border glow for focused panels */
.glow-border {
  box-shadow: 0 0 20px rgba(99, 102, 241, 0.2);
}
```

### Box Drawing Characters

```
Standard borders: ┌ ─ ┐ │ └ ┘ ├ ┤ ┬ ┴ ┼
Double borders:   ╔ ═ ╗ ║ ╚ ╝ ╠ ╣ ╦ ╩ ╬
Rounded:          ╭ ─ ╮ │ ╰ ╯
Block elements:   ░ ▒ ▓ █
Progress:         ████░░░░░░
```

---

## Layout Architecture

### Main Layout (4-Run Mode)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ HEADER                                                        ◆ essence ⚙  │ 48px
├─────────────────────────────────────────────────────────────┬───────────────┤
│                                                             │               │
│                      GAME AREA                              │    SIDEBAR    │
│                   (2x2 run grid)                            │   (upgrades)  │
│                                                             │               │ flex
│                                                             │               │
│                                                             │               │
├─────────────────────────────────────────────────────────────┴───────────────┤
│ FEED (event ticker from all runs)                                           │ 48px
└─────────────────────────────────────────────────────────────────────────────┘
```

### CSS Grid Structure

```css
.app-layout {
  display: grid;
  grid-template-rows: 48px 1fr 48px;
  grid-template-columns: 1fr 280px;
  grid-template-areas:
    "header  header"
    "game    sidebar"
    "feed    feed";
  height: 100vh;
  gap: 1px;
  background: var(--border); /* Gap color */
}

.header  { grid-area: header; }
.game    { grid-area: game; }
.sidebar { grid-area: sidebar; }
.feed    { grid-area: feed; }
```

### Game Area (2x2 Grid)

```css
.game-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 1px;
  background: var(--border);
}

/* Single run mode */
.game-grid--single {
  grid-template-columns: 1fr;
  grid-template-rows: 1fr;
}

/* Two runs */
.game-grid--dual {
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr;
}
```

---

## Component Architecture

```
src/ui/
├── App.vue
├── components/
│   ├── layout/
│   │   ├── AppHeader.vue        # Logo, essence, settings
│   │   ├── AppSidebar.vue       # Tabbed upgrade panels
│   │   ├── AppFeed.vue          # Event ticker
│   │   └── PanelFrame.vue       # Reusable glass panel
│   │
│   ├── game/
│   │   ├── GameGrid.vue         # 2x2 run container
│   │   ├── RunPanel.vue         # Single run (compact view)
│   │   ├── RunPanelExpanded.vue # Full detail view
│   │   ├── DungeonGrid.vue      # ASCII character renderer
│   │   ├── RunHeader.vue        # Name, race, class, depth
│   │   ├── RunStats.vue         # HP bar, kills, status
│   │   └── EmptySlot.vue        # Locked/available slot
│   │
│   ├── meta/
│   │   ├── UpgradeList.vue      # Scrollable upgrades
│   │   ├── UpgradeItem.vue      # Single upgrade row
│   │   ├── UnlockList.vue       # Race/class unlocks
│   │   ├── UnlockItem.vue       # Single unlock
│   │   ├── LoadoutEditor.vue    # Pre-run consumables
│   │   └── ChallengeSelect.vue  # Challenge mode picker
│   │
│   ├── analytics/
│   │   ├── RunSummary.vue       # Post-run breakdown
│   │   ├── TimeBreakdown.vue    # Activity pie chart
│   │   ├── FloorAnalysis.vue    # Per-floor timing
│   │   └── RunCompare.vue       # vs personal best
│   │
│   └── common/
│       ├── ProgressBar.vue      # HP/XP/upgrade progress
│       ├── GlowText.vue         # Accented text spans
│       ├── TabGroup.vue         # Sidebar tabs
│       ├── IconButton.vue       # Settings, help buttons
│       └── Tooltip.vue          # Hover info
│
├── composables/
│   ├── useGameRunner.ts         # Manage game instances
│   ├── useRunState.ts           # Single run reactive state
│   ├── useTheme.ts              # Color scheme helpers
│   └── useKeyboard.ts           # Hotkeys
│
└── styles/
    ├── variables.css            # Design tokens
    ├── base.css                 # Reset, body styles
    ├── panels.css               # Glass panel system
    ├── dungeon.css              # Character grid
    ├── typography.css           # Text styles
    └── animations.css           # Transitions, effects
```

---

## Component Specifications

### DungeonGrid.vue

The core dungeon renderer using CSS Grid.

```vue
<template>
  <div
    class="dungeon-grid"
    :style="{
      '--cols': width,
      '--rows': height,
      '--cell-size': cellSize
    }"
  >
    <span
      v-for="(cell, index) in visibleCells"
      :key="index"
      :class="getCellClass(cell)"
      :data-x="cell.x"
      :data-y="cell.y"
    >{{ cell.char }}</span>
  </div>
</template>

<style scoped>
.dungeon-grid {
  display: grid;
  grid-template-columns: repeat(var(--cols), var(--cell-size));
  grid-template-rows: repeat(var(--rows), var(--cell-size));
  font-family: var(--font-mono);
  font-size: var(--text-lg);
  line-height: 1;
  background: var(--void);
  border: 1px solid var(--border);
}

.dungeon-grid span {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--cell-size);
  height: var(--cell-size);
}

/* Tile types */
.cell-floor    { color: var(--text-dim); }
.cell-wall     { color: var(--text-secondary); }
.cell-player   { color: var(--green); text-shadow: 0 0 4px var(--green); }
.cell-monster  { color: var(--red); }
.cell-item     { color: var(--amber); }
.cell-stairs   { color: var(--cyan); }
.cell-unknown  { color: var(--panel); }

/* Visibility states */
.cell-visible  { opacity: 1; }
.cell-seen     { opacity: 0.4; }
.cell-unseen   { opacity: 0; }
</style>
```

**Props:**
- `cells: Cell[]` - Flat array of dungeon cells
- `width: number` - Grid columns (default 11 for compact, 20+ for expanded)
- `height: number` - Grid rows
- `cellSize: string` - CSS size (default `'1.2ch'`)

### RunPanel.vue (Compact)

```vue
<template>
  <PanelFrame :focused="focused" class="run-panel">
    <RunHeader
      :name="run.character.name"
      :race="run.character.race"
      :class-name="run.character.class"
      :status="run.status"
    />

    <div class="run-stats">
      <span class="depth">D:{{ run.depth }}</span>
      <span class="hp">♥ {{ run.hp }}/{{ run.maxHp }}</span>
      <span class="kills">⚔ {{ run.kills }}</span>
    </div>

    <DungeonGrid
      :cells="run.visibleCells"
      :width="11"
      :height="9"
      cell-size="1.1ch"
    />

    <div class="run-status-line">
      {{ run.statusMessage }}
    </div>
  </PanelFrame>
</template>
```

### ProgressBar.vue

```vue
<template>
  <div class="progress-bar" :class="variant">
    <div
      class="progress-fill"
      :style="{ width: percentage + '%' }"
    />
    <span class="progress-text" v-if="showText">
      {{ current }}/{{ max }}
    </span>
  </div>
</template>

<style scoped>
.progress-bar {
  position: relative;
  height: 12px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  transition: width 0.2s ease;
}

.progress-bar.hp .progress-fill    { background: var(--green); }
.progress-bar.hp-mid .progress-fill { background: var(--amber); }
.progress-bar.hp-low .progress-fill { background: var(--red); }
.progress-bar.xp .progress-fill    { background: var(--cyan); }
.progress-bar.upgrade .progress-fill { background: var(--purple); }

.progress-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-xs);
  color: var(--text-primary);
  text-shadow: 0 1px 2px rgba(0,0,0,0.8);
}
</style>
```

---

## State Management (Pinia)

### Stores

```
src/stores/
├── progression.ts    # Essence, upgrades, unlocks, achievements
├── runs.ts           # Active run states (1-4)
├── settings.ts       # User preferences, theme
└── analytics.ts      # Run history, personal bests
```

### runs.ts

```typescript
interface RunState {
  id: string
  status: 'idle' | 'running' | 'paused' | 'dead' | 'won'
  character: {
    name: string
    race: string
    className: string
    level: number
  }
  depth: number
  hp: number
  maxHp: number
  kills: number
  gold: number
  statusMessage: string
  visibleCells: Cell[]  // For rendering (extracted from game)
}

export const useRunsStore = defineStore('runs', {
  state: () => ({
    runs: [null, null, null, null] as (RunState | null)[],
    maxSlots: 1,  // Unlockable
    focusedRun: 0,
  }),

  actions: {
    startRun(slot: number, config: RunConfig) { ... },
    updateRun(slot: number, state: Partial<RunState>) { ... },
    endRun(slot: number, result: RunResult) { ... },
  }
})
```

### progression.ts

```typescript
export const useProgressionStore = defineStore('progression', {
  state: () => ({
    essence: 0,
    totalEssenceEarned: 0,

    upgrades: {
      sharpEyes: 0,    // 0-5
      quickLearner: 0,
      packRat: 0,
      // ...
    },

    unlocks: {
      races: ['human', 'dwarf', 'elf'],
      classes: ['warrior', 'mage', 'rogue'],
      slots: 1,
      personalities: ['cautious'],
    },

    achievements: new Set<string>(),
  }),

  getters: {
    canAfford: (state) => (cost: number) => state.essence >= cost,
    upgradeLevel: (state) => (id: string) => state.upgrades[id] ?? 0,
  },

  actions: {
    spendEssence(amount: number) { ... },
    purchaseUpgrade(id: string) { ... },
    purchaseUnlock(type: string, id: string) { ... },
  },

  persist: true,  // pinia-plugin-persistedstate
})
```

---

## Responsive Behavior

```css
/* Full 4-panel layout */
@media (min-width: 1200px) {
  .game-grid { grid-template-columns: 1fr 1fr; }
  .sidebar { width: 280px; }
}

/* Narrower: stack runs vertically */
@media (max-width: 1199px) {
  .game-grid { grid-template-columns: 1fr; }
  .sidebar { width: 240px; }
}

/* Mobile: hide sidebar, single run */
@media (max-width: 768px) {
  .app-layout {
    grid-template-columns: 1fr;
    grid-template-areas:
      "header"
      "game"
      "feed";
  }
  .sidebar { display: none; }  /* Access via modal */
  .game-grid { grid-template-columns: 1fr; }
}
```

---

## Animation & Transitions

```css
/* Panel focus transition */
.panel {
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

/* HP bar smooth updates */
.progress-fill {
  transition: width 0.3s ease;
}

/* Damage flash on character */
@keyframes damage-flash {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; color: var(--red); }
}

.cell-player.damaged {
  animation: damage-flash 0.2s ease;
}

/* New item glow */
@keyframes item-pulse {
  0%, 100% { text-shadow: 0 0 4px var(--amber); }
  50% { text-shadow: 0 0 12px var(--amber); }
}

.cell-item.new {
  animation: item-pulse 1s ease infinite;
}

/* Death fade */
.run-panel.dead {
  opacity: 0.6;
  filter: grayscale(50%);
}
```

---

## Implementation Phases

### Phase 1: Foundation
- [ ] Set up Vue 3 + Vite + Pinia + TypeScript
- [ ] Create design tokens (variables.css)
- [ ] Implement PanelFrame component
- [ ] Implement basic layout (AppHeader, grid, sidebar placeholder)
- [ ] Wire up a single game instance for testing

### Phase 2: Core Game UI
- [ ] DungeonGrid component
- [ ] RunPanel (compact view)
- [ ] RunHeader, RunStats
- [ ] ProgressBar component
- [ ] AppFeed (event ticker)

### Phase 3: Meta UI
- [ ] UpgradeList / UpgradeItem
- [ ] UnlockList / UnlockItem
- [ ] Essence display with animations
- [ ] Pinia stores (progression, runs)

### Phase 4: Multi-Run
- [ ] GameGrid (2x2 layout)
- [ ] EmptySlot component
- [ ] Run slot unlocking
- [ ] Focus/expand single run

### Phase 5: Polish
- [ ] RunPanelExpanded (full stats view)
- [ ] LoadoutEditor
- [ ] ChallengeSelect
- [ ] RunSummary (analytics)
- [ ] Keyboard shortcuts
- [ ] Settings panel
- [ ] Persistence (IndexedDB)

---

## Open Questions

1. **Font loading:** Bundle JetBrains Mono or use system fonts with fallback?
2. **Dungeon viewport:** Fixed size or scale to panel? Scroll vs zoom?
3. **Mobile:** Worth supporting or desktop-only?
4. **Sound:** In scope or defer?
5. **Theming:** Just purple/blue or multiple palettes later?

---

## References

- Enlightenment E17 screenshots
- Uplink (2001) UI
- tmux/screen terminal multiplexers
- rot.js display for inspiration (not using directly)
