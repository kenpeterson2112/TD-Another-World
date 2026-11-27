# Alien Tower Defense: Core Design Doc (v0.3)

Scope: defense mode only. Offense, PvP, and additional planets are noted as future hooks, not built yet.

Values marked *(placeholder)* are starting points for M1 and get tuned in M5.

## 1. Pitch

Build and defend a base on an alien world. Between missions you upgrade your towers and economy and unlock new tower types. Before each mission you choose a loadout of tower types, constrained by an energy budget. Some missions reveal their enemy types in advance; others you learn by playing. Placement uses a simple, fully visible hex grid, so every bonus and every targeting zone is readable at a glance.

## 2. Core Loop

1. **Hub (between missions):** spend credits on permanent upgrades, unlock towers with alien artifacts, review the next mission.
2. **Loadout:** choose which unlocked tower types to bring, staying within the mission's energy budget.
3. **Mission:** place towers during build phase, then run waves. Spend credits on placing and upgrading towers.
4. **Debrief:** collect credits, check which challenge objectives were met, record enemy types seen.

## 3. Currencies

Two currencies, by design.

**Credits (standard currency)**
- Every mission starts with a fixed **starting credits** amount: **100** *(placeholder)*. Raised by the "starting credits" economy upgrade. Missions do not draw on banked credits.
- Earned for every enemy defeated: **5 credits per kill** by default *(placeholder; set per enemy as `bounty`)*.
- Spent during a mission to place towers (**100 credits per tower** *(placeholder)*) and upgrade them. Credits are what limit how many towers you can place.
- Carry-over: what goes to the bank at the end of a mission is the credits left unspent, plus a **completion bonus** on a win. Credits spent mid-mission are therefore lost to the bank, so spending has a real cost later.
- Wave milestone bonuses: one-time credit payouts within a level, locked in permanently once reached. They are the consolation for losses, so a loss pays nothing beyond the milestones already reached. Each level has its own milestones, and each pays once per level. Example for a 20-wave level:
  - Survive wave 5 (25%): 50 credits
  - Survive wave 10 (50%): 100 credits
  - Survive wave 15 (75%): 150 credits
  - Clear wave 20 (100%): 250 credits
- Milestone bonuses are not affected by spending.
- Banked credits buy permanent upgrades (section 5). They never unlock new towers.

**Alien artifacts (rare currency)**
- Earned by completing challenge objectives on a level.
- Each level has three artifacts, one each for easy, medium and hard challenges.
- Artifacts are a **count you spend**. Any artifact can unlock any locked tower type; the player chooses which. They are not spent on stat upgrades.

## 4. Challenge Objectives (Artifacts)

Each level lists three optional challenges, one per difficulty. Completing a challenge awards one artifact.

Example challenge types (tuned per level):
- Win within a time limit
- Win while spending no more than X credits in the mission
- Win without losing any base health
- Win without placing a given tower type (a tower ban)

**Winnability rule:** every challenge must be winnable with the towers a player can have when they first meet it. On level one, that means at least the easy challenge must be beatable with the Blaster alone, and each harder one with at most the towers the earlier challenges could have unlocked.

Design intent: challenges teach the loadout puzzle. A tower ban forces you to find another answer. A credit cap forces you to think about the spend-versus-carry-over tension.

## 5. Between-Mission Upgrades (Meta Progression)

Upgrades are permanent and applied outside the mission. They never add new abilities to a tower; they only raise numbers and caps.

Per-tower stat upgrades (paid in credits):
- Damage
- Range (in whole tiles)
- Fire rate
- Energy efficiency (lowers the energy cost of the tower)

Per-tower caps:
- Each tower type has a **max in-mission level**, raised by meta upgrades bought for it. Caps are per tower type, not per placed tower. Example: Blaster starts at max level 3; meta upgrades raise it to 5, then 7.
- In-mission upgrades spend credits to raise a placed tower up to that cap.

