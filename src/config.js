// Все числа прототипа — только здесь. В коде чисел баланса и раскладки быть не должно.
// Меняя баланс, оставлять комментарий, какой замер к этому привёл (npm run sim).

// Экран: горизонтальный, вписывается в окно целиком (FIT). Мир = экран, камеры нет.
export const VIEW = {
  width: 1280,
  height: 720,
  background: 0x1d241f,
};

// Шаг симуляции — фиксированный, одинаковый в браузере и в Node
export const SIM = {
  dt: 1 / 60,
  maxSteps: 60 * 60 * 15, // предохранитель: забег дольше 15 мин считается зависшим
};

// Цвета примитивов
export const COLORS = {
  gate: 0x8a3fd1,
  gateCore: 0xd9b3ff,
  ground: 0x26302a,
  rock: 0x3a3f3b,
  sea: 0x1c3446,
  shelter: 0x7d8288,
  road: 0x4a4436,
  roadEdge: 0x5d5644,
  truck: 0x3fae4a,
  heli: 0x6f7d4a,
  heliRotor: 0xcfe9f5,
  bullet: 0xfff0a0,
  towerBullet: 0xffc66b,
  goblin: 0x58d64a,
  spearman: 0x2f9e3a,
  berserker: 0xc4432c,
  axe: 0x9aa0a6,
  trench: 0x3b2f22,
  trenchEdge: 0x6b5638,
  mine: 0x2a2a24,
  mineLight: 0xe0452c,
  blast: 0xffa13a,
  spear: 0xd8c08a,
  enemyHurt: 0xffffff,
  survivor: 0xffffff,
  survivorRing: 0xffffff,
  slot: 0xffffff,
  slotAffordable: 0xffe066,
  tower: 0xc9a227,
  towerBroken: 0x5a4a2a,
  wire: 0xb8b8b8,
  hpBar: 0x6fdc5a,
  hpBarBack: 0x000000,
  text: '#f4f0e4',
  textDim: '#a8a89a',
  panel: 0x101410,
};

// Карта уровня 1. Враги выходят из врат справа и идут по дороге к убежищу слева.
const MAP_1 = {
  gate: { x: 1190, y: 190, r: 46 },
  shelter: { x: 80, y: 560, w: 110, h: 90 },
  truck: { x: 150, y: 470 },          // сюда вертолёт сдаёт спасённых
  heliStart: { x: 200, y: 420 },
  // Дорога — ломаная от врат к убежищу
  road: [
    [1190, 190],
    [960, 190],
    [880, 380],
    [560, 380],
    [480, 560],
    [80, 560],
  ],
  roadWidth: 44,
  // Места под постройку. Проволока ложится на дорогу в ближайшей к месту точке.
  // S2 и S3 стоят друг напротив друга через дорогу: проволока в S3 окажется прямо под пушкой в S2.
  slots: [
    { id: 'S1', x: 836, y: 435 },
    { id: 'S2', x: 720, y: 325 },
    { id: 'S3', x: 720, y: 435 },
    { id: 'S4', x: 340, y: 505 },
  ],
  // Где появляются люди, ждущие эвакуации (дома вдоль берега и в сопках)
  survivorSpots: [
    [300, 150], [520, 120], [700, 200], [1080, 330], [1000, 520],
    [760, 640], [560, 660], [260, 380], [1180, 620], [420, 250],
  ],
};

// Вертолёт: управление и инерция взяты из GORKY-67 (PLAYER), пулемёт ослаблен —
// здесь основа обороны постройки, а не вертолёт.
export const HELI = {
  maxSpeed: 320,        // px/с (как в GORKY-67)
  accel: 6,             // 1/с, меньше = больше инерции (как в GORKY-67)
  turnSpeed: 7,         // рад/с
  arriveRadius: 60,     // начинает тормозить ближе этого расстояния до точки касания
  stopRadius: 6,
  rotorSpeed: 40,       // рад/с, только картинка
  capacity: 3,          // сколько людей берёт на борт
  pickupRadius: 34,     // зависнуть над человеком ближе этого — забрать
  dropRadius: 60,       // у грузовика ближе этого — сдать
  gun: {
    damage: 5,
    fireRate: 4,        // выстрелов в секунду
    range: 220,
    bulletSpeed: 900,
  },
};

