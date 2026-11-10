// Вся логика забега без Phaser: её гоняет и сцена в браузере, и бот в Node (scripts/sim.mjs).
import { LEVELS, HELI, SURVIVORS, BUILD, ENEMIES, SHELTER, SIM, VIEW, STARS, CALL_EARLY, ABILITIES } from '../config.js';
import { Path, rng } from './path.js';

// Границы мира — по размеру экрана (мир = экран)
const MAP_W = VIEW.width;
const MAP_H = VIEW.height;

export class World {
  constructor({ seed = Date.now() % 1e9, plan = 'human', level = 1 } = {}) {
    this.level = LEVELS[Math.max(0, Math.min(LEVELS.length, level) - 1)];
    this.map = this.level.map;
    this.waves = this.level.waves;
    // Люди: общие числа, уровень может переопределить часть
    this.surv = { ...SURVIVORS, ...(this.level.survivors || {}) };
    this.seed = seed;
    this.rand = rng(seed);
    this.path = new Path(this.map.road);
    this.t = 0;
    this.over = null; // 'win' | 'lose'
    this.events = []; // для отрисовки: выстрелы, удары, поломки; сцена забирает и чистит

    this.shelter = { hp: SHELTER.hp, maxHp: SHELTER.hp };
    this.people = this.surv.startPeople;

    this.heli = {
      x: this.map.heliStart.x, y: this.map.heliStart.y, vx: 0, vy: 0, rot: 0, rotor: 0,
      target: null,   // { x, y } — точка, к которой летит (палец/мышь)
      dir: null,      // { x, y } — направление с клавиатуры
      carrying: 0, cd: 0,
    };

    this.slots = this.map.slots.map((s) => {
      const near = this.path.nearest(s.x, s.y);
      return { ...s, roadD: near.d, roadX: near.x, roadY: near.y, building: null };
    });
    this.towers = [];
    this.wires = [];
    this.mines = [];
    // Умения: перезарядка (с), залпы в пути, бойцы подкрепления на дороге
    this.abilities = Object.fromEntries((this.level.abilities || []).map((id) => [id, { cd: 0 }]));
    this.strikes = [];
    this.soldiers = [];
    this.enemies = [];
    this.shots = [];
    this.survivors = [];
    this.nextId = 1;
    this.survivorT = this.surv.firstAt;

    // Волны: build → wave → break → wave … → win
    this.wave = { index: -1, phase: 'build', timer: this.waves.firstAt, spawns: [], elapsed: 0 };

    this.stats = {
      plan, seed, level: this.level.id,
      saved: 0, lostSurvivors: 0,
      spentTowers: 0, spentWire: 0, spentTrench: 0, spentMines: 0,
      towersBuilt: 0, wiresBuilt: 0, trenchesBuilt: 0, minesBuilt: 0,
      minesTriggeredBy: {}, mineKills: 0,
      towersBroken: 0, brokenBy: {}, wiresBroken: 0, wiresBrokenBy: {},
      kills: { goblin: 0, spearman: 0, berserker: 0 }, killsBy: { heli: 0, tower: 0, mine: 0, artillery: 0, soldier: 0 },
      leaked: 0,
      calledEarly: 0, earlyBonus: 0,
      abilityUsed: { artillery: 0, reinforce: 0 }, soldiersLost: 0,
    };
  }

