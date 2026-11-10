// HUD: плашки со значками. Верх слева: убежище (с полоской прочности), люди, места на борту;
// под ними — волна с отметками пройденных волн и таймером. Убежище мигает красным, когда его бьют.
import { VIEW, HUD as H, HELI } from '../config.js';
import { T } from '../texts.js';

export class Hud {
  constructor(scene) {
    this.scene = scene;
    this.g = scene.add.graphics().setDepth(14);
    const style = { fontFamily: 'Arial, sans-serif', fontSize: `${H.font}px`, fontStyle: 'bold', color: H.text };
    this.tShelter = scene.add.text(0, 0, '', style).setDepth(15).setOrigin(0, 0.5);
    this.tPeople = scene.add.text(0, 0, '', style).setDepth(15).setOrigin(0, 0.5);
    this.tBoard = scene.add.text(0, 0, '', style).setDepth(15).setOrigin(0, 0.5);
    this.tWave = scene.add.text(0, 0, '', { ...style, fontSize: `${H.font * 0.85}px` }).setDepth(15).setOrigin(0, 0.5);
    this.tLevel = scene.add.text(0, 0, '', { ...style, fontSize: `${H.font * 0.8}px`, color: '#9ad8ff' }).setDepth(15).setOrigin(0, 0.5);
    this.prevHp = null;
    this.flash = 0;
  }

  update(world, dt) {
    const g = this.g;
    g.clear();
    const hp = world.shelter.hp;
    if (this.prevHp !== null && hp < this.prevHp) this.flash = H.flashTime;
    this.prevHp = hp;
    this.flash = Math.max(0, this.flash - dt);

    // ряд 1: убежище · люди · на борту
    const y1 = H.margin + H.chipH / 2;
    let x = H.margin;
    x = this.chip(x, y1, this.tShelter, `${hp}/${world.shelter.maxHp}`, (cx, cy) => this.iconShelter(cx, cy, hp <= H.lowHp), this.flash > 0 ? H.alert : null, () => {
      // полоска прочности под цифрами — по делению на единицу
      const w = this.tShelter.width;
      const seg = w / world.shelter.maxHp;
      for (let i = 0; i < world.shelter.maxHp; i++) {
        g.fillStyle(i < hp ? (hp <= H.lowHp ? H.alert : H.ok) : H.empty).fillRect(this.tShelter.x + i * seg, y1 + H.chipH / 2 - 9, seg - 2, 4);
      }
    });
    x = this.chip(x + H.gap, y1, this.tPeople, String(world.people), (cx, cy) => this.iconPerson(cx, cy));
    this.chip(x + H.gap, y1, this.tBoard, `${world.heli.carrying}/${world.heliCapacity}`, (cx, cy) => this.iconHeli(cx, cy));

    // ряд 2: волна — отметки и таймер
    const y2 = H.margin + H.chipH + H.gap + H.chipH * 0.42;
    const wave = world.wave;
    const total = world.waves.list.length;
    const n = Math.min(world.waveNumber, total);
    const status = world.over ? '' : wave.phase === 'wave' ? T.waveOn : T.waveIn(Math.ceil(wave.timer));
    this.tWave.setText(`${T.wave(n, total)}${status ? ` · ${status}` : ''}`);
    const pipsW = total * 16;
    const w2 = H.pad * 2 + pipsW + 8 + this.tWave.width;
    const h2 = H.chipH * 0.84;
    this.box(H.margin, y2 - h2 / 2, w2, h2, wave.phase === 'wave' ? H.waveOn : null);
    for (let i = 0; i < total; i++) {
      const done = i < wave.index || (i === wave.index && wave.phase !== 'wave' && wave.index >= 0);
      const cur = i === wave.index && wave.phase === 'wave';
      g.fillStyle(done ? H.ok : cur ? H.waveOn : H.empty).fillCircle(H.margin + H.pad + 6 + i * 16, y2, cur ? 6 : 5);
    }
    this.tWave.setPosition(H.margin + H.pad + pipsW + 8, y2);

    // уровень героя («система») и полоска опыта до следующего
    // своей строкой под волной: справа сверху висит радио
    const lx = H.margin;
    const y3 = y2 + h2 + H.gap;
    this.tLevel.setText(T.level(world.heroLevel));
    const lw = H.pad * 2 + Math.max(this.tLevel.width, 56);
    this.box(lx, y3 - h2 / 2, lw, h2, world.pendingLevels > 0 ? H.levelUp : null);
    this.tLevel.setPosition(lx + H.pad, y3 - 4);
    g.fillStyle(H.empty).fillRect(lx + H.pad, y3 + h2 / 2 - 9, lw - H.pad * 2, 4);
    g.fillStyle(H.xp).fillRect(lx + H.pad, y3 + h2 / 2 - 9, (lw - H.pad * 2) * world.xpProgress, 4);
  }

  // плашка: фон, значок, текст; extra — дорисовать поверх (полоска убежища)
  chip(x, y, text, value, icon, tint = null, extra = null) {
    text.setText(value);
    const w = H.pad * 2 + H.icon + 8 + text.width;
    this.box(x, y - H.chipH / 2, w, H.chipH, tint);
    icon(x + H.pad + H.icon / 2, y);
    text.setPosition(x + H.pad + H.icon + 8, y - (extra ? 3 : 0));
    if (extra) extra();
    return x + w;
  }

  box(x, y, w, h, tint) {
    const g = this.g;
    g.fillStyle(0x000000, 0.35).fillRoundedRect(x + 2, y + 3, w, h, H.radius);
    g.fillStyle(tint || H.fill, tint ? 0.9 : H.alpha).fillRoundedRect(x, y, w, h, H.radius);
    g.lineStyle(2, H.edge, 0.9).strokeRoundedRect(x, y, w, h, H.radius);
  }

  iconShelter(x, y, low) {
    const g = this.g;
    const s = H.icon;
    g.fillStyle(low ? H.alert : 0x9a9a92).fillRect(x - s / 2, y - s * 0.3, s, s * 0.6);
    g.fillStyle(0xb8b8b0).fillRect(x - s / 2, y - s * 0.3, s, 4);
    g.fillStyle(0x15130f).fillRect(x - 4, y - 2, 8, s * 0.3);
    g.fillStyle(0xa8946a).fillEllipse(x - s * 0.35, y - s * 0.36, 9, 6).fillEllipse(x, y - s * 0.38, 9, 6).fillEllipse(x + s * 0.35, y - s * 0.36, 9, 6);
  }

  iconPerson(x, y) {
    const g = this.g;
    g.fillStyle(0xf4f0e4).fillCircle(x, y - 6, 5);
    g.fillStyle(0xf4f0e4).fillEllipse(x, y + 7, 16, 11);
  }

  iconHeli(x, y) {
    const g = this.g;
    g.fillStyle(0xc8d48a).fillEllipse(x + 2, y, 18, 9);
    g.lineStyle(3, 0xc8d48a).lineBetween(x - 6, y, x - 14, y);
    g.lineStyle(2, 0xf4f0e4, 0.8).lineBetween(x - 10 + 2, y - 10, x + 12, y + 10).lineBetween(x - 8, y + 10, x + 12, y - 10);
  }
}
