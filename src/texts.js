// Все тексты интерфейса — здесь
export const T = {
  title: 'ВОНСАН-67',
  wave: (n, total) => `Волна ${n}/${total}`,
  waveIn: (s) => `через ${s} с`,
  waveOn: 'идёт',
  people: (n) => `Люди: ${n}`,
  onboard: (n, cap) => `На борту: ${n}/${cap}`,
  shelter: (hp, max) => `Убежище: ${hp}/${max}`,
  hintStart: 'Веди вертолёт пальцем. Забирай людей и вези к грузовику. Нажми на круг — построить.',
  tower: (cost) => `Пушка · ${cost}`,
  wire: (cost) => `Проволока · ${cost}`,
  win: 'Убежище устояло',
  lose: 'Убежище пало',
  again: 'Ещё раз',
  bot: (plan, speed) => `бот ${plan} ×${speed}`,
  summary: (r) => [
    `Волна: ${r.wave}   Время: ${Math.floor(r.duration / 60)}:${String(r.duration % 60).padStart(2, '0')}`,
    `Спасено: ${r.saved}   Пропало: ${r.lostSurvivors}`,
    `Потрачено: пушки ${r.spentTowers}, проволока ${r.spentWire}   Осталось людей: ${r.peopleLeft}`,
    `Пушек сломано: ${r.towersBroken}${r.towersBroken ? ` (копейщики: ${r.brokenBy.spearman || 0})` : ''}   Проволоки порвано: ${r.wiresBroken}`,
    `Убито: гоблины ${r.kills.goblin}, копейщики ${r.kills.spearman}   Прорвалось: ${r.leaked}`,
  ],
};
