// FEMT chart engine: tropical positions of the Sun, Moon, planets and lunar node, the angles,
// house cusps and aspects for a moment and place. Pure functions; scripts/test-chart.js checks them.
//
// Planets use the same Keplerian elements as the phone app (E. M. Standish, JPL, valid 1800–2050:
// errors of arcminutes). The Moon uses the main periodic terms of Meeus, Astronomical Algorithms
// ch. 47 (good to about 0.01°), since a chart shows the Moon to the degree.
(function (root) {
  const DEG = Math.PI / 180;
  const J2000 = 2451545.0;
  const PRECESSION = 1.396971; // general precession in longitude, degrees per century
  const norm = (d) => ((d % 360) + 360) % 360;
  const sin = (d) => Math.sin(d * DEG), cos = (d) => Math.cos(d * DEG);
  const julianDay = (ms) => ms / 86400000 + 2440587.5;
  const centuries = (jd) => (jd - J2000) / 36525;
  const obliquity = (T) => 23.439291 - 0.0130042 * T;

  // ---------- planets (Standish Table 1: a, e, I, L, long. perihelion, node; and rates per century)
  const EL = {
    earth: [[1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0], [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0]],
    mercury: [[0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593], [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081]],
    venus: [[0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255], [0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418]],
    mars: [[1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891], [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343]],
    jupiter: [[5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909], [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106]],
    saturn: [[9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448], [-0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794]],
    uranus: [[19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.95427630, 74.01692503], [-0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589]],
    neptune: [[30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574], [0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664]],
    pluto: [[39.48211675, 0.24882730, 17.14001206, 238.92903833, 224.06891629, 110.30393684], [-0.00031596, 0.00005170, 0.00004818, 145.20780515, -0.04062942, -0.01183482]],
  };

  function helio(name, T) {
    const [base, rate] = EL[name];
    const v = base.map((b, i) => b + rate[i] * T);
    const [a, e] = v;
    const inc = v[2] * DEG, node = v[5] * DEG, peri = (v[4] - v[5]) * DEG;
    let M = norm(v[3] - v[4]);
    if (M > 180) M -= 360;
    const m = M * DEG;
    let E = m + e * Math.sin(m);
    for (let i = 0; i < 30; i++) {
      const d = (E - e * Math.sin(E) - m) / (1 - e * Math.cos(E));
      E -= d;
      if (Math.abs(d) < 1e-12) break;
    }
    const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
    const cw = Math.cos(peri), sw = Math.sin(peri), cn = Math.cos(node), sn = Math.sin(node), ci = Math.cos(inc), si = Math.sin(inc);
    return [
      (cw * cn - sw * sn * ci) * xp + (-sw * cn - cw * sn * ci) * yp,
      (cw * sn + sw * cn * ci) * xp + (-sw * sn + cw * cn * ci) * yp,
      (sw * si) * xp + (cw * si) * yp,
    ];
  }

  /** Geocentric ecliptic longitude and latitude, equinox of date, degrees. */
  function planetLonLat(name, T) {
    const earth = helio('earth', T);
    const p = name === 'sun' ? [0, 0, 0] : helio(name, T);
    const x = p[0] - earth[0], y = p[1] - earth[1], z = p[2] - earth[2];
    return { lon: norm(Math.atan2(y, x) / DEG + PRECESSION * T), lat: Math.atan2(z, Math.hypot(x, y)) / DEG };
  }

  // ---------- Moon (Meeus ch. 47, main terms; coefficients in degrees)
  const MOON_LON = [
    // D, M, M', F, coefficient
    [0, 0, 1, 0, 6.288774], [2, 0, -1, 0, 1.274027], [2, 0, 0, 0, 0.658314], [0, 0, 2, 0, 0.213618],
    [0, 1, 0, 0, -0.185116], [0, 0, 0, 2, -0.114332], [2, 0, -2, 0, 0.058793], [2, -1, -1, 0, 0.057066],
    [2, 0, 1, 0, 0.053322], [2, -1, 0, 0, 0.045758], [0, 1, -1, 0, -0.040923], [1, 0, 0, 0, -0.034720],
    [0, 1, 1, 0, -0.030383], [2, 0, 0, -2, 0.015327], [0, 0, 1, 2, -0.012528], [0, 0, 1, -2, 0.010980],
    [4, 0, -1, 0, 0.010675], [0, 0, 3, 0, 0.010034], [4, 0, -2, 0, 0.008548], [2, 1, -1, 0, -0.007888],
    [2, 1, 0, 0, -0.006766], [1, 0, -1, 0, -0.005163], [1, 1, 0, 0, 0.004987], [2, -1, 1, 0, 0.004036],
    [2, 0, 2, 0, 0.003994], [4, 0, 0, 0, 0.003861], [2, 0, -3, 0, 0.003665], [0, 1, -2, 0, -0.002689],
    [2, 0, -1, 2, -0.002602], [2, -1, -2, 0, 0.002390], [1, 0, 1, 0, -0.002348], [2, -2, 0, 0, 0.002236],
    [0, 1, 2, 0, -0.002120], [0, 2, 0, 0, -0.002069], [2, -2, -1, 0, 0.002048], [2, 0, 1, -2, -0.001773],
    [2, 0, 0, 2, -0.001595], [4, -1, -1, 0, 0.001215], [0, 0, 2, 2, -0.001110], [3, 0, -1, 0, -0.000892],
    [2, 1, 1, 0, -0.000810], [4, -1, -2, 0, 0.000759], [0, 2, -1, 0, -0.000713], [2, 2, -1, 0, -0.000700],
    [2, 1, -2, 0, 0.000691], [2, -1, 0, -2, 0.000596], [4, 0, 1, 0, 0.000549], [0, 0, 4, 0, 0.000537],
    [4, -1, 0, 0, 0.000520], [1, 0, -2, 0, -0.000487],
  ];
  const MOON_LAT = [
    [0, 0, 0, 1, 5.128122], [0, 0, 1, 1, 0.280602], [0, 0, 1, -1, 0.277693], [2, 0, 0, -1, 0.173237],
    [2, 0, -1, 1, 0.055413], [2, 0, -1, -1, 0.046271], [2, 0, 0, 1, 0.032573], [0, 0, 2, 1, 0.017198],
    [2, 0, 1, -1, 0.009266], [0, 0, 2, -1, 0.008822], [2, -1, 0, -1, 0.008216], [2, 0, -2, -1, 0.004324],
    [2, 0, 1, 1, 0.004200], [2, 1, 0, -1, -0.003359], [2, -1, -1, 1, 0.002463], [2, -1, 0, 1, 0.002211],
    [2, -1, -1, -1, 0.002065], [0, 1, -1, -1, -0.001870], [4, 0, -1, -1, 0.001828], [0, 1, 0, 1, -0.001794],
  ];

  function moonArgs(T) {
    return {
      L: norm(218.3164477 + 481267.88123421 * T - 0.0015786 * T * T),
      D: norm(297.8501921 + 445267.1114034 * T - 0.0018819 * T * T),
      M: norm(357.5291092 + 35999.0502909 * T - 0.0001536 * T * T),
      Mp: norm(134.9633964 + 477198.8675055 * T + 0.0087414 * T * T),
      F: norm(93.2720950 + 483202.0175233 * T - 0.0036539 * T * T),
      E: 1 - 0.002516 * T - 0.0000074 * T * T,
    };
  }

  function series(terms, a) {
    let s = 0;
    for (const [d, m, mp, f, c] of terms) {
      const ecc = Math.abs(m) === 1 ? a.E : Math.abs(m) === 2 ? a.E * a.E : 1;
      s += c * ecc * sin(d * a.D + m * a.M + mp * a.Mp + f * a.F);
    }
    return s;
  }

  function moonLonLat(T) {
    const a = moonArgs(T);
    const A1 = norm(119.75 + 131.849 * T), A2 = norm(53.09 + 479264.290 * T), A3 = norm(313.45 + 481266.484 * T);
    const lon = a.L + series(MOON_LON, a) + 0.003958 * sin(A1) + 0.001962 * sin(a.L - a.F) + 0.000318 * sin(A2);
    const lat = series(MOON_LAT, a) - 0.002235 * sin(a.L) + 0.000382 * sin(A3) + 0.000175 * sin(A1 - a.F)
      + 0.000175 * sin(A1 + a.F) + 0.000127 * sin(a.L - a.Mp) - 0.000115 * sin(a.L + a.Mp);
    return { lon: norm(lon), lat };
  }

  /** The Moon's ascending node: mean, or true (mean plus Meeus's main corrections). */
  function nodeLon(T, kind) {
    const mean = norm(125.0445479 - 1934.1362891 * T + 0.0020754 * T * T);
    if (kind === 'mean') return mean;
    const a = moonArgs(T);
    return norm(mean - 1.4979 * sin(2 * (a.D - a.F)) - 0.1500 * sin(a.M) - 0.1226 * sin(2 * a.D)
      + 0.1176 * sin(2 * a.F) - 0.0801 * sin(2 * (a.Mp - a.F)));
  }

  // ---------- angles and houses
  function gmst(jd) {
    const T = centuries(jd);
    return norm(280.46061837 + 360.98564736629 * (jd - J2000) + 0.000387933 * T * T - (T * T * T) / 38710000);
  }

  /** Ecliptic longitude of the point on the ecliptic with right ascension ra. */
  const raToLon = (ra, eps) => norm(Math.atan2(sin(ra), cos(ra) * cos(eps)) / DEG);
  const lonToDec = (lon, eps) => Math.asin(sin(eps) * sin(lon)) / DEG;

  function angles(ramc, lat, eps) {
    const mc = raToLon(ramc, eps);
    const asc = norm(Math.atan2(cos(ramc), -(sin(ramc) * cos(eps) + Math.tan(lat * DEG) * sin(eps))) / DEG);
    return { asc, mc, dsc: norm(asc + 180), ic: norm(mc + 180) };
  }

  /**
   * Placidus cusps by iteration: houses 11 and 12 divide the semi-diurnal arc above the horizon
   * into thirds, houses 2 and 3 the semi-nocturnal arc below. Null above the polar circles,
   * where some degrees never rise or set.
   */
  function placidus(ramc, lat, eps, ang) {
    const tanPhi = Math.tan(lat * DEG);
    const cusp = (f, below) => {
      let lon = below ? norm(ang.asc + f * 60) : norm(ang.mc + f * 60);
      for (let i = 0; i < 60; i++) {
        const x = -tanPhi * Math.tan(lonToDec(lon, eps) * DEG);
        if (Math.abs(x) > 1) return null;
        const sda = Math.acos(x) / DEG;
        const ra = below ? ramc + 180 - (1 - f) * (180 - sda) : ramc + f * sda;
        const next = raToLon(ra, eps);
        const diff = Math.abs(((next - lon + 540) % 360) - 180);
        lon = next;
        if (diff < 1e-9) break;
      }
      return lon;
    };
    const c11 = cusp(1 / 3, false), c12 = cusp(2 / 3, false), c2 = cusp(1 / 3, true), c3 = cusp(2 / 3, true);
    if ([c11, c12, c2, c3].some((c) => c == null)) return null;
    return [ang.asc, c2, c3, ang.ic, norm(c11 + 180), norm(c12 + 180), ang.dsc, norm(c2 + 180), norm(c3 + 180), ang.mc, c11, c12];
  }

  function porphyry(ang) {
    const q1 = norm(ang.ic - ang.asc), q2 = norm(ang.dsc - ang.ic);
    const c = [ang.asc, norm(ang.asc + q1 / 3), norm(ang.asc + 2 * q1 / 3), ang.ic, norm(ang.ic + q2 / 3), norm(ang.ic + 2 * q2 / 3)];
    return c.concat(c.map((x) => norm(x + 180)));
  }

  function houses(system, ramc, lat, eps, ang) {
    if (system === 'whole') { const s = Math.floor(ang.asc / 30) * 30; return { system, cusps: Array.from({ length: 12 }, (_, i) => norm(s + 30 * i)) }; }
    if (system === 'equal') return { system, cusps: Array.from({ length: 12 }, (_, i) => norm(ang.asc + 30 * i)) };
    if (system === 'porphyry') return { system, cusps: porphyry(ang) };
    const p = placidus(ramc, lat, eps, ang);
    return p ? { system: 'placidus', cusps: p } : { system: 'porphyry', cusps: porphyry(ang), fallback: 'Placidus is undefined this close to the pole; Porphyry is used instead.' };
  }

  /** Which house (1–12) a longitude falls in. */
  function houseOf(lon, cusps) {
    for (let i = 0; i < 12; i++) {
      const a = cusps[i], b = cusps[(i + 1) % 12];
      const span = norm(b - a), off = norm(lon - a);
      if (off < span) return i + 1;
    }
    return 1;
  }

  // ---------- bodies, aspects, chart
  const BODIES = [
    { id: 'sun', name: 'Sun', glyph: '☉' }, { id: 'moon', name: 'Moon', glyph: '☽' },
    { id: 'mercury', name: 'Mercury', glyph: '☿' }, { id: 'venus', name: 'Venus', glyph: '♀' },
    { id: 'mars', name: 'Mars', glyph: '♂' }, { id: 'jupiter', name: 'Jupiter', glyph: '♃' },
    { id: 'saturn', name: 'Saturn', glyph: '♄' }, { id: 'uranus', name: 'Uranus', glyph: '♅' },
    { id: 'neptune', name: 'Neptune', glyph: '♆' }, { id: 'pluto', name: 'Pluto', glyph: '♇' },
    { id: 'node', name: 'North Node', glyph: '☊' }, { id: 'snode', name: 'South Node', glyph: '☋' },
  ];

  const SIGNS = [
    ['Aries', '♈', 'fire'], ['Taurus', '♉', 'earth'], ['Gemini', '♊', 'air'], ['Cancer', '♋', 'water'],
    ['Leo', '♌', 'fire'], ['Virgo', '♍', 'earth'], ['Libra', '♎', 'air'], ['Scorpio', '♏', 'water'],
    ['Sagittarius', '♐', 'fire'], ['Capricorn', '♑', 'earth'], ['Aquarius', '♒', 'air'], ['Pisces', '♓', 'water'],
  ].map(([name, glyph, element], i) => ({ name, glyph, element, start: i * 30 }));

  const ASPECTS = [
    { id: 'conjunction', name: 'Conjunction', glyph: '☌', angle: 0, orb: 8, kind: 'neutral' },
    { id: 'sextile', name: 'Sextile', glyph: '⚹', angle: 60, orb: 4, kind: 'soft' },
    { id: 'square', name: 'Square', glyph: '□', angle: 90, orb: 7, kind: 'hard' },
    { id: 'trine', name: 'Trine', glyph: '△', angle: 120, orb: 7, kind: 'soft' },
    { id: 'opposition', name: 'Opposition', glyph: '☍', angle: 180, orb: 8, kind: 'hard' },
  ];

  function lonAt(id, T, nodeKind) {
    if (id === 'moon') return moonLonLat(T).lon;
    if (id === 'node') return nodeLon(T, nodeKind);
    if (id === 'snode') return norm(nodeLon(T, nodeKind) + 180);
    return planetLonLat(id, T).lon;
  }

  /** Signed daily motion in degrees, from a day either side. Negative means retrograde. */
  function speed(id, jd, nodeKind) {
    const a = lonAt(id, centuries(jd - 0.5), nodeKind), b = lonAt(id, centuries(jd + 0.5), nodeKind);
    return ((b - a + 540) % 360) - 180;
  }

  function signOf(lon) {
    const s = SIGNS[Math.floor(norm(lon) / 30)];
    const within = norm(lon) - s.start;
    const d = Math.floor(within), m = Math.floor((within - d) * 60);
    return { sign: s, deg: d, min: m };
  }

  const separation = (a, b) => { const d = Math.abs(norm(a) - norm(b)) % 360; return d > 180 ? 360 - d : d; };

  /** Aspects within orb between two lists of points ({id, lon}); same list = within one chart. */
  function aspects(listA, listB, opts = {}) {
    const scale = opts.orbScale ?? 1;
    const out = [];
    const same = listA === listB;
    for (let i = 0; i < listA.length; i++) {
      for (let j = same ? i + 1 : 0; j < listB.length; j++) {
        const a = listA[i], b = listB[j];
        if (same && ((a.id === 'node' && b.id === 'snode') || (a.id === 'snode' && b.id === 'node'))) continue;
        const sep = separation(a.lon, b.lon);
        for (const asp of ASPECTS) {
          const orb = Math.abs(sep - asp.angle);
          if (orb <= asp.orb * scale) { out.push({ a: a.id, b: b.id, aspect: asp.id, kind: asp.kind, orb }); break; }
        }
      }
    }
    return out.sort((x, y) => x.orb - y.orb);
  }

  /**
   * The chart for a moment (UTC milliseconds) and place. opts: { houseSystem, nodeKind }.
   * Returns bodies with longitude, sign, house and speed; the angles; house cusps; aspects.
   */
  function chart(ms, lat, lon, opts = {}) {
    const jd = julianDay(ms);
    const T = centuries(jd);
    const eps = obliquity(T);
    const ramc = norm(gmst(jd) + lon);
    const ang = angles(ramc, lat, eps);
    const hs = houses(opts.houseSystem || 'placidus', ramc, lat, eps, ang);
    const nodeKind = opts.nodeKind || 'true';
    const bodies = BODIES.map((b) => {
      const l = lonAt(b.id, T, nodeKind);
      const v = speed(b.id, jd, nodeKind);
      return { ...b, lon: l, speed: v, retrograde: v < 0 && b.id !== 'node' && b.id !== 'snode', house: houseOf(l, hs.cusps), ...signOf(l) };
    });
    const points = bodies.map((b) => ({ id: b.id, lon: b.lon }));
    return { ms, jd, lat, lon, eps, ramc, angles: ang, houses: hs, bodies, aspects: aspects(points, points, opts) };
  }

  // ---------- time zones (IANA, via the browser's own tz database)
  /** Offset of zone `tz` from UTC at instant `ms`, in minutes (east positive). */
  function zoneOffset(ms, tz) {
    const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const p = Object.fromEntries(f.formatToParts(new Date(ms)).filter((x) => x.type !== 'literal').map((x) => [x.type, +x.value]));
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60000);
  }

  /** A wall-clock time in zone `tz` to UTC milliseconds. */
  function zonedToUtc(y, mo, d, h, mi, tz) {
    const guess = Date.UTC(y, mo - 1, d, h, mi);
    const first = guess - zoneOffset(guess, tz) * 60000;
    return guess - zoneOffset(first, tz) * 60000;
  }

  /** UTC milliseconds to the wall-clock parts in zone `tz`. */
  function utcToZoned(ms, tz) {
    const off = zoneOffset(ms, tz);
    const t = new Date(ms + off * 60000);
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), h: t.getUTCHours(), mi: t.getUTCMinutes(), offset: off };
  }

  const api = { chart, aspects, signOf, separation, planetLonLat, moonLonLat, nodeLon, angles, houses, houseOf, gmst, julianDay, centuries, obliquity, zoneOffset, zonedToUtc, utcToZoned, BODIES, SIGNS, ASPECTS, norm };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ChartEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
