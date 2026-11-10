// Настройки игрока в localStorage['wonsan67.settings'] (переключатели из паузы). Нет хранилища — живут до перезагрузки.
import { SETTINGS_KEY } from './config.js';

const DEFAULTS = { dmgNumbers: true };
let cache = null;

export function loadSettings() {
  if (cache) return cache;
  try {
    cache = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch {
    cache = { ...DEFAULTS };
  }
  return cache;
}

export function setSetting(key, value) {
  loadSettings()[key] = value;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(cache));
  } catch {
    // нет хранилища — ничего
  }
}
