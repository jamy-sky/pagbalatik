/* Pagbalatik: turns the rendered report pages (report.js, shown in the preview) into the small document model that
   src-tauri/src/docx.rs builds a Word file from. One source for both formats: what the preview shows is what both
   files say. The chart wheel goes over as SVG with its styles written in, so resvg can draw it. */
(function (root) {
  'use strict';

  const hex = (rgb) => {
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgb || '');
    return m ? [m[1], m[2], m[3]].map((v) => (+v).toString(16).padStart(2, '0')).join('').toUpperCase() : '';
  };
  const clean = (t) => t.replace(/\s+/g, ' ');

  /** The text of a node as runs: bold, italic, symbol glyphs (with their colour), coloured scores. */
  function runsOf(node, inherit = {}) {
    const out = [];
    for (const n of node.childNodes) {
      if (n.nodeType === 3) {
        const text = clean(n.textContent);
        if (text) out.push({ text, ...inherit });
        continue;
      }
      if (n.nodeType !== 1 || n.matches('title, .pf, script, style')) continue;
      if (n.tagName === 'BR') { out.push({ text: ' ' }); continue; }
      if (n.tagName === 'IMG' || n.tagName === 'svg') continue;
      const st = { ...inherit };
      if (/^(B|STRONG)$/.test(n.tagName)) st.b = true;
      if (/^(I|EM)$/.test(n.tagName) && !n.classList.contains('gs')) st.i = true;
      if (n.classList.contains('gs') || n.classList.contains('g')) { st.sym = true; st.color = hex(getComputedStyle(n).color); }
      if (n.classList.contains('pos') || n.classList.contains('neg')) st.color = hex(getComputedStyle(n).color);
      if (n.classList.contains('act')) { out.push({ text: ` ${n.textContent.trim().toUpperCase()} `, b: true, color: hex(getComputedStyle(n).backgroundColor) }); continue; }
      if (n.classList.contains('tag')) { out.push({ text: ` [${n.textContent.trim()}]`, size: 7.5, color: '6B5F48' }); continue; }
      out.push(...runsOf(n, st));
    }
    // Trim the ends of the paragraph.
    if (out.length) { out[0].text = out[0].text.replace(/^\s+/, ''); out[out.length - 1].text = out[out.length - 1].text.replace(/\s+$/, ''); }
    return out.filter((r) => r.text);
  }

  const STYLE_PROPS = [['fill', 'fill'], ['stroke', 'stroke'], ['stroke-width', 'strokeWidth'], ['stroke-dasharray', 'strokeDasharray'], ['opacity', 'opacity'],
    ['font-size', 'fontSize'], ['font-family', 'fontFamily'], ['font-style', 'fontStyle'], ['text-anchor', 'textAnchor'], ['dominant-baseline', 'dominantBaseline']];

  /** The wheel as standalone SVG: computed styles written onto each element, tooltips removed. */
  function svgText(svg) {
    const copy = svg.cloneNode(true);
    const src = [svg, ...svg.querySelectorAll('*')], dst = [copy, ...copy.querySelectorAll('*')];
    src.forEach((el, i) => {
      const cs = getComputedStyle(el), d = dst[i];
      d.removeAttribute('class');
      d.removeAttribute('style');
      for (const [attr, prop] of STYLE_PROPS) {
        const v = cs[prop];
        if (v && v !== 'normal' && v !== 'auto' && !(attr === 'stroke-dasharray' && v === 'none')) d.setAttribute(attr, v);
      }
    });
    copy.querySelectorAll('title').forEach((t) => t.remove());
    copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    return new XMLSerializer().serializeToString(copy);
  }

  /** A grid of boxes (.facts, .tally, .box, .defs) as a table with as many columns as the grid has. */
  function gridTable(el) {
    const cols = Math.max(1, getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length);
    const cells = [...el.children].map((c) => ({ runs: runsOf(c), shade: c.classList.contains('win') ? 'F3ECDD' : '' }));
    const rows = [];
    for (let i = 0; i < cells.length; i += cols) rows.push(cells.slice(i, i + cols));
    return { t: 'table', rows };
  }

  function walk(el, out) {
    for (const n of el.children) {
      if (n.matches('.pf, .ph .logo, .docx-ribbon, .pdf-ribbon')) continue;
      if (n.matches('.ph')) { const h = n.querySelector('h3'); if (h) out.push({ t: 'h', level: 1, runs: runsOf(h) }); continue; }
      if (n.matches('.wheel-wrap')) {
        const svg = n.querySelector('svg');
        if (svg) { const w = svg.getBoundingClientRect().width / (root.__paperScale || 1) || 300; out.push({ t: 'svg', svg: svgText(svg), w_pt: w, h_pt: w, align: 'center' }); }
        continue;
      }
      if (n.matches('.brand')) {
        const img = n.querySelector('img');
        if (img && img.naturalWidth) { const h = img.height || 50; out.push({ t: 'img', src: img.src, h_pt: h, w_pt: h * img.naturalWidth / img.naturalHeight, align: 'left' }); }
        const who = n.querySelector('.who');
        if (who) who.innerText.split('\n').filter(Boolean).forEach((line, i) => out.push({ t: 'p', style: 'small', runs: [{ text: line, b: i === 0 }] }));
        continue;
      }
      if (n.matches('.facts, .tally, .box, .defs')) { out.push(gridTable(n)); continue; }
      if (n.matches('table')) {
        const rows = [...n.rows].map((tr) => [...tr.cells].map((td) => ({
          runs: runsOf(td), w: td.getBoundingClientRect().width, align: td.classList.contains('r') ? 'right' : td.classList.contains('c') ? 'center' : '',
          shade: tr.classList.contains('hi') ? 'F3ECDD' : '',
        })));
        out.push({ t: 'table', head: !!n.tHead, rows });
        continue;
      }
      if (n.matches('h4')) { out.push({ t: 'h', level: 2, runs: runsOf(n) }); continue; }
      if (n.matches('h5')) { out.push({ t: 'h', level: 3, runs: runsOf(n) }); continue; }
      if (n.matches('ul, ol')) { [...n.children].forEach((li) => out.push({ t: 'bullet', runs: runsOf(li) })); continue; }
      if (n.matches('.kicker')) { out.push({ t: 'p', style: 'kicker', align: 'center', runs: runsOf(n) }); continue; }
      if (n.matches('.cover .t')) { out.push({ t: 'p', style: 'title', align: 'center', runs: runsOf(n) }); continue; }
      if (n.matches('.cover .d')) { out.push({ t: 'p', style: 'small', align: 'center', runs: runsOf(n) }); continue; }
      if (n.matches('.lbl')) { out.push({ t: 'p', style: 'small', runs: runsOf(n).map((r) => ({ ...r, b: true })) }); continue; }
      if (n.matches('.days')) { out.push({ t: 'p', style: 'small', runs: [{ text: [...n.children].map((s) => s.textContent).join('  ·  ') }] }); continue; }
      if (n.matches('.src, .future, .note')) { out.push({ t: 'p', style: 'src', runs: runsOf(n) }); continue; }
      if (n.matches('p')) { out.push({ t: 'p', style: n.classList.contains('src') ? 'src' : '', align: 'justify', runs: runsOf(n) }); continue; }
      if (n.matches('.rem, .planet, .house, .two, .two > div, .cols, .cols > div, .cover, .mid, div')) { walk(n, out); continue; }
    }
  }

  /** pages: the rendered .paper elements. opts: { paper, logo, logoSize, logoWhere, headerText, footer, accent } */
  function build(pages, opts) {
    const blocks = [];
    pages.forEach((p, i) => { if (i) blocks.push({ t: 'break' }); walk(p, blocks); });
    let header = null;
    if (opts.headerText) {
      header = { text: opts.headerText };
      const img = opts.logoWhere === 'all' && document.querySelector('.paper .ph .logo img');
      if (img && img.naturalWidth) { header.logo = opts.logo; header.logo_h_pt = opts.logoSize * 0.75; header.logo_w_pt = header.logo_h_pt * img.naturalWidth / img.naturalHeight; }
    }
    return {
      page: opts.paper === 'letter' ? { w_mm: 215.9, h_mm: 279.4 } : { w_mm: 210, h_mm: 297 },
      accent: opts.accent, header, footer: opts.footer || '', blocks, cover: !!pages[0]?.querySelector('.cover'),
    };
  }

  root.DocxModel = { build, runsOf, svgText };
})(window);
