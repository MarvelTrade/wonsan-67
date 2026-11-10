// Частицы «сочности»: вспышки выстрелов, искры, взрывы с огнём, дымом и обломками, вспышки при смерти,
// закрутка у врат. Простой массив, рисуется в один Graphics. Только картинка — на правила не влияет.
import { FX as F } from '../config.js';

export class Particles {
  constructor(g) {
    this.g = g;
    this.list = [];
  }

  add(p) {
    if (this.list.length >= F.max) this.list.shift();
    this.list.push({ vx: 0, vy: 0, grav: 0, drag: 0, size: 3, alpha: 1, kind: 'dot', ...p, t: p.life });
  }

  // вспышка у ствола: короткая звезда и пара искр
  muzzle(x, y, a, color = F.flash) {
    this.add({ kind: 'star', x, y, life: 0.07, size: 7, color, rot: a });
    for (let i = 0; i < 2; i++) {
      const s = a + (Math.random() - 0.5) * 0.8;
      this.add({ x, y, vx: Math.cos(s) * 160, vy: Math.sin(s) * 160, life: 0.12, size: 1.6, color, drag: 6 });
    }
  }

  // попадание: искры в стороны
  sparks(x, y, color = F.spark, n = 5) {
    for (let i = 0; i < n; i++) {
      const s = Math.random() * Math.PI * 2;
      const v = 80 + Math.random() * 120;
      this.add({ kind: 'line', x, y, vx: Math.cos(s) * v, vy: Math.sin(s) * v - 30, life: 0.25, size: 1.5, color, drag: 5, grav: 260 });
    }
  }

  // гильза: латунная палочка вылетает вбок от гнезда, падает и гаснет
  casing(x, y) {
    const side = Math.random() < 0.5 ? -1 : 1;
    this.add({ kind: 'line', x, y, vx: side * (50 + Math.random() * 40), vy: -90 - Math.random() * 40, life: 0.45, size: 2, color: F.casing, grav: 520, drag: 1 });
  }

  // гоблин: распад на зелёные брызги (дугой) и лужица на земле, которая тает
  goblinSplash(x, y) {
    for (let i = 0; i < 12; i++) {
      const s = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
      const v = 70 + Math.random() * 120;
      this.add({ x, y: y - 8, vx: Math.cos(s) * v, vy: Math.sin(s) * v, life: 0.5, size: 2 + Math.random() * 1.6, color: i % 3 ? F.goblinGoo : F.goblinGooDark, grav: 420, drag: 1 });
    }
    this.add({ kind: 'splat', x, y: y + 2, life: 1.4, size: 9, grow: 8, color: F.goblinGooDark, alpha: 0.7 });
  }

  // смерть врага: белая «звезда» манги, клочья цвета врага, облачко
  death(x, y, color) {
    this.add({ kind: 'burst', x, y: y - 8, life: 0.22, size: 16, color: 0xffffff });
    for (let i = 0; i < 7; i++) {
      const s = Math.random() * Math.PI * 2;
      const v = 50 + Math.random() * 90;
      this.add({ x, y: y - 6, vx: Math.cos(s) * v, vy: Math.sin(s) * v - 60, life: 0.45, size: 2.4, color, grav: 300, drag: 1.5 });
    }
    this.add({ kind: 'smoke', x, y: y - 6, vy: -18, life: 0.6, size: 9, color: F.smokeLight, alpha: 0.45, grow: 14 });
  }

  // взрыв: огненный шар, ударная волна, дым поднимается, обломки летят по дуге
  explosion(x, y, r) {
    this.add({ kind: 'ring', x, y, life: 0.35, size: r * 0.3, grow: r * 2.6, color: F.shock, alpha: 0.8 });
    for (let i = 0; i < 9; i++) {
      const s = Math.random() * Math.PI * 2;
      const d = Math.random() * r * 0.4;
      this.add({ kind: 'fire', x: x + Math.cos(s) * d, y: y + Math.sin(s) * d * 0.6 - 6, vy: -30 - Math.random() * 30, life: 0.35 + Math.random() * 0.25, size: 10 + Math.random() * 10, color: i % 3 ? F.fire : F.fireHot, grow: 10, drag: 2 });
    }
    for (let i = 0; i < 8; i++) {
      const s = Math.random() * Math.PI * 2;
      const d = Math.random() * r * 0.5;
      this.add({ kind: 'smoke', x: x + Math.cos(s) * d, y: y + Math.sin(s) * d * 0.6 - 4, vx: Math.cos(s) * 10, vy: -20 - Math.random() * 25, life: 1.2 + Math.random() * 0.8, size: 12 + Math.random() * 8, color: i % 2 ? F.smoke : F.smokeLight, alpha: 0.5, grow: 22, drag: 0.6 });
    }
    for (let i = 0; i < 12; i++) {
      const s = Math.random() * Math.PI * 2;
      const v = 90 + Math.random() * 160;
      this.add({ x, y: y - 4, vx: Math.cos(s) * v, vy: Math.sin(s) * v * 0.6 - 140, life: 0.7 + Math.random() * 0.4, size: 2 + Math.random() * 2, color: F.debris, grav: 420, drag: 0.8 });
    }
  }

