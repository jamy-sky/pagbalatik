/* Pagbalatik: window.app, the page's calls to the rest of the app (src-tauri/src/lib.rs).
   Opened in a plain browser (to look at the page while developing) it falls back to localStorage, and reports
   can't be saved. */
(function () {
  const T = window.__TAURI__;

  let geo = null;
  async function searchCities(q) {
    geo ||= Promise.all(['geo/zone.tab', 'geo/cities.tsv'].map((f) => fetch(f).then((r) => r.text()).catch(() => '')))
      .then(([zoneTab, cities]) => window.CityZone.init({ zoneTab, cities }));
    await geo;
    return window.CityZone.search(q);
  }

  if (!T) {
    const KEY = 'pagbalatik-data';
    window.app = {
      desktop: false,
      load: async () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } },
      save: async (data) => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {} return true; },
      storePath: async () => 'localStorage (browser preview)',
      searchCities,
      logo: { get: async () => null, pick: async () => null, clear: async () => true },
      femtBirth: async () => null,
      reportPath: async () => null,
      exportPdf: async () => { throw new Error('Reports are saved from the desktop app.'); },
      exportDocx: async () => { throw new Error('Reports are saved from the desktop app.'); },
      exportText: async () => null,
      importText: async () => null,
      openPath: () => {},
    };
    return;
  }

  const invoke = T.core.invoke;
  const win = T.window.getCurrentWindow();

  // The window has no frame; the page draws Windows' three buttons, as FEMT does.
  const BUTTONS = [
    ['min', 'Minimize', '<path d="M1 5.5h9"/>', () => win.minimize()],
    ['max', 'Maximize', '<rect x="1.5" y="1.5" width="8" height="8"/>', () => win.toggleMaximize()],
    ['close', 'Close', '<path d="M1.5 1.5l8 8M9.5 1.5l-8 8"/>', () => win.close()],
  ];
  function drawControls() {
    const bar = document.querySelector('.titlebar');
    if (!bar) return;
    bar.setAttribute('data-tauri-drag-region', '');
    bar.querySelectorAll('.spacer, .name').forEach((el) => el.setAttribute('data-tauri-drag-region', ''));
    const box = document.createElement('span');
    box.className = 'win-controls';
    for (const [id, title, svg, act] of BUTTONS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `win-btn win-${id}`;
      b.title = title;
      b.innerHTML = `<svg viewBox="0 0 11 11" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1">${svg}</svg>`;
      b.addEventListener('click', act);
      box.append(b);
    }
    bar.append(box);
  }

  // Web links open in the browser, never inside the app.
  document.addEventListener('click', (e) => {
    const a = e.target.closest?.('a[href]');
    if (!a || !/^https?:/.test(a.href)) return;
    e.preventDefault();
    invoke('open_url', { url: a.href });
  }, true);

  window.app = {
    desktop: true,
    load: () => invoke('store_load'),
    save: (data) => invoke('store_save', { data }),
    storePath: () => invoke('store_path'),
    searchCities,
    logo: { get: () => invoke('logo_get'), pick: () => invoke('logo_pick'), clear: () => invoke('logo_clear') },
    femtBirth: () => invoke('femt_birth'),
    reportPath: (kind, name) => invoke('report_path', { kind, name }),
    exportPdf: (path, width, height) => invoke('export_pdf', { path, width, height }),
    exportDocx: (path, model) => invoke('export_docx', { path, model }),
    exportText: (name, text) => invoke('export_text', { name, text }),
    importText: () => invoke('import_text'),
    openPath: (path) => invoke('open_path', { path }),
    setBackground: (bg) => win.setBackgroundColor?.(bg).catch(() => {}),
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', drawControls);
  else drawControls();
})();
