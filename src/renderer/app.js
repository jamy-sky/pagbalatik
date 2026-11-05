/* Pagbalatik: the page. Four views on the left rail: Chart, Saved charts, Natal reading, Settings.
   Calculations: chart-engine.js (FEMT's). The report: report.js (built from the reviewed mockup). Files: bridge.js. */
(function () {
  'use strict';
  const E = window.ChartEngine, W = window.Wheel, R = window.Report, app = window.app;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const ELC = { fire: 'el-fire', earth: 'el-earth', air: 'el-air', water: 'el-water' };
  const ASP = Object.fromEntries(E.ASPECTS.map((a) => [a.id, a]));
  const BODY = Object.fromEntries(E.BODIES.map((b) => [b.id, b]));
  const fmtDeg = (b) => `${b.deg}°${pad(b.min)}′`;
  const offsetText = (min) => `UTC${min < 0 ? '−' : '+'}${pad(Math.floor(Math.abs(min) / 60))}:${pad(Math.abs(min) % 60)}`;
  const sysTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const ZONES = Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone') : [sysTz];
  const canonZone = (tz) => { try { return new Intl.DateTimeFormat('en', { timeZone: tz }).resolvedOptions().timeZone; } catch { return null; } };
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
  const HOUSE_SYSTEMS = [['whole', 'Whole sign'], ['porphyry', 'Porphyry'], ['placidus', 'Placidus'], ['equal', 'Equal']];

  // ---------- data ----------
  const REPORT_KEYS = ['logoSize', 'logoWhere', 'practice', 'contact', 'style', 'paper', 'houses', 'trip', 'modern', 'omitDeath', 'cite', 'herbs'];
  const defaults = () => ({
    version: 1,
    charts: [],
    settings: {
      theme: 'night', current: null,
      place: { name: 'Manila', lat: 14.5995, lon: 120.9842, tz: 'Asia/Manila' },
      report: { ...Object.fromEntries(REPORT_KEYS.map((k) => [k, R.DEFAULTS[k]])), practice: '', contact: '', sec: { ...R.DEFAULTS.sec } },
    },
  });
  let D = defaults();
  const state = { view: 'chart', mode: 'chart', transitMs: Date.now(), live: true, logo: null, cities: [], query: '', building: null, femt: null };
  let saveTimer = null;
  const persist = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => app.save(D).catch((e) => toast(`Could not save: ${esc(e)}`, true)), 300); };
  const RS = () => D.settings.report;
  const current = () => D.charts.find((c) => c.id === D.settings.current) || D.charts[0] || null;
  const chartOf = (c, ms) => E.chart(ms ?? c.ms, c.place.lat, c.place.lon, { houseSystem: RS().houses, nodeKind: 'true' });
  const zoned = (c) => E.utcToZoned(c.ms, c.tz);
  const fmtBirth = (c) => { const z = zoned(c); return `${z.d} ${MONTHS[z.m - 1]} ${z.y}, ${pad(z.h)}:${pad(z.mi)}`; };

  function toast(html, err, action) {
    const t = $('toast');
    t.innerHTML = html + (action ? `<button type="button" id="toast-act">${esc(action.label)}</button>` : '');
    t.classList.toggle('err', !!err);
    t.classList.add('show');
    if (action) $('toast-act').onclick = action.run;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => t.classList.remove('show'), err ? 9000 : 6000);
  }

  function setTheme(theme) {
    document.body.dataset.theme = theme;
    app.setBackground?.(theme === 'night' ? '#05070F' : theme === 'vellum' ? '#E5D9BF' : '#EEF1F6');
  }

  // ---------- rendering ----------
  function render() {
    document.querySelectorAll('.rail-btn').forEach((b) => b.classList.toggle('on', b.dataset.go === state.view));
    const c = current();
    $('who').textContent = c && state.view !== 'settings' ? c.name : '';
    const main = $('main');
    if (state.view === 'library') main.innerHTML = libraryView();
    else if (state.view === 'settings') main.innerHTML = settingsView();
    else if (!c) main.innerHTML = emptyView();
    else if (state.view === 'report') main.innerHTML = reportView(c);
    else main.innerHTML = chartView(c);
    if (state.view === 'report' && c) fillPreview(c);
  }

  function emptyView() {
    return `<div class="empty"><h2>No charts yet</h2><p>Start with a birth chart: the moment and place of birth. Everything else, including the natal reading, is worked out from it.</p>
      <button class="btn primary" data-act="new">New chart</button>${state.femt ? '<button class="btn" data-act="femt">Use FEMT\'s birth chart</button>' : ''}
      <button class="btn" data-act="import">Import charts…</button></div>`;
  }

  // ---------- the chart ----------
  function chartView(c) {
    const tr = state.mode === 'transits';
    if (tr && state.live) state.transitMs = Date.now();
    const natal = chartOf(c), now = tr ? chartOf(c, state.transitMs) : null;
    const z = zoned(c);
    const val = `${z.y}-${pad(z.m)}-${pad(z.d)}T${pad(z.h)}:${pad(z.mi)}`;
    const tz2 = E.utcToZoned(state.transitMs, sysTz);
    const tval = `${tz2.y}-${pad(tz2.m)}-${pad(tz2.d)}T${pad(tz2.h)}:${pad(tz2.mi)}`;
    const cross = tr ? E.aspects(now.bodies.map((b) => ({ id: b.id, lon: b.lon })), natal.bodies.map((b) => ({ id: b.id, lon: b.lon })), { orbScale: 0.5 }) : natal.aspects;
    const row = (b) => `<tr><td class="g ${b.id}">${b.glyph}</td><td>${b.name}</td><td class="num">${fmtDeg(b)}</td><td class="g ${ELC[b.sign.element]}">${b.sign.glyph}</td><td>${b.retrograde ? '℞' : ''}</td><td class="num">${b.house}</td></tr>`;
    const ang = (k, n) => { const s = E.signOf(natal.angles[k]); return `<tr><td class="g">${k === 'asc' ? 'As' : 'Mc'}</td><td>${n}</td><td class="num">${s.deg}°${pad(s.min)}′</td><td class="g ${ELC[s.sign.element]}">${s.sign.glyph}</td><td></td><td></td></tr>`; };
    const steps = [['y', -1, '«Y'], ['m', -1, '‹M'], ['d', -1, '‹D'], ['h', -1, '‹H'], ['h', 1, 'H›'], ['d', 1, 'D›'], ['m', 1, 'M›'], ['y', 1, 'Y»']];
    return `<div class="chart-view">
      <div class="chart-stage">
        <div class="stage-head"><h1>${esc(c.name)}</h1><span class="muted">${fmtBirth(c)} · ${esc(c.place.name || `${c.place.lat.toFixed(2)}°, ${c.place.lon.toFixed(2)}°`)} · ${offsetText(z.offset)}</span></div>
        ${W.svg(natal, now)}
        <div class="legend"><span><i class="asp-trine"></i>Trine</span><span><i class="asp-sextile"></i>Sextile</span><span><i class="asp-square"></i>Square</span><span><i class="asp-opposition"></i>Opposition</span>${tr ? '<span>Inner: birth chart · outer ring: transits</span>' : ''}</div>
        ${natal.houses.fallback ? `<p class="muted small" style="text-align:center">${esc(natal.houses.fallback)}</p>` : ''}
      </div>
      <aside class="side">
        <div class="cta"><button class="btn primary" data-go="report">Natal reading…</button><button class="btn" data-act="new">New chart</button></div>
        <label class="field"><span>Name</span><input type="text" id="c-name" value="${esc(c.name)}" spellcheck="false"></label>
        <div class="seg"><button class="${tr ? '' : 'on'}" data-mode="chart">Chart</button><button class="${tr ? 'on' : ''}" data-mode="transits">Transits</button></div>
        ${tr ? `<section class="moment"><span class="label">Transits for</span><div class="row"><input type="datetime-local" id="t-dt" value="${tval}"><button class="chip${state.live ? ' on' : ''}" data-act="now" style="flex:none">Now</button></div></section>` : ''}
        <section class="moment">
          <span class="label">Birth data</span>
          <input type="datetime-local" id="c-dt" value="${val}" aria-label="Date and time of birth">
          <div class="steps">${steps.map(([u, n, l]) => `<button class="chip" data-step="${u}" data-n="${n}">${l}</button>`).join('')}</div>
          <input type="search" id="c-city" placeholder="${esc(c.place.name || 'Search a city')}" autocomplete="off" spellcheck="false" aria-label="Place of birth">
          <div class="city-results" id="c-cities"></div>
          <div class="latlon"><label>Lat <input type="number" step="0.0001" id="c-lat" value="${c.place.lat}"></label><label>Lon <input type="number" step="0.0001" id="c-lon" value="${c.place.lon}"></label></div>
          <label>Time zone <input type="text" id="c-tz" list="zones" spellcheck="false" value="${esc(c.tz)}"></label>
          <span class="muted small">Picking a city sets its time zone; the clock time stays as entered.</span>
        </section>
        <section class="opts"><label>Houses <select id="c-houses">${HOUSE_SYSTEMS.map(([v, l]) => `<option value="${v}"${RS().houses === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label></section>
        <section><span class="label">Positions</span><table class="positions"><tbody>${natal.bodies.map(row).join('')}${ang('asc', 'Ascendant')}${ang('mc', 'Midheaven')}</tbody></table></section>
        <section><span class="label">${tr ? 'Transits to the birth chart' : 'Aspects'}</span><table class="aspects"><tbody>${cross.slice(0, 24).map((a) => `<tr><td class="g ${a.a}">${BODY[a.a].glyph}</td><td class="g asp-${a.aspect}">${ASP[a.aspect].glyph}</td><td class="g ${a.b}">${BODY[a.b].glyph}</td><td>${BODY[a.a].name} ${ASP[a.aspect].name.toLowerCase()} ${tr ? 'natal ' : ''}${BODY[a.b].name}</td><td class="num">${a.orb.toFixed(1)}°</td></tr>`).join('') || '<tr><td class="muted">None within orb.</td></tr>'}</tbody></table></section>
        <datalist id="zones">${ZONES.map((t) => `<option value="${esc(t)}"></option>`).join('')}</datalist>
      </aside>
    </div>`;
  }

  function updateChart(c, change) {
    Object.assign(c, change, { updated: Date.now() });
    persist();
    render();
  }
  // Keep the wall-clock time the same: the person is saying when it happened there.
  function setZone(c, tz) {
    const z = zoned(c);
    return E.zonedToUtc(z.y, z.m, z.d, z.h, z.mi, tz);
  }
  function stepTime(c, unit, n) {
    const z = zoned(c);
    let { y, m, d, h } = z;
    if (unit === 'h') h += n; if (unit === 'd') d += n; if (unit === 'm') m += n; if (unit === 'y') y += n;
    const t = new Date(Date.UTC(y, m - 1, d, h, z.mi));
    return E.zonedToUtc(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate(), t.getUTCHours(), t.getUTCMinutes(), c.tz);
  }
  const parseLocal = (v, tz) => { if (!v) return null; const [d, t] = v.split('T'); const [y, mo, da] = d.split('-').map(Number); const [h, mi] = (t || '0:0').split(':').map(Number); return E.zonedToUtc(y, mo, da, h, mi, tz); };

  function newChart(from) {
    const pl = D.settings.place;
    const c = { id: uid(), name: 'New chart', ms: Date.now(), tz: pl.tz || sysTz, place: { name: pl.name, lat: pl.lat, lon: pl.lon }, tags: [], notes: '', created: Date.now(), updated: Date.now(), ...from };
    D.charts.push(c);
    D.settings.current = c.id;
    state.view = 'chart';
    persist();
    render();
    if (!from) setTimeout(() => { const n = $('c-name'); n?.focus(); n?.select(); }, 0);
    return c;
  }

  // ---------- saved charts ----------
  function libraryView() {
    const q = state.query.trim().toLowerCase();
    const list = D.charts.filter((c) => !q || c.name.toLowerCase().includes(q) || (c.tags || []).some((t) => t.toLowerCase().includes(q)) || (c.place.name || '').toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
    return `<div class="lib">
      <div class="lib-head"><h1>Saved charts</h1><span class="muted">${D.charts.length} ${D.charts.length === 1 ? 'chart' : 'charts'}</span>
        <input type="search" class="search" id="lib-q" placeholder="Search by name, place or tag" value="${esc(state.query)}"><button class="btn primary" data-act="new">+ New chart</button></div>
      ${D.charts.length ? `<table class="lib-table"><thead><tr><th>Name</th><th>Born</th><th>Place</th><th>☉ ☽ As</th><th>Tags</th><th></th></tr></thead><tbody>
      ${list.map((c) => { const ch = chartOf(c), sun = ch.bodies[0], moon = ch.bodies[1], as = E.signOf(ch.angles.asc);
        return `<tr class="${c.id === D.settings.current ? 'sel' : ''}"><td class="nm">${esc(c.name)}</td><td>${fmtBirth(c)}</td><td>${esc(c.place.name || '—')} <span class="muted small">${offsetText(zoned(c).offset)}</span></td>
        <td class="big3"><span class="${ELC[sun.sign.element]}" title="Sun in ${sun.sign.name}">${sun.sign.glyph}</span><span class="${ELC[moon.sign.element]}" title="Moon in ${moon.sign.name}">${moon.sign.glyph}</span><span class="${ELC[as.sign.element]}" title="${as.sign.name} rising">${as.sign.glyph}</span></td>
        <td><input type="text" class="tags-in" data-tags="${c.id}" value="${esc((c.tags || []).join(', '))}" placeholder="add tags" style="width:150px;padding:3px 7px;font-size:12px"></td>
        <td class="acts"><button class="btn" data-open="${c.id}">Open</button> <button class="btn" data-report="${c.id}">Reading…</button> <button class="btn" data-dup="${c.id}">Copy</button> <button class="btn danger" data-del="${c.id}">Delete</button></td></tr>`; }).join('')}
      </tbody></table>${!list.length ? '<p class="muted">No chart matches.</p>' : ''}` : '<p class="muted">No charts yet.</p>'}
      <div class="lib-foot"><button class="btn" data-act="import">Import…</button><button class="btn" data-act="export"${D.charts.length ? '' : ' disabled'}>Export all…</button>${state.femt ? '<button class="btn" data-act="femt">Add FEMT\'s birth chart</button>' : ''}<span class="muted small">Saved on this PC only.</span></div>
    </div>`;
  }

  // ---------- the natal reading ----------
  const reportOpts = () => ({ ...RS(), logo: state.logo, sec: { ...RS().sec } });
  function reportView(c) {
    const o = RS();
    const chk = (k, l, d) => `<label><input type="checkbox" data-sec="${k}"${o.sec[k] ? ' checked' : ''}><span>${l}${d ? `<small>${d}</small>` : ''}</span></label>`;
    const opt = (v, l, cur) => `<option value="${v}"${v === cur ? ' selected' : ''}>${l}</option>`;
    return `<div class="rep"><div class="rep-side">
      <h2>Natal reading</h2>
      <label class="field"><span>Chart</span><select id="r-chart">${D.charts.slice().sort((a, b) => a.name.localeCompare(b.name)).map((x) => opt(x.id, esc(x.name), c.id)).join('')}</select></label>
      <div class="gen"><button class="btn primary" data-export="pdf">Save PDF…</button><button class="btn" data-export="docx">Save DOCX…</button></div>
      <h3>Pages</h3><div class="toc" id="toc"></div>
      <h3>Sections</h3><div class="checks">
        ${chk('cover', 'Cover', 'Logo, practice details, wheel')}${chk('glance', 'The nativity at a glance')}
        ${chk('dignities', 'Essential and accidental dignity')}${chk('temperament', 'Temperament and the quality of the soul')}
        ${chk('planets', 'The seven planets')}${chk('houses', 'The twelve houses')}${chk('lots', 'Lots and fixed stars')}
        ${chk('timing', 'Timing: profections and firdaria')}${chk('remedies', 'Working with the chart', 'Magnify, strengthen, neutralize, restrain, settle')}${chk('sources', 'Method and sources')}</div>
      <h3>Method</h3>
      <label class="field"><span>Houses</span><select data-opt="houses">${HOUSE_SYSTEMS.map(([v, l]) => opt(v, l, o.houses)).join('')}<option disabled>Regiomontanus (Lilly): planned</option></select></label>
      <label class="field"><span>Triplicity rulers</span><select data-opt="trip">${opt('dorothean', 'Dorothean (day, night, partner)', o.trip)}${opt('ptolemaic', 'Ptolemaic (as Lilly)', o.trip)}</select></label>
      <label class="field"><span>Uranus, Neptune, Pluto</span><select data-opt="modern">${opt('listed', 'List them, don\'t judge them', o.modern)}${opt('off', 'Leave them out', o.modern)}</select></label>
      <div class="checks">
        <label><input type="checkbox" data-optb="omitDeath"${o.omitDeath ? ' checked' : ''}><span>Leave out length of life and death<small>The 8th-house judgments of death</small></span></label>
        <label><input type="checkbox" data-optb="cite"${o.cite ? ' checked' : ''}><span>Cite sources under each section</span></label>
        <label><input type="checkbox" data-optb="herbs"${o.herbs ? ' checked' : ''}><span>Include plants (Culpeper)<small>With a not-medical-advice note</small></span></label></div>
      <h3>Look</h3>
      <div class="row"><label class="field"><span>Style</span><select data-opt="style">${opt('vellum', 'Vellum', o.style)}${opt('clean', 'Clean', o.style)}</select></label>
        <label class="field"><span>Paper</span><select data-opt="paper">${opt('a4', 'A4', o.paper)}${opt('letter', 'US Letter', o.paper)}</select></label></div>
      <p class="muted small" style="margin:0">Logo, practice name and contact lines are in <a href="#" data-go="settings">Settings</a>.</p>
      <div class="later"><b>Planned report types:</b> Chart sheet, Transit forecast, Comparison. <b>Planned in this report:</b> the prayer and psalm for each remedy, from FEMT.</div>
    </div>
    <div class="viewer" id="viewer"><div class="busy">Working out the reading…</div></div></div>`;
  }

  // Built after the view is on screen: the remedy pages are packed by measuring them.
  function fillPreview(c) {
    const token = (state.building = {});
    requestAnimationFrame(() => {
      if (state.building !== token || !$('viewer')) return;
      try {
        const { pages } = R.build(c, reportOpts());
        $('viewer').innerHTML = pages.map((pg, i) => pg.html(i + 1, pages.length)).join('');
        $('toc').innerHTML = pages.map((pg, i) => `<button data-jump="${i}"><span>${i + 1}</span>${esc(pg.title)}</button>`).join('');
      } catch (e) {
        console.error(e);
        $('viewer').innerHTML = `<div class="busy">Could not build the reading: ${esc(e.message)}</div>`;
      }
    });
  }

  async function exportReport(kind) {
    const c = current();
    if (!c) return;
    if (!app.desktop) { toast('Reports are saved from the desktop app.', true); return; }
    const path = await app.reportPath(kind, `Natal reading - ${c.name}`);
    if (!path) return;
    const buttons = document.querySelectorAll('[data-export]');
    buttons.forEach((b) => (b.disabled = true));
    toast(`Saving the ${kind.toUpperCase()}…`);
    const root = $('print-root');
    try {
      const o = reportOpts();
      const { pages } = R.build(c, o);
      root.innerHTML = pages.map((pg, i) => pg.html(i + 1, pages.length)).join('');
      await Promise.all([...root.querySelectorAll('img')].map((i) => (i.decode ? i.decode().catch(() => {}) : null)));
      if (kind === 'pdf') {
        const [w, h] = o.paper === 'letter' ? [8.5, 11] : [8.2677, 11.6929];
        await app.exportPdf(path, w, h);
      } else {
        const model = window.DocxModel.build([...root.querySelectorAll('.paper')], {
          paper: o.paper, logo: state.logo, logoSize: o.logoSize, logoWhere: o.logoWhere,
          headerText: `${c.name} · Natal reading`, footer: `${o.practice || 'Pagbalatik'} · Natal reading · tropical zodiac, ${o.houses === 'whole' ? 'whole-sign' : o.houses} houses`,
          accent: o.style === 'clean' ? '23407F' : '8E2A1C',
        });
        await app.exportDocx(path, model);
      }
      toast(`Saved <code>${esc(path)}</code>`, false, { label: 'Open', run: () => app.openPath(path) });
      app.openPath(path);
    } catch (e) {
      console.error(e);
      toast(`Could not save the ${kind.toUpperCase()}: ${esc(e.message || e)}`, true);
    } finally {
      root.innerHTML = '';
      buttons.forEach((b) => (b.disabled = false));
    }
  }

  // ---------- settings ----------
  function settingsView() {
    const o = RS(), pl = D.settings.place;
    const sample = current() || { name: 'Sample', ms: Date.UTC(1990, 5, 15, 0, 30), tz: 'Asia/Manila', place: { name: 'Manila', lat: 14.5995, lon: 120.9842 } };
    return `<div class="settings"><h1>Settings</h1><div class="grid">
      <section class="card"><h2>Report logo</h2>
        <div class="logo-drop"><div class="thumb">${state.logo ? `<img src="${state.logo}" alt="">` : 'None'}</div>
          <div><p>PNG, JPG or SVG. It goes in the upper left of the report: on the cover, beside your name and contact lines, and in each page's header.</p>
          <div class="acts"><button class="btn" data-act="logo">${state.logo ? 'Replace…' : 'Choose image…'}</button>${state.logo ? '<button class="btn danger" data-act="nologo">Remove</button>' : ''}</div></div></div>
        <label class="field"><span>Show it on</span><select data-opt="logoWhere"><option value="all"${o.logoWhere === 'all' ? ' selected' : ''}>The cover and every page header</option><option value="cover"${o.logoWhere === 'cover' ? ' selected' : ''}>The cover only</option></select></label>
        <label class="field"><span id="logo-size-label">Height in the page header: ${o.logoSize} pt (cover: ${Math.round(o.logoSize * 1.7)} pt)</span><input type="range" min="20" max="56" value="${o.logoSize}" data-range="logoSize"></label>
        <div class="preview-mini" id="logo-preview">${miniPreview(sample)}</div>
      </section>
      <section class="card"><h2>On the cover</h2>
        <label class="field"><span>Practice or reader's name</span><input type="text" data-text="practice" value="${esc(o.practice)}" placeholder="Shown beside the logo and in each page's footer"></label>
        <label class="field"><span>Contact lines</span><textarea data-text="contact" placeholder="Email, website, city">${esc(o.contact)}</textarea></label>
        <p>Leave both empty for a plain cover.</p>
      </section>
      <section class="card"><h2>Appearance</h2>
        <div class="seg">${[['night', 'Night'], ['vellum', 'Vellum'], ['daylight', 'Daylight']].map(([v, l]) => `<button class="${D.settings.theme === v ? 'on' : ''}" data-theme="${v}">${l}</button>`).join('')}</div>
        <p>The reports are always printed light, in the Vellum or Clean style you choose for each reading.</p>
      </section>
      <section class="card"><h2>New charts start at</h2>
        <input type="search" id="s-city" placeholder="${esc(pl.name || 'Search a city')}" autocomplete="off" spellcheck="false">
        <div class="city-results" id="s-cities"></div>
        <p>${esc(pl.name)} · ${pl.lat.toFixed(3)}°, ${pl.lon.toFixed(3)}° · ${esc(pl.tz)}</p>
      </section>
      <section class="card"><h2>Your data</h2>
        <p>Charts and settings are kept on this PC only, in <code id="store-path">${esc(state.storePath || '…')}</code>. The logo is kept beside them, in <code>branding</code>.</p>
        <div class="row" style="flex-wrap:wrap"><button class="btn" data-act="export"${D.charts.length ? '' : ' disabled'}>Export charts…</button><button class="btn" data-act="import">Import charts…</button>${state.femt ? '<button class="btn" data-act="femt">Add FEMT\'s birth chart</button>' : ''}</div>
      </section>
      <section class="card"><h2>About</h2>
        <p>Pagbalatik ${esc(state.version || '0.9.0-beta')}. Positions from FEMT's chart engine (JPL elements; Meeus for the Moon). The natal reading follows Ptolemy, Valens, Firmicus, Bonatti, Lilly, Ramesey and Gadbury; its remedies follow Ficino, Agrippa and Culpeper. Every report ends with its sources.</p>
        <p>Astrology describes inclinations, not fixed outcomes. The plants in the reports are traditional correspondences, not medical advice.</p>
      </section>
    </div></div>`;
  }
  function miniPreview(c) {
    try {
      const { pages } = R.build(c, { ...reportOpts(), sec: { cover: true, glance: true } });
      return pages.slice(0, 2).map((pg, i) => `<div class="pwrap">${pg.html(i + 1, 2)}</div>`).join('');
    } catch { return ''; }
  }

  // ---------- city search (chart and settings) ----------
  let cityTimer = null;
  function cityInput(input, listId, pick) {
    clearTimeout(cityTimer);
    const q = input.value;
    cityTimer = setTimeout(async () => {
      const res = await app.searchCities(q);
      if (input.value !== q) return;
      state.cities = res;
      state.pick = pick;
      $(listId).innerHTML = res.slice(0, 8).map((c, i) => `<button type="button" data-city="${i}">${esc(c.name)} <span>${esc(c.country)} · ${esc(c.tz || '')}</span></button>`).join('');
    }, 120);
  }

  // ---------- events ----------
  document.addEventListener('click', async (e) => {
    const el = e.target.closest('button, a[data-go]');
    if (!el) return;
    const d = el.dataset;
    if (el.tagName === 'A') e.preventDefault();
    const c = current();
    if (d.go) { state.view = d.go; render(); return; }
    if (d.mode) { state.mode = d.mode; if (d.mode === 'transits') { state.live = true; } render(); return; }
    if (d.step && c) { updateChart(c, { ms: stepTime(c, d.step, +d.n) }); return; }
    if (d.city !== undefined) { const city = state.cities[+d.city]; if (city && state.pick) state.pick(city); return; }
    if (d.open) { D.settings.current = d.open; state.view = 'chart'; persist(); render(); return; }
    if (d.report) { D.settings.current = d.report; state.view = 'report'; persist(); render(); return; }
    if (d.dup) { const src = D.charts.find((x) => x.id === d.dup); if (src) { D.charts.push({ ...JSON.parse(JSON.stringify(src)), id: uid(), name: `${src.name} (copy)`, created: Date.now(), updated: Date.now() }); persist(); render(); } return; }
    if (d.del) {
      if (el.dataset.armed !== '1') { el.dataset.armed = '1'; el.textContent = 'Delete?'; setTimeout(() => { if (el.isConnected) { el.dataset.armed = ''; el.textContent = 'Delete'; } }, 3000); return; }
      const gone = D.charts.find((x) => x.id === d.del);
      D.charts = D.charts.filter((x) => x.id !== d.del);
      if (D.settings.current === d.del) D.settings.current = D.charts[0]?.id || null;
      persist(); render();
      toast(`Deleted ${esc(gone?.name)}.`, false, { label: 'Undo', run: () => { D.charts.push(gone); persist(); render(); $('toast').classList.remove('show'); } });
      return;
    }
    if (d.jump) { document.querySelectorAll('#viewer .paper')[+d.jump]?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if (d.export) { exportReport(d.export); return; }
    if (d.theme) { D.settings.theme = d.theme; setTheme(d.theme); persist(); render(); return; }
    switch (d.act) {
      case 'new': newChart(); break;
      case 'now': state.live = true; state.transitMs = Date.now(); render(); break;
      case 'femt': {
        const b = state.femt || (await app.femtBirth());
        if (b && b.ms) newChart({ name: b.name && b.name !== 'Birth' ? b.name : 'Birth chart (from FEMT)', ms: b.ms, tz: canonZone(b.tz) || b.tz || sysTz, place: { name: b.place?.name || '', lat: +b.place?.lat || 0, lon: +b.place?.lon || 0 } });
        break;
      }
      case 'logo': try { const url = await app.logo.pick(); if (url) { state.logo = url; render(); } } catch (err) { toast(esc(err), true); } break;
      case 'nologo': await app.logo.clear(); state.logo = null; render(); break;
      case 'export': {
        const text = JSON.stringify({ app: 'pagbalatik', version: 1, charts: D.charts }, null, 2);
        const p = await app.exportText('Pagbalatik charts.json', text);
        if (p) toast(`Exported ${D.charts.length} charts to <code>${esc(p)}</code>`);
        break;
      }
      case 'import': {
        try {
          const text = await app.importText();
          if (!text) break;
          const data = JSON.parse(text);
          const list = Array.isArray(data) ? data : data.charts;
          if (!Array.isArray(list)) throw new Error('This file has no charts in it.');
          let added = 0;
          for (const x of list) {
            if (!Number.isFinite(x?.ms) || !x.place || !Number.isFinite(+x.place.lat) || !Number.isFinite(+x.place.lon)) continue;
            if (D.charts.some((y) => y.id === x.id)) continue;
            D.charts.push({ id: x.id || uid(), name: String(x.name || 'Imported chart'), ms: x.ms, tz: canonZone(x.tz) || sysTz, place: { name: String(x.place.name || ''), lat: +x.place.lat, lon: +x.place.lon }, tags: Array.isArray(x.tags) ? x.tags.map(String) : [], notes: String(x.notes || ''), created: x.created || Date.now(), updated: Date.now() });
            added++;
          }
          if (!D.settings.current && D.charts[0]) D.settings.current = D.charts[0].id;
          persist(); render();
          toast(added ? `Imported ${added} ${added === 1 ? 'chart' : 'charts'}.` : 'No new charts in that file.');
        } catch (err) { toast(`Could not import: ${esc(err.message || err)}`, true); }
        break;
      }
      default: break;
    }
  });

  document.addEventListener('change', (e) => {
    const el = e.target, d = el.dataset, c = current();
    if (el.id === 'c-name' && c) { updateChart(c, { name: el.value.trim() || 'Untitled chart' }); return; }
    if (el.id === 'c-dt' && c) { const ms = parseLocal(el.value, c.tz); if (ms != null) updateChart(c, { ms }); return; }
    if (el.id === 't-dt') { const ms = parseLocal(el.value, sysTz); if (ms != null) { state.transitMs = ms; state.live = false; render(); } return; }
    if ((el.id === 'c-lat' || el.id === 'c-lon') && c) {
      const lat = parseFloat($('c-lat').value), lon = parseFloat($('c-lon').value);
      if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) updateChart(c, { place: { name: '', lat, lon } });
      return;
    }
    if (el.id === 'c-tz' && c) { const tz = canonZone(el.value.trim()); if (!tz) { el.value = c.tz; toast('That isn\'t a time zone this PC knows.', true); return; } updateChart(c, { ms: setZone(c, tz), tz }); return; }
    if (el.id === 'c-houses') { RS().houses = el.value; persist(); render(); return; }
    if (el.id === 'r-chart') { D.settings.current = el.value; persist(); render(); return; }
    if (d.tags) { const x = D.charts.find((y) => y.id === d.tags); if (x) { x.tags = el.value.split(',').map((t) => t.trim()).filter(Boolean); persist(); } return; }
    if (d.sec) { RS().sec[d.sec] = el.checked; persist(); render(); return; }
    if (d.opt) { RS()[d.opt] = el.value; persist(); render(); return; }
    if (d.optb) { RS()[d.optb] = el.checked; persist(); render(); return; }
    if (d.text) { RS()[d.text] = el.value; persist(); $('logo-preview').innerHTML = miniPreview(current() || D.charts[0]); return; }
    if (d.range) { persist(); render(); }
  });

  document.addEventListener('input', (e) => {
    const el = e.target, c = current();
    if (el.id === 'c-city' && c) {
      cityInput(el, 'c-cities', (city) => {
        const tz = canonZone(city.tz) || c.tz;
        const z = zoned(c);
        updateChart(c, { place: { name: city.name, lat: city.lat, lon: city.lon }, tz, ms: E.zonedToUtc(z.y, z.m, z.d, z.h, z.mi, tz) });
      });
      return;
    }
    if (el.id === 's-city') {
      cityInput(el, 's-cities', (city) => { D.settings.place = { name: city.name, lat: city.lat, lon: city.lon, tz: canonZone(city.tz) || sysTz }; persist(); render(); });
      return;
    }
    if (el.id === 'lib-q') { state.query = el.value; const pos = el.selectionStart; render(); const q = $('lib-q'); q.focus(); q.setSelectionRange(pos, pos); return; }
    if (el.dataset.range) {
      RS()[el.dataset.range] = +el.value;
      $('logo-size-label').textContent = `Height in the page header: ${el.value} pt (cover: ${Math.round(el.value * 1.7)} pt)`;
      $('logo-preview').innerHTML = miniPreview(current() || D.charts[0]);
    }
  });

  // Transits follow the clock while "Now" is on.
  setInterval(() => { if (state.view === 'chart' && state.mode === 'transits' && state.live && !document.activeElement?.matches('input, select, textarea')) render(); }, 60000);

  // ---------- start ----------
  async function start() {
    const saved = await app.load().catch(() => null);
    if (saved && Array.isArray(saved.charts)) {
      const base = defaults();
      D = { ...base, ...saved, settings: { ...base.settings, ...saved.settings, report: { ...base.settings.report, ...(saved.settings?.report || {}), sec: { ...base.settings.report.sec, ...(saved.settings?.report?.sec || {}) } } } };
    }
    setTheme(D.settings.theme);
    state.logo = await app.logo.get().catch(() => null);
    const fb = await app.femtBirth().catch(() => null);
    state.femt = fb && Number.isFinite(fb.ms) ? fb : null;
    if (!D.charts.length) state.view = 'chart';
    render();
    app.storePath().then((p) => { state.storePath = p; const el = $('store-path'); if (el) el.textContent = p; }).catch(() => {});
    if (window.__TAURI__?.app?.getVersion) window.__TAURI__.app.getVersion().then((v) => { state.version = v; $('version').textContent = v.replace(/^(\d+\.\d+)\.\d+-beta.*$/, '$1 beta'); }).catch(() => {});
  }
  start();
})();
