/**
 * Monster Data for Angband-Lite
 *
 * Extracted from Angband 4.2.6 source: /work/temp/angband/lib/gamedata/monster.txt
 *
 * === SCALING ANALYSIS ===
 * Based on analysis of Angband monster.txt, here's how stats scale with depth:
 *
 * HP Scaling (approximate ranges):
 * - Depth 1-5:    2-60 HP (avg ~15)
 * - Depth 6-10:   10-180 HP (avg ~50)
 * - Depth 11-20:  30-500 HP (avg ~150)
 * - Depth 21-30:  100-1400 HP (avg ~400)
 * - Depth 31-40:  200-1400 HP (avg ~600)
 * - Depth 41-50:  300-2500 HP (avg ~1000)
 * - Depth 50+:    500-20000 HP (uniques/bosses)
 *
 * Speed (110 is normal, player base):
 * - Early (1-10):  100-120 (mostly 110)
 * - Mid (11-30):   100-130 (faster enemies appear)
 * - Deep (31-50):  110-140 (many fast enemies)
 *
 * Armor Class:
 * - Depth 1-10:   1-50 AC
 * - Depth 11-25:  20-100 AC
 * - Depth 26-40:  40-150 AC
 * - Depth 41-50:  60-200 AC
 *
 * Damage (per attack, monsters have 1-4 attacks):
 * - Depth 1-5:    1d1 to 1d8 (~2-5 avg per hit)
 * - Depth 6-15:   1d5 to 3d6 (~5-10 avg per hit)
 * - Depth 16-30:  2d5 to 4d8 (~10-20 avg per hit)
 * - Depth 31-45:  3d6 to 8d8 (~15-35 avg per hit)
 * - Depth 46-50:  4d6 to 10d12 (~20-60 avg per hit)
 * - Bosses:       6d12 to 20d10 (~40-110 avg per hit)
 *
 * Experience (base, multiplied by depth / player level):
 * - Depth 1-10:   1-50 exp
 * - Depth 11-25:  25-500 exp
 * - Depth 26-40:  200-3000 exp
 * - Depth 41-50:  500-10000 exp
 * - Uniques:      Often 2-5x normal for depth
 */

export interface MonsterTemplate {
  name: string
  char: string
  color: string
  minDepth: number
  hp: number
  speed: number
  armor: number
  damage: number // Estimated average damage per turn (all attacks combined)
  experience: number
  flags: string[]
  abilities: string[]
}

// Color mapping from Angband color codes to readable names
export const COLORS: Record<string, string> = {
  d: 'black',
  w: 'white',
  s: 'slate',
  o: 'orange',
  r: 'red',
  g: 'green',
  b: 'blue',
  u: 'umber',
  D: 'lightDark',
  W: 'lightSlate',
  P: 'lightPurple',
  y: 'yellow',
  R: 'lightRed',
  G: 'lightGreen',
  B: 'lightBlue',
  U: 'lightUmber',
  p: 'purple',
  v: 'violet',
}

