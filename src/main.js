import * as Phaser from 'phaser';
import { VIEW } from './config.js';
import { GameScene } from './scenes/GameScene.js';
import { MapScene } from './scenes/MapScene.js';
import { CoverScene } from './scenes/CoverScene.js';
import { T } from './texts.js';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: VIEW.width,
  height: VIEW.height,
  backgroundColor: VIEW.background,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 2 },
  scene: [CoverScene, MapScene, GameScene], // обложка тома → карта серий → уровень; ?bot / ?level идут мимо обложки
});

// Подсказка «поверни телефон» — видна только стоя на сенсорном экране (см. index.html)
const rotate = document.createElement('div');
rotate.id = 'rotate';
rotate.textContent = T.rotate;
document.body.appendChild(rotate);

// Контекстное меню и выделение по долгому нажатию в игре не нужны
window.addEventListener('contextmenu', (e) => e.preventDefault());

if (import.meta.env.DEV) window.__game = game;

// ?debug=1 — счётчик FPS в углу страницы (поверх любой сцены): средний за полсекунды и худший кадр.
// Бюджет плана — 60 FPS на среднем телефоне; работает и в сборке, не только в dev.
if (new URLSearchParams(location.search).get('debug') === '1') {
  const fps = document.createElement('div');
  fps.style.cssText = 'position:fixed;left:4px;bottom:4px;z-index:10;padding:2px 6px;font:bold 12px monospace;'
    + 'color:#9bd36e;background:rgba(0,0,0,.65);border-radius:4px;pointer-events:none';
  document.body.appendChild(fps);
  let worst = 0;
  let last = performance.now();
  const tick = (now) => {
    worst = Math.max(worst, now - last);
    last = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  setInterval(() => {
    const f = Math.round(game.loop.actualFps);
    fps.textContent = `FPS ${f} · худший кадр ${Math.round(worst)} мс`;
    fps.style.color = f >= 55 ? '#9bd36e' : f >= 40 ? '#ffd860' : '#ff7a6a';
    worst = 0;
  }, 500);
}
