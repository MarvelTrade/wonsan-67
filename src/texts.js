// Все тексты интерфейса — здесь
export const T = {
  title: 'ВОНСАН-67',
  rotate: 'Поверни телефон горизонтально',
  mapSubtitle: '1967 · восточное побережье · выбери серию',
  mapSubtitleArt: 'восточное побережье · выбери серию',
  locked: '✕',
  mapWon: 'пройдена',
  mapOpen: 'открыта',
  mapLocked: 'закрыта',
  toMap: 'Карта',
  pauseIcon: 'II',
  paused: 'Пауза',
  resume: 'Продолжить',
  copyStats: (n) => `Скопировать статистику (${n})`,
  copied: 'Скопировано — вставь в чат',
  copyFailed: 'Не скопировалось',
  copyManual: 'Выдели весь текст ниже и скопируй, потом вставь в чат:',
  close: 'Закрыть',
  wave: (n, total) => `Волна ${n}/${total}`,
  waveIn: (s) => `через ${s} с`,
  waveOn: 'идёт',
  people: (n) => `Люди: ${n}`,
  onboard: (n, cap) => `На борту: ${n}/${cap}`,
  shelter: (hp, max) => `Убежище: ${hp}/${max}`,
  hintStart: 'Веди вертолёт пальцем. Забирай людей и вези к грузовику. Нажми на круг — построить.',
  hints: {
    2: 'Орки-берсерки рубят пушки. Нажми на готовую пушку — окопай её.',
    3: 'Мина ложится на дорогу и рвётся под первым, кто наступит. Взрыв бьёт и своих.',
  },
  tower: (cost) => `Пушка · ${cost}`,
  wire: (cost) => `Проволока · ${cost}`,
  trench: (cost) => `Окоп · ${cost}`,
  mine: (cost) => `Мина · ${cost}`,
  next: 'Дальше',
  win: 'Убежище устояло',
  lose: 'Убежище пало',
  again: 'Ещё раз',
  bot: (plan, speed) => `бот ${plan} ×${speed}`,
  speakers: { sergeant: 'Сержант', medic: 'Медик', institute: 'Институт · диспетчер' },
  // Реплики радио: ключ → [кто, текст]. Каждая звучит не больше раза за забег.
  // l<уровень>_start — в начале, l<уровень>_w<n> — перед волной n; остальные — в ответ на события.
  radio: {
    l1_start: ['institute', 'Борт шестьдесят седьмой, у станции открылись врата. Убежище держать. Людей — к грузовику.'],
    l1_w1: ['sergeant', 'Идут по дороге. Пушки ставим вдоль неё — жёлтые круги видишь?'],
    l1_w2: ['medic', 'В сопках ещё люди. Не забывай про них.'],
    l1_w3: ['institute', 'Последняя волна. Продержитесь — институт пришлёт смену.'],
    l2_start: ['institute', 'Из врат вышла новая партия. Среди них крупные, с топорами.'],
    l2_w1: ['sergeant', 'Вижу здоровяка. Такие сходят с дороги и рубят всё подряд.'],
    l2_w2: ['sergeant', 'Окоп вокруг пушки — к ней не подберётся. Жми на готовую пушку.'],
    l2_w3: ['medic', 'Держимся. Ещё одна волна.'],
    l3_start: ['institute', 'Институт выделил мины. Дёшево, но одноразово. Экономьте ресурс.'],
    l3_w1: ['sergeant', 'Идут плотно. Одна мина — целая пачка.'],
    l3_w2: ['medic', 'Слышишь гул? Опять топоры.'],
    l3_w3: ['institute', 'Последняя волна серии. Институт на связи.'],
    first_spearman: ['sergeant', 'Копейщики. Копьё длинное — достают пушку прямо с дороги.'],
    first_berserker: ['sergeant', 'Берсерк! Сейчас сойдёт с дороги.'],
    broken_spearman: ['sergeant', 'Пушку закололи. Застряли рядом — и копьём, копьём…'],
    broken_berserker: ['sergeant', 'Разрубил пушку. В окопе бы устояла.'],
    broken_mine: ['medic', 'Это наша мина… задела свою же пушку.'],
    wire_berserker: ['sergeant', 'Берсерк изрубил проволоку!'],
    wire_berserker_trenched: ['sergeant', 'Берсерк рвёт проволоку. Пушки в окопах, ему не достать — нашёл, что рубить.'],
    mine_goblin: ['institute', 'Мину израсходовали на гоблина. Экономьте ресурс.'],
    lost: ['medic', 'Не успели… человек пропал.'],
    drop_first: ['medic', 'Приняла людей. Каждый — ещё одни руки для стройки.'],
    leak: ['institute', 'Прорыв к убежищу!'],
    win: ['institute', 'Убежище устояло. Хорошая работа, шестьдесят седьмой.'],
    lose: ['medic', 'Убежище… мы его потеряли.'],
  },
  // Итоги забега — короткими строками, чтобы читались на телефоне
  summary: (r) => {
    const by = r.brokenBy || {};
    const spent = [`пушки ${r.spentTowers}`, `проволока ${r.spentWire}`];
    if (r.trenchesBuilt) spent.push(`окопы ${r.spentTrench}`);
    if (r.minesBuilt) spent.push(`мины ${r.spentMines}`);
    const who = [`копейщики ${by.spearman || 0}`];
    if (by.berserker) who.push(`берсерки ${by.berserker}`);
    if (by.mine) who.push(`свои мины ${by.mine}`);
    const trig = r.minesTriggeredBy || {};
    const kills = [`гоблины ${r.kills.goblin}`, `копейщики ${r.kills.spearman}`];
    if (r.kills.berserker) kills.push(`берсерки ${r.kills.berserker}`);
    return [
      `Волна: ${r.wave}   Время: ${Math.floor(r.duration / 60)}:${String(r.duration % 60).padStart(2, '0')}`,
      `Спасено: ${r.saved}   Пропало: ${r.lostSurvivors}   Осталось людей: ${r.peopleLeft}`,
      `Потрачено: ${spent.join(' · ')}`,
      `Пушек сломано: ${r.towersBroken}${r.towersBroken ? ` (${who.join(', ')})` : ''}`,
      ...(r.wiresBuilt ? [`Проволоки порвано: ${r.wiresBroken}${r.wiresBrokenBy?.berserker ? ` (берсерки ${r.wiresBrokenBy.berserker})` : ''}`] : []),
      ...(r.minesBuilt ? [`Мины: взорвано ${Object.values(trig).reduce((a, b) => a + b, 0)} из ${r.minesBuilt}, под гоблинами ${trig.goblin || 0}, убито минами ${r.killsBy.mine || 0}`] : []),
      `Убито: ${kills.join(', ')}   Прорвалось: ${r.leaked}`,
    ];
  },
};