  // столб дыма (сломанная пушка)
  smokeColumn(x, y) {
    for (let i = 0; i < 6; i++) {
      this.add({ kind: 'smoke', x: x + (Math.random() - 0.5) * 12, y: y - 6, vx: (Math.random() - 0.5) * 8, vy: -25 - Math.random() * 20, life: 1.4 + Math.random() * 0.6, size: 8 + Math.random() * 6, color: F.smoke, alpha: 0.55, grow: 20 });
    }
  }

  // уровень повышен: голубое кольцо и искры вверх
  levelUp(x, y) {
    this.add({ kind: 'ring', x, y, life: 0.6, size: 10, grow: 90, color: F.level, alpha: 0.9 });
    for (let i = 0; i < 14; i++) {
      const s = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      const v = 80 + Math.random() * 120;
      this.add({ x, y, vx: Math.cos(s) * v, vy: Math.sin(s) * v, life: 0.7, size: 2.4, color: F.level, drag: 2 });
    }
  }

  // ядро подобрано: фиолетовые искры вверх, к вертолёту
  core(x, y) {
    for (let i = 0; i < 10; i++) {
      const s = -Math.PI / 2 + (Math.random() - 0.5) * 1.2;
      const v = 60 + Math.random() * 110;
      this.add({ x, y: y - 8, vx: Math.cos(s) * v, vy: Math.sin(s) * v, life: 0.5, size: 2.2, color: F.core, drag: 2.5 });
    }
    this.add({ kind: 'ring', x, y: y - 8, life: 0.35, size: 6, grow: 50, color: F.core, alpha: 0.8 });
  }

  // враг вышел из врат: фиолетовые искры закручиваются
  portal(x, y, r) {
    for (let i = 0; i < 6; i++) {
      const s = Math.random() * Math.PI * 2;
      this.add({ x: x + Math.cos(s) * r, y: y + Math.sin(s) * r, vx: -Math.sin(s) * 90 - Math.cos(s) * 40, vy: Math.cos(s) * 90 - Math.sin(s) * 40, life: 0.45, size: 2.2, color: F.portal, drag: 2 });
    }
  }

  update(dt) {
    const g = this.g;
    g.clear();
    for (const p of this.list) {
      p.t -= dt;
      p.vx *= 1 - Math.min(1, p.drag * dt);
      p.vy *= 1 - Math.min(1, p.drag * dt);
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.list = this.list.filter((p) => p.t > 0);
    for (const p of this.list) {
      const k = p.t / p.life; // 1 → 0
      const size = p.size + (p.grow || 0) * (1 - k);
      const a = p.alpha * Math.min(1, k * 1.6);
      if (p.kind === 'dot') g.fillStyle(p.color, a).fillCircle(p.x, p.y, size * (0.5 + 0.5 * k));
      else if (p.kind === 'line') g.lineStyle(p.size, p.color, a).lineBetween(p.x, p.y, p.x - p.vx * 0.03, p.y - p.vy * 0.03);
      else if (p.kind === 'smoke') g.fillStyle(p.color, a * 0.8).fillCircle(p.x, p.y, size);
      else if (p.kind === 'fire') {
        g.fillStyle(p.color, a).fillCircle(p.x, p.y, size * (0.4 + 0.6 * k));
        g.fillStyle(0xffffff, a * 0.6 * k).fillCircle(p.x, p.y, size * 0.35 * k);
      } else if (p.kind === 'ring') g.lineStyle(3 * k + 1, p.color, a).strokeEllipse(p.x, p.y, size * 2, size * 1.2);
      else if (p.kind === 'splat') g.fillStyle(p.color, p.alpha * k).fillEllipse(p.x, p.y, size * 2, size * 0.9);
      else if (p.kind === 'star' || p.kind === 'burst') {
        // «звезда» манги: лучи из центра, у burst — кругом
        const n = p.kind === 'star' ? 4 : 8;
        g.lineStyle(p.kind === 'star' ? 2 : 2.5, p.color, a);
        for (let i = 0; i < n; i++) {
          const s = (p.rot || 0) + (i * Math.PI * 2) / n;
          const r0 = p.kind === 'burst' ? size * 0.35 * (1 - k) : 0;
          g.lineBetween(p.x + Math.cos(s) * r0, p.y + Math.sin(s) * r0, p.x + Math.cos(s) * size * (1.2 - 0.4 * k), p.y + Math.sin(s) * size * (1.2 - 0.4 * k));
        }
      }
    }
  }
}
