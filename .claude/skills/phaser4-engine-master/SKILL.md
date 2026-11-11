---
name: phaser4-engine-master
description: Phaser 4 + Vite engine expert for Wonsan-67 — rendering, depth/layers, sprites and pools, Graphics primitives, text, tweens, input, scenes, performance, phone layout, visual QA in the browser pane, and the Blender sprite pipeline. Use this whenever you write or debug code in src/scenes, src/ui or src/art, add anything drawn on screen, fix "it looks wrong / invisible / overlaps / blurry / slow", make the game look better, or verify a visual change — even if the change seems like a one-liner.
---

# Phaser 4 engine master · Wonsan-67

Stack: Phaser 4.2, plain JavaScript, Vite 8. The simulation (`src/sim/World.js`) knows nothing about Phaser;
`GameScene` reads the world each frame and draws it. Keep it that way — logic in World, pixels in scenes.

## Official Phaser skills (installed next to this one)
Before writing filters, lighting, Noise/Gradient objects, CaptureFrame, SpriteGPULayer/TilemapGPULayer or masks,
read the official skill instead of writing from memory — the Phaser 4 API differs a lot from Phaser 3:
`../filters-and-postfx/SKILL.md` (Glow, Blur, ColorMatrix, Displacement, masks as filters),
`../v4-new-features/SKILL.md` (RenderNodes, Noise, Gradient, GPU layers, `setLighting(true)`, tint modes),
`../v3-to-v4-migration/SKILL.md` (what was removed or renamed). Installed by the author's plan
(`npx skills add phaserjs/phaser --skill … --agent claude-code`); versions pinned in `skills-lock.json`.

## Phaser 4 gotchas we have already hit
- **`setTintFill` is gone.** Use `img.setTint(c).setTintMode(Phaser.TintModes.FILL)`; reset with
  `clearTint().setTintMode(Phaser.TintModes.MULTIPLY)`. Pooled sprites must be reset or the white flash sticks.
- **Equal depth = undefined order.** Text and a Graphics background at the same depth can swap — the build
  menu labels vanished under their own buttons at depth 10. Give text a strictly higher depth (10.5) than its
  backing shape, always.
- **Clear per-frame Graphics at the start of `draw()`**, before anything draws into them (wire once vanished
  because `topG` was cleared after it was drawn).
- `snapshotArea` is expensive — never per frame.
- URL `+` becomes a space: `params.get('bot')?.replace(' ', '+')`.
- Don't create Text objects per frame — create once (or pool) and `setText`/`setVisible`.
- `fillGradientStyle` exists for the light overlay; prefer one big gradient over many alpha rects.

