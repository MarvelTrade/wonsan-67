// Вся логика забега без Phaser: её гоняет и сцена в браузере, и бот в Node (scripts/sim.mjs).
import { MAP, HELI, SURVIVORS, BUILD, ENEMIES, SHELTER, WAVES, SIM, VIEW } from '../config.js';
import { Path, rng } from './path.js';

// Границы мира — по размеру экрана (мир = экран)
const MAP_W = VIEW.width;
const MAP_H = VIEW.height;

export class World {
  constructor({ seed = Date.now() % 1e9, plan = 'human' } = {}) {
    this.seed = seed;
    this.rand = rng(seed);
    this.path = new Path(MAP.road);
    this.t = 0;
    this.over = null; // 'win' | 'lose'
    this.events = []; // для отрисовки: выстрелы, удары, поломки; сцена забирает и чистит

    this.shelter = { hp: SHELTER.hp, maxHp: SHELTER.hp };
    this.people = SURVIVORS.startPeople;

    this.heli = {
      x: HELI.startX, y: HELI.startY, vx: 0, vy: 0, rot: 0, rotor: 0,
      target: null,   // { x, y } — точка, к которой летит (палец/мышь)
      dir: null,      // { x, y } — направление с клавиатуры
      carrying: 0, cd: 0,
    };

    this.slots = MAP.slots.map((s) => {
      const near = this.path.nearest(s.x, s.y);
      return { ...s, roadD: near.d, roadX: near.x, roadY: near.y, building: null };
    });
    this.towers = [];
    this.wires = [];
    this.enemies = [];
    this.shots = [];
    this.survivors = [];
    this.nextId = 1;
    this.survivorT = SURVIVORS.firstAt;

    // Волны: build → wave → break → wave … → win
    this.wave = { index: -1, phase: 'build', timer: WAVES.firstAt, spawns: [], elapsed: 0 };

    this.stats = {
      plan, seed,
      saved: 0, lostSurvivors: 0,
      spentTowers: 0, spentWire: 0,
      towersBuilt: 0, wiresBuilt: 0,
      towersBroken: 0, brokenBy: {}, wiresBroken: 0,
      kills: { goblin: 0, spearman: 0 }, killsBy: { heli: 0, tower: 0 },
      leaked: 0,
    };
  }

  // ---------- Постройки ----------
  canBuild(slotId, kind) {
    const slot = this.slots.find((s) => s.id === slotId);
    return !!slot && !slot.building && !this.over && this.people >= BUILD[kind].cost;
  }

  build(slotId, kind) {
    if (!this.canBuild(slotId, kind)) return false;
    const slot = this.slots.find((s) => s.id === slotId);
    const cfg = BUILD[kind];
    this.people -= cfg.cost;
    if (kind === 'tower') {
      const tower = { id: this.nextId++, slot: slot.id, x: slot.x, y: slot.y, hp: cfg.hp, maxHp: cfg.hp, cd: 0, alive: true, aim: 0 };
      this.towers.push(tower);
      slot.building = { kind, ref: tower };
      this.stats.spentTowers += cfg.cost;
      this.stats.towersBuilt++;
    } else {
      const wire = {
        id: this.nextId++, slot: slot.id,
        d0: slot.roadD - cfg.length / 2, d1: slot.roadD + cfg.length / 2,
        hp: cfg.hp, maxHp: cfg.hp, alive: true,
      };
      this.wires.push(wire);
      slot.building = { kind, ref: wire };
      this.stats.spentWire += cfg.cost;
      this.stats.wiresBuilt++;
    }
    this.events.push({ type: 'build', kind, slot: slot.id });
    return true;
  }

  // ---------- Шаг ----------
  step(dt = SIM.dt) {
    if (this.over) return;
    this.t += dt;
    this.updateWaves(dt);
    this.updateSurvivors(dt);
    this.updateHeli(dt);
    this.updateWires();
    this.updateEnemies(dt);
    this.updateTowers(dt);
    this.updateShots(dt);
    this.updateHeliGun(dt);
    if (this.shelter.hp <= 0) this.finish('lose');
  }

