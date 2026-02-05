/**
 * Achievement Definitions
 *
 * Achievements track player progress and reward essence for completing goals.
 */

import type { GlobalStats } from '@/types/progression'

export interface Achievement {
  id: string
  name: string
  description: string
  icon: string // ASCII/emoji
  category: 'progress' | 'challenge' | 'cumulative'
  target: number // For progress tracking (e.g., 100 kills)
  reward: number // Essence reward
  hidden?: boolean // Don't show until unlocked
  /** GlobalStats key this achievement tracks progress against. Required for cumulative achievements. */
  statKey?: keyof GlobalStats
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
    statKey: 'totalKills',
  },
  {
    id: 'slayer',
    name: 'Slayer',
    description: 'Kill 1,000 monsters total',
    icon: 'K',
    category: 'cumulative',
    target: 1000,
    reward: 500,
    statKey: 'totalKills',
  },
  {
    id: 'millionaire',
    name: 'Millionaire',
    description: 'Collect 10,000 gold total',
    icon: '$',
    category: 'cumulative',
    target: 10000,
    reward: 500,
    statKey: 'totalGold',
  },
  {
    id: 'frequent_dier',
    name: 'Frequent Dier',
    description: 'Die 100 times',
    icon: 'x',
    category: 'cumulative',
    target: 100,
    reward: 1000,
    statKey: 'totalDeaths',
  },
  {
    id: 'veteran',
    name: 'Veteran',
    description: 'Complete 50 runs',
    icon: '#',
    category: 'cumulative',
    target: 50,
    reward: 300,
    statKey: 'totalRuns',
  },

  // Monster kill tiers (continued)
  {
    id: 'butcher',
    name: 'Butcher',
    description: 'Kill 5,000 monsters total',
    icon: 'K',
    category: 'cumulative',
    target: 5000,
    reward: 1000,
    statKey: 'totalKills',
  },
  {
    id: 'annihilator',
    name: 'Annihilator',
    description: 'Kill 25,000 monsters total',
    icon: 'K',
    category: 'cumulative',
    target: 25000,
    reward: 2500,
    statKey: 'totalKills',
  },
  {
    id: 'genocide',
    name: 'Genocide',
    description: 'Kill 100,000 monsters total',
    icon: 'K',
    category: 'cumulative',
    target: 100000,
    reward: 5000,
    statKey: 'totalKills',
  },

  // Run completion tiers (continued)
  {
    id: 'seasoned',
    name: 'Seasoned',
    description: 'Complete 100 runs',
    icon: '#',
    category: 'cumulative',
    target: 100,
    reward: 500,
    statKey: 'totalRuns',
  },
  {
    id: 'grizzled',
    name: 'Grizzled',
    description: 'Complete 250 runs',
    icon: '#',
    category: 'cumulative',
    target: 250,
    reward: 1000,
    statKey: 'totalRuns',
  },
  {
    id: 'eternal',
    name: 'Eternal',
    description: 'Complete 500 runs',
    icon: '#',
    category: 'cumulative',
    target: 500,
    reward: 2000,
    statKey: 'totalRuns',
  },
  {
    id: 'timeless',
    name: 'Timeless',
    description: 'Complete 1,000 runs',
    icon: '#',
    category: 'cumulative',
    target: 1000,
    reward: 4000,
    statKey: 'totalRuns',
  },

  // Death tiers (continued)
  {
    id: 'professional_corpse',
    name: 'Professional Corpse',
    description: 'Die 500 times',
    icon: 'x',
    category: 'cumulative',
    target: 500,
    reward: 2000,
    statKey: 'totalDeaths',
  },
  {
    id: 'death_enthusiast',
    name: 'Death Enthusiast',
    description: 'Die 1,000 times',
    icon: 'x',
    category: 'cumulative',
    target: 1000,
    reward: 3000,
    statKey: 'totalDeaths',
  },
  {
    id: 'immortally_mortal',
    name: 'Immortally Mortal',
    description: 'Die 5,000 times',
    icon: 'x',
    category: 'cumulative',
    target: 5000,
    reward: 5000,
    statKey: 'totalDeaths',
  },

  // Gold tiers (continued)
  {
    id: 'tycoon',
    name: 'Tycoon',
    description: 'Collect 100,000 gold total',
    icon: '$',
    category: 'cumulative',
    target: 100000,
    reward: 1500,
    statKey: 'totalGold',
  },
  {
    id: 'mogul',
    name: 'Mogul',
    description: 'Collect 500,000 gold total',
    icon: '$',
    category: 'cumulative',
    target: 500000,
    reward: 3000,
    statKey: 'totalGold',
  },
  {
    id: 'dragons_hoard',
    name: "Dragon's Hoard",
    description: 'Collect 1,000,000 gold total',
    icon: '$',
    category: 'cumulative',
    target: 1000000,
    reward: 5000,
    statKey: 'totalGold',
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
export function getAchievementsByCategory(category: Achievement['category']): Achievement[] {
  return achievements.filter((a) => a.category === category)
}

/**
 * Get total possible essence from all achievements
 */
export function getTotalAchievementRewards(): number {
  return achievements.reduce((sum, a) => sum + a.reward, 0)
}