// Люди: ресурс — спасённые, а не убийства
export const SURVIVORS = {
  startPeople: 4,       // людей на руках в начале (ровно на одну пушку)
  firstAt: 2,           // с — первый появляется сразу
  every: 12,            // с между появлениями (5.5 → 12: при 5.5 у бота к концу копилось 25+ лишних людей)
  maxAlive: 5,          // одновременно ждут не больше
  life: 32,             // с — не забрали, человек пропал
};

// Постройки. Цена — в людях.
export const BUILD = {
  tower: {              // пулемётное гнездо («пушка»)
    cost: 4,
    hp: 160,            // 100 → 160: при 100 копейщики ломали пушку и без проволоки, подвоха не было видно
    range: 200,
    damage: 18,         // 14 → 18 и 1.6 → 2 выстр/с: при старых числах ни один план не проходил волну 3
    fireRate: 2,
    bulletSpeed: 700,
  },
  wire: {               // колючая проволока на дороге
    cost: 2,
    length: 70,         // px вдоль дороги
    hp: 500,            // 160 → 500: проволока рвалась в каждом забеге и не давала прибавки к победам
    slow: 0.35,         // множитель скорости внутри
    damagePerEnemy: 2,  // урон проволоке в секунду от каждого, кто в ней застрял (6 → 2, см. hp)
  },
  trench: {             // окоп вокруг готовой пушки: к ней не подойдёт берсерк
    cost: 2,            // 3 → 2: при 3 бот не успевал окопать пушки до прихода берсерков, 0/30 у всех планов
  },
  mine: {               // мина на дороге: одноразовая, дешёвая
    cost: 1,
    trigger: 14,        // px вдоль дороги — наступил ближе этого, взрыв (первый же, кто пришёл)
    radius: 75,         // радиус взрыва
    damage: 110,        // врагам в радиусе (140 → 110: при 140 шесть мин давали 30/30 с полным убежищем)
    buildingDamage: 70, // своим пушкам и проволоке в радиусе — мина не разбирает, чьё
  },
  menuRadius: 40,       // радиус нажатия по месту постройки
};

// Противники
export const ENEMIES = {
  goblin: {
    hp: 30,
    speed: 72,          // px/с
    radius: 9,
    shelterDamage: 1,
    reach: 0,           // постройки не трогает
  },
  spearman: {
    hp: 95,
    speed: 48,
    radius: 11,
    shelterDamage: 2,
    reach: 62,          // копьё достаёт постройку с дороги, если та ближе этого
    stabDamage: 6,      // урон за удар (11 → 6: при 11 пушки ломались в каждом забеге при любой расстановке)
    stabEvery: 1.2,     // с между ударами; бьёт на ходу, не останавливаясь
  },
  // Орк-берсерк: увидел постройку без окопа — сходит с дороги, бежит к ней и рубит, пока не сломает,
  // потом возвращается на дорогу. Окопанные пушки не трогает — выбирает ближайшую неокопанную постройку,
  // в том числе проволоку.
  berserker: {
    hp: 130,            // 240 → 130: при 240 и 180 уровень 2 не проходился ни одним планом
    speed: 55,          // по дороге
    chargeSpeed: 105,   // бегом к постройке и обратно
    radius: 13,
    shelterDamage: 3,
    reach: 0,           // копья нет
    chargeRange: 150,   // видит постройку не дальше этого от себя
    smashReach: 26,     // бьёт, когда подбежал ближе этого
    smashDamage: 25,    // 40 → 25 (см. hp)
    smashEvery: 1.4,
  },
};

export const SHELTER = {
  hp: 10,
};

