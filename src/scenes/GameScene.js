// Сцена забега: рисует World примитивами, принимает ввод, ведёт HUD и экран итогов.
// Правила — в src/sim/World.js, числа — в config.js.
import * as Phaser from 'phaser';
import { VIEW, COLORS, HELI, BUILD, ENEMIES, SIM, DRAW, LEVELS, ABILITIES, PROPS, HUD, SPRITES, TERRAIN, FX, SYSTEM, CORES, ELITE, BOSS, CRATES, RADIO, JUICE } from '../config.js';
import { World } from '../sim/World.js';
import { Bot } from '../sim/bot.js';
import { T } from '../texts.js';
import { saveRun } from '../telemetry.js';
import { markWin, wasSeen, markSeen, markQuests } from '../progress.js';
import { loadSettings, setSetting } from '../settings.js';
import { Tutorial } from '../ui/Tutorial.js';
import { Dossier } from '../ui/Dossier.js';
import { SystemWindow } from '../ui/SystemWindow.js';
import { drawTerrain } from '../art/terrain.js';
import { drawGate, drawSandbags } from '../art/props.js';
import { Particles } from '../art/particles.js';
import { Radio } from '../ui/Radio.js';
import { copyStats, statsText } from '../ui/copyStats.js';
import { drawStars } from '../ui/stars.js';
import { makeButton } from '../ui/button.js';
import { Hud } from '../ui/Hud.js';

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

    this.spriteMeta = this.cache.json.get('spritesMeta') || {};
    this.pool = [];
    this.bg = this.add.graphics().setDepth(0);
    this.drawBackground();
    this.g = this.add.graphics().setDepth(1);          // на земле: кольца, проволока, мины, окопы
    this.topG = this.add.graphics().setDepth(3);       // над фигурами: стволы, полоски HP, пули
    this.fxG = this.add.graphics().setDepth(5);
    this.menuG = this.add.graphics().setDepth(10);
    this.parts = new Particles(this.add.graphics().setDepth(5.5)); // искры, взрывы, дым — над фигурами
    this.ambG = this.add.graphics().setDepth(1.95); // тени облаков и волны — над землёй, под фигурами
    // вертолёт летит над всем: тень — на земле, корпус и винт — выше фигур
    this.heliShadow = this.add.image(0, 0, 'spr_heli').setOrigin(this.spriteMeta.heli?.ox ?? 0.6, 0.5)
      .setScale(SPRITES.keyScale.heli).setTint(0x000000).setTintMode(Phaser.TintModes.FILL).setAlpha(SPRITES.heliShadow).setDepth(1.5);
    this.heliImg = this.add.image(0, 0, 'spr_heli').setOrigin(this.spriteMeta.heli?.ox ?? 0.6, 0.5).setScale(SPRITES.keyScale.heli).setDepth(6);
    this.rotorG = this.add.graphics().setDepth(6.1);

    const style = { fontFamily: 'Arial, sans-serif', fontSize: `${DRAW.fontSize}px`, color: COLORS.text };
    const pad = DRAW.hudPad;
    // HUD — плашки со значками (src/ui/Hud.js)
    this.hud = new Hud(this);
    // Пауза: кнопка справа вверху; сама включается, когда вкладка уходит в фон (звонок, свернули)
    this.paused = false;
    this.pauseUi = null;
    if (!BOT_PLAN) {
      const pauseBtn = makeButton(this, 0, 0, T.pauseIcon, 'plain', () => this.setPaused(!this.paused), {
        size: DRAW.fontSize, depth: 16, padX: 16, padY: 7, minW: 56,
      });
      pauseBtn.setPosition(VIEW.width - HUD.margin - pauseBtn.width / 2, HUD.margin + pauseBtn.height / 2);
      // «Вызвать волну раньше» — в верхней полосе левее паузы (зоны плана: верх — волна, центр — только игра)
      this.callBtn = this.add.text(pauseBtn.x - pauseBtn.width / 2 - DRAW.callEarlyGap, HUD.margin, '', {
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
    // заголовок серии — над деревьями, на плашке
    const lvl = this.world.level;
    const lt = this.add.text(VIEW.width / 2, pad + 4, lvl.rank ? `${lvl.title} · ${T.gateRank(lvl.rank)}` : lvl.title, { ...style, fontSize: `${DRAW.fontSize * 0.8}px`, color: COLORS.text })
      .setOrigin(0.5, 0).setDepth(15);
    this.add.graphics().setDepth(14).fillStyle(COLORS.panel, 0.6)
      .fillRoundedRect(lt.x - lt.width / 2 - 12, lt.y - 4, lt.width + 24, lt.height + 8, 8);
    this.hudBot = this.add.text(VIEW.width - pad, VIEW.height - pad, BOT_PLAN ? T.bot(BOT_PLAN, SPEED) : '', {
      ...style, color: COLORS.textDim, fontSize: `${DRAW.fontSize * 0.7}px`,
    }).setOrigin(1, 1);
    this.hint = this.add.text(VIEW.width / 2, VIEW.height - pad, BOT_PLAN ? '' : T.hints[this.levelId] || T.hintStart, {
      ...style, color: COLORS.textDim, fontSize: `${DRAW.fontSize * 0.8}px`, align: 'center',
      wordWrap: { width: VIEW.width * 0.7 },
    }).setOrigin(0.5, 1);
    this.menuTexts = [0, 1, 2].map(() => this.add.text(0, 0, '', { ...style, color: '#101410' }).setOrigin(0.5).setVisible(false).setDepth(10.5));

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
        ...style, fontSize: `${DRAW.fontSize * 0.62}px`, fontStyle: 'bold', backgroundColor: 'rgba(16,20,16,0.72)', padding: { x: 6, y: 2 },
      }).setOrigin(0.5, 0).setDepth(16);
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
        if (p.isDown && this.dragging && !this.cine) this.world.heli.target = { x: p.worldX, y: p.worldY };
      });
      const up = () => {
        this.dragging = false;
        this.world.heli.target = null; // отпустил — зависает
      };
      this.input.on('pointerup', up);
      this.input.on('pointerupoutside', up);
      this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT');
    }

    // цифры урона: пул текстов, переиспользуются
    this.dmgPool = Array.from({ length: DRAW.dmgPool }, () => this.add.text(0, 0, '', {
      fontFamily: 'Arial, sans-serif', fontSize: `${DRAW.dmgSize}px`, fontStyle: 'bold', color: '#f4f0e4', stroke: '#14101c', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(5.6).setVisible(false));
    this.dmgLive = [];
    // подсказки первого запуска — только человеку
    this.tutorial = this.bot ? null : new Tutorial(this);
    // Камеры: main — мир (трясётся, наезжает на босса), ui — интерфейс поверх, всегда неподвижен.
    // Кто чей — по глубине (JUICE.uiDepth), раздаётся каждый кадр в routeCameras().
    this.uiCam = this.cameras.add(0, 0, VIEW.width, VIEW.height);
    this.cameras.main.setBounds(0, 0, VIEW.width, VIEW.height); // наезд у края карты не показывает пустоту за ней
    this.bossG = this.add.graphics().setDepth(14.6);
    this.hitStop = 0;
    this.manifest = new Map(); // id пушки → время «проявления» (мс)
    this.cine = null;
    this.flashRect = this.add.rectangle(VIEW.width / 2, VIEW.height / 2, VIEW.width * 2, VIEW.height * 2, COLORS.gate, 0).setDepth(4.9);

    if (import.meta.env.DEV) window.__world = this.world;
  }

  // Цифра урона: всплывает и гаснет за DRAW.dmgLife (если включено в паузе)
  showDamage(e) {
    if (!loadSettings().dmgNumbers || !this.dmgPool.length) return;
    const t = this.dmgPool.pop();
    const col = e.tier === 'boss' ? '#e8c0ff' : e.tier === 'elite' ? '#ffb0a0' : '#f4f0e4';
    t.setText(String(Math.round(e.n))).setColor(col).setVisible(true).setAlpha(1);
    this.dmgLive.push({ t, x: e.x + (Math.random() - 0.5) * 14, y: e.y - 22, age: 0 });
  }

  updateDamage(dt) {
    for (const d of this.dmgLive) {
      d.age += dt;
      const k = d.age / DRAW.dmgLife;
      d.t.setPosition(d.x, d.y - DRAW.dmgRise * k).setAlpha(Math.max(0, 1 - k * k));
    }
    const done = this.dmgLive.filter((d) => d.age >= DRAW.dmgLife);
    for (const d of done) {
      d.t.setVisible(false);
      this.dmgPool.push(d.t);
    }
    if (done.length) this.dmgLive = this.dmgLive.filter((d) => d.age < DRAW.dmgLife);
  }

  // ---------- Ввод ----------
  onDown(p, over) {
    // Нажали на кнопку (пауза, итоги) — это не команда вертолёту
    if (this.world.over || this.paused || this.card || this.cine || over?.length) return;
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
    const tapped = this.world.towers.find((t) => t.alive && Math.hypot(t.x - x, t.y - y) <= BUILD.menuRadius);
    if (tapped) this.rangeShow = { id: tapped.id, until: this.time.now + DRAW.rangeShow * 1000 };
    const slot = this.world.slots.find((s) => Math.hypot(s.x - x, s.y - y) <= BUILD.menuRadius && this.menuKinds(s).length);
    if (slot) {
      this.openMenu(slot, this.menuKinds(slot));
      return;
    }
    this.dragging = true;
    this.tutorial?.done('drag');
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
    this.tutorial?.done('tap');
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

  // «СИСТЕМА · Задание выполнено», ящики снабжения — теми же титрами внизу, что и радио
  notice(text) {
    this.radio.sayText('system', text);
  }

  // ---------- Камера и «сочность» ----------
  // Интерфейс (глубина ≥ JUICE.uiDepth) рисует только ui-камера, мир — только main
  routeCameras() {
    const main = this.cameras.main.id;
    const ui = this.uiCam.id;
    for (const o of this.children.list) o.cameraFilter = o.depth >= JUICE.uiDepth ? main : ui;
  }

  // Врата открылись: фиолетовая вспышка над миром и кольцо от врат
  gateFlash() {
    const g = this.map.gate;
    this.flashRect.setAlpha(JUICE.gateFlash);
    this.tweens.add({ targets: this.flashRect, alpha: 0, duration: JUICE.gateFlashTime, ease: 'Quad.easeOut' });
    this.parts.add({ kind: 'ring', x: g.x, y: g.y, life: 0.6, size: g.r, grow: 220, color: FX.portal, alpha: 0.9 });
    for (let i = 0; i < 3; i++) this.parts.portal(g.x, g.y, g.r * (1.2 + i * 0.3));
  }

  // Босс вышел: камера наезжает на врата, мир замедлен, потом обратно. Ввод на это время закрыт.
  bossIntro() {
    if (this.cine) return;
    const cam = this.cameras.main;
    const g = this.map.gate;
    this.closeMenu();
    this.dragging = false;
    this.world.heli.target = null;
    this.cine = true;
    cam.pan(g.x, g.y, JUICE.bossIn, 'Sine.easeInOut');
    cam.zoomTo(JUICE.bossZoom, JUICE.bossIn, 'Sine.easeInOut');
    this.time.delayedCall(JUICE.bossIn + JUICE.bossHold, () => {
      cam.pan(VIEW.width / 2, VIEW.height / 2, JUICE.bossOut, 'Sine.easeInOut', true);
      cam.zoomTo(1, JUICE.bossOut, 'Sine.easeInOut', true, (c, k) => {
        if (k >= 1) this.cine = null;
      });
    });
  }

  // ---------- Досье ----------
  queueCard(kind, id) {
    const key = `${kind}:${id}`;
    if (wasSeen(key) || this.cards.some((c) => c.key === key) || this.card?.key === key) return;
    this.cards.push({ kind, id, key });
  }

  // «Система»: повысился уровень — окно выбора усиления (бот выбирает сам, см. Bot)
  openSystem() {
    if (this.card || this.bot || !this.world.offer || this.world.over) return;
    this.closeMenu();
    this.world.heli.target = null;
    this.dragging = false;
    this.card = {
      key: 'system',
      ui: new SystemWindow(this, this.world, (id) => {
        this.world.choosePerk(id);
        this.card = null;
        this.radio.say(`perk_${SYSTEM.perks[id].who}`);
        this.openNextCard();
        this.openSystem();
      }),
    };
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
    const plate = this.add.graphics().setDepth(18.5);
    plate.fillStyle(0x000000, 0.35).fillRoundedRect(cx - 296, cy - 136, 600, 300, 12);
    plate.fillStyle(COLORS.paper).fillRoundedRect(cx - 300, cy - 140, 600, 300, 12);
    plate.lineStyle(2, COLORS.paperEdge).strokeRoundedRect(cx - 300, cy - 140, 600, 300, 12);
    const title = this.add.text(cx, cy - 80, T.paused, {
      fontFamily: '"Courier New", Courier, monospace', fontSize: `${DRAW.resultTitle}px`, fontStyle: 'bold', color: COLORS.ink,
    }).setOrigin(0.5).setDepth(19);
    const resume = makeButton(this, cx - 130, cy + 30, T.resume, 'primary', () => this.setPaused(false), { depth: 19 });
    const map = makeButton(this, cx + 130, cy + 30, T.toMap, 'plain', () => this.scene.start('map'), { depth: 19 });
    const dmg = makeButton(this, cx, cy + 102, T.dmgToggle(loadSettings().dmgNumbers), 'dark', () => {
      setSetting('dmgNumbers', !loadSettings().dmgNumbers);
      dmg.label.setText(T.dmgToggle(loadSettings().dmgNumbers));
    }, { depth: 19, size: DRAW.fontSize * 0.9, padY: 10 });
    this.pauseUi = [dim, plate, title, resume, map, dmg];
  }

  update(_time, delta) {
    const w = this.world;
    // Пауза или открыто досье — время стоит, но кадр и HUD рисуем (иначе на старте пусто)
    this.radio.box.setVisible(!(this.paused || this.card));
    if (this.paused || this.card) {
      this.routeCameras();
      this.draw(0);
      this.drawHud();
      return;
    }
    if (!this.bot && this.keys) {
      const k = this.keys;
      const dx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
      const dy = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
      w.heli.dir = dx || dy ? { x: dx, y: dy } : null;
      if (dx || dy) this.tutorial?.done('drag');
    }
    this.routeCameras();
    // стоп-кадр: мир стоит несколько десятков мс, картинка рисуется; в наезде на босса — замедление
    if (this.hitStop > 0) this.hitStop -= delta;
    else this.acc += Math.min(delta, 100) / 1000 * SPEED * (this.cine ? JUICE.bossSlow : 1);
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
    else if (e.type === 'spawn' && e.boss) r.say('boss');
    else if (e.type === 'kill' && e.boss) r.say('boss_down');
    else if (e.type === 'leak' && e.boss) r.say('boss_leak');
    else if (e.type === 'spawn' && e.elite) r.say('elite');
    else if (e.type === 'kill' && e.elite) r.say('elite_down');
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
    else if (e.type === 'crateDrop') r.say('crate_drop');
    else if (e.type === 'crate') r.say('crate_taken');
    else if (e.type === 'coreDrop') r.say('core_drop');
    else if (e.type === 'core') r.say('core_taken');
  }

  consumeEvents() {
    for (const e of this.world.events) {
      this.radioFor(e);
      if (e.type === 'spawn' && !this.bot) this.queueCard(e.boss ? 'boss' : e.elite ? 'elite' : 'enemy', e.enemy);
      if (e.type === 'kill') this.parts.death(e.x, e.y, COLORS[e.enemy]);
      if (e.type === 'kill' && e.enemy === 'goblin') this.parts.goblinSplash(e.x, e.y);
      if (e.type === 'kill' && e.boss) this.parts.explosion(e.x, e.y, 70);
      if (e.type === 'kill' && (e.elite || e.boss)) this.hitStop = Math.max(this.hitStop, e.boss ? JUICE.hitStopBoss : JUICE.hitStopElite);
      if (e.type === 'waveStart') this.gateFlash();
      if (e.type === 'build' && e.kind === 'tower') {
        const s = this.world.slots.find((sl) => sl.id === e.slot);
        const t = s?.building?.ref;
        if (t) this.manifest.set(t.id, this.time.now);
        if (s) this.parts.manifest(s.x, s.y);
      }
      if (e.type === 'spawn' && e.boss && !this.bot) this.bossIntro();
      else if (e.type === 'hit') this.parts.sparks(e.x, e.y - 8, FX.spark, 3);
      else if (e.type === 'spawn') this.parts.portal(this.map.gate.x, this.map.gate.y, this.map.gate.r);
      else if (e.type === 'levelUp') this.parts.levelUp(this.world.heli.x, this.world.heli.y);
      else if (e.type === 'core') this.parts.core(e.x, e.y);
      else if (e.type === 'dmg') this.showDamage(e);
      else if (e.type === 'crate') {
        this.notice(T.crates.notice(T.crates[e.item]));
        this.parts.sparks(e.x, e.y - 10, CRATES.glow, 10);
      }
      else if (e.type === 'questDone') {
        const q = this.world.quests.find((x) => x.id === e.id);
        this.notice(T.quests.done(T.quests.name(q), T.quests.reward(q.reward)));
        this.parts.levelUp(this.world.heli.x, this.world.heli.y);
      }
      else if (e.type === 'stab') {
        this.fx.push({ kind: 'stab', x: e.x, y: e.y, t: DRAW.fxTime });
        this.parts.sparks(e.x, e.y - 6, FX.spark, 4);
      }
      else if (e.type === 'towerBroken' || e.type === 'wireBroken') {
        const s = this.world.slots.find((sl) => sl.id === e.slot);
        this.fx.push({ kind: 'broken', x: s.x, y: s.y, t: DRAW.fxTime * 3 });
        this.parts.smokeColumn(s.x, s.y);
        this.parts.sparks(s.x, s.y - 6, FX.fire, 8);
      } else if (e.type === 'drop') this.fx.push({ kind: 'drop', x: this.map.truck.x, y: this.map.truck.y, t: DRAW.fxTime * 2 });
      else if (e.type === 'boom') {
        this.fx.push({ kind: 'boom', x: e.x, y: e.y, t: DRAW.fxTime * 2 });
        this.parts.explosion(e.x, e.y, BUILD.mine.radius * 0.8);
        this.cameras.main.shake(150, 0.006);
      } else if (e.type === 'shell') {
        this.fx.push({ kind: 'shell', x: e.x, y: e.y, t: DRAW.fxTime * 2 });
        this.parts.explosion(e.x, e.y, ABILITIES.artillery.radius);
        this.cameras.main.shake(180, 0.008);
      } else if (e.type === 'reinforce') this.fx.push({ kind: 'drop', x: e.x, y: e.y, t: DRAW.fxTime * 2 });
      else if (e.type === 'smash') {
        this.fx.push({ kind: 'smash', x: e.x, y: e.y, t: DRAW.fxTime });
        this.parts.sparks(e.x, e.y - 6, 0xffffff, 6);
      }
      else if (e.type === 'leak') this.cameras.main.shake(120, 0.004);
    }
    this.world.events.length = 0;
    this.openNextCard();
    this.openSystem();
  }

  // ---------- Фон ----------
  drawBackground() {
    const g = this.bg;
    const MAP = this.map;
    // Земля, берег, дорога, дома, рощи — src/art/terrain.js
    const placed = drawTerrain(g, this.world);
    for (const p of placed.houses) this.prop(p.kind, p.x, p.y, p.flip);
    for (const p of placed.trees) this.prop(p.kind, p.x, p.y, false);
    // Места под постройку — бетонные плиты в 3/4: тень, торец (толщина), верх, светлая кромка
    for (const s of this.world.slots) {
      const r = DRAW.slotRadius + 4;
      const k = DRAW.padSquash;
      const h = DRAW.padH;
      g.fillStyle(0x000000, 0.25).fillEllipse(s.x + 3, s.y + h + 3, r * 2.1, r * 2 * k + 4);
      g.fillStyle(PROPS.concreteDark).fillEllipse(s.x, s.y + h, r * 2, r * 2 * k);
      g.fillRect(s.x - r, s.y, r * 2, h);
      g.fillStyle(PROPS.concrete).fillEllipse(s.x, s.y, r * 2, r * 2 * k);
      g.lineStyle(1, PROPS.concreteLight, 0.8).strokeEllipse(s.x, s.y - 1, r * 1.8, r * 1.8 * k);
    }
    this.prop('bunker', MAP.shelter.x, MAP.shelter.y + MAP.shelter.h * 0.3, false);
    // Зона приёма людей у грузовика — пунктирный круг
    const dr = HELI.dropRadius;
    g.lineStyle(2, COLORS.truck, 0.55);
    for (let i = 0; i < 24; i += 2) {
      g.beginPath().arc(MAP.truck.x, MAP.truck.y, dr, (i / 24) * Math.PI * 2, ((i + 1) / 24) * Math.PI * 2, false).strokePath();
    }
    this.drawBase(g, MAP.truck);
    this.prop('truck', MAP.truck.x, MAP.truck.y + 8, false);
    this.drawLight();
  }

  // ---------- Кадр ----------
  draw(dt) {
    const w = this.world;
    const g = this.g;
    const MAP = this.map;
    g.clear();
    this.topG.clear(); // в начале кадра: на нём рисуют и проволока, и фигуры

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
      // спирали «Бруно» поперёк дороги на кольях, в 3/4: колья вверх, кольца приподняты над землёй;
      // рисуем поверх фигур (topG) — застрявшие враги видны «в проволоке»
      const t2 = this.topG;
      const steps = 4;
      const lift = DRAW.wireLift;
      for (let i = 0; i <= steps; i++) {
        const p = w.path.at(wire.d0 + (wire.d1 - wire.d0) * (i / steps));
        g.fillStyle(0x000000, 0.18).fillEllipse(p.x + 2, p.y + 3, DRAW.wireWidth + 6, 8);
        for (const sgn of [-1, 1]) {
          t2.lineStyle(2, 0x5a4430, alpha).lineBetween(p.x + sgn * ox, p.y + sgn * oy, p.x + sgn * ox, p.y + sgn * oy - lift * 1.8);
        }
        t2.lineStyle(1.5, COLORS.wire, alpha);
        for (let k = -2; k <= 2; k++) {
          const cx = p.x + (ox * k) / 2.4;
          const cy = p.y + (oy * k) / 2.4 - lift;
          t2.strokeEllipse(cx, cy, 9, 11);
        }
      }
      this.hpBar(t2, (a.x + b.x) / 2, (a.y + b.y) / 2 - DRAW.wireWidth / 2 - lift * 2 - 6, wire.hp / wire.maxHp);
    }

    // Мины: тёмный кругляш на дороге, огонёк мигает
    for (const m of w.mines) {
      if (!m.alive) continue;
      // колпак в 3/4: тень, корпус, светлый верх, взрыватели-усики, мигающий огонёк
      const mr = DRAW.mineRadius;
      g.lineStyle(1, COLORS.mineLight, 0.45).strokeCircle(m.x, m.y, BUILD.mine.radius);
      g.fillStyle(0x000000, 0.3).fillEllipse(m.x + 2, m.y + 3, mr * 2.6, mr * 1.2);
      g.fillStyle(COLORS.mine).fillEllipse(m.x, m.y, mr * 2.4, mr * 1.5);
      g.fillStyle(0x4a4a40).fillEllipse(m.x - 1, m.y - mr * 0.35, mr * 1.6, mr * 0.9);
      g.lineStyle(1.5, 0x8a8a80);
      for (const dx of [-0.5, 0, 0.5]) g.lineBetween(m.x + dx * mr, m.y - mr * 0.4, m.x + dx * mr * 1.3, m.y - mr * 1.2);
      if (Math.sin(w.t * 6) > 0) g.fillStyle(COLORS.mineLight).fillCircle(m.x, m.y - mr * 0.5, mr * 0.3);
    }

    // Ящики снабжения: ящик с жёлтыми ремнями, под ним пульсирует жёлтое кольцо; перед концом мигает
    for (const c of w.crates) {
      if (c.life < CRATES.blinkAt && Math.sin(w.t * 14) < 0) continue;
      const s = CRATES.size;
      g.lineStyle(2, CRATES.glow, 0.5 + 0.3 * Math.sin(w.t * 5 + c.id)).strokeEllipse(c.x, c.y + 2, s * 4, s * 2);
      g.fillStyle(0x000000, 0.3).fillEllipse(c.x + 2, c.y + 3, s * 2.4, s);
      g.fillStyle(CRATES.color).fillRect(c.x - s, c.y - s * 1.6, s * 2, s * 1.6);
      g.fillStyle(0x5a4228).fillRect(c.x - s, c.y - s * 1.6, s * 2, s * 0.35);
      g.fillStyle(CRATES.strap).fillRect(c.x - s * 0.2, c.y - s * 1.6, s * 0.4, s * 1.6).fillRect(c.x - s, c.y - s * 0.95, s * 2, s * 0.3);
      g.lineStyle(1.5, 0x2a1e10).strokeRect(c.x - s, c.y - s * 1.6, s * 2, s * 1.6);
    }

    // Ядра: фиолетовый кристалл качается над землёй, под ним тень и свечение; перед тем как погаснуть — мигает
    for (const c of w.cores) {
      if (c.life < CORES.blinkAt && Math.sin(w.t * 14) < 0) continue;
      const lift = CORES.size + Math.sin(w.t * 3 + c.id) * CORES.bob;
      const s = CORES.size;
      const t = this.topG;
      g.fillStyle(0x000000, 0.25).fillEllipse(c.x, c.y + 2, s * 2, s * 0.8);
      g.fillStyle(CORES.color, 0.18 + 0.08 * Math.sin(w.t * 5 + c.id)).fillCircle(c.x, c.y - lift, CORES.glow);
      const y = c.y - lift;
      t.fillStyle(CORES.dark).fillTriangle(c.x, y - s * 1.4, c.x + s, y, c.x, y + s * 1.2);
      t.fillStyle(CORES.color).fillTriangle(c.x, y - s * 1.4, c.x - s, y, c.x, y + s * 1.2);
      t.fillStyle(CORES.light).fillTriangle(c.x, y - s * 1.4, c.x - s * 0.45, y - s * 0.2, c.x, y - s * 0.1);
    }

    // Артудар в пути: метка цели сжимается к разрыву
    for (const st of w.strikes) {
      const k = st.t / ABILITIES.artillery.delay;
      g.lineStyle(3, COLORS.shell, 0.9).strokeCircle(st.x, st.y, ABILITIES.artillery.radius * (0.3 + 0.7 * k));
      g.lineStyle(1, COLORS.shell, 0.5).strokeCircle(st.x, st.y, ABILITIES.artillery.radius);
      g.lineBetween(st.x - 12, st.y, st.x + 12, st.y).lineBetween(st.x, st.y - 12, st.x, st.y + 12);
    }

    // ---------- спрайты в ракурсе 3/4: пул картинок, глубина по y (кто ниже — тот ближе) ----------
    this.poolI = 0;
    const top = this.topG;
    const now = this.time.now / 1000;
    const bob = (id) => Math.abs(Math.sin(now * SPRITES.bobSpeed + id)) * SPRITES.bob;

    // Бойцы подкрепления
    for (const s of w.soldiers) {
      this.spr('soldier', s.x, s.y - bob(s.id), Math.cos(s.aim) < 0);
      this.hpBar(top, s.x, s.y - DRAW.hpOffset.soldier, s.hp / s.maxHp, DRAW.hpBarW * 0.6);
    }

    // Места под постройку
    // по цене: хватает людей на самое дешёвое, что здесь можно поставить, — заливка и пульсирующее кольцо
    const pulse = 0.5 + 0.5 * Math.sin((this.time.now / 1000) * DRAW.slotPulse);
    const pr = DRAW.slotRadius;
    const pk = DRAW.padSquash;
    for (const s of w.slots) {
      if (s.building) continue;
      const kinds = this.menuKinds(s);
      const can = kinds.length > 0 && w.people >= Math.min(...kinds.map((k) => BUILD[k].cost));
      if (can) {
        g.fillStyle(COLORS.slotAffordable, 0.16 + 0.12 * pulse).fillEllipse(s.x, s.y, pr * 2, pr * 2 * pk);
        g.lineStyle(3, COLORS.slotAffordable, 0.95).strokeEllipse(s.x, s.y, pr * 2, pr * 2 * pk);
        const grow = 1.08 + 0.3 * pulse;
        g.lineStyle(2, COLORS.slotAffordable, 0.55 * (1 - pulse)).strokeEllipse(s.x, s.y, pr * 2 * grow, pr * 2 * pk * grow);
      } else g.lineStyle(2, COLORS.slot, 0.4).strokeEllipse(s.x, s.y, pr * 2, pr * 2 * pk);
      g.lineStyle(1, COLORS.slot, 0.25).lineBetween(s.x, s.y, s.roadX, s.roadY);
    }

    // Пушки: окоп и кольца — на земле, гнездо — спрайтом, ствол — поверх (поворачивается на цель)
    for (const t of w.towers) {
      if (!t.alive) {
        g.fillStyle(0x1a1610, 0.6).fillCircle(t.x, t.y, DRAW.towerSize * 0.55);
        drawSandbags(g, t.x, t.y, DRAW.towerSize * 0.95, 5, 0.6);
        continue;
      }
      if (t.trench) {
        g.lineStyle(DRAW.trenchWidth, COLORS.trench).strokeCircle(t.x, t.y, DRAW.trenchRadius);
        g.lineStyle(2, COLORS.trenchEdge).strokeCircle(t.x, t.y, DRAW.trenchRadius + DRAW.trenchWidth / 2);
      }
      const nest = this.spr('nest', t.x, t.y, false);
      // «проявление»: первые JUICE.manifestTime с гнездо — светлый силуэт, проступает и твердеет
      const born = this.manifest.get(t.id);
      if (born !== undefined) {
        const k = (this.time.now - born) / 1000 / JUICE.manifestTime;
        if (k < 1) {
          if (k < 0.7) nest.setTint(JUICE.manifestColor).setTintMode(Phaser.TintModes.FILL);
          nest.setAlpha(0.25 + 0.75 * Math.min(1, k * 1.4));
          g.fillStyle(JUICE.manifestGlow, 0.35 * (1 - k)).fillEllipse(t.x, t.y, DRAW.towerSize * 2.6, DRAW.towerSize * 1.4);
        } else this.manifest.delete(t.id);
      }
      const gy = t.y - DRAW.nestGunH;
      top.lineStyle(5, 0x1c1c18).lineBetween(t.x, gy, t.x + Math.cos(t.aim) * DRAW.barrel, gy + Math.sin(t.aim) * DRAW.barrel * 0.6);
      top.fillStyle(0x2a2a26).fillCircle(t.x, gy, 5);
      if (this.rangeShow?.id === t.id && this.time.now < this.rangeShow.until) this.rangeRing(g, t.x, t.y, COLORS.tower);
      if (!t.trench && w.level.builds.includes('trench')) {
        const can = w.people >= BUILD.trench.cost;
        g.lineStyle(2, can ? COLORS.slotAffordable : COLORS.slot, can ? 0.8 : 0.25).strokeCircle(t.x, t.y, DRAW.trenchRadius);
      }
      this.hpBar(top, t.x, t.y - DRAW.hpOffset.nest, t.hp / t.maxHp);
    }

    // Люди — машут, кольцо тает, пока ждут
    for (const s of w.survivors) {
      const k = s.life / w.surv.life;
      // человек стоит на крыше дома (дом — ниже точки на roofH), машет; кольцо — поверх
      top.lineStyle(2, COLORS.survivorRing, 0.25 + 0.5 * Math.min(1, k)).strokeEllipse(s.x, s.y, DRAW.survivorRing * 2, DRAW.survivorRing * 1.2);
      this.spr(`civ${s.id % 3}`, s.x, s.y - bob(s.id) * 0.6, s.id % 2 === 0).setDepth(2 + (s.y + DRAW.roofH) / 1000 + 0.0005);
    }

    // Враги — смотрят по ходу дороги (берсерк — на цель), подпрыгивают на ходу, белеют от попадания
    for (const e of w.enemies) {
      const cfg = ENEMIES[e.type];
      const ahead = e.goal && e.state === 'charge' ? e.goal : w.path.at(e.d + 8);
      const flip = ahead.x < e.x;
      // элитный: крупнее, под ним пульсирует красное свечение
      const tier = e.boss ? BOSS : e.elite ? ELITE : null;
      const sc = (SPRITES.keyScale[e.type] ?? SPRITES.scale) * (tier?.scale ?? 1);
      if (tier) g.fillStyle(tier.aura, tier.auraAlpha * (0.75 + 0.25 * Math.sin(w.t * 6 + e.id))).fillEllipse(e.x, e.y, cfg.radius * tier.auraR * 2.2, cfg.radius * tier.auraR * 1.1);
      // босс: ещё и расходящееся кольцо у ног
      if (e.boss) {
        const k = (w.t * 0.8 + e.id) % 1;
        g.lineStyle(3, BOSS.aura, 0.9 * (1 - k)).strokeEllipse(e.x, e.y, cfg.radius * BOSS.auraR * (2.2 + k * 1.4), cfg.radius * BOSS.auraR * (1.1 + k * 0.7));
      }
      const img = this.spr(e.type, e.x, e.y - (e.blocked ? 0 : bob(e.id)), flip, sc);
      if (e.hurtT > 0) img.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
      if (e.type === 'berserker' && e.stabAt) img.setRotation(flip ? -0.3 : 0.3);
      if (e.type === 'spearman' && e.stabAt) {
        top.lineStyle(3, 0xc8ccd0).lineBetween(e.x, e.y - 14, e.stabAt.x, e.stabAt.y - 6);
      }
      if (e.slowed || e.blocked) g.lineStyle(1, COLORS.wire, 0.8).strokeCircle(e.x, e.y, cfg.radius + 4);
      if (e.hp < e.maxHp && !e.boss) this.hpBar(top, e.x, e.y - DRAW.hpOffset[e.type] * (tier?.scale ?? 1), e.hp / e.maxHp, DRAW.hpBarW * (e.elite ? 0.9 : 0.6));
    }
    this.hidePool();
    this.bossG.clear();
    this.drawBossBar(this.bossG);

    // Снаряды — над фигурами
    // трассеры: короткая линия по направлению полёта; при вылете — вспышка у ствола
    for (const s of w.shots) {
      const dx = s.target.x - s.x;
      const dy = s.target.y - s.y;
      const d = Math.hypot(dx, dy) || 1;
      if (!s.flashed) {
        s.flashed = true;
        this.parts.muzzle(s.x, s.y - (s.from === 'tower' ? DRAW.nestGunH : 0), Math.atan2(dy, dx));
        if (s.from === 'tower') this.parts.casing(s.x, s.y - DRAW.nestGunH);
      }
      const col = s.from === 'heli' ? COLORS.bullet : COLORS.towerBullet;
      top.lineStyle(2, col, 0.95).lineBetween(s.x, s.y - 8, s.x - (dx / d) * DRAW.tracer, s.y - 8 - (dy / d) * DRAW.tracer);
    }

    // Вертолёт: тень на земле, корпус — спрайт сверху (вращается), винт — диском и лопастями
    const h = w.heli;
    this.heliShadow.setPosition(h.x + DRAW.shadowOffset, h.y + DRAW.shadowOffset).setRotation(h.rot);
    this.heliImg.setPosition(h.x, h.y).setRotation(h.rot);
    const r = this.rotorG;
    r.clear();
    const R = DRAW.rotorRadius;
    r.fillStyle(0xd8e0d0, 0.1).fillCircle(h.x, h.y, R);
    r.lineStyle(3, 0x1c1c18, 0.55);
    for (let i = 0; i < 5; i++) {
      const a = h.rotor + (i * Math.PI * 2) / 5;
      r.lineBetween(h.x, h.y, h.x + Math.cos(a) * R, h.y + Math.sin(a) * R);
    }
    for (let i = 0; i < h.carrying; i++) r.fillStyle(COLORS.survivor).fillCircle(h.x - 8 + i * 8, h.y + 26, 3);

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
    this.parts.update(dt);
    this.updateDamage(dt);
    this.tutorial?.update(dt, w, !!(this.paused || this.card || this.menu || this.world.over));
    this.drawAmbient();

    // Меню постройки
    const m = this.menuG;
    m.clear();
    if (this.menu) {
      this.menu.buttons.forEach((b, i) => {
        const can = w.canBuild(this.menu.slot.id, b.kind);
        m.fillStyle(can ? COLORS.slotAffordable : 0x777766, 0.95).fillRoundedRect(b.rect.x, b.rect.y, b.rect.width, b.rect.height, 6);
        this.menuTexts[i].setText(T[b.kind](BUILD[b.kind].cost))
          .setPosition(b.rect.centerX, b.rect.centerY).setVisible(true).setDepth(10.5); // над подложкой (на одной глубине 10 текст уходил под неё)
      });
      m.lineStyle(2, COLORS.slotAffordable).strokeCircle(this.menu.slot.x, this.menu.slot.y, DRAW.slotRadius + 4);
      if (this.menu.buttons.some((b) => b.kind === 'tower')) this.rangeRing(g, this.menu.slot.x, this.menu.slot.y, COLORS.slotAffordable);
    }
  }

  // Радиус пушки: лёгкая заливка и пунктирный круг (на земле, под фигурами)
  rangeRing(g, x, y, color) {
    const r = BUILD.tower.range;
    g.fillStyle(color, DRAW.rangeFill).fillCircle(x, y, r);
    const n = DRAW.rangeDashes;
    g.lineStyle(2, color, DRAW.rangeLine);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      g.beginPath().arc(x, y, r, a, a + (Math.PI / n) * 1.1, false).strokePath();
    }
  }

  // База грузовика: утоптанная площадка, забор из кольев с колючкой (вид 3/4), две вышки по углам
  drawBase(g, truck) {
    const B = DRAW.base;
    const x0 = truck.x - B.w / 2;
    const y0 = truck.y - B.h / 2;
    g.fillStyle(0x000000, 0.12).fillRoundedRect(x0 + 4, y0 + 5, B.w, B.h, 6);
    g.fillStyle(0xc8b48a, 0.85).fillRoundedRect(x0, y0, B.w, B.h, 6);
    g.lineStyle(1, 0x8a7656, 0.6).strokeRoundedRect(x0, y0, B.w, B.h, 6);
    // забор: колья по периметру, две нитки колючки; спереди (ниже) забор перекрывает площадку
    const posts = [];
    for (let x = x0; x <= x0 + B.w; x += B.post) posts.push([x, y0], [x, y0 + B.h]);
    for (let y = y0 + B.post; y < y0 + B.h; y += B.post) posts.push([x0, y], [x0 + B.w, y]);
    g.lineStyle(2, 0x5a4430);
    for (const [x, y] of posts) g.lineBetween(x, y, x, y - B.fenceH);
    g.lineStyle(1, 0x9a9a92, 0.9);
    for (const h of [B.fenceH * 0.4, B.fenceH * 0.85]) {
      g.strokeRect(x0, y0 - h, B.w, B.h);
    }
    this.prop('watchtower', x0 + 6, y0 + 4, false);
    this.prop('watchtower', x0 + B.w - 6, y0 + B.h - 2, true);
  }

  // Свет сцены одним градиентом поверх земли (под фигурами): тёплый закат и фиолетовое свечение врат
  drawLight() {
    const P = TERRAIN;
    const l = this.add.graphics().setDepth(1.9);
    l.fillGradientStyle(P.lightWarm, P.lightWarm, P.lightCool, P.lightCool, P.lightAlpha, P.lightAlpha * 0.4, P.lightAlpha * 0.4, P.lightAlpha * 1.4);
    l.fillRect(0, 0, VIEW.width, VIEW.height);
    const gate = this.map.gate;
    for (let i = 6; i >= 1; i--) l.fillStyle(P.gateGlow, 0.035).fillCircle(gate.x, gate.y, gate.r * (1 + i * 0.6));
  }

  // Живой фон: медленные тени облаков по полю и бегущие гребни волн на море (по реальному времени)
  drawAmbient() {
    const a = this.ambG;
    a.clear();
    const t = this.time.now / 1000;
    const A = DRAW.ambient;
    for (let i = 0; i < A.clouds; i++) {
      const span = VIEW.width + 400;
      const x = ((t * A.cloudSpeed * (1 + i * 0.17) + i * 397) % span) - 200;
      const y = 90 + ((i * 211) % (VIEW.height - 220));
      for (const [dx, dy, rx, ry] of [[0, 0, 120, 60], [70, 14, 90, 46], [-60, 18, 80, 40]]) {
        a.fillStyle(0x1a1430, A.cloudAlpha).fillEllipse(x + dx, y + dy, rx * 2, ry * 2);
      }
    }
    const seaTop = VIEW.height - TERRAIN.seaH;
    a.lineStyle(2, 0xffffff, 0.45);
    for (let i = 0; i < A.waves; i++) {
      const y = seaTop + 10 + ((i * 13) % (TERRAIN.seaH - 14));
      const x = ((t * A.waveSpeed + i * 173) % (VIEW.width + 60)) - 30;
      const w = 14 + (i % 3) * 8;
      a.lineBetween(x, y, x + w, y - 1);
    }
  }

  // Штамп отчёта: двойная рамка, крупно по-корейски, снизу мелко RU · EN; чуть наискось, как поставлен рукой
  makeStamp(x, y, ok) {
    const S = DRAW.stamp;
    const color = ok ? COLORS.stampOk : COLORS.stamp;
    const css = `#${color.toString(16).padStart(6, '0')}`;
    const g = this.add.graphics();
    g.fillStyle(color, 0.08).fillRoundedRect(-S.w / 2, -S.h / 2, S.w, S.h, 6);
    g.lineStyle(4, color, 0.95).strokeRoundedRect(-S.w / 2, -S.h / 2, S.w, S.h, 6);
    g.lineStyle(1.5, color, 0.95).strokeRoundedRect(-S.w / 2 + 6, -S.h / 2 + 6, S.w - 12, S.h - 12, 4);
    const ko = this.add.text(0, -10, ok ? T.report.doneKo : T.report.failedKo, {
      fontFamily: S.koFont, fontSize: `${S.koSize}px`, fontStyle: 'bold', color: css,
    }).setOrigin(0.5);
    const sub = this.add.text(0, S.h / 2 - 18, `${ok ? T.report.done : T.report.failed} · ${ok ? T.report.doneEn : T.report.failedEn}`, {
      fontFamily: 'Arial, sans-serif', fontSize: `${S.subSize}px`, fontStyle: 'bold', color: css,
    }).setOrigin(0.5);
    return this.add.container(x, y, [g, ko, sub]).setDepth(21).setRotation(-0.07);
  }

  // Неподвижный спрайт (дом, дерево, бункер, грузовик): точка опоры — по sprites.json, глубина — по y
  prop(key, x, y, flip) {
    const meta = this.spriteMeta[key] || { ox: 0.5, oy: 0.85 };
    return this.add.image(x, y, `spr_${key}`).setOrigin(flip ? 1 - meta.ox : meta.ox, meta.oy)
      .setFlipX(flip).setScale(SPRITES.keyScale[key] ?? SPRITES.scale).setDepth(2 + y / 1000);
  }

  // Движущийся спрайт из пула: каждый кадр берём следующую картинку, лишние прячем (hidePool)
  spr(key, x, y, flip, scale = SPRITES.keyScale[key] ?? SPRITES.scale) {
    let img = this.pool[this.poolI];
    if (!img) {
      img = this.add.image(0, 0, `spr_${key}`);
      this.pool.push(img);
    }
    this.poolI++;
    const meta = this.spriteMeta[key] || { ox: 0.5, oy: 0.9 };
    return img.setTexture(`spr_${key}`).setOrigin(flip ? 1 - meta.ox : meta.ox, meta.oy).setFlipX(flip)
      .setPosition(x, y).setScale(scale).setRotation(0).clearTint().setTintMode(Phaser.TintModes.MULTIPLY).setAlpha(1).setVisible(true).setDepth(2 + y / 1000);
  }

  hidePool() {
    for (let i = this.poolI; i < this.pool.length; i++) this.pool[i].setVisible(false);
  }

  // Полоса босса над экраном: имя и здоровье, пока он жив
  drawBossBar(g) {
    const b = this.world.boss;
    if (!this.bossText) {
      this.bossText = this.add.text(VIEW.width / 2, BOSS.barY - 4, '', {
        fontFamily: '"Courier New", Courier, monospace', fontSize: `${DRAW.fontSize * 0.9}px`, fontStyle: 'bold', color: '#f0d8ff', stroke: '#1a0a2a', strokeThickness: 4,
      }).setOrigin(0.5, 1).setDepth(15);
    }
    this.bossText.setVisible(!!b && !this.card);
    // подсказка внизу прячется под полосой босса и под титрами; при прицеливании — видна всегда
    this.hint.setVisible(!!this.aiming || (!b && !this.radio.active && !this.tutorial?.active));
    if (!b || this.card) return;
    this.bossText.setText(T.bossBar(T.dossier.bosses[b.type].name));
    const x0 = VIEW.width / 2 - BOSS.barW / 2;
    const by = this.radio.active ? VIEW.height - RADIO.height - BOSS.barH - 10 : BOSS.barY;
    this.bossText.setY(by - 4);
    g.fillStyle(0x1a0a2a, 0.85).fillRect(x0 - 3, by - 3, BOSS.barW + 6, BOSS.barH + 6);
    g.fillStyle(0x3a2a4a).fillRect(x0, by, BOSS.barW, BOSS.barH);
    g.fillStyle(BOSS.barColor).fillRect(x0, by, BOSS.barW * Math.max(0, b.hp / b.maxHp), BOSS.barH);
    for (let i = 1; i < 10; i++) g.fillStyle(0x1a0a2a, 0.6).fillRect(x0 + (BOSS.barW * i) / 10 - 1, by, 2, BOSS.barH);
  }

  hpBar(g, x, y, k, width = DRAW.hpBarW) {
    g.fillStyle(COLORS.hpBarBack, 0.6).fillRect(x - width / 2, y, width, DRAW.hpBarH);
    g.fillStyle(COLORS.hpBar).fillRect(x - width / 2, y, width * Math.max(0, k), DRAW.hpBarH);
  }

  // ---------- HUD ----------
  drawHud() {
    const w = this.world;
    this.hud.update(w, this.game.loop.delta / 1000);
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
      if (!this.bot) markQuests(this.levelId, r.quests.filter((q) => q.state === 'done').map((q) => q.id));
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
    type(x0 + 28, y0 + 20, `${T.report.header} · ${this.world.level.title}${this.world.level.rank ? ` · ${T.gateRank(this.world.level.rank)}` : ''}`, DRAW.resultSmall);
    // штамп
    // штамп: всегда ярко-зелёный (выполнено) или красный (провалено); крупно по-корейски, снизу — по-русски и по-английски
    this.makeStamp(x0 + W - 150, y0 + 112, win);
    const title = type(x0 + 28, y0 + 74, win ? T.win : T.lose, DRAW.resultTitle - 4, COLORS.ink, { fontStyle: 'bold' });
    const sg = DRAW.resultStar * 2.3;
    drawStars(panel, x0 + 28 + DRAW.resultStar + sg, y0 + 152, DRAW.resultStar, r.stars, sg);
    // последняя реплика по радио — цитатой
    const [who, quote] = T.radio[w.over];
    type(x0 + 28, y0 + 186, `«${quote}» — ${T.speakers[who]}`, DRAW.resultSmall, COLORS.inkRed, {
      fontStyle: 'italic', wordWrap: { width: W - 56 },
    });
    panel.lineStyle(1, COLORS.paperEdge, 0.5).lineBetween(x0 + 24, y0 + 222, x0 + W - 24, y0 + 222);
    const body = type(x0 + 28, y0 + 234, T.summary(r).join('\n'), DRAW.resultBody, COLORS.ink, {
      lineSpacing: 3, fontStyle: 'bold', wordWrap: { width: W - 56 },
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
      const copyBtn = makeButton(this, cx, y0 + H + 26, T.copyStats(n), 'dark', async () => {
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
