// Оглавление тома: каждая серия — глава манхвы, своя косая панель. В панели — свой кусок побережья,
// живые врата цвета ранга, новый враг главы (у закрытой главы — чёрный силуэт), «ГЛАВА N», название,
// тизер без подсказок, звёзды и задания. Нажатие на открытую главу — страница переворачивается в уровень.
// Неподвижное собирается на 2D-канвасе (косые панели — обрезкой по контуру), живое рисует Phaser.
import * as Phaser from 'phaser';
import { VIEW, COLORS, LEVELS, SPEAKERS, DRAW, SPRITES, WORLD_MAP as M, GATE_RANKS, CHAPTERS as CH, COVER } from '../config.js';
import { T } from '../texts.js';
import { loadProgress, unlockedCount } from '../progress.js';
import { copyStats, statsText } from '../ui/copyStats.js';
import { drawStars } from '../ui/stars.js';
import { makeButton } from '../ui/button.js';
import { drawPortal } from '../art/portal.js';
import { turnPage } from '../ui/pageTurn.js';

const W = VIEW.width;
const H = VIEW.height;
let booted = false;

export class MapScene extends Phaser.Scene {
  constructor() {
    super('map');
  }

  // Обычно всё уже загрузила обложка; эти строки — на случай прямого запуска карты
  preload() {
    for (const [who, sp] of Object.entries(SPEAKERS)) if (sp.art && !this.textures.exists(`portrait_${who}`)) this.load.image(`portrait_${who}`, sp.art);
    if (!this.textures.exists('mapArt')) this.load.image('mapArt', M.art);
    for (const k of SPRITES.keys) if (!this.textures.exists(`spr_${k}`)) this.load.image(`spr_${k}`, `sprites/${k}.png`);
    if (!this.cache.json.exists('spritesMeta')) this.load.json('spritesMeta', 'sprites/sprites.json');
  }