  finish(result) {
    if (this.over) return;
    this.over = result;
    this.events.push({ type: 'over', result });
  }

  // ---------- Волны ----------
  updateWaves(dt) {
    const w = this.wave;
    if (w.phase === 'build' || w.phase === 'break') {
      w.timer -= dt;
      if (w.timer <= 0) this.startWave(w.index + 1);
      return;
    }
    // phase === 'wave'
    w.elapsed += dt;
    for (const s of w.spawns) {
      while (s.left > 0 && w.elapsed >= s.next) {
        this.spawnEnemy(s.type);
        s.left--;
        s.next += s.every;
      }
    }
    const spawning = w.spawns.some((s) => s.left > 0);
    if (!spawning && this.enemies.length === 0) {
      if (w.index >= WAVES.list.length - 1) this.finish('win');
      else {
        w.phase = 'break';
        w.timer = WAVES.breakTime;
        this.events.push({ type: 'waveCleared', index: w.index });
      }
    }
  }

  startWave(index) {
    const def = WAVES.list[index];
    this.wave = {
      index, phase: 'wave', timer: 0, elapsed: 0,
      spawns: def.groups.map((g) => ({ type: g.type, left: g.count, every: g.every, next: g.at })),
    };
    this.events.push({ type: 'waveStart', index });
  }

  // Номер волны для HUD и замеров: идущая или следующая
  get waveNumber() {
    const w = this.wave;
    return w.phase === 'wave' ? w.index + 1 : w.index + 2;
  }

  spawnEnemy(type) {
    const cfg = ENEMIES[type];
    const p = this.path.at(0);
    this.enemies.push({
      id: this.nextId++, type, d: 0, x: p.x, y: p.y,
      hp: cfg.hp, maxHp: cfg.hp, stabT: 0, hurtT: 0, slowed: false, stabAt: null,
      // небольшой разброс поперёк дороги, чтобы пачка не сливалась в точку
      lane: (this.rand() - 0.5) * 18,
    });
  }

  // ---------- Люди ----------
  updateSurvivors(dt) {
    this.survivorT -= dt;
    if (this.survivorT <= 0) {
      this.survivorT += SURVIVORS.every;
      if (this.survivors.length < SURVIVORS.maxAlive) {
        const free = MAP.survivorSpots.filter(([x, y]) => !this.survivors.some((s) => s.x === x && s.y === y));
        if (free.length) {
          const [x, y] = free[Math.floor(this.rand() * free.length)];
          this.survivors.push({ id: this.nextId++, x, y, life: SURVIVORS.life });
        }
      }
    }
    for (const s of this.survivors) s.life -= dt;
    const lost = this.survivors.filter((s) => s.life <= 0);
    if (lost.length) {
      this.stats.lostSurvivors += lost.length;
      for (const s of lost) this.events.push({ type: 'survivorLost', x: s.x, y: s.y });
      this.survivors = this.survivors.filter((s) => s.life > 0);
    }
  }

