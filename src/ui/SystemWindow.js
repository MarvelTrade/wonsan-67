// Окно «СИСТЕМА» (жанр манхвы, но в духе 1967 года): голубоватая телетайпная лента поверх экрана,
// «Уровень повышен», три карточки усилений с портретом того, чей это навык (Хан или Юн). Нажал — выбрал.
import { VIEW, COLORS, SYSTEM, SYS_UI as U, DRAW } from '../config.js';
import { T } from '../texts.js';

export class SystemWindow {
  constructor(scene, world, onPick) {
    const objs = [];
    const add = (o) => (objs.push(o.setDepth(32)), o);
    const cx = VIEW.width / 2;
    const cy = VIEW.height / 2;
    const W = U.width;
    const H = U.height;
    const x0 = cx - W / 2;
    const y0 = cy - H / 2;
    add(scene.add.rectangle(cx, cy, VIEW.width, VIEW.height, 0x0a0c18, 0.55).setInteractive());
    const g = add(scene.add.graphics());
    // лента: тень, бумага, перфорация по краям
    g.fillStyle(0x000000, 0.35).fillRect(x0 + 8, y0 + 10, W, H);
    g.fillStyle(U.paper).fillRect(x0, y0, W, H);
    g.lineStyle(2, U.edge).strokeRect(x0, y0, W, H);
    for (let y = y0 + 14; y < y0 + H - 8; y += 18) {
      g.fillStyle(U.edge, 0.5).fillCircle(x0 + 10, y, 3).fillCircle(x0 + W - 10, y, 3);
    }
    const mono = (x, y, s, size, color = U.ink, extra = {}) =>
      add(scene.add.text(x, y, s, { fontFamily: '"Courier New", Courier, monospace', fontSize: `${size}px`, fontStyle: 'bold', color, ...extra }));
    mono(x0 + 30, y0 + 18, T.system.header, U.small, U.inkBlue);
    add(scene.add.text(x0 + W - 30, y0 + 16, T.system.headerKo, { fontFamily: DRAW.stamp.koFont, fontSize: `${U.small + 2}px`, fontStyle: 'bold', color: U.inkBlue }).setOrigin(1, 0));
    g.lineStyle(1, U.edge, 0.7).lineBetween(x0 + 24, y0 + 46, x0 + W - 24, y0 + 46);
    mono(cx, y0 + 66, T.system.levelUp(world.heroLevel - world.pendingLevels + 1), U.title, U.ink).setOrigin(0.5, 0);
    mono(cx, y0 + 66 + U.title + 10, T.system.choose, U.small, U.inkBlue).setOrigin(0.5, 0);

    // карточки
    const n = world.offer.length;
    const cw = U.cardW;
    const ch = U.cardH;
    const gap = (W - 60 - n * cw) / Math.max(1, n - 1);
    const cy0 = y0 + H - ch - 28;
    world.offer.forEach((id, i) => {
      const p = SYSTEM.perks[id];
      const info = T.system.perks[id];
      const x = x0 + 30 + i * (cw + gap);
      const card = add(scene.add.graphics());
      const draw = (hot) => {
        card.clear();
        card.fillStyle(0x000000, 0.2).fillRoundedRect(x + 3, cy0 + 4, cw, ch, 8);
        card.fillStyle(hot ? U.cardHot : U.card).fillRoundedRect(x, cy0, cw, ch, 8);
        card.lineStyle(2, hot ? U.inkBlueHex : U.edge).strokeRoundedRect(x, cy0, cw, ch, 8);
      };
      draw(false);
      // портрет того, чей навык
      const tex = `portrait_${p.who}`;
      if (scene.textures.exists(tex)) add(scene.add.image(x + 12, cy0 + 12, tex).setOrigin(0).setDisplaySize(U.portrait, U.portrait));
      mono(x + 20 + U.portrait, cy0 + 14, T.speakers[p.who].split(' ').slice(-2).join(' '), U.small - 4, U.inkBlue, { wordWrap: { width: cw - U.portrait - 28 } });
      const lvl = world.perks[id] || 0;
      mono(x + 20 + U.portrait, cy0 + 14 + U.small + 6, T.system.rank(lvl + 1, p.max), U.small - 4, U.ink);
      mono(x + 12, cy0 + 20 + U.portrait, info.name, U.body + 2, U.ink, { wordWrap: { width: cw - 24 } });
      mono(x + 12, cy0 + 20 + U.portrait + U.body + 12, info.text, U.body - 2, U.inkSoft, { wordWrap: { width: cw - 24 }, lineSpacing: 2 });
      const zone = add(scene.add.zone(x + cw / 2, cy0 + ch / 2, cw, ch).setInteractive({ useHandCursor: true }));
      zone.on('pointerover', () => draw(true));
      zone.on('pointerout', () => draw(false));
      zone.on('pointerdown', () => {
        objs.forEach((o) => o.destroy());
        onPick(id);
      });
    });
    this.objs = objs;
  }
}
