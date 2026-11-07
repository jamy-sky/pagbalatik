/* Pagbalatik: the transit forecast. The transits of the planets to the birth chart over a period, each with its
   window in orb and its exact passes, read against the year's profection (the Lord of the Year), with the slow
   planets' passage through the houses and their stations on natal points. */
(function (root) {
  'use strict';
  const K = root.ReportKit || require('./report-kit.js');
  const { E, W, R, esc, MONTHS, ASP, BODY, T7, ord, cap, signIdx, signName, sg, fmtLon, G, N, NA, grade, RULER, fmtDate, fmtBirth, offsetOf, norm180 } = K;

  const MOVERS = ['sun', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'];
  const MODERN = ['uranus', 'neptune', 'pluto'];
  const ORB = 1; // degrees either side of exact, for every transiting planet
  const STEP = 6 * 3600e3; // sample every six hours, then refine each exact pass to the minute
  const WEIGHT = { sun: 1, mercury: 1, venus: 1, mars: 2, jupiter: 3, saturn: 4, uranus: 3, neptune: 3, pluto: 3 };
  const HOUSE_SHORT = ['', 'the self and body', 'money and livelihood', 'siblings and daily dealings', 'home, family and property', 'children, pleasure and creativity', 'health and work', 'partners and open dealings', 'shared resources and endings', 'travel, study and faith', 'career and reputation', 'friends and hopes', 'retreat and hidden matters'];
  const NATURE = {
    sun: 'brings attention, vitality and the wish to be seen', mercury: 'brings news, talk, papers and plans', venus: 'brings ease, affection, pleasure and favours',
    mars: 'brings heat, effort, haste and conflict', jupiter: 'brings growth, help, opportunity and good counsel', saturn: 'brings weight, delay, duty and lasting structure',
    uranus: 'brings sudden change (a modern planet, noted not judged)', neptune: 'brings dissolving and longing (a modern planet, noted not judged)', pluto: 'brings pressure and transformation (a modern planet, noted not judged)',
  };
  const POINT_TOPIC = { asc: 'the body, health and the direction of life', mc: 'career, standing and public action', fortune: 'circumstances, luck and material means' };
  const lonAt = (id, ms) => E.planetLonLat(id, E.centuries(E.julianDay(ms))).lon;

  /** Every pass of every transiting planet to every natal point by the five aspects, within the period. */
  function findTransits(targets, movers, start, end) {
    const samples = [];
    for (let t = start - STEP; t <= end + STEP; t += STEP) samples.push(t);
    const lon = Object.fromEntries(movers.map((p) => [p, samples.map((t) => lonAt(p, t))]));
    const events = [];
    for (const p of movers) {
      for (const tg of targets) {
        for (const a of E.ASPECTS) {
          for (const side of a.angle === 0 || a.angle === 180 ? [1] : [1, -1]) {
            const d = (i) => norm180(lon[p][i] - tg.lon - side * a.angle);
            let cur = null;
            for (let i = 1; i < samples.length - 1; i++) {
              const v = d(i), inOrb = Math.abs(v) <= ORB;
              if (inOrb && !cur) cur = { p, n: tg.id, aspect: a.id, from: samples[i], to: samples[i], exact: [] };
              if (cur) {
                if (inOrb) cur.to = samples[i];
                const prev = d(i - 1);
                if (Math.sign(prev) !== Math.sign(v) && Math.abs(prev - v) < 20) cur.exact.push(refine(p, tg.lon + side * a.angle, samples[i - 1], samples[i]));
                if (!inOrb) { events.push(cur); cur = null; }
              }
            }
            if (cur) events.push(cur);
          }
        }
      }
    }
    // Keep the passes that touch the period.
    return events.filter((e) => e.to >= start && e.from <= end).map((e) => ({ ...e, exact: e.exact.filter((x) => x >= start - 864e5 && x <= end + 864e5) }));
  }
  function refine(p, target, a, b) {
    const f = (t) => norm180(lonAt(p, t) - target);
    for (let k = 0; k < 40 && b - a > 60e3; k++) { const m = (a + b) / 2; if (Math.sign(f(m)) === Math.sign(f(a))) a = m; else b = m; }
    return (a + b) / 2;
  }
  /** Stations (turning retrograde or direct) of the slow planets within the period, and any natal point they sit on. */
  function findStations(targets, movers, start, end) {
    const out = [];
    for (const p of movers.filter((x) => !['sun'].includes(x))) {
      const speed = (t) => norm180(lonAt(p, t + 432e5) - lonAt(p, t - 432e5));
      let prev = speed(start);
      for (let t = start + 864e5; t <= end; t += 864e5) {
        const s = speed(t);
        if (Math.sign(s) !== Math.sign(prev)) {
          let a = t - 864e5, b = t;
          for (let k = 0; k < 30; k++) { const m = (a + b) / 2; if (Math.sign(speed(m)) === Math.sign(prev)) a = m; else b = m; }
          const at = (a + b) / 2, lon = lonAt(p, at);
          const on = targets.flatMap((tg) => E.ASPECTS.filter((x) => Math.abs(Math.abs(norm180(lon - tg.lon)) - x.angle) <= 1.5).map((x) => ({ n: tg.id, aspect: x.id }))).slice(0, 2);
          out.push({ p, at, lon, turn: s < 0 ? 'retrograde' : 'direct', on });
        }
        prev = s;
      }
    }
    return out.sort((x, y) => x.at - y.at);
  }
  /** Sign changes of Mars, Jupiter and Saturn: their passage through the houses (whole sign). */
  function findIngresses(movers, start, end) {
    const out = [];
    for (const p of movers.filter((x) => ['mars', 'jupiter', 'saturn'].includes(x))) {
      let prev = signIdx(lonAt(p, start));
      for (let t = start + 864e5; t <= end; t += 864e5) {
        const s = signIdx(lonAt(p, t));
        if (s !== prev) {
          let a = t - 864e5, b = t;
          for (let k = 0; k < 30; k++) { const m = (a + b) / 2; if (signIdx(lonAt(p, m)) === prev) a = m; else b = m; }
          out.push({ p, at: (a + b) / 2, sign: s, back: ((s - prev + 12) % 12) === 11 });
          prev = s;
        }
      }
    }
    return out.sort((x, y) => x.at - y.at);
  }

  function build(person, opts) {
    const o = { ...K.DEFAULTS, months: 3, ...opts };
    const A = R.analyse(person, o);
    const ch = A.ch;
    const tz = person.tz;
    const [fy, fm, fd] = (o.from || new Date().toISOString().slice(0, 10)).split('-').map(Number);
    const start = E.zonedToUtc(fy, fm, fd, 0, 0, tz);
    const endZ = new Date(Date.UTC(fy, fm - 1 + o.months, fd));
    const end = E.zonedToUtc(endZ.getUTCFullYear(), endZ.getUTCMonth() + 1, endZ.getUTCDate(), 0, 0, tz);
    const span = end - start;
    const movers = MOVERS.concat(o.modern === 'off' ? [] : MODERN);
    const targets = T7.map((id) => ({ id, lon: A.B[id].lon })).concat([{ id: 'asc', lon: ch.angles.asc }, { id: 'mc', lon: ch.angles.mc }, { id: 'fortune', lon: A.fortune }]);
    const events = findTransits(targets, movers, start, end);
    const stations = findStations(targets, movers.filter((p) => p !== 'sun'), start, end);
    const ingresses = findIngresses(movers, start, end);

    // The profection years the period touches, and their Lords of the Year.
    const years = R.profections(A).filter((y) => {
      const ys = person.ms + y.a * 365.2425 * 864e5, ye = ys + 365.2425 * 864e5;
      return ye > start && ys < end;
    });
    const lords = new Set(years.map((y) => y.lord));
    const keyPoints = new Set(['sun', 'moon', 'asc', 'mc', A.ascLord, ...lords]);
    const score = (e) => WEIGHT[e.p] + (keyPoints.has(e.n) ? 2 : 0) + (lords.has(e.p) ? 2 : 0) + (e.exact.length ? 1 : 0) + (['saturn', 'mars'].includes(e.p) && ['square', 'opposition', 'conjunction'].includes(e.aspect) ? 1 : 0);
    // A transit that comes back through a retrograde is one transit with several passes.
    const merged = Object.values(events.filter((e) => e.exact.length && !MODERN.includes(e.p)).reduce((m, e) => {
      const k = `${e.p}|${e.aspect}|${e.n}`;
      if (!m[k]) m[k] = { ...e, exact: [...e.exact] };
      else { m[k].from = Math.min(m[k].from, e.from); m[k].to = Math.max(m[k].to, e.to); m[k].exact.push(...e.exact); }
      return m;
    }, {}));
    const ranked = merged.map((e) => ({ ...e, exact: e.exact.sort((a, b) => a - b), score: score(e) })).sort((a, b) => b.score - a.score || a.exact[0] - b.exact[0]);
    const highlights = ranked.slice(0, 6);

    const sub = `${esc(person.name)}<br>${fmtBirth(person)} ${offsetOf(person)} · ${esc(person.place.name)}`;
    const periodText = `${fmtDate(start, tz)} to ${fmtDate(end - 1, tz)}`;
    const S = K.shell(o, sub, `Transit forecast · ${periodText}`);
    const { page, head, cite } = S;
    const D = (ms) => fmtDate(ms, tz);
    const short = (ms) => { const z = E.utcToZoned(ms, tz); return `${z.d} ${MONTHS[z.m - 1]}`; };
    const kind = (a) => ASP[a].kind;
    const verb = (a) => ({ conjunction: 'joins', sextile: 'sextiles', square: 'squares', trine: 'trines', opposition: 'opposes' }[a]);
    const target = (id) => (BODY[id] ? `natal ${N(id)}` : NA(id));

    function topic(id) {
      if (POINT_TOPIC[id]) return POINT_TOPIC[id];
      const h = A.B[id].house, rules = A.rules(id);
      return `${HOUSE_SHORT[h]} (its house)${rules.length ? `, and ${rules.map((r) => HOUSE_SHORT[r]).join(' and ')} (the houses it rules)` : ''}`;
    }
    function note(e) {
      const benefic = ['jupiter', 'venus'].includes(e.p), malefic = ['saturn', 'mars'].includes(e.p);
      const k = kind(e.aspect);
      const tone = k === 'soft' ? (malefic ? 'Being a soft aspect, the strain is eased: it asks for work rather than sacrifice.' : 'A soft aspect: the opening is easy to take.')
        : k === 'hard' ? (benefic ? 'A hard aspect from a benefic: help comes, but with some cost or excess.' : malefic ? 'A hard aspect from a malefic: the testing contact of the period.' : 'A hard aspect: friction that forces a decision.')
          : (malefic ? 'A conjunction from a malefic presses directly on what it touches.' : benefic ? 'A conjunction from a benefic: the most direct of its gifts.' : 'A conjunction: the matter comes to the fore.');
      const sect = e.p === A.sectBenefic ? ` ${N(e.p)} is the benefic of your sect, so its help is fuller.` : e.p === A.contraryMalefic ? ` ${N(e.p)} is the malefic contrary to your sect, the harder of the two.` : e.p === A.sectMalefic ? ` ${N(e.p)} is the malefic of your sect, so its pressure is more workable.` : '';
      const loy = lords.has(e.p) ? ` As Lord of the Year, ${NA(e.p)} speaks for the whole year, so its contacts weigh more.` : lords.has(e.n) ? ` ${cap(NA(e.n))} is Lord of the Year, so whatever touches it touches the year.` : '';
      const exacts = e.exact.length > 1 ? ` It is exact ${e.exact.length} times (${e.exact.map(short).join(', ')}), going back over the same ground.` : '';
      return `${cap(NA(e.p))} ${NATURE[e.p]}. Here it ${verb(e.aspect)} ${target(e.n)}, touching ${topic(e.n)}. ${tone}${sect}${loy}${exacts}`;
    }
    const bar = (e) => {
      const l = Math.max(0, (e.from - start) / span), r = Math.min(1, (e.to - start) / span);
      return `<div class="bar"><i style="left:${(l * 100).toFixed(1)}%;width:${Math.max(1.2, (r - l) * 100).toFixed(1)}%"></i>${e.exact.map((x) => `<b style="left:${(((x - start) / span) * 100).toFixed(1)}%"></b>`).join('')}</div>`;
    };
    const row = (e) => `<tr class="${lords.has(e.p) ? 'hi' : ''}"><td class="c">${G(e.p)}</td><td class="c gs">${ASP[e.aspect].glyph}</td><td class="c">${G(e.n)}</td><td>${N(e.p)} ${ASP[e.aspect].name.toLowerCase()} ${target(e.n)}${MODERN.includes(e.p) ? ' <span class="src">(modern)</span>' : ''}</td><td>${short(Math.max(e.from, start))}–${short(Math.min(e.to, end))}</td><td>${e.exact.map(short).join(', ') || '—'}</td><td style="width:96px">${bar(e)}</td></tr>`;
    const thead = '<thead><tr><th></th><th></th><th></th><th>Transit</th><th>In orb</th><th>Exact</th><th>Period</th></tr></thead>';
    const sorted = events.slice().sort((a, b) => (a.exact[0] || a.from) - (b.exact[0] || b.from));

    // 1. The period at a glance
    page('overview', 'The period at a glance', () => `${head('Transit forecast')}
      <div class="facts"><div><b>${periodText.replace(' to ', ' – ')}</b>Period</div><div><b>${events.length}</b>Transits in orb</div><div><b>${events.reduce((n, e) => n + e.exact.length, 0)}</b>Exact passes</div><div><b>${stations.length}</b>Stations</div></div>
      <div class="wheel-wrap sm" style="margin:2px 0">${W.svg(ch, E.chart(start, person.place.lat, person.place.lon, { houseSystem: o.houses }), { modern: o.modern !== 'off' })}</div>
      <p class="src" style="text-align:center;margin-top:-2px">Inner wheel: the birth chart. Outer ring: the sky on ${D(start)}.</p>
      <h4>The year behind the period</h4>
      ${years.map((y) => `<p>From your birthday in ${person.ms ? E.utcToZoned(person.ms + y.a * 365.2425 * 864e5, tz).y : ''}, the year's profection reaches the <b>${ord(y.house)} house</b> (${y.sg.name}), bringing ${HOUSE_SHORT[y.house]} to the fore. Its lord, <b>${N(y.lord)}</b>, is Lord of the Year: ${grade(y.total)} in your chart, in your ${ord(A.B[y.lord].house)} house. Its transits, and the transits to it, are marked in the tables below.</p>`).join('')}
      <h4>What stands out</h4>
      <table><tbody>${highlights.map((e) => `<tr><td class="c">${G(e.p)}</td><td class="c gs">${ASP[e.aspect].glyph}</td><td class="c">${G(e.n)}</td><td>${N(e.p)} ${ASP[e.aspect].name.toLowerCase()} ${target(e.n)}</td><td class="r">exact ${e.exact.map(short).join(', ')}</td></tr>`).join('') || '<tr><td>No slow transit is exact in this period.</td></tr>'}</tbody></table>
      ${cite('Transits judged by the transiting planet, the natal point it touches and the houses that point rules: Valens, Anthology IV–V; Lilly, Christian Astrology III (revolutions and transits). The Lord of the Year: Valens IV; Ptolemy, Tetrabiblos IV, "Of the division of times".')}`);

    // 2. The main transits, read
    page('readings', 'The main transits', () => `${head('The main transits')}
      <p>The transits that matter most in the period: the slow planets, the Lord of the Year, and contacts to the lights, the angles and the lord of your Ascendant.</p>
      ${highlights.map((e) => `<div class="house"><h5>${G(e.p)} ${N(e.p)} ${ASP[e.aspect].name.toLowerCase()} ${target(e.n)} ${G(e.n)} <span class="src" style="font-style:normal">in orb ${short(Math.max(e.from, start))}–${short(Math.min(e.to, end))} · exact ${e.exact.map(short).join(', ')}</span></h5><p>${note(e)}</p></div>`).join('') || '<p>No slow planet makes an exact transit in this period; the faster planets below set its tone.</p>'}
      ${cite('Natures of the planets: Ptolemy, Tetrabiblos I; benefics and malefics by sect: Valens, Anthology II–III.')}`);

    // 3+. Every transit, in order
    K.chunks(sorted, 26, 34).forEach((rows, i) => page(`list${i}`, i ? `All transits (${i + 1})` : 'All transits', () => `${head(i ? 'All transits, continued' : 'All transits')}
      ${i ? '' : `<p>Every transit in orb (${ORB}°) during the period, in the order they come exact. Shaded rows are the Lord of the Year's own transits; the bar shows the window across the period and its exact passes.</p>`}
      <table>${thead}<tbody>${rows.map(row).join('')}</tbody></table>
      ${cite('Positions: JPL Keplerian elements (Standish), sampled every six hours and refined to the minute.')}`));

    // Stations and the slow planets through the houses (on two pages when the period is long)
    const startPos = () => movers.filter((p) => ['mars', 'jupiter', 'saturn'].includes(p)).map((p) => { const l = lonAt(p, start); return `<tr><td class="c">${G(p)}</td><td>${N(p)}</td><td class="r">${fmtLon(l)}</td><td>${ord(A.houseOf(l))} house: ${HOUSE_SHORT[A.houseOf(l)]}</td></tr>`; }).join('');
    const ingressBlock = () => `<h4>Where they are at the start</h4><table><tbody>${startPos()}</tbody></table>
      <h4>Changing house</h4>
      ${ingresses.length ? `<table><tbody>${ingresses.map((g) => `<tr><td class="c">${G(g.p)}</td><td>${D(g.at)}</td><td>${N(g.p)} ${g.back ? 'returns to' : 'enters'} ${E.SIGNS[g.sign].name}, your ${ord(A.houseOf(g.sign * 30 + 1))} house: ${HOUSE_SHORT[A.houseOf(g.sign * 30 + 1)]}</td></tr>`).join('')}</tbody></table>` : '<p>None of Mars, Jupiter and Saturn changes sign in the period.</p>'}`;
    const stationBlock = () => `<h4>Stations</h4><p>A planet standing still before it turns retrograde or direct holds its degree for days, and what it touches then is emphasized.</p>
      ${stations.length ? `<table><tbody>${stations.map((s) => `<tr><td class="c">${G(s.p)}</td><td>${D(s.at)}</td><td>${N(s.p)} turns ${s.turn} at ${fmtLon(s.lon)}</td><td>${s.on.map((x) => `${ASP[x.aspect].name.toLowerCase()} ${target(x.n)}`).join('; ') || '<span class="src">on no natal point</span>'}</td></tr>`).join('')}</tbody></table>` : '<p>No planet stations in the period.</p>'}
      <h4>Method</h4><p class="src" style="font-style:normal">Transiting Sun, Mercury, Venus, Mars, Jupiter and Saturn${o.modern === 'off' ? '' : ', with Uranus, Neptune and Pluto listed but not judged'}, to the seven natal planets, the Ascendant, the Midheaven and the Lot of Fortune, by conjunction, sextile, square, trine and opposition, within ${ORB}°. The Moon moves too fast for a forecast of this length. Houses are ${o.houses === 'whole' ? 'whole signs' : o.houses}.</p>
      ${cite('Stations: Ptolemy, Tetrabiblos IV, "Of the division of times"; Lilly, Christian Astrology III.')}`;
    if (ingresses.length + stations.length > 12) {
      page('slow', 'The slow planets', () => `${head('The slow planets')}${ingressBlock()}`);
      page('stations', 'Stations', () => `${head('Stations')}${stationBlock()}`);
    } else page('slow', 'The slow planets', () => `${head('The slow planets')}${ingressBlock()}${stationBlock()}`);
    return { A, events, stations, ingresses, years, highlights, start, end, pages: S.pages };
  }

  const api = { build, findTransits, findStations, findIngresses };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Forecast = api;
})(typeof window !== 'undefined' ? window : globalThis);