  create() {
    // Ссылки для замеров (?bot=…, ?level=…) — сразу в уровень, только при первом запуске
    const params = new URLSearchParams(location.search);
    const first = !booted;
    booted = true;
    if (first && (params.has('bot') || params.has('level'))) {
      this.scene.start('game', { level: +(params.get('level') || 1) });
      return;
    }
    this._turning = false;
    this.cameras.main.setViewport(0, 0, W, H);

    const progress = loadProgress();
    const open = unlockedCount(progress);
    this.panels = this.layout();
    this.composeArt(progress, open);
    this.add.image(0, 0, 'tocArt').setOrigin(0);

    this.portalG = this.add.graphics().setDepth(2);
    this.t = 0;

    const sans = (x, y, s, size, extra = {}) =>
      this.add.text(x, y, s, { fontFamily: 'Arial, sans-serif', fontSize: `${size}px`, fontStyle: 'bold', color: '#f4f0e4', ...extra });
    const type = (x, y, s, size, extra = {}) =>
      this.add.text(x, y, s, { fontFamily: '"Courier New", Courier, monospace', fontSize: `${size}px`, fontStyle: 'bold', color: COVER.ink, ...extra });

    // шапка: «ТОМ 1 · ОГЛАВЛЕНИЕ» и название
    sans(CH.gutter + 18, CH.headerH / 2 + CH.gutter / 2, T.chapters.header, CH.headerSize, { color: COVER.ink }).setOrigin(0, 0.5);
    this.add.text(W / 2, CH.headerH / 2 + CH.gutter / 2, T.titleKo, {
      fontFamily: DRAW.stamp.koFont, fontSize: `${CH.headerSize + 10}px`, fontStyle: 'bold', color: COVER.ink,
    }).setOrigin(0.5);

    this.panels.forEach((p, i) => {
      const level = LEVELS[i];
      const cfg = CH.list[i] || CH.list[0];
      const won = progress.won.includes(level.id);
      const unlocked = level.id <= open;
      const next = unlocked && !won;
      const [, name] = level.title.split(' · ');
      const L = p.left + CH.pad;

      // новый враг главы: у закрытой — чёрный силуэт
      const key = `spr_${cfg.enemy}`;
      if (this.textures.exists(key)) {
        for (let k = 0; k < (cfg.pack || 1); k++) {
          const dx = k ? (k % 2 ? 1 : -1) * 70 : 0;
          const img = this.add.image(p.cx + cfg.enemyDx + dx, CH.enemyY - k * 26, key).setOrigin(0.5, 0.95)
            .setScale(CH.enemyScale * (k ? 0.85 : 1)).setDepth(3 - k * 0.01);
          if (!unlocked) img.setTint(0x0a0814).setTintMode(Phaser.TintModes.FILL).setAlpha(0.92);
        }
      }

      // «ГЛАВА N» — плашка рассказчика, рядом ромб ранга
      const tag = type(L + 12, CH.top + CH.pad + 8, T.chapters.chapter(i + 1), CH.tagSize).setDepth(5.1);
      const tg = this.add.graphics().setDepth(5);
      tg.fillStyle(0xf2ede2).fillRect(L, CH.top + CH.pad, tag.width + 24, tag.height + 16);
      tg.lineStyle(3, 0x0e0b18).strokeRect(L, CH.top + CH.pad, tag.width + 24, tag.height + 16);
      if (level.rank) {
        const rx = L + tag.width + 52;
        const ry = CH.top + CH.pad + (tag.height + 16) / 2;
        const s = 18;
        const pts = [{ x: rx, y: ry - s }, { x: rx + s, y: ry }, { x: rx, y: ry + s }, { x: rx - s, y: ry }];
        tg.fillStyle(unlocked ? GATE_RANKS[level.rank].color : 0x555a55).fillPoints(pts, true);
        tg.lineStyle(2, 0xf4f0e4).strokePoints(pts, true);
        sans(rx, ry, level.rank, 20).setOrigin(0.5).setDepth(5.1);
      }

      // название, тизер, звёзды и задания — снизу панели
      sans(L, CH.titleY, name || level.title, CH.titleSize, { stroke: '#0e0b18', strokeThickness: 8, color: unlocked ? '#f4f0e4' : '#8a8494' })
        .setOrigin(0, 1).setDepth(5);
      sans(L, CH.titleY + 8, unlocked ? T.chapters.teaser[i] : T.chapters.lockedTeaser, CH.teaserSize, {
        color: unlocked ? '#e6d6ff' : '#8a8494', stroke: '#0e0b18', strokeThickness: 4, wordWrap: { width: p.width - CH.pad * 2 - 20 },
      }).setDepth(5);
      const sg = this.add.graphics().setDepth(5);
      // drawStars рисует три звезды вокруг центра: центр — через одну звезду от левого края
      const sGap = DRAW.mapStar * 2.4;
      if (won) drawStars(sg, L + sGap + DRAW.mapStar, CH.starsY, DRAW.mapStar, progress.stars[level.id] || 1, sGap);
      const qDone = (progress.quests[level.id] || []).length;
      if (level.quests && unlocked) {
        // в верхнем ряду, после «ГЛАВА N» и ранга: внизу место занято звёздами и кнопкой
        sans(L + tag.width + 84, CH.top + CH.pad + (tag.height + 16) / 2, T.quests.map(qDone, level.quests.length), CH.metaSize, { color: '#f4f0e4', stroke: '#0e0b18', strokeThickness: 5 })
          .setOrigin(0, 0.5).setDepth(5);
      }

      // состояние: читать / перечитать / закрыта
      const state = next ? T.chapters.read : won ? T.chapters.again : T.chapters.locked;
      const st = sans(p.right - CH.pad, CH.starsY, state, CH.stateSize, {
        color: next ? '#14101c' : '#f4f0e4', backgroundColor: next ? '#ffd860' : '#0e0b18', padding: { x: 12, y: 6 },
      }).setOrigin(1, 0.5).setDepth(5);
      if (next) this.tweens.add({ targets: st, scale: 1.06, duration: 600, yoyo: true, repeat: -1 });

      if (!unlocked) return;
      const hit = this.add.zone(p.cx, (CH.top + H - CH.gutter) / 2, p.width, H - CH.top - CH.gutter).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => turnPage(this, 'game', { level: level.id }));
    });

