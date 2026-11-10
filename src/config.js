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
  sea: 0x3a7aa0,
  shelter: 0x7d8288,
  road: 0xb09670,
  roadEdge: 0x7a6448,
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
  star: 0xffd447,
  soldier: 0x8fa6b8,
  shell: 0xff7a2e,
  abilityReady: 0xd9b3ff,
  abilityCd: 0x4a4a52,
  starEmpty: 0x3a3f36,
  starEdge: 0xc8c0a0,   // контур пустой звезды
  paper: 0xe9dfc4,      // досье
  paperEdge: 0x9c8c66,
  stamp: 0xd0262a,      // штамп «провалено» — ярко-красный
  stampOk: 0x1f9a3a,    // штамп «выполнено» — ярко-зелёный
  ink: '#1e1c16',
  inkRed: '#9a2a22',
};

// Карта уровня 1. Враги выходят из врат справа и идут по дороге к убежищу слева.
const MAP_1 = {
  gate: { x: 1190, y: 190, r: 46 },
  shelter: { x: 80, y: 560, w: 110, h: 90 },
  truck: { x: 150, y: 470 },          // сюда вертолёт сдаёт спасённых
  heliStart: { x: 200, y: 420 },
  abilityCorner: 'right', // кнопки умений справа внизу: слева внизу убежище
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
    [760, 606], [560, 610], [260, 380], [1180, 600], [420, 250],
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
    melee: 6,           // урон в секунду по бойцу подкрепления
  },
  spearman: {
    hp: 95,
    speed: 48,
    radius: 11,
    shelterDamage: 2,
    melee: 10,
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
    melee: 22,
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

// Звёзды за победу — по тому, сколько осталось от убежища
export const STARS = {
  three: 9,             // убежище ≥ 9 из 10 — три звезды
  two: 5,               // ≥ 5 — две, меньше — одна
};

// Умения с перезарядкой. Кнопки слева внизу; нажал кнопку — потом точку на карте.
// Замер 2026-11-10 (бот с +a, 30 забегов): умения помогают, но укреплений не заменяют. Уровень 1: 2t0w 23→27/30,
// trap 0→7/30; уровень 2: без окопов 0/30 и с умениями; уровень 3: без мин 0/30, с минами 30/30, мина под пушкой 0/30.
// Первая версия (залп 130 урона раз в 40 с, бойцы 90 hp на 15 с) проходила уровень 3 вовсе без мин — ослаблено.
export const ABILITIES = {
  artillery: {          // «Артудар института»: залп по точке через delay, бьёт только врагов
    cooldown: 60,
    delay: 1.6,         // с от нажатия до разрывов — надо целиться с упреждением
    radius: 85,
    damage: 80,
  },
  reinforce: {          // «Подкрепление»: двое бойцов у дороги держат её, пока живы
    cooldown: 35,
    count: 2,
    spacing: 16,        // px вдоль дороги между бойцами
    life: 10,           // с, потом их забирают
    hp: 60,
    dps: 14,            // урон бойца в секунду по тому, с кем дерётся
    blockRange: 18,     // враг ближе этого по дороге — остановлен и дерётся
  },
};

// Ядра (жанр: добыча с монстров). Враг роняет фиолетовый кристалл; лежит life с, вертолёт подбирает пролётом
// (место на борту не нужно) — опыт «системы». Замер 2026-11-10 (бот подбирает почти все): при 0.08/0.25 и xp 8
// trap 15/30, уровень 3 без мин 10/30 — слишком легко; сейчас ур.1 1t1w 0/40, 2t1w 38/40, trap 17/40 (пушка сломана
// 40/40), ур.3 3t1w3e без мин 6/30, с минами 30/30.
export const CORES = {
  chance: { goblin: 0.05, spearman: 0.15, berserker: 1 },
  xp: 5,              // опыт за ядро
  life: 14,           // с лежит, потом гаснет
  pickupRadius: 34,   // радиус подбора с вертолёта
  scatter: 14,        // разлёт от места гибели
  // картинка: кристалл висит над землёй и качается, в последние blinkAt с мигает
  size: 10, bob: 3, glow: 22, blinkAt: 3,
  color: 0xb36bff, light: 0xf0d8ff, dark: 0x5a2a9a,
};

// «Система» (жанр манхвы, docs/genre-manhwa.md): опыт за убитых и спасённых, уровень — выбор 1 из 3 усилений.
// who — чей это навык (sergeant — Хан, «проявление оружия»; medic — Юн, «свет лечения»), max — сколько раз можно взять.
export const SYSTEM = {
  xp: { goblin: 1, spearman: 3, berserker: 6, saved: 4 },
  // опыт, с которого начинается уровень 1, 2, … (первая версия 0/18/45/… давала 5–6 уровней за забег: 1t1w 24/30, trap 28/30)
  levels: [0, 40, 100, 190, 310, 460],
  choices: 3,
  perks: {
    caliber: { who: 'sergeant', max: 3, gunDmg: 0.12 },       // урон пушек +12%
    tempo: { who: 'sergeant', max: 3, gunRate: 0.1 },         // скорострельность +10%
    barbs: { who: 'sergeant', max: 2, wireHp: 0.4 },          // прочность проволоки +40%
    sapper: { who: 'sergeant', max: 2, mineDmg: 0.25, needsBuild: 'mine' }, // урон мин +25%
    heal: { who: 'medic', max: 3, shelterHeal: 1 },           // убежище +1 (не выше максимума)
    stretcher: { who: 'medic', max: 2, heliCap: 1 },          // вертолёт берёт на борт +1
    mobilize: { who: 'medic', max: 3, people: 2 },            // сразу +2 человека
    focus: { who: 'medic', max: 2, abilityCd: 0.2, needsAbility: true }, // перезарядка умений −20%
  },
};

// Окно «СИСТЕМА» (src/ui/SystemWindow.js): телетайпная лента. Только картинка.
export const SYS_UI = {
  width: 980, height: 470, cardW: 290, cardH: 270, portrait: 64,
  title: 38, body: 23, small: 20, // на телефоне лёжа всё ужимается вдвое
  paper: 0xdde8ee, edge: 0x7a94a8, card: 0xeef4f6, cardHot: 0xffffff,
  ink: '#16202a', inkSoft: '#3a4a58', inkBlue: '#1e5a8a', inkBlueHex: 0x1e5a8a,
};

// «Вызвать волну раньше»: за каждые perSeconds, оставшиеся до волны, — один человек, не больше maxBonus.
// Бот волны раньше не вызывает — замеры баланса без этого бонуса.
export const CALL_EARLY = {
  perSeconds: 10,
  maxBonus: 2,
};

// Волны. groups — кто, сколько, с каким интервалом и с какой секунды волны.
// Замер 2026-11-09 (npm run sim, 40 забегов): 0t0w — поражение на волне 2; 1t1w — 0/40; 2t0w — 31/40;
// 2t1w — 39/40 за ~3:24; trap (проволока под пушкой) — 0/40, пушка сломана копейщиками в 40/40.
const WAVES_1 = {
  firstAt: 30,          // с на постройку до первой волны
  breakTime: 25,        // с между волнами
  // Замер 2026-11-10 с «системой» (бот берёт усиления по BOT.perkPriority, 40 забегов): 0t0w — поражение на волне 2;
  // 1t1w — 0/40; 2t0w — 34/40; 2t1w — 37/40; trap — 13/40, пушка под проволокой сломана в 40/40.
  // Волны 2–3 тяжелее прежних (26/9 и 36/15): усиления иначе делали проходимым всё, включая trap (28/30).
  list: [
    { groups: [
      { type: 'goblin', count: 16, every: 1.2, at: 0 },
      { type: 'spearman', count: 3, every: 4, at: 8 },
    ] },
    { groups: [
      { type: 'goblin', count: 28, every: 0.82, at: 0 },
      { type: 'spearman', count: 10, every: 2.2, at: 5 },
    ] },
    { groups: [
      { type: 'goblin', count: 38, every: 0.64, at: 0 },
      { type: 'spearman', count: 17, every: 1.6, at: 3 },
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
  abilityCorner: 'left',  // справа внизу врата
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
    [820, 608], [560, 612], [300, 606], [120, 470], [480, 300],
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
  abilityCorner: 'left',
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
    [420, 120], [560, 260], [1100, 260], [1160, 460], [1080, 606],
    [700, 470], [460, 420], [150, 606], [120, 200], [940, 230],
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
  { id: 1, title: 'Серия 2 · Проволока', map: MAP_1, waves: WAVES_1, builds: ['tower', 'wire'], abilities: ['artillery'], bot: BOT_1 },
  { id: 2, title: 'Серия 3 · Окоп', map: MAP_2, waves: WAVES_2, survivors: SURVIVORS_2, builds: ['tower', 'wire', 'trench'], abilities: ['artillery', 'reinforce'], bot: BOT_2 },
  { id: 3, title: 'Серия 4 · Мины', map: MAP_3, waves: WAVES_3, survivors: SURVIVORS_3, builds: ['tower', 'wire', 'trench', 'mine'], abilities: ['artillery', 'reinforce'], bot: BOT_3 },
];

// Общее для бота на всех уровнях
export const BOT = {
  perkPriority: ['caliber', 'tempo', 'mobilize', 'heal', 'stretcher', 'barbs', 'sapper', 'focus'],
  artilleryMin: 4,      // бот с +a: залп, только если под ним будет столько врагов
  reinforceFrom: 0.5,   // подкрепление — когда головной враг прошёл эту долю дороги
  reinforceAhead: 60,   // …и на столько впереди него
  guardOffset: 70,      // где бот висит в бою: чуть впереди головного врага по дороге
  coreDetour: 260,      // людей ждать некого — бот летит за ядром не дальше этого
};

// Радио: плашка сверху с портретом говорящего. Реплики встают в очередь.
export const RADIO = {
  show: 3.8,            // с на экране одна реплика
  gap: 0.35,            // с паузы между репликами
  maxQueue: 3,          // больше в очереди не копим — старые события уже не к месту
  y: 56,                // верх плашки
  left: 340,            // левый край: правее плашек HUD (волна с таймером ~320 px)
  width: 760,
  height: 116,
  portrait: 98,         // сторона квадрата с портретом
  pad: 8,
  noiseSpace: 40,       // px справа под «помехи», текст туда не заходит
  alpha: 0.78,          // фон полупрозрачный: на уровне 3 под плашкой проходит дорога
  slide: 0.2,
  cps: 42,              // букв в секунду — текст печатается
  hold: 2.2,            // с после того, как допечатал
  caseColor: 0x4a5530,  // корпус полевой рации
  caseLight: 0x6e7a4a,
  face: 0x1a2014,
  screw: 0x9a9a88,
  ledOn: 0x9bd36e,
  ledOff: 0x2c3a26,
  wave: 0xc8d48a,           // с — выезд и уезд
  nameSize: 20,
  textSize: 26,         // 20 → 26, см. DRAW.fontSize
};

// Говорящие. art — портрет из public/ (вырезан из обложки 1967 года); нет арта или не загрузился —
// заглушка из примитивов по цветам ниже
export const SPEAKERS = {
  sergeant: { art: 'portraits/sergeant.png', bg: 0x3c4a2c, skin: 0xd9b48f, hair: 0x231c16, name: '#c8d48a', headset: true },
  medic: { art: 'portraits/medic.png', bg: 0x4a3434, skin: 0xe2bf9c, hair: 0x2a1d17, name: '#f0a8a0', headset: true, cross: true, longHair: true },
  institute: { bg: 0x2c3a4a, skin: 0xcfae8c, hair: 0x6b6a66, name: '#9ec3e6', glasses: true },
};

// Досье «Новый враг» / «Новое укрепление» (только картинка)
export const DOSSIER = {
  width: 900,
  height: 430,
  headerH: 84,
  pad: 30,
  picture: 230,
  pictureScale: 2.6,
  title: 38,
  body: 22,
  small: 18,
  button: 28,
};

export const RUNS_KEY = 'wonsan67.runs';
export const PROGRESS_KEY = 'wonsan67.progress';

// Экран карты: серии вдоль побережья слева направо (только картинка)
export const WORLD_MAP = {
  art: 'art/coast.jpg', // фон — верхняя панель первой страницы манхвы, обрезана ниже нарисованного названия
  titleTop: 40,         // название игры: крупно по-корейски, под ним RU · EN
  titleKoSize: 104,
  titleSubSize: 30,
  artNodeY: [575, 535, 590], // с фоном серии стоят внизу, вдоль береговой дороги
  artSubtitleY: 345,
  artShade: 0.65,       // затемнение нижней полосы под подписями
  artShadeTop: 470,
  coastY: 470,          // линия берега; ниже — море
  marginX: 220,         // отступ первой и последней серии от краёв
  nodeY: [360, 300, 380], // высота кружка каждой серии над берегом (по порядку)
  nodeRadius: 46,
  roadDash: 14,
  titleSize: 64,
  nodeFont: 40,
  labelFont: 26,
};

// Фон уровня (src/art/terrain.js): палитра и плотность. Только картинка.
export const TERRAIN = {
  // свет сцены одним градиентом (docs/art-style.md): тёплый закат сверху слева, фиолетовая тень снизу справа
  lightWarm: 0xffa860,
  lightCool: 0x4a3a8a,
  lightAlpha: 0.16,
  gateGlow: 0x9a5ad8,
  seed: 67,
  seaH: 46,
  patches: 70,
  tufts: 900,
  stones: 120,
  trees: 34,
  grass: 0x5d7a4a,
  grassDark: 0x4a6340,
  grassDry: 0x8a8a58,
  grassLight: 0x9ab070,
  sand: 0xe0cfa0,
  sea: 0x22405a,
  seaLight: 0x7ab8d8,
  foam: 0xf4fbff,
  road: 0x6e5c44,
  roadEdge: 0x4e4130,
  roadShoulder: 0x6e7a4a,
  rut: 0x957c5a,
  roadRise: 6,          // px — высота насыпи дороги (передний откос виден в 3/4)
  roadSide: 0x6e5838,   // откос насыпи
  roadLight: 0xd8c4a0,  // светлый верх полотна
  stoneDark: 0x8a8070,
  puddles: 7,
  puddle: 0x6aa0c8,
  stone: 0xc8bca8,
  wall: 0x9a9284,
  roofTile: 0x8a4a38,
  roofTileDark: 0x6a3a2c,
  roofSlate: 0x6c6e70,
  roofSlateDark: 0x515356,
  tree: 0x34502c,
  treeDark: 0x22341e,
  treeLight: 0x5a7a44,
};

// Постройки и техника (src/art/props.js). Только картинка.
export const PROPS = {
  sandbag: 0xa8946a,
  sandbagDark: 0x8c7a56,
  concrete: 0x8a8a84,
  concreteLight: 0xa4a49c,
  concreteDark: 0x6a6a66,
  truckCab: 0x3f5232,
  truckTent: 0x5f6b3e,
  glass: 0x9fc4d4,
  gunBase: 0x4a4636,
  gunMetal: 0x23231f,
  gateDeep: 0x1c0f2c,
};

// Спрайты из Blender (tools/blender/make_sprites.py → public/sprites, тун-шейдинг, ракурс 3/4).
// Отрисованы в двойном разрешении: scale — во сколько раз показать относительно файла.
export const SPRITES = {
  keys: ['goblin', 'spearman', 'berserker', 'civ0', 'civ1', 'civ2', 'soldier', 'heli',
    'houseA', 'houseB', 'treeA', 'treeB', 'bunker', 'truck', 'nest', 'watchtower'],
  scale: 0.5,           // файл в 2×: 0.5 — «логический» размер
  // Масштаб от файла (2×). Пропорции: человек ≈ треть высоты дома, вертолёт ≈ полтора дома, бункер — по убежищу.
  // Было unitScale 0.8 и heli 0.62 — фигуры и вертолёт выходили в 2–3 раза крупнее домов.
  keyScale: {
    goblin: 0.3, spearman: 0.3, berserker: 0.34, soldier: 0.3, civ0: 0.28, civ1: 0.28, civ2: 0.28,
    heli: 0.32, houseA: 0.6, houseB: 0.6, treeA: 0.6, treeB: 0.6, bunker: 0.5, truck: 0.42, nest: 0.42,
    watchtower: 0.42,
  },
  bob: 1.6,             // px — подпрыгивание при ходьбе
  bobSpeed: 11,
  heliShadow: 0.3,
};

// Юниты (src/art/units.js). Только картинка.
export const UNITS = {
  outline: 0x141810,
  eye: 0x101008,
  eyeRed: 0xffd23a,
  goblin: 0x6cc44a,
  goblinEar: 0x4f9a36,
  goblinRag: 0x6b5236,
  spearman: 0x3f8a3a,
  spearHelm: 0x5a5e62,
  spearShaft: 0x9c7a4c,
  spearHead: 0xc8ccd0,
  shield: 0x7a5232,
  shieldBoss: 0xb8b0a0,
  berserker: 0xc4432c,
  berserkerDark: 0x5a2418,
  horn: 0xe8dcc0,
  axeShaft: 0x6a4a2c,
  axeHead: 0x9aa0a6,
  skin: 0xe2bf9c,
  hair: 0x2a1d17,
  cloth: [0x4a6a8a, 0x8a5a3a, 0x6a6a5a, 0x7a3a3a, 0x3a5a4a],
  soldierBody: 0x5a6a3c,
  helmet: 0x4a5a30,
  rifle: 0x23231f,
  heli: 0x5f6b3e,
  heliDark: 0x434d2c,
  heliMark: 0xc23a26,
  glass: 0x9fc4d4,
  rotor: 0xd8e0d0,
};

// HUD (src/ui/Hud.js): плашки со значками. Только картинка.
export const HUD = {
  margin: 10,
  gap: 8,
  chipH: 48,
  pad: 10,
  icon: 26,
  radius: 9,
  font: 26,
  text: '#f4f0e4',
  fill: 0x1c2216,
  alpha: 0.82,
  edge: 0x6b7a5a,
  ok: 0x9bd36e,
  empty: 0x3a3f36,
  alert: 0xc4432c,
  waveOn: 0x6a3a8a,
  xp: 0x9ad8ff,
  levelUp: 0x1e5a8a,
  lowHp: 3,             // убежище ≤ этого — значок и полоска красные
  flashTime: 0.45,      // с — плашка убежища краснеет, когда его бьют
};

// Кнопки интерфейса (src/ui/button.js)
export const BUTTON = {
  font: 28,
  padX: 26,
  padY: 10,
  minW: 150,
  radius: 10,
  kinds: {
    primary: { fill: 0xffd85a, edge: 0xa88a2a, text: '#1e1c16' },
    ok: { fill: 0x9bd36e, edge: 0x5a8a3a, text: '#1e1c16' },
    plain: { fill: 0xd8d4c4, edge: 0x8a8676, text: '#1e1c16' },
    dark: { fill: 0x5a6a3c, edge: 0x34401f, text: '#f4f0e4' },
    gate: { fill: 0xd9b3ff, edge: 0x7a4ab0, text: '#1e1c16' },
  },
};

// Частицы (src/art/particles.js). Только картинка.
export const FX = {
  max: 700,             // больше не держим — старые уходят первыми
  flash: 0xfff2a0,
  spark: 0xffd23a,
  fire: 0xff8a2e,
  fireHot: 0xffd85a,
  smoke: 0x4a4a52,
  smokeLight: 0x9a98a8,
  debris: 0x3a3226,
  shock: 0xfff4e0,
  portal: 0xd9b3ff,
  level: 0x9ad8ff,
  core: 0xd6a8ff,
};

// Размеры отрисовки (только картинка, на правила не влияют)
export const DRAW = {
  slotRadius: 22,
  towerSize: 26,
  barrel: 22,
  trenchRadius: 24,
  trenchWidth: 8,
  mineRadius: 7,
  padSquash: 0.62,      // площадки под постройки в 3/4 — эллипс
  padH: 5,              // толщина плиты
  wireLift: 6,          // px — спираль проволоки приподнята над дорогой
  soldierRadius: 8,
  nestGunH: 8,         // px — высота станка пулемёта над землёй (ствол рисуется оттуда)
  hpOffset: { goblin: 30, spearman: 34, berserker: 44, soldier: 28, nest: 26 },
  roofH: 34,            // px — на столько выше точки появления стоит крыша дома: люди ждут на крышах
  base: { w: 136, h: 96, post: 14, fenceH: 10 }, // огороженная база грузовика (вышки — по углам) // полоска HP над спрайтом
  abilityR: 40,         // кнопки умений
  abilityGap: 16,
  abilityBottom: 76,    // от нижнего края до низа кнопок умений (над морем и подсказкой)
  heliLength: 78,       // транспортный вертолёт: длиннее и шире прежнего силуэта
  heliWidth: 24,
  rotorRadius: 40,
  shadowOffset: 14,
  survivorRadius: 6,
  survivorRing: 16,
  bulletRadius: 2.5,
  tracer: 12,           // px — длина трассера
  ambient: { clouds: 4, cloudSpeed: 9, cloudAlpha: 0.05, waves: 18, waveSpeed: 22 }, // тени облаков, волны
  wireWidth: 34,
  hpBarW: 28,
  hpBarH: 4,
  menuW: 230,           // 170×40 → 230×52: на телефоне лёжа (812×375) игра ужимается вдвое
  menuH: 52,
  menuGap: 8,
  fontSize: 26,         // 20 → 26: на телефоне лёжа выходило ~10 px
  resultTitle: 44,
  resultW: 1060,
  resultH: 540,
  resultStar: 26,
  resultSmall: 20,
  // штамп отчёта: корейская надпись (шрифт с хангылем есть на Windows, Android, iOS), снизу RU · EN
  stamp: { w: 250, h: 96, koSize: 40, subSize: 13, koFont: '"Malgun Gothic", "Noto Sans KR", "Apple SD Gothic Neo", "Nanum Gothic", sans-serif' },
  mapStar: 18,
  resultBody: 24,       // машинопись в отчёте: на телефоне лёжа ~12 px, поэтому жирная
  resultButton: 30,
  hudPad: 14,
  hudAlpha: 0.55,       // подложка HUD
  hudLeftW: 400,
  hudRightW: 240,
  callEarlyGap: 14,     // кнопка «волна раньше» — под вратами
  fxTime: 0.35,         // с — вспышки попаданий и смертей
  gatePulse: 2.5,       // рад/с
  resultRestartDelay: 2.5, // с — бот с ?runs=N перезапускает забег сам
};
