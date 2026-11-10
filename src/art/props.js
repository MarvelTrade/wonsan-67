// Постройки и техника, нарисованные примитивами: убежище-бункер, грузовик, мешки с песком, пушка-гнездо,
// врата. Вид сверху, свет слева сверху, тени вправо вниз.
import { PROPS as P, COLORS } from '../config.js';

// Кольцо мешков с песком
export function drawSandbags(g, x, y, r, n, alpha = 1) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const bx = x + Math.cos(a) * r;
    const by = y + Math.sin(a) * r;
    g.fillStyle(0x000000, 0.25 * alpha).fillEllipse(bx + 2, by + 3, 13, 9);
    g.fillStyle(i % 2 ? P.sandbag : P.sandbagDark, alpha).fillEllipse(bx, by, 13, 9);
  }
}

// Убежище: бетонный бункер, мешки по краю, тёмный вход, номер
export function drawShelter(g, sh) {
  const x = sh.x - sh.w / 2;
  const y = sh.y - sh.h / 2;
  g.fillStyle(0x000000, 0.35).fillRect(x + 6, y + 8, sh.w, sh.h);
  g.fillStyle(P.concrete).fillRect(x, y, sh.w, sh.h);
  g.fillStyle(P.concreteLight).fillRect(x, y, sh.w, 8);
  g.fillStyle(P.concreteDark).fillRect(x, y + sh.h - 8, sh.w, 8);
  g.lineStyle(2, 0x000000, 0.4).strokeRect(x, y, sh.w, sh.h);
  // плиты
  g.lineStyle(1, 0x000000, 0.18);
  for (let i = 1; i < 3; i++) g.lineBetween(x + (sh.w * i) / 3, y, x + (sh.w * i) / 3, y + sh.h);
  // вход — со стороны дороги (справа)
  g.fillStyle(0x15130f).fillRect(x + sh.w - 16, sh.y - 12, 16, 24);
  // мешки вдоль верхней и нижней кромки
  for (let i = 0; i < 6; i++) {
    for (const yy of [y - 6, y + sh.h + 6]) {
      g.fillStyle(i % 2 ? P.sandbag : P.sandbagDark).fillEllipse(x + 10 + i * (sh.w - 20) / 5, yy, 16, 10);
    }
  }
}

// Грузовик (вид сверху, кабина слева): кабина, тент, колёса
export function drawTruck(g, x, y) {
  g.fillStyle(0x000000, 0.3).fillRoundedRect(x - 24, y - 11, 52, 26, 4);
  for (const [wx, wy] of [[-14, -13], [-14, 11], [10, -13], [10, 11], [18, -13], [18, 11]]) {
    g.fillStyle(0x1c1c1a).fillRect(x + wx - 4, y + wy - 2, 8, 4);
  }
  g.fillStyle(P.truckCab).fillRoundedRect(x - 26, y - 11, 14, 22, 3);
  g.fillStyle(P.glass).fillRect(x - 25, y - 8, 4, 16);
  g.fillStyle(P.truckTent).fillRoundedRect(x - 10, y - 12, 36, 24, 3);
  g.lineStyle(1, 0x000000, 0.3);
  for (let i = 1; i < 4; i++) g.lineBetween(x - 10 + i * 9, y - 12, x - 10 + i * 9, y + 12);
  g.lineStyle(1, 0x000000, 0.5).strokeRoundedRect(x - 10, y - 12, 36, 24, 3);
}

// Пулемётное гнездо: мешки кольцом, станок, ствол по направлению выстрела
export function drawGun(g, t, size, barrel) {
  drawSandbags(g, t.x, t.y, size * 0.62, 9);
  g.fillStyle(P.gunBase).fillCircle(t.x, t.y, size * 0.32);
  g.lineStyle(5, P.gunMetal).lineBetween(t.x, t.y, t.x + Math.cos(t.aim) * barrel, t.y + Math.sin(t.aim) * barrel);
  g.fillStyle(P.gunMetal).fillCircle(t.x, t.y, size * 0.18);
  g.fillStyle(COLORS.tower).fillCircle(t.x - 2, t.y - 2, size * 0.08);
}

// Врата: тёмная воронка, вращающиеся дуги, разряды
export function drawGate(g, gate, t) {
  const r = gate.r;
  const pulse = 0.5 + 0.5 * Math.sin(t * 2.5);
  g.fillStyle(COLORS.gate, 0.18 + 0.12 * pulse).fillCircle(gate.x, gate.y, r * 1.55);
  g.fillStyle(P.gateDeep).fillCircle(gate.x, gate.y, r);
  for (let i = 0; i < 4; i++) {
    const a0 = t * (1.4 + i * 0.35) + i * 1.7;
    const rr = r * (0.35 + i * 0.18);
    g.lineStyle(4 - i * 0.6, i % 2 ? COLORS.gateCore : COLORS.gate, 0.9);
    g.beginPath().arc(gate.x, gate.y, rr, a0, a0 + Math.PI * 1.1, false).strokePath();
  }
  g.fillStyle(COLORS.gateCore, 0.85).fillCircle(gate.x, gate.y, r * 0.18 * (1 + 0.3 * pulse));
  // разряды по краю
  g.lineStyle(2, 0xf0d8ff, 0.8);
  for (let i = 0; i < 3; i++) {
    const a = t * 3 + i * 2.1;
    const x1 = gate.x + Math.cos(a) * r;
    const y1 = gate.y + Math.sin(a) * r;
    const x2 = gate.x + Math.cos(a + 0.25) * r * 1.35;
    const y2 = gate.y + Math.sin(a + 0.25) * r * 1.35;
    g.lineBetween(x1, y1, (x1 + x2) / 2 + Math.sin(t * 20 + i) * 6, (y1 + y2) / 2 + Math.cos(t * 17 + i) * 6);
    g.lineBetween((x1 + x2) / 2 + Math.sin(t * 20 + i) * 6, (y1 + y2) / 2 + Math.cos(t * 17 + i) * 6, x2, y2);
  }
}
