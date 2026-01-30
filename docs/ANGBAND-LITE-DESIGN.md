# Angband-Lite: Design Document

**Status:** Core Implementation Complete (Phases 1-2)
**Approach:** Pure TypeScript roguelike inspired by Angband, designed for idle/auto-play

**Implemented:**
- All races (14) and classes (11)
- All monsters (52) and items (~100)
- Dungeon generation, FOV, pathfinding (rot.js)
- Combat system with damage/armor/criticals
- Bot AI with 4 personalities
- Game runner for batch testing

---

## Overview

A simplified roguelike in TypeScript that captures the *feel* of Angband while being designed from the ground up for auto-play and meta-progression.

### Design Goals

- Races and classes that matter
- 50-level dungeon with scaling difficulty
- Auto-player (bot) that's fun to watch
- Meta-progression that encourages replay
- Multi-instance support (watch 1-4 runs simultaneously)

### Reference Sources

| Source | What to Steal |
|--------|---------------|
| **Angband** | Monster/item curves, stat effects, depth scaling |
| **Umoria** | Cleaner race/class design, simpler item system |
| **DCSS** | Tighter pacing, better early-game danger |
| **Realm Grinder** | Class unlocks, prestige mechanics |
| **NGU Idle** | Multi-resource progression |

---

## The Dungeon

### Structure

```
Depth 1-10:   "Shallow"    - Rats, kobolds, orcs
Depth 11-25:  "Mid"        - Trolls, ogres, minor undead
Depth 26-40:  "Deep"       - Giants, dragons, demons
Depth 41-49:  "Abyss"      - Uniques, ancient wyrms
Depth 50:     "Throne"     - Final boss
```

### Pacing Target

- Successful run (no upgrades): ~30-60 min auto-play
- With upgrades: progressively faster
- First win might take many failed runs + upgrades

### Danger Curve

| Depth | Monster HP | Monster Damage | Expected Player Level |
|-------|------------|----------------|----------------------|
| 1 | 4-8 | 1-3 | 1 |
| 10 | 20-40 | 5-10 | 8-10 |
| 25 | 60-100 | 15-25 | 18-22 |
| 40 | 150-250 | 30-50 | 30-35 |
| 50 | 400-600 | 60-100 | 40+ |

Boss (depth 50) requires near-max level + good gear + upgrades to beat consistently.

---

## Races

### Design Philosophy

- Each race has a **clear identity** (not just stat shuffling)
- Some races are **locked** behind meta-progression
- Races affect **what you find**, not just combat stats

### Starting Races (unlocked)

| Race | Identity | Stat Adjustments | Passive |
|------|----------|------------------|---------|
| **Human** | Balanced, versatile | +0 all | +10% XP gain |
| **Dwarf** | Tanky, slow | +2 STR, +2 CON, -2 DEX | Resist poison, +gold find |
| **Elf** | Glass cannon caster | +2 INT, +1 DEX, -2 CON | See invisible, mana regen |

### Unlockable Races

| Race | Unlock Condition | Identity | Twist |
|------|------------------|----------|-------|
| **Halfling** | Reach depth 20 | Lucky dodger | +15% item find, -20% HP |
| **Half-Orc** | Kill 500 monsters | Berserker | Damage boost at low HP |
| **Kobold** | Die 50 times | Scrappy survivor | Start with trap detection |
| **Gnome** | Find 100 scrolls | Gadgeteer | Scrolls 50% more effective |
| **Half-Troll** | Kill a unique | Regenerator | HP regen, slower speed |

### Prestige Races (late game)

| Race | Unlock Condition | Power |
|------|------------------|-------|
| **Vampire** | Win with each base race | Life steal, no healing potions |
| **Golem** | Collect 10,000 gold total | Huge HP, no mana, can't use scrolls |
| **Draconian** | Kill 50 dragons | Breath weapon, resist elements |

---

## Classes

