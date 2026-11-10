// Обложка тома: игра — манхва, которую проходишь. Верхняя панель — побережье, над станцией небо рвут врата
// (живые: кольца, разряды, лучи, частицы, звук «쿠구궁»). Нижние косые панели — пробуждённые Хан и Юн.
// Нажатие — страница переворачивается, под ней карта серий.
// Неподвижная часть собирается один раз на 2D-канвасе (косые панели — обрезкой по контуру), живое рисует Phaser.
import * as Phaser from 'phaser';
import { VIEW, COLORS, SPEAKERS, SPRITES, DRAW, GATE_RANKS, WORLD_MAP, COVER as C } from '../config.js';
import { T } from '../texts.js';
import { Particles } from '../art/particles.js';
import { drawPortal } from '../art/portal.js';
import { turnPage } from '../ui/pageTurn.js';

const W = VIEW.width;
const H = VIEW.height;
// нижний край верхней панели — косой
const yA = (x) => C.slantTop - (C.slantDrop * x) / W;

export class CoverScene extends Phaser.Scene {
  constructor() {
    super('cover');
  }

  // Обложка — первая сцена, поэтому грузит всё общее (карта и игра берут из кэша)
  preload() {
    for (const [who, sp] of Object.entries(SPEAKERS)) if (sp.art) this.load.image(`portrait_${who}`, sp.art);
    this.load.image('mapArt', WORLD_MAP.art);
    for (const k of SPRITES.keys) this.load.image(`spr_${k}`, `sprites/${k}.png`);
    this.load.json('spritesMeta', 'sprites/sprites.json');
  }

  create() {
    // ссылки для замеров (?bot, ?level) — мимо обложки
    const params = new URLSearchParams(location.search);
    if (params.has('bot') || params.has('level')) {
      this.scene.start('map');
      return;
    }
    if (!this.textures.exists('coverArt')) this.composeArt();
    this.add.image(0, 0, 'coverArt').setOrigin(0);

    this.glow = this.add.graphics().setDepth(1);
    this.gateG = this.add.graphics().setDepth(2);
    // поля страницы поверх свечения: лучи и частицы не вылезают за рамку верхней панели
    const fr = this.add.graphics().setDepth(3.5);
    const paper = Phaser.Display.Color.HexStringToColor(C.paper).color;
    const ink = Phaser.Display.Color.HexStringToColor(C.ink).color;
    const gt = C.gutter;
    fr.fillStyle(paper).fillRect(0, 0, W, gt).fillRect(0, 0, gt, yA(0) + gt).fillRect(W - gt, 0, gt, yA(W) + gt);
    fr.lineStyle(C.border, ink).lineBetween(gt, gt, gt, yA(gt)).lineBetween(W - gt, gt, W - gt, yA(W - gt));
    fr.lineBetween(gt, gt, W - gt, gt);
    this.parts = new Particles(this.add.graphics().setDepth(3));
    this.t = 0;
    this.spawnT = 0;

    this.drawTexts();

    // звук врат — манхва-надпись, подрагивает
    this.sfx = this.add.text(C.sfx.x, C.sfx.y, T.cover.sfx, {
      fontFamily: DRAW.stamp.koFont, fontSize: `${C.sfx.size}px`, fontStyle: 'bold', color: '#efd8ff',
      stroke: '#2a0a4a', strokeThickness: 10,
    }).setOrigin(0.5).setAngle(C.sfx.angle).setDepth(4);

    // «нажми» — лента внизу, мигает
    const tap = this.add.text(W / 2, H - C.tapY, T.cover.tap, {
      fontFamily: 'Arial, sans-serif', fontSize: `${C.tapSize}px`, fontStyle: 'bold', color: '#f4f0e4',
    }).setOrigin(0.5).setDepth(6);
    const rib = this.add.graphics().setDepth(5.9);
    rib.fillStyle(0x0e0b18, 0.92).fillRect(tap.x - tap.width / 2 - 30, tap.y - tap.height / 2 - 10, tap.width + 60, tap.height + 20);
    rib.lineStyle(2, COLORS.gate, 0.9).strokeRect(tap.x - tap.width / 2 - 30, tap.y - tap.height / 2 - 10, tap.width + 60, tap.height + 20);
    this.tweens.add({ targets: tap, alpha: 0.35, duration: 700, yoyo: true, repeat: -1 });

    this.input.once('pointerdown', () => this.turnPage());
    this.input.keyboard?.once('keydown', () => this.turnPage());
  }

