// Сцена забега: рисует World примитивами, принимает ввод, ведёт HUD и экран итогов.
// Правила — в src/sim/World.js, числа — в config.js.
import * as Phaser from 'phaser';
import { VIEW, COLORS, HELI, BUILD, ENEMIES, SIM, DRAW, LEVELS } from '../config.js';
import { World } from '../sim/World.js';
import { Bot } from '../sim/bot.js';
import { T } from '../texts.js';
import { saveRun } from '../telemetry.js';

const params = new URLSearchParams(location.search);
const BOT_PLAN = params.get('bot');
const SPEED = Math.max(0.25, +(params.get('speed') || 1));
const SEED = params.has('seed') ? +params.get('seed') : null;
const START_LEVEL = +(params.get('level') || 1);
let autoRuns = +(params.get('runs') || 0); // бот: сколько забегов подряд

export class GameScene extends Phaser.Scene {
  constructor() {
    super('game');
  }

  create(data) {
    this.levelId = data?.level ?? START_LEVEL;
    this.world = new World({ seed: SEED ?? Math.floor(Math.random() * 1e9), plan: BOT_PLAN || 'human', level: this.levelId });
    this.map = this.world.map;
    this.bot = BOT_PLAN ? new Bot(this.world, BOT_PLAN) : null;
    this.acc = 0;
    this.fx = [];
    this.menu = null; // открытое меню постройки: { slot, buttons: [{ kind, rect }] }
    this.saved = false;

    this.bg = this.add.graphics();
    this.drawBackground();
    this.g = this.add.graphics();
    this.fxG = this.add.graphics();
    this.menuG = this.add.graphics();

    const style = { fontFamily: 'Arial, sans-serif', fontSize: `${DRAW.fontSize}px`, color: COLORS.text };
    const pad = DRAW.hudPad;
    this.hudWave = this.add.text(pad, pad, '', style);
    this.hudPeople = this.add.text(pad, pad + DRAW.fontSize * 1.3, '', style);
    this.hudBoard = this.add.text(pad, pad + DRAW.fontSize * 2.6, '', style);
    this.hudShelter = this.add.text(VIEW.width - pad, pad, '', style).setOrigin(1, 0);
    this.add.text(VIEW.width / 2, pad, this.world.level.title, { ...style, color: COLORS.textDim }).setOrigin(0.5, 0);
    this.hudBot = this.add.text(VIEW.width - pad, VIEW.height - pad, BOT_PLAN ? T.bot(BOT_PLAN, SPEED) : '', {
      ...style, color: COLORS.textDim, fontSize: `${DRAW.fontSize * 0.7}px`,
    }).setOrigin(1, 1);
    this.hint = this.add.text(VIEW.width / 2, VIEW.height - pad, BOT_PLAN ? '' : T.hints[this.levelId] || T.hintStart, {
      ...style, color: COLORS.textDim, fontSize: `${DRAW.fontSize * 0.8}px`, align: 'center',
      wordWrap: { width: VIEW.width * 0.7 },
    }).setOrigin(0.5, 1);
    this.menuTexts = [0, 1, 2].map(() => this.add.text(0, 0, '', { ...style, color: '#101410' }).setOrigin(0.5).setVisible(false));

    this.result = null;

    // Ввод: палец/мышь ведут вертолёт, нажатие по месту — меню постройки
    if (!this.bot) {
      this.input.on('pointerdown', this.onDown, this);
      this.input.on('pointermove', (p) => {
        if (p.isDown && this.dragging) this.world.heli.target = { x: p.worldX, y: p.worldY };
      });
      const up = () => {
        this.dragging = false;
        this.world.heli.target = null; // отпустил — зависает
      };
      this.input.on('pointerup', up);
      this.input.on('pointerupoutside', up);
      this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT');
    }

    if (import.meta.env.DEV) window.__world = this.world;
  }

