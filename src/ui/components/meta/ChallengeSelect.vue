<script setup lang="ts">
import { ref, computed } from 'vue'
import PanelFrame from '../common/PanelFrame.vue'

interface Challenge {
  id: string
  name: string
  description: string
  icon: string
  difficulty: 'easy' | 'medium' | 'hard' | 'brutal'
  modifiers: string[]
  essenceMultiplier: number
  unlocked: boolean
  unlockCondition?: string
}

const challenges: Challenge[] = [
  {
    id: 'pacifist',
    name: 'Pacifist',
    description: 'Complete the run without killing any monster',
    icon: '☮',
    difficulty: 'hard',
    modifiers: ['Cannot attack monsters', 'Must evade all enemies'],
    essenceMultiplier: 2.5,
    unlocked: true,
  },
  {
    id: 'speedrun',
    name: 'Speedrun',
    description: 'Reach depth 10 in under 500 turns',
    icon: '⏱',
    difficulty: 'medium',
    modifiers: ['500 turn limit', 'Target: Depth 10'],
    essenceMultiplier: 1.5,
    unlocked: true,
  },
  {
    id: 'ironman',
    name: 'Ironman',
    description: 'No healing items or regeneration',
    icon: '⚔',
    difficulty: 'hard',
    modifiers: ['No potions', 'No natural HP regen', 'Starting HP only'],
    essenceMultiplier: 2.0,
    unlocked: true,
  },
  {
    id: 'minimalist',
    name: 'Minimalist',
    description: 'Complete with no equipment',
    icon: '👊',
    difficulty: 'brutal',
    modifiers: ['Cannot equip items', 'Fists only'],
    essenceMultiplier: 3.0,
    unlocked: false,
    unlockCondition: 'Reach depth 20',
  },
  {
    id: 'darkness',
    name: 'Shroud of Darkness',
    description: 'Reduced vision radius',
    icon: '👁',
    difficulty: 'medium',
    modifiers: ['FOV reduced to 3 tiles', 'Enemies harder to spot'],
    essenceMultiplier: 1.75,
    unlocked: true,
  },
  {
    id: 'horde',
    name: 'Horde Mode',
    description: 'Double monster spawns',
    icon: '👾',
    difficulty: 'hard',
    modifiers: ['2x monster spawns', 'Faster respawns'],
    essenceMultiplier: 2.0,
    unlocked: false,
    unlockCondition: 'Kill 500 monsters total',
  },
]

const selectedChallenges = ref<Set<string>>(new Set())

const emit = defineEmits<{
  select: [challengeIds: string[]]
  close: []
}>()

const totalMultiplier = computed(() => {
  let mult = 1.0
  for (const id of selectedChallenges.value) {
    const challenge = challenges.find((c) => c.id === id)
    if (challenge) {
      mult *= challenge.essenceMultiplier
    }
  }
  return mult
})

function toggleChallenge(id: string) {
  const challenge = challenges.find((c) => c.id === id)
  if (!challenge || !challenge.unlocked) return

  if (selectedChallenges.value.has(id)) {
    selectedChallenges.value.delete(id)
  } else {
    selectedChallenges.value.add(id)
  }
}

function getDifficultyColor(difficulty: Challenge['difficulty']): string {
  switch (difficulty) {
    case 'easy':
      return 'var(--green)'
    case 'medium':
      return 'var(--amber)'
    case 'hard':
      return 'var(--red)'
    case 'brutal':
      return 'var(--purple)'
    default:
      return 'var(--text-secondary)'
  }
}

function handleConfirm() {
  emit('select', Array.from(selectedChallenges.value))
}

function handleClose() {
  emit('close')
}
</script>

