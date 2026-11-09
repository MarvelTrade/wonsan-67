// Бот для замеров: водит вертолёт (люди → грузовик, иначе — над головным врагом) и строит по плану.
// План: '2t1w' — 2 пушки и 1 проволока; '3t1w2e' — ещё 2 окопа у первых двух пушек;
// '3t1w3e4m' — и 4 раза положить мину (место — первое свободное из order.mine в момент постройки).
// Места — по порядку из bot.order уровня; именованные планы ('trap') — из bot.plans.
import { BOT, HELI } from '../config.js';

export function parsePlan(spec, bot) {
  if (bot.plans[spec]) return bot.plans[spec].map((b) => ({ ...b }));
  const m = /^(\d+)t(\d+)w(?:(\d+)e)?(?:(\d+)m)?$/.exec(spec || '');
  if (!m) return null;
  const want = { tower: +m[1], wire: +m[2], trench: +(m[3] || 0), mine: +(m[4] || 0) };
  const used = { tower: 0, wire: 0, trench: 0, mine: 0 };
  const taken = new Set();
  const towerSlots = [];
  const queue = [];
  const pick = (kind) => bot.order[kind].find((id) => !taken.has(id));
  let guard = 0;
  while (Object.keys(want).some((k) => used[k] < want[k]) && guard++ < 50) {
    for (const kind of bot.sequence) {
      if (used[kind] >= want[kind]) continue;
      if (kind === 'mine') {
        used.mine++;
        queue.push({ kind, slot: null }); // место — первое свободное из order.mine в момент постройки
        continue;
      }
      if (kind === 'trench') {
        // Окоп — у пушки, по порядку постройки; пушки ещё нет в очереди — ждём следующего круга
        const slot = towerSlots[used.trench];
        if (!slot) {
          if (used.tower >= want.tower) used.trench = want.trench;
          continue;
        }
        used.trench++;
        queue.push({ kind, slot });
        continue;
      }
      const slot = pick(kind);
      if (!slot) {
        used[kind] = want[kind];
        continue;
      }
      taken.add(slot);
      used[kind]++;
      if (kind === 'tower') towerSlots.push(slot);
      queue.push({ kind, slot });
    }
  }
  return queue;
}

export class Bot {
  constructor(world, spec) {
    this.world = world;
    this.queue = parsePlan(spec, world.level.bot) || [];
  }

  step() {
    const w = this.world;
    if (w.over) return;
    // Окоп у пушки, которую уже сломали, — пропустить, иначе бот встанет
    const next = this.queue[0];
    if (next?.kind === 'trench') {
      const slot = w.slots.find((s) => s.id === next.slot);
      if (slot.building?.kind !== 'tower' && w.towers.some((t) => t.slot === next.slot)) this.queue.shift();
    }
    // Мина без свободного места (прошлая ещё лежит) очередь не держит — берём следующий пункт
    const freeMineSlot = () => w.level.bot.order.mine?.find((id) => !w.slots.find((s) => s.id === id).building);
    const i = this.queue.findIndex((it) => !(it.kind === 'mine' && !it.slot && !freeMineSlot()));
    const item = this.queue[i];
    if (item) {
      const slot = item.kind === 'mine' && !item.slot ? freeMineSlot() : item.slot;
      if (w.canBuild(slot, item.kind)) {
        w.build(slot, item.kind);
        this.queue.splice(i, 1);
      }
    }
    w.heli.target = this.heliTarget();
  }

  heliTarget() {
    const w = this.world;
    const h = w.heli;
    const truck = { x: w.map.truck.x, y: w.map.truck.y };
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
