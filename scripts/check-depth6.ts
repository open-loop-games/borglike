import { runDeepDiagnosis } from './lib/diagnose/runner'
import { createAllAnalyzers } from './lib/diagnose/analyzers'
import { MapVisualizer } from './lib/diagnose/analyzers/map'

const SEED = 1769035460905

// Create analyzers including map visualizer configured to capture on descent
const mapVisualizer = new MapVisualizer({
  captureOnDescent: true,
  showFullMap: true,
  captureBothMaps: true,
  maxMaps: 20,
})

const result = runDeepDiagnosis({
  seed: SEED,
  raceId: 'human',
  classId: 'warrior',
  personality: 'cautious',
  maxTurns: 10000,
  maxUpgrades: true,  // Max upgrades to help survive to depth 6
  analyzers: [...createAllAnalyzers(), mapVisualizer],
})

console.log('Seed:', SEED)
console.log('End reason:', result.endReason)
console.log('Final depth:', result.finalState.depth)
console.log('Turns:', result.finalState.turn)
console.log('')

// Find depth 6 map captures
const maps = mapVisualizer.getMaps()
const depth6Maps = maps.filter(m => m.depth === 6 || m.reason.includes('→ 6') || m.reason.includes('6 →'))

console.log('=== DEPTH 6 MAP CAPTURES ===')
console.log('Found', depth6Maps.length, 'captures related to depth 6')
console.log('')

for (const snapshot of depth6Maps) {
  console.log('Turn', snapshot.turn, '- Depth', snapshot.depth, '-', snapshot.reason)
  console.log('Explored:', snapshot.stats.explored + '/' + snapshot.stats.total,
    '(' + ((snapshot.stats.explored / snapshot.stats.total) * 100).toFixed(1) + '%)')
  console.log('Stairs found:', snapshot.stats.stairsFound)
  console.log('')
  if (snapshot.fullMap) {
    console.log('=== FULL MAP ===')
    console.log(snapshot.fullMap)
  }
  console.log('')
}

// If no depth 6 specific, show all maps
if (depth6Maps.length === 0) {
  console.log('No depth 6 specific captures. All maps:')
  for (const m of maps) {
    console.log('  Turn', m.turn, 'Depth', m.depth, '-', m.reason)
  }
}
