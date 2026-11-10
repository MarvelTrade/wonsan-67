// Разрыв в небе (врата крупно): рваный светящийся край, внутри воронка к белому ядру, рукава, молнии наружу.
// Обложка и оглавление. tint — цвет ранга врат: им светится край (по умолчанию — фиолетовый врат).
import { COLORS } from '../config.js';

export function drawPortal(g, G, t, tint = COLORS.gate) {
  const rim = [];
  const n = 28;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const j = 1 + 0.09 * Math.sin(i * 5.3 + t * 3) + 0.06 * Math.sin(i * 2.1 - t * 2) + (i % 2 ? 0.05 : -0.04);
    rim.push({ x: G.x + Math.cos(a) * G.r * j, y: G.y + Math.sin(a) * G.r * j * 0.92 });
  }
  // воронка: слои от края к центру светлеют
  const layers = [[1, 0x2a0a4a], [0.86, 0x4a1a8a], [0.68, 0x6a2ac0], [0.5, 0x9a5ae8], [0.32, 0xd9b3ff], [0.16, 0xffffff]];
  g.fillStyle(layers[0][1]).fillPoints(rim, true);
  for (const [k, col] of layers.slice(1)) g.fillStyle(col, 0.85).fillEllipse(G.x, G.y, G.r * 2 * k, G.r * 2 * k * 0.92);
  // закрученные рукава
  for (let i = 0; i < 5; i++) {
    const a0 = t * (1.2 + i * 0.25) + i * 1.25;
    const rr = G.r * (0.25 + i * 0.14);
    g.lineStyle(Math.max(1.5, (5 - i * 0.6) * Math.min(1, G.r / 100)), i % 2 ? 0xffffff : 0xe0c0ff, 0.75);
    g.beginPath().arc(G.x, G.y, rr, a0, a0 + Math.PI * 0.9, false).strokePath();
  }
  // светящийся рваный край — цвет ранга
  g.lineStyle(6, tint, 0.55).strokePoints(rim, true);
  g.lineStyle(3, 0xf0d8ff, 0.95).strokePoints(rim, true);
  // молнии от края наружу — мигают
  const step = 22 * Math.min(1, G.r / 100) + 6;
  for (let i = 0; i < 5; i++) {
    if (Math.sin(t * 9 + i * 2.7) < 0.2) continue;
    const a = i * 1.26 + Math.sin(t * 0.7 + i) * 0.4;
    let x = G.x + Math.cos(a) * G.r;
    let y = G.y + Math.sin(a) * G.r * 0.92;
    g.lineStyle(2.5, 0xf6e8ff, 0.9);
    for (let s = 0; s < 4; s++) {
      const nx = x + Math.cos(a) * step + Math.sin(t * 31 + s * 3 + i) * step * 0.45;
      const ny = y + Math.sin(a) * step + Math.cos(t * 27 + s * 5 + i) * step * 0.45;
      g.lineBetween(x, y, nx, ny);
      x = nx;
      y = ny;
    }
  }
}