### Design Philosophy

- Classes determine **how the bot plays** (different AI behaviors)
- Different classes = different strategies to watch
- Locked classes encourage continued play

### Starting Classes

| Class | Bot Behavior | Strengths | Weaknesses |
|-------|--------------|-----------|------------|
| **Warrior** | Charge in, attack | High HP, damage | No magic, potion dependent |
| **Mage** | Keep distance, nuke | AOE damage, utility | Fragile, mana dependent |
| **Rogue** | Pick fights carefully | Crits, escapes | Low sustained damage |

### Unlockable Classes

| Class | Unlock Condition | Bot Behavior |
|-------|------------------|--------------|
| **Priest** | Use 100 healing potions | Sustain tank, slow but steady |
| **Ranger** | Kill 200 monsters with ranged | Kite enemies, safe but slow |
| **Paladin** | Win with Warrior AND Priest | Hybrid, adapts to situation |

### Prestige Classes

| Class | Unlock | Fantasy |
|-------|--------|---------|
| **Necromancer** | Die 100 times | Raise killed monsters as allies |
| **Berserker** | Win without using potions | No healing, massive damage |
| **Archmage** | Win with Mage at depth 50 | Stupidly powerful spells, fragile |

---

## Items

### Tier System

```
Tier 1: Normal           (basic sword, leather armor)
Tier 2: Good             (+1 to +3, minor bonuses)
Tier 3: Excellent        (+4 to +6, one special ability)
Tier 4: Artifact         (unique, named, multiple abilities)
```

### Equipment Slots

```
Weapon (melee)
Bow (ranged)
Armor (body)
Shield (off-hand) OR two-hand weapon
Helm
Gloves
Boots
Ring x2
Amulet
Light source
```

### Item Generation by Depth

| Depth | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|-------|--------|--------|--------|--------|
| 1-10 | 80% | 18% | 2% | 0% |
| 11-25 | 50% | 40% | 9% | 1% |
| 26-40 | 20% | 50% | 27% | 3% |
| 41-50 | 5% | 30% | 55% | 10% |

### Consumables

| Type | Effect | Rarity |
|------|--------|--------|
| **Healing Potion** | Restore HP | Common |
| **Mana Potion** | Restore MP | Common |
| **Speed Potion** | Temporary haste | Uncommon |
| **Scroll of Teleport** | Escape danger | Uncommon |
| **Scroll of Identify** | Reveal item stats | Common |
| **Scroll of Mapping** | Reveal level layout | Rare |

### Artifacts (hand-designed, rare)

| Name | Slot | Effect | Min Depth |
|------|------|--------|-----------|
| **Sting** | Weapon | Glows near orcs, +2 DEX | 10 |
| **Mithril Coat** | Armor | Light, high AC, resist cold | 20 |
| **Boots of Speed** | Boots | Permanent haste | 25 |
| **Ring of Power** | Ring | +5 all stats, drains HP over time | 35 |
| **Grond** | Weapon | Massive damage, earthquake on hit | 45 |

---

## Monsters

### Categories

| Category | Examples | Role |
|----------|----------|------|
| **Animals** | Rats, bats, wolves, bears | Early fodder |
| **Humanoids** | Kobolds, orcs, trolls, ogres | Scaling threat |
| **Undead** | Skeletons, zombies, wraiths, liches | Status effects |
| **Demons** | Imps, hellhounds, balrogs | Fire damage, late game |
| **Dragons** | Drakes, dragons, ancient wyrms | Elemental, boss-tier |
| **Uniques** | Named bosses | One per run, big rewards |

### Monster Abilities

| Ability | Effect |
|---------|--------|
| **Poison** | Damage over time after hit |
| **Drain** | Steals HP or mana or XP |
| **Summon** | Calls allies to fight |
| **Breath** | Cone AOE elemental damage |
| **Blink** | Teleports around the level |
| **Regen** | Heals over time |
| **Invisible** | Hard to see/hit without detection |

