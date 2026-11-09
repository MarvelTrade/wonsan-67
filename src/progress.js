// Прогресс по сериям в localStorage['wonsan67.progress']: { won: [id, …] }
// Открыта первая серия и каждая следующая за пройденной.
import { PROGRESS_KEY, LEVELS } from './config.js';

export function loadProgress() {
  try {
    const p = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
    return { won: Array.isArray(p.won) ? p.won : [] };
  } catch {
    return { won: [] };
  }
}

export function markWin(levelId) {
  const p = loadProgress();
  if (!p.won.includes(levelId)) p.won.push(levelId);
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
  } catch {
    // нет хранилища — прогресс живёт до перезагрузки
  }
  return p;
}

// Сколько серий открыто: первая + по одной за каждую пройденную подряд
export function unlockedCount(p = loadProgress()) {
  let n = 1;
  for (const l of LEVELS) if (p.won.includes(l.id) && l.id === n) n++;
  return Math.min(n, LEVELS.length);
}
