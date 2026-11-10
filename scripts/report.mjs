// Таблица плейтеста из скопированной статистики («Скопировать статистику» в игре).
// node scripts/report.mjs stats.json        — только забеги игрока
// node scripts/report.mjs stats.json --all  — вместе с ботом
// Файл — то, что игра положила в буфер: {"game":"wonsan67","runs":[…]} (или просто массив забегов).
import fs from 'node:fs';

const [file, ...flags] = process.argv.slice(2);
if (!file) {
  console.error('node scripts/report.mjs <stats.json> [--all]');
  process.exit(1);
}
const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
let runs = Array.isArray(raw) ? raw : raw.runs || [];
if (!flags.includes('--all')) runs = runs.filter((r) => r.plan === 'human');

const fmt = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
const by = (o = {}) => Object.entries(o).map(([k, v]) => `${NAMES[k] || k} ${v}`).join(', ') || '—';
const NAMES = { spearman: 'копейщ.', berserker: 'берсерк', goblin: 'гоблин', mine: 'своя мина', trample: 'затоптали' };

const rows = runs.map((r, i) => ({
  '#': i + 1,
  уровень: r.level || 1,
  итог: r.result === 'win' ? 'победа' : r.result === 'lose' ? 'поражение' : r.result,
  волна: r.wave,
  спасено: r.saved,
  пропало: r.lostSurvivors,
  'пушки/пров./окопы/мины': [r.spentTowers, r.spentWire, r.spentTrench || 0, r.spentMines || 0].join('/'),
  'людей осталось': r.peopleLeft,
  'пушек сломано (кем)': `${r.towersBroken} (${by(r.brokenBy)})`,
  'проволок порвано (кем)': `${r.wiresBroken} (${by(r.wiresBrokenBy)})`,
  'мины: под кем': by(r.minesTriggeredBy),
  звёзды: r.stars ?? '—',
  'ур./ядра/ящики': r.heroLevel ? [r.heroLevel, `${r.coresTaken || 0}из${r.coresDropped || 0}`, r.cratesTaken || 0].join('/') : '—',
  'усиления': r.perks ? Object.entries(r.perks).map(([k, v]) => v > 1 ? k + '×' + v : k).join(' ') || '—' : '—',
  'элит/босс': `${r.elitesKilled ?? '—'}/${r.bossKilled ? 'свален' : r.bossLeaked ? 'прорвался' : '—'}`,
  задания: r.quests ? r.quests.map((q) => (q.state === 'done' ? '✓' : '✗') + q.id).join(' ') : '—',
  'волну раньше': r.calledEarly || 0,
  умения: r.abilityUsed ? Object.values(r.abilityUsed).reduce((a, b) => a + b, 0) : 0,
  время: fmt(r.duration),
  план: r.plan,
}));

if (!rows.length) {
  console.log('Забегов нет.');
  process.exit(0);
}
const cols = Object.keys(rows[0]);
const width = cols.map((c) => Math.max(c.length, ...rows.map((r) => String(r[c]).length)));
const line = (vals) => '| ' + vals.map((v, i) => String(v).padEnd(width[i])).join(' | ') + ' |';
console.log(line(cols));
console.log('|' + width.map((w) => '-'.repeat(w + 2)).join('|') + '|');
for (const r of rows) console.log(line(cols.map((c) => r[c])));

// Короткая сводка по уровням
console.log('');
for (const lvl of [...new Set(rows.map((r) => r['уровень']))].sort()) {
  const rs = runs.filter((r) => (r.level || 1) === lvl);
  const wins = rs.filter((r) => r.result === 'win');
  const first = rs.findIndex((r) => r.result === 'win');
  console.log(
    `Уровень ${lvl}: ${wins.length}/${rs.length} побед` +
      (first >= 0 ? `, первая — с ${first + 1}-й попытки` : '') +
      `, людей не потрачено в среднем ${(rs.reduce((a, r) => a + r.peopleLeft, 0) / rs.length).toFixed(1)}` +
      (rs.some((r) => r.quests) ? `, заданий выполнено ${rs.reduce((a, r) => a + (r.quests || []).filter((q) => q.state === 'done').length, 0)} из ${rs.reduce((a, r) => a + (r.quests || []).length, 0)}` : ''),
  );
}
