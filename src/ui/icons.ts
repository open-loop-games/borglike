/**
 * Central icon registry.
 *
 * The ONLY file that imports from @iconify-* packages. Every icon used by the
 * UI is registered here once at module load. Components reference icons either
 * via the semantic `Icons` map (for chrome) or by raw Iconify ID string (for
 * data definitions like boosters/upgrades/achievements).
 *
 * Add an icon:
 *   1. Add a per-icon import below from @iconify-icons/{game-icons,ph}.
 *   2. Add an entry to REGISTRY (the full 'prefix:name' string).
 *   3. Optionally add a semantic alias to `Icons` for chrome call-sites.
 */

import { addIcon } from '@iconify/vue'

// ---------------------------------------------------------------------------
// game-icons — primary art set for game-flavored UI and data definitions.
// ---------------------------------------------------------------------------
import gi_crossedSwords from '@iconify-icons/game-icons/crossed-swords'
import gi_skullCrossedBones from '@iconify-icons/game-icons/skull-crossed-bones'
import gi_deathSkull from '@iconify-icons/game-icons/death-skull'
import gi_twoCoins from '@iconify-icons/game-icons/two-coins'
import gi_goldBar from '@iconify-icons/game-icons/gold-bar'
import gi_starsStack from '@iconify-icons/game-icons/stars-stack'
import gi_cutDiamond from '@iconify-icons/game-icons/cut-diamond'
import gi_diamondHard from '@iconify-icons/game-icons/diamond-hard'
import gi_spellBook from '@iconify-icons/game-icons/spell-book'
import gi_scrollUnfurled from '@iconify-icons/game-icons/scroll-unfurled'
import gi_backpack from '@iconify-icons/game-icons/backpack'
import gi_trophyCup from '@iconify-icons/game-icons/trophy-cup'
import gi_key from '@iconify-icons/game-icons/key'
import gi_crown from '@iconify-icons/game-icons/crown'
import gi_treasureMap from '@iconify-icons/game-icons/treasure-map'
import gi_stairs from '@iconify-icons/game-icons/stairs'
import gi_stairsGoal from '@iconify-icons/game-icons/stairs-goal'
import gi_falling from '@iconify-icons/game-icons/falling'
import gi_drop from '@iconify-icons/game-icons/drop'
import gi_house from '@iconify-icons/game-icons/house'
import gi_village from '@iconify-icons/game-icons/village'
import gi_person from '@iconify-icons/game-icons/person'

// Stat / capability icons
import gi_healthNormal from '@iconify-icons/game-icons/health-normal'
import gi_hearts from '@iconify-icons/game-icons/hearts'
import gi_heartPlus from '@iconify-icons/game-icons/heart-plus'
import gi_biceps from '@iconify-icons/game-icons/biceps'
import gi_shield from '@iconify-icons/game-icons/shield'
import gi_checkedShield from '@iconify-icons/game-icons/checked-shield'
import gi_shieldDisabled from '@iconify-icons/game-icons/shield-disabled'
import gi_brain from '@iconify-icons/game-icons/brain'
import gi_thirdEye from '@iconify-icons/game-icons/third-eye'
import gi_targeted from '@iconify-icons/game-icons/targeted'
import gi_wingfoot from '@iconify-icons/game-icons/wingfoot'
import gi_runningShoe from '@iconify-icons/game-icons/running-shoe'
import gi_runningNinja from '@iconify-icons/game-icons/running-ninja'
import gi_wingCloak from '@iconify-icons/game-icons/wing-cloak'
import gi_speedometer from '@iconify-icons/game-icons/speedometer'
import gi_lightningStorm from '@iconify-icons/game-icons/lightning-storm'
import gi_waves from '@iconify-icons/game-icons/waves'
import gi_waveSurfer from '@iconify-icons/game-icons/wave-surfer'
import gi_wheat from '@iconify-icons/game-icons/wheat'
import gi_scales from '@iconify-icons/game-icons/scales'
import gi_rocket from '@iconify-icons/game-icons/rocket'

