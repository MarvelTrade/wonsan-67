// Радио: плашка сверху — портрет, имя, реплика. Очередь, каждая реплика не больше раза за забег.
import { VIEW, RADIO, SPEAKERS, COLORS } from '../config.js';
import { T } from '../texts.js';

export class Radio {
  constructor(scene) {
    this.scene = scene;
    this.queue = [];
    this.said = new Set();
    this.current = null; // { key, t, full, dur } — сколько уже показана
    this.pause = 0;

    const W = RADIO.width;
    const H = RADIO.height;
    const P = RADIO.pad;
    const S = RADIO.portrait;
    this.box = scene.add.container(RADIO.left, -H - 10).setDepth(15);
    // корпус полевой рации: металлическая рамка, тёмная лицевая панель, винты по углам
    const bg = scene.add.graphics();
    bg.fillStyle(0x000000, 0.35).fillRoundedRect(3, 5, W, H, 12);
    bg.fillStyle(RADIO.caseColor).fillRoundedRect(0, 0, W, H, 12);
    bg.fillStyle(RADIO.caseLight).fillRoundedRect(0, 0, W, 6, { tl: 12, tr: 12, bl: 0, br: 0 });
    bg.fillStyle(RADIO.face, RADIO.alpha).fillRoundedRect(6, 6, W - 12, H - 12, 8);
    for (const [sx, sy] of [[12, 12], [W - 12, 12], [12, H - 12], [W - 12, H - 12]]) {
      bg.fillStyle(RADIO.screw).fillCircle(sx, sy, 3.5);
      bg.lineStyle(1, 0x000000, 0.6).lineBetween(sx - 2.5, sy, sx + 2.5, sy);
    }
    // окошко портрета
    bg.fillStyle(0x0c0f08).fillRect(P - 3, P - 3, S + 6, S + 6);
    this.portrait = scene.add.graphics();
    this.art = scene.add.image(P, P, '__DEFAULT').setOrigin(0).setVisible(false);
    // строки развёртки поверх портрета — «изображение по каналу»
    const scan = scene.add.graphics();
    scan.fillStyle(0x000000, 0.18);
    for (let y = P; y < P + S; y += 3) scan.fillRect(P, y, S, 1);
    scan.lineStyle(2, RADIO.caseLight, 0.9).strokeRect(P - 3, P - 3, S + 6, S + 6);
    const textX = P * 2 + S;
    // нашивка с именем
    this.tape = scene.add.graphics();
    this.name = scene.add.text(textX + 8, P + 2, '', {
      fontFamily: 'Arial, sans-serif', fontSize: `${RADIO.nameSize}px`, fontStyle: 'bold',
    });
    this.line = scene.add.text(textX, P + RADIO.nameSize + 14, '', {
      fontFamily: 'Arial, sans-serif', fontSize: `${RADIO.textSize}px`, color: COLORS.text,
      wordWrap: { width: W - textX - P * 2 - RADIO.noiseSpace }, lineSpacing: 2,
    });
    // огонёк приёма и «звуковая дорожка» справа
    this.noise = scene.add.graphics();
    this.box.add([bg, this.portrait, this.art, scan, this.tape, this.name, this.line, this.noise]);
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
    const k = Math.min(1, c.t / RADIO.slide, (c.dur - c.t) / RADIO.slide);
    this.box.y = hiddenY + (RADIO.y - hiddenY) * Math.max(0, k);
    // текст печатается по буквам
    const shown = Math.min(c.full.length, Math.floor(c.t * RADIO.cps));
    if (shown !== c.shown) {
      c.shown = shown;
      this.line.setText(c.full.slice(0, shown));
    }
    const talking = shown < c.full.length;
    // огонёк и дорожка
    const g = this.noise;
    g.clear();
    const lx = RADIO.width - 22;
    g.fillStyle(talking && Math.floor(c.t * 8) % 2 ? RADIO.ledOn : RADIO.ledOff).fillCircle(lx, 20, 5);
    for (let i = 0; i < 5; i++) {
      const h = talking ? 4 + Math.abs(Math.sin(c.t * 17 + i * 1.9)) * 22 : 3;
      g.fillStyle(RADIO.wave, 0.85).fillRect(lx - 10 + i * 5, RADIO.height / 2 + 12 - h / 2, 3, h);
    }
    if (c.t >= c.dur) {
      this.current = null;
      this.pause = RADIO.gap;
      this.box.y = hiddenY;
    }
  }

  show(key) {
    const [who, text] = T.radio[key];
    const sp = SPEAKERS[who];
    // заранее раскладываем текст по строкам, чтобы при печати слова не прыгали
    const full = this.line.getWrappedText(text).join('\n');
    const dur = Math.max(RADIO.show, full.length / RADIO.cps + RADIO.hold);
    this.current = { key, t: 0, full, dur, shown: -1 };
    this.line.setText('');
    this.name.setText(T.speakers[who]).setColor(sp.name);
    this.tape.clear();
    this.tape.fillStyle(0x0c0f08, 0.8).fillRect(this.name.x - 6, this.name.y - 2, this.name.width + 12, this.name.height + 4);
    this.tape.fillStyle(sp.bg).fillRect(this.name.x - 6, this.name.y - 2, 3, this.name.height + 4);
    const tex = `portrait_${who}`;
    const hasArt = this.scene.textures.exists(tex);
    this.art.setVisible(hasArt);
    if (hasArt) {
      this.art.setTexture(tex).setDisplaySize(RADIO.portrait, RADIO.portrait);
      this.portrait.clear();
    } else this.drawPortrait(sp);
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
