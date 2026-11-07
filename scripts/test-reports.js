// Checks the forecast, comparison and fortune reports' techniques. Usage: npm test
const assert = require('assert');
const E = require('../src/renderer/chart-engine.js');
const F = require('../src/renderer/forecast.js');
const Sy = require('../src/renderer/synastry.js');
const Fo = require('../src/renderer/fortune.js');

const maria = { name: 'Maria Santos', ms: E.zonedToUtc(1990, 6, 15, 8, 30, 'Asia/Manila'), tz: 'Asia/Manila', place: { name: 'Manila', lat: 14.5995, lon: 120.9842 } };
const diego = { name: 'Diego Reyes', ms: E.zonedToUtc(1987, 11, 3, 21, 10, 'Asia/Manila'), tz: 'Asia/Manila', place: { name: 'Cebu City', lat: 10.3157, lon: 123.8854 } };
const lonAt = (id, ms) => E.planetLonLat(id, E.centuries(E.julianDay(ms))).lon;
const sep = (a, b) => E.separation(a, b);

const tests = {
  forecastPassesAreExact() {
    const r = F.build(maria, { from: '2026-11-01', months: 3 });
    const natal = E.chart(maria.ms, maria.place.lat, maria.place.lon);
    const target = (id) => natal.bodies.find((b) => b.id === id)?.lon;
    const angles = { conjunction: 0, sextile: 60, square: 90, trine: 120, opposition: 180 };
    let checked = 0;
    for (const e of r.events) {
      if (!target(e.n)) continue;
      for (const x of e.exact) { assert.ok(Math.abs(sep(lonAt(e.p, x), target(e.n)) - angles[e.aspect]) < 0.01, `${e.p} ${e.aspect} ${e.n}`); checked++; }
    }
    assert.ok(checked > 20, `checked ${checked} passes`);
  },
  marsRetrogradeInVirgo2027() {
    // Mars enters Virgo in late November 2026 and turns retrograde there on 10 January 2027.
    const r = F.build(maria, { from: '2026-11-01', months: 3 });
    const st = r.stations.find((s) => s.p === 'mars');
    assert.ok(st && st.turn === 'retrograde' && new Date(st.at).toISOString().startsWith('2027-01-1'), JSON.stringify(st && new Date(st.at)));
    assert.strictEqual(E.SIGNS[Math.floor(st.lon / 30)].name, 'Virgo');
  },
  hermeticLotsFollowPaulus() {
    const ch = E.chart(maria.ms, maria.place.lat, maria.place.lon);
    const P = Object.fromEntries(ch.bodies.map((b) => [b.id, b.lon]));
    const asc = ch.angles.asc;
    const day = Fo.hermeticLots(ch, true), night = Fo.hermeticLots(ch, false);
    const near = (a, b, what) => assert.ok(sep(a, b) < 1e-6, `${what}: ${a} vs ${b}`);
    near(day.fortune, E.norm(asc + P.moon - P.sun), 'Fortune by day');
    near(night.fortune, E.norm(asc + P.sun - P.moon), 'Fortune by night');
    near(day.eros, E.norm(asc + P.venus - day.spirit), 'Eros by day: from Spirit to Venus');
    near(night.eros, E.norm(asc + night.spirit - P.venus), 'Eros by night');
    near(day.necessity, E.norm(asc + day.fortune - P.mercury), 'Necessity: from Mercury to Fortune');
    near(day.courage, E.norm(asc + day.fortune - P.mars), 'Courage: from Mars to Fortune');
    near(day.victory, E.norm(asc + P.jupiter - day.spirit), 'Victory: from Spirit to Jupiter');
    near(day.nemesis, E.norm(asc + day.fortune - P.saturn), 'Nemesis: from Saturn to Fortune');
    // Fortune and Spirit lie symmetrically about the Ascendant.
    near(E.norm(day.fortune + day.spirit), E.norm(2 * asc), 'Fortune and Spirit about the Ascendant');
  },
  zodiacalReleasingFollowsValens() {
    assert.strictEqual(Object.values(Fo.ZR_YEARS).reduce((a, b) => a + b, 0), 211, 'the twelve periods sum to 211 years');
    const YEAR = 360 * 864e5;
    const L1 = Fo.release(2, 0, 30 * YEAR, 1, 2); // from Gemini: a 20-year period
    assert.strictEqual(L1[0].sign, 2);
    assert.ok(Math.abs((L1[0].to - L1[0].from) / YEAR - 20) < 1e-9);
    const subs = L1[0].subs;
    assert.strictEqual(subs[0].sign, 2, 'sub-periods begin in the period\'s own sign');
    assert.ok(Math.abs((subs[0].to - subs[0].from) / (YEAR / 12) - 20) < 1e-9, 'Gemini sub-period: 20 months');
    assert.ok(!subs.slice(0, 12).some((s) => s.loosed));
    assert.strictEqual(subs[12].sign, 8, 'after twelve sub-periods, loosed to the opposite sign (Sagittarius)');
    assert.ok(subs[12].loosed);
    const short = Fo.release(1, 0, 8 * YEAR, 1, 2)[0].subs; // Taurus, 8 years: 96 months, no loosing
    assert.ok(!short.some((s) => s.loosed));
    assert.strictEqual(Fo.angle(9, 0), 10, 'the 10th from Fortune is the peak');
  },
  ptolemysLightsInComparison() {
    const r = Sy.build(maria, diego, {});
    const l = Object.fromEntries(r.lights.map((x) => [`${x.x}-${x.y}`, x]));
    // Maria: Sun Gemini, Moon Pisces. Diego: Sun Scorpio.
    assert.strictEqual(l['sun-sun'].rel, 'aversion', 'Gemini and Scorpio do not see each other');
    assert.strictEqual(l['moon-sun'].rel, 'trine', 'Pisces and Scorpio are trine');
    assert.ok(r.cross.every((x) => x.orb <= E.ASPECTS.find((a) => a.id === x.aspect).orb * 0.6 + 1e-9));
  },
};

let failed = 0;
for (const [name, fn] of Object.entries(tests)) {
  try { fn(); console.log(`  ok    ${name}`); } catch (e) { failed++; console.log(`  FAIL  ${name}: ${e.message}`); }
}
if (failed) { console.log(`${failed} failed`); process.exit(1); }
console.log('reports: all passed');