  // ---------- неподвижная обложка на канвасе ----------
  composeArt() {
    const tex = this.textures.createCanvas('coverArt', W, H);
    const ctx = tex.getContext();
    const img = (key) => (this.textures.exists(key) ? this.textures.get(key).getSourceImage() : null);
    const path = (pts) => {
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
    };
    const panel = (pts, paint) => {
      ctx.save();
      path(pts);
      ctx.clip();
      paint();
      ctx.restore();
      path(pts);
      ctx.lineWidth = C.border;
      ctx.strokeStyle = C.ink;
      ctx.stroke();
    };

    // поля страницы
    ctx.fillStyle = C.paper;
    ctx.fillRect(0, 0, W, H);

    // A: побережье, небо над станцией в отсвете врат
    const g = C.gutter;
    const A = [[g, g], [W - g, g], [W - g, yA(W - g)], [g, yA(g)]];
    panel(A, () => {
      const art = img('mapArt');
      if (art) ctx.drawImage(art, 0, 0, W, H);
      else {
        ctx.fillStyle = '#3a3050';
        ctx.fillRect(0, 0, W, H);
      }
      const rg = ctx.createRadialGradient(C.gate.x, C.gate.y, 10, C.gate.x, C.gate.y, C.gate.r * 4.5);
      rg.addColorStop(0, 'rgba(170, 90, 255, 0.55)');
      rg.addColorStop(0.5, 'rgba(110, 50, 200, 0.22)');
      rg.addColorStop(1, 'rgba(60, 20, 120, 0)');
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, W, H);
      // слева сверху темнее — под название
      const lg = ctx.createLinearGradient(0, 0, W * 0.55, 0);
      lg.addColorStop(0, 'rgba(10, 6, 24, 0.62)');
      lg.addColorStop(1, 'rgba(10, 6, 24, 0)');
      ctx.fillStyle = lg;
      ctx.fillRect(0, 0, W, H);
    });

