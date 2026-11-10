// Досье «Сектора 67»: карточка «Новый враг» / «Новое укрепление». Бумага, штамп, рисунок слева,
// текст на машинке справа, кнопка «Принято». Пока карточка открыта, сцена держит игру на паузе.
import { VIEW, COLORS, DOSSIER as D, ENEMIES, BUILD, ABILITIES, DRAW, ELITE, BOSS } from '../config.js';
import { T } from '../texts.js';
import { makeButton } from './button.js';

export class Dossier {
  // entry: { kind: 'enemy' | 'build', id } ; onClose — когда нажали «Принято»
  constructor(scene, entry, onClose) {
    this.scene = scene;
    const book = { enemy: T.dossier.enemies, elite: T.dossier.elites, boss: T.dossier.bosses, build: T.dossier.builds, ability: T.dossier.abilities }[entry.kind];
    const info = book[entry.id];
    const cx = VIEW.width / 2;
    const cy = VIEW.height / 2;
    const x0 = cx - D.width / 2;
    const y0 = cy - D.height / 2;
    const objs = [];
    const add = (o) => (objs.push(o.setDepth(30)), o);

    add(scene.add.rectangle(cx, cy, VIEW.width, VIEW.height, 0x000000, 0.5).setInteractive());
    const g = add(scene.add.graphics());
    // лист бумаги со скрепкой
    g.fillStyle(0x000000, 0.35).fillRect(x0 + 8, y0 + 10, D.width, D.height);
    g.fillStyle(COLORS.paper).fillRect(x0, y0, D.width, D.height);
    g.lineStyle(2, COLORS.paperEdge).strokeRect(x0, y0, D.width, D.height);
    g.lineStyle(1, COLORS.paperEdge, 0.4).lineBetween(x0 + 24, y0 + D.headerH, x0 + D.width - 24, y0 + D.headerH);
    // рамка с рисунком
    const px = x0 + D.pad;
    const py = y0 + D.headerH + D.pad;
    g.fillStyle(COLORS.ground).fillRect(px, py, D.picture, D.picture);
    g.lineStyle(4, COLORS.paperEdge).strokeRect(px, py, D.picture, D.picture);
    const sprKey = ['enemy', 'elite', 'boss'].includes(entry.kind) ? `spr_${entry.id}` : null;
    if (sprKey && scene.textures.exists(sprKey)) {
      // фон рамки — кусок дороги, на нём фигура крупно
      g.fillStyle(0xb09670).fillRect(px + 6, py + D.picture * 0.55, D.picture - 12, D.picture * 0.3);
      // элитный — красное свечение за фигурой
      if (entry.kind === 'elite' || entry.kind === 'boss') for (let i = 3; i > 0; i--) g.fillStyle(entry.kind === 'boss' ? BOSS.aura : ELITE.aura, 0.18).fillCircle(px + D.picture / 2, py + D.picture * 0.55, D.picture * 0.12 * i);
      const img = add(scene.add.image(px + D.picture / 2, py + D.picture * 0.82, sprKey).setOrigin(0.5, 0.92));
      const k = Math.min((D.picture * 0.8) / img.width, (D.picture * 0.8) / img.height);
      img.setScale(k);
    } else this.drawPicture(g, entry, px + D.picture / 2, py + D.picture / 2);
    // штамп
    // штамп «секретно»: крупно по-корейски, снизу RU · EN — как штамп отчёта
    const sw = 150;
    const sh = 58;
    const sx = x0 + D.width - D.pad - sw;
    const sy = y0 + 14;
    g.lineStyle(3, COLORS.stamp, 0.9).strokeRect(sx, sy, sw, sh);
    g.lineStyle(1, COLORS.stamp, 0.9).strokeRect(sx + 4, sy + 4, sw - 8, sh - 8);

    const type = (s, size, color = COLORS.ink, extra = {}) =>
      scene.add.text(0, 0, s, { fontFamily: '"Courier New", Courier, monospace', fontSize: `${size}px`, fontStyle: 'bold', color, ...extra });
    add(type(T.dossier.header, D.small).setPosition(x0 + D.pad, y0 + 22));
    const heading = { enemy: T.dossier.newEnemy, elite: T.dossier.newElite, boss: T.dossier.newBoss, build: T.dossier.newBuild, ability: T.dossier.newAbility }[entry.kind];
    add(type(heading, D.small, COLORS.inkRed, { fontStyle: 'bold' })
      .setPosition(x0 + D.pad, y0 + 22 + D.small + 6));
    const red = `#${COLORS.stamp.toString(16).padStart(6, '0')}`;
    add(scene.add.text(sx + sw / 2, sy + 22, T.dossier.stampKo, { fontFamily: DRAW.stamp.koFont, fontSize: '26px', fontStyle: 'bold', color: red }).setOrigin(0.5));
    add(scene.add.text(sx + sw / 2, sy + sh - 12, T.dossier.stamp, { fontFamily: 'Arial, sans-serif', fontSize: '11px', fontStyle: 'bold', color: red }).setOrigin(0.5));

    const tx = px + D.picture + D.pad;
    const tw = x0 + D.width - D.pad - tx;
    add(type(info.name, D.title, COLORS.ink, { fontStyle: 'bold' }).setPosition(tx, py - 4));
    add(type(info.text, D.body, COLORS.ink, { wordWrap: { width: tw }, lineSpacing: 4 }).setPosition(tx, py + D.title + 14));
    add(type(info.traits.map((t) => `— ${t}`).join('\n'), D.body, COLORS.inkRed, { lineSpacing: 4 })
      .setOrigin(0, 1).setPosition(tx, py + D.picture));

    const ok = makeButton(scene, 0, 0, T.dossier.ok, 'dark', () => {
      objs.forEach((o) => o.destroy());
      onClose();
    }, { size: D.button, depth: 31 });
    ok.setPosition(x0 + D.width - D.pad - ok.width / 2, y0 + D.height - D.pad - ok.height / 2);
    objs.push(ok);
  }

