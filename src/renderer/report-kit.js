/* Pagbalatik: what the report types share. Formatting (degrees, glyphs, ordinals), the page shell (logo header,
   footer, page numbers, A4 or Letter, Vellum or Clean), the wheel, and the natal analysis from report.js.
   The natal reading (report.js) keeps its own copy, generated from its mockup; the other reports use this. */
(function (root) {
  'use strict';
  const E = root.ChartEngine || require('./chart-engine.js');
  const W = root.Wheel || require('./wheel.js');
  const R = root.Report || require('./report.js');

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const ELC = { fire: 'el-fire', earth: 'el-earth', air: 'el-air', water: 'el-water' };
  const ASP = Object.fromEntries(E.ASPECTS.map((a) => [a.id, a]));
  const BODY = Object.fromEntries(E.BODIES.map((b) => [b.id, b]));
  const T7 = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'];
  const ord = (n) => n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');
  const cap = (s) => s[0].toUpperCase() + s.slice(1);
  const signIdx = (lon) => Math.floor(E.norm(lon) / 30);
  const signOf = (lon) => E.SIGNS[signIdx(lon)];
  const signName = (lon) => signOf(lon).name;
  const sg = (lon) => { const s = signOf(lon); return `<i class="gs ${ELC[s.element]}">${s.glyph}</i>`; };
  const fmtLon = (lon) => { const s = E.signOf(lon); return `${s.deg}°${pad(s.min)}′ ${sg(lon)}`; };
  // Points that aren't bodies: the angles and the lots.
  const POINTS = { asc: ['As', 'Ascendant'], mc: ['Mc', 'Midheaven'], fortune: ['⊗', 'Lot of Fortune'], spirit: ['Sp', 'Lot of Spirit'], eros: ['Er', 'Lot of Eros'], necessity: ['Ne', 'Lot of Necessity'], courage: ['Co', 'Lot of Courage'], victory: ['Vi', 'Lot of Victory'], nemesis: ['Nm', 'Lot of Nemesis'] };
  const G = (id) => (BODY[id] ? `<i class="gs ${id}">${BODY[id].glyph}</i>` : `<i class="gs">${POINTS[id][0]}</i>`);
  const N = (id) => (BODY[id] ? BODY[id].name : POINTS[id][1]);
  const NA = (id) => (id === 'sun' || id === 'moon' || POINTS[id] ? 'the ' : '') + N(id);
  const grade = (t) => (t >= 12 ? 'strong and well dignified' : t >= 4 ? 'reasonably strong' : t >= -4 ? 'of mixed condition' : 'weak and afflicted');
  const RULER = R.RULER;
  const fmtDate = (ms, tz, withTime) => { const z = E.utcToZoned(ms, tz); return `${z.d} ${MONTHS[z.m - 1]} ${z.y}${withTime ? `, ${pad(z.h)}:${pad(z.mi)}` : ''}`; };
  const fmtBirth = (p) => fmtDate(p.ms, p.tz, true);
  const offsetOf = (p) => { const o = E.utcToZoned(p.ms, p.tz).offset; return `UTC${o < 0 ? '−' : '+'}${pad(Math.floor(Math.abs(o) / 60))}:${pad(Math.abs(o) % 60)}`; };
  const norm180 = (d) => ((E.norm(d) + 180) % 360) - 180;
  const lots = (ch, day) => {
    const B = Object.fromEntries(ch.bodies.map((b) => [b.id, b.lon]));
    const asc = ch.angles.asc;
    const fortune = E.norm(day ? asc + B.moon - B.sun : asc + B.sun - B.moon);
    const spirit = E.norm(day ? asc + B.sun - B.moon : asc + B.moon - B.sun);
    return { fortune, spirit };
  };

  /** The page shell. opts: the report options (logo, logoSize, logoWhere, practice, contact, style, paper, cite).
      Returns { page(id, title, body), head(title), cite(text), pages, cls, height }. */
  function shell(opts, sub, footName) {
    const cls = `paper${opts.style === 'clean' ? ' clean' : ''}${opts.paper === 'letter' ? ' letter' : ''}`;
    const height = opts.paper === 'letter' ? 792 : 842;
    const logo = (size) => (opts.logo ? `<span class="logo"><img src="${opts.logo}" style="height:${size}px;max-width:${size * 3.2}px" alt=""></span>` : '');
    const head = (title) => `<div class="ph">${opts.logoWhere === 'all' ? logo(opts.logoSize) : ''}<div class="tt"><h3>${title}</h3></div><div class="sub">${sub}</div></div>`;
    const cite = (t) => (opts.cite === false ? '' : `<div class="src">${t}</div>`);
    const pages = [];
    const page = (id, title, body) => pages.push({ id, title, html: (n, of) => `<div class="${cls}" data-page="${id}">${body(n, of)}<div class="pf"><span>${esc(opts.practice || 'Pagbalatik')} · ${footName}</span><span>${n} / ${of}</span></div></div>` });
    const brand = () => `<div class="brand">${logo(Math.round(opts.logoSize * 1.7))}<div class="who"><b>${esc(opts.practice || '')}</b>\n${esc(opts.contact || '')}</div></div>`;
    return { page, head, cite, pages, cls, height, brand, logo };
  }

  /** Splits rows into chunks for pages: the first chunk shorter when the page has a heading block. */
  const chunks = (rows, first, rest) => { const out = [rows.slice(0, first)]; for (let i = first; i < rows.length; i += rest) out.push(rows.slice(i, i + rest)); return out.filter((c) => c.length || out.length === 1); };

  const DEFAULTS = { logo: null, logoSize: 34, logoWhere: 'all', practice: '', contact: '', style: 'vellum', paper: 'a4', houses: 'whole', trip: 'dorothean', terms: 'egyptian', modern: 'listed', cite: true };

  const api = { E, W, R, esc, pad, MONTHS, ELC, ASP, BODY, T7, POINTS, ord, cap, signIdx, signOf, signName, sg, fmtLon, G, N, NA, grade, RULER, fmtDate, fmtBirth, offsetOf, norm180, lots, shell, chunks, DEFAULTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ReportKit = api;
})(typeof window !== 'undefined' ? window : globalThis);
