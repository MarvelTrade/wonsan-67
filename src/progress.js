// Прогресс в localStorage['wonsan67.progress']:
// { won: [id, …], stars: { id: лучшее 1–3 }, seen: [ключи досье, которые игрок уже видел] }
// Открыта первая серия и каждая следующая за пройденной.
import { PROGRESS_KEY, LEVELS } from './config.js';

export function loadProgress() {
  try {
    const p = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
    return {
      won: Array.isArray(p.won) ? p.won : [],
      stars: p.stars && typeof p.stars === 'object' ? p.stars : {},
      seen: Array.isArray(p.seen) ? p.seen : [],
      quests: p.quests && typeof p.quests === 'object' ? p.quests : {},
    };
  } catch {
    return { won: [], stars: {}, seen: [], quests: {} };
  }
}

function save(p) {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
  } catch {
    // нет хранилища — прогресс живёт до перезагрузки
  }
}

// Победа: открыть следующую серию и запомнить лучший результат по звёздам
export function markWin(levelId, stars = 1) {
  const p = loadProgress();
  if (!p.won.includes(levelId)) p.won.push(levelId);
  p.stars[levelId] = Math.max(p.stars[levelId] || 0, stars);
  save(p);
  return p;
}

// Задания серии: запомнить выполненные (за все забеги — объединение)
export function markQuests(levelId, ids) {
  if (!ids.length) return;
  const p = loadProgress();
  const had = new Set(p.quests[levelId] || []);
  for (const id of ids) had.add(id);
  p.quests[levelId] = [...had];
  save(p);
}

// Досье (новый враг / новое укрепление) показываем один раз
export function wasSeen(key) {
  return loadProgress().seen.includes(key);
}

export function markSeen(key) {
  const p = loadProgress();
  if (!p.seen.includes(key)) p.seen.push(key);
  save(p);
}

// Сколько серий открыто: первая + по одной за каждую пройденную подряд
export function unlockedCount(p = loadProgress()) {
  let n = 1;
  for (const l of LEVELS) if (p.won.includes(l.id) && l.id === n) n++;
  return Math.min(n, LEVELS.length);
}