  // ---------- Ввод ----------
  onDown(p) {
    if (this.world.over) return;
    const x = p.worldX;
    const y = p.worldY;
    if (this.menu) {
      const btn = this.menu.buttons.find((b) => Phaser.Geom.Rectangle.Contains(b.rect, x, y));
      const slotId = this.menu.slot.id;
      this.closeMenu();
      if (btn) {
        this.world.build(slotId, btn.kind);
        return;
      }
    }
    const slot = this.world.slots.find((s) => Math.hypot(s.x - x, s.y - y) <= BUILD.menuRadius && this.menuKinds(s).length);
    if (slot) {
      this.openMenu(slot, this.menuKinds(slot));
      return;
    }
    this.dragging = true;
    this.world.heli.target = { x, y };
    this.hint.setText('');
  }

  // Что можно построить на месте: пустое — пушку или проволоку; готовая пушка без окопа — окоп
  menuKinds(slot) {
    const builds = this.world.level.builds;
    if (!slot.building) return builds.filter((k) => k !== 'trench');
    if (slot.building.kind === 'tower' && !slot.building.ref.trench && builds.includes('trench')) return ['trench'];
    return [];
  }

  openMenu(slot, kinds) {
    const w = DRAW.menuW;
    const h = DRAW.menuH;
    const gap = DRAW.menuGap;
    // Меню над местом; у верхнего края — под ним
    const total = kinds.length * (h + gap);
    const above = slot.y - DRAW.slotRadius - gap - total > 0;
    const y0 = above ? slot.y - DRAW.slotRadius - gap - total : slot.y + DRAW.slotRadius + gap;
    const x0 = Phaser.Math.Clamp(slot.x - w / 2, gap, VIEW.width - w - gap);
    this.menu = {
      slot,
      buttons: kinds.map((kind, i) => ({ kind, rect: new Phaser.Geom.Rectangle(x0, y0 + i * (h + gap), w, h) })),
    };
  }

  closeMenu() {
    this.menu = null;
    for (const t of this.menuTexts) t.setVisible(false);
  }

  // ---------- Цикл ----------
  update(_time, delta) {
    const w = this.world;
    if (!this.bot && this.keys) {
      const k = this.keys;
      const dx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
      const dy = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
      w.heli.dir = dx || dy ? { x: dx, y: dy } : null;
    }
    this.acc += Math.min(delta, 100) / 1000 * SPEED;
    while (this.acc >= SIM.dt && !w.over) {
      if (this.bot) this.bot.step();
      w.step(SIM.dt);
      this.acc -= SIM.dt;
    }
    this.consumeEvents(delta / 1000);
    this.draw(delta / 1000);
    this.drawHud();
    if (w.over && !this.result) this.showResult();
  }

  consumeEvents() {
    for (const e of this.world.events) {
      if (e.type === 'kill') this.fx.push({ kind: 'kill', x: e.x, y: e.y, t: DRAW.fxTime, color: COLORS[e.enemy] });
      else if (e.type === 'stab') this.fx.push({ kind: 'stab', x: e.x, y: e.y, t: DRAW.fxTime });
      else if (e.type === 'towerBroken' || e.type === 'wireBroken') {
        const s = this.world.slots.find((sl) => sl.id === e.slot);
        this.fx.push({ kind: 'broken', x: s.x, y: s.y, t: DRAW.fxTime * 3 });
      } else if (e.type === 'drop') this.fx.push({ kind: 'drop', x: this.map.truck.x, y: this.map.truck.y, t: DRAW.fxTime * 2 });
      else if (e.type === 'smash') this.fx.push({ kind: 'smash', x: e.x, y: e.y, t: DRAW.fxTime });
      else if (e.type === 'leak') this.cameras.main.shake(120, 0.004);
    }
    this.world.events.length = 0;
  }

