// Радио: плашка сверху — портрет, имя, реплика. Очередь, каждая реплика не больше раза за забег.
import { VIEW, RADIO, SPEAKERS, COLORS } from '../config.js';
import { T } from '../texts.js';

export class Radio {
  constructor(scene) {
    this.scene = scene;
    this.queue = [];
    this.said = new Set();
    this.current = null; // { key, t } — сколько уже показана
    this.pause = 0;

    const W = RADIO.width;
    const H = RADIO.height;
    this.box = scene.add.container(VIEW.width / 2 - W / 2, -H - 10).setDepth(15);
    const bg = scene.add.graphics();
    bg.fillStyle(COLORS.panel, RADIO.alpha).fillRoundedRect(0, 0, W, H, 10);
    bg.lineStyle(2, 0x6b7a5a, 0.8).strokeRoundedRect(0, 0, W, H, 10);
    this.portrait = scene.add.graphics();
    const textX = RADIO.pad * 2 + RADIO.portrait;
    this.name = scene.add.text(textX, RADIO.pad + 2, '', {
      fontFamily: 'Arial, sans-serif', fontSize: `${RADIO.nameSize}px`, fontStyle: 'bold',
    });
    this.line = scene.add.text(textX, RADIO.pad + RADIO.nameSize + 8, '', {
      fontFamily: 'Arial, sans-serif', fontSize: `${RADIO.textSize}px`, color: COLORS.text,
      wordWrap: { width: W - textX - RADIO.pad * 2 }, lineSpacing: 2,
    });
    // «Помехи» — короткие штрихи справа, мигают, пока идёт реплика
    this.noise = scene.add.graphics();
    this.box.add([bg, this.portrait, this.name, this.line, this.noise]);
  }

  // Поставить реплику в очередь (если есть и ещё не звучала)
  say(key) {
    if (!T.radio[key] || this.said.has(key)) return;
    this.said.add(key);
    this.queue.push(key);
    if (this.queue.length > RADIO.maxQueue) this.queue.shift();
  }

  // Замолчать и убрать плашку (экран итогов)
  stop() {
    this.queue = [];
    this.current = null;
    this.box.y = -RADIO.height - 10;
    this.stopped = true;
  }

  update(dt) {
    if (this.stopped) return;
    const hiddenY = -RADIO.height - 10;
    if (!this.current) {
      this.pause -= dt;
      if (this.pause > 0 || !this.queue.length) return;
      this.show(this.queue.shift());
    }
    const c = this.current;
    c.t += dt;
    // выезд, показ, уезд
    const k = Math.min(1, c.t / RADIO.slide, (RADIO.show - c.t) / RADIO.slide);
    this.box.y = hiddenY + (RADIO.y - hiddenY) * Math.max(0, k);
    this.noise.clear();
    if (Math.floor(c.t * 12) % 2) {
      this.noise.lineStyle(2, 0x9aa88a, 0.5);
      for (let i = 0; i < 3; i++) {
        const x = RADIO.width - 18 - i * 7;
        this.noise.lineBetween(x, RADIO.height / 2 - 4 - i * 4, x, RADIO.height / 2 + 4 + i * 4);
      }
    }
    if (c.t >= RADIO.show) {
      this.current = null;
      this.pause = RADIO.gap;
      this.box.y = hiddenY;
    }
  }

  show(key) {
    const [who, text] = T.radio[key];
    const sp = SPEAKERS[who];
    this.current = { key, t: 0 };
    this.name.setText(T.speakers[who]).setColor(sp.name);
    this.line.setText(text);
    this.drawPortrait(sp);
  }

  // Портрет-заглушка из примитивов: плечи, голова, волосы, гарнитура / очки / крест
  drawPortrait(sp) {
    const g = this.portrait;
    const s = RADIO.portrait;
    const x = RADIO.pad;
    const y = RADIO.pad;
    const cx = x + s / 2;
    g.clear();
    g.fillStyle(sp.bg).fillRoundedRect(x, y, s, s, 6);
    // плечи — гимнастёрка
    g.fillStyle(0x4a5233).fillRoundedRect(x + s * 0.12, y + s * 0.72, s * 0.76, s * 0.4, { tl: 14, tr: 14, bl: 0, br: 0 });
    if (sp.longHair) g.fillStyle(sp.hair).fillCircle(cx + s * 0.2, y + s * 0.42, s * 0.14); // пучок
    // голова
    g.fillStyle(sp.skin).fillCircle(cx, y + s * 0.44, s * 0.22);
    // волосы — шапка сверху
    g.fillStyle(sp.hair).slice(cx, y + s * 0.44, s * 0.23, Math.PI, 0, false).fillPath();
    if (sp.longHair) g.fillStyle(sp.hair).fillRect(cx - s * 0.23, y + s * 0.42, s * 0.07, s * 0.16);
    // глаза
    g.fillStyle(0x1a1410).fillCircle(cx - s * 0.08, y + s * 0.47, s * 0.025).fillCircle(cx + s * 0.08, y + s * 0.47, s * 0.025);
    if (sp.glasses) {
      g.lineStyle(2, 0x1a1410).strokeCircle(cx - s * 0.08, y + s * 0.47, s * 0.06).strokeCircle(cx + s * 0.08, y + s * 0.47, s * 0.06);
    }
    if (sp.headset) {
      g.lineStyle(3, 0x55603e).beginPath().arc(cx, y + s * 0.44, s * 0.26, Math.PI * 1.05, Math.PI * 1.95, false).strokePath();
      g.fillStyle(0x6d7a4c).fillRoundedRect(cx - s * 0.3, y + s * 0.4, s * 0.1, s * 0.14, 3);
      g.fillRoundedRect(cx + s * 0.2, y + s * 0.4, s * 0.1, s * 0.14, 3);
      g.lineStyle(2, 0x55603e).lineBetween(cx - s * 0.25, y + s * 0.54, cx - s * 0.08, y + s * 0.6);
    }
    if (sp.cross) {
      g.fillStyle(0xffffff).fillRect(cx + s * 0.16, y + s * 0.8, s * 0.14, s * 0.14);
      g.fillStyle(0xd23a2a).fillRect(cx + s * 0.21, y + s * 0.81, s * 0.04, s * 0.12).fillRect(cx + s * 0.17, y + s * 0.85, s * 0.12, s * 0.04);
    }
  }
}
