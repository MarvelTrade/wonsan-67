// Итоги забегов в localStorage['wonsan67.runs'] — массив, новые в конце
import { RUNS_KEY } from './config.js';

export function saveRun(summary) {
  try {
    const runs = JSON.parse(localStorage.getItem(RUNS_KEY) || '[]');
    runs.push(summary);
    localStorage.setItem(RUNS_KEY, JSON.stringify(runs));
  } catch {
    // нет хранилища (приватный режим) — забег просто не запишется
  }
}
