# Alien Tower Defense: Core Design Doc (v0.2)

Scope: defense mode only. Offense, PvP, and additional planets are noted as future hooks, not built yet.

## 1. Pitch

Build and defend a base on an alien world. Between missions you upgrade your towers and economy and unlock new tower types. Before each mission you choose a loadout of towers, constrained by an energy budget. Some missions reveal their enemy types in advance; others you learn by playing. Placement uses a simple, fully visible hex grid, so every bonus and every targeting zone is readable at a glance.

## 2. Core Loop

1. **Hub (between missions):** spend credits on permanent upgrades, unlock towers with alien artifacts, review the next mission.
2. **Loadout:** choose which unlocked towers to bring, staying within the mission's energy budget.
3. **Mission:** place towers during build phase, then run waves. Spend credits on in-mission upgrades.
4. **Debrief:** collect credits, check which challenge objectives were met, record enemy types seen.

## 3. Currencies

Two currencies, by design.

**Credits (standard currency)**
- Earned for every enemy defeated.
- Spent during a mission to place towers and upgrade them.
- Carry-over: credits spent during a mission are deducted. What carries over is credits left unspent at the end of the mission, plus a completion bonus.
- Wave milestone bonuses: one-time credit payouts within a level, locked in permanently once reached. They are the consolation for losses, so a loss pays nothing extra. Example for a 20-wave level:
  - Survive wave 5 (25%): 50 credits
  - Survive wave 10 (50%): 100 credits
  - Survive wave 15 (75%): 150 credits
  - Clear wave 20 (100%): 250 credits
- Milestones are tied to waves, not to completing levels. Assumed: each level has its own milestones, and each pays once per level. Confirm.
- Credits spent mid-mission are deducted from the carry-over, so spending has a real cost later. Milestone bonuses are not affected by spending.
- Credits buy upgrades to towers you already have. They never unlock new towers.

**Alien artifacts (rare currency)**
- Earned by completing challenge objectives on a level.
- Each level has three artifacts, one each for easy, medium and hard challenges.
- Artifacts unlock new tower types. They are not spent on upgrades.

## 4. Challenge Objectives (Artifacts)

Each level lists three optional challenges, one per difficulty. Completing a challenge awards that level's artifact.

Example challenge types (tuned per level):
- Win within a time limit
- Win while spending no more than X credits in the mission
- Win without losing any base health
- Win without placing a given tower type (a tower ban)

Design intent: challenges teach the loadout puzzle. A tower ban forces you to find another answer. A credit cap forces you to think about the spend-versus-carry-over tension.

## 5. Between-Mission Upgrades (Meta Progression)

Upgrades are permanent and applied outside the mission. They never add new abilities to a tower; they only raise numbers and caps.

Per-tower stat upgrades (paid in credits):
- Damage
- Range (in tiles)
- Fire rate
- Energy efficiency (lowers the energy cost of the tower)

Per-tower caps:
- Each tower type has a **max in-mission level**, raised by meta upgrades bought for it. Example: Blaster starts at max level 3; meta upgrades raise it to 5, then 7.
- In-mission upgrades spend credits to raise a tower up to that cap.