### Unique Monsters (one per run, depth-gated)

| Name | Min Depth | Gimmick | Guaranteed Drop |
|------|-----------|---------|-----------------|
| **Bullroarer** | 5 | Fast, hits hard | Tier 2 weapon |
| **Wormtongue** | 10 | Steals items, flees | Gold + scroll |
| **Azog** | 20 | Summons orc pack | Tier 3 item |
| **Smaug** | 35 | Fire breath, gold hoard | Artifact + gold |
| **Morgoth** | 50 | Final boss, multi-phase | Victory |

---

## Currency: Essence

### Earning Essence

| Source | Amount |
|--------|--------|
| Kill monster | 1-10 (scales with depth) |
| Die at depth 10 | 50 |
| Die at depth 25 | 200 |
| Die at depth 40 | 500 |
| Win (depth 50) | 2000 + bonuses |
| Achievements | Varies (one-time) |

### Spending Essence

#### 1. Permanent Upgrades (Borg Improvements)

| Upgrade | Levels | Cost Range | Effect Per Level |
|---------|--------|------------|------------------|
| **Sharp Eyes** | I-V | 100-5000 | Bot detects traps better |
| **Quick Learner** | I-V | 100-5000 | +5% XP gain |
| **Pack Rat** | I-V | 100-5000 | +2 inventory slots |
| **Haggler** | I-V | 200-10000 | Better shop prices |
| **Lucky** | I-V | 500-25000 | +2% item tier upgrade chance |
| **Tough** | I-V | 200-10000 | +5% max HP |
| **Dangerous** | I-V | 200-10000 | +5% damage |
| **Speedy** | I-V | 1000-50000 | Bot acts faster (turbo mode) |

#### 2. Starting Bonuses (per-run purchases)

| Bonus | Cost | Effect |
|-------|------|--------|
| Starting Gold | 50 | +100 gold for this run |
| Starting Gear | 200 | Begin with Tier 1 weapon + armor |
| Starting Level | 500 | Begin at level 3 |
| Starting Depth | 1000 | Begin at depth 5 (skip early grind) |

#### 3. Unlocks (one-time)

| Unlock | Cost | Grants |
|--------|------|--------|
| Halfling Race | 500 | New playable race |
| Priest Class | 750 | New playable class |
| Ranger Class | 750 | New playable class |
| Slot 2 | 2000 | Run 2 dungeons simultaneously |
| Slot 3 | 10000 | Run 3 dungeons simultaneously |
| Slot 4 | 50000 | Run 4 dungeons simultaneously |

#### 4. Cosmetics

| Item | Cost | Effect |
|------|------|--------|
| Golden @ | 5000 | Player character rendered in gold |
| Death Counter | 1000 | Shows total deaths on screen |
| Speed Lines | 2500 | Visual effect during turbo mode |

---

## Meta Progression Loop

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   START RUN                                                 │
│      │                                                      │
│      ▼                                                      │
│   Pick race/class (from unlocked options)                  │
│      │                                                      │
│      ▼                                                      │
│   Auto-play descends ──────────────────────┐               │
│      │                                      │               │
│      │ (earns essence from kills)          │               │
│      │                                      │               │
│      ▼                                      ▼               │
│   DEATH ◄─────────────────────────────► VICTORY            │
│      │                                      │               │
│      │  +essence (partial)                  │  +essence     │
│      │  +achievement progress               │  +big bonus   │
│      │                                      │  +unlock?     │
│      │                                      │               │
│      └──────────────┬───────────────────────┘               │
│                     ▼                                       │
│              SPEND ESSENCE                                  │
│                     │                                       │
│      ┌──────────────┼──────────────┐                       │
│      ▼              ▼              ▼                       │
│   Upgrades      Unlocks      Starting bonuses              │
│      │              │              │                       │
│      └──────────────┴──────────────┘                       │
│                     │                                       │
│                     ▼                                       │
│               NEXT RUN (stronger)                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Multi-Instance Features

