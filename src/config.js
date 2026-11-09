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
export const MAP = {
  gate: { x: 1190, y: 190, r: 46 },
  shelter: { x: 80, y: 560, w: 110, h: 90 },
  truck: { x: 150, y: 470 },          // сюда вертолёт сдаёт спасённых
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
  startX: 200,
  startY: 420,
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
};

export const SHELTER = {
  hp: 10,
};

// Волны. groups — кто, сколько, с каким интервалом и с какой секунды волны.
// Замер 2026-11-09 (npm run sim, 40 забегов): 0t0w — поражение на волне 2; 1t1w — 0/40; 2t0w — 31/40;
// 2t1w — 39/40 за ~3:24; trap (проволока под пушкой) — 0/40, пушка сломана копейщиками в 40/40.
export const WAVES = {
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

// Бот для замеров: ?bot=2t1w — сколько пушек (t) и проволок (w), по порядку мест из plans.
// ?bot=trap — нарочно проволока под пушкой. ?speed=4 — ускорение.
export const BOT = {
  order: {
    tower: ['S2', 'S4', 'S1', 'S3'],
    wire: ['S1', 'S3', 'S4', 'S2'],
  },
  sequence: ['tower', 'wire', 'tower', 'tower', 'wire'], // в каком порядке строить, пока не выполнен план
  plans: {
    trap: [{ kind: 'tower', slot: 'S2' }, { kind: 'wire', slot: 'S3' }, { kind: 'tower', slot: 'S4' }],
  },
  guardOffset: 70,      // где бот висит в бою: чуть позади головного врага по дороге
};

export const RUNS_KEY = 'wonsan67.runs';

// Размеры отрисовки (только картинка, на правила не влияют)
export const DRAW = {
  slotRadius: 22,
  towerSize: 26,
  barrel: 22,
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
  menuW: 170,
  menuH: 40,
  menuGap: 8,
  fontSize: 20,
  hudPad: 14,
  fxTime: 0.35,         // с — вспышки попаданий и смертей
  gatePulse: 2.5,       // рад/с
  resultRestartDelay: 2.5, // с — бот с ?runs=N перезапускает забег сам
};
