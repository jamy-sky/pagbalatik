/* Pagbalatik: the comparison of two charts. The two side by side, the aspects between them, where each one's planets
   fall in the other's houses, receptions between them, and Ptolemy's judgment of a partnership from the lights. */
(function (root) {
  'use strict';
  const K = root.ReportKit || require('./report-kit.js');
  const { E, W, R, esc, ASP, BODY, T7, ord, cap, signIdx, signName, sg, fmtLon, G, N, NA, grade, RULER, fmtBirth, offsetOf, norm180 } = K;

  const ORB_SCALE = 0.6; // of the natal orbs: conjunction and opposition 4.8°, square and trine 4.2°, sextile 2.4°
  const HOUSE_OVERLAY = ['', 'their self and body: a strong, personal impression', 'their money and means: practical give and take', 'their daily dealings and siblings: easy, everyday company', 'their home and family: a domestic, rooted bond', 'their pleasure and children: play, romance and creativity', 'their work and health: service, routine and care', 'their partnerships: the relationship as such', 'their shared resources and endings: depth, debt and change', 'their travel, study and faith: ideas and horizons', 'their career and standing: public life and ambition', 'their friends and hopes: friendship and shared aims', 'their hidden matters: what is private, sometimes undoing'];
  const PLANET_GIFT = { sun: 'warmth, attention and authority', moon: 'feeling, care and familiarity', mercury: 'talk, ideas and wit', venus: 'affection, pleasure and grace', mars: 'drive, desire and friction', jupiter: 'generosity, faith and help', saturn: 'seriousness, duty and limits' };
  const EXALT_BY_SIGN = Object.fromEntries(Object.entries(R.EXALT).map(([p, s]) => [s, p]));

  function points(A) {
    return T7.map((id) => ({ id, lon: A.B[id].lon })).concat([{ id: 'asc', lon: A.ch.angles.asc }, { id: 'mc', lon: A.ch.angles.mc }, { id: 'fortune', lon: A.fortune }]);
  }
  /** Receptions across the two charts: a planet of one in a sign (domicile or exaltation) of a planet of the other. */
  function receptions(A, B, aName, bName) {
    const out = [];
    for (const x of T7) for (const y of T7) {
      const xs = A.B[x].sign.name, ys = B.B[y].sign.name;
      const xByY = RULER[xs] === y ? 'domicile' : EXALT_BY_SIGN[xs] === y ? 'exaltation' : null;
      const yByX = RULER[ys] === x ? 'domicile' : EXALT_BY_SIGN[ys] === x ? 'exaltation' : null;
      if (!xByY && !yByX) continue;
      const sep = Math.abs(norm180(A.B[x].lon - B.B[y].lon));
      const asp = E.ASPECTS.find((a) => Math.abs(sep - a.angle) <= a.orb * ORB_SCALE);
      out.push({ x, y, mutual: !!(xByY && yByX), xByY, yByX, asp: asp ? asp.id : null });
    }
    return out.sort((a, b) => (b.mutual - a.mutual) || (!!b.asp - !!a.asp));
  }
  /** Ptolemy's test of a partnership: the lights of the two charts to each other. */
  function lights(A, B) {
    const pairs = [['sun', 'sun'], ['moon', 'moon'], ['sun', 'moon'], ['moon', 'sun']];
    return pairs.map(([x, y]) => {
      const d = (signIdx(B.B[y].lon) - signIdx(A.B[x].lon) + 12) % 12;
      const rel = d === 0 ? 'conjunction' : [2, 10].includes(d) ? 'sextile' : [4, 8].includes(d) ? 'trine' : [3, 9].includes(d) ? 'square' : d === 6 ? 'opposition' : 'aversion';
      const tone = ['sextile', 'trine'].includes(rel) ? 'harmonious' : rel === 'conjunction' ? 'joined' : rel === 'aversion' ? 'disjunct' : 'discordant';
      return { x, y, rel, tone };
    });
  }

  function build(a, b, opts) {
    const o = { ...K.DEFAULTS, ...opts };
    const A = R.analyse(a, o), B = R.analyse(b, o);
    const fa = a.name.split(' ')[0], fb = b.name.split(' ')[0];
    const cross = E.aspects(points(A), points(B), { orbScale: ORB_SCALE })
      .filter((x) => !(['asc', 'mc', 'fortune'].includes(x.a) && ['asc', 'mc', 'fortune'].includes(x.b)));
    const rec = receptions(A, B);
    const L = lights(A, B);
    const sub = `${esc(a.name)} &amp; ${esc(b.name)}<br>${fmtBirth(a)} · ${fmtBirth(b)}`;
    const S = K.shell(o, sub, `Comparison · ${esc(a.name)} & ${esc(b.name)}`);
    const { page, head, cite, brand } = S;
    const benefic = (id) => ['jupiter', 'venus'].includes(id), malefic = (id) => ['saturn', 'mars'].includes(id);
    const flows = cross.filter((x) => (ASP[x.aspect].kind === 'soft' || (x.aspect === 'conjunction' && !malefic(x.a) && !malefic(x.b))) && (benefic(x.a) || benefic(x.b) || ['sun', 'moon', 'asc'].includes(x.a) || ['sun', 'moon', 'asc'].includes(x.b)));
    const rubs = cross.filter((x) => (ASP[x.aspect].kind === 'hard' || (x.aspect === 'conjunction' && (malefic(x.a) || malefic(x.b)))) && (malefic(x.a) || malefic(x.b) || ASP[x.aspect].kind === 'hard'));
    const asText = (x) => `${fa}'s ${N(x.a)} ${ASP[x.aspect].name.toLowerCase()} ${fb}'s ${N(x.b)}`;
    function note(x) {
      const give = (id) => PLANET_GIFT[id] || (id === 'asc' ? 'the person themselves, body and manner' : id === 'mc' ? 'their aims and standing' : 'their circumstances and luck');
      const k = ASP[x.aspect].kind;
      const how = k === 'soft' ? 'flows easily between them' : k === 'hard' ? 'meets with friction and has to be worked at' : 'is fused, for good or ill';
      return `${fa}'s ${N(x.a)} (${give(x.a)}) and ${fb}'s ${N(x.b)} (${give(x.b)}): what they bring ${how}.${malefic(x.a) || malefic(x.b) ? ` With ${malefic(x.a) ? `${fa}'s ${N(x.a)}` : `${fb}'s ${N(x.b)}`} involved, the contact carries weight or heat.` : ''}${benefic(x.a) || benefic(x.b) ? ' A benefic is involved, so there is goodwill in it.' : ''}`;
    }
    const sideRow = (label, fn) => `<tr><td>${label}</td><td>${fn(A, a)}</td><td>${fn(B, b)}</td></tr>`;
    const temp = (X) => R.temperament(X).name;

    page('cover', 'The two charts', () => `<div class="cover">${brand()}
      <div class="mid" style="margin-top:22px"><div class="kicker">A comparison of two charts</div><div class="t" style="font-size:26px">${esc(a.name)} &amp; ${esc(b.name)}</div>
      <div class="wheel-wrap">${W.svg(A.ch, B.ch, { modern: o.modern !== 'off' })}</div>
      <div class="d">Inner wheel: ${esc(a.name)}, born ${fmtBirth(a)}, ${esc(a.place.name)}. Outer ring: ${esc(b.name)}, born ${fmtBirth(b)}, ${esc(b.place.name)}.</div></div>
      <div class="note">The comparison follows Ptolemy's judgment of partnership and the traditional reading of one chart's planets in the other's houses, in our own words. It describes how two people's inclinations meet, not what must happen between them.</div></div>`);

    page('side', 'Side by side', () => `${head('Side by side')}
      <table><thead><tr><th></th><th>${esc(a.name)}</th><th>${esc(b.name)}</th></tr></thead><tbody>
        ${sideRow('Sect', (X) => (X.day ? 'Day chart' : 'Night chart'))}
        ${sideRow('Rising', (X) => `${fmtLon(X.ch.angles.asc)} ${signName(X.ch.angles.asc)}`)}
        ${sideRow('Sun', (X) => `${fmtLon(X.B.sun.lon)} ${X.B.sun.sign.name}, ${ord(X.B.sun.house)} house`)}
        ${sideRow('Moon', (X) => `${fmtLon(X.B.moon.lon)} ${X.B.moon.sign.name}, ${ord(X.B.moon.house)} house`)}
        ${sideRow('Lord of the Ascendant', (X) => `${G(X.ascLord)} ${N(X.ascLord)}, ${grade(X.P[X.ascLord].total)}`)}
        ${sideRow('Lord of the 7th (partners)', (X) => `${G(X.lordOf(7))} ${N(X.lordOf(7))}, in the ${ord(X.B[X.lordOf(7)].house)}, ${grade(X.P[X.lordOf(7)].total)}`)}
        ${sideRow('Venus', (X) => `${fmtLon(X.B.venus.lon)}, ${ord(X.B.venus.house)} house, ${grade(X.P.venus.total)}`)}
        ${sideRow('Temperament', temp)}
        ${sideRow('Strongest planet', (X) => `${G(X.ranked[0])} ${N(X.ranked[0])}`)}
      </tbody></table>
      <h4>Temperaments</h4><p>${temp(A) === temp(B) ? `Both are ${temp(A).toLowerCase()}: alike in pace and humour, which makes for easy understanding, though the same excess can run unchecked in both.` : `${fa} is ${temp(A).toLowerCase()}, ${fb} ${temp(B).toLowerCase()}. Different humours can balance each other, ${['Choleric|Phlegmatic', 'Phlegmatic|Choleric', 'Sanguine|Melancholic', 'Melancholic|Sanguine'].includes(`${temp(A)}|${temp(B)}`) ? 'and these two are opposites, each supplying what the other lacks, though they may find each other hard to read' : 'and these two share one quality, which gives common ground'}.`}</p>
      <h4>The houses of partnership</h4>
      <p>${fa}'s 7th house is ruled by ${N(A.lordOf(7))}; ${b.name.split(' ')[0]}'s by ${N(B.lordOf(7))}. ${A.lordOf(7) === B.lordOf(7) ? 'The same planet governs partnership in both charts, a point of natural agreement about what a partner should be.' : `${fa}'s partner-planet falls in ${fb}'s ${ord(A.houseOf ? B.houseOf(A.B[A.lordOf(7)].lon) : 1)} house, and ${fb}'s in ${fa}'s ${ord(A.houseOf(B.B[B.lordOf(7)].lon))}: ${HOUSE_OVERLAY[B.houseOf(A.B[A.lordOf(7)].lon)].split(':')[0]}, and ${HOUSE_OVERLAY[A.houseOf(B.B[B.lordOf(7)].lon)].split(':')[0]}.`}</p>
      ${cite('Temperament: Lilly, Christian Astrology III. The 7th house and its lord: Lilly III; Valens, Anthology II.')}`);

    page('lights', 'The lights and the bond', () => `${head('The lights and the bond')}
      <p>Ptolemy judges whether a partnership lasts from the Sun and Moon of the two charts. When they are in harmonious aspect (trine or sextile) the bond tends to last, especially when one person's Moon is so placed with the other's Sun; when they are square, opposed, or in signs that don't see each other at all, it is prone to estrangement. Benefics aspecting the lights make it pleasant; malefics make it quarrelsome.</p>
      <table><thead><tr><th>${esc(a.name)}</th><th>${esc(b.name)}</th><th>By sign</th><th>Judgment</th></tr></thead><tbody>
        ${L.map((l) => `<tr class="${l.tone === 'harmonious' ? 'hi' : ''}"><td>${G(l.x)} ${N(l.x)} ${sg(A.B[l.x].lon)}</td><td>${G(l.y)} ${N(l.y)} ${sg(B.B[l.y].lon)}</td><td>${cap(l.rel)}</td><td>${l.tone === 'harmonious' ? 'Lasting' : l.tone === 'joined' ? 'Joined: strong, for good or ill' : l.tone === 'disjunct' ? 'Disjunct: hard to see each other' : 'Discordant: prone to estrangement'}</td></tr>`).join('')}
      </tbody></table>
      <p style="margin-top:8px">${(() => { const h = L.filter((l) => l.tone === 'harmonious').length, d = L.filter((l) => l.tone === 'discordant' || l.tone === 'disjunct').length;
        const cross2 = L.slice(2).some((l) => l.tone === 'harmonious');
        return h > d ? `The lights agree more than they disagree${cross2 ? ', and one person\'s Moon sees the other\'s Sun harmoniously, which Ptolemy counts most' : ''}: by his rule, a bond that tends to last.` : h === d ? 'The lights are divided: some harmonious, some not. Ptolemy would look to the benefics for what keeps it pleasant.' : 'The lights are mostly at odds. By Ptolemy\'s rule such bonds need care, and benefics in contact with the lights are what soften them.'; })()}</p>
      <h4>Benefics and malefics to the lights</h4>
      <table><tbody>${cross.filter((x) => (['sun', 'moon'].includes(x.a) && ['jupiter', 'venus', 'saturn', 'mars'].includes(x.b)) || (['sun', 'moon'].includes(x.b) && ['jupiter', 'venus', 'saturn', 'mars'].includes(x.a))).slice(0, 10).map((x) => `<tr><td>${G(x.a)} ${G(x.b)}</td><td>${asText(x)}</td><td>${benefic(x.a) || benefic(x.b) ? '<span class="pos">pleasant</span>' : '<span class="neg">quarrelsome</span>'}</td><td class="r">${x.orb.toFixed(1)}°</td></tr>`).join('') || '<tr><td>None within orb.</td></tr>'}</tbody></table>
      <h4>Receptions between the charts</h4>
      <p>When a planet in one chart stands in a sign the other's planet rules, that planet "receives" it: a welcome, and mutual reception is an exchange of hospitality.</p>
      <table><tbody>${rec.slice(0, 8).map((r) => `<tr class="${r.mutual ? 'hi' : ''}"><td>${G(r.x)} ${G(r.y)}</td><td>${r.mutual ? `Mutual reception: ${fa}'s ${N(r.x)} and ${fb}'s ${N(r.y)}` : r.xByY ? `${fb}'s ${N(r.y)} receives ${fa}'s ${N(r.x)} (${r.xByY})` : `${fa}'s ${N(r.x)} receives ${fb}'s ${N(r.y)} (${r.yByX})`}</td><td>${r.asp ? `in ${ASP[r.asp].name.toLowerCase()}` : '<span class="src">not in aspect</span>'}</td></tr>`).join('') || '<tr><td>No receptions between the seven planets.</td></tr>'}</tbody></table>
      ${cite('Ptolemy, Tetrabiblos IV, "Of marriage" (Robbins). Reception: Lilly, Christian Astrology I; Bonatti, Liber Astronomiae.')}`);

    page('aspects', 'Aspects between the charts', () => `${head('Aspects between the charts')}
      <p>Each planet, angle and Lot of Fortune of ${esc(a.name)} against those of ${esc(b.name)}, within ${Math.round(ORB_SCALE * 100)}% of the natal orbs, closest first.</p>
      <table><thead><tr><th></th><th></th><th></th><th>${esc(fa)} to ${esc(fb)}</th><th class="r">Orb</th></tr></thead><tbody>
        ${cross.slice(0, 22).map((x) => `<tr><td class="c">${G(x.a)}</td><td class="c gs">${ASP[x.aspect].glyph}</td><td class="c">${G(x.b)}</td><td>${asText(x)}</td><td class="r">${x.orb.toFixed(1)}°</td></tr>`).join('')}
      </tbody></table>
      <h4>The closest contacts, read</h4>
      ${cross.filter((x) => T7.includes(x.a) && T7.includes(x.b)).slice(0, 5).map((x) => `<p><b>${asText(x)}.</b> ${note(x)}</p>`).join('')}
      ${cite('Aspects and their natures: Ptolemy, Tetrabiblos I; Lilly, Christian Astrology I.')}`);

    page('houses', 'Each in the other\'s houses', () => {
      const overlay = (X, Y, xName, yName) => T7.map((id) => { const h = Y.houseOf(X.B[id].lon); return `<tr><td class="c">${G(id)}</td><td>${xName}'s ${N(id)}</td><td class="r">${ord(h)}</td><td>${HOUSE_OVERLAY[h].split(':')[0]}</td></tr>`; }).join('');
      const strong = (X, Y, xName, yName) => T7.filter((id) => [1, 5, 7, 10, 11].includes(Y.houseOf(X.B[id].lon))).map((id) => { const h = Y.houseOf(X.B[id].lon); return `${xName}'s ${N(id)} in ${yName}'s ${ord(h)} brings ${PLANET_GIFT[id]} into ${HOUSE_OVERLAY[h].split(':')[1].trim()}.`; }).join(' ');
      return `${head('Each in the other\'s houses')}
      <p>Where one person's planets fall in the other's chart shows which part of the other's life they touch.</p>
      <div class="two"><div><h4>${esc(fa)}'s planets in ${esc(fb)}'s houses</h4><table><tbody>${overlay(A, B, esc(fa), esc(fb))}</tbody></table></div>
      <div><h4>${esc(fb)}'s planets in ${esc(fa)}'s houses</h4><table><tbody>${overlay(B, A, esc(fb), esc(fa))}</tbody></table></div></div>
      <h4>The telling placements</h4>
      <p>${strong(A, B, esc(fa), esc(fb)) || `None of ${esc(fa)}'s planets falls in ${esc(fb)}'s 1st, 5th, 7th, 10th or 11th.`}</p>
      <p>${strong(B, A, esc(fb), esc(fa)) || `None of ${esc(fb)}'s planets falls in ${esc(fa)}'s 1st, 5th, 7th, 10th or 11th.`}</p>
      <h4>Where it flows, where it rubs</h4>
      <div class="two"><div><table><tbody>${flows.slice(0, 7).map((x) => `<tr><td class="c">${G(x.a)}${G(x.b)}</td><td>${asText(x)}</td></tr>`).join('') || '<tr><td>—</td></tr>'}</tbody></table></div>
      <div><table><tbody>${rubs.slice(0, 7).map((x) => `<tr><td class="c">${G(x.a)}${G(x.b)}</td><td>${asText(x)}</td></tr>`).join('') || '<tr><td>—</td></tr>'}</tbody></table></div></div>
      ${cite('Houses and their topics: Valens, Anthology II; Lilly, Christian Astrology III. Houses are ' + (o.houses === 'whole' ? 'whole signs' : o.houses) + '.')}`;
    });
    return { A, B, cross, rec, lights: L, pages: S.pages };
  }

  const api = { build, receptions, lights };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Synastry = api;
})(typeof window !== 'undefined' ? window : globalThis);