### Why Multiple Runs?

- Try different race/class combos simultaneously
- Compare strategies in real-time
- Faster essence farming overall
- One run might get lucky while others die

### Cross-Run Synergies

| Feature | Effect |
|---------|--------|
| **Shared Stash** | Items from dead runs go to stash, equippable on new runs |
| **Monster Knowledge** | Kill a monster in any run = known in all runs (damage visible) |
| **Morale Bonus** | Each active run gives +2% essence gain to all others |

---

## Achievements

### Progress Achievements

| Achievement | Condition | Essence Reward |
|-------------|-----------|----------------|
| First Blood | Kill first monster | 10 |
| Depth 10 | Reach depth 10 | 50 |
| Depth 25 | Reach depth 25 | 200 |
| Depth 50 | Reach depth 50 | 1000 |
| First Victory | Win once | 5000 |

### Challenge Achievements

| Achievement | Condition | Essence Reward |
|-------------|-----------|----------------|
| Speedster | Win in under 20 minutes | 2000 |
| Pacifist | Reach depth 10 with < 5 kills | 500 |
| Hoarder | Carry 20 items at once | 300 |
| One-Shot | Kill a dragon in one hit | 1000 |
| Destitute | Win without spending gold | 3000 |

### Cumulative Achievements

| Achievement | Condition | Essence Reward |
|-------------|-----------|----------------|
| Centurion | Kill 100 monsters total | 100 |
| Millionaire | Collect 10,000 gold total | 500 |
| Frequent Dier | Die 100 times | 1000 |
| Dragon Slayer | Kill 50 dragons total | 2000 |
| Completionist | Unlock all races and classes | 10000 |

---

## Prestige System (Late Game)

After first victory, unlock **Prestige Mode**:

- **Reset**: All upgrades reset to zero
- **Keep**: Unlocked races, classes, and slots
- **Gain**: Stars based on total essence ever earned
- **Bonus**: Stars provide global essence multiplier

| Prestige Level | Essence Multiplier |
|----------------|-------------------|
| 1 | 1.5x |
| 2 | 2.0x |
| 3 | 3.0x |
| 4 | 4.5x |
| 5+ | +1.5x per level |

Creates long-term replayability beyond "beating" the game.

---

## Bot Personalities

Different unlockable **bot AI behaviors**:

| Bot Style | Behavior | Tradeoff |
|-----------|----------|----------|
| **Cautious** | Retreats early, uses items freely | Slow but safe |
| **Aggressive** | Fights to low HP, hoards items | Fast but risky |
| **Greedy** | Prioritizes gold/items over safety | Dies often, good loot |
| **Speedrunner** | Beelines for stairs, minimal fighting | Very fast, underleveled |

**Unlock condition**: Complete X runs with each base class.

---

## Scope Summary

### What We Build

- 6+ races with distinct identities
- 6+ classes with different bot behaviors
- 50 procedural dungeon levels
- ~40-50 monster types
- ~30-40 item types + artifacts
- Simple but watchable auto-play AI
- Full meta-progression system
- Multi-instance support (1-4 runs)

### What We Skip (vs real Angband)

- Complex spell system (just simple abilities)
- Ego items / randart generation (just tiered loot + fixed artifacts)
- Monster memory / learning AI
- Detailed shops / town (minimal or none)
- 20+ resistance types (just a few)
- Object flavors ("a blue potion")
- 100+ monster types
- 100 dungeon levels (50 is enough)

### Rough Code Estimate

