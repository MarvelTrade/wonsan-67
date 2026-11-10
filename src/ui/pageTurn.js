// Переворот страницы манхвы: следующая сцена запускается под текущей, текущая уходит влево (окно камеры
// сужается), у уходящего края — тень и светлый край бумаги. Обложка → оглавление, оглавление → глава.
import { VIEW, COVER } from '../config.js';

export function turnPage(scene, nextKey, data) {
  if (scene._turning) return;
  scene._turning = true;
  scene.input.enabled = false;
  scene.scene.launch(nextKey, data);
  scene.scene.bringToTop();
  const cam = scene.cameras.main;
  const edge = scene.add.graphics().setDepth(1000).setScrollFactor(0);
  const W = VIEW.width;
  const H = VIEW.height;
  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: COVER.turn * 1000,
    ease: 'Cubic.easeIn',
    onUpdate: (tw) => {
      const k = tw.getValue();
      const w = Math.max(1, Math.round(W * (1 - k)));
      cam.setViewport(0, 0, w, H);
      edge.clear();
      const s = 30 + 90 * Math.sin(k * Math.PI);
      edge.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0.55, 0, 0.55);
      edge.fillRect(w - s, 0, s, H);
      edge.fillStyle(0xf2ede2, 0.95).fillRect(w - 4, 0, 4, H);
    },
    onComplete: () => scene.scene.stop(),
  });
}
