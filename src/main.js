import * as Phaser from 'phaser';
import { VIEW } from './config.js';
import { GameScene } from './scenes/GameScene.js';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: VIEW.width,
  height: VIEW.height,
  backgroundColor: VIEW.background,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 2 },
  scene: [GameScene],
});

// Контекстное меню и выделение по долгому нажатию в игре не нужны
window.addEventListener('contextmenu', (e) => e.preventDefault());

if (import.meta.env.DEV) window.__game = game;
