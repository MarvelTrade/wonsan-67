// Единая кнопка интерфейса: скруглённый прямоугольник с тенью и текстом. Контейнер, нажатие — onClick.
// kind: 'primary' (жёлтая), 'ok' (зелёная), 'plain' (серая), 'dark' (оливковая, светлый текст)
import { BUTTON as B } from '../config.js';

export function makeButton(scene, x, y, label, kind, onClick, { size = B.font, depth = 21, padX = B.padX, padY = B.padY } = {}) {
  const k = B.kinds[kind] || B.kinds.plain;
  const text = scene.add.text(0, 0, label, { fontFamily: 'Arial, sans-serif', fontSize: `${size}px`, fontStyle: 'bold', color: k.text })
    .setOrigin(0.5);
  const w = Math.max(B.minW, text.width + padX * 2);
  const h = text.height + padY * 2;
  const g = scene.add.graphics();
  const draw = (pressed) => {
    g.clear();
    const dy = pressed ? 2 : 0;
    if (!pressed) g.fillStyle(0x000000, 0.35).fillRoundedRect(-w / 2 + 2, -h / 2 + 4, w, h, B.radius);
    g.fillStyle(k.edge).fillRoundedRect(-w / 2, -h / 2 + dy, w, h, B.radius);
    g.fillStyle(k.fill).fillRoundedRect(-w / 2 + 2, -h / 2 + 2 + dy, w - 4, h - 6, B.radius - 2);
    text.setY(dy - 1);
  };
  draw(false);
  const box = scene.add.container(x, y, [g, text]).setDepth(depth).setSize(w, h).setInteractive({ useHandCursor: true });
  box.on('pointerdown', () => draw(true));
  box.on('pointerout', () => draw(false));
  box.on('pointerup', () => {
    draw(false);
    onClick();
  });
  box.label = text;
  return box;
}