## Layers (depth) — keep new things inside this map
bg 0 · ground Graphics `g` 1 · heli shadow 1.5 · light 1.9 · ambient 1.95 · sprites `2 + y/1000` (y-sorted) ·
`topG` 3 (barrels, HP bars, bullets) · fx 5 · particles 5.5 · heli 6 · rotor 6.1 · build menu 10 (labels 10.5) ·
HUD 14–16 · notices 17 · results 19–21 · dossier 30 · system window 32.
Ground things (rings, wire, mines, auras, cores' glow) go on `g`; things that must read above figures go on `topG`.

## Sprites
- Figures/buildings are Blender renders (`tools/blender/make_sprites.py`) in manhwa toon style, 3/4 tilt camera,
  foot origin from `public/sprites/sprites.json`. Scales per key: `SPRITES.keyScale` (files are 2×).
- Moving things come from the pool `GameScene.spr(key, x, y, flip, scale)`; call `hidePool()` after the loop.
- A "stronger version" of a unit = same sprite, bigger scale + aura on `g` + its own HP bar treatment (see tier
  rendering for elite/boss). Don't fork sprites for variants.
- Rebuild sprites (~1 min):
  `SPRITE_SCALE=2 "C:/Program Files/Blender Foundation/Blender 4.2/blender.exe" -b --factory-startup --python tools/blender/make_sprites.py -- public/sprites [key ...]`

## Looking good (manhwa palette — docs/art-style.md)
- Shadows lean violet-blue, highlights warm sunset; background calmer and lighter than characters.
- Violet = the gate's colour (gate, cores, boss aura). Red = danger/elite. Yellow/gold = institute supplies and
  affordable actions. Blue teletype = «СИСТЕМА». Don't spend these colours on unrelated UI.
- Paper UI (dossier, report, pause) uses Courier-style typewriter text on `COLORS.paper`; stamps are always
  bright red (failed) or green (done), Korean big + RU · EN small.
- Juice is cheap and welcome: particles (`src/art/particles.js`), short rings, pulses — but every effect must
  be readable at phone size and must not hide the road.

## Performance budget — measure first, then optimise
(Rule adapted from the `perf-profile` skill of claude-code-game-studios, MIT.)
- **Budget** (from the dev plan): 60 FPS on a 3–4-year-old mid-range Android, landscape 812×375 — frame ≤ 16.7 ms,
  worst frame in a half-second window ≤ 33 ms. Measure with `?debug=1` (FPS and worst frame, bottom-left). Heaviest
  scene to test: level 3, wave 3, boss out, all effects on.
- A number measured on the PC is **not** the phone number. Until someone measures on a real phone, report phone
  performance as «не оценено», never «OK».
- Never optimise on a hunch: measure, change one thing, measure again, write both numbers in the commit.
- Hotspots to check in code (static review finds candidates, the counter confirms):
  - allocations per frame: new Text/Graphics/arrays in `update`/`draw` (pool them — see damage numbers, tokens);
  - Graphics redrawn every frame with many shapes (particles cap `FX.max`, terrain is drawn once);
  - filters: each object with active filters costs an extra pass; external (screen-space) filters are full-screen
    and the most expensive; `setForceComposite(true)` on a camera makes it render via a framebuffer;
  - `CaptureFrame`, Displacement, Glow — must sit behind the «Качество: низкое» switch.
- When a phase-3 layer goes in: FPS before/after on the heaviest scene, and the «low» quality path still works.

## Phone layout
- Game renders 1280×720; landscape phone (812×375) shows it ~0.5×. Body text ≥ ~20 px in game units
  (→ ~10 px on phone); key labels ≥ 24. All sizes in `config.js` (`DRAW`, `HUD`, `RADIO`, `SYS_UI`, …).
- Reserved zones: HUD top-left (incl. «Ур.» and quest list), radio top-centre (x 340–1100), pause top-right,
  abilities in the map's `abilityCorner`, hint/boss bar bottom-centre. New UI must find a free zone or replace one.

## Visual QA routine (do it every time something is drawn differently)
1. `npx vite build` — must pass.
2. Never test in the user's tab (`seed`). Open your own tab, first save storage:
   `window.name = JSON.stringify({p: localStorage.getItem('wonsan67.progress'), r: localStorage.getItem('wonsan67.runs')})`
   and restore it at the end, then close the tab. Background tabs don't run rAF — front your tab while testing.
3. Drive the state from JS (`window.__world`): spawn enemies (`spawnEnemy(type, tier)`), push cores/crates,
   `gainXp`, `finish('win')`, freeze movement with `w.speedMul = () => 0` for side-by-side comparisons.
4. Screenshot + `zoom` on the exact region; check contrast (text over same-coloured fills), overlaps with the
   reserved zones, and size relative to neighbours (a boss must read as a giant next to an elite).
5. `resize_window` 812×375 for the phone pass, then reset to desktop.
6. `read_console_messages` with `onlyErrors` — must be clean (ignore entries with an old `?t=` timestamp).

## Output
Say what you drew where (layer/depth, config keys added), show the before/after screenshot finding, and list
what you couldn't verify (real phone, real finger).
