// Бот для замеров: водит вертолёт (люди → грузовик, иначе — над головным врагом) и строит по плану.
// План: '2t1w' — 2 пушки и 1 проволока, места по порядку из BOT.order; 'trap' и др. — из BOT.plans.
import { BOT, HELI, MAP } from '../config.js';

export function parsePlan(spec) {
  if (BOT.plans[spec]) return BOT.plans[spec].map((b) => ({ ...b }));
  const m = /^(\d+)t(\d+)w$/.exec(spec || '');
  if (!m) return null;
  const want = { tower: +m[1], wire: +m[2] };
  const used = { tower: 0, wire: 0 };
  const taken = new Set();
  const queue = [];
  const pick = (kind) => BOT.order[kind].find((id) => !taken.has(id));
  let guard = 0;
  while ((used.tower < want.tower || used.wire < want.wire) && guard++ < 50) {
    for (const kind of BOT.sequence) {
      if (used[kind] >= want[kind]) continue;
      const slot = pick(kind);
      if (!slot) {
        used[kind] = want[kind];
        continue;
      }
      taken.add(slot);
      used[kind]++;
      queue.push({ kind, slot });
    }
  }
  return queue;
}

export class Bot {
  constructor(world, spec) {
    this.world = world;
    this.queue = parsePlan(spec) || [];
  }

  step() {
    const w = this.world;
    if (w.over) return;
    // Строить по очереди, как только хватает людей
    const next = this.queue[0];
    if (next && w.canBuild(next.slot, next.kind)) {
      w.build(next.slot, next.kind);
      this.queue.shift();
    }
    w.heli.target = this.heliTarget();
  }

  heliTarget() {
    const w = this.world;
    const h = w.heli;
    const truck = { x: MAP.truck.x, y: MAP.truck.y };
    if (h.carrying >= HELI.capacity) return truck;
    // Ближайший человек, до которого успеваем долететь
    let best = null;
    let bestD = Infinity;
    for (const s of w.survivors) {
      const d = Math.hypot(s.x - h.x, s.y - h.y);
      if (d / HELI.maxSpeed > s.life - 0.5) continue;
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    if (best) return { x: best.x, y: best.y };
    if (h.carrying > 0) return truck;
    // Людей нет — висеть над самым продвинувшимся врагом
    let lead = null;
    for (const e of w.enemies) if (!lead || e.d > lead.d) lead = e;
    if (lead) return w.path.at(lead.d + BOT.guardOffset);
    return truck;
  }
}