// Волны. groups — кто, сколько, с каким интервалом и с какой секунды волны.
// Замер 2026-11-09 (npm run sim, 40 забегов): 0t0w — поражение на волне 2; 1t1w — 0/40; 2t0w — 31/40;
// 2t1w — 39/40 за ~3:24; trap (проволока под пушкой) — 0/40, пушка сломана копейщиками в 40/40.
const WAVES_1 = {
  firstAt: 30,          // с на постройку до первой волны
  breakTime: 25,        // с между волнами
  list: [
    { groups: [
      { type: 'goblin', count: 16, every: 1.2, at: 0 },
      { type: 'spearman', count: 3, every: 4, at: 8 },
    ] },
    { groups: [
      { type: 'goblin', count: 26, every: 0.85, at: 0 },
      { type: 'spearman', count: 9, every: 2.3, at: 5 },
    ] },
    { groups: [
      { type: 'goblin', count: 36, every: 0.66, at: 0 },
      { type: 'spearman', count: 15, every: 1.7, at: 3 },
    ] },
  ],
};

// Бот уровня 1: ?bot=2t1w — сколько пушек (t) и проволок (w), места по порядку из order.
// ?bot=trap — нарочно проволока под пушкой. ?speed=4 — ускорение.
const BOT_1 = {
  order: {
    tower: ['S2', 'S4', 'S1', 'S3'],
    wire: ['S1', 'S3', 'S4', 'S2'],
  },
  sequence: ['tower', 'wire', 'tower', 'tower', 'wire'], // в каком порядке строить, пока не выполнен план
  plans: {
    trap: [{ kind: 'tower', slot: 'S2' }, { kind: 'wire', slot: 'S3' }, { kind: 'tower', slot: 'S4' }],
  },
};

// ---------- Уровень 2 «Окоп» (серия 3) ----------
// Замер 2026-11-09 (40 забегов): 0t0w — поражение на волне 1–2; 3t1w (без окопов) — 0/40, берсерки ломают
// все 3 пушки; 2t1w2e — 32/40, пушки берсерк не тронул ни разу, но проволоку рвёт в 40/40 (подвох:
// окопал пушки — берсерк уходит на проволоку); 3t0w3e — 33/40; 3t1w3e — 30/40. Забег ~3:30.
// Дорога змейкой от врат внизу справа к убежищу вверху слева. Мест под постройку пять.
const MAP_2 = {
  gate: { x: 1190, y: 560, r: 46 },
  shelter: { x: 80, y: 220, w: 110, h: 90 },
  truck: { x: 170, y: 330 },
  heliStart: { x: 230, y: 380 },
  road: [
    [1190, 560],
    [990, 560],
    [910, 300],
    [640, 300],
    [560, 520],
    [330, 520],
    [250, 220],
    [80, 220],
  ],
  roadWidth: 44,
  slots: [
    { id: 'S1', x: 1000, y: 440 },
    { id: 'S2', x: 780, y: 245 },
    { id: 'S3', x: 700, y: 355 },
    { id: 'S4', x: 450, y: 465 },
    { id: 'S5', x: 350, y: 380 },
  ],
  survivorSpots: [
    [420, 120], [640, 150], [880, 140], [1100, 300], [1160, 420],
    [820, 640], [560, 650], [300, 640], [120, 470], [480, 300],
  ],
};

// Людей на уровне 2 появляется чаще: окопы тоже стоят людей (every 12 → 9)
const SURVIVORS_2 = { every: 9 };

const WAVES_2 = {
  firstAt: 30,
  breakTime: 25,
  list: [
    { groups: [
      { type: 'goblin', count: 16, every: 1.2, at: 0 },
      { type: 'spearman', count: 3, every: 4, at: 8 },
      { type: 'berserker', count: 1, every: 1, at: 14 },
    ] },
    { groups: [
      { type: 'goblin', count: 24, every: 0.9, at: 0 },
      { type: 'spearman', count: 7, every: 2.6, at: 5 },
      { type: 'berserker', count: 3, every: 6, at: 8 },
    ] },
    { groups: [
      { type: 'goblin', count: 32, every: 0.7, at: 0 },
      { type: 'spearman', count: 11, every: 2, at: 3 },
      { type: 'berserker', count: 5, every: 5, at: 6 },
    ] },
  ],
};

