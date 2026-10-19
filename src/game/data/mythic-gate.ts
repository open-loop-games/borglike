import type { UnlockContext } from '@/types/progression'

/**
 * Gate a mythic race or class behind total Morgoth kills on top of its own
 * condition (studio/borglike#8). Staggered counts make mythics arrive one at a
 * time after the first victory. One count feeds both the predicate and the
 * player-facing text, so the two cannot disagree.
 */
export function withMorgothKills(
  kills: number,
  own: { unlockCondition: string; checkCondition: (ctx: UnlockContext) => boolean }
): { unlockCondition: string; checkCondition: (ctx: UnlockContext) => boolean } {
  const times = kills === 1 ? 'once' : kills === 2 ? 'twice' : `${kills} times`
  return {
    unlockCondition: `${own.unlockCondition}, and kill Morgoth ${times}`,
    checkCondition: (ctx) => ctx.totalVictories >= kills && own.checkCondition(ctx),
  }
}
