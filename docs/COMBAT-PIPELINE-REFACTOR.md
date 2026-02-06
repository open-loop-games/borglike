# Combat Damage Pipeline Refactor

Handoff doc from the protection buff bug fix session. The fix exposed significant inconsistencies in how damage resolution works across three parallel code paths.

## Context: The Protection Bug

Mage Armor (+8 AC), Shield (+15 AC), Sanctuary (+15 AC), and Cloak of Shadows (+12 AC) all created `protection` status effects that **were never read by any combat code**. Fixed in commit TBD by:

1. Adding `protection` to `getStatusACBonus()` in `combat.ts`
2. Adding `getProtectionBonus()` helper to `combat.ts`
3. Patching `monster-combat.ts` to use it
4. Patching 4 bot files that estimate armor for tactical decisions

The fix touched **7 files** for what should have been a one-line change. That's the symptom.

## Current Architecture: Three Parallel Pipelines

### Pipeline 1: `combat.ts:attack()` — Melee/Ranged Resolution

Used for: player melee, player ranged, monster melee (legacy path via `attack()`)

```
Hit:     accuracy + getStatusHitBonus() vs evasion + getStatusACBonus()
Damage:  weapon dice + STR/3 + enchant + artifact + statusDamageBonus
         × deadliness multiplier (STR/DEX/level/enchant curve)
         × shield bash (20% chance, class-gated)
         × brand/slay multiplier (element/type vs monster flags)
         × passive multiplier (racial, sneak_attack, damage_bonus)
Defense: applyArmorReduction(armor + statusACBonus, penetration)
         × crit multiplier (weight/level scaled)
         × knowledge bonus/reduction
         × elemental resistance (if abilityType passed)
Min:     max(1, damage)
```

Key details:
- `getStatusACBonus()` returns blessing + protection — applied to BOTH evasion (hit chance) AND armor reduction (double-dipping, probably intentional as "AC" in Angband affects both)
- `applyArmorReduction()` is a private helper: `min(armor/2, 50)%` reduction
- Resistance via `getTotalResistance()` — **no cap** on combined perm+temp resist

### Pipeline 2: `monster-combat.ts:resolveSingleAttack()` — Monster Structured Attacks

Used for: all monster attacks (1-4 per round with effects)

```
Hit:     custom calculateHitChance(monster, character)
         75% base + speedBonus - evasionPenalty - dodgeChance
Damage:  rollDice(attack.dice)
Defense: inline armor reduction: min((combat.armor + protectionBonus)/2, 50)%
         applyElementalResistance() — caps at 90%
         PFE: ×0.5 if EVIL + level check
Min:     max(1, damage)
Status:  tryInflictStatus() — 33% base, -2% per WIS above 10
```

