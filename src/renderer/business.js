/* Pagbalatik: the owner and the business. The business's founding chart (its "birth": registration, opening or first
   sale) read for its own significators, then set against the owner's chart: where each falls in the other's houses,
   the aspects and receptions between them, and the years when both are in strong periods together. */
(function (root) {
  'use strict';
  const K = root.ReportKit || require('./report-kit.js');
  const Sy = root.Synastry || require('./synastry.js');
  const Fo = root.Fortune || require('./fortune.js');
  const { E, W, R, esc, MONTHS, ASP, BODY, T7, ord, cap, signIdx, signName, sg, fmtLon, G, N, NA, grade, RULER, fmtDate, offsetOf, norm180 } = K;

  const YEAR = 360 * 864e5;
  const BIZ_HOUSES = [[1, 'the venture itself'], [10, 'the enterprise and its reputation'], [2, 'its money'], [11, 'its profits (the 2nd from the 10th)'], [6, 'its staff'], [7, 'clients, partners and competitors'], [4, 'its premises and the end of the matter']];
  const OWNER_TOPIC = ['', 'their own person', 'their income', 'their daily dealings', 'their home and family', 'their pleasure', 'their daily work and health', 'their partnerships', 'debts and others\' money', 'travel and learning', 'their career and standing', 'their friends and hopes', 'what drains or hides from them'];
  const BIZ_TOPIC = ['', 'the venture itself', 'its money', 'its local dealings and communications', 'its premises', 'its ventures and promotion', 'its staff and operations', 'its clients and competitors', 'its debts and investors', 'its reach abroad', 'its reputation and authority', 'its profits and backers', 'its hidden costs and enemies'];
  const relation = (a, b) => { const d = (signIdx(b) - signIdx(a) + 12) % 12; return d === 0 ? 'conjunction' : [2, 10].includes(d) ? 'sextile' : [4, 8].includes(d) ? 'trine' : [3, 9].includes(d) ? 'square' : d === 6 ? 'opposition' : 'aversion'; };
  const harmonious = (r) => ['conjunction', 'sextile', 'trine'].includes(r);
  const birthLine = (p) => (p.timeKnown === false ? `${fmtDate(p.ms, p.tz)} (time unknown)` : fmtDate(p.ms, p.tz, true));

  function build(owner, biz, opts) {
    const unknown = biz.timeKnown === false || owner.timeKnown === false;
    const o = { ...K.DEFAULTS, ...opts, ...(unknown ? { houses: 'whole' } : {}) };
    const O = R.analyse(owner, o), B = R.analyse(biz, o);
    const LO = Fo.hermeticLots(O.ch, O.day), LB = Fo.hermeticLots(B.ch, B.day);
    const fo = owner.name.split(' ')[0], fb = biz.name;
    const role = (id) => { const r = B.rules(id); return r.length ? ` (lord of its ${r.map(ord).join(' and ')})` : ''; };
    const now = o.now || Date.now();
    const sub = `${esc(owner.name)} &amp; ${esc(biz.name)}<br>${birthLine(owner)} · founded ${birthLine(biz)}`;
    const S = K.shell(o, sub, `Owner and business · ${esc(owner.name)} & ${esc(biz.name)}`);
    const { page, head, cite, brand } = S;
    const benefic = (id) => ['jupiter', 'venus'].includes(id), malefic = (id) => ['saturn', 'mars'].includes(id);
    const pts = (A, L) => T7.map((id) => ({ id, lon: A.B[id].lon })).concat([{ id: 'asc', lon: A.ch.angles.asc }, { id: 'mc', lon: A.ch.angles.mc }, { id: 'fortune', lon: L.fortune }]);
    const cross = E.aspects(pts(O, LO), pts(B, LB), { orbScale: 0.6 }).filter((x) => !(['asc', 'mc', 'fortune'].includes(x.a) && ['asc', 'mc', 'fortune'].includes(x.b)));
    const rec = Sy.receptions(O, B);
    const caveat = unknown ? '<p class="src" style="font-style:normal"><b>Founding time unknown.</b> The business chart is cast for noon on its founding day with whole-sign houses. Signs and aspects hold; the Ascendant, the houses and the lots can be a sign out, so read them as provisional.</p>' : '';

    page('cover', 'Owner and business', () => `<div class="cover">${brand()}
      <div class="mid" style="margin-top:22px"><div class="kicker">The owner and the business</div><div class="t" style="font-size:26px">${esc(owner.name)} &amp; ${esc(biz.name)}</div>
      <div class="wheel-wrap">${W.svg(B.ch, O.ch, { modern: o.modern !== 'off' })}</div>
      <div class="d">Inner wheel: ${esc(biz.name)}, founded ${birthLine(biz)}, ${esc(biz.place.name)}. Outer ring: ${esc(owner.name)}, born ${birthLine(owner)}.</div></div>
      <div class="note">A business, like any beginning, has its own chart: the moment it was founded. This report reads that chart for the enterprise, its money and its people, then sets it against the owner's. It describes how the two are inclined to work together, not what must happen.</div></div>`);

    page('business', 'The business\'s chart', () => `${head('The business\'s chart')}
      ${caveat}
      <p>The founding chart is read like a birth chart, but for an enterprise: each house becomes a part of the business.</p>
      <table><thead><tr><th>House</th><th>Signifies</th><th>Lord</th><th>Lord's place</th><th>Condition</th></tr></thead><tbody>
        ${BIZ_HOUSES.map(([h, what]) => { const l = B.lordOf(h); return `<tr><td>${ord(h)} ${sg(B.cusps[h - 1])}</td><td>${what}</td><td>${G(l)} ${N(l)}</td><td>${ord(B.B[l].house)}</td><td class="${B.P[l].total >= 4 ? 'pos' : B.P[l].total <= -4 ? 'neg' : ''}">${grade(B.P[l].total)}</td></tr>`; }).join('')}
        <tr><td>⊗ Fortune</td><td>its luck and circumstances</td><td>${G(RULER[signName(LB.fortune)])} ${N(RULER[signName(LB.fortune)])}</td><td>${ord(B.B[RULER[signName(LB.fortune)]].house)}</td><td>${grade(B.P[RULER[signName(LB.fortune)]].total)}</td></tr>
      </tbody></table>
      <h4>In brief</h4>
      <p>${(() => { const l10 = B.lordOf(10), l2 = B.lordOf(2), l11 = B.lordOf(11);
        const ben = T7.filter((id) => benefic(id) && [1, 10, 11, 2].includes(B.B[id].house)), mal = T7.filter((id) => malefic(id) && [1, 10].includes(B.B[id].house));
        return `The enterprise (10th) is governed by ${N(l10)}, ${grade(B.P[l10].total)}; its money (2nd) by ${N(l2)}, ${grade(B.P[l2].total)}; its profits (11th) by ${N(l11)}, ${grade(B.P[l11].total)}. ${ben.length ? `${ben.map(N).join(' and ')} ${ben.length > 1 ? 'stand' : 'stands'} in its houses of standing and gain, a good testimony for the venture.` : 'No benefic stands in its houses of standing and gain.'} ${mal.length ? `${mal.map(N).join(' and ')} on its 1st or 10th ${mal.length > 1 ? 'bring' : 'brings'} pressure to the enterprise itself.` : ''}`; })()}</p>
      ${cite('The chart of a beginning: Dorotheus, Carmen V (consulted, not quoted); Sahl ibn Bishr, On Elections; Bonatti, Liber Astronomiae. Houses: Lilly, Christian Astrology III.')}`);

    page('together', 'Owner and business together', () => {
      const ownerIn = T7.map((id) => { const h = B.houseOf(O.B[id].lon); return { id, h }; });
      const bizIn = T7.map((id) => { const h = O.houseOf(B.B[id].lon); return { id, h }; });
      const ascRel = relation(O.B[O.ascLord].lon, B.B[B.ascLord].lon), fRel = relation(LO.fortune, LB.fortune);
      const bizInOwner10 = B.houseOf(O.ch.angles.mc);
      return `${head('Owner and business together')}
      ${caveat}
      <h4>Agreement</h4>
      <table><tbody>
        <tr><td>Lords of the Ascendant</td><td>${fo}'s ${N(O.ascLord)} and the business's ${N(B.ascLord)}: ${ascRel}</td><td class="${harmonious(ascRel) ? 'pos' : 'neg'}">${harmonious(ascRel) ? 'In accord' : ascRel === 'aversion' ? 'Not in contact' : 'At odds'}</td></tr>
        <tr><td>Lots of Fortune</td><td>${fo}'s Fortune in ${signName(LO.fortune)}, the business's in ${signName(LB.fortune)}: ${fRel}</td><td class="${harmonious(fRel) ? 'pos' : 'neg'}">${harmonious(fRel) ? 'Luck runs together' : fRel === 'aversion' ? 'Separate fortunes' : 'Fortunes pull apart'}</td></tr>
        <tr><td>The business in the owner's life</td><td>Its Ascendant falls in ${fo}'s ${ord(O.houseOf(B.ch.angles.asc))} house: ${OWNER_TOPIC[O.houseOf(B.ch.angles.asc)]}</td><td class="${[1, 2, 10, 11].includes(O.houseOf(B.ch.angles.asc)) ? 'pos' : [6, 8, 12].includes(O.houseOf(B.ch.angles.asc)) ? 'neg' : ''}">${[1, 2, 10, 11].includes(O.houseOf(B.ch.angles.asc)) ? 'A natural fit' : [6, 8, 12].includes(O.houseOf(B.ch.angles.asc)) ? 'A burden or drain' : 'Neutral'}</td></tr>
        <tr><td>The owner's career in the business</td><td>${fo}'s Midheaven falls in the business's ${ord(bizInOwner10)}: ${BIZ_TOPIC[bizInOwner10]}</td><td></td></tr>
      </tbody></table>
      <div class="two"><div><h4>${esc(fo)}'s planets in the business's houses</h4><table><tbody>${ownerIn.map(({ id, h }) => `<tr><td class="c">${G(id)}</td><td>${N(id)}</td><td class="r">${ord(h)}</td><td class="${benefic(id) && [1, 2, 10, 11].includes(h) ? 'pos' : malefic(id) && [1, 2, 10, 11].includes(h) ? 'neg' : ''}">${BIZ_TOPIC[h]}</td></tr>`).join('')}</tbody></table></div>
      <div><h4>The business's planets in ${esc(fo)}'s houses</h4><table><tbody>${bizIn.map(({ id, h }) => `<tr><td class="c">${G(id)}</td><td>${N(id)}${role(id)}</td><td class="r">${ord(h)}</td><td>${OWNER_TOPIC[h]}</td></tr>`).join('')}</tbody></table></div></div>
      <p style="margin-top:6px">${(() => { const good = ownerIn.filter(({ id, h }) => benefic(id) && [1, 2, 10, 11].includes(h)), hard = ownerIn.filter(({ id, h }) => malefic(id) && [1, 2, 10, 11].includes(h));
        return `${good.length ? `${fo}'s ${good.map(({ id, h }) => `${N(id)} in the business's ${ord(h)}`).join(' and ')}: the owner brings help to ${good.map(({ h }) => BIZ_TOPIC[h]).join(' and ')}.` : `Neither of ${fo}'s benefics falls in the business's houses of standing and gain.`} ${hard.length ? `${fo}'s ${hard.map(({ id, h }) => `${N(id)} in its ${ord(h)}`).join(' and ')}: the owner's own drive or caution weighs on ${hard.map(({ h }) => BIZ_TOPIC[h]).join(' and ')}, to be managed.` : ''}`; })()}</p>
      ${cite('Each chart\'s planets in the other\'s houses, as in comparisons of two nativities; houses of a beginning after Lilly, Christian Astrology III.')}`;
    });

    page('contacts', 'Aspects and receptions', () => `${head('Aspects and receptions')}
      <p>${esc(fo)}'s planets, angles and Lot of Fortune against the business's, closest first. The business's planets are named for the houses they rule in its chart.</p>
      <table><thead><tr><th></th><th></th><th></th><th>Owner to business</th><th class="r">Orb</th></tr></thead><tbody>
        ${cross.slice(0, 18).map((x) => `<tr><td class="c">${G(x.a)}</td><td class="c gs">${ASP[x.aspect].glyph}</td><td class="c">${G(x.b)}</td><td>${fo}'s ${N(x.a)} ${ASP[x.aspect].name.toLowerCase()} the business's ${N(x.b)}${T7.includes(x.b) ? role(x.b) : ''}${benefic(x.a) || benefic(x.b) ? ' <span class="pos">· helps</span>' : malefic(x.a) || malefic(x.b) ? ' <span class="neg">· presses</span>' : ''}</td><td class="r">${x.orb.toFixed(1)}°</td></tr>`).join('') || '<tr><td>None within orb.</td></tr>'}
      </tbody></table>
      <h4>Receptions</h4>
      <table><tbody>${rec.slice(0, 7).map((r) => `<tr class="${r.mutual ? 'hi' : ''}"><td>${G(r.x)} ${G(r.y)}</td><td>${r.mutual ? `Mutual reception: ${fo}'s ${N(r.x)} and the business's ${N(r.y)}${role(r.y)}` : r.xByY ? `The business's ${N(r.y)}${role(r.y)} receives ${fo}'s ${N(r.x)} (${r.xByY})` : `${fo}'s ${N(r.x)} receives the business's ${N(r.y)}${role(r.y)} (${r.yByX})`}</td><td>${r.asp ? `in ${ASP[r.asp].name.toLowerCase()}` : '<span class="src">not in aspect</span>'}</td></tr>`).join('') || '<tr><td>No receptions.</td></tr>'}</tbody></table>
      ${cite('Aspects: Ptolemy, Tetrabiblos I. Reception: Lilly, Christian Astrology I; Bonatti, Liber Astronomiae.')}`);

    page('timing', 'Strong years together', () => {
      const oSp = (() => { const s = signIdx(LO.spirit), f = signIdx(LO.fortune); return s === f ? (s + 1) % 12 : s; })();
      const zrO = Fo.release(oSp, owner.ms, owner.ms + 100 * 365.2425 * 864e5, 1, 2), zrB = Fo.release(signIdx(LB.fortune), biz.ms, biz.ms + 100 * 365.2425 * 864e5, 1, 2);
      const at = (zr, t) => { const l1 = zr.find((p) => t >= p.from && t < p.to); return l1 && l1.subs.find((s) => t >= s.from && t < s.to); };
      const ageO = Math.floor((now - owner.ms) / (365.2425 * 864e5)), ageB = Math.floor((now - biz.ms) / (365.2425 * 864e5));
      const prO = R.profections(O), prB = R.profections(B);
      const rows = [0, 1, 2, 3, 4, 5].map((k) => {
        const t = now + k * 365.2425 * 864e5;
        const yo = prO.find((y) => y.a === ageO + k) || R.profections(O).slice(-1)[0], yb = prB.find((y) => y.a === ageB + k);
        const so = at(zrO, t), sb = at(zrB, t);
        const ao = so ? Fo.angle(so.sign, signIdx(LO.fortune)) : 0, ab = sb ? Fo.angle(sb.sign, signIdx(LB.fortune)) : 0;
        return { y: E.utcToZoned(t, owner.tz).y, yo, yb, so, sb, ao, ab, joint: ao && ab };
      });
      return `${head('Strong years together')}
      <p>Two timings run side by side: the owner's releasing from Spirit (action and career) and the business's releasing from its Fortune (its circumstances). A year when both are in signs angular to their Fortunes is a joint window: the time to expand, launch or invest.</p>
      <table><thead><tr><th>Year</th><th>${esc(fo)}: Spirit</th><th>Business: Fortune</th><th>${esc(fo)}'s Lord of the Year</th><th>Business's Lord of the Year</th></tr></thead><tbody>
        ${rows.map((r) => `<tr class="${r.joint ? 'hi' : ''}"><td>${r.y}</td><td>${r.so ? `${sg(r.so.sign * 30)} ${E.SIGNS[r.so.sign].name}${r.ao === 10 ? ' <b>peak</b>' : r.ao ? ' angular' : ''}` : '—'}</td><td>${r.sb ? `${sg(r.sb.sign * 30)} ${E.SIGNS[r.sb.sign].name}${r.ab === 10 ? ' <b>peak</b>' : r.ab ? ' angular' : ''}` : '—'}</td><td>${r.yo ? `${G(r.yo.lord)} ${N(r.yo.lord)} (${ord(r.yo.house)})` : '—'}</td><td>${r.yb ? `${G(r.yb.lord)} ${N(r.yb.lord)} (${ord(r.yb.house)})` : '—'}</td></tr>`).join('')}
      </tbody></table>
      <p style="margin-top:6px">${rows.some((r) => r.joint) ? `Joint windows: ${rows.filter((r) => r.joint).map((r) => r.y).join(', ')}.` : 'No year in the next six has both in an angular period; the single peaks are still the better times for each.'}</p>
      ${caveat}
      ${cite('Zodiacal releasing: Valens, Anthology IV. Profections: Valens IV. Each read from the business\'s founding as from a birth.')}`;
    });
    return { O, B, cross, rec, pages: S.pages };
  }

  const api = { build };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Business = api;
})(typeof window !== 'undefined' ? window : globalThis);