  // ---------- Вертолёт ----------
  updateHeli(dt) {
    const h = this.heli;
    let dvx = 0;
    let dvy = 0;
    if (h.dir && (h.dir.x || h.dir.y)) {
      const len = Math.hypot(h.dir.x, h.dir.y);
      dvx = (h.dir.x / len) * HELI.maxSpeed;
      dvy = (h.dir.y / len) * HELI.maxSpeed;
    } else if (h.target) {
      const dx = h.target.x - h.x;
      const dy = h.target.y - h.y;
      const dist = Math.hypot(dx, dy);
      if (dist > HELI.stopRadius) {
        const sp = HELI.maxSpeed * Math.min(1, dist / HELI.arriveRadius);
        dvx = (dx / dist) * sp;
        dvy = (dy / dist) * sp;
      }
    }
    const k = Math.min(1, HELI.accel * dt);
    h.vx += (dvx - h.vx) * k;
    h.vy += (dvy - h.vy) * k;
    h.x = Math.max(20, Math.min(MAP_W - 20, h.x + h.vx * dt));
    h.y = Math.max(20, Math.min(MAP_H - 20, h.y + h.vy * dt));
    if (Math.hypot(h.vx, h.vy) > 20) {
      const want = Math.atan2(h.vy, h.vx);
      let diff = want - h.rot;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      h.rot += Math.max(-HELI.turnSpeed * dt, Math.min(HELI.turnSpeed * dt, diff));
    }
    h.rotor += HELI.rotorSpeed * dt;

    // Забрать людей
    if (h.carrying < HELI.capacity) {
      for (const s of this.survivors) {
        if (h.carrying >= HELI.capacity) break;
        if (Math.hypot(s.x - h.x, s.y - h.y) <= HELI.pickupRadius) {
          s.taken = true;
          h.carrying++;
          this.events.push({ type: 'pickup', x: s.x, y: s.y });
        }
      }
      this.survivors = this.survivors.filter((s) => !s.taken);
    }
    // Сдать у грузовика
    if (h.carrying > 0 && Math.hypot(MAP.truck.x - h.x, MAP.truck.y - h.y) <= HELI.dropRadius) {
      this.people += h.carrying;
      this.stats.saved += h.carrying;
      this.events.push({ type: 'drop', n: h.carrying });
      h.carrying = 0;
    }
  }

  updateHeliGun(dt) {
    const h = this.heli;
    h.cd -= dt;
    if (h.cd > 0) return;
    const target = this.nearestEnemy(h.x, h.y, HELI.gun.range);
    if (!target) return;
    h.cd = 1 / HELI.gun.fireRate;
    this.shots.push({ from: 'heli', x: h.x, y: h.y, target, speed: HELI.gun.bulletSpeed, damage: HELI.gun.damage });
  }

