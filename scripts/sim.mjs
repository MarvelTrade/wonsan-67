// Прогон бота без браузера: node scripts/sim.mjs [план ...] [--runs N]
// Пример: node scripts/sim.mjs 0t0w 2t1w trap --runs 40
import { World } from '../src/sim/World.js';
import { Bot } from '../src/sim/bot.js';
import { SIM } from '../src/config.js';

const args = process.argv.slice(2);
const runsIdx = args.indexOf('--runs');
const runs = runsIdx >= 0 ? +args[runsIdx + 1] : 40;
const plans = args.filter((a, i) => !a.startsWith('--') && i !== runsIdx + 1);
if (!plans.length) plans.push('0t0w', '1t0w', '2t0w', '2t1w', 'trap');

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};
const fmt = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

console.log(`план  | побед | волна (медиана, мин–макс) | время (медиана) | спасено | на руках в конце | пушек сломано (копейщ.) | проволок порвано`);
for (const plan of plans) {
  const res = [];
  for (let i = 0; i < runs; i++) {
    const world = new World({ seed: 1000 + i, plan });
    const bot = new Bot(world, plan);
    let n = 0;
    while (!world.over && n++ < SIM.maxSteps) {
      bot.step();
      world.step(SIM.dt);
      world.events.length = 0;
    }
    res.push(world.summary());
  }
  const wins = res.filter((r) => r.result === 'win').length;
  const waves = res.map((r) => r.wave);
  const broken = res.reduce((a, r) => a + r.towersBroken, 0);
  const bySpear = res.reduce((a, r) => a + (r.brokenBy.spearman || 0), 0);
  const wires = res.reduce((a, r) => a + r.wiresBroken, 0);
  console.log(
    `${plan.padEnd(5)} | ${String(wins).padStart(2)}/${runs} | ${median(waves)} (${Math.min(...waves)}–${Math.max(...waves)})` +
      ` | ${fmt(median(res.map((r) => r.duration)))} | ${median(res.map((r) => r.saved))}` +
      ` | ${median(res.map((r) => r.peopleLeft))} | ${broken} (${bySpear}) | ${wires}`,
  );
}
