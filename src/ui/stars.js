// Звёзды: n из 3, полные — жёлтые, пустые — тёмные с контуром
import { COLORS } from '../config.js';

export function drawStar(g, x, y, r, filled) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    pts.push({ x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr });
  }
  g.fillStyle(filled ? COLORS.star : COLORS.starEmpty, 1).fillPoints(pts, true);
  g.lineStyle(2, filled ? 0x101410 : COLORS.starEdge, filled ? 0.7 : 0.9).strokePoints(pts, true);
}

export function drawStars(g, cx, y, r, n, gap = r * 2.3) {
  for (let i = 0; i < 3; i++) drawStar(g, cx + (i - 1) * gap, y, r, i < n);
}