    // B и C: пробуждённые на «линиях скорости» и растре, как на разворотах манхвы
    const top = (x) => yA(x) + g;
    const s1 = C.splitTop;
    const s2 = C.splitBottom;
    const B = [[g, top(g)], [s1 - g / 2, top(s1 - g / 2)], [s2 - g / 2, H - g], [g, H - g]];
    const Cp = [[s1 + g / 2, top(s1 + g / 2)], [W - g, top(W - g)], [W - g, H - g], [s2 + g / 2, H - g]];
    const hero = (pts, who, px, tone) => () => {
      ctx.fillStyle = tone;
      ctx.fillRect(0, 0, W, H);
      const cx = px + C.portrait / 2;
      const cy = H - C.portrait / 2 - g;
      // линии скорости от лица
      ctx.strokeStyle = 'rgba(230, 210, 255, 0.16)';
      for (let i = 0; i < 90; i++) {
        const a = (i / 90) * Math.PI * 2;
        ctx.lineWidth = i % 3 ? 1 : 3;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * C.portrait * 0.45, cy + Math.sin(a) * C.portrait * 0.45);
        ctx.lineTo(cx + Math.cos(a) * 900, cy + Math.sin(a) * 900);
        ctx.stroke();
      }
      // растр к краю панели
      ctx.fillStyle = 'rgba(14, 11, 24, 0.35)';
      for (let y = 0; y < H; y += 9) {
        for (let x = 0; x < W; x += 9) {
          const d = Math.hypot(x - cx, y - cy) / 700;
          if (d > 0.35) {
            ctx.beginPath();
            ctx.arc(x + ((y / 9) % 2) * 4.5, y, Math.min(3.4, d * 3.2), 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      const p = img(`portrait_${who}`);
      if (p) {
        ctx.drawImage(p, px, H - C.portrait - g, C.portrait, C.portrait);
        ctx.strokeStyle = C.ink;
        ctx.lineWidth = 3;
        ctx.strokeRect(px, H - C.portrait - g, C.portrait, C.portrait);
      }
    };
    panel(B, hero(B, 'sergeant', C.heroB.portraitX, '#231a3c'));
    panel(Cp, hero(Cp, 'medic', C.heroC.portraitX, '#2a1a34'));
    tex.refresh();
  }

  // ---------- надписи ----------
  drawTexts() {
    const ko = (x, y, s, size, extra = {}) =>
      this.add.text(x, y, s, { fontFamily: DRAW.stamp.koFont, fontSize: `${size}px`, fontStyle: 'bold', color: '#f4f0e4', ...extra });
    const sans = (x, y, s, size, extra = {}) =>
      this.add.text(x, y, s, { fontFamily: 'Arial, sans-serif', fontSize: `${size}px`, fontStyle: 'bold', color: '#f4f0e4', ...extra });
    const type = (x, y, s, size, extra = {}) =>
      this.add.text(x, y, s, { fontFamily: '"Courier New", Courier, monospace', fontSize: `${size}px`, fontStyle: 'bold', color: C.ink, ...extra });

    // название
    ko(C.titleX, C.titleY, T.titleKo, C.titleKoSize, { stroke: '#1a1430', strokeThickness: 12 })
      .setShadow(4, 6, '#000', 8, true, true).setDepth(5);
    sans(C.titleX + 6, C.titleY + C.titleKoSize + 14, T.titleSub, C.titleSubSize, { stroke: '#1a1430', strokeThickness: 6 }).setDepth(5);

    // плашка рассказчика
    const nar = type(C.narration.x + 14, C.narration.y + 10, T.cover.narration, C.narration.size).setDepth(5.1);
    const ng = this.add.graphics().setDepth(5);
    ng.fillStyle(0xf2ede2).fillRect(C.narration.x, C.narration.y, nar.width + 28, nar.height + 20);
    ng.lineStyle(3, 0x0e0b18).strokeRect(C.narration.x, C.narration.y, nar.width + 28, nar.height + 20);

    // реплика по радио — пузырь с хвостом
    const b = C.bubble;
    const bt = sans(b.x + b.w / 2, b.y + b.h / 2 + 8, T.cover.bubble, C.bubbleSize, {
      color: '#14101c', align: 'center', wordWrap: { width: b.w - 50 },
    }).setOrigin(0.5).setDepth(5.1);
    const bg = this.add.graphics().setDepth(5);
    bg.fillStyle(0xffffff).fillEllipse(b.x + b.w / 2, b.y + b.h / 2 + 8, b.w, b.h);
    bg.fillTriangle(b.x + b.w * 0.2, b.y + b.h * 0.8, b.x + b.w * 0.3, b.y + b.h * 0.9, b.x - 10, b.y + b.h + 40);
    bg.lineStyle(3, 0x0e0b18).strokeEllipse(b.x + b.w / 2, b.y + b.h / 2 + 8, b.w, b.h);
    const tag = sans(b.x + b.w / 2, b.y - 6, T.cover.bubbleWho, C.bubbleSize * 0.7, { color: '#f4f0e4', backgroundColor: '#0e0b18', padding: { x: 8, y: 3 } })
      .setOrigin(0.5).setDepth(5.2);
    tag.setY(b.y - 4);

    // том и ранги врат — значок в правом верхнем углу
    const vx = W - C.gutter - 20;
    const vol = sans(vx, C.gutter + 18, T.cover.volume, C.volumeSize, { backgroundColor: '#0e0b18', padding: { x: 12, y: 6 } })
      .setOrigin(1, 0).setDepth(5);
    const rg = this.add.graphics().setDepth(5);
    const ranks = ['E', 'D', 'C'];
    ranks.forEach((r, i) => {
      const x = vx - (ranks.length - 1 - i) * 40 - 16;
      const y = vol.y + vol.height + 30;
      rg.fillStyle(GATE_RANKS[r].color).fillPoints([{ x, y: y - 16 }, { x: x + 16, y }, { x, y: y + 16 }, { x: x - 16, y }], true);
      rg.lineStyle(2, 0xf4f0e4).strokePoints([{ x, y: y - 16 }, { x: x + 16, y }, { x, y: y + 16 }, { x: x - 16, y }], true);
      sans(x, y, r, 18).setOrigin(0.5).setDepth(5.1);
    });
    sans(vx, vol.y + vol.height + 54, T.cover.ranks, 16, { stroke: '#0e0b18', strokeThickness: 4 }).setOrigin(1, 0).setDepth(5);

    // подписи к пробуждённым
    const cap = (x, y, [name, power], align) => {
      const o = align === 'right' ? 1 : 0;
      sans(x, y, name, C.heroName, { stroke: '#0e0b18', strokeThickness: 6 }).setOrigin(o, 0).setDepth(5);
      const p = sans(x, y + C.heroName + 10, power, C.heroPower, { color: '#e6d6ff', stroke: '#0e0b18', strokeThickness: 4, align, lineSpacing: 4 })
        .setOrigin(o, 0).setDepth(5);
      return p;
    };
    cap(C.heroB.captionX, C.heroB.captionY, T.cover.heroes.sergeant, 'left');
    cap(C.heroC.captionX, C.heroC.captionY, T.cover.heroes.medic, 'right');
  }

  // ---------- живые врата ----------
  update(_, deltaMs) {
    if (!this.gateG) return;
    const dt = Math.min(0.05, deltaMs / 1000);
    this.t += dt;
    const t = this.t;
    const G = C.gate;
    // лучи из разрыва в небе
    const gl = this.glow;
    gl.clear();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + t * 0.15;
      const len = G.r * (2.0 + 0.5 * Math.sin(t * 2 + i));
      gl.lineStyle(10 - (i % 3) * 3, COLORS.gate, 0.12 + 0.06 * Math.sin(t * 3 + i * 1.7));
      gl.lineBetween(G.x + Math.cos(a) * G.r * 0.9, G.y + Math.sin(a) * G.r * 0.9, G.x + Math.cos(a) * len, G.y + Math.sin(a) * len);
    }
    for (let k = 3; k > 0; k--) gl.fillStyle(COLORS.gate, 0.08).fillCircle(G.x, G.y, G.r * (1.15 + k * 0.25));
    this.gateG.clear();
    drawPortal(this.gateG, G, t);
    // частицы втягиваются в разрыв
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = 0.06;
      this.parts.portal(G.x, G.y, G.r * (1.1 + Math.random() * 0.6));
    }
    this.parts.update(dt);
    // «쿠구궁» подрагивает
    this.sfx.setPosition(C.sfx.x + Math.sin(t * 40) * 1.5, C.sfx.y + Math.cos(t * 33) * 1.5);
  }

  turnPage() {
    turnPage(this, 'map');
  }

}