Key differences from Pipeline 1:
- **Different hit formula** — 75% base with speed/evasion, not accuracy vs evasion
- **Armor reduction is inlined**, not using `applyArmorReduction()`
- **Resistance capped at 90%** via `applyElementalResistance()`, vs uncapped in Pipeline 1
- **No knowledge bonuses** applied
- **No crit** (monsters don't crit through this path, only through `attack()` legacy path)
- **No armor penetration** support
- **statusACBonus (blessing) not applied to hit chance** — only protection applied to armor

### Pipeline 3: `spell-resolution.ts:calculateSpellPower()` — Player Spell Damage

Used for: all player spell damage (single target, AOE, level-scaled)

```
Base:    rollDice(baseDamage) OR levelDamage.base + perLevel * level
Scaling: (primaryStat - 10)/2 * damageScaling + level/3 * damageScaling
Power:   × (1 + staff.spellPower/100)
Dead:    × spellDeadliness multiplier (INT/WIS + level + staff)
Upgrade: × (1 + upgradeBonuses.damagePercent/100)
Resist:  monster immune/resist check (separate from player resistance)
```

This path is clean and self-contained. Main issue: spellPower only reads from weapon slot, will need to also read from armor slot when robes get spellPower.

## Inconsistencies Found

### 1. Hit Chance — Two Different Formulas
- `combat.ts`: `50 + accuracy - evasion` (clamped 5-95%)
- `monster-combat.ts`: `75% + speedBonus - evasionPenalty` (clamped 15-95%)
- **Protection/blessing AC bonus affects hit chance in Pipeline 1 but not Pipeline 2**

### 2. Armor Reduction — Three Implementations
- `combat.ts:applyArmorReduction()` — private function, takes penetration param
- `monster-combat.ts` — inline `min(armor/2, 50)`, no penetration
- Bot files (4 places) — inline `min(armor/2, 50)` or `min(armor/20, 0.5)` (different scale!)

### 3. Resistance — Uncapped vs Capped
- `combat.ts:getTotalResistance()` — perm + temp, **no cap**
- `monster-combat.ts:applyElementalResistance()` — perm + temp, **capped at 90%**
- Could theoretically have >100% resistance (healed by fire?) in Pipeline 1

### 4. Knowledge Bonuses — Only in Pipeline 1
Monster structured attacks (Pipeline 2) don't apply bestiary knowledge bonuses. Player gets damage bonus when attacking monsters but doesn't get damage reduction when monsters use structured attacks.

### 5. Status Effect AC — Double-Dip in Pipeline 1
`getStatusACBonus()` is added to both evasion (dodge) AND armor (reduction) in `attack()`. In monster-combat it only affects armor. Blessing from Bless spell gives both dodge and damage reduction in one path, only damage reduction in the other.

### 6. Protection from Evil — Only in Pipeline 2
PFE halves damage in `monster-combat.ts` but isn't checked in `combat.ts:attack()`. If a monster attacks through the legacy `attack()` path, PFE doesn't apply.

## Phase 1: Unified Defense Resolution (DONE)

### `resolveDefense()` — implemented in `combat.ts`

```typescript
interface IncomingDamage {
  rawDamage: number
  element?: Element              // undefined = physical
  penetration?: number           // armor penetration
  attackerMonster?: Monster      // for PFE evil/level check
  knowledgeBonuses?: KnowledgeBonuses  // bestiary damage reduction
}

interface DefenseResult {
  finalDamage: number
  pfeApplied: boolean
}

function resolveDefense(character: Character, incoming: IncomingDamage): DefenseResult
```

Applies in order: armor reduction → elemental resistance (90% cap, 100+ = immune) → PFE → knowledge reduction → min damage.

### What changed

- `monster-combat.ts:resolveSingleAttack()` calls `resolveDefense()` instead of inline armor + `applyElementalResistance()` + PFE
- `combat.ts:attack()` tightened to `Character → Monster` only; dead monster-as-attacker branch removed
- `monster-ai.ts` passes `knowledgeBonuses` into `resolveMonsterAttacks()` (was applied post-hoc to total)
- `applyElementalResistance()` deleted from `monster-combat.ts`

### Behavioral changes

- **Blessing now contributes to armor vs monster attacks** — `resolveDefense` uses `getStatusACBonus()` (blessing + protection); previously only `getProtectionBonus()` was used
- **Resistance capped at 90% everywhere** — was uncapped in `combat.ts`; no practical impact since that path is character→monster
- **Knowledge reduction applied per-attack** — was applied to total; rounding can differ by 1-3 for multi-attack monsters

### What About Hit Chance?

Separate discussion. The two models are intentionally different: accuracy/evasion for player attacks, speed-based for monster attacks. Blessing's effect on monster hit chance is an open question.

## Research Resolutions

### R1: Blessing Double-Dip → Fixed
Was a bug: blessing added to both evasion (hit chance) AND armor in `attack()`. Now `attack()` is character→monster only so defender AC bonuses don't apply. Monster attacks get blessing via `resolveDefense()` armor reduction only. Consistent.

### R2: Resistance Cap → 90% everywhere
Unified to 90% cap with 100+ = full immunity. Correct behavior.

### R3: Knowledge in Monster Attacks → Fixed
Knowledge reduction now applies per-attack inside `resolveDefense()`.

### R4: PFE in Legacy Attack Path → Moot (dead code removed)
`attack(monster, character)` was never called. Dead code removed; `attack()` is now `Character → Monster` only.

### R5: Bot Armor Estimation Divergence → Follow-up
Still 4 different formulas in bot files. Create `estimateDefense()` helper in a follow-up PR.

### R6: spellPower on Armor → Separate feature
Not a combat pipeline issue. Handle when robes get spellPower.
