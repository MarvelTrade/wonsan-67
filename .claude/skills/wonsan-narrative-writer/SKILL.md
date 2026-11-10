---
name: wonsan-narrative-writer
description: Scenario and narrative writer for Wonsan-67 — radio lines, dossier cards, mission report texts, system/quest wording, level intros, names of enemies and bosses, the cover and chapter framing of the game as a manhwa you read through. Use this whenever you add or change any player-facing text in src/texts.js, name something new, write story beats or cliffhangers, or make the game feel like a manhwa — even for "просто добавь реплику" or a one-word label.
---

# Narrative writer · Wonsan-67

The game is a manhwa you play through: each series is a chapter, the gate is the inciting incident, the radio is
the speech bubbles, the dossier is the "new character" splash page, the mission report is the last panel with
a stamp. Write every text as if it were lettered into a panel.

## World (fictional — never real organisations, events or people)
- 1967, an invented coastal town Вонсан. A station; violet **gates** open; creatures pour out toward the shelter.
- **Институт объединения и ограничения доступа**, its post **«Сектор 67»** — the "association" of the genre:
  measures the awakened, sends them to gates, counts resources (people too). Dry, bureaucratic.
  Open mystery: did the institute know the gates would open? Hint, never answer.
- Crew of transport helicopter board «шестьдесят седьмой». Full cast and voices: `docs/characters.md`.
  - **Сержант Хан Тхэ Сок** — awakened, "manifestation of weapons" (he *manifests* the gun nests). Short, factual,
    numbers and distances. Calls the medic «Юн».
  - **Медик Юн Со Хи** — awakened, "light of healing". Softer, with pauses («…»). Cares about people and losses.
    Calls him «сержант».
  - **Диспетчер Ли Мун Гиль** — the institute's voice. Formal «вы», older, scolds about spending: «Экономьте ресурс».

## Where text lives
All player-facing text is in `src/texts.js` (`T`). Radio lines: `T.radio.<key> = [speaker, line]`, triggered in
`GameScene.radioFor`. Dossier: `T.dossier.enemies / elites / bosses / builds / abilities` with `name`, `text`,
`traits`. System window: `T.system`. Quests: `T.quests`. Report: `T.summary`, `T.report`.

## Rules of the radio
- **Never warn about a trap before it happens.** The radio explains *after*: «Пушку закололи. Проволока держала
  их у ствола.» Discovery is the player's.
- One line per event per run (Radio.say dedupes); queue holds 3 — so lines must stand alone.
- Length: the phone shows ~2 short lines; aim for ≤ 70 characters, hard limit ~110. Cut adjectives first.
- Each speaker sounds different enough that the line works without the name tag.

## Dossier cards
- `name` — what the institute calls it (bureaucratic, a bit ominous): «Знаменосец врат», «Вожак прорыва».
- `text` — 1–2 sentences: what it does *in game terms*, in-world voice.
- `traits` — 3–4 dash lines, concrete and testable («удар копья ×1,5», «прорвался — убежищу −4»). These are the
  numbers the player actually needs; keep them in sync with `config.js` when balance changes.

## Manhwa framing
- Series = chapter. A level intro line is the opening panel; the last-wave line is the cliffhanger; the report
  stamp is the final panel. Korean appears as *design* (stamps 임무 완수 / 임무 실패, 기밀, the title 원산-67,
  시스템) and is always glossed in RU (and EN on stamps). Keep Korean short and correct; don't invent Korean
  sentences you can't verify.
- The «СИСТЕМА» speaks like a 1967 teletype: cold, uppercase headers, short statements («Уровень повышен: 3»,
  «Задание выполнено»). Not a hologram, not a game UI voice.
- Genre beats are welcome (gates with ranks, awakened heroes, level-ups, loot, hidden quests, a boss of the
  break), but **never borrow recognisable names, scenes, phrasings or designs from a specific manhwa or game.**

## Russian style
- Live, short, spoken Russian; ё where it matters. Numbers as digits in UI, words in speech when natural.
- Plural agreement: write helpers for counts (1 ядро, 2 ядра, 5 ядер) — never ship «5 ядра».
- Military/institute tone without real-army jargon that points to a real country's units.

## Output
For new text: list each key, the speaker, the line, and why it's placed there (which event). Flag any line
over 70 characters and any trait number that must match config.