  // ---------- Фон ----------
  drawBackground() {
    const g = this.bg;
    const MAP = this.map;
    g.fillStyle(COLORS.ground).fillRect(0, 0, VIEW.width, VIEW.height);
    // Море вдоль нижнего края — восточное побережье
    g.fillStyle(COLORS.sea).fillRect(0, VIEW.height - 40, VIEW.width, 40);
    // Дорога: кромка и полотно
    for (const [width, color] of [[MAP.roadWidth + 8, COLORS.roadEdge], [MAP.roadWidth, COLORS.road]]) {
      g.lineStyle(width, color);
      g.beginPath();
      MAP.road.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.strokePath();
      for (const [x, y] of MAP.road) g.fillStyle(color).fillCircle(x, y, width / 2);
    }
    // Убежище и грузовик
    const sh = MAP.shelter;
    g.fillStyle(COLORS.shelter).fillRect(sh.x - sh.w / 2, sh.y - sh.h / 2, sh.w, sh.h);
    g.lineStyle(2, 0x000000, 0.4).strokeRect(sh.x - sh.w / 2, sh.y - sh.h / 2, sh.w, sh.h);
    g.fillStyle(COLORS.truck).fillRect(MAP.truck.x - 22, MAP.truck.y - 12, 44, 24);
    g.fillStyle(0x000000, 0.35).fillRect(MAP.truck.x + 10, MAP.truck.y - 12, 12, 24);
    g.lineStyle(1, COLORS.truck, 0.5).strokeCircle(MAP.truck.x, MAP.truck.y, HELI.dropRadius);
  }

