// Подсказки первого запуска (план фазы 1): без текстовых стен — палец и два слова.
// 1) «Веди пальцем»: палец скользит от вертолёта к ближайшему человеку на крыше. Пропадает, когда игрок повёл сам.
// 2) «Тапни по кругу»: палец стучит по месту постройки, по нему расходится круг. Пропадает, когда открыли меню.
// Каждая — один раз (progress.seen: 'tut:drag', 'tut:tap'). Боту не показываются.
import { DRAW, TUTORIAL as U, BUILD } from '../config.js';
import { T } from '../texts.js';
import { wasSeen, markSeen } from '../progress.js';

export class Tutorial {
  constructor(scene) {
    this.scene = scene;
    this.step = !wasSeen('tut:drag') ? 'drag' : !wasSeen('tut:tap') ? 'tap' : null;
    this.g = scene.add.graphics().setDepth(9.5);
    this.label = scene.add.text(0, 0, '', {
      fontFamily: 'Arial, sans-serif', fontSize: `${U.labelSize}px`, fontStyle: 'bold', color: '#f4f0e4',
      stroke: '#14101c', strokeThickness: 6,
    }).setOrigin(0.5, 1).setDepth(9.6).setVisible(false);
    this.t = 0;
  }

  get active() {
    return !!this.step;
  }

  // игрок сделал то, чему учили
  done(step) {
    if (this.step !== step) return;
    markSeen(`tut:${step}`);
    this.step = step === 'drag' && !wasSeen('tut:tap') ? 'tap' : null;
    this.t = 0;
    if (!this.step) {
      this.g.clear();
      this.label.setVisible(false);
    }
  }

  update(dt, world, hidden) {
    const g = this.g;
    g.clear();
    this.label.setVisible(false);
    if (!this.step || hidden) return;
    this.t += dt;
    if (this.step === 'drag') this.drawDrag(world);
    else this.drawTap(world);
  }

  drawDrag(world) {
    const h = world.heli;
    // ближайший человек на крыше; нет — ждём, ничего не рисуем
    let to = null;
    let best = Infinity;
    for (const s of world.survivors) {
      const d = Math.hypot(s.x - h.x, s.y - h.y);
      if (d < best) {
        best = d;
        to = s;
      }
    }
    if (!to) return;
    const g = this.g;
    // пунктир со стрелкой: куда вести
    const dx = to.x - h.x;
    const dy = to.y - h.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    g.lineStyle(4, U.color, 0.75);
    for (let s = 30; s < len - 30; s += 22) g.lineBetween(h.x + ux * s, h.y + uy * s, h.x + ux * Math.min(s + 12, len - 30), h.y + uy * Math.min(s + 12, len - 30));
    const ax = to.x - ux * 30;
    const ay = to.y - uy * 30;
    g.fillStyle(U.color, 0.9).fillTriangle(ax + ux * 14, ay + uy * 14, ax - uy * 10, ay + ux * 10, ax + uy * 10, ay - ux * 10);
    // палец едет от вертолёта к человеку и возвращается в начало
    const k = (this.t % U.dragLoop) / U.dragLoop;
    const e = k < 0.15 ? 0 : Math.min(1, (k - 0.15) / 0.7);
    const fx = h.x + dx * e * 0.92;
    const fy = h.y + dy * e * 0.92;
    this.finger(fx, fy, k < 0.15 ? 1 - k / 0.15 : 0);
    this.label.setText(T.tutorial.drag).setPosition(h.x, h.y - U.labelLift).setVisible(true);
  }

  drawTap(world) {
    // место: первое по порядку бота (удачное), на которое хватает людей
    const scene = this.scene;
    const order = world.level.bot?.order?.tower || [];
    const free = world.slots.filter((s) => !s.building && scene.menuKinds(s).length);
    const can = free.filter((s) => world.people >= Math.min(...scene.menuKinds(s).map((k) => BUILD[k].cost)));
    const slot = order.map((id) => can.find((s) => s.id === id)).find(Boolean) || can[0];
    if (!slot) return;
    const g = this.g;
    const k = (this.t % U.tapLoop) / U.tapLoop;
    const pr = DRAW.slotRadius;
    // круг расходится от места
    g.lineStyle(4, U.color, 0.9 * (1 - k)).strokeEllipse(slot.x, slot.y, pr * 2 * (1 + k * 1.2), pr * 2 * DRAW.padSquash * (1 + k * 1.2));
    // палец опускается и нажимает
    const press = k < 0.3 ? 0 : k < 0.45 ? (k - 0.3) / 0.15 : 1;
    this.finger(slot.x + 6, slot.y + 4 - (1 - press) * 26, press);
    this.label.setText(T.tutorial.tap).setPosition(slot.x, slot.y - pr - U.labelLift * 0.6).setVisible(true);
  }

  // палец: подушечка с ногтем и ладонь-«черенок», под подушечкой — кружок нажатия
  finger(x, y, press) {
    const g = this.g;
    const r = U.finger;
    if (press > 0) g.fillStyle(U.color, 0.35 * press).fillCircle(x, y, r * 1.6);
    g.fillStyle(0x14101c, 0.35).fillRoundedRect(x - r * 0.75 + 3, y + 3, r * 1.5, r * 3.2, r * 0.7);
    g.fillStyle(0xf4e6d6).fillRoundedRect(x - r * 0.75, y, r * 1.5, r * 3.2, r * 0.7);
    g.lineStyle(3, 0x14101c, 0.9).strokeRoundedRect(x - r * 0.75, y, r * 1.5, r * 3.2, r * 0.7);
    g.fillStyle(0xffffff, 0.8).fillRoundedRect(x - r * 0.4, y + r * 0.25, r * 0.8, r * 0.7, r * 0.25);
  }
}
