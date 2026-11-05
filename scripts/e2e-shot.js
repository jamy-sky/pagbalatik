// Screenshots of the running desktop app over WebView2's debugging port (see e2e-export.js for how to start it).
// Usage: node scripts/e2e-shot.js <out.png> [url-to-open-first] [js-to-run-first]
// With a URL (a PDF, say) the page is opened, captured, and the app sent back to its own page.
const fs = require('fs');
const [out, url, js] = process.argv.slice(2);
const PORT = process.env.CDP_PORT || 9229;

(async () => {
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0; const pending = new Map();
  ws.onmessage = (m) => { const msg = JSON.parse(m.data); pending.get(msg.id)?.(msg); pending.delete(msg.id); };
  const send = (method, params) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const home = (await send('Runtime.evaluate', { expression: 'location.href', returnByValue: true })).result.result.value;
  if (url) { await send('Page.navigate', { url }); await wait(2500); }
  if (js) { await send('Runtime.evaluate', { expression: js, awaitPromise: true }); await wait(800); }
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
  if (url) await send('Page.navigate', { url: home });
  ws.close();
  console.log(`  saved ${out}`);
})().catch((e) => { console.error(e.message || e); process.exit(1); });