export const monsters: MonsterTemplate[] = [
  // ============================================
  // DEPTH 1-10: SHALLOW - Rats, kobolds, orcs
  // ============================================

  // Depth 1
  {
    name: 'Large White Snake',
    char: 'J',
    color: 'white',
    minDepth: 1,
    hp: 11,
    speed: 100,
    armor: 36,
    damage: 2, // 1d1 + 1d1
    experience: 2,
    flags: ['ANIMAL'],
    abilities: [],
  },
  {
    name: 'Small Kobold',
    char: 'k',
    color: 'yellow',
    minDepth: 1,
    hp: 8,
    speed: 110,
    armor: 24,
    damage: 3, // 1d5
    experience: 5,
    flags: [],
    abilities: [],
  },
  {
    name: 'Floating Eye',
    char: 'e',
    color: 'orange',
    minDepth: 1,
    hp: 11,
    speed: 110,
    armor: 7,
    damage: 0, // Gaze only
    experience: 1,
    flags: [],
    abilities: ['PARALYZE'],
  },
  {
    name: 'Wild Dog',
    char: 'C',
    color: 'lightUmber',
    minDepth: 1,
    hp: 3,
    speed: 110,
    armor: 3,
    damage: 1, // 1d1
    experience: 1,
    flags: ['ANIMAL'],
    abilities: [],
  },

  // Depth 2
  {
    name: 'Kobold',
    char: 'k',
    color: 'lightGreen',
    minDepth: 2,
    hp: 12,
    speed: 110,
    armor: 24,
    damage: 5, // 1d8
    experience: 5,
    flags: [],
    abilities: [],
  },
  {
    name: 'Cave Spider',
    char: 'S',
    color: 'purple',
    minDepth: 2,
    hp: 7,
    speed: 120,
    armor: 19,
    damage: 3, // 1d4
    experience: 7,
    flags: ['ANIMAL'],
    abilities: [],
  },
  {
    name: 'White Jelly',
    char: 'j',
    color: 'white',
    minDepth: 2,
    hp: 36,
    speed: 120,
    armor: 1,
    damage: 2, // Poison touch
    experience: 10,
    flags: [],
    abilities: ['POISON'],
  },

  // Depth 5
  {
    name: 'Bullroarer the Hobbit',
    char: 'h',
    color: 'lightUmber',
    minDepth: 5,
    hp: 60,
    speed: 120,
    armor: 12,
    damage: 9, // 1d8 + 1d8
    experience: 90,
    flags: ['UNIQUE'],
    abilities: [],
  },
  {
    name: 'Large Kobold',
    char: 'k',
    color: 'blue',
    minDepth: 5,
    hp: 65,
    speed: 110,
    armor: 48,
    damage: 6, // 1d10
    experience: 25,
    flags: [],
    abilities: [],
  },
  {
    name: 'Green Jelly',
    char: 'j',
    color: 'green',
    minDepth: 5,
    hp: 99,
    speed: 120,
    armor: 1,
    damage: 2, // Acid touch
    experience: 18,
    flags: [],
    abilities: ['ACID'],
  },

  // Depth 6
  {
    name: 'Snaga',
    char: 'o',
    color: 'lightUmber',
    minDepth: 6,
    hp: 36,
    speed: 110,
    armor: 48,
    damage: 5, // 1d8
    experience: 15,
    flags: ['ORC'],
    abilities: [],
  },

  // Depth 8
  {
    name: 'Wormtongue, Agent of Saruman',
    char: 'p',
    color: 'lightBlue',
    minDepth: 8,
    hp: 250,
    speed: 110,
    armor: 45,
    damage: 6, // 1d5 + 1d5 + gold steal
    experience: 150,
    flags: ['UNIQUE'],
    abilities: ['HEAL', 'POISON'],
  },

  // Depth 9
  {
    name: 'Cave Orc',
    char: 'o',
    color: 'lightUmber',
    minDepth: 9,
    hp: 54,
    speed: 110,
    armor: 48,
    damage: 10, // 1d10 + 1d10
    experience: 20,
    flags: ['ORC'],
    abilities: [],
  },
  {
    name: 'Cave Bear',
    char: 'q',
    color: 'umber',
    minDepth: 9,
    hp: 36,
    speed: 110,
    armor: 52,
    damage: 12, // 1d6 + 1d6 + 1d8
    experience: 25,
    flags: ['ANIMAL'],
    abilities: [],
  },

  // Depth 10
  {
    name: 'Giant Spider',
    char: 'S',
    color: 'violet',
    minDepth: 10,
    hp: 55,
    speed: 110,
    armor: 24,
    damage: 15, // Multiple poison bites
    experience: 35,
    flags: ['ANIMAL'],
    abilities: ['POISON', 'WEAVE'],
  },
  {
    name: 'Wolf',
    char: 'C',
    color: 'umber',
    minDepth: 10,
    hp: 21,
    speed: 120,
    armor: 45,
    damage: 4, // 1d6
    experience: 30,
    flags: ['ANIMAL'],
    abilities: [],
  },
  {
    name: 'Grishnakh, the Hill Orc',
    char: 'o',
    color: 'yellow',
    minDepth: 10,
    hp: 230,
    speed: 110,
    armor: 30,
    damage: 22, // 4 attacks
    experience: 160,
    flags: ['UNIQUE', 'ORC'],
    abilities: [],
  },

  // ============================================
  // DEPTH 11-25: MID - Trolls, ogres, undead
  // ============================================

  // Depth 11
  {
    name: 'Baby Multi-Hued Dragon',
    char: 'd',
    color: 'violet',
    minDepth: 11,
    hp: 114,
    speed: 110,
    armor: 36,
    damage: 9, // Claws + bite
    experience: 45,
    flags: ['DRAGON'],
    abilities: ['BREATH'],
  },

  // Depth 15
  {
    name: 'Uruk',
    char: 'o',
    color: 'slate',
    minDepth: 15,
    hp: 76,
    speed: 110,
    armor: 60,
    damage: 14, // 2 attacks
    experience: 40,
    flags: ['ORC'],
    abilities: [],
  },
  {
    name: 'Ogre',
    char: 'O',
    color: 'lightUmber',
    minDepth: 15,
    hp: 90,
    speed: 110,
    armor: 45,
    damage: 12, // 2d8
    experience: 50,
    flags: [],
    abilities: [],
  },

  // Depth 18
  {
    name: 'Hill Troll',
    char: 'T',
    color: 'umber',
    minDepth: 18,
    hp: 185,
    speed: 110,
    armor: 60,
    damage: 20, // Multiple attacks
    experience: 150,
    flags: ['TROLL'],
    abilities: [],
  },
  {
    name: 'Skeleton Troll',
    char: 's',
    color: 'white',
    minDepth: 18,
    hp: 144,
    speed: 110,
    armor: 60,
    damage: 16,
    experience: 120,
    flags: ['UNDEAD'],
    abilities: [],
  },

  // Depth 20
  {
    name: 'Bolg, Son of Azog',
    char: 'o',
    color: 'lightPurple',
    minDepth: 20,
    hp: 500,
    speed: 120,
    armor: 60,
    damage: 36, // 4x 3d6
    experience: 800,
    flags: ['UNIQUE', 'ORC'],
    abilities: [],
  },
  {
    name: '3-Headed Hydra',
    char: 'M',
    color: 'orange',
    minDepth: 20,
    hp: 300,
    speed: 120,
    armor: 97,
    damage: 21, // 3 bite attacks
    experience: 350,
    flags: ['ANIMAL'],
    abilities: ['POISON'],
  },
  {
    name: 'Werewolf',
    char: 'C',
    color: 'lightDark',
    minDepth: 20,
    hp: 230,
    speed: 110,
    armor: 36,
    damage: 18, // 2d6 + 2d6 + 2d10
    experience: 150,
    flags: [],
    abilities: [],
  },

  // Depth 23
  {
    name: 'Azog, Enemy of the Dwarves',
    char: 'o',
    color: 'lightRed',
    minDepth: 23,
    hp: 900,
    speed: 120,
    armor: 96,
    damage: 38, // 3x 5d5
    experience: 1111,
    flags: ['UNIQUE', 'ORC'],
    abilities: [],
  },

  // ============================================
  // DEPTH 26-40: DEEP - Giants, dragons, demons
  // ============================================

  // Depth 28
  {
    name: 'Mind Flayer',
    char: 'h',
    color: 'lightPurple',
    minDepth: 28,
    hp: 132,
    speed: 110,
    armor: 72,
    damage: 14, // Gaze attacks
    experience: 200,
    flags: [],
    abilities: ['BRAIN_SMASH', 'HOLD', 'SCARE'],
  },
  {
    name: 'Snow Troll',
    char: 'T',
    color: 'white',
    minDepth: 28,
    hp: 132,
    speed: 110,
    armor: 67,
    damage: 17, // Claws + cold bites
    experience: 200,
    flags: ['TROLL'],
    abilities: ['COLD'],
  },

  // Depth 29
  {
    name: 'Young Blue Dragon',
    char: 'd',
    color: 'blue',
    minDepth: 29,
    hp: 237,
    speed: 110,
    armor: 60,
    damage: 14, // Claws + bite
    experience: 500,
    flags: ['DRAGON'],
    abilities: ['BREATH'],
  },

  // Depth 33
  {
    name: 'Ice Troll',
    char: 'T',
    color: 'white',
    minDepth: 33,
    hp: 360,
    speed: 120,
    armor: 60,
    damage: 28, // Multiple cold attacks
    experience: 600,
    flags: ['TROLL'],
    abilities: ['COLD'],
  },

  // Depth 34
  {
    name: 'Fire Giant',
    char: 'P',
    color: 'red',
    minDepth: 34,
    hp: 520,
    speed: 110,
    armor: 90,
    damage: 45, // Heavy fire attacks
    experience: 700,
    flags: ['GIANT'],
    abilities: ['FIRE'],
  },
  {
    name: 'Eog Golem',
    char: 'g',
    color: 'umber',
    minDepth: 34,
    hp: 1050,
    speed: 100,
    armor: 187,
    damage: 56, // 4 heavy attacks
    experience: 1200,
    flags: [],
    abilities: [],
  },

  // Depth 35
  {
    name: 'Lokkak, the Ogre Chieftain',
    char: 'O',
    color: 'violet',
    minDepth: 35,
    hp: 1500,
    speed: 120,
    armor: 120,
    damage: 54, // 3x 6d6
    experience: 1500,
    flags: ['UNIQUE'],
    abilities: [],
  },
  {
    name: 'Mumak',
    char: 'q',
    color: 'slate',
    minDepth: 35,
    hp: 495,
    speed: 110,
    armor: 82,
    damage: 36, // Butt + crush
    experience: 2100,
    flags: ['ANIMAL'],
    abilities: [],
  },

  // Depth 36
  {
    name: 'Olog',
    char: 'T',
    color: 'yellow',
    minDepth: 36,
    hp: 440,
    speed: 115,
    armor: 60,
    damage: 24, // Claws + bites
    experience: 450,
    flags: ['TROLL'],
    abilities: [],
  },
  {
    name: 'Cloud Giant',
    char: 'P',
    color: 'blue',
    minDepth: 36,
    hp: 368,
    speed: 110,
    armor: 90,
    damage: 72, // 2x 8d8 electric
    experience: 500,
    flags: ['GIANT'],
    abilities: ['ELECTRIC'],
  },

  // Depth 39
  {
    name: 'Mature Green Dragon',
    char: 'd',
    color: 'green',
    minDepth: 39,
    hp: 700,
    speed: 110,
    armor: 90,
    damage: 30,
    experience: 1400,
    flags: ['DRAGON'],
    abilities: ['BREATH', 'POISON'],
  },
  {
    name: '6-Headed Hydra',
    char: 'M',
    color: 'lightGreen',
    minDepth: 39,
    hp: 550,
    speed: 120,
    armor: 135,
    damage: 42, // 6 different attacks
    experience: 2000,
    flags: ['ANIMAL'],
    abilities: ['POISON', 'FIRE', 'ACID'],
  },

  // ============================================
  // DEPTH 41-50: ABYSS - Powerful creatures
  // ============================================

  // Depth 40
  {
    name: 'Beholder',
    char: 'e',
    color: 'lightUmber',
    minDepth: 40,
    hp: 1400,
    speed: 120,
    armor: 96,
    damage: 35, // Multiple gaze + bite
    experience: 6000,
    flags: [],
    abilities: ['DRAIN', 'BLIND', 'SLOW', 'CONFUSE'],
  },
  {
    name: '7-Headed Hydra',
    char: 'M',
    color: 'red',
    minDepth: 40,
    hp: 650,
    speed: 120,
    armor: 114,
    damage: 49,
    experience: 3000,
    flags: ['ANIMAL'],
    abilities: ['BREATH', 'POISON', 'FIRE', 'ACID'],
  },
  {
    name: 'Vrock',
    char: 'U',
    color: 'slate',
    minDepth: 40,
    hp: 352,
    speed: 110,
    armor: 75,
    damage: 58, // Heavy crush attacks
    experience: 2000,
    flags: ['DEMON'],
    abilities: ['BLIND', 'CONFUSE'],
  },
  {
    name: 'Minotaur',
    char: 'H',
    color: 'slate',
    minDepth: 40,
    hp: 550,
    speed: 130,
    armor: 30,
    damage: 36, // 4x butt attacks
    experience: 2100,
    flags: [],
    abilities: [],
  },

  // Depth 45
  {
    name: 'Nalfeshnee',
    char: 'U',
    color: 'red',
    minDepth: 45,
    hp: 792,
    speed: 110,
    armor: 60,
    damage: 18, // + fire breath
    experience: 5000,
    flags: ['DEMON'],
    abilities: ['BREATH', 'FIRE', 'SUMMON'],
  },
  {
    name: 'Undead Beholder',
    char: 'e',
    color: 'umber',
    minDepth: 45,
    hp: 2376,
    speed: 120,
    armor: 120,
    damage: 55, // Experience drain attacks
    experience: 8000,
    flags: ['UNDEAD'],
    abilities: ['DRAIN', 'BRAIN_SMASH', 'SUMMON'],
  },
  {
    name: 'Berserker',
    char: 'p',
    color: 'umber',
    minDepth: 45,
    hp: 1320,
    speed: 120,
    armor: 96,
    damage: 54, // 3x 6d6
    experience: 2500,
    flags: [],
    abilities: ['HASTE'],
  },
  {
    name: 'Cyclops',
    char: 'P',
    color: 'umber',
    minDepth: 45,
    hp: 1050,
    speed: 120,
    armor: 144,
    damage: 81, // 2x 9d9
    experience: 1500,
    flags: ['GIANT'],
    abilities: [],
  },

  // Depth 47
  {
    name: 'Marilith',
    char: 'U',
    color: 'yellow',
    minDepth: 47,
    hp: 1232,
    speed: 120,
    armor: 112,
    damage: 56, // 4x 4d6
    experience: 7000,
    flags: ['DEMON'],
    abilities: ['SUMMON'],
  },

  // Depth 48
  {
    name: 'Ancient Spider',
    char: 'S',
    color: 'red',
    minDepth: 48,
    hp: 1050,
    speed: 120,
    armor: 78,
    damage: 66, // Heavy poison attacks
    experience: 2500,
    flags: ['ANIMAL'],
    abilities: ['POISON', 'WEAVE'],
  },

  // ============================================
  // UNIQUE/BOSS MONSTERS
  // ============================================

  // Depth 62 - Smaug
  {
    name: 'Smaug the Golden',
    char: 'D',
    color: 'lightRed',
    minDepth: 50, // Adjusted for our 50-level dungeon
    hp: 4200,
    speed: 120,
    armor: 195,
    damage: 100, // 6d12 + 6d12 + 7d14 + 7d14
    experience: 30000,
    flags: ['UNIQUE', 'DRAGON'],
    abilities: ['BREATH', 'FIRE'],
  },

  // Depth 95 - Gothmog
  {
    name: 'Gothmog, High Captain of Balrogs',
    char: 'U',
    color: 'violet',
    minDepth: 50, // Boss tier
    hp: 8000,
    speed: 130,
    armor: 168,
    damage: 160, // Devastating fire attacks
    experience: 43000,
    flags: ['UNIQUE', 'DEMON'],
    abilities: ['BREATH', 'FIRE', 'SUMMON'],
  },

  // Depth 99 - Sauron
  {
    name: 'Sauron, the Sorcerer',
    char: 'A',
    color: 'purple',
    minDepth: 50, // Pre-final boss
    hp: 8000,
    speed: 130,
    armor: 192,
    damage: 120, // Disenchant + drain
    experience: 50000,
    flags: ['UNIQUE'],
    abilities: ['BRAIN_SMASH', 'SUMMON', 'BLINK'],
  },

  // Depth 100 - Morgoth (Final Boss)
  {
    name: 'Morgoth, Lord of Darkness',
    char: 'P',
    color: 'lightDark',
    minDepth: 50, // Final boss
    hp: 20000,
    speed: 140,
    armor: 180,
    damage: 250, // 20d10 + 20d10 + 10d12 shatter attacks
    experience: 60000,
    flags: ['UNIQUE'],
    abilities: ['BRAIN_SMASH', 'SUMMON'],
  },
]