// Бот уровня 2: ?bot=3t1w2e — 3 пушки, 1 проволока, 2 окопа (окопы — у пушек, по порядку постройки).
const BOT_2 = {
  order: {
    tower: ['S3', 'S4', 'S2', 'S5', 'S1'],
    wire: ['S1', 'S5', 'S2', 'S4', 'S3'],
  },
  sequence: ['tower', 'trench', 'tower', 'trench', 'wire', 'tower', 'trench', 'wire'],
  plans: {},
};

// ---------- Уровень 3 «Мины» (серия 4) ----------
// Замер 2026-11-09 (40 забегов): 0t0w — поражение на волне 1; 3t1w3e (без мин) — 0/40; 3t1w3e4m — 26/40;
// 3t1w3e6m — 37/40 за ~3:45; minetrap (мина под своей пушкой) — 0/40. Забег ~3:45.
// Длинная дорога тремя петлями. Враги идут плотными пачками — мина бьёт по пачке.
const MAP_3 = {
  gate: { x: 1190, y: 140, r: 46 },
  shelter: { x: 80, y: 360, w: 110, h: 90 },
  truck: { x: 170, y: 470 },
  heliStart: { x: 230, y: 460 },
  road: [
    [1190, 140],
    [700, 140],
    [620, 360],
    [980, 360],
    [900, 580],
    [300, 580],
    [220, 360],
    [80, 360],
  ],
  roadWidth: 44,
  slots: [
    { id: 'S1', x: 1000, y: 85 },
    { id: 'S2', x: 820, y: 415 },
    { id: 'S3', x: 820, y: 305 },
    { id: 'S4', x: 600, y: 525 },
    { id: 'S5', x: 600, y: 635 },
    { id: 'S6', x: 320, y: 470 },
    { id: 'S7', x: 450, y: 635 },
  ],
  survivorSpots: [
    [420, 120], [560, 260], [1100, 260], [1160, 460], [1080, 640],
    [760, 640], [460, 420], [150, 620], [120, 200], [940, 230],
  ],
};

const SURVIVORS_3 = { every: 9 };

const WAVES_3 = {
  firstAt: 30,
  breakTime: 25,
  // Пачки плотнее, чем на уровнях 1–2 (первая версия была проходима без мин: 3t1w3e — 30/30)
  list: [
    { groups: [
      { type: 'goblin', count: 24, every: 0.4, at: 0 },
      { type: 'spearman', count: 6, every: 0.7, at: 10 },
    ] },
    { groups: [
      { type: 'goblin', count: 34, every: 0.35, at: 0 },
      { type: 'spearman', count: 12, every: 0.6, at: 7 },
      { type: 'berserker', count: 3, every: 2, at: 12 },
    ] },
    { groups: [
      { type: 'goblin', count: 44, every: 0.3, at: 0 },
      { type: 'spearman', count: 18, every: 0.5, at: 5 },
      { type: 'berserker', count: 6, every: 1.6, at: 10 },
    ] },
  ],
};

// Бот уровня 3: m — сколько раз положить мину за забег (взорвалась — кладёт следующую, места из order.mine)
const BOT_3 = {
  order: {
    tower: ['S3', 'S4', 'S6', 'S2', 'S5', 'S1'],
    wire: ['S1', 'S2', 'S5'],
    mine: ['S7'],         // S5 не берём: её точка на дороге под пушкой в S4
  },
  sequence: ['tower', 'trench', 'mine', 'tower', 'trench', 'wire', 'mine', 'tower', 'trench', 'mine', 'mine', 'mine', 'mine'],
  plans: {
    // нарочно мина под своей пушкой: место S2 через дорогу от пушки в S3
    minetrap: [
      { kind: 'tower', slot: 'S3' }, { kind: 'trench', slot: 'S3' }, { kind: 'mine', slot: 'S2' },
      { kind: 'tower', slot: 'S4' }, { kind: 'trench', slot: 'S4' }, { kind: 'mine', slot: 'S2' },
      { kind: 'tower', slot: 'S6' }, { kind: 'trench', slot: 'S6' }, { kind: 'mine', slot: 'S2' }, { kind: 'mine', slot: 'S2' },
    ],
  },
};