Economy upgrades (paid in credits):
- Starting credits per mission
- Income per wave
- Energy capacity (the player's base energy cap, see section 6)
- Salvage refund rate

Tower unlocks (paid in alien artifacts): new tower types join the loadout pool.

Planet progression (later system): completing a planet unlocks travel to the next. For v0.1, a single planet with a finite upgrade tree is enough.

## 6. Loadout and Energy

- Energy caps **how many tower types you can bring**, not how many towers you place. Once a type is in the loadout, you can place as many as your credits allow.
- Every tower type has an **energy cost**. The sum of loadout energy costs must be at or below the budget.
- **Energy budget per mission:**
  - the mission's own limit, if it sets one, otherwise
  - the player's energy cap.
- **Energy cap curve:** the cap starts at **1**, enough for one tower type (the Blaster costs 1). Energy capacity upgrades raise it quickly at first, then plateau, so early unlocks feel fast and late loadouts stay tight *(placeholder curve: 1 → 2 → 3 → 4 → 5, with steeply rising cost after 3)*.
- Missions can impose a tighter budget than the player's cap. This forces you to leave strong towers at home.
- A tower's energy cost is fixed for the mission. Energy efficiency upgrades lower it, to a minimum of 1.
- Players cannot bring their whole arsenal. This is the core strategic constraint.
- With only the Blaster available (M1), the energy check always passes. That is expected.

### Mission Intel
- **Briefed:** before loadout selection, the player sees which enemy types appear in the level and an approximate total count for each type across the whole level. It does not show how those enemies are split across waves. Exact per-wave details still come from Wave Intel (below).
- **Unknown:** the roster is hidden. The player picks a loadout blind, plays, and sees enemy types as they appear. Afterward the roster is recorded, so replays are Briefed.

Design intent: first attempts on Unknown missions are about learning; repeat attempts are about optimizing the loadout.

### Wave Intel (per-wave reveal)
- Each level sets its own wave count. The default is **20**. The count is data-driven and not locked; a level can be 5, 20, 50, or anything else.
- The HUD shows one square per wave, in order.
- When a wave is defeated, its square is marked cleared. Clicking a cleared square opens that wave's details: every enemy type and count, and spawn timing.
- Waves not yet defeated show no details. Clicking them shows only "not yet cleared" and reveals nothing about their enemies.
- Wave intel is saved per level. It is what lets a player plan a loadout around known waves on a replay.
- Briefed shows the level's full roster before loadout. Wave intel is a per-wave record earned by clearing a wave. Both can apply to the same level.

## 7. The Grid

- **Hex grid**, pointy-top. Offset "odd-r" coordinates in data, with conversion to axial or cube for maths.
- Each tile has six neighbours.
- Towers occupy one tile. Path tiles cannot hold towers.
- Every tower shows two zones:
  - **Support zone:** tiles that receive its bonus. Radius 1 = the six adjacent hexes.
  - **Attack zone:** tiles it can shoot at, computed from range in whole hex tiles.
- Attack and support zones are highlighted on hover, selection, and placement. On touch screens there is no hover, so zones show on tap/selection and during placement. No hidden radii.
- Support radius is fixed at 1 for v0.1. A radius of 2 (18 tiles) is a later option.

### Support Rules (v0.1)
- Bonuses are simple and named:
  - **Overcharge:** +X% damage
  - **Overclock:** +X% fire rate
- A range bonus (previously "Shield Relay") is parked for now.
- The same bonus type does not stack from multiple sources. Different types stack.

## 8. Combat

- Enemies follow a fixed path across the grid (path-based, not free-roaming).
- Enemy speed is measured in tiles per second. Default **2 tiles/second** *(placeholder)*; fast enemies are quicker, armored ones slower.
- Towers fire at enemies inside their attack zone. Target rule: first (furthest along the path) for v0.1. Target priority (first, strongest, closest) can be a later upgrade toggle.
- Fire rate is measured in shots per second. Default **1 shot/second** *(placeholder)*, raised by upgrades.
- **Armor** is a flat reduction per hit: an armored enemy takes **5 less damage per hit** *(placeholder)*.
- **Splash** (Pulse): the main target takes full damage; enemies within 1 tile of it take half damage.
- Waves are defined per mission as groups of enemies with type, count, and spawn timing.
- Each enemy defeated pays its bounty in credits.
- Base has health; each enemy that reaches the end of the path removes health. At zero the mission is lost. *(Placeholder: base health 20, 1 per leaked enemy.)*
- Towers can be upgraded during a mission with credits, up to their meta-set cap.

## 9. Tower Roster (Level One)

| Tower | Role | Attack | Energy | Notes |
|---|---|---|---|---|
| Blaster | Single-target damage | Single target, medium range | 1 | Starting tower, unlocked from the start |
| Pulse | Area damage | Splash (1 tile, half damage), short range | 2 *(placeholder)* | Unlocked with an artifact |
| Lance | Long range | Single target, long range | 3 *(placeholder)* | High energy cost; unlocked with an artifact |
| Relay | Support | No attack; Overcharge to support zone | 1 *(placeholder)* | Low energy cost; unlocked with an artifact |

All towers cost 100 credits to place *(placeholder)*. Ranges are in whole tiles. Damage values, upgrade costs and per-level gains are set in M1/M2 and tuned in M5.

Enemy types for level one: 3 (basic, armored, fast), so loadout choices matter.

## 10. Level One (First Playable Map)

- Map: 6 columns wide by 18 rows tall, hex grid. Portrait, so it fits a phone screen.
- Enemy path: a single zigzag from top to bottom.
- Waves: 20 (default per level). Milestone bonuses at waves 5, 10, 15 and 20.
- Layout: HUD at top (base health, credits, energy used / budget for the loadout, and a row of 20 wave squares). Map in the middle. Controls at bottom.
- Wave squares: cleared waves are filled, the current wave is outlined, upcoming waves are empty. Clicking a cleared square shows that wave's intel (see section 6).
- Level size is a starting point; tune after playtesting.

## 11. Tech and Data Model

**Tech stack:** a single self-contained `index.html` (vanilla JavaScript and Canvas, no build step, no external dependencies). It opens straight from the file system, including on a phone, so testing needs no server. Touch and mouse input both work.

**Data:** game data lives in plain data objects inside `index.html`, grouped and shaped exactly like the JSON files below, and separate from the game logic. Balance changes edit data, not code. Moving these objects out into real JSON files is a stretch goal, once a local server or build step is acceptable.

- `towers`: id, name, role, energy_cost, base_damage, base_range_tiles, fire_rate, place_cost, base_max_level, support_bonus, splash, unlock (starting | artifact), sprite key
- `enemies`: id, name, hp, speed (tiles/second), armor (flat damage reduction), bounty
- `levels`: id, name, grid size, path tiles, energy_budget (optional override), intel (briefed | unknown), waves, challenges (easy, medium, hard, each with type and parameters)
- `meta_upgrades`: id, target, effect, cost (credits or artifacts), prerequisites
- `progress` (save data, `localStorage` in v0.1): banked credits, artifacts owned, unlocked towers, meta upgrade levels, caps, energy cap, completed levels, challenges met, cleared waves and wave intel per level, milestone bonuses claimed

## 12. Screens (v0.1)

1. **Hub:** level list, upgrade tree, tower unlocks.
2. **Loadout:** tower cards with energy cost, energy bar against budget, enemy roster (if Briefed), challenge list for the level.
3. **Mission:** HUD at top (stats and a square per wave; cleared squares open wave intel), hex grid, controls at bottom (tower palette, wave controls, speed).
4. **Debrief:** credits earned, challenges met, artifacts awarded, newly discovered enemy types.

## 13. Build Plan

- **M1: Playable skeleton.** Single-file `index.html`. Hex grid, one zigzag path, placement, one tower (Blaster), basic waves, credits from kills, energy budget enforcement (trivial with one tower type), win and lose. Level 1 only.
- **M2: Towers and zones.** Pulse, Lance and Relay; visible attack zones; Overcharge bonus.
- **M3: Loadout and challenges.** Loadout screen, per-mission budgets, Briefed vs Unknown intel, challenge objectives and artifacts.
- **M4: Meta progression.** Hub, meta upgrades, per-tower caps, economy upgrades, energy cap curve, tower unlocks, wave milestone credit bonuses, save data.
- **M5: Tuning.** Balance data and playtest notes.

Out of scope for now: offense mode, PvP, multiple planets, sound, art beyond placeholders.

## 14. Decisions Log

Settled in v0.3:
- Energy caps the number of tower types in the loadout, not tower placements. Credits limit placements.
- Energy cap starts at 1 and rises quickly, then plateaus.
- Starting credits 100; towers cost 100; kills pay 5 credits.
- A win pays a completion bonus on top of unspent credits.
- Wave milestones pay once per level.
- Artifacts are a spendable count; any artifact unlocks any tower type.
- Every challenge must be winnable with the towers available when first met.
- Tower caps are per tower type.
- Armor is a flat 5 damage reduction per hit; fire rate is 1 shot/second by default; enemy speed is 2 tiles/second by default; Pulse splash is 1 tile at half damage.
- Range bonus support ("Shield Relay") is parked.
- Tech: single `index.html`, data separated from logic; real JSON files are a stretch goal.

Still open (defaults assumed until decided):
- Replay farming: replays pay kill credits and leftover credits every time. Is unlimited grinding acceptable? *Default: yes for v0.1.*
- Do Unknown missions reveal their roster after a loss as well as a win? *Default: yes, enemies seen are recorded either way.*
- Are challenge objectives shown before the mission? *Default: yes, on the loadout screen.*
- Wave count per level: default 20, revisit once real level design starts.

## 15. Future Hooks (not for v0.1)

- Support radius 2 (18 tiles).
- Range support bonus.
- Offense mode: companion attacker units per tower, attacking an opponent's base.
- PvP: online matchmaking for offense and defense.
- Planet travel: completing a planet unlocks the next, with new enemies and towers.
