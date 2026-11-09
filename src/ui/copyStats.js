// «Скопировать статистику»: все забеги игрока из localStorage — в буфер обмена, одной строкой JSON.
// По http с телефона (адрес 192.168…) navigator.clipboard недоступен — тогда старый способ через
// скрытое поле, а если и он не сработал — поле с текстом поверх игры, чтобы скопировать руками.
import { RUNS_KEY } from '../config.js';
import { T } from '../texts.js';

export function statsText() {
  let runs = [];
  try {
    runs = JSON.parse(localStorage.getItem(RUNS_KEY) || '[]');
  } catch {
    runs = [];
  }
  return JSON.stringify({ game: 'wonsan67', runs });
}

export async function copyStats() {
  const text = statsText();
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // ниже — запасной способ
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.cssText = 'position:fixed;left:-9999px;top:0;';
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  area.remove();
  if (!ok) showManual(text);
  return ok;
}

// Не скопировалось — показать текст, его можно выделить и скопировать пальцем
function showManual(text) {
  const wrap = document.createElement('div');
  wrap.style.cssText =
    'position:fixed;inset:0;background:rgba(10,14,10,.92);display:flex;flex-direction:column;gap:12px;' +
    'padding:16px;box-sizing:border-box;z-index:10;font:16px Arial,sans-serif;color:#f4f0e4;';
  const hint = document.createElement('div');
  hint.textContent = T.copyManual;
  const area = document.createElement('textarea');
  area.value = text;
  area.style.cssText = 'flex:1;width:100%;font:12px monospace;user-select:text;-webkit-user-select:text;';
  const close = document.createElement('button');
  close.textContent = T.close;
  close.style.cssText = 'font:18px Arial,sans-serif;padding:10px;';
  close.onclick = () => wrap.remove();
  wrap.append(hint, area, close);
  document.body.appendChild(wrap);
  area.focus();
  area.select();
}