// Helper function to get monsters for a given depth range
export function getMonstersForDepth(minDepth: number, maxDepth: number): MonsterTemplate[] {
  return monsters.filter((m) => m.minDepth >= minDepth && m.minDepth <= maxDepth)
}

// Helper function to get monsters that can spawn at a specific depth
export function getSpawnableMonsters(depth: number): MonsterTemplate[] {
  // Monsters can spawn at their minDepth or deeper (with some variance)
  return monsters.filter((m) => m.minDepth <= depth && m.minDepth >= depth - 10)
}

// Get a specific monster by name
export function getMonsterByName(name: string): MonsterTemplate | undefined {
  return monsters.find((m) => m.name === name)
}

// Get all unique/boss monsters
export function getUniques(): MonsterTemplate[] {
  return monsters.filter((m) => m.flags.includes('UNIQUE'))
}

// Monster count summary
export const MONSTER_COUNTS = {
  total: monsters.length,
  depth1to10: monsters.filter((m) => m.minDepth >= 1 && m.minDepth <= 10).length,
  depth11to25: monsters.filter((m) => m.minDepth >= 11 && m.minDepth <= 25).length,
  depth26to40: monsters.filter((m) => m.minDepth >= 26 && m.minDepth <= 40).length,
  depth41to50: monsters.filter((m) => m.minDepth >= 41 && m.minDepth <= 50).length,
  uniques: monsters.filter((m) => m.flags.includes('UNIQUE')).length,
}
