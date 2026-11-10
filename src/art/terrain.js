// Статичный фон уровня, рисуется один раз: трава с пятнами, берег с пеной, грунтовая дорога с колеями,
// а дома (у мест, где ждут люди) и деревья (вдали от дороги) только расставляет — их рисуют спрайты.
// Возвращает { houses: [{x, y, kind, flip}], trees: [{x, y, kind}] }. Раскладка детерминирована (seed = уровень).
import { VIEW, TERRAIN as P, DRAW } from '../config.js';
import { rng } from '../sim/path.js';

export function drawTerrain(g, world) {
  const map = world.map;
  const path = world.path;
  const rand = rng(P.seed + world.level.id * 101);
  const R = (a, b) => a + rand() * (b - a);
  const seaTop = VIEW.height - P.seaH;

  // земля и пятна (сухая трава, тень от сопок)
  g.fillStyle(P.grass).fillRect(0, 0, VIEW.width, VIEW.height);
  for (let i = 0; i < P.patches; i++) {
    g.fillStyle(rand() < 0.5 ? P.grassDark : P.grassDry, R(0.12, 0.3));
    g.fillEllipse(R(0, VIEW.width), R(0, seaTop), R(60, 220), R(30, 110));
  }
  // мелкая трава — штрихи
  g.lineStyle(1, P.grassLight, 0.35);
  for (let i = 0; i < P.tufts; i++) {
    const x = R(0, VIEW.width);
    const y = R(0, seaTop - 10);
    g.lineBetween(x, y, x + R(-3, 3), y - R(3, 7));
  }

  // берег: песок, море, волны, пена
  const shore = [];
  for (let x = 0; x <= VIEW.width; x += 40) shore.push({ x, y: seaTop + Math.sin(x / 90) * 6 + R(-3, 3) });
  g.fillStyle(P.sand).fillPoints([{ x: 0, y: VIEW.height }, ...shore.map((p) => ({ x: p.x, y: p.y - 12 })), { x: VIEW.width, y: VIEW.height }], true);
  g.fillStyle(P.sea).fillPoints([{ x: 0, y: VIEW.height }, ...shore, { x: VIEW.width, y: VIEW.height }], true);
  g.lineStyle(3, P.foam, 0.8).strokePoints(shore, false);
  g.lineStyle(2, P.seaLight, 0.6);
  for (let i = 0; i < 26; i++) {
    const x = R(0, VIEW.width);
    const y = R(seaTop + 14, VIEW.height - 4);
    g.lineBetween(x, y, x + R(14, 34), y);
  }

  // дорога в 3/4 — насыпь: тень, передний откос (полотно, сдвинутое вниз на высоту насыпи), обочина,
  // верх полотна, светлая кромка сверху, колеи, камни с тенью, лужи с бликом
  const pts = map.road;
  const H = P.roadRise;
  const stroke = (w, color, alpha = 1, dy = 0) => {
    g.lineStyle(w, color, alpha);
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y + dy) : g.moveTo(x, y + dy)));
    g.strokePath();
    for (const [x, y] of pts) g.fillStyle(color, alpha).fillCircle(x, y + dy, w / 2);
  };
  stroke(map.roadWidth + 18, P.roadShoulder, 0.55, H + 2);     // тень насыпи на траве
  stroke(map.roadWidth + 6, P.roadSide, 1, H);                // передний откос
  stroke(map.roadWidth + 6, P.roadEdge, 1, 0);                // бровка
  stroke(map.roadWidth, P.road, 1, 0);                        // полотно
  stroke(map.roadWidth * 0.55, P.roadLight, 0.35, -map.roadWidth * 0.12); // свет на выпуклом верху
  // колеи — две полосы вдоль
  for (const off of [-map.roadWidth * 0.22, map.roadWidth * 0.22]) {
    for (let d = 0; d < path.length; d += 6) {
      const a = path.at(d);
      const b = path.at(d + 4);
      const nx = -(b.y - a.y);
      const ny = b.x - a.x;
      const len = Math.hypot(nx, ny) || 1;
      g.lineStyle(3, P.rut, 0.55).lineBetween(a.x + (nx / len) * off, a.y + (ny / len) * off, b.x + (nx / len) * off, b.y + (ny / len) * off);
    }
  }
  // камни: тень, бок, светлый верх
  for (let i = 0; i < P.stones; i++) {
    const p = path.at(R(0, path.length));
    const x = p.x + R(-18, 18);
    const y = p.y + R(-16, 16);
    const r = R(1.5, 3.2);
    g.fillStyle(0x000000, 0.25).fillEllipse(x + 1, y + r * 0.8, r * 2.4, r * 1.2);
    g.fillStyle(P.stoneDark).fillEllipse(x, y + r * 0.3, r * 2, r * 1.5);
    g.fillStyle(P.stone).fillEllipse(x - r * 0.2, y - r * 0.15, r * 1.6, r * 1.1);
  }
  // лужи — синие с белым бликом (манхва любит блики)
  for (let i = 0; i < P.puddles; i++) {
    const p = path.at(R(40, path.length - 40));
    const x = p.x + R(-10, 10);
    const y = p.y + R(-8, 8);
    const w = R(12, 22);
    g.fillStyle(P.puddle, 0.85).fillEllipse(x, y, w, w * 0.45);
    g.fillStyle(0xffffff, 0.7).fillEllipse(x - w * 0.18, y - w * 0.06, w * 0.35, w * 0.1);
  }

  // что занято: дорога, места построек, люди, убежище, грузовик, врата — там не сажаем деревья
  const clear = (x, y, pad) =>
    path.nearest(x, y).dist > map.roadWidth / 2 + pad &&
    world.slots.every((s) => Math.hypot(s.x - x, s.y - y) > 40 + pad) &&
    map.survivorSpots.every(([sx, sy]) => Math.hypot(sx - x, sy + DRAW.roofH * 0.6 - y) > 56 + pad) &&
    (Math.abs(map.truck.x - x) > DRAW.base.w / 2 + 16 + pad || Math.abs(map.truck.y - y) > DRAW.base.h / 2 + 26 + pad) &&
    Math.hypot(map.gate.x - x, map.gate.y - y) > map.gate.r + 30 + pad &&
    (Math.abs(map.shelter.x - x) > map.shelter.w / 2 + 20 + pad || Math.abs(map.shelter.y - y) > map.shelter.h / 2 + 20 + pad);

  // дома — у каждой точки, где появляются люди (оттуда их и забирают)
  const houses = [];
  for (const [sx, sy] of map.survivorSpots) {
    // дом прямо под точкой: крыша — там, где человек ждёт вертолёт
    houses.push({ x: sx, y: sy + DRAW.roofH, kind: rand() < 0.5 ? 'houseA' : 'houseB', flip: rand() < 0.5 });
  }

  // рощи
  const trees = [];
  let placed = 0;
  for (let tries = 0; tries < 900 && placed < P.trees; tries++) {
    const cx = R(10, VIEW.width - 10);
    const cy = R(30, seaTop - 10);
    if (!clear(cx, cy, 14)) continue;
    const n = 1 + Math.floor(rand() * 3);
    for (let k = 0; k < n; k++) trees.push({ x: cx + R(-18, 18), y: cy + R(-12, 12), kind: rand() < 0.5 ? 'treeA' : 'treeB' });
    placed++;
  }
  return { houses, trees };
}

