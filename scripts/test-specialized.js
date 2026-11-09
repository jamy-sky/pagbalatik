// Checks the specialized reports: themed forecasts, owner and business, founding election. Usage: npm test
const assert = require('assert');
const E = require('../src/renderer/chart-engine.js');
const T = require('../src/renderer/themes.js');
const Bz = require('../src/renderer/business.js');
const El = require('../src/renderer/election.js');
const R = require('../src/renderer/report.js');

const maria = { name: 'Maria Santos', ms: E.zonedToUtc(1990, 6, 15, 8, 30, 'Asia/Manila'), tz: 'Asia/Manila', place: { name: 'Manila', lat: 14.5995, lon: 120.9842 } };
const shop = { name: 'Santos Trading', kind: 'business', timeKnown: false, ms: E.zonedToUtc(2019, 3, 4, 12, 0, 'Asia/Manila'), tz: 'Asia/Manila', place: { name: 'Manila', lat: 14.5995, lon: 120.9842 } };

const tests = {
  moneyWatchesTheMoneyHouses() {
    const r = T.build(maria, { theme: 'money', from: '2026-11-09', months: 12 });
    const A = R.analyse(maria, {});
    const income = r.groups.find((g) => g.id === 'income');
    assert.ok(income.targets.some(([id]) => id === A.lordOf(2)), 'income watches the lord of the 2nd');
    assert.ok(income.targets.some(([id]) => id === 'fortune'), 'and the Lot of Fortune');
    const others = r.groups.find((g) => g.id === 'others');
    assert.strictEqual(others.targets[0][0], A.lordOf(8), 'other people\'s money is the 8th');
    // Fast planets count only by conjunction and opposition.
    for (const g of r.groups) for (const e of g.events) if (!['mars', 'jupiter', 'saturn'].includes(e.p)) assert.ok(['conjunction', 'opposition'].includes(e.aspect), `${e.p} ${e.aspect}`);
  },
  travelModesFollowTheSigns() {
    const r = T.build(maria, { theme: 'travel', from: '2026-11-09', months: 12 });
    const lonAt = (id, ms) => E.planetLonLat(id, E.centuries(E.julianDay(ms))).lon;
    const modes = new Set(r.groups.flatMap((g) => g.events).filter((e) => e.exact.length).map((e) => T.THEMES.travel.mode(e, lonAt)));
    for (const m of modes) assert.ok(['By water', 'Over land', 'By air (modern extension)', 'No traditional mode'].includes(m), m);
    assert.ok(r.groups.find((g) => g.id === 'moon').targets[0][0] === 'moon', 'Ptolemy: travel from the Moon');
  },
  militaryCareIsOnByDefaultAndOnlyHardMalefics() {
    const on = T.build(maria, { theme: 'military', from: '2026-11-09', months: 12 });
    assert.ok(Array.isArray(on.careEvents), 'care periods are included by default');
    assert.ok(on.pages.some((p) => p.id === 'care'));
    for (const e of on.careEvents) {
      assert.ok(['mars', 'saturn'].includes(e.p));
      assert.ok(['conjunction', 'square', 'opposition'].includes(e.aspect));
    }
    const off = T.build(maria, { theme: 'military', from: '2026-11-09', months: 12, care: false });
    assert.strictEqual(off.careEvents, null);
    assert.ok(!off.pages.some((p) => p.id === 'care'));
  },
  businessWithoutATimeUsesWholeSigns() {
    const r = Bz.build(maria, shop, {});
    assert.strictEqual(r.pages.length, 5);
    // Whole-sign houses: each cusp at 0° of its sign.
    for (const c of r.B.houses ? r.B.houses.cusps : r.B.ch.houses.cusps) assert.ok(Math.abs(c % 30) < 1e-9);
  },
  moonVoidOfCourse() {
    // The Moon at 29.9° Aries with no planet a tenth of a degree ahead: void.
    const body = (id, lon) => ({ id, lon });
    const ch = { bodies: [body('sun', 100), body('moon', 29.9), body('mercury', 110), body('venus', 200), body('mars', 250), body('jupiter', 300), body('saturn', 330)] };
    assert.strictEqual(El.moonNext(ch), null);
    // At 10° Aries she next meets Jupiter's sextile at 300 + 60 = 0°... no: 360 is behind; Saturn's sextile (330 + 60 = 30) is ahead within the sign.
    ch.bodies[1].lon = 10; ch.bodies[6].lon = 320; // Saturn at 20° Aquarius: sextile at 20° Aries
    ch.bodies[2].lon = 115; ch.bodies[3].lon = 205; // Mercury's square and Venus's opposition fall later, at 25° Aries
    const n = El.moonNext(ch);
    assert.ok(n && n.p === 'saturn' && n.aspect === 'sextile', JSON.stringify(n));
  },
  electionRanksAndExplains() {
    const r = El.build(maria, { from: '2026-11-10', days: 30 });
    assert.strictEqual(r.best.length, 30, 'the best hour of each day');
    assert.ok(r.top[0].score >= r.top[r.top.length - 1].score);
    for (const j of r.top) assert.strictEqual(j.score, j.pros.concat(j.cons).reduce((s, [n]) => s + n, 0), 'the score is the sum of its reasons');
  },
};

let failed = 0;
for (const [name, fn] of Object.entries(tests)) {
  try { fn(); console.log(`  ok    ${name}`); } catch (e) { failed++; console.log(`  FAIL  ${name}: ${e.message}`); }
}
if (failed) { console.log(`${failed} failed`); process.exit(1); }
console.log('specialized: all passed');