    // Статистика забегов — для плейтеста с телефона
    const runs = JSON.parse(statsText()).runs.length;
    const copyBtn = makeButton(this, 0, CH.headerH / 2 + CH.gutter / 2, T.copyStats(runs), 'dark', async () => {
      copyBtn.label.setText((await copyStats()) ? T.copied : T.copyFailed);
    }, { size: M.labelFont * 0.7, padY: 5 });
    copyBtn.setX(W - CH.gutter - 10 - copyBtn.width / 2);
  }

  // три косые панели: границы вверху и внизу сдвинуты на slant
  layout() {
    const n = LEVELS.length;
    const g = CH.gutter;
    const inner = W - g * 2;
    const xs = (k, bottom) => g + (inner * k) / n - (bottom && k > 0 && k < n ? CH.slant : 0);
    return LEVELS.map((_, i) => {
      const tl = xs(i, false) + (i ? g / 2 : 0);
      const tr = xs(i + 1, false) - (i < n - 1 ? g / 2 : 0);
      const bl = xs(i, true) + (i ? g / 2 : 0);
      const br = xs(i + 1, true) - (i < n - 1 ? g / 2 : 0);
      const left = Math.max(tl, bl);
      const right = Math.min(tr, br);
      return { pts: [[tl, CH.top], [tr, CH.top], [br, H - g], [bl, H - g]], left, right, width: right - left, cx: (left + right) / 2 };
    });
  }

  composeArt(progress, open) {
    if (this.textures.exists('tocArt')) this.textures.remove('tocArt');
    const tex = this.textures.createCanvas('tocArt', W, H);
    const ctx = tex.getContext();
    const art = this.textures.exists('mapArt') ? this.textures.get('mapArt').getSourceImage() : null;
    ctx.fillStyle = COVER.paper;
    ctx.fillRect(0, 0, W, H);
    this.panels.forEach((p, i) => {
      const level = LEVELS[i];
      const cfg = CH.list[i] || CH.list[0];
      const unlocked = level.id <= open;
      ctx.save();
      ctx.beginPath();
      p.pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.clip();
      // свой кусок побережья: srcX — откуда берём полосу шириной панели (в масштабе высоты)
      const k = (H - CH.top) / H;
      const panelW = (p.right - p.left) + CH.slant + 40;
      if (art) ctx.drawImage(art, cfg.srcX, 0, panelW / k, H, p.left - CH.slant / 2 - 20, CH.top, panelW, H - CH.top);
      // отсвет врат цветом ранга
      const col = Phaser.Display.Color.IntegerToColor(GATE_RANKS[level.rank]?.color ?? COLORS.gate);
      const rg = ctx.createRadialGradient(p.cx + cfg.portalDx, CH.portalY, 6, p.cx + cfg.portalDx, CH.portalY, 260);
      rg.addColorStop(0, `rgba(${col.red}, ${col.green}, ${col.blue}, 0.5)`);
      rg.addColorStop(1, `rgba(${col.red}, ${col.green}, ${col.blue}, 0)`);
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, W, H);
      // низ темнее — под название
      const lg = ctx.createLinearGradient(0, H * 0.55, 0, H);
      lg.addColorStop(0, 'rgba(10, 6, 24, 0)');
      lg.addColorStop(1, 'rgba(10, 6, 24, 0.85)');
      ctx.fillStyle = lg;
      ctx.fillRect(0, 0, W, H);
      // закрытая глава — в тени
      if (!unlocked) {
        ctx.fillStyle = 'rgba(16, 14, 24, 0.66)';
        ctx.fillRect(0, 0, W, H);
      }
      ctx.restore();
      ctx.beginPath();
      p.pts.forEach(([x, y], k2) => (k2 ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.lineWidth = COVER.border;
      ctx.strokeStyle = COVER.ink;
      ctx.stroke();
    });
    tex.refresh();
    this.progressOpen = open;
  }

  update(_, deltaMs) {
    if (!this.portalG) return;
    this.t += Math.min(0.05, deltaMs / 1000);
    const g = this.portalG;
    g.clear();
    this.panels.forEach((p, i) => {
      const level = LEVELS[i];
      const cfg = CH.list[i] || CH.list[0];
      const unlocked = level.id <= this.progressOpen;
      const G = { x: p.cx + cfg.portalDx, y: CH.portalY, r: CH.portalR };
      if (!unlocked) {
        // закрытые врата — тусклое кольцо без жизни
        g.lineStyle(3, 0x6a6474, 0.6).strokeCircle(G.x, G.y, G.r);
        return;
      }
      drawPortal(g, G, this.t + i * 1.7, GATE_RANKS[level.rank]?.color);
    });
  }
}