export function drawHouse(g, x, y, w, h, tiled) {
  g.fillStyle(0x000000, 0.3).fillRect(x + 4, y + 5, w, h);
  g.fillStyle(P.wall).fillRect(x, y, w, h);
  // крыша — два ската сверху: светлый и тёмный
  g.fillStyle(tiled ? P.roofTile : P.roofSlate).fillRect(x - 2, y - 2, w + 4, h / 2 + 2);
  g.fillStyle(tiled ? P.roofTileDark : P.roofSlateDark).fillRect(x - 2, y + h / 2, w + 4, h / 2 + 2);
  g.lineStyle(1, 0x000000, 0.35).strokeRect(x - 2, y - 2, w + 4, h + 4);
  g.lineStyle(1, 0x000000, 0.25).lineBetween(x - 2, y + h / 2, x + w + 2, y + h / 2);
}

export function drawTree(g, x, y, r) {
  g.fillStyle(0x000000, 0.28).fillCircle(x + r * 0.35, y + r * 0.45, r);
  g.fillStyle(P.treeDark).fillCircle(x, y, r);
  g.fillStyle(P.tree).fillCircle(x - r * 0.25, y - r * 0.25, r * 0.7);
  g.fillStyle(P.treeLight, 0.7).fillCircle(x - r * 0.4, y - r * 0.4, r * 0.32);
}
