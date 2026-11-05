// Checks the chart engine against published values. Usage: npm test
const assert = require('assert');
const E = require('../src/renderer/chart-engine.js');
const Z = require('../src/renderer/geo/city-zone.js');

const msOfJd = (jd) => (jd - 2440587.5) * 86400000;
const T = (iso) => E.centuries(E.julianDay(Date.parse(iso)));
const near = (got, want, tol, what) => assert.ok(E.separation(got, want) <= tol, `${what}: ${got.toFixed(4)} vs ${want} (±${tol})`);

const tests = {
  moonMeeusExample47a() {
    // Meeus, Astronomical Algorithms, example 47.a: 1992 April 12, 0h TD.
    const m = E.moonLonLat(E.centuries(2448724.5));
    near(m.lon, 133.162655, 0.02, 'Moon longitude');
    assert.ok(Math.abs(m.lat - -3.229126) < 0.02, `Moon latitude ${m.lat}`);
  },
  sunAtMarchEquinox2024() {
    near(E.planetLonLat('sun', T('2024-03-20T03:06:00Z')).lon, 0, 0.05, 'Sun at equinox');
  },
  jupiterSaturnConjunction2020() {
    const t = T('2020-12-21T18:00:00Z');
    const j = E.planetLonLat('jupiter', t).lon, s = E.planetLonLat('saturn', t).lon;
    assert.ok(E.separation(j, s) < 0.3, `separation ${E.separation(j, s)}`);
    near(j, 300.3, 0.5, 'Jupiter');
  },
  mercuryRetrogradeAugust2024() {
    // Mercury was retrograde from 5 to 28 August 2024.
    const inside = E.chart(Date.parse('2024-08-15T12:00:00Z'), 0, 0).bodies.find((b) => b.id === 'mercury');
    const after = E.chart(Date.parse('2024-09-15T12:00:00Z'), 0, 0).bodies.find((b) => b.id === 'mercury');
    assert.strictEqual(inside.retrograde, true);
    assert.strictEqual(after.retrograde, false);
  },
  meanNodeAtJ2000() {
    near(E.nodeLon(0, 'mean'), 125.0445, 0.001, 'mean node');
  },
  ascendantAtEquatorWithMcAtAries() {
    // With 0° Aries on the Midheaven at the equator, 0° Cancer rises.
    const a = E.angles(0, 0, 23.44);
    near(a.mc, 0, 1e-6, 'MC');
    near(a.asc, 90, 1e-6, 'ASC');
  },
  placidusCuspsRunInOrder() {
    const c = E.chart(Date.parse('2026-10-14T08:53:00Z'), 40.6782, -73.9442, { houseSystem: 'placidus' });
    const cusps = c.houses.cusps;
    near(cusps[0], c.angles.asc, 1e-6, 'cusp 1 is the Ascendant');
    near(cusps[9], c.angles.mc, 1e-6, 'cusp 10 is the Midheaven');
    let total = 0;
    for (let i = 0; i < 12; i++) total += E.norm(cusps[(i + 1) % 12] - cusps[i]);
    assert.ok(Math.abs(total - 360) < 1e-6, 'cusps go once round the circle');
  },
  placidusFallsBackNearThePole() {
    const c = E.chart(Date.parse('2026-06-21T12:00:00Z'), 78, 15, { houseSystem: 'placidus' });
    assert.strictEqual(c.houses.system, 'porphyry');
    assert.ok(c.houses.fallback);
  },
  everyBodyHasAHouse() {
    const c = E.chart(Date.parse('2026-10-14T08:53:00Z'), 14.676, 121.044);
    for (const b of c.bodies) assert.ok(b.house >= 1 && b.house <= 12, b.id);
  },
  timeZonesFollowDaylightSaving() {
    assert.strictEqual(new Date(E.zonedToUtc(2026, 10, 14, 16, 0, 'Asia/Manila')).toISOString(), '2026-10-14T08:00:00.000Z');
    assert.strictEqual(new Date(E.zonedToUtc(2026, 7, 1, 12, 0, 'America/New_York')).toISOString(), '2026-07-01T16:00:00.000Z');
    assert.strictEqual(new Date(E.zonedToUtc(2026, 1, 1, 12, 0, 'America/New_York')).toISOString(), '2026-01-01T17:00:00.000Z');
    const back = E.utcToZoned(Date.parse('2026-07-01T16:00:00Z'), 'America/New_York');
    assert.deepStrictEqual([back.h, back.offset], [12, -240]);
  },
  citiesGetTheirTimeZone() {
    const cases = [
      ['PH', 14.676, 121.044, 'Asia/Manila'], ['US', 32.783, -96.807, 'America/Chicago'], // Quezon City, Dallas
      ['US', 31.759, -106.487, 'America/Denver'], ['US', 47.606, -122.332, 'America/Los_Angeles'], // El Paso, Seattle
      ['RU', 55.796, 49.106, 'Europe/Moscow'], ['AU', -31.952, 115.861, 'Australia/Perth'], // Kazan, Perth
      ['CA', 51.050, -114.085, 'America/Edmonton'], ['ID', -2.533, 140.718, 'Asia/Jayapura'], // Calgary, Jayapura on the PNG border
    ];
    for (const [c, lat, lon, want] of cases) assert.strictEqual(Z.zoneFor(c, lat, lon), want, `${c} ${lat},${lon}`);
  },
  placesMissingFromZoneTabStillGetAZone() {
    assert.strictEqual(Z.zoneFor('XK', 42.673, 21.166), 'Europe/Belgrade'); // Pristina
  },
};

let failed = 0;
for (const [name, fn] of Object.entries(tests)) {
  try { fn(); console.log(`  ok    ${name}`); } catch (e) { failed++; console.log(`  FAIL  ${name}: ${e.message}`); }
}
console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
