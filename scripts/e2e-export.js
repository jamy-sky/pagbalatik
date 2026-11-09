// End-to-end check of the two report formats in the running desktop app. Start the development build with
// WebView2's debugging port open and a throwaway profile, then run this:
//
//   set PAGBALATIK_USER_DATA=%TEMP%\pagbalatik-test
//   set WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9229
//   npm start
//   node scripts/e2e-export.js <output folder> [natal|forecast|synastry|fortune|money|travel|military|business|election]
//
// It adds two sample charts if the profile has fewer, builds the chosen report (the natal reading by default), and
// saves it as PDF and DOCX through the same calls the Save buttons use (without the save dialog), then reports the
// files' sizes.
const fs = require('fs');
const path = require('path');

const out = path.resolve(process.argv[2] || '.');
const type = process.argv[3] || 'natal';
const PORT = process.env.CDP_PORT || 9229;

async function main() {
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
  const page = targets.find((t) => t.type === 'page' && /tauri\.localhost|localhost/.test(t.url));
  if (!page) throw new Error(`No app page on port ${PORT}: is the app running with the debugging port open?`);
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (m) => { const msg = JSON.parse(m.data); if (pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); } };
  const send = (method, params) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text);
    return r.result?.result?.value;
  };

  const pdf = path.join(out, `e2e-${type}.pdf`);
  const docx = path.join(out, `e2e-${type}.docx`);
  for (const f of [pdf, docx]) if (fs.existsSync(f)) fs.rmSync(f);

  const result = await evaluate(`(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    let data = await app.load();
    if (!data || !data.charts || !data.charts.length) {
      document.querySelector('[data-act=new]').click(); await wait(300);
      const n = document.getElementById('c-name'); n.value = 'Maria Santos'; n.dispatchEvent(new Event('change', { bubbles: true })); await wait(100);
      const dt = document.getElementById('c-dt'); dt.value = '1990-06-15T08:30'; dt.dispatchEvent(new Event('change', { bubbles: true })); await wait(800);
      data = await app.load();
    }
    if (data.charts.length < 2) {
      document.querySelector('[data-act=new]').click(); await wait(300);
      const n = document.getElementById('c-name'); n.value = 'Diego Reyes'; n.dispatchEvent(new Event('change', { bubbles: true })); await wait(100);
      const dt = document.getElementById('c-dt'); dt.value = '1987-11-03T21:10'; dt.dispatchEvent(new Event('change', { bubbles: true })); await wait(800);
      data = await app.load();
    }
    const c = data.charts[0];
    const logo = await app.logo.get();
    const o = { ...data.settings.report, practice: data.settings.report.practice || 'Sample Practice', contact: 'readings@example.com', logo };
    const type = ${JSON.stringify(type)};
    const { pages } = type === 'forecast' ? Forecast.build(c, { ...o, months: 3 }) : type === 'synastry' ? Synastry.build(c, data.charts[1], o) : type === 'fortune' ? Fortune.build(c, o)
      : ['money', 'travel', 'military'].includes(type) ? Themes.build(c, { ...o, theme: type, months: 6 })
      : type === 'business' ? Business.build(c, { ...data.charts[1], kind: 'business', timeKnown: false }, o)
      : type === 'election' ? Election.build(c, { ...o, days: 30 }) : Report.build(c, o);
    const root = document.getElementById('print-root');
    root.innerHTML = pages.map((pg, i) => pg.html(i + 1, pages.length)).join('');
    await Promise.all([...root.querySelectorAll('img')].map((i) => i.decode().catch(() => {})));
    await app.exportPdf(${JSON.stringify(pdf)}, 8.2677, 11.6929);
    const model = DocxModel.build([...root.querySelectorAll('.paper')], { paper: 'a4', logo, logoSize: o.logoSize, logoWhere: o.logoWhere,
      headerText: c.name + ' · ' + type, footer: 'Sample Practice · Natal reading', accent: '8E2A1C' });
    await app.exportDocx(${JSON.stringify(docx)}, model);
    root.innerHTML = '';
    return { pages: pages.length, blocks: model.blocks.length, logo: !!logo, headerLogo: !!(model.header && model.header.logo) };
  })()`);
  ws.close();
  console.log('  built', result);
  for (const f of [pdf, docx]) console.log(`  ${fs.existsSync(f) ? 'ok  ' : 'MISSING'} ${f}${fs.existsSync(f) ? ` (${(fs.statSync(f).size / 1024).toFixed(0)} KB)` : ''}`);
}
main().catch((e) => { console.error(e.message || e); process.exit(1); });
