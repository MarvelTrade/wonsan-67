// Сцена забега: рисует World примитивами, принимает ввод, ведёт HUD и экран итогов.
// Правила — в src/sim/World.js, числа — в config.js.
import * as Phaser from 'phaser';
import { VIEW, COLORS, HELI, BUILD, ENEMIES, SIM, DRAW, LEVELS, ABILITIES, PROPS } from '../config.js';
import { World } from '../sim/World.js';
import { Bot } from '../sim/bot.js';
import { T } from '../texts.js';
import { saveRun } from '../telemetry.js';
import { markWin, wasSeen, markSeen } from '../progress.js';
import { Dossier } from '../ui/Dossier.js';
import { drawTerrain } from '../art/terrain.js';
import { drawShelter, drawTruck, drawGun, drawGate, drawSandbags } from '../art/props.js';
import { drawGoblin, drawSpearman, drawBerserker, drawSurvivor, drawSoldier, drawHeli } from '../art/units.js';
import { Radio } from '../ui/Radio.js';
import { copyStats, statsText } from '../ui/copyStats.js';
import { drawStars } from '../ui/stars.js';
import { makeButton } from '../ui/button.js';

const params = new URLSearchParams(location.search);
// «+» в адресе браузер превращает в пробел: ?bot=2t1w+a приходит как «2t1w a»
const BOT_PLAN = params.get('bot')?.replace(' ', '+') ?? null;
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
    // Подложка HUD — чтобы цифры читались поверх карты
    const hudBg = this.add.graphics().setDepth(14);
    hudBg.fillStyle(COLORS.panel, DRAW.hudAlpha).fillRoundedRect(pad / 2, pad / 2, DRAW.hudLeftW, DRAW.fontSize * 3.9 + pad, 8);
    hudBg.fillRoundedRect(VIEW.width - pad / 2 - DRAW.hudRightW, pad / 2, DRAW.hudRightW, DRAW.fontSize * 1.3 + pad, 8);
    this.hudWave = this.add.text(pad, pad, '', style).setDepth(15);
    this.hudPeople = this.add.text(pad, pad + DRAW.fontSize * 1.3, '', style).setDepth(15);
    this.hudBoard = this.add.text(pad, pad + DRAW.fontSize * 2.6, '', style).setDepth(15);
    this.hudShelter = this.add.text(VIEW.width - pad, pad, '', style).setOrigin(1, 0).setDepth(15);
    // Пауза: кнопка под «Убежищем»; сама включается, когда вкладка уходит в фон (звонок, свернули)
    this.paused = false;
    this.pauseUi = null;
    if (!BOT_PLAN) {
      const pauseBtn = this.add.text(VIEW.width - pad, pad + DRAW.fontSize * 1.6, T.pauseIcon, {
        ...style, color: '#101410', backgroundColor: '#cfd3c8', padding: { x: 16, y: 6 },
      }).setOrigin(1, 0).setDepth(16).setInteractive({ useHandCursor: true });
      pauseBtn.on('pointerdown', () => this.setPaused(!this.paused));
      // «Вызвать волну раньше» — под вратами, пока идёт подготовка или перерыв
      const gate = this.map.gate;
      this.callBtn = this.add.text(gate.x + gate.r, gate.y + gate.r + DRAW.callEarlyGap, '', {
        ...style, color: '#101410', backgroundColor: '#d9b3ff', padding: { x: 14, y: 6 },
      }).setOrigin(1, 0).setDepth(16).setInteractive({ useHandCursor: true }).setVisible(false);
      this.callBtn.on('pointerdown', () => {
        if (this.paused || this.card) return;
        const bonus = this.world.callWave();
        if (bonus) this.fx.push({ kind: 'drop', x: this.map.truck.x, y: this.map.truck.y, t: DRAW.fxTime * 2 });
        this.radio.say('called_early');
        this.hint.setText('');
      });
      const onHidden = () => document.hidden && this.setPaused(true);
      document.addEventListener('visibilitychange', onHidden);
      this.events.once('shutdown', () => document.removeEventListener('visibilitychange', onHidden));
      this.input.keyboard.on('keydown-ESC', () => this.setPaused(!this.paused));
      this.input.keyboard.on('keydown-P', () => this.setPaused(!this.paused));
    }
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

    this.radio = new Radio(this);
    this.radio.say(`l${this.levelId}_start`);

    // Умения: круглые кнопки слева внизу, клавиши 1/2; нажал кнопку — потом точку на карте
    this.aiming = null;
    this.abilityG = this.add.graphics().setDepth(16);
    this.abilityBtns = (this.world.level.abilities || []).map((id, i) => {
      const r = DRAW.abilityR;
      const step = r * 2 + DRAW.abilityGap;
      const x = this.map.abilityCorner === 'right' ? VIEW.width - DRAW.hudPad - r - i * step : DRAW.hudPad + r + i * step;
      const y = VIEW.height - DRAW.abilityBottom - r;
      const zone = this.add.zone(x, y, r * 2, r * 2).setInteractive({ useHandCursor: true }).setDepth(16);
      if (!BOT_PLAN) zone.on('pointerdown', () => this.toggleAim(id));
      const label = this.add.text(x, y + r + 4, `${i + 1} · ${T.abilityShort[id]}`, {
        ...style, fontSize: `${DRAW.fontSize * 0.6}px`,
      }).setOrigin(0.5, 0).setDepth(16).setShadow(1, 1, '#000', 3);
      return { id, x, y, zone, label };
    });
    if (!BOT_PLAN) {
      this.abilityBtns.forEach((b, i) => this.input.keyboard.on(`keydown-${['ONE', 'TWO', 'THREE'][i]}`, () => this.toggleAim(b.id)));
      this.input.on('pointermove', (p) => (this.aimAt = { x: p.worldX, y: p.worldY }));
    }

    // Досье: новые укрепления и умения этого уровня (которых не было на прошлом) — сразу; враги — при первой встрече
    this.cards = [];
    this.card = null;
    if (!BOT_PLAN) {
      const prev = LEVELS.find((l) => l.id === this.levelId - 1);
      for (const b of this.world.level.builds) if (prev && !prev.builds.includes(b)) this.queueCard('build', b);
      for (const a of this.world.level.abilities || []) if (!(prev?.abilities || []).includes(a)) this.queueCard('ability', a);
      this.openNextCard();
    }

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
  onDown(p, over) {
    // Нажали на кнопку (пауза, итоги) — это не команда вертолёту
    if (this.world.over || this.paused || this.card || over?.length) return;
    const x = p.worldX;
    const y = p.worldY;
    if (this.aiming) {
      this.useAbility(this.aiming, x, y);
      return;
    }
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

  // ---------- Умения ----------
  toggleAim(id) {
    if (this.paused || this.card || this.world.over) return;
    if (this.aiming === id) {
      this.aiming = null;
      return;
    }
    if (!this.world.canUse(id)) return;
    this.closeMenu();
    this.aiming = id;
    this.world.heli.target = null;
    this.dragging = false;
    this.hint.setText(T.aim[id]);
  }

  useAbility(id, x, y) {
    const ok = id === 'artillery' ? this.world.useArtillery(x, y) : this.world.useReinforce(x, y);
    this.aiming = null;
    this.hint.setText('');
    return ok;
  }

  drawAbilities() {
    const g = this.abilityG;
    g.clear();
    const w = this.world;
    for (const b of this.abilityBtns) {
      const r = DRAW.abilityR;
      const a = w.abilities[b.id];
      const ready = a.cd <= 0;
      g.fillStyle(0x000000, 0.4).fillCircle(b.x + 3, b.y + 4, r);
      g.fillStyle(ready ? COLORS.abilityReady : COLORS.abilityCd).fillCircle(b.x, b.y, r);
      // перезарядка — тёмный сектор, тает по часовой
      if (!ready) {
        const k = a.cd / ABILITIES[b.id].cooldown;
        g.fillStyle(0x000000, 0.45).slice(b.x, b.y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k, false).fillPath();
      }
      g.lineStyle(this.aiming === b.id ? 5 : 3, this.aiming === b.id ? 0xffffff : 0x101410, 0.9).strokeCircle(b.x, b.y, r);
      // значок
      if (b.id === 'artillery') {
        g.lineStyle(3, 0x101410).strokeCircle(b.x, b.y, r * 0.45);
        g.lineBetween(b.x - r * 0.7, b.y, b.x + r * 0.7, b.y).lineBetween(b.x, b.y - r * 0.7, b.x, b.y + r * 0.7);
      } else {
        g.fillStyle(0x101410).fillCircle(b.x - r * 0.25, b.y, r * 0.22).fillCircle(b.x + r * 0.25, b.y, r * 0.22);
        g.lineStyle(3, 0x101410).lineBetween(b.x - r * 0.25, b.y, b.x - r * 0.25, b.y - r * 0.6).lineBetween(b.x + r * 0.25, b.y, b.x + r * 0.25, b.y - r * 0.6);
      }
      b.label.setAlpha(ready ? 1 : 0.6);
    }
    // прицел под пальцем/мышью
    if (this.aiming && this.aimAt) {
      const rad = this.aiming === 'artillery' ? ABILITIES.artillery.radius : ABILITIES.reinforce.blockRange * 2;
      g.lineStyle(2, 0xffffff, 0.8).strokeCircle(this.aimAt.x, this.aimAt.y, rad);
    }
  }

  // ---------- Досье ----------
  queueCard(kind, id) {
    const key = `${kind}:${id}`;
    if (wasSeen(key) || this.cards.some((c) => c.key === key) || this.card?.key === key) return;
    this.cards.push({ kind, id, key });
  }

  openNextCard() {
    if (this.card || !this.cards.length || this.world.over) return;
    const entry = this.cards.shift();
    this.closeMenu();
    this.world.heli.target = null;
    this.dragging = false;
    this.card = {
      key: entry.key,
      ui: new Dossier(this, entry, () => {
        markSeen(entry.key);
        this.card = null;
        this.openNextCard();
      }),
    };
  }

  // ---------- Цикл ----------
  setPaused(on) {
    if (this.world.over || on === this.paused) return;
    this.paused = on;
    this.world.heli.target = null;
    this.dragging = false;
    if (!on) {
      this.pauseUi?.forEach((o) => o.destroy());
      this.pauseUi = null;
      return;
    }
    this.closeMenu();
    const cx = VIEW.width / 2;
    const cy = VIEW.height / 2;
    const dim = this.add.rectangle(cx, cy, VIEW.width, VIEW.height, 0x000000, 0.55).setDepth(18).setInteractive();
    const title = this.add.text(cx, cy - 80, T.paused, {
      fontFamily: 'Arial, sans-serif', fontSize: `${DRAW.resultTitle}px`, color: COLORS.text,
    }).setOrigin(0.5).setDepth(19);
    const resume = makeButton(this, cx - 130, cy + 30, T.resume, 'primary', () => this.setPaused(false), { depth: 19 });
    const map = makeButton(this, cx + 130, cy + 30, T.toMap, 'plain', () => this.scene.start('map'), { depth: 19 });
    this.pauseUi = [dim, title, resume, map];
  }

  update(_time, delta) {
    const w = this.world;
    // Пауза или открыто досье — время стоит, но кадр и HUD рисуем (иначе на старте пусто)
    if (this.paused || this.card) {
      this.draw(0);
      this.drawHud();
      return;
    }
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
    this.radio.update(delta / 1000);
    this.draw(delta / 1000);
    this.drawHud();
    if (w.over && !this.result) this.showResult();
  }

  // События мира → реплики радио (каждая не больше раза за забег, см. Radio.say)
  radioFor(e) {
    const r = this.radio;
    const L = this.levelId;
    if (e.type === 'waveStart') r.say(`l${L}_w${e.index + 1}`);
    else if (e.type === 'spawn' && e.enemy !== 'goblin') r.say(`first_${e.enemy}`);
    else if (e.type === 'towerBroken') r.say(`broken_${e.by}`);
    else if (e.type === 'wireBroken' && e.by === 'berserker') {
      // Все живые пушки в окопах — значит, сработал подвох уровня 2
      const alive = this.world.towers.filter((t) => t.alive);
      r.say(alive.length && alive.every((t) => t.trench) ? 'wire_berserker_trenched' : 'wire_berserker');
    }
    else if (e.type === 'boom' && e.by === 'goblin') r.say('mine_goblin');
    else if (e.type === 'survivorLost') r.say('lost');
    else if (e.type === 'drop') r.say('drop_first');
    else if (e.type === 'leak') r.say('leak');
    else if (e.type === 'artilleryCalled') r.say('artillery');
    else if (e.type === 'reinforce') r.say('reinforce');
    else if (e.type === 'soldierDown') r.say('soldier_down');
  }

  consumeEvents() {
    for (const e of this.world.events) {
      this.radioFor(e);
      if (e.type === 'spawn' && !this.bot) this.queueCard('enemy', e.enemy);
      if (e.type === 'kill') this.fx.push({ kind: 'kill', x: e.x, y: e.y, t: DRAW.fxTime, color: COLORS[e.enemy] });
      else if (e.type === 'stab') this.fx.push({ kind: 'stab', x: e.x, y: e.y, t: DRAW.fxTime });
      else if (e.type === 'towerBroken' || e.type === 'wireBroken') {
        const s = this.world.slots.find((sl) => sl.id === e.slot);
        this.fx.push({ kind: 'broken', x: s.x, y: s.y, t: DRAW.fxTime * 3 });
      } else if (e.type === 'drop') this.fx.push({ kind: 'drop', x: this.map.truck.x, y: this.map.truck.y, t: DRAW.fxTime * 2 });
      else if (e.type === 'boom') {
        this.fx.push({ kind: 'boom', x: e.x, y: e.y, t: DRAW.fxTime * 2 });
        this.cameras.main.shake(150, 0.006);
      } else if (e.type === 'shell') {
        this.fx.push({ kind: 'shell', x: e.x, y: e.y, t: DRAW.fxTime * 2 });
        this.cameras.main.shake(180, 0.008);
      } else if (e.type === 'reinforce') this.fx.push({ kind: 'drop', x: e.x, y: e.y, t: DRAW.fxTime * 2 });
      else if (e.type === 'smash') this.fx.push({ kind: 'smash', x: e.x, y: e.y, t: DRAW.fxTime });
      else if (e.type === 'leak') this.cameras.main.shake(120, 0.004);
    }
    this.world.events.length = 0;
    this.openNextCard();
  }

  // ---------- Фон ----------
  drawBackground() {
    const g = this.bg;
    const MAP = this.map;
    // Земля, берег, дорога, дома, рощи — src/art/terrain.js
    drawTerrain(g, this.world);
    // Места под постройку — бетонные площадки
    for (const s of this.world.slots) {
      g.fillStyle(0x000000, 0.25).fillCircle(s.x + 3, s.y + 4, DRAW.slotRadius + 4);
      g.fillStyle(PROPS.concreteDark).fillCircle(s.x, s.y, DRAW.slotRadius + 4);
      g.fillStyle(PROPS.concrete).fillCircle(s.x - 1, s.y - 1, DRAW.slotRadius);
    }
    drawShelter(g, MAP.shelter);
    // Зона приёма людей у грузовика — пунктирный круг
    const dr = HELI.dropRadius;
    g.lineStyle(2, COLORS.truck, 0.55);
    for (let i = 0; i < 24; i += 2) {
      g.beginPath().arc(MAP.truck.x, MAP.truck.y, dr, (i / 24) * Math.PI * 2, ((i + 1) / 24) * Math.PI * 2, false).strokePath();
    }
    drawTruck(g, MAP.truck.x, MAP.truck.y);
  }

  // ---------- Кадр ----------
  draw(dt) {
    const w = this.world;
    const g = this.g;
    const MAP = this.map;
    g.clear();

    // Врата — вращаются и по реальному времени, даже на паузе подготовки
    drawGate(g, MAP.gate, this.time.now / 1000);

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

    // Мины: тёмный кругляш на дороге, огонёк мигает
    for (const m of w.mines) {
      if (!m.alive) continue;
      g.fillStyle(COLORS.mine).fillCircle(m.x, m.y, DRAW.mineRadius);
      g.lineStyle(1, COLORS.mineLight, 0.5).strokeCircle(m.x, m.y, BUILD.mine.radius);
      if (Math.sin(w.t * 6) > 0) g.fillStyle(COLORS.mineLight).fillCircle(m.x, m.y, DRAW.mineRadius * 0.35);
    }

    // Артудар в пути: метка цели сжимается к разрыву
    for (const st of w.strikes) {
      const k = st.t / ABILITIES.artillery.delay;
      g.lineStyle(3, COLORS.shell, 0.9).strokeCircle(st.x, st.y, ABILITIES.artillery.radius * (0.3 + 0.7 * k));
      g.lineStyle(1, COLORS.shell, 0.5).strokeCircle(st.x, st.y, ABILITIES.artillery.radius);
      g.lineBetween(st.x - 12, st.y, st.x + 12, st.y).lineBetween(st.x, st.y - 12, st.x, st.y + 12);
    }

    // Бойцы подкрепления
    for (const s of w.soldiers) {
      const r = DRAW.soldierRadius;
      drawSoldier(g, s.x, s.y, r, s.aim);
      this.hpBar(g, s.x, s.y - r - 7, s.hp / s.maxHp, DRAW.hpBarW * 0.6);
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
        // воронка и раскиданные мешки
        g.fillStyle(0x1a1610, 0.6).fillCircle(t.x, t.y, DRAW.towerSize * 0.55);
        drawSandbags(g, t.x, t.y, DRAW.towerSize * 0.95, 5, 0.6);
        continue;
      }
      if (t.trench) {
        g.lineStyle(DRAW.trenchWidth, COLORS.trench).strokeCircle(t.x, t.y, DRAW.trenchRadius);
        g.lineStyle(2, COLORS.trenchEdge).strokeCircle(t.x, t.y, DRAW.trenchRadius + DRAW.trenchWidth / 2);
      }
      drawGun(g, t, DRAW.towerSize * 1.5, DRAW.barrel);
      g.lineStyle(1, COLORS.tower, 0.12).strokeCircle(t.x, t.y, BUILD.tower.range);
      // Пушку можно окопать — тонкое кольцо (жёлтое, если хватает людей)
      if (!t.trench && w.level.builds.includes('trench')) {
        const can = w.people >= BUILD.trench.cost;
        g.lineStyle(2, can ? COLORS.slotAffordable : COLORS.slot, can ? 0.8 : 0.25).strokeCircle(t.x, t.y, DRAW.trenchRadius);
      }
      this.hpBar(g, t.x, t.y - half - 8, t.hp / t.maxHp);
    }

    // Люди — машут, кольцо тает, пока ждут
    for (const s of w.survivors) {
      const k = s.life / w.surv.life;
      g.lineStyle(2, COLORS.survivorRing, 0.25 + 0.5 * Math.min(1, k)).strokeCircle(s.x, s.y, DRAW.survivorRing);
      drawSurvivor(g, s.x, s.y, s.id, this.time.now / 1000);
    }

    // Враги — смотрят по ходу дороги (берсерк — на цель)
    for (const e of w.enemies) {
      const cfg = ENEMIES[e.type];
      const hurt = e.hurtT > 0;
      const ahead = e.goal && e.state === 'charge' ? e.goal : w.path.at(e.d + 8);
      const a = Math.atan2(ahead.y - e.y, ahead.x - e.x);
      if (e.type === 'berserker') drawBerserker(g, e.x, e.y, cfg.radius, a, hurt, !!e.stabAt);
      else if (e.type === 'spearman') drawSpearman(g, e.x, e.y, cfg.radius, a, hurt, e.stabAt, cfg.reach);
      else drawGoblin(g, e.x, e.y, cfg.radius, a, hurt);
      if (e.slowed || e.blocked) g.lineStyle(1, COLORS.wire, 0.8).strokeCircle(e.x, e.y, cfg.radius + 4);
      if (e.hp < e.maxHp) this.hpBar(g, e.x, e.y - cfg.radius - 8, e.hp / e.maxHp, DRAW.hpBarW * 0.6);
    }

    // Снаряды
    for (const s of w.shots) {
      g.fillStyle(s.from === 'heli' ? COLORS.bullet : COLORS.towerBullet).fillCircle(s.x, s.y, DRAW.bulletRadius);
    }

    // Вертолёт: тень на земле, корпус, винты; люди на борту — точками у двери
    const h = w.heli;
    drawHeli(g, h.x + DRAW.shadowOffset, h.y + DRAW.shadowOffset, h.rot, h.rotor, DRAW.heliLength, DRAW.heliWidth, true);
    drawHeli(g, h.x, h.y, h.rot, h.rotor, DRAW.heliLength, DRAW.heliWidth, false);
    for (let i = 0; i < h.carrying; i++) g.fillStyle(COLORS.survivor).fillCircle(h.x - 8 + i * 8, h.y + DRAW.heliWidth + 10, 3);

    // Вспышки
    const f = this.fxG;
    f.clear();
    for (const fx of this.fx) {
      fx.t -= dt;
      const k = Math.max(0, fx.t / DRAW.fxTime);
      if (fx.kind === 'kill') f.fillStyle(fx.color, 0.6 * k).fillCircle(fx.x, fx.y, 14 * (1.5 - k));
      else if (fx.kind === 'stab') f.lineStyle(3, 0xff5a3a, k).strokeCircle(fx.x, fx.y, DRAW.towerSize * (1.2 - 0.4 * k));
      else if (fx.kind === 'broken') f.lineStyle(4, 0xff3a2a, Math.min(1, k)).strokeCircle(fx.x, fx.y, DRAW.towerSize * 1.5);
      else if (fx.kind === 'boom') {
        f.fillStyle(COLORS.blast, 0.55 * Math.min(1, k)).fillCircle(fx.x, fx.y, BUILD.mine.radius * (1.1 - 0.4 * Math.min(1, k / 2)));
        f.lineStyle(3, COLORS.mineLight, Math.min(1, k)).strokeCircle(fx.x, fx.y, BUILD.mine.radius);
      } else if (fx.kind === 'shell') {
        f.fillStyle(COLORS.shell, 0.5 * Math.min(1, k)).fillCircle(fx.x, fx.y, ABILITIES.artillery.radius * (1.1 - 0.3 * Math.min(1, k / 2)));
        f.lineStyle(4, COLORS.blast, Math.min(1, k)).strokeCircle(fx.x, fx.y, ABILITIES.artillery.radius);
      } else if (fx.kind === 'smash') f.lineStyle(4, COLORS.berserker, k).strokeCircle(fx.x, fx.y, DRAW.towerSize * (1.4 - 0.5 * k));
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
    this.drawAbilities();
    if (this.callBtn) {
      const show = w.canCallEarly;
      this.callBtn.setVisible(show);
      if (show) this.callBtn.setText(T.callEarly(w.wave.index + 2, w.earlyBonus));
    }
  }

  // ---------- Итоги ----------
  showResult() {
    const w = this.world;
    const r = w.summary();
    if (!this.saved) {
      saveRun(r);
      if (w.over === 'win' && !this.bot) markWin(this.levelId, r.stars); // бот прогресс не открывает
      this.saved = true;
    }
    this.closeMenu();
    this.radio.stop();
    const cx = VIEW.width / 2;
    const cy = VIEW.height / 2;
    const W = DRAW.resultW;
    const H = DRAW.resultH;
    const x0 = cx - W / 2;
    const y0 = cy - H / 2;
    const win = w.over === 'win';
    // Отчёт о задании: лист бумаги поверх затемнённой карты
    this.add.rectangle(cx, cy, VIEW.width, VIEW.height, 0x000000, 0.45).setDepth(19).setInteractive();
    const panel = this.add.graphics().setDepth(20);
    panel.fillStyle(0x000000, 0.35).fillRect(x0 + 8, y0 + 10, W, H);
    panel.fillStyle(COLORS.paper).fillRect(x0, y0, W, H);
    panel.lineStyle(2, COLORS.paperEdge).strokeRect(x0, y0, W, H);
    panel.lineStyle(1, COLORS.paperEdge, 0.5).lineBetween(x0 + 24, y0 + 58, x0 + W - 24, y0 + 58);
    const type = (x, y, s, size, color = COLORS.ink, extra = {}) =>
      this.add.text(x, y, s, { fontFamily: '"Courier New", Courier, monospace', fontSize: `${size}px`, color, ...extra }).setDepth(21);
    type(x0 + 28, y0 + 20, `${T.report.header} · ${this.world.level.title}`, DRAW.resultSmall);
    // штамп
    const stampColor = win ? COLORS.stampOk : COLORS.stamp;
    panel.lineStyle(4, stampColor, 0.85).strokeRect(x0 + W - 250, y0 + 74, 210, 54);
    type(x0 + W - 145, y0 + 101, win ? T.report.done : T.report.failed, DRAW.resultBody + 4, win ? '#3f6a2a' : '#a8322a', { fontStyle: 'bold' })
      .setOrigin(0.5).setRotation(-0.08);
    const title = type(x0 + 28, y0 + 74, win ? T.win : T.lose, DRAW.resultTitle - 4, COLORS.ink, { fontStyle: 'bold' });
    drawStars(panel, x0 + 28 + DRAW.resultStar + 4, y0 + 150, DRAW.resultStar, r.stars);
    // последняя реплика по радио — цитатой
    const [who, quote] = T.radio[w.over];
    type(x0 + 28 + DRAW.resultStar * 7, y0 + 140, `«${quote}» — ${T.speakers[who]}`, DRAW.resultSmall, COLORS.inkRed, {
      fontStyle: 'italic', wordWrap: { width: W - DRAW.resultStar * 7 - 70 },
    });
    const body = type(x0 + 28, y0 + 196, T.summary(r).join('\n'), DRAW.resultBody, COLORS.ink, {
      lineSpacing: 6, fontStyle: 'bold', wordWrap: { width: W - 56 },
    });
    // кнопки
    const by = y0 + H - 46;
    const next = LEVELS.find((l) => l.id === this.levelId + 1);
    const canNext = win && next && !this.bot;
    const btn = makeButton(this, this.bot ? cx : cx - (canNext ? 250 : 125), by, T.again, 'primary', () => this.scene.restart({ level: this.levelId }));
    if (!this.bot) makeButton(this, canNext ? cx : cx + 125, by, T.toMap, 'plain', () => this.scene.start('map'));
    if (canNext) makeButton(this, cx + 250, by, T.next, 'ok', () => this.scene.restart({ level: next.id }));
    if (!this.bot) {
      const n = JSON.parse(statsText()).runs.length;
      const copyBtn = makeButton(this, cx, y0 + H + 36, T.copyStats(n), 'dark', async () => {
        copyBtn.label.setText((await copyStats()) ? T.copied : T.copyFailed);
      }, { size: DRAW.fontSize * 0.75, padY: 6 });
    }
    this.result = { panel, title, body, btn };

    if (this.bot && autoRuns > 1) {
      autoRuns--;
      this.time.delayedCall(DRAW.resultRestartDelay * 1000, () => this.scene.restart({ level: this.levelId }));
    }
  }
}
