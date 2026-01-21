/**
 * Check spawn pool composition at each depth
 */

import { getSpawnableMonsters } from '../src/game/data/monsters'

console.log('=== SPAWN POOL ANALYSIS BY DEPTH ===\n')

for (let depth = 1; depth <= 25; depth++) {
  const monsters = getSpawnableMonsters(depth)
  const uniques = monsters.filter(m => m.flags.includes('UNIQUE'))
  const regulars = monsters.filter(m => !m.flags.includes('UNIQUE'))

  const uniquePct = monsters.length > 0 ? ((uniques.length / monsters.length) * 100).toFixed(0) : '0'
  console.log(`D:${depth.toString().padStart(2)} - ${regulars.length.toString().padStart(2)} regulars, ${uniques.length} uniques (${uniquePct.padStart(2)}% unique chance)`)

  if (uniques.length > 0) {
    const uniqueNames = uniques.map(u => `${u.name} (D:${u.minDepth})`).join(', ')
    console.log(`         Uniques: ${uniqueNames}`)
  }
}

console.log('\n=== PROBLEM ANALYSIS ===')
console.log('\nWith uniform random selection:')
console.log('- At D:5, Bullroarer has 1/8 = 12.5% spawn chance per monster slot')
console.log('- At D:10, with Bullroarer + Grishnakh + Wormtongue, unique rate is ~23%')
console.log('- Monster count formula: 5 + floor(depth/2)')
console.log('- At D:5: 7 monsters × 12.5% = ~0.9 Bullroarers expected per level')
console.log('- At D:10: 10 monsters × 23% = ~2.3 uniques expected per level')