<template>
  <div class="challenge-select">
    <header class="select-header">
      <h2>Challenge Modifiers</h2>
      <button class="close-btn" @click="handleClose">✕</button>
    </header>

    <div class="select-content">
      <div class="challenge-grid">
        <PanelFrame
          v-for="challenge in challenges"
          :key="challenge.id"
          class="challenge-card"
          :class="{
            selected: selectedChallenges.has(challenge.id),
            locked: !challenge.unlocked,
          }"
          @click="toggleChallenge(challenge.id)"
        >
          <div class="challenge-header">
            <span class="challenge-icon">{{ challenge.icon }}</span>
            <span class="challenge-name">{{ challenge.name }}</span>
            <span
              class="challenge-difficulty"
              :style="{ color: getDifficultyColor(challenge.difficulty) }"
            >
              {{ challenge.difficulty }}
            </span>
          </div>

          <p class="challenge-desc">{{ challenge.description }}</p>

          <div class="challenge-modifiers">
            <span v-for="mod in challenge.modifiers" :key="mod" class="modifier-tag">
              {{ mod }}
            </span>
          </div>

          <div class="challenge-reward">
            <span class="reward-label">Essence</span>
            <span class="reward-value">x{{ challenge.essenceMultiplier.toFixed(1) }}</span>
          </div>

          <div v-if="!challenge.unlocked" class="locked-overlay">
            <span class="lock-icon">🔒</span>
            <span class="lock-condition">{{ challenge.unlockCondition }}</span>
          </div>

          <div v-if="selectedChallenges.has(challenge.id)" class="selected-indicator">
            <span>✓</span>
          </div>
        </PanelFrame>
      </div>
    </div>

    <footer class="select-footer">
      <div class="total-multiplier">
        <span class="mult-label">Total Essence Multiplier:</span>
        <span class="mult-value" :class="{ boosted: totalMultiplier > 1 }">
          x{{ totalMultiplier.toFixed(2) }}
        </span>
      </div>
      <div class="footer-actions">
        <button class="cancel-btn" @click="handleClose">Cancel</button>
        <button class="confirm-btn" @click="handleConfirm">
          Apply Challenges ({{ selectedChallenges.size }})
        </button>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.challenge-select {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--panel);
}

.select-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: var(--elevated);
  border-bottom: 1px solid var(--border);
}

.select-header h2 {
  font-family: var(--font-mono);
  font-size: 16px;
  font-weight: bold;
  color: var(--text-primary);
  margin: 0;
}

.close-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--highlight);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-secondary);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.close-btn:hover {
  background: var(--red);
  border-color: var(--red);
  color: white;
}

.select-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.challenge-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.challenge-card {
  padding: 16px !important;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.challenge-card:hover {
  border-color: var(--indigo);
}

.challenge-card.selected {
  border-color: var(--green);
  background: rgba(34, 197, 94, 0.05);
}

.challenge-card.locked {
  opacity: 0.5;
  cursor: not-allowed;
}

.challenge-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.challenge-icon {
  font-size: 20px;
}

.challenge-name {
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: bold;
  color: var(--text-primary);
  flex: 1;
}

.challenge-difficulty {
  font-family: var(--font-mono);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.challenge-desc {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 0 0 12px;
  line-height: 1.4;
}

.challenge-modifiers {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}

.modifier-tag {
  font-family: var(--font-mono);
  font-size: 10px;
  padding: 3px 8px;
  background: var(--highlight);
  border: 1px solid var(--border);
  border-radius: 3px;
  color: var(--text-dim);
}

.challenge-reward {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 10px;
  border-top: 1px solid var(--border);
}

.reward-label {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-dim);
}

.reward-value {
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: bold;
  color: var(--purple);
  text-shadow: 0 0 6px rgba(139, 92, 246, 0.4);
}

.locked-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgba(10, 10, 18, 0.8);
  border-radius: 4px;
}

.lock-icon {
  font-size: 24px;
}

.lock-condition {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-secondary);
}

.selected-indicator {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--green);
  border-radius: 50%;
  color: white;
  font-size: 14px;
  font-weight: bold;
}

.select-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: var(--elevated);
  border-top: 1px solid var(--border);
}

.total-multiplier {
  display: flex;
  align-items: center;
  gap: 10px;
}

.mult-label {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-secondary);
}

.mult-value {
  font-family: var(--font-mono);
  font-size: 18px;
  font-weight: bold;
  color: var(--text-primary);
}

.mult-value.boosted {
  color: var(--purple);
  text-shadow: 0 0 8px rgba(139, 92, 246, 0.5);
}

.footer-actions {
  display: flex;
  gap: 12px;
}

.cancel-btn {
  padding: 10px 20px;
  background: var(--highlight);
  border: 1px solid var(--border);
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.cancel-btn:hover {
  background: var(--border);
  color: var(--text-primary);
}

.confirm-btn {
  padding: 10px 24px;
  background: var(--indigo);
  border: 1px solid var(--indigo);
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: bold;
  color: white;
  cursor: pointer;
  transition: all 0.2s;
}

.confirm-btn:hover {
  background: #4f46e5;
  box-shadow: 0 0 16px rgba(99, 102, 241, 0.4);
}
</style>
