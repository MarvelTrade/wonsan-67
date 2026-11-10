// Юниты примитивами, вид сверху: гоблин, копейщик, берсерк, человек, боец, вертолёт.
// a — направление взгляда/движения (рад). Тень вправо вниз, тёмная обводка для читаемости на траве.
import { UNITS as U } from '../config.js';

const outline = (g, x, y, r) => g.lineStyle(2, U.outline, 0.85).strokeCircle(x, y, r);
const shadow = (g, x, y, r) => g.fillStyle(0x000000, 0.28).fillEllipse(x + 3, y + 4, r * 2.1, r * 1.7);

// точка на окружности со смещением угла
const at = (x, y, a, d) => ({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d });

export function drawGoblin(g, x, y, r, a, hurt) {
  shadow(g, x, y, r);
  // уши — треугольники в стороны
  for (const s of [-1, 1]) {
    const base1 = at(x, y, a + s * 1.2, r * 0.7);
    const base2 = at(x, y, a + s * 2.0, r * 0.7);
    const tip = at(x, y, a + s * 1.65, r * 1.9);
    g.fillStyle(hurt ? 0xffffff : U.goblinEar).fillTriangle(base1.x, base1.y, base2.x, base2.y, tip.x, tip.y);
  }
  g.fillStyle(hurt ? 0xffffff : U.goblin).fillCircle(x, y, r);
  g.fillStyle(U.goblinRag).slice(x, y, r, a + Math.PI * 0.6, a + Math.PI * 1.4, false).fillPath(); // лохмотья сзади
  outline(g, x, y, r);
  for (const s of [-1, 1]) {
    const e = at(x, y, a + s * 0.45, r * 0.55);
    g.fillStyle(U.eye).fillCircle(e.x, e.y, 1.6);
  }
}

export function drawSpearman(g, x, y, r, a, hurt, stabTo, reach) {
  shadow(g, x, y, r);
  // копьё: вперёд или на цель удара
  const sa = stabTo ? Math.atan2(stabTo.y - y, stabTo.x - x) : a;
  const len = stabTo ? reach : r * 2.6;
  const tip = at(x, y, sa, len);
  g.lineStyle(3, U.spearShaft).lineBetween(x, y, tip.x, tip.y);
  const h1 = at(tip.x, tip.y, sa + 2.7, 7);
  const h2 = at(tip.x, tip.y, sa - 2.7, 7);
  g.fillStyle(U.spearHead).fillTriangle(tip.x, tip.y, h1.x, h1.y, h2.x, h2.y);
  g.fillStyle(hurt ? 0xffffff : U.spearman).fillCircle(x, y, r);
  // шлем-гребень
  g.fillStyle(U.spearHelm).slice(x, y, r, a - 0.9, a + 0.9, true).fillPath();
  outline(g, x, y, r);
  // круглый щит сбоку
  const sh = at(x, y, a + 1.4, r * 0.85);
  g.fillStyle(U.shield).fillCircle(sh.x, sh.y, r * 0.6);
  g.lineStyle(2, U.outline, 0.8).strokeCircle(sh.x, sh.y, r * 0.6);
  g.fillStyle(U.shieldBoss).fillCircle(sh.x, sh.y, r * 0.18);
}

export function drawBerserker(g, x, y, r, a, hurt, swinging) {
  shadow(g, x, y, r * 1.1);
  // топор
  const ha = a + (swinging ? 0.9 : 0.5);
  const hand = at(x, y, ha, r * 0.8);
  const head = at(x, y, ha, r * 2.1);
  g.lineStyle(4, U.axeShaft).lineBetween(hand.x, hand.y, head.x, head.y);
  g.fillStyle(U.axeHead).fillCircle(head.x, head.y, r * 0.42);
  g.fillStyle(hurt ? 0xffffff : U.berserker).fillCircle(x, y, r);
  // рога
  for (const s of [-1, 1]) {
    const b1 = at(x, y, a + s * 0.5, r * 0.8);
    const b2 = at(x, y, a + s * 0.9, r * 0.8);
    const tip = at(x, y, a + s * 0.55, r * 1.55);
    g.fillStyle(U.horn).fillTriangle(b1.x, b1.y, b2.x, b2.y, tip.x, tip.y);
  }
  outline(g, x, y, r);
  g.fillStyle(U.berserkerDark).fillCircle(x - Math.cos(a) * r * 0.3, y - Math.sin(a) * r * 0.3, r * 0.45); // косматая грива
  for (const s of [-1, 1]) {
    const e = at(x, y, a + s * 0.4, r * 0.6);
    g.fillStyle(U.eyeRed).fillCircle(e.x, e.y, 2);
  }
}