// Equipment / class archetypes
import gi_broadsword from '@iconify-icons/game-icons/broadsword'
import gi_swordArray from '@iconify-icons/game-icons/sword-array'
import gi_battered_axe from '@iconify-icons/game-icons/battered-axe'
import gi_visoredHelm from '@iconify-icons/game-icons/visored-helm'
import gi_magicSwirl from '@iconify-icons/game-icons/magic-swirl'
import gi_plainDagger from '@iconify-icons/game-icons/plain-dagger'
import gi_angelOutfit from '@iconify-icons/game-icons/angel-outfit'
import gi_bowArrow from '@iconify-icons/game-icons/bow-arrow'
import gi_highShot from '@iconify-icons/game-icons/high-shot'
import gi_burningPassion from '@iconify-icons/game-icons/burning-passion'
import gi_graduateCap from '@iconify-icons/game-icons/graduate-cap'
import gi_vineLeaf from '@iconify-icons/game-icons/vine-leaf'
import gi_hoodedFigure from '@iconify-icons/game-icons/hooded-figure'
import gi_cog from '@iconify-icons/game-icons/cog'
import gi_spawnNode from '@iconify-icons/game-icons/spawn-node'
import gi_thunderSkull from '@iconify-icons/game-icons/thunder-skull'

// ---------------------------------------------------------------------------
// Phosphor — UI chrome (nav, toggles, modal close, etc.).
// ---------------------------------------------------------------------------
import ph_listBold from '@iconify-icons/ph/list-bold'
import ph_listBullets from '@iconify-icons/ph/list-bullets'
import ph_xBold from '@iconify-icons/ph/x-bold'
import ph_gearSix from '@iconify-icons/ph/gear-six-fill'
import ph_question from '@iconify-icons/ph/question-fill'
import ph_pause from '@iconify-icons/ph/pause-fill'
import ph_play from '@iconify-icons/ph/play-fill'
import ph_fastForward from '@iconify-icons/ph/fast-forward-fill'
import ph_checkBold from '@iconify-icons/ph/check-bold'
import ph_caretDown from '@iconify-icons/ph/caret-down'
import ph_caretUp from '@iconify-icons/ph/caret-up'
import ph_caretRight from '@iconify-icons/ph/caret-right'
import ph_arrowUpBold from '@iconify-icons/ph/arrow-up-bold'
import ph_arrowLeftBold from '@iconify-icons/ph/arrow-left-bold'
import ph_arrowRightBold from '@iconify-icons/ph/arrow-right-bold'
import ph_arrowClockwise from '@iconify-icons/ph/arrow-clockwise'
import ph_arrowCounterClockwise from '@iconify-icons/ph/arrow-counter-clockwise'
import ph_arrowFatUp from '@iconify-icons/ph/arrow-fat-up'
import ph_chartBar from '@iconify-icons/ph/chart-bar-fill'
import ph_arrowsOut from '@iconify-icons/ph/arrows-out-fill'
import ph_pencilSimple from '@iconify-icons/ph/pencil-simple-fill'
import ph_lock from '@iconify-icons/ph/lock-fill'
import ph_palette from '@iconify-icons/ph/palette-fill'
import ph_gameController from '@iconify-icons/ph/game-controller-fill'
import ph_floppyDisk from '@iconify-icons/ph/floppy-disk-fill'
import ph_downloadSimple from '@iconify-icons/ph/download-simple-fill'
import ph_uploadSimple from '@iconify-icons/ph/upload-simple-fill'
import ph_numberCircleTwo from '@iconify-icons/ph/number-circle-two'
import ph_numberCircleThree from '@iconify-icons/ph/number-circle-three'
import ph_numberCircleFour from '@iconify-icons/ph/number-circle-four'
import ph_dotsThree from '@iconify-icons/ph/dots-three'
import ph_house from '@iconify-icons/ph/house-fill'
import ph_circle from '@iconify-icons/ph/circle'

