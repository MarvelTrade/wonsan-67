// Твины интерфейса (план фазы 2): панели выезжают, а не появляются. Только картинка.
import { VIEW, BUTTON as B } from '../config.js';

// Всё, что сцена добавила после снимка `before` (Set прежних объектов), — выезжает снизу и проявляется.
// Затемнения во весь экран только проявляются (их сдвиг был бы виден краем).
export function slideInSince(scene, before) {
  const fresh = scene.children.list.filter((o) => !before.has(o));
  for (const o of fresh) {
    const alpha = o.alpha ?? 1;
    const full = (o.width ?? 0) >= VIEW.width;
    o.setAlpha?.(0);
    if (!full) o.y += B.slideDy;
    scene.tweens.add({
      targets: o,
      alpha,
      ...(full ? {} : { y: o.y - B.slideDy }),
      duration: B.slideTime,
      ease: full ? 'Quad.easeOut' : 'Back.easeOut',
    });
  }
  return fresh;
}

export const snapshot = (scene) => new Set(scene.children.list);