  // ---------- Кадр ----------
  draw(dt) {
    const w = this.world;
    const g = this.g;
    const MAP = this.map;
    g.clear();

    // Врата
    const pulse = 0.5 + 0.5 * Math.sin(w.t * DRAW.gatePulse);
    g.fillStyle(COLORS.gate, 0.25 + 0.2 * pulse).fillCircle(MAP.gate.x, MAP.gate.y, MAP.gate.r * (1.2 + 0.15 * pulse));
    g.fillStyle(COLORS.gate, 0.9).fillCircle(MAP.gate.x, MAP.gate.y, MAP.gate.r);
    g.fillStyle(COLORS.gateCore, 0.8).fillCircle(MAP.gate.x, MAP.gate.y, MAP.gate.r * 0.45);

    // Проволока
    for (const wire of w.wires) {
      if (!wire.alive) continue;
      const a = w.path.at(wire.d0);
      const b = w.path.at(wire.d1);
      const alpha = 0.35 + 0.65 * (wire.hp / wire.maxHp);
      const nx = -(b.y - a.y);
      const ny = b.x - a.x;
      const len = Math.hypot(nx, ny) || 1;
      const ox = (nx / len) * DRAW.wireWidth / 2;
      const oy = (ny / len) * DRAW.wireWidth / 2;
      g.lineStyle(2, COLORS.wire, alpha);
      const steps = 7;
      for (let i = 0; i <= steps; i++) {
        const p = w.path.at(wire.d0 + (wire.d1 - wire.d0) * (i / steps));
        g.lineBetween(p.x - ox, p.y - oy, p.x + ox, p.y + oy);
      }
      g.lineBetween(a.x - ox, a.y - oy, b.x - ox, b.y - oy);
      g.lineBetween(a.x + ox, a.y + oy, b.x + ox, b.y + oy);
      this.hpBar(g, (a.x + b.x) / 2, (a.y + b.y) / 2 - DRAW.wireWidth / 2 - 6, wire.hp / wire.maxHp);
    }

    // Места под постройку
    for (const s of w.slots) {
      if (s.building) continue;
      const canAny = w.people >= Math.min(BUILD.tower.cost, BUILD.wire.cost);
      g.lineStyle(2, canAny ? COLORS.slotAffordable : COLORS.slot, canAny ? 0.9 : 0.35);
      g.strokeCircle(s.x, s.y, DRAW.slotRadius);
      g.lineStyle(1, COLORS.slot, 0.25).lineBetween(s.x, s.y, s.roadX, s.roadY);
    }

    // Пушки
    for (const t of w.towers) {
      const half = DRAW.towerSize / 2;
      if (!t.alive) {
        g.fillStyle(COLORS.towerBroken, 0.7).fillRect(t.x - half, t.y - half, DRAW.towerSize, DRAW.towerSize);
        continue;
      }
      if (t.trench) {
        g.lineStyle(DRAW.trenchWidth, COLORS.trench).strokeCircle(t.x, t.y, DRAW.trenchRadius);
        g.lineStyle(2, COLORS.trenchEdge).strokeCircle(t.x, t.y, DRAW.trenchRadius + DRAW.trenchWidth / 2);
      }
      g.fillStyle(COLORS.tower).fillRect(t.x - half, t.y - half, DRAW.towerSize, DRAW.towerSize);
      g.lineStyle(5, 0x2a2a20).lineBetween(t.x, t.y, t.x + Math.cos(t.aim) * DRAW.barrel, t.y + Math.sin(t.aim) * DRAW.barrel);
      g.lineStyle(1, COLORS.tower, 0.12).strokeCircle(t.x, t.y, BUILD.tower.range);
      // Пушку можно окопать — тонкое кольцо (жёлтое, если хватает людей)
      if (!t.trench && w.level.builds.includes('trench')) {
        const can = w.people >= BUILD.trench.cost;
        g.lineStyle(2, can ? COLORS.slotAffordable : COLORS.slot, can ? 0.8 : 0.25).strokeCircle(t.x, t.y, DRAW.trenchRadius);
      }
      this.hpBar(g, t.x, t.y - half - 8, t.hp / t.maxHp);
    }

    // Люди
    for (const s of w.survivors) {
      const k = s.life / w.surv.life;
      g.lineStyle(2, COLORS.survivorRing, 0.25 + 0.5 * Math.min(1, k)).strokeCircle(s.x, s.y, DRAW.survivorRing);
      g.fillStyle(COLORS.survivor).fillCircle(s.x, s.y, DRAW.survivorRadius);
    }

    // Враги
    for (const e of w.enemies) {
      const cfg = ENEMIES[e.type];
      const color = e.hurtT > 0 ? COLORS.enemyHurt : COLORS[e.type];
      if (e.type === 'berserker') {
        // Топор: на цель удара или вперёд
        const ahead = e.goal ? e.goal : w.path.at(e.d + 10);
        const a = Math.atan2(ahead.y - e.y, ahead.x - e.x);
        const len = cfg.radius * (e.stabAt ? 2.6 : 1.8);
        g.lineStyle(4, COLORS.axe).lineBetween(e.x, e.y, e.x + Math.cos(a) * len, e.y + Math.sin(a) * len);
        g.fillStyle(color).fillCircle(e.x, e.y, cfg.radius);
        g.lineStyle(2, 0x000000, 0.5).strokeCircle(e.x, e.y, cfg.radius);
      } else if (e.type === 'spearman') {
        // Копьё смотрит на цель удара или вперёд по дороге
        const ahead = w.path.at(e.d + 10);
        const tx = e.stabAt ? e.stabAt.x : ahead.x;
        const ty = e.stabAt ? e.stabAt.y : ahead.y;
        const a = Math.atan2(ty - e.y, tx - e.x);
        const len = e.stabAt ? cfg.reach : cfg.radius * 2.4;
        g.lineStyle(3, COLORS.spear).lineBetween(e.x, e.y, e.x + Math.cos(a) * len, e.y + Math.sin(a) * len);
        g.fillStyle(color).fillRect(e.x - cfg.radius, e.y - cfg.radius, cfg.radius * 2, cfg.radius * 2);
      } else {
        g.fillStyle(color).fillCircle(e.x, e.y, cfg.radius);
      }
      if (e.slowed) g.lineStyle(1, COLORS.wire, 0.8).strokeCircle(e.x, e.y, cfg.radius + 3);
      if (e.hp < e.maxHp) this.hpBar(g, e.x, e.y - cfg.radius - 6, e.hp / e.maxHp, DRAW.hpBarW * 0.6);
    }

    // Снаряды
    for (const s of w.shots) {
      g.fillStyle(s.from === 'heli' ? COLORS.bullet : COLORS.towerBullet).fillCircle(s.x, s.y, DRAW.bulletRadius);
    }

    // Вертолёт: тень, корпус, хвост, винт
    const h = w.heli;
    this.drawHeli(g, h.x + DRAW.shadowOffset, h.y + DRAW.shadowOffset, h.rot, 0x000000, 0.3);
    this.drawHeli(g, h.x, h.y, h.rot, COLORS.heli, 1);
    g.lineStyle(2, COLORS.heliRotor, 0.5);
    for (let i = 0; i < 5; i++) {
      const a = h.rotor + (i * Math.PI * 2) / 5;
      g.lineBetween(h.x, h.y, h.x + Math.cos(a) * DRAW.rotorRadius, h.y + Math.sin(a) * DRAW.rotorRadius);
    }
    for (let i = 0; i < h.carrying; i++) g.fillStyle(COLORS.survivor).fillCircle(h.x - 8 + i * 8, h.y + DRAW.heliWidth + 6, 3);

    // Вспышки
    const f = this.fxG;
    f.clear();
    for (const fx of this.fx) {
      fx.t -= dt;
      const k = Math.max(0, fx.t / DRAW.fxTime);
      if (fx.kind === 'kill') f.fillStyle(fx.color, 0.6 * k).fillCircle(fx.x, fx.y, 14 * (1.5 - k));
      else if (fx.kind === 'stab') f.lineStyle(3, 0xff5a3a, k).strokeCircle(fx.x, fx.y, DRAW.towerSize * (1.2 - 0.4 * k));
      else if (fx.kind === 'broken') f.lineStyle(4, 0xff3a2a, Math.min(1, k)).strokeCircle(fx.x, fx.y, DRAW.towerSize * 1.5);
      else if (fx.kind === 'smash') f.lineStyle(4, COLORS.berserker, k).strokeCircle(fx.x, fx.y, DRAW.towerSize * (1.4 - 0.5 * k));
      else if (fx.kind === 'drop') f.lineStyle(3, COLORS.truck, Math.min(1, k)).strokeCircle(fx.x, fx.y, HELI.dropRadius * (1.4 - 0.2 * k));
    }
    this.fx = this.fx.filter((fx) => fx.t > 0);

    // Меню постройки
    const m = this.menuG;
    m.clear();
    if (this.menu) {
      this.menu.buttons.forEach((b, i) => {
        const can = w.canBuild(this.menu.slot.id, b.kind);
        m.fillStyle(can ? COLORS.slotAffordable : 0x777766, 0.95).fillRoundedRect(b.rect.x, b.rect.y, b.rect.width, b.rect.height, 6);
        this.menuTexts[i].setText(T[b.kind](BUILD[b.kind].cost))
          .setPosition(b.rect.centerX, b.rect.centerY).setVisible(true).setDepth(10);
      });
      m.lineStyle(2, COLORS.slotAffordable).strokeCircle(this.menu.slot.x, this.menu.slot.y, DRAW.slotRadius + 4);
    }
  }