// ---------------------------------------------------------------------------
// Registration — every entry below makes `<Icon name="<key>" />` resolvable.
// ---------------------------------------------------------------------------
const REGISTRY: Record<string, Parameters<typeof addIcon>[1]> = {
  // game-icons
  'game-icons:crossed-swords': gi_crossedSwords,
  'game-icons:skull-crossed-bones': gi_skullCrossedBones,
  'game-icons:death-skull': gi_deathSkull,
  'game-icons:two-coins': gi_twoCoins,
  'game-icons:gold-bar': gi_goldBar,
  'game-icons:stars-stack': gi_starsStack,
  'game-icons:cut-diamond': gi_cutDiamond,
  'game-icons:diamond-hard': gi_diamondHard,
  'game-icons:spell-book': gi_spellBook,
  'game-icons:scroll-unfurled': gi_scrollUnfurled,
  'game-icons:backpack': gi_backpack,
  'game-icons:trophy-cup': gi_trophyCup,
  'game-icons:key': gi_key,
  'game-icons:crown': gi_crown,
  'game-icons:treasure-map': gi_treasureMap,
  'game-icons:stairs': gi_stairs,
  'game-icons:stairs-goal': gi_stairsGoal,
  'game-icons:falling': gi_falling,
  'game-icons:drop': gi_drop,
  'game-icons:house': gi_house,
  'game-icons:village': gi_village,
  'game-icons:person': gi_person,
  'game-icons:health-normal': gi_healthNormal,
  'game-icons:hearts': gi_hearts,
  'game-icons:heart-plus': gi_heartPlus,
  'game-icons:biceps': gi_biceps,
  'game-icons:shield': gi_shield,
  'game-icons:checked-shield': gi_checkedShield,
  'game-icons:shield-disabled': gi_shieldDisabled,
  'game-icons:brain': gi_brain,
  'game-icons:third-eye': gi_thirdEye,
  'game-icons:targeted': gi_targeted,
  'game-icons:wingfoot': gi_wingfoot,
  'game-icons:running-shoe': gi_runningShoe,
  'game-icons:running-ninja': gi_runningNinja,
  'game-icons:wing-cloak': gi_wingCloak,
  'game-icons:speedometer': gi_speedometer,
  'game-icons:lightning-storm': gi_lightningStorm,
  'game-icons:waves': gi_waves,
  'game-icons:wave-surfer': gi_waveSurfer,
  'game-icons:wheat': gi_wheat,
  'game-icons:scales': gi_scales,
  'game-icons:rocket': gi_rocket,
  'game-icons:broadsword': gi_broadsword,
  'game-icons:sword-array': gi_swordArray,
  'game-icons:battered-axe': gi_battered_axe,
  'game-icons:visored-helm': gi_visoredHelm,
  'game-icons:magic-swirl': gi_magicSwirl,
  'game-icons:plain-dagger': gi_plainDagger,
  'game-icons:angel-outfit': gi_angelOutfit,
  'game-icons:bow-arrow': gi_bowArrow,
  'game-icons:high-shot': gi_highShot,
  'game-icons:burning-passion': gi_burningPassion,
  'game-icons:graduate-cap': gi_graduateCap,
  'game-icons:vine-leaf': gi_vineLeaf,
  'game-icons:hooded-figure': gi_hoodedFigure,
  'game-icons:cog': gi_cog,
  'game-icons:spawn-node': gi_spawnNode,
  'game-icons:thunder-skull': gi_thunderSkull,
  // Phosphor
  'ph:list-bold': ph_listBold,
  'ph:list-bullets': ph_listBullets,
  'ph:x-bold': ph_xBold,
  'ph:gear-six': ph_gearSix,
  'ph:question': ph_question,
  'ph:pause': ph_pause,
  'ph:play': ph_play,
  'ph:fast-forward': ph_fastForward,
  'ph:check-bold': ph_checkBold,
  'ph:caret-down': ph_caretDown,
  'ph:caret-up': ph_caretUp,
  'ph:caret-right': ph_caretRight,
  'ph:arrow-up-bold': ph_arrowUpBold,
  'ph:arrow-left-bold': ph_arrowLeftBold,
  'ph:arrow-right-bold': ph_arrowRightBold,
  'ph:arrow-clockwise': ph_arrowClockwise,
  'ph:arrow-counter-clockwise': ph_arrowCounterClockwise,
  'ph:arrow-fat-up': ph_arrowFatUp,
  'ph:chart-bar': ph_chartBar,
  'ph:arrows-out': ph_arrowsOut,
  'ph:pencil-simple': ph_pencilSimple,
  'ph:lock': ph_lock,
  'ph:palette': ph_palette,
  'ph:game-controller': ph_gameController,
  'ph:floppy-disk': ph_floppyDisk,
  'ph:download-simple': ph_downloadSimple,
  'ph:upload-simple': ph_uploadSimple,
  'ph:number-circle-two': ph_numberCircleTwo,
  'ph:number-circle-three': ph_numberCircleThree,
  'ph:number-circle-four': ph_numberCircleFour,
  'ph:dots-three': ph_dotsThree,
  'ph:house': ph_house,
  'ph:circle': ph_circle,
}