// Уровни идут слева направо по побережью. builds — что можно строить на уровне.
export const LEVELS = [
  { id: 1, title: 'Серия 2 · Проволока', map: MAP_1, waves: WAVES_1, builds: ['tower', 'wire'], bot: BOT_1 },
  { id: 2, title: 'Серия 3 · Окоп', map: MAP_2, waves: WAVES_2, survivors: SURVIVORS_2, builds: ['tower', 'wire', 'trench'], bot: BOT_2 },
  { id: 3, title: 'Серия 4 · Мины', map: MAP_3, waves: WAVES_3, survivors: SURVIVORS_3, builds: ['tower', 'wire', 'trench', 'mine'], bot: BOT_3 },
];

// Общее для бота на всех уровнях
export const BOT = {
  guardOffset: 70,      // где бот висит в бою: чуть впереди головного врага по дороге
};

// Радио: плашка сверху с портретом говорящего. Реплики встают в очередь.
export const RADIO = {
  show: 3.8,            // с на экране одна реплика
  gap: 0.35,            // с паузы между репликами
  maxQueue: 3,          // больше в очереди не копим — старые события уже не к месту
  y: 56,                // верх плашки
  width: 780,
  height: 116,
  portrait: 98,         // сторона квадрата с портретом
  pad: 8,
  alpha: 0.78,          // фон полупрозрачный: на уровне 3 под плашкой проходит дорога
  slide: 0.2,           // с — выезд и уезд
  nameSize: 20,
  textSize: 26,         // 20 → 26, см. DRAW.fontSize
};

// Говорящие: цвета портретов-заглушек (позже — арт из библии образов)
export const SPEAKERS = {
  sergeant: { bg: 0x3c4a2c, skin: 0xd9b48f, hair: 0x231c16, name: '#c8d48a', headset: true },
  medic: { bg: 0x4a3434, skin: 0xe2bf9c, hair: 0x2a1d17, name: '#f0a8a0', headset: true, cross: true, longHair: true },
  institute: { bg: 0x2c3a4a, skin: 0xcfae8c, hair: 0x6b6a66, name: '#9ec3e6', glasses: true },
};

export const RUNS_KEY = 'wonsan67.runs';
export const PROGRESS_KEY = 'wonsan67.progress';

// Экран карты: серии вдоль побережья слева направо (только картинка)
export const WORLD_MAP = {
  coastY: 470,          // линия берега; ниже — море
  marginX: 220,         // отступ первой и последней серии от краёв
  nodeY: [360, 300, 380], // высота кружка каждой серии над берегом (по порядку)
  nodeRadius: 46,
  roadDash: 14,
  titleSize: 64,
  nodeFont: 40,
  labelFont: 26,
};

// Размеры отрисовки (только картинка, на правила не влияют)
export const DRAW = {
  slotRadius: 22,
  towerSize: 26,
  barrel: 22,
  trenchRadius: 24,
  trenchWidth: 8,
  mineRadius: 7,
  heliLength: 60,
  heliWidth: 16,
  rotorRadius: 34,
  shadowOffset: 14,
  survivorRadius: 6,
  survivorRing: 16,
  bulletRadius: 2.5,
  wireWidth: 34,
  hpBarW: 28,
  hpBarH: 4,
  menuW: 230,           // 170×40 → 230×52: на телефоне лёжа (812×375) игра ужимается вдвое
  menuH: 52,
  menuGap: 8,
  fontSize: 26,         // 20 → 26: на телефоне лёжа выходило ~10 px
  resultTitle: 44,
  resultW: 1060,
  resultH: 500,
  resultBody: 24,
  resultButton: 30,
  hudPad: 14,
  fxTime: 0.35,         // с — вспышки попаданий и смертей
  gatePulse: 2.5,       // рад/с
  resultRestartDelay: 2.5, // с — бот с ?runs=N перезапускает забег сам
};