  drawHeli(g, x, y, rot, color, alpha) {
    const L = DRAW.heliLength;
    const W = DRAW.heliWidth;
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    const pt = (fx, fy) => ({ x: x + fx * c - fy * s, y: y + fx * s + fy * c });
    // корпус — вытянутый шестиугольник, нос вперёд
    const body = [pt(L * 0.38, 0), pt(L * 0.25, -W / 2), pt(-L * 0.15, -W / 2), pt(-L * 0.2, 0), pt(-L * 0.15, W / 2), pt(L * 0.25, W / 2)];
    g.fillStyle(color, alpha).fillPoints(body, true);
    // хвостовая балка
    const t1 = pt(-L * 0.2, 0);
    const t2 = pt(-L * 0.62, 0);
    g.lineStyle(4, color, alpha).lineBetween(t1.x, t1.y, t2.x, t2.y);
    const r1 = pt(-L * 0.62, -W * 0.5);
    const r2 = pt(-L * 0.62, W * 0.5);
    g.lineStyle(2, color, alpha).lineBetween(r1.x, r1.y, r2.x, r2.y);
  }

  hpBar(g, x, y, k, width = DRAW.hpBarW) {
    g.fillStyle(COLORS.hpBarBack, 0.6).fillRect(x - width / 2, y, width, DRAW.hpBarH);
    g.fillStyle(COLORS.hpBar).fillRect(x - width / 2, y, width * Math.max(0, k), DRAW.hpBarH);
  }