for (const [name, data] of Object.entries(REGISTRY)) addIcon(name, data)

// ---------------------------------------------------------------------------
// Semantic map — UI chrome references these by role, not by raw ID.
// Data definitions (boosters/upgrades/achievements) store raw IDs directly.
// ---------------------------------------------------------------------------
export const Icons = {
  // Resource stats
  kills: 'game-icons:crossed-swords',
  gold: 'game-icons:two-coins',
  xp: 'game-icons:stars-stack',
  essence: 'game-icons:cut-diamond',
  hp: 'game-icons:health-normal',
  depth: 'game-icons:stairs',

  // Run state
  victory: 'game-icons:crown',
  death: 'game-icons:skull-crossed-bones',

  // Run controls
  turbo: 'ph:fast-forward',
  expand: 'ph:arrows-out',
  restart: 'ph:arrow-clockwise',
  configure: 'ph:pencil-simple',
  pause: 'ph:pause',
  play: 'ph:play',
  autoRestart: 'ph:arrow-counter-clockwise',
  killRun: 'ph:x-bold',

  // Nav / chrome
  menu: 'ph:list-bold',
  close: 'ph:x-bold',
  settings: 'ph:gear-six',
  help: 'ph:question',
  history: 'ph:list-bullets',
  compendium: 'ph:books',
  check: 'ph:check-bold',
  lock: 'ph:lock',
  shiftKey: 'ph:arrow-fat-up',
  caretUp: 'ph:caret-up',
  caretDown: 'ph:caret-down',
  caretRight: 'ph:caret-right',
  arrowUp: 'ph:arrow-up-bold',
  arrowLeft: 'ph:arrow-left-bold',
  arrowRight: 'ph:arrow-right-bold',
  more: 'ph:dots-three',
  chart: 'ph:chart-bar',

  // Top-level destinations
  achievements: 'game-icons:trophy-cup',
  bestiary: 'game-icons:spell-book',
  armory: 'game-icons:backpack',
  heroes: 'game-icons:scroll-unfurled',
  unlocks: 'game-icons:key',
  upgrades: 'ph:arrow-up-bold',
  runs: 'game-icons:crossed-swords',
  stats: 'ph:chart-bar',

  // Unlock tabs
  races: 'game-icons:person',
  classes: 'game-icons:visored-helm',
  boosters: 'game-icons:stars-stack',

  // Status badges
  ascension: 'game-icons:stars-stack',
  lockedCondition: 'ph:circle',

  // Settings tabs
  appearance: 'ph:palette',
  gameplay: 'ph:game-controller',
  data: 'ph:floppy-disk',
  exportSave: 'ph:download-simple',
  importSave: 'ph:upload-simple',

  // Upgrade categories
  categoryStats: 'game-icons:health-normal',
  categoryBot: 'game-icons:cog',
  categoryMeta: 'game-icons:cut-diamond',
  categoryQol: 'ph:play',

  // Bot graded capabilities
  capTown: 'ph:house',
  capTactics: 'game-icons:crossed-swords',
  capTargeting: 'game-icons:targeted',
  capRetreat: 'game-icons:shield-disabled',
  capKiting: 'game-icons:running-ninja',
  capPreparedness: 'game-icons:checked-shield',
  capSurf: 'game-icons:wave-surfer',
  capFarming: 'game-icons:wheat',

  // Class archetypes
  classWarrior: 'game-icons:visored-helm',
  classMage: 'game-icons:magic-swirl',
  classRogue: 'game-icons:plain-dagger',
  classPriest: 'game-icons:angel-outfit',
  classRanger: 'game-icons:bow-arrow',
  classPaladin: 'game-icons:checked-shield',
  classNecromancer: 'game-icons:death-skull',
  classBerserker: 'game-icons:burning-passion',
  classArchmage: 'game-icons:magic-swirl',
  classDruid: 'game-icons:vine-leaf',
  classBlackguard: 'game-icons:hooded-figure',
  classUnknown: 'ph:question',
} as const

export type IconKey = keyof typeof Icons
export type IconId = (typeof Icons)[IconKey]
