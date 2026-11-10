// Карта серий: побережье, серии слева направо. Пройденная открывает следующую.
import * as Phaser from 'phaser';
import { VIEW, COLORS, LEVELS, SPEAKERS, DRAW, SPRITES, WORLD_MAP as M } from '../config.js';
import { T } from '../texts.js';
import { loadProgress, unlockedCount } from '../progress.js';
import { copyStats, statsText } from '../ui/copyStats.js';
import { drawStars } from '../ui/stars.js';
import { makeButton } from '../ui/button.js';

let booted = false;

export class MapScene extends Phaser.Scene {
  constructor() {
    super('map');
  }

  // Портреты для радио грузим здесь: карта — первая сцена при любом запуске
  preload() {
    for (const [who, sp] of Object.entries(SPEAKERS)) if (sp.art) this.load.image(`portrait_${who}`, sp.art);
    this.load.image('mapArt', M.art);
    // спрайты из Blender и точки опоры (ноги) для каждого — sprites.json
    for (const k of SPRITES.keys) this.load.image(`spr_${k}`, `sprites/${k}.png`);
    this.load.json('spritesMeta', 'sprites/sprites.json');
  }

  create() {
    // Ссылки для замеров (?bot=…, ?level=…) — сразу в уровень, без карты; только при первом запуске,
    // чтобы кнопка «Карта» потом открывала карту
    const params = new URLSearchParams(location.search);
    const first = !booted;
    booted = true;
    if (first && (params.has('bot') || params.has('level'))) {
      this.scene.start('game', { level: +(params.get('level') || 1) });
      return;
    }

    const progress = loadProgress();
    const open = unlockedCount(progress);
    const g = this.add.graphics();

    // Фон: арт побережья, если загрузился; иначе — суша, море, берег примитивами
    const art = this.textures.exists('mapArt');
    if (art) {
      this.add.image(0, 0, 'mapArt').setOrigin(0).setDisplaySize(VIEW.width, VIEW.height).setDepth(-1);
      // плавное затемнение книзу (градиент — в WebGL; в Canvas Phaser зальёт ровно)
      g.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, M.artShade, M.artShade);
      g.fillRect(0, M.artShadeTop - 80, VIEW.width, VIEW.height - M.artShadeTop + 80);
    } else {
      g.fillStyle(COLORS.ground).fillRect(0, 0, VIEW.width, VIEW.height);
      g.fillStyle(COLORS.sea).fillRect(0, M.coastY, VIEW.width, VIEW.height - M.coastY);
      g.lineStyle(3, COLORS.roadEdge, 0.8).lineBetween(0, M.coastY, VIEW.width, M.coastY);
    }

    const text = (x, y, s, size, color = COLORS.text) =>
      this.add.text(x, y, s, { fontFamily: 'Arial, sans-serif', fontSize: `${size}px`, color, align: 'center' }).setOrigin(0.5);