  // ---------- HUD ----------
  drawHud() {
    const w = this.world;
    const wave = w.wave;
    const total = w.waves.list.length;
    const n = Math.min(w.waveNumber, total);
    const status = wave.phase === 'wave' ? T.waveOn : T.waveIn(Math.ceil(wave.timer));
    this.hudWave.setText(w.over ? T.wave(n, total) : `${T.wave(n, total)} · ${status}`);
    this.hudPeople.setText(T.people(w.people));
    this.hudBoard.setText(T.onboard(w.heli.carrying, HELI.capacity));
    this.hudShelter.setText(T.shelter(w.shelter.hp, w.shelter.maxHp));
  }

  // ---------- Итоги ----------
  showResult() {
    const w = this.world;
    const r = w.summary();
    if (!this.saved) {
      saveRun(r);
      this.saved = true;
    }
    this.closeMenu();
    const cx = VIEW.width / 2;
    const cy = VIEW.height / 2;
    const panel = this.add.graphics().setDepth(20);
    panel.fillStyle(COLORS.panel, 0.88).fillRoundedRect(cx - 420, cy - 190, 840, 380, 12);
    const title = this.add.text(cx, cy - 150, w.over === 'win' ? T.win : T.lose, {
      fontFamily: 'Arial, sans-serif', fontSize: '40px', color: w.over === 'win' ? '#9be37a' : '#ff8a6a',
    }).setOrigin(0.5).setDepth(21);
    const body = this.add.text(cx, cy - 20, T.summary(r).join('\n'), {
      fontFamily: 'Arial, sans-serif', fontSize: '20px', color: COLORS.text, align: 'center', lineSpacing: 8,
    }).setOrigin(0.5).setDepth(21);
    const btn = this.add.text(cx, cy + 135, T.again, {
      fontFamily: 'Arial, sans-serif', fontSize: '28px', color: '#101410', backgroundColor: '#ffe066',
      padding: { x: 28, y: 10 },
    }).setOrigin(0.5).setDepth(21).setInteractive({ useHandCursor: true });
    const next = LEVELS.find((l) => l.id === this.levelId + 1);
    const canNext = w.over === 'win' && next && !this.bot;
    btn.setX(canNext ? cx - 110 : cx);
    btn.on('pointerdown', () => this.scene.restart({ level: this.levelId }));
    if (canNext) {
      const nextBtn = this.add.text(cx + 110, cy + 135, T.next, {
        fontFamily: 'Arial, sans-serif', fontSize: '28px', color: '#101410', backgroundColor: '#9be37a',
        padding: { x: 28, y: 10 },
      }).setOrigin(0.5).setDepth(21).setInteractive({ useHandCursor: true });
      nextBtn.on('pointerdown', () => this.scene.restart({ level: next.id }));
    }
    this.result = { panel, title, body, btn };

    if (this.bot && autoRuns > 1) {
      autoRuns--;
      this.time.delayedCall(DRAW.resultRestartDelay * 1000, () => this.scene.restart({ level: this.levelId }));
    }
  }
}
