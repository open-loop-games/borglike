import { Icons } from '@/ui/icons'

// Per-class iconify symbols, shared by the Heroes compendium cards and the
// Unlocks sidebar so both surfaces show the same face for a class. Races have
// no dedicated icon — they fall back to a styled first-letter glyph.
export const classSymbols: Record<string, string> = {
  warrior: Icons.classWarrior,
  mage: Icons.classMage,
  rogue: Icons.classRogue,
  priest: Icons.classPriest,
  ranger: Icons.classRanger,
  paladin: Icons.classPaladin,
  necromancer: Icons.classNecromancer,
  berserker: Icons.classBerserker,
  archmage: Icons.classArchmage,
  druid: Icons.classDruid,
  blackguard: Icons.classBlackguard,
}

export function classSymbol(id: string): string | null {
  return classSymbols[id] ?? null
}

export function letterGlyph(name: string): string {
  return name.charAt(0).toUpperCase()
}

/** Hero row category; `mythic` keys off the race/class data's `mythic` flag. */
export type HeroCategory = 'mythic' | 'starter' | 'unlockable'

export function heroCategory(item: { mythic?: boolean; starting?: boolean }): HeroCategory {
  if (item.mythic) return 'mythic'
  if (item.starting) return 'starter'
  return 'unlockable'
}

const HERO_CATEGORY_LABELS: Record<HeroCategory, string> = {
  mythic: 'Mythic',
  starter: 'Starter',
  unlockable: 'Unlockable',
}

export function heroCategoryLabel(category: HeroCategory): string {
  return HERO_CATEGORY_LABELS[category]
}
