// Дорога как ломаная: позиция по пройденному расстоянию и ближайшая точка к месту.
export class Path {
  constructor(points) {
    this.pts = points.map(([x, y]) => ({ x, y }));
    this.cum = [0];
    for (let i = 1; i < this.pts.length; i++) {
      const a = this.pts[i - 1];
      const b = this.pts[i];
      this.cum.push(this.cum[i - 1] + Math.hypot(b.x - a.x, b.y - a.y));
    }
    this.length = this.cum[this.cum.length - 1];
  }

  at(d) {
    const dd = Math.max(0, Math.min(this.length, d));
    let i = 1;
    while (i < this.cum.length - 1 && this.cum[i] < dd) i++;
    const a = this.pts[i - 1];
    const b = this.pts[i];
    const seg = this.cum[i] - this.cum[i - 1];
    const k = seg > 0 ? (dd - this.cum[i - 1]) / seg : 0;
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
  }

  nearest(x, y) {
    let best = { d: 0, x: this.pts[0].x, y: this.pts[0].y, dist: Infinity };
    for (let i = 1; i < this.pts.length; i++) {
      const a = this.pts[i - 1];
      const b = this.pts[i];
      const vx = b.x - a.x;
      const vy = b.y - a.y;
      const len2 = vx * vx + vy * vy;
      const k = len2 > 0 ? Math.max(0, Math.min(1, ((x - a.x) * vx + (y - a.y) * vy) / len2)) : 0;
      const px = a.x + vx * k;
      const py = a.y + vy * k;
      const dist = Math.hypot(x - px, y - py);
      if (dist < best.dist) best = { d: this.cum[i - 1] + Math.sqrt(len2) * k, x: px, y: py, dist };
    }
    return best;
  }
}

// Детерминированный генератор: один seed — один и тот же забег у бота
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
