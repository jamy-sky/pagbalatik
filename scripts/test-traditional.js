// Checks the traditional tables and rules in report.js against the sources. Usage: npm test
const assert = require('assert');
const E = require('../src/renderer/chart-engine.js');
const R = require('../src/renderer/report.js');

const lonOf = (sign, deg) => E.SIGNS.findIndex((s) => s.name === sign) * 30 + deg;
const sample = { name: 'Maria Santos', ms: E.zonedToUtc(1990, 6, 15, 8, 30, 'Asia/Manila'), tz: 'Asia/Manila', place: { name: 'Manila', lat: 14.5995, lon: 120.9842 } };

const tests = {
  egyptianTermsCoverEachSign() {
    for (const [sign, terms] of Object.entries(R.TERMS)) {
      assert.strictEqual(terms[terms.length - 1][1], 30, `${sign} ends at 30°`);
      assert.strictEqual(terms.length, 5, `${sign} has five terms`);
      // Each of the five planets has one term in every sign.
      assert.deepStrictEqual(terms.map(([p]) => p).sort(), ['jupiter', 'mars', 'mercury', 'saturn', 'venus'], sign);
    }
    // The Egyptian terms give each planet the same total of degrees around the zodiac (Ptolemy, Tetrabiblos I).
    const total = {};
    for (const terms of Object.values(R.TERMS)) terms.reduce((from, [p, to]) => { total[p] = (total[p] || 0) + to - from; return to; }, 0);
    assert.deepStrictEqual(total, { jupiter: 79, venus: 82, mercury: 76, mars: 66, saturn: 57 });
  },
  termAndFaceLords() {
    assert.strictEqual(R.termLord(lonOf('Aries', 3)), 'jupiter');
    assert.strictEqual(R.termLord(lonOf('Leo', 15)), 'saturn');
    assert.strictEqual(R.faceLord(lonOf('Aries', 5)), 'mars');
    assert.strictEqual(R.faceLord(lonOf('Pisces', 25)), 'mars'); // the 36th face: the Chaldean order comes round to Mars
  },
  essentialDignities() {
    const has = (id, sign, deg, name, day = true) => R.essential(id, lonOf(sign, deg), day, {}).list.some(([n]) => n === name);
    assert.ok(has('mars', 'Aries', 10, 'Domicile'));
    assert.ok(has('sun', 'Aries', 19, 'Exaltation'));
    assert.ok(has('saturn', 'Aries', 21, 'Fall'));
    assert.ok(has('venus', 'Virgo', 27, 'Fall'));
    assert.ok(has('moon', 'Capricorn', 3, 'Detriment'));
    assert.ok(has('sun', 'Sagittarius', 5, 'Triplicity'), 'the Sun rules fire by day');
    assert.ok(!has('sun', 'Sagittarius', 5, 'Triplicity', false), 'but not by night (Jupiter does)');
    assert.ok(has('mercury', 'Pisces', 12, 'Detriment') && has('mercury', 'Pisces', 12, 'Fall'));
    const per = R.essential('venus', lonOf('Aries', 29), true, {});
    assert.ok(per.list.some(([n]) => n === 'Detriment'));
  },
  antipathyIsCulpepers() {
    // "diseases of Jupiter by herbs of Mercury, and the contrary; ... the Luminaries by the herbs of Saturn, and the
    // contrary; diseases of Mars by herbs of Venus, and the contrary." (The Complete Herbal, To the Reader, 4th.)
    assert.deepStrictEqual(R.ANTIPATHY, { jupiter: 'mercury', mercury: 'jupiter', sun: 'saturn', moon: 'saturn', saturn: 'sun', mars: 'venus', venus: 'mars' });
  },
  agrippaTables() {
    // Book II ch. 22: the square of each planet and the sum of each line.
    const want = { saturn: [3, 15], jupiter: [4, 34], mars: [5, 65], sun: [6, 111], venus: [7, 175], mercury: [8, 260], moon: [9, 369] };
    for (const [p, [n, sum]] of Object.entries(want)) {
      assert.strictEqual(R.AGRIPPA[p].square, `${n} × ${n} (sum ${sum})`, p);
      assert.strictEqual(n * (n * n + 1) / 2, sum, `${p}: a magic square of ${n} sums to ${sum}`);
    }
  },
  sampleChart() {
    const A = R.analyse(sample, {});
    assert.strictEqual(A.day, true, 'the Sun is above the horizon at 08:30');
    assert.strictEqual(A.ascLord, 'moon', 'Cancer rising');
    assert.strictEqual(A.ranked[0], 'mars', 'Mars in Aries, in the 10th, is the strongest');
    assert.strictEqual(A.sectBenefic, 'jupiter');
    assert.strictEqual(A.contraryMalefic, 'mars');
  },
  remediesFollowFemt() {
    const A = R.analyse(sample, {});
    const rem = Object.fromEntries(R.remedies(A, {}).map((r) => [r.id, r]));
    assert.strictEqual(rem.mars.act, 'restrain', 'Mars is always restrained');
    assert.strictEqual(rem.saturn.act, 'settle', 'Saturn is always settled');
    assert.strictEqual(rem.saturn.via, 'jupiter', 'through Jupiter (Ficino, De vita III.22)');
    assert.strictEqual(rem.mars.via, 'venus');
    assert.strictEqual(rem.sun.act, 'strengthen', 'a weak light of the chart');
  },
  firdariaAddUpTo75() {
    const A = R.analyse(sample, {});
    const F = R.firdaria(A);
    assert.strictEqual(F.rows[0].id, 'sun', 'a day chart starts with the Sun');
    assert.strictEqual(F.rows[F.rows.length - 1].to, 75);
    const sub = F.rows[0].subs;
    assert.strictEqual(sub.length, 7);
    assert.deepStrictEqual(sub.map((s) => s.id), ['sun', 'venus', 'mercury', 'moon', 'saturn', 'jupiter', 'mars']);
  },
  profectionsMoveASignAYear() {
    const A = R.analyse(sample, {});
    const pr = R.profections(A);
    for (let i = 1; i < pr.length; i++) assert.strictEqual((pr[i].sg.start - pr[i - 1].sg.start + 360) % 360, 30);
    const now = pr.find((r) => r.now);
    assert.strictEqual(now.house, (now.a % 12) + 1);
  },
};

let failed = 0;
for (const [name, fn] of Object.entries(tests)) {
  try { fn(); console.log(`  ok    ${name}`); } catch (e) { failed++; console.log(`  FAIL  ${name}: ${e.message}`); }
}
if (failed) { console.log(`${failed} failed`); process.exit(1); }
console.log('traditional: all passed');