  // ---------- Постройки ----------
  canBuild(slotId, kind) {
    const slot = this.slots.find((s) => s.id === slotId);
    if (!slot || this.over || !this.level.builds.includes(kind) || this.people < BUILD[kind].cost) return false;
    // Окоп — только вокруг готовой пушки, один раз
    if (kind === 'trench') return slot.building?.kind === 'tower' && !slot.building.ref.trench;
    return !slot.building;
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
    } else if (kind === 'mine') {
      const mine = { id: this.nextId++, slot: slot.id, d: slot.roadD, x: slot.roadX, y: slot.roadY, alive: true };
      this.mines.push(mine);
      slot.building = { kind, ref: mine };
      this.stats.spentMines += cfg.cost;
      this.stats.minesBuilt++;
    } else if (kind === 'trench') {
      slot.building.ref.trench = true;
      this.stats.spentTrench += cfg.cost;
      this.stats.trenchesBuilt++;
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
    this.updateMines();
    this.updateAbilities(dt);
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
      if (w.index >= this.waves.list.length - 1) this.finish('win');
      else {
        w.phase = 'break';
        w.timer = this.waves.breakTime;
        this.events.push({ type: 'waveCleared', index: w.index });
      }
    }
  }

  // Сколько людей дадут за досрочный вызов следующей волны (0 — вызывать нечего)
  get earlyBonus() {
    const w = this.wave;
    if (this.over || (w.phase !== 'build' && w.phase !== 'break')) return 0;
    return Math.min(CALL_EARLY.maxBonus, Math.floor(w.timer / CALL_EARLY.perSeconds));
  }

  get canCallEarly() {
    const w = this.wave;
    return !this.over && (w.phase === 'build' || w.phase === 'break');
  }

  // Вызвать следующую волну сейчас; за сэкономленное время — люди
  callWave() {
    if (!this.canCallEarly) return 0;
    const bonus = this.earlyBonus;
    this.people += bonus;
    this.stats.calledEarly++;
    this.stats.earlyBonus += bonus;
    this.events.push({ type: 'calledEarly', bonus });
    this.startWave(this.wave.index + 1);
    return bonus;
  }

  // Звёзды за победу: по остатку убежища (STARS)
  get stars() {
    if (this.over !== 'win') return 0;
    const hp = this.shelter.hp;
    return hp >= STARS.three ? 3 : hp >= STARS.two ? 2 : 1;
  }

  startWave(index) {
    const def = this.waves.list[index];
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
    this.events.push({ type: 'spawn', enemy: type });
    const p = this.path.at(0);
    this.enemies.push({
      id: this.nextId++, type, d: 0, x: p.x, y: p.y,
      hp: cfg.hp, maxHp: cfg.hp, stabT: 0, hurtT: 0, slowed: false, stabAt: null,
      state: 'road', goal: null, smashT: 0, // берсерк: road → charge → return
      // небольшой разброс поперёк дороги, чтобы пачка не сливалась в точку
      lane: (this.rand() - 0.5) * 18,
    });
  }

  // ---------- Люди ----------
  updateSurvivors(dt) {
    this.survivorT -= dt;
    if (this.survivorT <= 0) {
      this.survivorT += this.surv.every;
      if (this.survivors.length < this.surv.maxAlive) {
        const free = this.map.survivorSpots.filter(([x, y]) => !this.survivors.some((s) => s.x === x && s.y === y));
        if (free.length) {
          const [x, y] = free[Math.floor(this.rand() * free.length)];
          this.survivors.push({ id: this.nextId++, x, y, life: this.surv.life });
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
    if (h.carrying > 0 && Math.hypot(this.map.truck.x - h.x, this.map.truck.y - h.y) <= HELI.dropRadius) {
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
        const by = w.lastBy || 'trample'; // trample — порвали те, кто в ней застрял
        this.stats.wiresBrokenBy[by] = (this.stats.wiresBrokenBy[by] || 0) + 1;
        const slot = this.slots.find((s) => s.id === w.slot);
        slot.building = null;
        this.events.push({ type: 'wireBroken', slot: w.slot, by });
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
      e.hurtT = Math.max(0, e.hurtT - dt);
      // Берсерк вне дороги: бежит к постройке, рубит её или возвращается
      if (e.type === 'berserker' && this.updateBerserker(e, cfg, dt)) continue;
      // Боец подкрепления впереди на дороге — стоим и деремся
      const blocker = this.blockerFor(e);
      e.blocked = !!blocker;
      if (blocker) {
        blocker.hp -= (cfg.melee || 0) * dt;
        continue;
      }
      const wire = this.wireAt(e.d);
      e.slowed = !!wire;
      if (wire) {
        wire.hp -= BUILD.wire.damagePerEnemy * dt;
        if (wire.lastBy !== 'berserker') wire.lastBy = 'trample';
      }
      e.d += cfg.speed * (wire ? BUILD.wire.slow : 1) * dt;
      const p = this.path.at(e.d);
      e.x = p.x;
      e.y = p.y + e.lane;

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

  // Берсерк. Возвращает true, пока он не на дороге (тогда обычное движение по дороге пропускаем).
  updateBerserker(e, cfg, dt) {
    if (e.state === 'road') {
      const goal = this.berserkerGoal(e, cfg);
      if (!goal) return false;
      e.state = 'charge';
      e.goal = goal;
      e.smashT = 0;
    }
    if (e.state === 'charge') {
      const g = e.goal;
      // Цель сломана или её окопали — назад на дорогу
      if (!g.ref.alive || (g.kind === 'tower' && g.ref.trench)) {
        e.state = 'return';
      } else {
        const dist = Math.hypot(g.x - e.x, g.y - e.y);
        if (dist > cfg.smashReach) {
          this.moveTo(e, g.x, g.y, cfg.chargeSpeed * dt);
        } else {
          e.smashT -= dt;
          if (e.smashT <= 0) {
            e.smashT = cfg.smashEvery;
            e.stabAt = { x: g.x, y: g.y, t: 0.25 };
            this.events.push({ type: 'smash', x: g.x, y: g.y });
            g.ref.hp -= cfg.smashDamage;
            if (g.kind === 'tower' && g.ref.hp <= 0) this.breakTower(g.ref, e.type);
            if (g.kind === 'wire') g.ref.lastBy = 'berserker';
          }
        }
      }
    }
    if (e.stabAt) {
      e.stabAt.t -= dt;
      if (e.stabAt.t <= 0) e.stabAt = null;
    }
    if (e.state === 'return') {
      const p = this.path.at(e.d);
      const back = { x: p.x, y: p.y + e.lane };
      if (Math.hypot(back.x - e.x, back.y - e.y) <= cfg.chargeSpeed * dt) {
        e.state = 'road';
        e.goal = null;
        e.x = back.x;
        e.y = back.y;
      } else this.moveTo(e, back.x, back.y, cfg.chargeSpeed * dt);
    }
    e.slowed = false;
    return e.state !== 'road';
  }

  // Ближайшая постройка без окопа в пределах видимости: пушка или проволока
  berserkerGoal(e, cfg) {
    let best = null;
    let bestD = cfg.chargeRange;
    for (const t of this.towers) {
      if (!t.alive || t.trench) continue;
      const d = Math.hypot(t.x - e.x, t.y - e.y);
      if (d <= bestD) {
        bestD = d;
        best = { kind: 'tower', ref: t, x: t.x, y: t.y };
      }
    }
    for (const w of this.wires) {
      if (!w.alive) continue;
      const c = this.path.at((w.d0 + w.d1) / 2);
      const d = Math.hypot(c.x - e.x, c.y - e.y);
      if (d <= bestD) {
        bestD = d;
        best = { kind: 'wire', ref: w, x: c.x, y: c.y };
      }
    }
    return best;
  }

  moveTo(e, x, y, step) {
    const dx = x - e.x;
    const dy = y - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, step / dist);
    e.x += dx * k;
    e.y += dy * k;
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

  // ---------- Умения ----------
  canUse(id) {
    const a = this.abilities[id];
    return !!a && a.cd <= 0 && !this.over;
  }

  // Залп по точке: разрывы через delay, урон только врагам
  useArtillery(x, y) {
    if (!this.canUse('artillery')) return false;
    const cfg = ABILITIES.artillery;
    this.abilities.artillery.cd = cfg.cooldown;
    this.strikes.push({ x, y, t: cfg.delay });
    this.stats.abilityUsed.artillery++;
    this.events.push({ type: 'artilleryCalled', x, y });
    return true;
  }

  // Подкрепление: бойцы встают на дорогу в ближайшей к точке позиции
  useReinforce(x, y) {
    if (!this.canUse('reinforce')) return false;
    const cfg = ABILITIES.reinforce;
    const near = this.path.nearest(x, y);
    this.abilities.reinforce.cd = cfg.cooldown;
    for (let i = 0; i < cfg.count; i++) {
      const d = Math.max(0, Math.min(this.path.length, near.d + (i - (cfg.count - 1) / 2) * cfg.spacing));
      const p = this.path.at(d);
      this.soldiers.push({ id: this.nextId++, d, x: p.x, y: p.y, hp: cfg.hp, maxHp: cfg.hp, life: cfg.life, alive: true, aim: 0 });
    }
    this.stats.abilityUsed.reinforce++;
    this.events.push({ type: 'reinforce', x: near.x, y: near.y });
    return true;
  }

  // Ближайший живой боец впереди врага на дороге (берсерк вне дороги их не замечает)
  blockerFor(e) {
    if (!this.soldiers.length || (e.state && e.state !== 'road')) return null;
    const range = ABILITIES.reinforce.blockRange;
    let best = null;
    for (const s of this.soldiers) {
      if (!s.alive) continue;
      const ahead = s.d - e.d;
      if (ahead >= 0 && ahead <= range && (!best || s.d < best.d)) best = s;
    }
    return best;
  }

  updateAbilities(dt) {
    for (const a of Object.values(this.abilities)) a.cd = Math.max(0, a.cd - dt);
    // залпы
    for (const st of this.strikes) {
      st.t -= dt;
      if (st.t > 0) continue;
      const cfg = ABILITIES.artillery;
      this.events.push({ type: 'shell', x: st.x, y: st.y });
      for (const e of [...this.enemies]) if (Math.hypot(e.x - st.x, e.y - st.y) <= cfg.radius) this.hit(e, cfg.damage, 'artillery');
    }
    this.strikes = this.strikes.filter((st) => st.t > 0);
    // бойцы: бьют того, кого держат (или ближайшего рядом), стареют, гибнут
    const cfg = ABILITIES.reinforce;
    for (const s of this.soldiers) {
      if (!s.alive) continue;
      s.life -= dt;
      let target = null;
      for (const e of this.enemies) {
        if (e.state && e.state !== 'road') continue;
        const gap = s.d - e.d;
        if (gap >= -cfg.blockRange && gap <= cfg.blockRange * 1.5 && (!target || e.d > target.d)) target = e;
      }
      if (target) {
        s.aim = Math.atan2(target.y - s.y, target.x - s.x);
        target.hp -= cfg.dps * dt;
        target.hurtT = 0.05;
        if (target.hp <= 0) this.hit(target, 0, 'soldier');
      }
      if (s.hp <= 0) {
        s.alive = false;
        this.stats.soldiersLost++;
        this.events.push({ type: 'soldierDown', x: s.x, y: s.y });
      } else if (s.life <= 0) {
        s.alive = false;
        this.events.push({ type: 'soldierLeft', x: s.x, y: s.y });
      }
    }
    this.soldiers = this.soldiers.filter((s) => s.alive);
  }

  // ---------- Мины ----------
  // Взрывается под первым, кто на дороге наступил ближе trigger. Бьёт всех в радиусе — и своих тоже.
  updateMines() {
    const cfg = BUILD.mine;
    for (const m of this.mines) {
      if (!m.alive) continue;
      const by = this.enemies.find((e) => (e.state === 'road' || !e.state) && Math.abs(e.d - m.d) <= cfg.trigger);
      if (by) this.explode(m, by.type);
    }
  }

  explode(m, by) {
    const cfg = BUILD.mine;
    m.alive = false;
    const slot = this.slots.find((s) => s.id === m.slot);
    slot.building = null;
    this.stats.minesTriggeredBy[by] = (this.stats.minesTriggeredBy[by] || 0) + 1;
    this.events.push({ type: 'boom', x: m.x, y: m.y, by });
    for (const e of [...this.enemies]) {
      if (Math.hypot(e.x - m.x, e.y - m.y) <= cfg.radius) this.hit(e, cfg.damage, 'mine');
    }
    for (const t of this.towers) {
      if (!t.alive || Math.hypot(t.x - m.x, t.y - m.y) > cfg.radius) continue;
      t.hp -= cfg.buildingDamage;
      if (t.hp <= 0) this.breakTower(t, 'mine');
    }
    for (const w of this.wires) {
      if (!w.alive) continue;
      const c = this.path.at((w.d0 + w.d1) / 2);
      if (Math.hypot(c.x - m.x, c.y - m.y) > cfg.radius) continue;
      w.hp -= cfg.buildingDamage;
      w.lastBy = 'mine';
    }
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
      level: this.level.id,
      wave: Math.min(this.waveNumber, this.waves.list.length),
      saved: s.saved,
      lostSurvivors: s.lostSurvivors,
      spentTowers: s.spentTowers,
      spentWire: s.spentWire,
      spentTrench: s.spentTrench,
      spentMines: s.spentMines,
      peopleLeft: this.people,
      towersBuilt: s.towersBuilt,
      wiresBuilt: s.wiresBuilt,
      trenchesBuilt: s.trenchesBuilt,
      minesBuilt: s.minesBuilt,
      minesTriggeredBy: s.minesTriggeredBy,
      towersBroken: s.towersBroken,
      brokenBy: s.brokenBy,
      wiresBroken: s.wiresBroken,
      wiresBrokenBy: s.wiresBrokenBy,
      kills: s.kills,
      killsBy: s.killsBy,
      leaked: s.leaked,
      shelterHp: this.shelter.hp,
      stars: this.stars,
      calledEarly: s.calledEarly,
      earlyBonus: s.earlyBonus,
      abilityUsed: s.abilityUsed,
      soldiersLost: s.soldiersLost,
      duration: Math.round(this.t),
    };
  }
}