// Человек, ждущий эвакуации: тело (одежда по номеру), голова, машет рукой
export function drawSurvivor(g, x, y, id, t) {
  const cloth = U.cloth[id % U.cloth.length];
  g.fillStyle(0x000000, 0.3).fillEllipse(x + 2, y + 4, 14, 8);
  g.fillStyle(cloth).fillEllipse(x, y + 2, 12, 9);
  g.fillStyle(U.skin).fillCircle(x, y - 3, 4);
  g.fillStyle(U.hair).slice(x, y - 3, 4, Math.PI, 0, false).fillPath();
  const wave = Math.sin(t * 8 + id) * 0.5;
  const hand = { x: x + 8 + Math.cos(-1.2 + wave) * 4, y: y - 4 + Math.sin(-1.2 + wave) * 4 };
  g.lineStyle(2, U.skin).lineBetween(x + 4, y, hand.x, hand.y);
}

// Боец подкрепления: каска, плечи, автомат
export function drawSoldier(g, x, y, r, a) {
  shadow(g, x, y, r);
  const gun = at(x, y, a, r * 2.3);
  g.lineStyle(3, U.rifle).lineBetween(x, y, gun.x, gun.y);
  g.fillStyle(U.soldierBody).fillEllipse(x, y, r * 2.2, r * 1.7);
  g.fillStyle(U.helmet).fillCircle(x, y, r * 0.75);
  g.lineStyle(1.5, U.outline, 0.8).strokeCircle(x, y, r * 0.75);
}

// Вертолёт (транспортный, вид сверху): фюзеляж, остеклённый нос, двери, хвостовая балка, рулевой винт
export function drawHeli(g, x, y, rot, rotor, L, W, shadowOnly) {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const pt = (fx, fy) => ({ x: x + fx * c - fy * s, y: y + fx * s + fy * c });
  const poly = (arr, color, alpha = 1) => g.fillStyle(color, alpha).fillPoints(arr.map(([fx, fy]) => pt(fx * L, fy * W)), true);
  const col = shadowOnly ? 0x000000 : U.heli;
  const a = shadowOnly ? 0.3 : 1;
  // хвостовая балка и стабилизатор
  poly([[-0.15, -0.16], [-0.72, -0.08], [-0.72, 0.08], [-0.15, 0.16]], col, a);
  poly([[-0.62, -0.45], [-0.68, -0.45], [-0.7, 0.45], [-0.64, 0.45]], col, a);
  // фюзеляж
  poly([[0.42, -0.25], [0.48, 0], [0.42, 0.25], [0.3, 0.5], [-0.2, 0.5], [-0.25, 0.25], [-0.25, -0.25], [-0.2, -0.5], [0.3, -0.5]], col, a);
  if (shadowOnly) return;
  poly([[0.3, -0.5], [-0.2, -0.5], [-0.2, -0.36], [0.3, -0.36]], U.heliDark); // тень борта
  poly([[0.42, -0.25], [0.48, 0], [0.42, 0.25], [0.32, 0.2], [0.32, -0.2]], U.glass); // остекление
  poly([[0.05, 0.5], [-0.08, 0.5], [-0.08, 0.38], [0.05, 0.38]], U.heliDark); // дверь
  poly([[0.05, -0.5], [-0.08, -0.5], [-0.08, -0.38], [0.05, -0.38]], U.heliDark);
  const star = pt(-0.45 * L, 0);
  g.fillStyle(U.heliMark).fillCircle(star.x, star.y, W * 0.12); // бортовой знак — кружок, без реальных эмблем
  // рулевой винт
  const tr = pt(-0.7 * L, 0.5 * W);
  g.lineStyle(2, U.rotor, 0.7).lineBetween(tr.x - Math.cos(rotor * 2) * 7, tr.y - Math.sin(rotor * 2) * 7, tr.x + Math.cos(rotor * 2) * 7, tr.y + Math.sin(rotor * 2) * 7);
  // несущий винт: диск и пять лопастей
  const hub = pt(0.05 * L, 0);
  const R = L * 0.75;
  g.fillStyle(U.rotor, 0.08).fillCircle(hub.x, hub.y, R);
  g.lineStyle(3, U.rotor, 0.55);
  for (let i = 0; i < 5; i++) {
    const ang = rotor + (i * Math.PI * 2) / 5;
    g.lineBetween(hub.x, hub.y, hub.x + Math.cos(ang) * R, hub.y + Math.sin(ang) * R);
  }
  g.fillStyle(U.heliDark).fillCircle(hub.x, hub.y, 4);
}