  // Рисунок в рамке — те же примитивы, что в игре, только крупнее
  drawPicture(g, entry, x, y) {
    const k = D.pictureScale;
    if (entry.kind === 'enemy') {
      const cfg = ENEMIES[entry.id];
      const r = cfg.radius * k;
      const spots = [[-1, -0.6], [0.9, -0.2], [-0.2, 0.8]];
      g.fillStyle(COLORS.road).fillRect(x - D.picture / 2 + 6, y - 22, D.picture - 12, 44);
      for (const [dx, dy] of spots.slice(0, entry.id === 'berserker' ? 1 : 3)) {
        const ex = x + dx * r * 1.6;
        const ey = y + dy * r * 1.2;
        if (entry.id === 'spearman') {
          g.lineStyle(3 * k * 0.5, COLORS.spear).lineBetween(ex, ey, ex - r * 2.6, ey - r * 0.6);
          g.fillStyle(COLORS.spearman).fillRect(ex - r, ey - r, r * 2, r * 2);
        } else if (entry.id === 'berserker') {
          g.lineStyle(4 * k * 0.5, COLORS.axe).lineBetween(x, y, x - r * 1.9, y - r * 0.4);
          g.fillStyle(COLORS.berserker).fillCircle(x, y, r * 1.4);
          g.lineStyle(3, 0x000000, 0.5).strokeCircle(x, y, r * 1.4);
        } else g.fillStyle(COLORS.goblin).fillCircle(ex, ey, r);
      }
    } else if (entry.id === 'artillery') {
      const r = ABILITIES.artillery.radius * 0.9;
      g.fillStyle(COLORS.shell, 0.35).fillCircle(x, y, r);
      g.lineStyle(3, COLORS.shell).strokeCircle(x, y, r);
      g.lineBetween(x - r * 0.4, y, x + r * 0.4, y).lineBetween(x, y - r * 0.4, x, y + r * 0.4);
      for (const [dx, dy] of [[-0.4, -0.3], [0.35, 0.2], [-0.1, 0.45]]) g.fillStyle(COLORS.goblin).fillCircle(x + dx * r, y + dy * r, 9);
    } else if (entry.id === 'reinforce') {
      g.fillStyle(COLORS.road).fillRect(x - D.picture / 2 + 6, y - 22, D.picture - 12, 44);
      for (const dx of [-14, 14]) {
        g.lineStyle(4, 0x2a2a20).lineBetween(x + dx, y, x + dx + 34, y);
        g.fillStyle(COLORS.soldier).fillCircle(x + dx, y, 14);
      }
      g.fillStyle(COLORS.goblin).fillCircle(x + 70, y, 11).fillCircle(x + 92, y - 8, 11);
    } else if (entry.id === 'trench') {
      const s = 26 * k * 0.6;
      g.lineStyle(10 * k * 0.5, COLORS.trench).strokeCircle(x, y, s * 1.1);
      g.lineStyle(2, COLORS.trenchEdge).strokeCircle(x, y, s * 1.1 + 6);
      g.fillStyle(COLORS.tower).fillRect(x - s / 2, y - s / 2, s, s);
      g.lineStyle(6, 0x2a2a20).lineBetween(x, y, x + s, y - s * 0.3);
    } else if (entry.id === 'mine') {
      g.fillStyle(COLORS.road).fillRect(x - D.picture / 2 + 6, y - 22, D.picture - 12, 44);
      g.lineStyle(2, COLORS.mineLight, 0.6).strokeCircle(x, y, BUILD.mine.radius * 0.9);
      g.fillStyle(COLORS.mine).fillCircle(x, y, 7 * k);
      g.fillStyle(COLORS.mineLight).fillCircle(x, y, 2.5 * k);
    }
  }
}
