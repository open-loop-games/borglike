<script setup lang="ts">
import { Icons } from '@/ui/icons'
import PanelFrame from '../common/PanelFrame.vue'
import Icon from '../common/Icon.vue'
</script>

<template>
  <div class="guide-panel">
    <div class="guide-content">
      <PanelFrame class="guide-section">
        <h3>What is Borglike?</h3>
        <p>
          An idle roguelike inspired by Angband. Watch automated bots descend through 50 floors of a
          dungeon, fighting monsters, collecting loot, and (usually) dying.
        </p>
        <p>
          Each death earns <span class="essence">Essence</span> based on depth reached and monsters
          killed. Deeper runs earn exponentially more. Spend essence on permanent upgrades and
          unlocks to help future runs go deeper.
        </p>
      </PanelFrame>

      <PanelFrame class="guide-section">
        <h3>Getting Started</h3>
        <p>
          Your first bot picks a random race and class and dives in. Let it die &mdash; that's the
          point. Spend the essence it earns on upgrades. Close the tab and come back later; the game
          simulates missed time on return.
        </p>
      </PanelFrame>

      <PanelFrame class="guide-section">
        <h3>Core Loop</h3>
        <ol>
          <li>
            <strong>Configure</strong> &mdash; Select a race, class, boosters, bot config for your
            bot.
          </li>
          <li><strong>Run</strong> &mdash; A bot enters the dungeon with your build.</li>
          <li><strong>Watch</strong> &mdash; Bots explore, fight, and loot automatically</li>
          <li><strong>Die</strong> &mdash; Death is inevitable (and profitable)</li>
          <li><strong>Earn</strong> &mdash; Gain essence from each run</li>
          <li><strong>Upgrade</strong> &mdash; Buy upgrades and unlock new bot options</li>
          <li><strong>Repeat</strong> &mdash; Each run goes a little deeper, with good RNG</li>
        </ol>
      </PanelFrame>

      <PanelFrame class="guide-section">
        <h3>Upgrades &amp; Unlocks</h3>
        <p>
          Essence buys permanent upgrades: more run slots, smarter bots, race/class selection, and
          more. Equip up to 2 boosters per run for bonus stats, gear, or special effects.
        </p>
      </PanelFrame>

      <PanelFrame class="guide-section">
        <h3>Run Controls</h3>
        <div class="controls-grid">
          <div class="control-item">
            <span class="control-key">Expand <Icon :name="Icons.expand" /></span>
            <span class="control-desc">Expand run to detailed view</span>
          </div>
          <div class="control-item">
            <span class="control-key">Turbo <Icon :name="Icons.turbo" /></span>
            <span class="control-desc">Faster simulation, no cost</span>
          </div>
          <div class="control-item">
            <span class="control-key">Auto <Icon :name="Icons.autoRestart" /></span>
            <span class="control-desc">Auto-restart on death (upgrade required)</span>
          </div>
          <div class="control-item">
            <span class="control-key">Pause <Icon :name="Icons.pause" /></span>
            <span class="control-desc">Pause/resume all runs</span>
          </div>
        </div>
      </PanelFrame>

      <PanelFrame class="guide-section">
        <h3>Compendium Tabs</h3>
        <p>
          You're reading the <strong>Guide</strong> tab now. The other Compendium tabs collect
          everything you've discovered or earned across runs.
        </p>
        <div class="controls-grid">
          <div class="control-item">
            <span class="control-key"><Icon :name="Icons.history" /> History</span>
            <span class="control-desc">Past runs with depth, kills, and essence earned</span>
          </div>
          <div class="control-item">
            <span class="control-key"><Icon :name="Icons.achievements" /> Achievements</span>
            <span class="control-desc">Milestones with essence rewards to claim</span>
          </div>
          <div class="control-item">
            <span class="control-key"><Icon :name="Icons.bestiary" /> Bestiary</span>
            <span class="control-desc"
              >Monsters encountered; high kill counts unlock knowledge</span
            >
          </div>
          <div class="control-item">
            <span class="control-key"><Icon :name="Icons.armory" /> Armory</span>
            <span class="control-desc">Equipment discovered across all runs</span>
          </div>
          <div class="control-item">
            <span class="control-key"><Icon :name="Icons.heroes" /> Heroes</span>
            <span class="control-desc">Races and classes with unlock status</span>
          </div>
        </div>
      </PanelFrame>

      <PanelFrame class="guide-section">
        <h3>Goal</h3>
        <p>
          Reach floor 50 and defeat <span class="boss">Morgoth, Lord of Darkness</span> to achieve
          victory.
        </p>
      </PanelFrame>
    </div>
  </div>
</template>

<style scoped>
.guide-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--bg-panel);
}

.guide-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.guide-section {
  padding: var(--space-4) !important;
}

.guide-section h3 {
  font-size: var(--text-md);
  color: var(--info);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin: 0 0 var(--space-3);
}

.guide-section p {
  font-size: var(--text-md);
  color: var(--text-secondary);
  line-height: 1.5;
  margin: 0 0 var(--space-2);
}

.guide-section p:last-child {
  margin-bottom: 0;
}

.guide-section ol {
  margin: 0;
  padding-left: var(--space-5);
  color: var(--text-secondary);
  font-size: var(--text-md);
  line-height: 1.8;
}

.guide-section li strong {
  color: var(--text-primary);
}

.essence {
  color: var(--essence);
  font-weight: bold;
}

.boss {
  color: var(--danger);
  font-weight: bold;
}

.controls-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.control-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  background: var(--bg-highlight);
  border-radius: var(--radius-md);
}

.control-key {
  font-size: var(--text-base);
  color: var(--warning);
  min-width: 100px;
}

.control-desc {
  font-size: var(--text-base);
  color: var(--text-secondary);
}
</style>
