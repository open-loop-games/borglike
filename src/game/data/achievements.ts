/**
 * Achievement Definitions
 *
 * Achievements track player progress and reward essence for completing goals.
 */

export interface Achievement {
  id: string
  name: string
  description: string
  icon: string // ASCII/emoji
  category: 'progress' | 'challenge' | 'cumulative'
  target: number // For progress tracking (e.g., 100 kills)
  reward: number // Essence reward
  hidden?: boolean // Don't show until unlocked
}

/**
 * All achievement definitions
 */
export const achievements: Achievement[] = [
  // Progress achievements (single-run milestones)
  {
    id: 'first_blood',
    name: 'First Blood',
    description: 'Kill your first monster',
    icon: '!',
    category: 'progress',
    target: 1,
    reward: 10,
  },
  {
    id: 'depth_10',
    name: 'Depth 10',
    description: 'Reach dungeon depth 10',
    icon: 'v',
    category: 'progress',
    target: 10,
    reward: 50,
  },
  {
    id: 'depth_25',
    name: 'Depth 25',
    description: 'Reach dungeon depth 25',
    icon: 'v',
    category: 'progress',
    target: 25,
    reward: 200,
  },
  {
    id: 'depth_50',
    name: 'Depth 50',
    description: 'Reach dungeon depth 50',
    icon: 'v',
    category: 'progress',
    target: 50,
    reward: 1000,
  },
  {
    id: 'first_victory',
    name: 'First Victory',
    description: 'Win the game',
    icon: '*',
    category: 'progress',
    target: 1,
    reward: 5000,
  },

  // Cumulative achievements (track global stats)
  {
    id: 'centurion',
    name: 'Centurion',
    description: 'Kill 100 monsters total',
    icon: 'k',
    category: 'cumulative',
    target: 100,
    reward: 100,
  },
  {
    id: 'slayer',
    name: 'Slayer',
    description: 'Kill 1,000 monsters total',
    icon: 'K',
    category: 'cumulative',
    target: 1000,
    reward: 500,
  },
  {
    id: 'millionaire',
    name: 'Millionaire',
    description: 'Collect 10,000 gold total',
    icon: '$',
    category: 'cumulative',
    target: 10000,
    reward: 500,
  },
  {
    id: 'frequent_dier',
    name: 'Frequent Dier',
    description: 'Die 100 times',
    icon: 'x',
    category: 'cumulative',
    target: 100,
    reward: 1000,
  },
  {
    id: 'veteran',
    name: 'Veteran',
    description: 'Complete 50 runs',
    icon: '#',
    category: 'cumulative',
    target: 50,
    reward: 300,
  },

  // Challenge achievements (single-run challenges)
  {
    id: 'massacre',
    name: 'Massacre',
    description: 'Kill 50 monsters in a single run',
    icon: 'M',
    category: 'challenge',
    target: 50,
    reward: 150,
  },
  {
    id: 'treasure_hunter',
    name: 'Treasure Hunter',
    description: 'Collect 1,000 gold in a single run',
    icon: '$',
    category: 'challenge',
    target: 1000,
    reward: 200,
  },
  {
    id: 'speed_demon',
    name: 'Speed Demon',
    description: 'Reach depth 10 in under 500 turns',
    icon: '>',
    category: 'challenge',
    target: 500,
    reward: 250,
    hidden: true,
  },
]

/**
 * Get achievement by ID
 */
export function getAchievementById(id: string): Achievement | undefined {
  return achievements.find((a) => a.id === id)
}

/**
 * Get achievements by category
 */
export function getAchievementsByCategory(
  category: Achievement['category']
): Achievement[] {
  return achievements.filter((a) => a.category === category)
}

/**
 * Get total possible essence from all achievements
 */
export function getTotalAchievementRewards(): number {
  return achievements.reduce((sum, a) => sum + a.reward, 0)
}
