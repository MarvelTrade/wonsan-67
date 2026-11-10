// Карта серий: побережье, серии слева направо. Пройденная открывает следующую.
import * as Phaser from 'phaser';
import { VIEW, COLORS, LEVELS, SPEAKERS, DRAW, WORLD_MAP as M } from '../config.js';
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
    if (art) text(VIEW.width / 2, M.artSubtitleY, T.mapSubtitleArt, M.labelFont).setShadow(2, 2, '#000', 4);
    else {
      text(VIEW.width / 2, 90, T.title, M.titleSize);
      text(VIEW.width / 2, 150, T.mapSubtitle, M.labelFont, COLORS.textDim);
    }

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
      if (won) drawStars(g, x, y - M.nodeRadius - 22, DRAW.mapStar, progress.stars[level.id] || 1);
      text(x, y + M.nodeRadius + 26, level.title, M.labelFont, unlocked ? COLORS.text : COLORS.textDim).setShadow(2, 2, '#000', 4);
      text(x, y + M.nodeRadius + 52, won ? T.mapWon : unlocked ? T.mapOpen : T.mapLocked, M.labelFont * 0.8, COLORS.textDim).setShadow(2, 2, '#000', 4);

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
