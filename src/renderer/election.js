/* Pagbalatik: the founding election. Searches a window of days, hour by hour, for the best moments to found a
   business (register it, open it, make the first sale), by the traditional rules for beginnings, and checks each
   against the owner's own chart. */
(function (root) {
  'use strict';
  const K = root.ReportKit || require('./report-kit.js');
  const { E, W, R, esc, MONTHS, ASP, BODY, T7, ord, cap, signIdx, signName, sg, fmtLon, G, N, NA, grade, RULER, fmtDate, fmtBirth, offsetOf, norm180 } = K;

  const HOUR = 3600e3;
  const ANGLES = [0, 60, 90, 120, 180, 240, 270, 300];
  const KIND = { 0: 'conjunction', 60: 'sextile', 300: 'sextile', 90: 'square', 270: 'square', 120: 'trine', 240: 'trine', 180: 'opposition' };

  /** The Moon's next aspect before she leaves her sign, or null if she is void of course. */
  function moonNext(ch) {
    const m = ch.bodies[1].lon, left = 30 - (m % 30);
    let best = null;
    for (const p of ['sun', 'mercury', 'venus', 'mars', 'jupiter', 'saturn']) {
      const pl = ch.bodies.find((b) => b.id === p).lon;
      for (const a of ANGLES) {
        const d = E.norm(pl + a - m);
        if (d > 0.05 && d < left && (!best || d < best.d)) best = { p, aspect: KIND[a], d };
      }
    }
    return best;
  }

  /** Scores one moment. Returns { score, pros, cons }. */
  function judge(ms, place, owner, O) {
    const ch = E.chart(ms, place.lat, place.lon, { houseSystem: 'whole' });
    const B = Object.fromEntries(ch.bodies.map((b) => [b.id, b]));
    const A = R.analyse({ name: '', ms, tz: 'UTC', place }, { houses: 'whole' });
    const pros = [], cons = [];
    const add = (n, why) => (n > 0 ? pros : cons).push([n, why]);
    const moon = B.moon, sun = B.sun;
    const phase = E.norm(moon.lon - sun.lon);
    // The Moon
    if (phase < 180) add(2, 'The Moon is increasing in light'); else add(-1, 'The Moon is decreasing in light');
    if (E.separation(moon.lon, sun.lon) < 12) add(-3, 'The Moon is under the Sun\'s beams');
    if (moon.lon >= 195 && moon.lon < 225) add(-3, 'The Moon is in the via combusta (15° Libra to 15° Scorpio)');
    const next = moonNext(ch);
    if (!next) add(-3, 'The Moon is void of course: she makes no aspect before leaving her sign');
    else if (['jupiter', 'venus'].includes(next.p)) add(['square', 'opposition'].includes(next.aspect) ? 1 : 3, `The Moon applies to ${N(next.p)} by ${next.aspect}`);
    else if (['saturn', 'mars'].includes(next.p)) add(['square', 'opposition', 'conjunction'].includes(next.aspect) ? -3 : -1, `The Moon applies to ${N(next.p)} by ${next.aspect}`);
    const mh = A.houseOf(moon.lon);
    if ([6, 8, 12].includes(mh)) add(-2, `The Moon is in the ${ord(mh)}, a troubled house`);
    else if ([1, 4, 7, 10].includes(mh)) add(1, `The Moon is angular (${ord(mh)})`);
    // The Ascendant and its lord
    const ascSign = E.SIGNS[signIdx(ch.angles.asc)];
    if (signIdx(ch.angles.asc) % 3 === 1) add(1, `${ascSign.name} rising: a fixed sign, for things meant to last`);
    const al = A.ascLord, alp = A.P[al];
    if (alp.es.score >= 4) add(2, `${N(al)}, lord of the Ascendant, is dignified`); else if (alp.es.score <= -4) add(-2, `${N(al)}, lord of the Ascendant, is debilitated`);
    if ([1, 4, 7, 10].includes(B[al].house)) add(2, `${N(al)}, lord of the Ascendant, is angular`); else if ([6, 8, 12].includes(B[al].house)) add(-2, `${N(al)}, lord of the Ascendant, is in the ${ord(B[al].house)}`);
    for (const b of ['jupiter', 'venus']) { const h = B[b].house; if (h === 1) add(3, `${N(b)} rises in the 1st`); else if (h === 10) add(2, `${N(b)} is in the 10th`); else if ([4, 7, 11, 2].includes(h)) add(1, `${N(b)} is in the ${ord(h)}`); }
    for (const m of ['saturn', 'mars']) { const h = B[m].house; if (h === 1) add(-3, `${N(m)} rises in the 1st`); else if (h === 10) add(-2, `${N(m)} is in the 10th`); else if ([3, 6, 9, 12].includes(h)) add(1, `${N(m)} is cadent (${ord(h)}), out of the way`); }
    // The business's own houses
    const l10 = A.lordOf(10); if (A.P[l10].total >= 4) add(1, `${N(l10)}, lord of the 10th (the enterprise), is strong`); else if (A.P[l10].total <= -4) add(-1, `${N(l10)}, lord of the 10th, is weak`);
    for (const h of [2, 11]) { const l = A.lordOf(h); if ([6, 8, 12].includes(B[l].house)) add(-1, `${N(l)}, lord of the ${ord(h)}, is in the ${ord(B[l].house)}`); else add(1, `${N(l)}, lord of the ${ord(h)}, is well placed`); }
    if (B.mercury.retrograde) add(-2, 'Mercury is retrograde: papers and agreements go back over themselves');
    // The owner's chart
    if (O) {
      const rel = (signIdx(ch.angles.asc) - signIdx(O.ch.angles.asc) + 12) % 12 + 1;
      if ([1, 2, 10, 11].includes(rel)) add(2, `The rising sign is the owner's ${ord(rel)}: a fit for the owner`); else if ([6, 8, 12].includes(rel)) add(-2, `The rising sign is the owner's ${ord(rel)}`);
      for (const pt of [['sun', O.B.sun.lon], ['moon', O.B.moon.lon], ['asc', O.ch.angles.asc], ['fortune', O.fortune]]) {
        for (const b of ['jupiter', 'venus']) if (E.separation(B[b].lon, pt[1]) < 5) add(2, `${N(b)} on the owner's ${N(pt[0])}`);
        for (const m of ['saturn', 'mars']) if (E.separation(B[m].lon, pt[1]) < 5) add(-2, `${N(m)} on the owner's ${N(pt[0])}`);
      }
    }
    const score = pros.reduce((s, [n]) => s + n, 0) + cons.reduce((s, [n]) => s + n, 0);
    return { ms, ch, score, pros, cons, next };
  }

  function build(owner, opts) {
    const o = { ...K.DEFAULTS, days: 60, ...opts };
    const place = o.place || owner.place, tz = o.tz || owner.tz;
    const O = owner ? R.analyse(owner, { houses: 'whole' }) : null;
    const [fy, fm, fd] = (o.from || new Date().toISOString().slice(0, 10)).split('-').map(Number);
    const start = E.zonedToUtc(fy, fm, fd, 0, 0, tz);
    const days = +o.days || 60;
    // Every hour from 7:00 to 20:00 local, the hours a business can be opened; keep the best moment of each day.
    const best = [];
    for (let d = 0; d < days; d++) {
      let top = null;
      for (let h = 7; h <= 20; h++) {
        const z = new Date(Date.UTC(fy, fm - 1, fd + d));
        const ms = E.zonedToUtc(z.getUTCFullYear(), z.getUTCMonth() + 1, z.getUTCDate(), h, 0, tz);
        const j = judge(ms, place, owner, O);
        if (!top || j.score > top.score) top = j;
      }
      best.push(top);
    }
    const ranked = best.slice().sort((a, b) => b.score - a.score);
    const top = ranked.slice(0, 10), avoid = ranked.slice(-5).reverse();
    const D = (ms) => fmtDate(ms, tz, true);
    const sub = `${esc(owner.name)} · a new business<br>${esc(place.name)} · ${fmtDate(start, tz)} for ${days} days`;
    const S = K.shell(o, sub, `Founding election · ${esc(owner.name)}`);
    const { page, head, cite } = S;
    const row = (j, i) => `<tr class="${i === 0 ? 'hi' : ''}"><td>${i + 1}</td><td>${D(j.ms)}</td><td>${sg(j.ch.angles.asc)} ${signName(j.ch.angles.asc)}</td><td>${sg(j.ch.bodies[1].lon)} ${signName(j.ch.bodies[1].lon)}${j.next ? ` → ${G(j.next.p)}` : ' (void)'}</td><td class="r"><b>${j.score > 0 ? '+' : ''}${j.score}</b></td></tr>`;
    const card = (j, i) => `<div class="rem"><h5><span>${i + 1}. ${D(j.ms)}</span><span class="act ${j.score >= 8 ? 'magnify' : j.score >= 3 ? 'strengthen' : 'none'}">${j.score > 0 ? '+' : ''}${j.score}</span></h5>
      <div class="cols"><div><div class="wheel-wrap sm" style="margin:0">${W.svg(j.ch, null, { modern: false })}</div></div>
      <div><div class="lbl">In favour</div><ul class="why">${j.pros.sort((a, b) => b[0] - a[0]).map(([n, w]) => `<li>${w} <span class="pos">+${n}</span></li>`).join('') || '<li>—</li>'}</ul>
      <div class="lbl">Against</div><ul class="why">${j.cons.sort((a, b) => a[0] - b[0]).map(([n, w]) => `<li>${w} <span class="neg">${n}</span></li>`).join('') || '<li>Nothing against.</li>'}</ul></div></div></div>`;

    page('best', 'The best moments', () => `${head('Founding election')}
      <p>A business has its own chart: the moment it begins. An election chooses that moment. This search looked at every hour from 7:00 to 20:00 over ${days} days from ${fmtDate(start, tz)}, in ${esc(place.name)}, judged each by the traditional rules for beginnings and by how it fits ${esc(owner.name.split(' ')[0])}'s own chart, and kept the best hour of each day.</p>
      <h4>The ten best days</h4>
      <table><thead><tr><th></th><th>Moment</th><th>Rising</th><th>Moon (next aspect)</th><th class="r">Score</th></tr></thead><tbody>${top.map(row).join('')}</tbody></table>
      <h4>Days to avoid</h4>
      <table><tbody>${avoid.map((j) => `<tr><td>${fmtDate(j.ms, tz)}</td><td>${j.cons.sort((a, b) => a[0] - b[0]).slice(0, 2).map(([, w]) => w).join('; ')}</td><td class="r neg">${j.score}</td></tr>`).join('')}</tbody></table>
      <p class="src" style="font-style:normal;margin-top:6px">Use the founding moment that counts legally or practically for you: the registration, the opening of the doors, or the first sale. Times are local to ${esc(place.name)}; a few minutes either side changes little, an hour can change the rising sign.</p>
      ${cite('Elections for beginnings: Dorotheus, Carmen V (consulted, not quoted); Sahl ibn Bishr, On Elections; Bonatti, Liber Astronomiae; Lilly, Christian Astrology (the Moon void of course).')}`);
    [[0, 2], [2, 4]].forEach(([a, b], k) => page(`detail${k}`, k ? 'The best moments (2)' : 'The best moments in detail', () => `${head(k ? 'The best moments in detail, continued' : 'The best moments in detail')}${top.slice(a, b).map((j, i) => card(j, a + i)).join('')}`));
    page('rules', 'The rules used', () => `${head('The rules used')}
      <p>Each hour is scored by these rules, the common core of the medieval elections for beginnings. Positive points for what helps, negative for what harms.</p>
      <table><tbody>
        <tr><td><b>The Moon</b></td><td>Increasing in light +2, decreasing −1; under the Sun's beams −3; in the via combusta −3; void of course −3; applying to Jupiter or Venus +3 (by square or opposition +1); applying to Saturn or Mars by conjunction, square or opposition −3 (otherwise −1); angular +1; in the 6th, 8th or 12th −2.</td></tr>
        <tr><td><b>The Ascendant</b></td><td>A fixed sign rising +1 (for things meant to last). Its lord dignified +2 or debilitated −2; angular +2 or in the 6th, 8th or 12th −2.</td></tr>
        <tr><td><b>Benefics and malefics</b></td><td>Jupiter or Venus in the 1st +3, in the 10th +2, in the 2nd, 4th, 7th or 11th +1. Saturn or Mars in the 1st −3, in the 10th −2, cadent +1.</td></tr>
        <tr><td><b>The business's houses</b></td><td>The lord of the 10th strong +1 or weak −1; the lords of the 2nd and 11th well placed +1 each, in the 6th, 8th or 12th −1. Mercury retrograde −2.</td></tr>
        <tr><td><b>The owner's chart</b></td><td>The rising sign is the owner's 1st, 2nd, 10th or 11th +2, or 6th, 8th or 12th −2. A benefic within 5° of the owner's Sun, Moon, Ascendant or Fortune +2; a malefic −2.</td></tr>
      </tbody></table>
      <p style="margin-top:6px">Whole-sign houses are used for the election. The rules are the authors' common ground in our own wording; individual authors weigh them differently.</p>
      ${cite('Dorotheus, Carmen V; Sahl ibn Bishr, On Elections (Latin); Bonatti, Liber Astronomiae (on elections); Lilly, Christian Astrology. Via combusta: the medieval tradition after Bonatti.')}`);
    return { best, ranked, top, avoid, pages: S.pages };
  }

  const api = { build, judge, moonNext };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Election = api;
})(typeof window !== 'undefined' ? window : globalThis);
