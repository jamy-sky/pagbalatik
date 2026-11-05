/* Pagbalatik: the chart wheel, FEMT's geometry (Ascendant on the left, the zodiac anticlockwise).
   One chart, or two: a birth chart inside with transits or a second person in an outer ring. */
(function (root) {
  'use strict';
  const E = root.ChartEngine;
  const DEG = Math.PI / 180;
  const pad = (n) => String(n).padStart(2, '0');
  const ELC = { fire: 'el-fire', earth: 'el-earth', air: 'el-air', water: 'el-water' };
  const ASP = Object.fromEntries(E.ASPECTS.map((a) => [a.id, a]));
  const MODERN = ['uranus', 'neptune', 'pluto'];
  const SIZE = 820, CX = SIZE / 2, CY = SIZE / 2;

  /** Spread glyphs that would overlap, keeping each as close to its true place as it can. */
  function spread(bodies, gap) {
    const it = bodies.map((b) => ({ b, at: b.lon })).sort((x, y) => x.at - y.at);
    for (let q = 0; q < 40; q++) {
      let moved = false;
      for (let i = 0; i < it.length; i++) {
        const a = it[i], b = it[(i + 1) % it.length];
        const g = E.norm(b.at - a.at);
        if (it.length > 1 && g < gap) { const push = (gap - g) / 2; a.at = E.norm(a.at - push); b.at = E.norm(b.at + push); moved = true; }
      }
      if (!moved) break;
    }
    return it;
  }

  /** opts: { modern: show Uranus, Neptune and Pluto (default true) } */
  function svg(main, outer, opts = {}) {
    const asc = main.angles.asc;
    const show = (ch) => (opts.modern === false ? ch.bodies.filter((b) => !MODERN.includes(b.id)) : ch.bodies);
    const pos = (lon, r) => { const t = (180 + (lon - asc)) * DEG; return [CX + r * Math.cos(t), CY - r * Math.sin(t)]; };
    const line = (a, b, cls) => `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" class="${cls}"/>`;
    const bi = !!outer;
    const R = bi
      ? { z1: 400, z0: 362, oG: 337, oL: 315, h1: 298, glyph: 272, label: 250, h0: 228, asp: 202 }
      : { z1: 400, z0: 356, glyph: 320, label: 293, h0: 268, asp: 240 };
    let s = `<circle cx="${CX}" cy="${CY}" r="${R.z1}" class="ring"/><circle cx="${CX}" cy="${CY}" r="${R.z0}" class="ring"/>`;
    for (const sg of E.SIGNS) {
      s += line(pos(sg.start, R.z0), pos(sg.start, R.z1), 'sign-line');
      const [gx, gy] = pos(sg.start + 15, (R.z0 + R.z1) / 2);
      s += `<text x="${gx.toFixed(1)}" y="${gy.toFixed(1)}" class="sign ${ELC[sg.element]}"><title>${sg.name}</title>${sg.glyph}</text>`;
    }
    for (let d = 0; d < 360; d += 5) s += line(pos(d, R.z0), pos(d, R.z0 + (d % 10 === 0 ? 9 : 6)), 'deg-tick');
    s += `<circle cx="${CX}" cy="${CY}" r="${R.h0}" class="ring"/><circle cx="${CX}" cy="${CY}" r="${R.asp}" class="ring"/>`;
    if (bi) s += `<circle cx="${CX}" cy="${CY}" r="${R.h1}" class="ring faint"/>`;
    const cs = main.houses.cusps;
    cs.forEach((c, i) => {
      s += line(pos(c, R.asp), pos(c, R.z0), i % 3 === 0 ? 'cusp angle' : 'cusp');
      const [nx, ny] = pos(c + E.norm(cs[(i + 1) % 12] - c) / 2, (R.h0 + R.asp) / 2);
      s += `<text x="${nx.toFixed(1)}" y="${ny.toFixed(1)}" class="house-num">${i + 1}</text>`;
    });
    [['asc', 'As'], ['dsc', 'Ds'], ['mc', 'Mc'], ['ic', 'Ic']].forEach(([k, l]) => {
      s += line(pos(main.angles[k], R.z1), pos(main.angles[k], R.z1 + 12), 'cusp angle');
      const [lx, ly] = pos(main.angles[k], R.z1 + 26);
      s += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" class="angle-label">${l}</text>`;
    });
    const shown = new Set(show(main).map((b) => b.id));
    for (const a of main.aspects) {
      if (a.aspect === 'conjunction' || !shown.has(a.a) || !shown.has(a.b)) continue;
      const pa = main.bodies.find((b) => b.id === a.a), pb = main.bodies.find((b) => b.id === a.b);
      const [x1, y1] = pos(pa.lon, R.asp), [x2, y2] = pos(pb.lon, R.asp);
      s += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" class="asp asp-${a.aspect}" style="opacity:${(1 - (a.orb / (ASP[a.aspect].orb + 0.5)) * 0.65).toFixed(2)}"/>`;
    }
    const ring = (ch, rG, rT, rL, cls) => spread(show(ch), 6.5).map(({ b, at }) => {
      const [gx, gy] = pos(at, rG), [lx, ly] = pos(at, rL);
      return `<g class="body ${cls}"><title>${b.name} ${b.deg}°${pad(b.min)}′ ${b.sign.name}${b.retrograde ? ', retrograde' : ''}</title>${line(pos(b.lon, rT), pos(b.lon, rT - 10), 'tick-body')}<text x="${gx.toFixed(1)}" y="${gy.toFixed(1)}" class="glyph ${b.id}">${b.glyph}</text><text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" class="deg">${b.deg}${b.retrograde ? '℞' : ''}</text></g>`;
    }).join('');
    s += ring(main, R.glyph, R.h0 + (bi ? 76 : 106), R.label, 'inner');
    if (bi) s += ring(outer, R.oG, R.z1, R.oL, 'outer');
    return `<svg class="wheel" xmlns="http://www.w3.org/2000/svg" viewBox="-34 -34 ${SIZE + 68} ${SIZE + 68}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Chart wheel">${s}</svg>`;
  }

  const api = { svg };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Wheel = api;
})(typeof window !== 'undefined' ? window : globalThis);