  nearestEnemy(x, y, range) {
    let best = null;
    let bestD = range;
    for (const e of this.enemies) {
      const d = Math.hypot(e.x - x, e.y - y);
      if (d <= bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  // ---------- Проволока ----------
  updateWires() {
    for (const w of this.wires) {
      if (!w.alive) continue;
      if (w.hp <= 0) {
        w.alive = false;
        this.stats.wiresBroken++;
        const slot = this.slots.find((s) => s.id === w.slot);
        slot.building = null;
        this.events.push({ type: 'wireBroken', slot: w.slot });
      }
    }
  }

  wireAt(d) {
    for (const w of this.wires) if (w.alive && d >= w.d0 && d <= w.d1) return w;
    return null;
  }

  // ---------- Враги ----------
  updateEnemies(dt) {
    const leaked = [];
    for (const e of this.enemies) {
      const cfg = ENEMIES[e.type];
      const wire = this.wireAt(e.d);
      e.slowed = !!wire;
      if (wire) wire.hp -= BUILD.wire.damagePerEnemy * dt;
      e.d += cfg.speed * (wire ? BUILD.wire.slow : 1) * dt;
      const p = this.path.at(e.d);
      e.x = p.x;
      e.y = p.y + e.lane;
      e.hurtT = Math.max(0, e.hurtT - dt);

      // Копейщик бьёт на ходу любую постройку, до которой достаёт копьё
      if (cfg.reach > 0) {
        e.stabT -= dt;
        if (e.stabT <= 0) {
          const tower = this.towerInReach(e, cfg.reach);
          if (tower) {
            e.stabT = cfg.stabEvery;
            e.stabAt = { x: tower.x, y: tower.y, t: 0.18 };
            tower.hp -= cfg.stabDamage;
            this.events.push({ type: 'stab', x: tower.x, y: tower.y });
            if (tower.hp <= 0) this.breakTower(tower, e.type);
          } else e.stabT = 0;
        }
        if (e.stabAt) {
          e.stabAt.t -= dt;
          if (e.stabAt.t <= 0) e.stabAt = null;
        }
      }

      if (e.d >= this.path.length) leaked.push(e);
    }
    if (leaked.length) {
      for (const e of leaked) {
        this.shelter.hp -= ENEMIES[e.type].shelterDamage;
        this.stats.leaked++;
        this.events.push({ type: 'leak', enemy: e.type });
      }
      this.enemies = this.enemies.filter((e) => !leaked.includes(e));
      this.shelter.hp = Math.max(0, this.shelter.hp);
    }
  }

  towerInReach(e, reach) {
    let best = null;
    let bestD = reach;
    for (const t of this.towers) {
      if (!t.alive) continue;
      const d = Math.hypot(t.x - e.x, t.y - e.y);
      if (d <= bestD) {
        bestD = d;
        best = t;
      }
    }
    return best;
  }

  breakTower(tower, by) {
    tower.alive = false;
    tower.hp = 0;
    this.stats.towersBroken++;
    this.stats.brokenBy[by] = (this.stats.brokenBy[by] || 0) + 1;
    const slot = this.slots.find((s) => s.id === tower.slot);
    slot.building = null;
    this.events.push({ type: 'towerBroken', slot: tower.slot, by });
  }

  // ---------- Пушки ----------
  updateTowers(dt) {
    const cfg = BUILD.tower;
    for (const t of this.towers) {
      if (!t.alive) continue;
      t.cd -= dt;
      if (t.cd > 0) continue;
      // Цель — тот, кто дальше всех прошёл по дороге в пределах дальности
      let target = null;
      for (const e of this.enemies) {
        if (Math.hypot(e.x - t.x, e.y - t.y) > cfg.range) continue;
        if (!target || e.d > target.d) target = e;
      }
      if (!target) continue;
      t.cd = 1 / cfg.fireRate;
      t.aim = Math.atan2(target.y - t.y, target.x - t.x);
      this.shots.push({ from: 'tower', x: t.x, y: t.y, target, speed: cfg.bulletSpeed, damage: cfg.damage });
    }
  }

  // ---------- Снаряды (самонаводящиеся, урон — при попадании) ----------
  updateShots(dt) {
    const keep = [];
    for (const s of this.shots) {
      const e = s.target;
      if (!this.enemies.includes(e)) continue; // цель уже мертва или ушла
      const dx = e.x - s.x;
      const dy = e.y - s.y;
      const dist = Math.hypot(dx, dy);
      const stepLen = s.speed * dt;
      if (dist <= stepLen + ENEMIES[e.type].radius) {
        this.hit(e, s.damage, s.from);
        continue;
      }
      s.x += (dx / dist) * stepLen;
      s.y += (dy / dist) * stepLen;
      keep.push(s);
    }
    this.shots = keep;
  }

  hit(e, damage, from) {
    e.hp -= damage;
    e.hurtT = 0.08;
    if (e.hp > 0) return;
    this.enemies = this.enemies.filter((x) => x !== e);
    this.stats.kills[e.type]++;
    this.stats.killsBy[from]++;
    this.events.push({ type: 'kill', x: e.x, y: e.y, enemy: e.type });
  }

  // ---------- Итог забега для localStorage / Node ----------
  summary() {
    const s = this.stats;
    return {
      at: new Date().toISOString(),
      plan: s.plan,
      seed: s.seed,
      result: this.over || 'quit',
      wave: this.waveNumber > WAVES.list.length ? WAVES.list.length : this.waveNumber,
      saved: s.saved,
      lostSurvivors: s.lostSurvivors,
      spentTowers: s.spentTowers,
      spentWire: s.spentWire,
      peopleLeft: this.people,
      towersBuilt: s.towersBuilt,
      wiresBuilt: s.wiresBuilt,
      towersBroken: s.towersBroken,
      brokenBy: s.brokenBy,
      wiresBroken: s.wiresBroken,
      kills: s.kills,
      killsBy: s.killsBy,
      leaked: s.leaked,
      shelterHp: this.shelter.hp,
      duration: Math.round(this.t),
    };
  }
}
