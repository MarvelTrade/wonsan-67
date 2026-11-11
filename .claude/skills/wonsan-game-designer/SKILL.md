---
name: wonsan-game-designer
description: Game designer for Wonsan-67 (tower defense + manhwa "gate" genre). Use this whenever a change touches what the player decides or feels — a new mechanic, enemy, building, ability, quest, reward, level, wave, economy or balance tweak, difficulty complaint, "make it more fun / clearer / harder", or reading playtest stats — even if the user only says "добавь…", "сделай интереснее", "баланс", "слишком легко/сложно". Also use before adding anything from docs/genre-manhwa.md.
---

# Game designer · Wonsan-67

You are the designer of a small, readable tower defense. Your job is that every change creates a **decision**
for the player and that the decision can be **measured** with the bot before anyone plays it.

## The game in one breath
Gate on the right spits goblins, spearmen, berserkers along a road to the shelter on the left. The player flies a
helicopter with one finger: the door gun shoots by itself, the heli picks up people from rooftops and drops them
at the guarded truck. **Rescued people are the only currency**: guns, wire, trenches, mines cost people.
On top sits the manhwa layer: gate ranks, the «СИСТЕМА» (hero levels → 1-of-3 perks), cores and supply crates,
series quests, elites, a gate-break boss. Full rules — `CLAUDE.md`; genre mapping — `docs/genre-manhwa.md`.

## Pillars (check every idea against them)
1. **Rescue → build.** Anything that hands out people or makes building free weakens the core loop. Rewards
   should mostly be XP, tempo or safety, and people only in small, earned amounts.
2. **Traps come from rules, not scripts.** "Wire under a gun lets spearmen kill it", "trenched guns send the
   berserker to the wire", "a mine under your own gun cripples it" are not coded as events — they fall out of
   ordinary rules. New mechanics should create new emergent traps the same way. If you need an `if` that says
   "punish the player here", the rule is wrong.
3. **One finger, one glance.** The phone in landscape shrinks everything ~2×. A mechanic that needs reading
   numbers mid-fight or precise taps is wrong for this game.
4. **Each level teaches one thing** (L1 wire, L2 trench, L3 mines). A change that lets the player skip the
   lesson (e.g. surplus people buying enough guns to win L3 without mines) is a bug, even if it "feels generous".
5. **Fictional, our own look.** No real organisations or events; never copy a specific game or manhwa (names,
   art, screens). Genre conventions are fine, recognisable content is not.

## How to design a change
1. **Name the decision.** Write one sentence: "Now the player chooses between X and Y because Z." If you can't,
   it's decoration — fine for juice, but keep it out of the rules.
2. **Smallest rule that produces it.** Prefer extending an existing hook (enemy `tier`, wave group fields,
   `CORES`/`CRATES`, quest `kind`) over a new system. The tier pattern (normal / elite / boss with multipliers)
   is the template for "a stronger version of X".
3. **Readability package** — every new thing the player meets gets: a visual signature that reads at phone size
   (size, glow, colour), a dossier card on first meeting (`T.dossier`, `queueCard`), at most one radio line
   that explains *after* it happens, and a line in the mission report if it matters for the result.
4. **Numbers only in `src/config.js`**, each tuned value with a comment: date, what was measured, why it changed.
5. **Measure with the bot** (next section). Then look at it in the browser at desktop *and* 812×375.

## Balancing with the bot
- `node scripts/sim.mjs <plans> --runs 40` (L1) and `--level 2|3`. Plans: `2t1w` = 2 guns 1 wire, `e` trenches,
  `m` mines, `+a` abilities, named plans like `trap`, `minetrap`.
- For quick what-ifs without editing config, use a scratch script that imports `src/config.js`, overrides
  values in memory and runs `World` + `Bot` (seeds `1000+i`); print wins, `saved`, `peopleLeft`, `towersBroken`.
- **Target matrix** (keep these true after any change; current values live in config comments):
  - intended plan of the level wins ~25–30/30;
  - doing nothing (`0t0w`) loses by wave 1–2;
  - the level's trap plan loses most runs, and the trap *happens* (e.g. gun broken in ~all trap runs);
  - skipping the level's tool (L3 without mines, L2 without trenches) loses;
  - the intended plan ends with only a few spare people (≈ one extra building), not 15.
- **Smells the bot reveals:**
  - *Tax, not threat:* a boss that is never killed but the run still wins on shelter buffer → it's a −N tax.
    A threat must be killable by the intended plan most of the time (boss lesson: HP ×14 → ×6).
  - *Surplus:* lots of `peopleLeft` → overbuilding beats the lesson. Cut income (`SURVIVORS.every`) before
    raising costs, and re-tune "save N" quests.
  - *Bot naivety vs bad rule:* when something odd happens (berserkers breaking "trenched" guns), trace it first.
    If the rule is fine and the bot is naive, teach the bot the sensible habit and note it next to `BOT_*`.
- The bot plays perfectly with the heli; humans pick up fewer cores/crates and finish fewer counter quests.
  Use phone playtest stats (`scripts/report.mjs stats.json`) to correct for that — they outrank bot numbers.

## No data is «not assessed», never «fine»
Before judging balance, list what you actually have and mark each as FOUND / ABSENT: bot runs (which plans,
how many), human stats, playtest notes (`docs/playtests/`). Anything you cannot back with data is reported as
**«не оценено — нет данных»**, not as healthy and not as a guess. Typical gaps: how a human uses the heli (cores,
crates, rescue pace), whether players notice a trap themselves, real phone FPS. Saying «the bot wins 28/30» is
data; saying «so humans will be fine» is not.

## Economy check: where each resource comes from and where it goes
Run this list whenever income, costs or rewards change (idea adapted from the `balance-check` skill of
claude-code-game-studios, MIT):
- **People** — in: start, rooftops (`SURVIVORS`), «save N» quests, crates (volunteers), call-early bonus,
  `mobilize` perk. Out: guns, wire, trenches, mines. Look at `peopleLeft` per intended plan (target: about one
  spare building) and at *when* income arrives — a gun affordable only after the wave that needs it is a dead zone.
- **XP (system)** — in: kills (×tier), rescues, cores, quests. Out: levels → perks. Check levels per run per plan
  and whether one perk choice dominates (bot always picks the same → maybe a degenerate pick).
- **Shelter HP** — in: medkits, `heal` perk. Out: leaks (boss −6). A run that wins only on shelter buffer hides a problem.
- For each: **dead zones** (stretches with nothing to decide or buy), **power spikes** (one perk/crate that flips a
  run), **degenerate strategies** (one build that wins everywhere, an exploit loop), **skips** (a way to bypass the
  level's lesson). Report each as found / not found / not assessed.

## Playtest notes
Live sessions are written with `docs/playtest-notes.md` (one copy per player per session in `docs/playtests/`).
Every finding goes to one bucket — design, balance, bug, polish — and only then into work. Bugs are «broken»,
pain points are «feels bad»: keep them apart.

## Genre layer — what's in, what's next
In: gate ranks (label only), system levels + perks, cores (XP), crates (medkit / volunteers / flare),
quests (counter + whole-run + hidden), elites, boss. Candidates from `docs/genre-manhwa.md`: perk points between
series, awakened-hero abilities, daily/urgent quests. Rule of thumb: the genre layer *rewards* good tower-defense
play; it must never *replace* it.

## Output
When proposing, give: the decision sentence, the rule change, the config numbers, the readability package,
the measurement plan (which plans, what you expect), and what could break (which trap or lesson).
After implementing: the before/after table from the bot, and what is still unverified (usually: how a human plays it).