| Component | Lines |
|-----------|-------|
| Types/data definitions | 300-400 |
| Character system | 150-200 |
| Combat resolution | 200-250 |
| Dungeon generation (rot.js) | 150-200 |
| Monster system | 300-400 |
| Item system | 300-400 |
| Auto-player AI | 400-500 |
| Game loop / turn system | 250-300 |
| Renderer | 200-250 |
| **Core game total** | **~2000-3000** |
| Meta-progression | 400-500 |
| UI components | 500-800 |
| **Full game total** | **~3000-4500** |

---

## Advanced Systems (Clickpocalypse 2 Research)

Informed by analysis of Clickpocalypse 2, an idle party RPG with similar design goals. These systems add depth without complexity.

### Race + Class Synergies

Certain race/class combinations unlock hidden synergy bonuses. Synergies are **discovered through play**, not shown in advance. Achievements hint at promising combinations.

#### Discovery Flow

```
Player earns achievement
    ↓
Achievement text hints: "The vampire's hunger grows stronger in battle rage..."
    ↓
Player tries Vampire + Berserker
    ↓
First combat triggers discovery: "SYNERGY DISCOVERED: Blood Fury!"
    ↓
Synergy added to Compendium (visible for future runs)
```

#### Example Synergies

| Race | Class | Synergy Name | Effect | Hint Achievement |
|------|-------|--------------|--------|------------------|
| Vampire | Berserker | Blood Fury | +50% life steal below 30% HP | "Survive 10 fights below 20% HP as Vampire" |
| Kobold | Rogue | Tunnel Rat | Traps become lootable (gold) | "Detect 50 traps total" |
| Elf | Mage | Arcane Affinity | +20% spell damage | "Cast 500 spells total" |
| Dwarf | Warrior | Mountain Stance | +25% armor | "Block 1000 damage total" |
| Golem | Blackguard | Eternal Engine | Life steal heals at 150% | "Win without using any consumables" |
| Draconian | Archmage | Elemental Mastery | Breath weapon scales with INT | "Kill 100 monsters with breath attacks" |
| Half-Troll | Priest | Living Fortress | Regen + heals stack multiplicatively | "Heal 10,000 HP in a single run" |
| Gnome | Necromancer | Soul Tinkerer | Raised minions last 50% longer | "Have 10 minions active at once" |
| Hobbit | Ranger | Lucky Shot | +10% crit chance with ranged | "Land 100 critical hits with bow" |
| Half-Orc | Paladin | Righteous Fury | Berserker rage triggers divine smite | "Kill 50 demons total" |

**Design notes:**
- ~20-30 synergies total across 154 possible combinations
- Most combos have no special synergy (still viable, just no bonus)
- Creates discovery/experimentation incentive
- Community will share findings, driving engagement

### Depth Farming (Passive Essence)

After reaching depth milestones, unlock the ability to purchase **Harvester upgrades** that generate passive essence over time. Requires both the milestone AND essence investment.

#### Harvester Upgrades

| Upgrade | Prerequisite | Levels | Cost Range | Effect Per Level |
|---------|--------------|--------|------------|------------------|
| **Shallow Harvester** | Reach depth 15 | I-III | 2000-10000 | +2 essence/min passive |
| **Deep Harvester** | Reach depth 30 | I-III | 10000-50000 | +5 essence/min passive |
| **Abyss Harvester** | Reach depth 45 | I-III | 50000-200000 | +15 essence/min passive |
| **Victory Harvester** | Win once | I-III | 100000-500000 | +30 essence/min passive |

**At max level (all III):** 2×3 + 5×3 + 15×3 + 30×3 = **156 essence/min** passive income

