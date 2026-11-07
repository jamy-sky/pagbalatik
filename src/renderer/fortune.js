/* Pagbalatik: fortune, Spirit and options. Chance and choice in the chart (the Lots of Fortune and Spirit), material
   fortune after Ptolemy, the seven Hermetic lots, the benefics, and when fortune's windows open: zodiacal releasing
   from Fortune and from Spirit, after Valens. */
(function (root) {
  'use strict';
  const K = root.ReportKit || require('./report-kit.js');
  const { E, W, R, esc, MONTHS, ASP, BODY, T7, ord, cap, signIdx, signName, sg, fmtLon, G, N, NA, grade, RULER, fmtDate, fmtBirth, offsetOf, norm180 } = K;

  // ---------- the lots ----------
  // Paulus Alexandrinus's seven lots, each the distance from one point to another projected from the Ascendant;
  // by night the order is reversed. Fortune and Spirit as in Valens (Ptolemy keeps the day formula for Fortune).
  const LOT_DEF = {
    fortune: { from: 'sun', to: 'moon', means: 'the body, circumstances and what comes by chance' },
    spirit: { from: 'moon', to: 'sun', means: 'the mind, intention, action and what one chooses' },
    eros: { from: 'spirit', to: 'venus', means: 'desire and appetite: what one wants and is drawn to' },
    necessity: { from: 'mercury', to: 'fortune', means: 'constraint and compulsion: what one must do, and struggle with' },
    courage: { from: 'mars', to: 'fortune', means: 'boldness and daring: the willingness to take risks' },
    victory: { from: 'spirit', to: 'jupiter', means: 'success, faith and help: what one wins and believes in' },
    nemesis: { from: 'saturn', to: 'fortune', means: 'reckoning: what cannot be escaped, hidden opposition' },
  };
  const LOT_ORDER = ['fortune', 'spirit', 'eros', 'necessity', 'courage', 'victory', 'nemesis'];
  function hermeticLots(ch, day) {
    const P = Object.fromEntries(ch.bodies.map((b) => [b.id, b.lon]));
    const asc = ch.angles.asc, out = {};
    for (const id of LOT_ORDER) {
      const d = LOT_DEF[id];
      const a = d.from in out ? out[d.from] : P[d.from], b = d.to in out ? out[d.to] : P[d.to];
      out[id] = E.norm(day ? asc + b - a : asc + a - b);
    }
    return out;
  }

  // ---------- zodiacal releasing (Valens, Anthology IV) ----------
  // Each sign's period is its ruler's minor years (Capricorn 27, as Valens has it). Years of 360 days; each level down
  // divides by twelve. After twelve periods within a parent the next one is "loosed": it jumps to the sign opposite
  // the parent's sign. Peaks: the signs angular to Fortune, the 10th from Fortune above all.
  const ZR_YEARS = { Aries: 15, Taurus: 8, Gemini: 20, Cancer: 25, Leo: 19, Virgo: 20, Libra: 8, Scorpio: 15, Sagittarius: 12, Capricorn: 27, Aquarius: 30, Pisces: 12 };
  const YEAR = 360 * 864e5;
  function release(startSign, from, to, level, levels = 2) {
    const unit = YEAR / 12 ** (level - 1);
    const out = [];
    let t = from, s = startSign, n = 0;
    while (t < to) {
      const loosed = n === 12;
      if (loosed) s = (startSign + 6) % 12;
      const len = ZR_YEARS[E.SIGNS[s].name] * unit;
      const end = Math.min(t + len, to);
      const p = { sign: s, from: t, to: end, level, loosed };
      if (level < levels) p.subs = release(s, t, end, level + 1, levels);
      out.push(p);
      t += len; s = (s + 1) % 12; n++;
    }
    return out;
  }
  const angle = (sign, fortuneSign) => ({ 0: 1, 3: 4, 6: 7, 9: 10 })[(sign - fortuneSign + 12) % 12] || 0;

  const PTOLEMY_WEALTH = { saturn: 'building, farming or shipping', jupiter: 'positions of trust, guardianships or priestly office', mars: 'military service and command', venus: 'gifts from friends or women', mercury: 'eloquence and trade', sun: 'the favour of the powerful (Ptolemy gives no rule for the lights; this is the usual reading)', moon: 'the public, travel and changing circumstances (likewise the usual reading)' };
  const HOUSE = ['', 'life, body and temperament', 'wealth and livelihood', 'siblings and short journeys', 'home, parents and land', 'children and pleasure', 'illness and work', 'partners and contracts', 'inheritance and others\' money', 'travel, learning and faith', 'profession and honour', 'friends, hopes and patrons', 'hidden enemies and retreat'];
  const relation = (a, b) => { const d = (signIdx(b) - signIdx(a) + 12) % 12; return d === 0 ? 'conjunction' : [2, 10].includes(d) ? 'sextile' : [4, 8].includes(d) ? 'trine' : [3, 9].includes(d) ? 'square' : d === 6 ? 'opposition' : 'aversion'; };

  function build(person, opts) {
    const o = { ...K.DEFAULTS, ...opts };
    const A = R.analyse(person, o);
    const ch = A.ch, tz = person.tz;
    const L = hermeticLots(ch, A.day);
    const fSign = signIdx(L.fortune), sSign = signIdx(L.spirit);
    // If Spirit shares Fortune's sign, Spirit is released from the next sign (Valens).
    const spiritStart = sSign === fSign ? (sSign + 1) % 12 : sSign;
    const now = o.now || Date.now();
    const lifeEnd = person.ms + 100 * 365.2425 * 864e5;
    const zrF = release(fSign, person.ms, lifeEnd, 1, 2);
    const zrS = release(spiritStart, person.ms, lifeEnd, 1, 2);
    const curF = zrF.find((p) => now >= p.from && now < p.to), curS = zrS.find((p) => now >= p.from && now < p.to);
    const age = (ms) => Math.floor((ms - person.ms) / (365.2425 * 864e5));
    const D = (ms) => fmtDate(ms, tz);
    const MY = (ms) => { const z = E.utcToZoned(ms, tz); return `${MONTHS[z.m - 1]} ${z.y}`; };
    const sub = `${esc(person.name)}<br>${fmtBirth(person)} ${offsetOf(person)} · ${esc(person.place.name)}`;
    const S = K.shell(o, sub, 'Fortune, Spirit and options');
    const { page, head, cite } = S;
    const lordOfLot = (id) => RULER[signName(L[id])];
    const seeing = (lon) => T7.map((id) => ({ id, rel: relation(lon, A.B[id].lon) })).filter((x) => x.rel !== 'aversion');
    const lotBlock = (id) => {
      const lon = L[id], h = A.houseOf(lon), lord = lordOfLot(id), Lp = A.P[lord];
      const see = seeing(lon);
      const ben = see.filter((x) => ['jupiter', 'venus'].includes(x.id)), mal = see.filter((x) => ['saturn', 'mars'].includes(x.id));
      return `<p>The ${LOT_DEF[id] && id === 'fortune' ? 'Lot of Fortune' : 'Lot of Spirit'} is in ${signName(lon)}, your ${ord(h)} house (${HOUSE[h]}). Its lord, ${N(lord)}, is in the ${ord(A.B[lord].house)} house, ${grade(Lp.total)}${[1, 4, 7, 10].includes(A.B[lord].house) ? ', angular and active' : [6, 8, 12].includes(A.B[lord].house) ? ', in one of the troubled houses' : ''}. ${ben.length ? `${ben.map((x) => `${N(x.id)} (by ${x.rel})`).join(' and ')} ${ben.length > 1 ? 'see' : 'sees'} it: help is at hand. ` : 'Neither benefic sees it. '}${mal.length ? `${mal.map((x) => `${N(x.id)} (by ${x.rel})`).join(' and ')} also ${mal.length > 1 ? 'see' : 'sees'} it${mal.some((x) => x.id === A.contraryMalefic) ? ', the malefic contrary to your sect among them' : ''}.` : 'No malefic sees it.'}</p>`;
    };
    const fsRel = relation(L.fortune, L.spirit);

    // 1. Chance and choice
    page('lots', 'Fortune and Spirit', () => `${head('Fortune, Spirit and options')}
      <p>The old astrologers set two lots at the heart of a life. <b>Fortune</b> (<i>Tyche</i>) is what comes to you: the body, circumstances, means, chance. <b>Spirit</b> (<i>Daimon</i>) is what you do: intention, action, profession, choice. Where they stand, and how they relate, says how chance and choice divide the life, and where there is room to choose.</p>
      <div class="facts"><div><b>${fmtLon(L.fortune)}</b>Lot of Fortune, ${ord(A.houseOf(L.fortune))} house</div><div><b>${G(lordOfLot('fortune'))} ${N(lordOfLot('fortune'))}</b>Lord of Fortune</div><div><b>${fmtLon(L.spirit)}</b>Lot of Spirit, ${ord(A.houseOf(L.spirit))} house</div><div><b>${G(lordOfLot('spirit'))} ${N(lordOfLot('spirit'))}</b>Lord of Spirit</div></div>
      <h4>Fortune: what comes</h4>${lotBlock('fortune')}
      <h4>Spirit: what you choose</h4>${lotBlock('spirit')}
      <h4>Chance and choice together</h4>
      <p>Fortune and Spirit are in ${fsRel === 'aversion' ? 'aversion (the signs do not see each other)' : fsRel}. ${{ conjunction: 'They share a sign: what happens and what you choose run together, so luck tends to follow effort and effort follows luck.', sextile: 'A sextile: chance and choice cooperate, and openings are easy to act on once seen.', trine: 'A trine: chance and choice agree. Opportunities arrive in a form you are ready to use; this is the most open arrangement.', square: 'A square: chance and choice pull against each other. Good fortune often comes on its own terms, and has to be fought for or adapted to.', opposition: 'An opposition: what comes and what you want face each other. Life offers trade-offs; balancing them is where the freedom lies.', aversion: 'They cannot see each other: circumstance and intention go separate ways, so luck arrives where you weren\'t looking, and plans succeed without much help from chance.' }[fsRel]}</p>
      ${cite('Fortune and Spirit: Valens, Anthology II and IV; Ptolemy, Tetrabiblos III (the Lot of Fortune, taken the same way by day and night). Here, as in Valens, the night formula is reversed.')}`);

    // 2. Material fortune
    page('wealth', 'Material fortune', () => {
      const lord = lordOfLot('fortune'), Lp = A.P[lord];
      const acq = (fSign + 10) % 12; // the 11th sign from Fortune
      const inAcq = T7.filter((id) => signIdx(A.B[id].lon) === acq);
      const secondLord = A.lordOf(2), inSecond = T7.filter((id) => A.B[id].house === 2);
      const ofSect = (id) => (A.day ? ['sun', 'jupiter', 'saturn'] : ['moon', 'venus', 'mars']).includes(id);
      return `${head('Material fortune')}
      <p>Ptolemy takes material fortune from the Lot of Fortune: the planets that govern it, their power, and the planets that aspect them. When the governing planets are strong, he says, they make one rich, each in its own way.</p>
      <h4>The lord of Fortune: ${N(lord)}</h4>
      <p>${N(lord)} governs your Lot of Fortune and is ${grade(Lp.total)} (${Lp.total > 0 ? '+' : ''}${Lp.total}), in the ${ord(A.B[lord].house)} house. By Ptolemy's rule its kind of wealth comes through <b>${PTOLEMY_WEALTH[lord]}</b>. ${Lp.total >= 4 ? 'Being well placed, it can deliver.' : 'Being weak, it delivers with effort, or late.'} ${ofSect(lord) ? 'It belongs to your sect, which by Ptolemy helps you keep what it brings.' : 'It is of the other sect, which by Ptolemy can bring loss as well as gain.'}</p>
      <h4>The place of acquisition: ${E.SIGNS[acq].name}</h4>
      <p>Valens counts the 11th sign from Fortune as the place of acquisition: what one gains. Yours is ${E.SIGNS[acq].name}, ruled by ${N(RULER[E.SIGNS[acq].name])} (${grade(A.P[RULER[E.SIGNS[acq].name]].total)}). ${inAcq.length ? `${inAcq.map(N).join(' and ')} ${inAcq.length > 1 ? 'are' : 'is'} there, ${inAcq.some((id) => ['jupiter', 'venus'].includes(id)) ? 'a benefic in the place of gain, among the best testimonies for acquisition' : inAcq.some((id) => ['saturn', 'mars'].includes(id)) ? 'a malefic in the place of gain: acquisitions come with labour or loss' : 'colouring how gains come'}.` : 'No planet is there, so its lord speaks for it.'}</p>
      <h4>The 2nd house</h4>
      <p>The house of livelihood is ruled by ${N(secondLord)}, ${grade(A.P[secondLord].total)}, in your ${ord(A.B[secondLord].house)}. ${inSecond.length ? `${inSecond.map(N).join(' and ')} ${inSecond.length > 1 ? 'are' : 'is'} in it.` : 'No planet is in it.'}</p>
      <h4>Inheritance</h4>
      <p>${seeing(L.fortune).some((x) => x.id === 'saturn') && relation(A.B.saturn.lon, A.B.jupiter.lon) !== 'aversion' ? 'Saturn is involved with your Fortune and in aspect with Jupiter: Ptolemy\'s testimony for inheritance, the stronger if they are on the upper angles.' : 'Ptolemy\'s particular testimony for inheritance (Saturn joined to Fortune and in aspect with Jupiter) is not present.'}</p>
      ${cite('Ptolemy, Tetrabiblos IV, "Of material fortune" (Robbins). The place of acquisition: Valens, Anthology II.')}`;
    });

    // 3. The seven lots
    page('hermetic', 'The seven lots', () => {
      const open = [], fixed = [];
      for (const id of ['fortune', 'courage', 'victory']) { const lord = lordOfLot(id); (A.P[lord].total >= 4 ? open : fixed).push(`${id === 'fortune' ? 'Fortune' : cap(id)}'s lord ${N(lord)} is ${grade(A.P[lord].total)}`); }
      for (const id of ['necessity', 'nemesis']) { const h = A.houseOf(L[id]); if ([1, 4, 7, 10].includes(h)) fixed.push(`${cap(id)} is angular, in your ${ord(h)}`); else open.push(`${cap(id)} is out of the angles, in your ${ord(h)}`); }
      return `${head('The seven lots')}
      <p>Paulus Alexandrinus gives seven lots, one for each planet, each measured from one point to another and projected from the Ascendant (reversed by night). Beyond Fortune and Spirit they speak of desire, necessity, courage, victory and reckoning.</p>
      <table><thead><tr><th>Lot</th><th>Signifies</th><th class="r">Position</th><th class="c">House</th><th>Lord</th></tr></thead><tbody>
        ${LOT_ORDER.map((id) => { const lord = lordOfLot(id); return `<tr><td>${G(id)} ${N(id).replace('Lot of ', '')}</td><td>${LOT_DEF[id].means}</td><td class="r">${fmtLon(L[id])}</td><td class="c">${A.houseOf(L[id])}</td><td>${G(lord)} ${grade(A.P[lord].total).split(' ')[0]}</td></tr>`; }).join('')}
      </tbody></table>
      <h4>Where life is open, where it is fixed</h4>
      <p>One way to read optionality from the lots: where the lords of Fortune, Courage and Victory are strong, life gives room to move; where Necessity and Nemesis are angular, some things must be met as they come.</p>
      <div class="two"><div><h5>Open</h5><ul class="why">${open.map((t) => `<li>${t}.</li>`).join('') || '<li>Little from these lots.</li>'}</ul></div><div><h5>Fixed</h5><ul class="why">${fixed.map((t) => `<li>${t}.</li>`).join('') || '<li>Little from these lots.</li>'}</ul></div></div>
      <p>${open.length > fixed.length ? 'On balance the chart leaves more room than it fixes: options are there to be taken.' : open.length < fixed.length ? 'On balance more is fixed than open: freedom lies less in choosing what happens than in how it is met.' : 'Open and fixed are evenly balanced.'}</p>
      ${cite('The seven lots and their formulas: Paulus Alexandrinus, Introductory Matters (Greek text); as set out in C. Brennan, "The Theoretical Rationale Underlying the Seven Hermetic Lots" (2009). Meanings in our own words.')}`;
    });

    // 4. Timing: zodiacal releasing
    const zrTable = (list, cur) => `<table><thead><tr><th>Sign</th><th>From</th><th>Ages</th><th>Lord</th><th></th></tr></thead><tbody>${list.filter((p) => age(p.from) < 95).map((p) => {
      const ang = angle(p.sign, fSign); const name = E.SIGNS[p.sign].name;
      return `<tr class="${p === cur ? 'hi' : ''}"><td>${sg(p.sign * 30)} ${name}</td><td>${MY(p.from)}</td><td>${age(p.from)}–${age(p.to)}</td><td>${G(RULER[name])}</td><td>${ang === 10 ? '<b>Peak</b>' : ang ? `angle (${ord(ang)})` : ''}${p.loosed ? ' · loosed' : ''}</td></tr>`; }).join('')}</tbody></table>`;
    // The peak sub-periods (angular to Fortune) in the next ten years, from both lots.
    const peaksAhead = (list, lot) => list.flatMap((p) => p.subs.map((s) => ({ ...s, parent: p, lot }))).filter((s) => s.to > now && s.from < now + YEAR * 10 && angle(s.sign, fSign));
    const ahead = peaksAhead(zrF, 'Fortune').concat(peaksAhead(zrS, 'Spirit')).sort((a, b) => a.from - b.from).slice(0, 12);

    page('releasing', 'Timing: the life in periods', () => `${head('Timing: the life in periods')}
      <p>Valens divides the life into periods released from Fortune (for circumstances, body and luck) and from Spirit (for action, career and choice). Each period belongs to a sign and lasts its ruler's years; the signs angular to Fortune, above all the 10th from it, are the <b>peaks</b>, when what the lot signifies is most active and visible.</p>
      <div class="two"><div><h4>From Fortune</h4>${zrTable(zrF, curF)}</div><div><h4>From Spirit${spiritStart !== sSign ? ' (from the next sign)' : ''}</h4>${zrTable(zrS, curS)}</div></div>
      <p style="margin-top:8px">Each period divides into sub-periods in the same way, in months. When the sub-periods have gone once round the zodiac and the period still runs on, the next is <b>loosed</b> to the opposite sign: Valens's "loosing of the bond", often a turning point.</p>
      ${sublist(curF, 'Fortune')}
      ${cite('Zodiacal releasing: Valens, Anthology IV. Years of 360 days; Capricorn 27 years, Aquarius 30; periods after a full round loosed to the opposite sign; peaks angular to Fortune.')}`);

    const sublist = (cur, label) => {
      if (!cur) return '';
      const subs = cur.subs.filter((p) => p.to > now - YEAR * 2 && p.from < now + YEAR * 6);
      return `<h4>${label}: the current ${E.SIGNS[cur.sign].name} period, by months</h4><table><thead><tr><th>Sub-period</th><th>From</th><th>To</th><th></th></tr></thead><tbody>${subs.map((p) => {
        const ang = angle(p.sign, fSign); const isNow = now >= p.from && now < p.to;
        return `<tr class="${isNow ? 'hi' : ''}"><td>${sg(p.sign * 30)} ${E.SIGNS[p.sign].name}${isNow ? ' (now)' : ''}</td><td>${D(p.from)}</td><td>${D(p.to)}</td><td>${ang === 10 ? '<b>Peak</b>' : ang ? `angle (${ord(ang)})` : ''}${p.loosed ? ' · <b>loosing of the bond</b>' : ''}</td></tr>`; }).join('')}</tbody></table>`;
    };
    page('subperiods', 'The next few years', () => `${head('The next few years')}
      ${sublist(curS, 'Spirit')}
      <h4>Peaks ahead: when the windows open</h4>
      <p>The sub-periods in the next ten years whose sign is angular to Fortune. Peaks from Spirit favour action and ambition; peaks from Fortune bring circumstances and luck to the surface. The 10th from Fortune is the strongest.</p>
      <table><thead><tr><th>Released from</th><th>Sign</th><th>From</th><th>To</th><th></th></tr></thead><tbody>
        ${ahead.map((s) => `<tr class="${angle(s.sign, fSign) === 10 ? 'hi' : ''}"><td>${s.lot}</td><td>${sg(s.sign * 30)} ${E.SIGNS[s.sign].name}</td><td>${D(Math.max(s.from, now))}</td><td>${D(s.to)}</td><td>${angle(s.sign, fSign) === 10 ? '<b>Peak (10th)</b>' : `angle (${ord(angle(s.sign, fSign))})`}${s.loosed ? ' · loosed' : ''}</td></tr>`).join('') || '<tr><td>No angular sub-period in the next ten years.</td></tr>'}
      </tbody></table>
      ${cite('Valens, Anthology IV. Sub-periods: each sign\'s years as months of 30 days.')}`);

    // 5. Working with fortune
    page('work', 'Working with fortune', () => {
      const lord = lordOfLot('fortune'), benefic = A.sectBenefic;
      const days = [];
      const start = E.utcToZoned(now, tz);
      for (let i = 1; i <= 75 && days.length < 6; i++) {
        const t = new Date(Date.UTC(start.y, start.m - 1, start.d + i));
        const wd = t.getUTCDay();
        const ms = E.zonedToUtc(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate(), 12, 0, tz);
        const moon = E.chart(ms, person.place.lat, person.place.lon).bodies[1].lon;
        const rel = relation(moon, L.fortune);
        if (![0, 1, 2, 3, 4, 5, 6].map((d) => ['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn'][d])[wd].match(new RegExp(`^(${lord}|${benefic})$`))) continue;
        if (!['conjunction', 'sextile', 'trine'].includes(rel)) continue;
        days.push(`${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][wd]} ${t.getUTCDate()} ${MONTHS[t.getUTCMonth()]}`);
      }
      return `${head('Working with fortune')}
      <p>Fortune can't be chosen, but its windows can. Three practical rules follow from the chart:</p>
      <h5>Act in the peaks</h5><p>Begin what matters most during peak periods and sub-periods from Spirit (for action and career) and from Fortune (for circumstances). ${curS && angle(curS.sign, fSign) ? 'You are in an angular period from Spirit now.' : 'The next peak is marked in the tables before.'}</p>
      <h5>Strengthen the lord of Fortune</h5><p>${N(lord)} governs your Fortune. Work on its days and in its hours, and with the Moon well placed to the Lot of Fortune; the natal reading's remedies for ${N(lord)} apply here too.</p>
      <h5>Lean on the benefic of your sect</h5><p>${N(benefic)} is the benefic of your sect, the planet whose help comes most fully. Ask for favours, sign agreements and start ventures on its days.</p>
      <h4>Next suitable days</h4><p>${days.length ? `Days of ${N(lord)}${lord !== benefic ? ` or ${N(benefic)}` : ''} with the Moon in a sign that sees your Fortune: ${days.join(' · ')}.` : 'No day in the next ten weeks combines the right weekday with the Moon well placed to Fortune.'}</p>
      ${cite('Elections: Sahl ibn Bishr, On Elections; Bonatti, Liber Astronomiae. Planetary days: Agrippa, Three Books of Occult Philosophy.')}`;
    });
    return { A, lots: L, zrF, zrS, curF, curS, pages: S.pages };
  }

  const api = { build, hermeticLots, release, angle, ZR_YEARS, LOT_ORDER };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Fortune = api;
})(typeof window !== 'undefined' ? window : globalThis);