Economy upgrades (paid in credits):
- Starting credits per mission
- Income per wave
- Energy capacity (the player's base energy cap, see section 6)
- Salvage refund rate

Tower unlocks (paid in alien artifacts): new tower types join the loadout pool.

Planet progression (later system): completing a planet unlocks travel to the next. For v0.1, a single planet with a finite upgrade tree is enough.

## 6. Loadout and Energy

- Every tower has an **energy cost**.
- **Energy budget per mission** is set by the mission. The budget available to the player is:
  - the mission's own limit, if it sets one, otherwise
  - the player's energy cap, which starts at a base value and is raised by energy capacity upgrades.
- Missions can impose a tighter budget than the player's cap. This forces you to leave strong towers at home.
- The sum of loadout energy costs must be at or below the budget.
- A tower's energy cost is fixed for the mission. Energy efficiency upgrades lower it.
- Players cannot bring their whole arsenal. This is the core strategic constraint.

### Mission Intel
- **Briefed:** before loadout selection, the player sees which enemy types appear in the level and an approximate total count for each type across the whole level. It does not show how those enemies are split across waves. Exact per-wave details still come from Wave Intel (below).
- **Unknown:** the roster is hidden. The player picks a loadout blind, plays, and sees enemy types as they appear. Afterward the roster is recorded, so replays are Briefed.

Design intent: first attempts on Unknown missions are about learning; repeat attempts are about optimizing the loadout.

### Wave Intel (per-wave reveal)
- Each level sets its own wave count. The default is **20**. The count is data-driven and not locked; a level can be 5, 20, 50, or anything else.
- The HUD shows one square per wave, in order.
- When a wave is defeated, its square is marked cleared. On later attempts at that level, clicking a cleared square opens that wave's details: every enemy type and count, and spawn timing.
- Waves not yet defeated show no details. Clicking them shows only "not yet cleared" and reveals nothing about their enemies.
- Wave intel is saved per level. It is what lets a player plan a loadout around known waves on a replay.
- Relationship to Briefed/Unknown: Briefed shows the level's full roster before loadout. Wave intel is a per-wave record earned by clearing a wave. Both can apply to the same level (see open questions).

## 7. The Grid

- **Hex grid**, pointy-top. Offset "odd-r" coordinates in data, with conversion to axial or cube for maths.
- Each tile has six neighbours.
- Towers occupy one tile.
- Every tower shows two zones:
  - **Support zone:** tiles that receive its bonus. Radius 1 = the six adjacent hexes.
  - **Attack zone:** tiles it can shoot at, computed from range in whole hex tiles.
- Attack and support zones are highlighted on hover, selection, and placement. No hidden radii.
- Support radius is fixed at 1 for v0.1. A radius of 2 (18 tiles) is a later option.

### Support Rules (v0.1)
- Bonuses are simple and named:
  - **Overcharge:** +X% damage
  - **Overclock:** +X% fire rate
  - **Shield Relay:** +X% range
- The same bonus type does not stack from multiple sources. Different types stack.
- Keep to 2 or 3 support types in v0.1 so it stays legible.

## 8. Combat

- Enemies follow a fixed path across the grid (path-based, not free-roaming).
- Towers fire at enemies inside their attack zone. Target rule: first, strongest, or closest. Target priority can be a later upgrade toggle.
- Waves are defined per mission as groups of enemies with type, count, and spawn timing.
- Each enemy defeated pays credits.
- Base has health; at zero the mission is lost.
- Towers can be upgraded during a mission with credits, up to their meta-set cap.

## 9. Tower Roster (Level One)

| Tower | Role | Attack | Notes |
|---|---|---|---|
| Blaster | Single-target damage | Single target, medium range | Starting tower, unlocked from the start |
| Pulse | Area damage | Splash, short range | Unlocked by an artifact |
| Lance | Long range | Single target, long range | High energy cost; unlocked by an artifact |
| Relay | Support | No attack; Overcharge to support zone | Low energy cost; unlocked by an artifact |

Enemy types for level one: 3 (basic, armored, fast), so loadout choices matter.

## 10. Level One (First Playable Map)

- Map: 6 columns wide by 18 rows tall, hex grid.
- Enemy path: a single zigzag from top to bottom. Exact tiles are in `data/levels/level1.json`.
- Waves: 20 (default per level). Milestone bonuses at waves 5, 10, 15 and 20.
- Layout: HUD at top (base health, credits, energy used / budget, and a row of 20 wave squares). Map in the middle. Controls at bottom.
- Wave squares: cleared waves are filled, the current wave is outlined, upcoming waves are empty. Clicking a cleared square shows that wave's intel (see section 6).
- Level size is a starting point; tune after playtesting.

## 11. Data Model (suggested)

Keep stats in data files, not code, so balance changes don't need code changes.

- `data/towers.json`: id, name, role, energy_cost, base_damage, base_range_tiles, fire_rate, place_cost, base_max_level, support_bonus, unlock (starting | artifact id), sprite key
- `data/enemies.json`: id, name, hp, speed, armor, bounty
- `data/levels/*.json`: id, name, grid size, path tiles, energy_budget (optional override), intel (briefed | unknown), waves, challenges (easy, medium, hard, each with type and parameters, plus the artifact it awards)
- `data/meta_upgrades.json`: id, target, effect, cost (credits or artifacts), prerequisites
- `save/progress.json`: credits carry-over, artifacts owned, unlocked towers, meta upgrade levels, caps, completed levels, challenges met, cleared waves and wave intel per level, milestone bonuses claimed

## 12. Screens (v0.1)

1. **Hub:** level list, upgrade tree, tower unlocks.
2. **Loadout:** tower cards with energy cost, energy bar against budget, enemy roster (if Briefed), challenge list for the level.
3. **Mission:** HUD at top (stats and a square per wave; cleared squares open wave intel), hex grid, controls at bottom (tower palette, wave controls, speed).
4. **Debrief:** credits earned, challenges met, artifacts awarded, newly discovered enemy types.

## 13. Build Plan

- **M1: Playable skeleton.** Hex grid, one zigzag path, placement, one tower (Blaster), basic waves, credits from kills, energy budget enforcement, win and lose. Level 1 only. See `CLAUDE_CODE_PROMPT_M1.md`.
- **M2: Towers and zones.** Pulse, Lance and Relay; visible attack zones; Overcharge bonus.
- **M3: Loadout and challenges.** Loadout screen, per-mission budgets, Briefed vs Unknown intel, challenge objectives and artifacts.
- **M4: Meta progression.** Hub, meta upgrades, per-tower caps, economy upgrades, tower unlocks, wave milestone credit bonuses, save file.
- **M5: Tuning.** Balance data and playtest notes.

Out of scope for now: offense mode, PvP, multiple planets, sound, art beyond placeholders.

## 14. Open Questions

- **Milestone scope:** do wave milestones pay once per level, or once per campaign? Assumed: once per level.
- **Level win payout:** is there any per-level credit payout on a win, or are the wave milestones the only lump-sum credit reward besides kills?
- **Milestone totals:** the 50/100/150/250 values assume a 20-wave level. Confirm the wave count per level before tuning.
- Does the energy budget change per mission only through mission limits, or should meta upgrades also raise the cap for specific missions?
- Do Unknown missions reveal their roster after a loss as well as a win?
- Are tower caps per tower type or per placed tower? Proposed default: per type.
- Are challenge objectives shown before the mission, or discovered?
- Wave count per level: the default is 20, but it is not locked. Revisit once real level design starts (for example, short 5-wave levels or 50-wave levels).

## 15. Future Hooks (not for v0.1)

- Support radius 2 (18 tiles).
- Offense mode: companion attacker units per tower, attacking an opponent's base.
- PvP: online matchmaking for offense and defense.
- Planet travel: completing a planet unlocks the next, with new enemies and towers.