**Design notes:**
- Creates long-term essence sink for late-game players
- Rewards milestone achievements beyond one-time bonuses
- Passive income accrues even when not actively running dungeons
- Scales with play investment (can't rush to max harvesters)

### Consumable Loadouts

Before each run, players can spend essence to equip **starting consumables**. The bot uses these automatically based on personality. Creates pre-run strategic decisions.

#### Loadout Screen

```
┌─────────────────────────────────────────────┐
│  LOADOUT                      Budget: 50 ε  │
├─────────────────────────────────────────────┤
│  Slot 1: [ Healing Potion ×3 ]       -10 ε  │
│  Slot 2: [ Scroll of Teleport ×2 ]   -15 ε  │
│  Slot 3: [ Speed Potion ×1 ]          -8 ε  │
│  Slot 4: [ 🔒 Requires: Pack Rat III ]      │
├─────────────────────────────────────────────┤
│  Remaining: 17 ε        [Start Run]         │
└─────────────────────────────────────────────┘
```

#### Loadout Items

| Item | Cost | Qty | Bot Usage |
|------|------|-----|-----------|
| Healing Potion | 3 ε | 1-5 | Below 40% HP (Cautious: 60%) |
| Mana Potion | 3 ε | 1-5 | Below 30% MP (Mage classes) |
| Speed Potion | 8 ε | 1-3 | Boss fights, dangerous uniques |
| Scroll of Teleport | 7 ε | 1-3 | Below 20% HP escape (not Aggressive) |
| Scroll of Mapping | 5 ε | 1-2 | On level entry |
| Antidote | 2 ε | 1-5 | When poisoned |

**Design notes:**
- Loadout slots unlock via Pack Rat upgrade (base: 2 slots, max: 5 slots)
- Essence cost creates risk/reward: go in stacked or save essence?
- Bot personality affects usage thresholds
- Speedrunner bot ignores most consumables (beelines for stairs)
- Greedy bot hoards items, may die with full inventory

### Monster Knowledge System

Monster stats are **hidden until first kill**. Killing a monster in any run reveals its stats permanently across all runs.

#### Unknown Monster Display

```
Before first kill:          After first kill:
┌──────────────────┐        ┌──────────────────┐
│ Orc warrior (o)  │        │ Orc warrior (o)  │
│ HP: ???          │   →    │ HP: 25           │
│ Damage: ???      │        │ Damage: 8        │
│ Speed: ???       │        │ Speed: 110       │
│ Drops: ???       │        │ Drops: Gold, Wpn │
└──────────────────┘        └──────────────────┘
```

#### Knowledge Progression

| Monsters Killed | Knowledge Level | Revealed |
|-----------------|-----------------|----------|
| 0 | Unknown | Name, symbol only |
| 1 | Basic | HP, damage, speed |
| 5 | Familiar | Abilities, resistances |
| 20 | Mastered | Drop tables, spawn depth |

**Design notes:**
- Creates small discovery moments throughout play
- Early runs feel more dangerous (unknown threats)
- Mastery level gives strategic info for experienced players
- Bestiary UI tracks total knowledge progress
- Achievement: "Encyclopedia" - fully master all monster types

### Run Analytics (Cavernous II Research)

Post-run breakdown showing where the bot spent time and what went wrong. Creates optimization gameplay without direct control—player learns what upgrades, combos, and loadouts work best.

#### Run Summary Screen

```
┌───────────────────────────────────────────────────────────┐
│  RUN SUMMARY                                              │
│  Dwarf Warrior (Cautious) - Depth 23, Death by Cave Troll │
├───────────────────────────────────────────────────────────┤
│  Duration: 18:27          Essence Earned: 247             │
├───────────────────────────────────────────────────────────┤
│  Time Breakdown:                                          │
│    Combat:       12:34 (68%)  ████████████████░░░░░░░░    │
│    Exploring:     3:45 (20%)  █████░░░░░░░░░░░░░░░░░░░    │
│    Healing:       1:58 (11%)  ██░░░░░░░░░░░░░░░░░░░░░░    │
│    Looting:       0:10 (1%)   ░░░░░░░░░░░░░░░░░░░░░░░░    │
├───────────────────────────────────────────────────────────┤
│  Floors:                                                  │
│    1-10:   2:15  ██░░░░░░░░  (fast)                       │
│    11-15:  4:30  ████░░░░░░  (normal)                     │
│    16-20:  7:42  ███████░░░  (slow - ogres)               │
│    21-23:  4:00  ████░░░░░░  (death floor)                │
├───────────────────────────────────────────────────────────┤
│  Bottleneck: Floor 16-20 took 42% of run time             │
│  Cause: Low damage vs high-HP ogres                       │
│  Suggestion: "Dangerous III" upgrade or Berserker class   │
├───────────────────────────────────────────────────────────┤
│  [Compare to Personal Best]  [Save Run]  [Dismiss]        │
└───────────────────────────────────────────────────────────┘
```

#### Tracked Metrics

| Metric | Purpose |
|--------|---------|
| **Time per floor** | Identify slow zones for upgrade targeting |
| **Combat vs explore ratio** | Tune bot personality choice |
| **Damage taken sources** | Identify dangerous monster types |
| **Items used** | Loadout optimization |
| **Gold collected vs spent** | Economy efficiency |
| **XP curve** | Level pacing analysis |
| **Cause of death** | Pattern recognition across runs |

#### Run Comparison

After 10+ runs, unlock "Compare" feature:

```
┌─────────────────────────────────────────────────────────┐
│  COMPARE: This Run vs Personal Best (Depth 23)          │
├─────────────────────────────────────────────────────────┤
│                    This Run    Best Run    Delta        │
│  Total Time:       18:27       14:52       +3:35 ▼      │
│  Floor 16-20:       7:42        4:10       +3:32 ▼      │
│  Deaths at 23:      1           0          +1    ▼      │
│  Essence:          247         312         -65   ▼      │
├─────────────────────────────────────────────────────────┤
│  Best run used: Half-Orc Berserker (Aggressive)         │
│  Best run loadout: 5× Healing, 2× Speed                 │
└─────────────────────────────────────────────────────────┘
```

#### Analytics Unlocks

| Unlock | Condition | Feature |
|--------|-----------|---------|
| **Basic Summary** | Default | Time, depth, cause of death |
| **Time Breakdown** | 10 runs | Per-activity time pie chart |
| **Floor Analysis** | 25 runs | Per-floor timing breakdown |
| **Bottleneck Detection** | 50 runs | Auto-identify slow points |
| **Suggestions** | 100 runs | Upgrade/build recommendations |
| **Historical Graphs** | 200 runs | Trend lines over time |

**Design notes:**
- Analytics unlock progressively to avoid overwhelming new players
- Suggestions are hints, not mandates—player still experiments
- "Save Run" creates bookmark for notable runs (first win, fastest, deepest)
- Compare feature encourages beating personal records
- Data persists across prestige (lifetime stats)

### Challenge Modes (Progress Knight Research)

Modified rule runs for bonus essence and achievements. Challenges don't add content—they modify rules to create variety and test mastery.

#### Challenge List

| Challenge | Rule Modifier | Essence Bonus | Achievement |
|-----------|---------------|---------------|-------------|
| **Pacifist** | Bot flees all optional combat | +50% | "Peace Was Always an Option" |
| **Speed Demon** | 2× game speed, 2× monster damage | +100% (if win) | "Gotta Go Fast" |
| **Poverty** | Cannot use gold, no shop access | +75% | "Vow of Poverty" |
| **Glass Cannon** | 50% max HP, 200% damage dealt | +75% | "High Risk, High Reward" |
| **Blind** | No monster stats shown (ignores knowledge) | +100% | "Into the Unknown" |
| **Ironman** | No healing items, healing only from regen/abilities | +125% | "What Doesn't Kill You" |
| **Hunted** | Monster spawn rate +50% | +60% | "No Rest for the Wicked" |
| **Fragile** | Equipment breaks after 50 uses | +80% | "Handle With Care" |
| **Time Crunch** | 50% mana/turn limit (faster death clock) | +90% | "Beat the Clock" |

#### Challenge UI

```
┌─────────────────────────────────────────────────────────┐
│  SELECT CHALLENGE (Optional)                            │
├─────────────────────────────────────────────────────────┤
│  [ ] Pacifist        +50% ε   Bot avoids combat         │
│  [ ] Speed Demon    +100% ε   2× speed, 2× damage taken │
│  [ ] Poverty         +75% ε   No gold or shops          │
│  [ ] Glass Cannon    +75% ε   50% HP, 200% damage       │
│  [■] Blind          +100% ε   No monster info           │
│  [ ] 🔒 Ironman     +125% ε   Requires: Win 5 runs      │
│  [ ] 🔒 Hunted       +60% ε   Requires: Kill 1000       │
├─────────────────────────────────────────────────────────┤
│  Selected: Blind (+100% essence)                        │
│  [Start Challenge Run]  [Cancel]                        │
└─────────────────────────────────────────────────────────┘
```

#### Challenge Stacking

Advanced players can stack multiple challenges for multiplicative bonuses:

```
Pacifist (+50%) + Blind (+100%) + Poverty (+75%)
= 1.5 × 2.0 × 1.75 = 5.25× essence multiplier

But: Pacifist + Poverty is brutal (can't buy escape items, can't fight)
```

**Stacking rules:**
- Max 3 challenges per run
- Bonuses multiply (not add)
- Some combos are contradictory (Speed Demon + Time Crunch = redundant)
- Achievement for completing a "Triple Challenge" run

#### Challenge Unlocks

| Challenge | Unlock Condition |
|-----------|------------------|
| Pacifist | Default |
| Speed Demon | Default |
| Poverty | Default |
| Glass Cannon | Reach depth 20 |
| Blind | Kill 500 monsters total |
| Ironman | Win 5 runs |
| Hunted | Kill 1000 monsters total |
| Fragile | Find 50 items total |
| Time Crunch | Win a run under 20 minutes |

#### Challenge Achievements

Beyond per-challenge achievements, meta-achievements for challenge mastery:

| Achievement | Condition | Reward |
|-------------|-----------|--------|
| **Challenger** | Complete any challenge | 500 essence |
| **Versatile** | Complete 5 different challenges | 2000 essence |
| **Masochist** | Complete all 10 challenges | 10000 essence |
| **Perfectionist** | Win with each challenge | Unlock "Challenge Master" title |
| **Stacker** | Complete a triple-challenge run | 5000 essence |
| **Impossible** | Win triple-challenge at depth 50 | Unlock "Legendary" cosmetic |

**Design notes:**
- Challenges unlock progressively to introduce complexity gradually
- Essence bonuses only apply if run ends normally (no quitting for bonus)
- Challenge runs are marked in run history with badge
- Challenges work with all race/class/personality combos
- Some challenges synergize with certain builds (Ironman + Half-Troll regen)
- Challenge balance tuned so bonus roughly equals added difficulty
- Stacking creates emergent difficulty for hardcore players

---

## Implementation Status

### Complete ✅

1. ~~Set up rot.js with basic dungeon rendering~~ → `src/game/dungeon.ts`
2. ~~Implement character creation (race/class selection)~~ → `src/game/character.ts`
3. ~~Basic movement and FOV~~ → `src/game/dungeon.ts` (computeFOV)
4. ~~Simple combat system~~ → `src/game/combat.ts`
5. ~~Monster spawning and AI~~ → `src/game/monster-ai.ts`
6. ~~Item drops and equipment~~ → `src/game/items.ts`
7. ~~Auto-player bot~~ → `src/game/bot-ai.ts`

### Next Steps

8. **Meta-progression UI** - Vue components for essence/upgrades
9. **Pinia stores** - Progression state, run management
10. **Multi-instance support** - Run 1-4 games simultaneously
11. **Persistence** - IndexedDB for saves
12. **Polish and balance** - Tune bot behavior, essence curves