    // Название и год на арте уже есть
    // Название: крупно по-корейски, под ним — по-русски и по-английски, ниже — год и подсказка
    const top = art ? M.titleTop : 70;
    if (art) {
      g.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.55, 0.55, 0, 0);
      g.fillRect(0, 0, VIEW.width, top + 210);
    }
    this.add.text(VIEW.width / 2, top, T.titleKo, {
      fontFamily: DRAW.stamp.koFont, fontSize: `${M.titleKoSize}px`, fontStyle: 'bold', color: '#f4f0e4',
      stroke: '#1a1430', strokeThickness: 10,
    }).setOrigin(0.5, 0).setShadow(4, 6, '#000', 8, true, true);
    text(VIEW.width / 2, top + M.titleKoSize + 30, T.titleSub, M.titleSubSize, '#f4f0e4')
      .setStroke('#1a1430', 6).setShadow(2, 2, '#000', 4);
    text(VIEW.width / 2, top + M.titleKoSize + 30 + M.titleSubSize + 18, T.mapSubtitle, M.labelFont * 0.85, '#e6dcc8')
      .setShadow(2, 2, '#000', 4);

    // Позиции серий: равномерно слева направо
    const n = LEVELS.length;
    const step = n > 1 ? (VIEW.width - M.marginX * 2) / (n - 1) : 0;
    const nodes = LEVELS.map((l, i) => ({ level: l, x: M.marginX + step * i, y: (art ? M.artNodeY : M.nodeY)[i % M.nodeY.length] }));

    // Дорога между сериями — пунктир
    for (let i = 1; i < nodes.length; i++) {
      const a = nodes[i - 1];
      const b = nodes[i];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const parts = Math.floor(len / (M.roadDash * 2));
      const reached = i < open;
      g.lineStyle(4, reached ? COLORS.slotAffordable : COLORS.slot, reached ? 0.8 : 0.25);
      for (let k = 0; k < parts; k++) {
        const t0 = (k * 2 * M.roadDash) / len;
        const t1 = ((k * 2 + 1) * M.roadDash) / len;
        g.lineBetween(a.x + (b.x - a.x) * t0, a.y + (b.y - a.y) * t0, a.x + (b.x - a.x) * t1, a.y + (b.y - a.y) * t1);
      }
    }

    for (const node of nodes) {
      const { level, x, y } = node;
      const won = progress.won.includes(level.id);
      const unlocked = level.id <= open;
      const fill = won ? COLORS.hpBar : unlocked ? COLORS.slotAffordable : 0x555a55;
      g.fillStyle(0x000000, 0.35).fillCircle(x + 4, y + 6, M.nodeRadius);
      g.fillStyle(fill).fillCircle(x, y, M.nodeRadius);
      g.lineStyle(3, 0x101410, 0.6).strokeCircle(x, y, M.nodeRadius);
      text(x, y, unlocked ? String(level.id) : T.locked, M.nodeFont, '#101410');
      // звёзды — на тёмной «таблетке» над кружком, пустые видны контуром
      if (won) {
        const sy = y - M.nodeRadius - DRAW.mapStar - 10;
        const gap = DRAW.mapStar * 2.4;
        g.fillStyle(0x101410, 0.75).fillRoundedRect(x - gap - DRAW.mapStar - 8, sy - DRAW.mapStar - 6, gap * 2 + DRAW.mapStar * 2 + 16, DRAW.mapStar * 2 + 12, DRAW.mapStar);
        drawStars(g, x, sy, DRAW.mapStar, progress.stars[level.id] || 1, gap);
      }
      // подпись: название серии и состояние — на плашке, чтобы читались поверх арта
      const [series, name] = level.title.split(' · ');
      const t1 = text(x, y + M.nodeRadius + 26, name || level.title, M.labelFont, unlocked ? COLORS.text : COLORS.textDim);
      const t2 = text(x, y + M.nodeRadius + 54, `${series.toLowerCase()} · ${won ? T.mapWon : unlocked ? T.mapOpen : T.mapLocked}`, M.labelFont * 0.72, COLORS.textDim);
      const pw = Math.max(t1.width, t2.width) + 28;
      g.fillStyle(0x101410, 0.7).fillRoundedRect(x - pw / 2, y + M.nodeRadius + 8, pw, 64, 10);

      if (!unlocked) continue;
      const hit = this.add.zone(x, y, M.nodeRadius * 2.4, M.nodeRadius * 2.4).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => this.scene.start('game', { level: level.id }));
    }

    // Статистика забегов — для плейтеста с телефона
    const runs = JSON.parse(statsText()).runs.length;
    const copyBtn = makeButton(this, VIEW.width - 200, art ? 40 : VIEW.height - 60, T.copyStats(runs), 'dark', async () => {
      copyBtn.label.setText((await copyStats()) ? T.copied : T.copyFailed);
    }, { size: M.labelFont * 0.75, padY: 6 });
    copyBtn.setX(VIEW.width - 16 - copyBtn.width / 2); // прижать к правому краю по ширине надписи
  }
}
