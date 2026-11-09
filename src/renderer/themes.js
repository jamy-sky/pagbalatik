/* Pagbalatik: themed forecasts. One engine (the transit forecast's search, forecast.js) aimed at one area of life:
   money, travel, or military service. Each theme brings its own significators (grouped into areas), its natal promise,
   its timing layers and its sources. */
(function (root) {
  'use strict';
  const K = root.ReportKit || require('./report-kit.js');
  const F = root.Forecast || require('./forecast.js');
  const Fo = root.Fortune || require('./fortune.js');
  const { E, W, R, esc, MONTHS, ASP, BODY, T7, ord, cap, signIdx, signName, sg, fmtLon, G, N, NA, grade, RULER, fmtDate, fmtBirth, offsetOf, norm180 } = K;

  // Mars, Jupiter and Saturn by every aspect; each theme's own fast planet by conjunction and opposition only.
  const SLOW = ['mars', 'jupiter', 'saturn'];
  const YEAR = 360 * 864e5;
  const isBenefic = (p) => ['jupiter', 'venus'].includes(p), isMalefic = (p) => ['saturn', 'mars'].includes(p);
  const SIGN_CLASS = { fire: 'fire', earth: 'earth', air: 'air', water: 'water' };

  /** How a transit leans: by the transiting planet's nature and the aspect. */
  function tone(e) {
    const k = ASP[e.aspect].kind;
    if (isBenefic(e.p)) return k === 'hard' ? ['mixed', 'Favourable, with strain'] : ['good', 'Favourable'];
    if (isMalefic(e.p)) return k === 'soft' ? ['mixed', 'Workable'] : ['bad', 'Testing'];
    return k === 'soft' ? ['good', 'Favourable'] : k === 'hard' ? ['bad', 'Testing'] : ['mixed', 'Mixed'];
  }
  const toneCell = (e) => { const [c, t] = tone(e); return `<span class="${c === 'good' ? 'pos' : c === 'bad' ? 'neg' : ''}">${t}</span>`; };

  // ---------- the themes ----------
  // groups: [{ id, title, meaning, targets: [[pointId, lon, label]] }]; houses: the houses whose ingresses matter.
  const THEMES = {
    money: {
      title: 'Money forecast', foot: 'Money forecast',
      intro: 'The transits that touch money, grouped by the area of finances each one concerns: income, gains, earnings from work, other people\'s money, partners, property, speculation and losses. Benefics in contact promise ease or increase; malefics, pressure, delay or cost.',
      houses: [2, 8, 10, 11], fast: ['venus'],
      groups(A, L) {
        const lot = (id) => [[id, L[id], `the ${K.N(id)}`]];
        const lord = (h, what) => { const p = A.lordOf(h); return [[p, A.B[p].lon, `natal ${N(p)}, lord of the ${ord(h)} (${what})`]]; };
        const acq = E.SIGNS[(signIdx(L.fortune) + 10) % 12].name, acqLord = RULER[acq];
        return [
          { id: 'income', title: 'Income and livelihood', meaning: 'The 2nd house and the Lot of Fortune: what you live on.', targets: [...lord(2, 'livelihood'), ...lot('fortune'), [RULER[signName(L.fortune)], A.B[RULER[signName(L.fortune)]].lon, `natal ${N(RULER[signName(L.fortune)])}, lord of Fortune`]] },
          { id: 'gains', title: 'Gains and windfalls', meaning: `The 11th house, and ${acq}, the 11th sign from Fortune (Valens's place of acquisition): what comes in beyond the usual.`, targets: [...lord(11, 'gains and patrons'), [acqLord, A.B[acqLord].lon, `natal ${N(acqLord)}, lord of the place of acquisition`]] },
          { id: 'career', title: 'Earnings from work', meaning: 'The 10th house and the Lot of Spirit: what you earn by what you do.', targets: [...lord(10, 'career'), ['mc', A.ch.angles.mc, 'the Midheaven'], ...lot('spirit')] },
          { id: 'others', title: 'Other people\'s money: loans, debts, taxes, inheritance', meaning: 'The 8th house: money that passes between you and others.', targets: lord(8, 'others\' money') },
          { id: 'partners', title: 'Partners and contracts', meaning: 'The 7th house: agreements, partnerships and the other party.', targets: lord(7, 'partners') },
          { id: 'property', title: 'Property and land', meaning: 'The 4th house: home, land and fixed assets.', targets: lord(4, 'property') },
          { id: 'speculation', title: 'Speculation and gifts', meaning: 'The 5th house: risk-taking, play and gifts.', targets: lord(5, 'speculation and gifts') },
          { id: 'losses', title: 'Losses and hidden costs', meaning: 'The 12th house: drains, hidden costs and what slips away.', targets: lord(12, 'losses') },
        ];
      },
      promise(A, L) {
        const fl = RULER[signName(L.fortune)], Lp = A.P[fl], second = A.lordOf(2);
        const acq = (signIdx(L.fortune) + 10) % 12, inAcq = T7.filter((id) => signIdx(A.B[id].lon) === acq);
        const WEALTH = { saturn: 'building, farming or shipping', jupiter: 'positions of trust, guardianships or priestly office', mars: 'military service and command', venus: 'gifts from friends or women', mercury: 'eloquence and trade', sun: 'the favour of the powerful (the usual reading; Ptolemy gives no rule for the lights)', moon: 'the public and changing circumstances (likewise)' };
        return `<p>Ptolemy takes material fortune from the planet that rules the Lot of Fortune. Yours is <b>${N(fl)}</b>, ${grade(Lp.total)}, in the ${ord(A.B[fl].house)} house: by his rule, wealth through <b>${WEALTH[fl]}</b>. The 2nd house is ruled by ${N(second)}, ${grade(A.P[second].total)}. ${inAcq.length ? `${inAcq.map(N).join(' and ')} ${inAcq.length > 1 ? 'stand' : 'stands'} in the place of acquisition (${E.SIGNS[acq].name}).` : `No planet stands in the place of acquisition (${E.SIGNS[acq].name}); its lord ${N(RULER[E.SIGNS[acq].name])} speaks for it.`}</p>`;
      },
      timing(A, L, ctx) {
        const zr = Fo.release(signIdx(L.fortune), ctx.person.ms, ctx.person.ms + 100 * 365.2425 * 864e5, 1, 2);
        const fS = signIdx(L.fortune);
        const subs = zr.flatMap((p) => p.subs).filter((s) => s.to > ctx.start && s.from < ctx.start + 4 * YEAR);
        return `<h4>Releasing from Fortune</h4><p>Valens's periods from the Lot of Fortune govern circumstances and means. The signs angular to Fortune are its active times; the 10th from it is the peak.</p>
          <table><thead><tr><th>Sub-period</th><th>From</th><th>To</th><th></th></tr></thead><tbody>${subs.map((s) => { const a = Fo.angle(s.sign, fS); const now = ctx.start >= s.from && ctx.start < s.to;
            return `<tr class="${now ? 'hi' : ''}"><td>${sg(s.sign * 30)} ${E.SIGNS[s.sign].name}${now ? ' (now)' : ''}</td><td>${ctx.D(s.from)}</td><td>${ctx.D(s.to)}</td><td>${[a === 10 ? '<b>Peak</b>' : a ? `angle (${ord(a)})` : '', s.loosed ? 'loosed' : ''].filter(Boolean).join(' · ')}</td></tr>`; }).join('')}</tbody></table>`;
      },
      sources: 'Ptolemy, Tetrabiblos IV, "Of material fortune" (Robbins). The houses of money: Valens, Anthology II; Lilly, Christian Astrology III. Place of acquisition and releasing from Fortune: Valens II and IV.',
    },

    travel: {
      title: 'Travel forecast', foot: 'Travel forecast',
      intro: 'The transits that touch travel, grouped by kind: short and local journeys, long-distance and foreign travel, the Moon\'s changes of place, and moving house. The mode each leans to (water, land, air) follows the sign the transiting planet is in, after Ptolemy\'s signs of travel; air travel is our own extension, since no traditional author wrote about flying.',
      houses: [3, 9, 4], fast: ['mercury'],
      groups(A) {
        const lord = (h, what) => { const p = A.lordOf(h); return [[p, A.B[p].lon, `natal ${N(p)}, lord of the ${ord(h)} (${what})`]]; };
        return [
          { id: 'local', title: 'Local and short journeys', meaning: 'The 3rd house and Mercury: errands, commuting, short trips, the neighbourhood.', targets: [...lord(3, 'short journeys'), ['mercury', A.B.mercury.lon, 'natal Mercury']] },
          { id: 'long', title: 'Long-distance and foreign travel', meaning: 'The 9th house and Jupiter: long journeys, travel abroad, and the things learned there.', targets: [...lord(9, 'long journeys'), ['jupiter', A.B.jupiter.lon, 'natal Jupiter']] },
          { id: 'moon', title: 'Change of place (the Moon)', meaning: 'Ptolemy judges travel above all from the Moon: contacts to her stir movement and change.', targets: [['moon', A.B.moon.lon, 'natal Moon']] },
          { id: 'moving', title: 'Moving house and relocation', meaning: 'The 4th house: home, and leaving it.', targets: lord(4, 'home') },
        ];
      },
      promise(A) {
        const cadent = (h) => [3, 6, 9, 12].includes(h), setting = (h) => [6, 7].includes(h);
        const moonH = A.B.moon.house, marsH = A.B.mars.house, fH = A.houseOf(A.fortune);
        const quadrant = (lon) => { const h = A.houseOf(lon); return [10, 11, 12, 4, 5, 6].includes(h) ? 'eastern' : 'western'; };
        const lowerEast = [1, 2, 3].includes(moonH) || [1, 2, 3].includes(A.B.sun.house);
        const moving = [2, 5, 8, 11].includes(signIdx(A.B.moon.lon) % 3 === 2 ? 2 : 0) || (signIdx(A.B.moon.lon) % 3) === 2;
        const malefics = ['mars', 'saturn'].filter((p) => { const r = (signIdx(A.B.moon.lon) - signIdx(A.B[p].lon) + 12) % 12; return [0, 3, 6, 9].includes(r); });
        const benefics = ['jupiter', 'venus'].filter((p) => { const r = (signIdx(A.B.moon.lon) - signIdx(A.B[p].lon) + 12) % 12; return [0, 2, 4, 6, 8, 10].includes(r); });
        return `<p>Ptolemy judges travel chiefly from the Moon: setting, or declining from the angles, she brings journeys abroad and changes of place. Yours is in the <b>${ord(moonH)} house</b>, ${cadent(moonH) || setting(moonH) ? 'declining or setting: a chart inclined to travel' : 'not in a place of travel, so journeys come when the times call for them'}. Mars ${setting(marsH) || [11, 12].includes(marsH) ? 'also sets or declines from the Midheaven, adding to it' : 'does not add to it'}. ${cadent(fH) ? 'The Lot of Fortune falls in a place of travel too: by Ptolemy, much of life and business may be spent away.' : ''}</p>
          <p>${benefics.length ? `${benefics.map(N).join(' and ')} ${benefics.length > 1 ? 'regard' : 'regards'} the Moon: by his rule, journeys honourable and profitable, the return quick.` : 'Neither benefic regards the Moon.'} ${malefics.length ? `${malefics.map(N).join(' and ')} ${malefics.length > 1 ? 'press' : 'presses'} on her by conjunction, square or opposition: journeys more laborious, worth care.` : ''} ${lowerEast ? 'With the lights low in the east, he points the journeys east and south;' : 'With the lights in the western quadrants, he points them north and west;'} ${moving ? 'the Moon in a double-bodied sign makes travel frequent and long.' : 'the Moon in a single sign makes travel occasional.'}</p>`;
      },
      mode(e, lonAt) {
        const s = E.SIGNS[signIdx(lonAt(e.p, e.exact[0] || e.from))];
        return { water: 'By water', earth: 'Over land', air: 'By air (modern extension)', fire: 'No traditional mode' }[s.element];
      },
      timing(A, L, ctx) {
        const years = R.profections(A).filter((y) => y.a >= ctx.age && y.a < ctx.age + 4);
        const tl = (h) => A.lordOf(h);
        return `<h4>The years for travel</h4><p>A profection year that reaches the 3rd or 9th house, or whose Lord of the Year rules them, brings journeys to the fore.</p>
          <table><thead><tr><th>Age</th><th>Year's house</th><th>Lord of the Year</th><th></th></tr></thead><tbody>${years.map((y) => { const hit = [3, 9].includes(y.house) || [tl(3), tl(9)].includes(y.lord);
            return `<tr class="${hit ? 'hi' : ''}"><td>${y.a}</td><td>${ord(y.house)}</td><td>${G(y.lord)} ${N(y.lord)}</td><td>${hit ? (y.house === 9 || y.lord === tl(9) ? 'A year of long journeys' : 'A year of short journeys') : ''}</td></tr>`; }).join('')}</tbody></table>`;
      },
      sources: 'Ptolemy, Tetrabiblos IV, "Of foreign travel" (Robbins): the Moon and the lights to the angles, Mars, the Lot of Fortune, benefics and malefics, the directions and the signs of travel. The 3rd and 9th houses: Valens, Anthology II; Lilly, Christian Astrology III.',
    },

    military: {
      title: 'Military service forecast', foot: 'Military service forecast',
      intro: 'The transits that touch service, grouped by area: command and rank, action and courage, duty under others, and postings. Each is marked favourable or testing, which is where performance shows: benefics to the Sun, the 10th and Victory favour commendation and advancement; Saturn and Mars on them warn of reprimand, friction with superiors, or exhaustion.',
      houses: [10, 6, 9], fast: ['sun'],
      groups(A, L) {
        const lord = (h, what) => { const p = A.lordOf(h); return [[p, A.B[p].lon, `natal ${N(p)}, lord of the ${ord(h)} (${what})`]]; };
        return [
          { id: 'command', title: 'Command and rank', meaning: 'The Sun, the Midheaven and the lord of the 10th: authority, superiors, promotion.', targets: [['sun', A.B.sun.lon, 'natal Sun'], ['mc', A.ch.angles.mc, 'the Midheaven'], ...lord(10, 'command')] },
          { id: 'action', title: 'Action and courage', meaning: 'Mars and the Lots of Courage and Victory: operations, daring, and winning.', targets: [['mars', A.B.mars.lon, 'natal Mars'], ['courage', L.courage, 'the Lot of Courage'], ['victory', L.victory, 'the Lot of Victory']] },
          { id: 'duty', title: 'Duty and service under others', meaning: 'The lord of the 6th and the Lot of Necessity: orders, routine, and what must be done.', targets: [...lord(6, 'duty'), ['necessity', L.necessity, 'the Lot of Necessity']] },
          { id: 'postings', title: 'Postings and deployment', meaning: 'The lords of the 9th and 3rd, and the Moon: movement, postings near and far.', targets: [...lord(9, 'far postings'), ...lord(3, 'near postings'), ['moon', A.B.moon.lon, 'natal Moon']] },
        ];
      },
      care(A, L) {
        const p8 = A.lordOf(8), al = A.ascLord;
        return [['asc', A.ch.angles.asc, 'the Ascendant (the body)'], [al, A.B[al].lon, `natal ${N(al)}, lord of the Ascendant`], ['sun', A.B.sun.lon, 'natal Sun'], ['moon', A.B.moon.lon, 'natal Moon'], [p8, A.B[p8].lon, `natal ${N(p8)}, lord of the 8th`]];
      },
      promise(A, L) {
        // Ptolemy's lord of action: the planet at the Midheaven, or the one that has made its morning appearance nearest the Sun.
        const sun = A.B.sun.lon;
        const atMc = T7.filter((id) => !['sun', 'moon'].includes(id) && A.houseOf(A.B[id].lon) === A.houseOf(A.ch.angles.mc));
        const morning = T7.filter((id) => !['sun', 'moon'].includes(id) && E.norm(sun - A.B[id].lon) < 180 && E.separation(sun, A.B[id].lon) > 15).sort((a, b) => E.separation(sun, A.B[a].lon) - E.separation(sun, A.B[b].lon));
        const action = atMc[0] || morning[0] || A.lordOf(10);
        const jupMars = (() => { const r = (signIdx(A.B.mars.lon) - signIdx(A.B.jupiter.lon) + 12) % 12; return [0, 2, 3, 4, 6, 8, 9, 10].includes(r); })();
        const masc = (lon) => signIdx(lon) % 2 === 0;
        const angular = (h) => [1, 4, 7, 10].includes(h);
        const general = masc(A.B.sun.lon) && !masc(A.B.moon.lon) && (angular(A.B.sun.house) || angular(A.B.moon.house));
        const cl = RULER[signName(L.courage)], vl = RULER[signName(L.victory)];
        return `<p>Ptolemy finds the <b>lord of action</b> at the Midheaven or among the planets rising before the Sun. Yours is <b>${N(action)}</b>${action === 'mars' ? `: with Mars governing action, ${jupMars ? 'and Jupiter testifying to him, Ptolemy names soldiers among its callings' : 'Ptolemy gives the crafts of fire and iron; Jupiter does not testify to him, which is what he says makes soldiers'}` : `, ${grade(A.P[action].total)}`}. Mars itself is ${grade(A.P.mars.total)}, in the ${ord(A.B.mars.house)}; the Sun, of command and honour, is ${grade(A.P.sun.total)}.</p>
          <p>${general ? 'The Sun is in a masculine sign, the Moon in a feminine one, and a light is angular: Ptolemy\'s figure for those who hold command ("generals, with power of life and death"), the more so if planets attend the lights.' : 'Ptolemy\'s figure for high command (Sun in a masculine sign, Moon in a feminine one, a light angular) is not complete here; rank comes, as he says, through partial dignities and superintendence.'} The Lot of Courage is in ${signName(L.courage)}, its lord ${N(cl)} ${grade(A.P[cl].total)}; the Lot of Victory in ${signName(L.victory)}, its lord ${N(vl)} ${grade(A.P[vl].total)}.</p>`;
      },
      timing(A, L, ctx) {
        const sS = signIdx(L.spirit) === signIdx(L.fortune) ? (signIdx(L.spirit) + 1) % 12 : signIdx(L.spirit);
        const zr = Fo.release(sS, ctx.person.ms, ctx.person.ms + 100 * 365.2425 * 864e5, 1, 2);
        const fS = signIdx(L.fortune);
        const subs = zr.flatMap((p) => p.subs).filter((s) => s.to > ctx.start && s.from < ctx.start + 4 * YEAR);
        const years = R.profections(A).filter((y) => y.a >= ctx.age && y.a < ctx.age + 4);
        const key = [A.lordOf(10), 'mars', 'sun'];
        return `<h4>Releasing from Spirit</h4><p>Valens's periods from the Lot of Spirit govern action and career. The signs angular to Fortune are the active times, the 10th from it the peak: the likeliest times for advancement and notice.</p>
          <table><thead><tr><th>Sub-period</th><th>From</th><th>To</th><th></th></tr></thead><tbody>${subs.map((s) => { const a = Fo.angle(s.sign, fS); const now = ctx.start >= s.from && ctx.start < s.to;
            return `<tr class="${now ? 'hi' : ''}"><td>${sg(s.sign * 30)} ${E.SIGNS[s.sign].name}${now ? ' (now)' : ''}</td><td>${ctx.D(s.from)}</td><td>${ctx.D(s.to)}</td><td>${[a === 10 ? '<b>Peak</b>' : a ? `angle (${ord(a)})` : '', s.loosed ? 'loosed' : ''].filter(Boolean).join(' · ')}</td></tr>`; }).join('')}</tbody></table>
          <h4>The years of service</h4><table><thead><tr><th>Age</th><th>Year's house</th><th>Lord of the Year</th><th></th></tr></thead><tbody>${years.map((y) => `<tr class="${key.includes(y.lord) || y.house === 10 ? 'hi' : ''}"><td>${y.a}</td><td>${ord(y.house)}</td><td>${G(y.lord)} ${N(y.lord)}</td><td>${y.house === 10 ? 'A year of the 10th: rank and standing' : key.includes(y.lord) ? `${N(y.lord)} rules the year: ${y.lord === 'mars' ? 'action' : y.lord === 'sun' ? 'command' : 'career'} to the fore` : ''}</td></tr>`).join('')}</tbody></table>`;
      },
      sources: 'Ptolemy, Tetrabiblos IV (Robbins): "Of the quality of action" (Mars governing action, Jupiter testifying: soldiers), "Of the fortune of dignity" (command), "Of material fortune" (Mars: "military operations and command"). The Lots of Courage, Victory and Necessity: Paulus Alexandrinus. Releasing from Spirit: Valens, Anthology IV.',
    },
  };

  // ---------- the report ----------
  function build(person, opts) {
    const o = { ...K.DEFAULTS, months: 6, care: true, ...opts };
    const T = THEMES[o.theme];
    if (!T) throw new Error(`Unknown theme: ${o.theme}`);
    const A = R.analyse(person, o);
    const L = Fo.hermeticLots(A.ch, A.day);
    const tz = person.tz;
    const [fy, fm, fd] = (o.from || new Date().toISOString().slice(0, 10)).split('-').map(Number);
    const start = E.zonedToUtc(fy, fm, fd, 0, 0, tz);
    const endZ = new Date(Date.UTC(fy, fm - 1 + (+o.months || 6), fd));
    const end = E.zonedToUtc(endZ.getUTCFullYear(), endZ.getUTCMonth() + 1, endZ.getUTCDate(), 0, 0, tz);
    const lonAt = (id, ms) => E.planetLonLat(id, E.centuries(E.julianDay(ms))).lon;
    const D = (ms) => fmtDate(ms, tz);
    const short = (ms) => { const z = E.utcToZoned(ms, tz); return `${z.d} ${MONTHS[z.m - 1]}`; };
    const ctx = { person, start, end, D, age: Math.floor((start - person.ms) / (365.2425 * 864e5)) };

    // Search each group's significators; a planet that signifies two areas appears in both.
    // A planet that is both a house's lord and the natural significator (Mercury ruling the 3rd) is watched once.
    const unique = (list) => list.filter(([id], i) => list.findIndex(([x]) => x === id) === i);
    const groups = T.groups(A, L).map((g) => {
      const targets = unique(g.targets).map(([id, lon, label], i) => ({ id: `${id}#${i}`, point: id, lon, label }));
      const ev = F.findTransits(targets.map((t) => ({ id: t.id, lon: t.lon })), SLOW.concat(T.fast), start, end)
        .filter((e) => SLOW.includes(e.p) || ['conjunction', 'opposition'].includes(e.aspect))
        .map((e) => { const t = targets.find((x) => x.id === e.n); return { ...e, n: t.point, label: t.label }; })
        .sort((a, b) => (a.exact[0] || a.from) - (b.exact[0] || b.from));
      return { ...g, events: ev };
    });
    const careTargets = T.care && o.care ? unique(T.care(A, L)) : null;
    const careEvents = careTargets ? F.findTransits(careTargets.map(([id, lon], i) => ({ id: `${id}#${i}`, lon })), ['mars', 'saturn'], start, end)
      .filter((e) => ['conjunction', 'square', 'opposition'].includes(e.aspect))
      .map((e) => { const i = +e.n.split('#')[1]; return { ...e, n: careTargets[i][0], label: careTargets[i][2] }; })
      .sort((a, b) => (a.exact[0] || a.from) - (b.exact[0] || b.from)) : null;
    const ingresses = F.findIngresses(['mars', 'jupiter', 'saturn'], start, end).filter((g) => T.houses.includes(A.houseOf(g.sign * 30 + 1)));

    const sub = `${esc(person.name)}<br>${fmtBirth(person)} ${offsetOf(person)} · ${esc(person.place.name)}`;
    const period = `${D(start)} to ${D(end - 1)}`;
    const S = K.shell(o, sub, `${T.foot} · ${period}`);
    const { page, head, cite } = S;
    const all = groups.flatMap((g) => g.events);
    const exactCount = all.reduce((n, e) => n + e.exact.length, 0);

    page('overview', T.title, () => `${head(T.title)}
      <div class="facts"><div><b>${period.replace(' to ', ' – ')}</b>Period</div><div><b>${all.length}</b>Transits in orb</div><div><b>${exactCount}</b>Exact passes</div><div><b>${all.filter((e) => tone(e)[0] === 'good').length} / ${all.filter((e) => tone(e)[0] === 'bad').length}</b>Favourable / testing</div></div>
      <p>${T.intro}</p>
      <h4>The natal promise</h4>${T.promise(A, L)}
      ${T.timing(A, L, ctx)}
      ${cite(T.sources)}`);

    // The groups, packed onto pages by estimated height (rows of about 19pt, headings and notes).
    const blocks = [];
    for (const g of groups) {
      const rows = g.events.map((e) => `<tr><td class="c">${G(e.p)}</td><td class="c gs">${ASP[e.aspect].glyph}</td><td>${N(e.p)} ${ASP[e.aspect].name.toLowerCase()} ${g.events && e.label}</td><td>${short(Math.max(e.from, start))}–${short(Math.min(e.to, end))}</td><td>${e.exact.map(short).join(', ') || '—'}</td>${T.mode ? `<td>${e.exact.length ? T.mode(e, lonAt) : ''}</td>` : ''}<td>${toneCell(e)}</td></tr>`);
      const headHtml = `<h4>${g.title}</h4><p class="src" style="font-style:normal;margin-top:-2px">${g.meaning}</p>`;
      const thead = `<thead><tr><th></th><th></th><th>Transit</th><th>In orb</th><th>Exact</th>${T.mode ? '<th>Mode</th>' : ''}<th>Leaning</th></tr></thead>`;
      if (!rows.length) { blocks.push({ h: 64, html: `${headHtml}<p class="src">No transit to these significators in the period.</p>` }); continue; }
      for (let i = 0; i < rows.length; i += 24) blocks.push({ h: 58 + Math.min(24, rows.length - i) * 19 + 22, html: `${i ? `<h4>${g.title}, continued</h4>` : headHtml}<table>${thead}<tbody>${rows.slice(i, i + 24).join('')}</tbody></table>` });
    }
    if (ingresses.length) blocks.push({ h: 60 + ingresses.length * 19, html: `<h4>The slow planets through the houses of ${T.title.split(' ')[0].toLowerCase()}</h4><table><tbody>${ingresses.map((g) => `<tr><td class="c">${G(g.p)}</td><td>${D(g.at)}</td><td>${N(g.p)} ${g.back ? 'returns to' : 'enters'} ${E.SIGNS[g.sign].name}, your ${ord(A.houseOf(g.sign * 30 + 1))} house</td></tr>`).join('')}</tbody></table>` });
    // In the page, measure each block as it will print (rows wrap); in Node, keep the estimate.
    let BUDGET = (o.paper === 'letter' ? 792 : 842) - 76 - 60 - 40;
    if (typeof document !== 'undefined' && document.body) {
      const measure = (h) => { const el = document.createElement('div'); el.className = S.cls; el.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;min-height:0'; el.innerHTML = h; document.body.appendChild(el); const v = el.offsetHeight; el.remove(); return v; };
      const base = measure(head('By area, continued') + cite('Transits within 1° to each area\'s significators, sampled every six hours and refined to the minute. Leaning: by the transiting planet and the aspect. Mode: by the sign the transiting planet is in, after Ptolemy\'s signs of travel; air is our extension.'));
      BUDGET = S.height - base - 6;
      for (const b of blocks) b.h = measure(b.html) - 76;
    }
    let cur = [], used = 0;
    const pageOut = [];
    for (const b of blocks) { if (cur.length && used + b.h > BUDGET) { pageOut.push(cur); cur = []; used = 0; } cur.push(b); used += b.h; }
    if (cur.length) pageOut.push(cur);
    pageOut.forEach((bs, i) => page(`areas${i}`, i ? `By area (${i + 1})` : 'By area', () => `${head(i ? 'By area, continued' : 'By area')}${bs.map((b) => b.html).join('')}
      ${cite(`Transits within 1° to each area's significators, sampled every six hours and refined to the minute. Leaning: by the transiting planet and the aspect.${T.mode ? ' Mode: by the sign the transiting planet is in, after Ptolemy\'s signs of travel; air is our extension.' : ''}`)}`));

    if (careEvents) {
      const natal = (() => {
        const out = [];
        for (const l of ['sun', 'moon']) { const r = Math.abs(norm180(A.B.mars.lon - A.B[l].lon)); if (Math.abs(r - 90) <= 6 || Math.abs(r - 180) <= 6) out.push(`Mars ${Math.abs(r - 90) <= 6 ? 'squares' : 'opposes'} the natal ${N(l)}`); }
        return out;
      })();
      page('care', 'Periods to take extra care', () => `${head('Periods to take extra care')}
        <p>The old authors judged danger to life and limb from Mars and Saturn against the body and the lights. These are <b>not predictions</b>, and nothing here says that harm will come. They mark the periods when the tradition would advise extra care: in training and on operations, with equipment and vehicles, with fatigue, and in taking risks that aren't required. Treat them as a reason for caution and good drills, the way you'd treat a weather warning.</p>
        <h4>In the birth chart</h4>
        <p>${natal.length ? `${natal.join('; ')}. Ptolemy reads Mars square or opposite the lights as danger from violence, from enemies or in conflict, the more so from a sign of the other sect: a standing reason to respect safety drills.` : 'Mars is not in square or opposition to the lights, Ptolemy\'s main testimony of danger from violence.'} The lord of the 8th, ${N(A.lordOf(8))}, is ${grade(A.P[A.lordOf(8)].total)}.</p>
        <h4>In this period</h4>
        ${careEvents.length ? `<table><thead><tr><th></th><th></th><th>Transit</th><th>In orb</th><th>Exact</th></tr></thead><tbody>${careEvents.map((e) => `<tr><td class="c">${G(e.p)}</td><td class="c gs">${ASP[e.aspect].glyph}</td><td>${N(e.p)} ${ASP[e.aspect].name.toLowerCase()} ${e.label}</td><td>${short(Math.max(e.from, start))}–${short(Math.min(e.to, end))}</td><td>${e.exact.map(short).join(', ') || '—'}</td></tr>`).join('')}</tbody></table>` : '<p>No hard contact of Mars or Saturn to the body, the lights or the lord of the 8th in this period.</p>'}
        <p class="src" style="margin-top:6px">This section can be turned off in the report's options.</p>
        ${cite('Ptolemy, Tetrabiblos IV, "Of the quality of death" (Mars quartile or opposite the lights); Lilly, Christian Astrology III. Framed as periods of caution, not as predictions.')}`);
    }
    return { A, groups, careEvents, ingresses, start, end, pages: S.pages };
  }

  const api = { build, THEMES, tone };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Themes = api;
})(typeof window !== 'undefined' ? window : globalThis);
