// Collects the installer `tauri build` made into dist/ as Pagbalatik-Setup-<version>.exe, removing any earlier
// installer there so dist/ holds only this version. Older versions can be rebuilt from their git tags.
// npm runs this as part of `npm run dist`. Usage: node scripts/dist.js [--dry-run]
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const { version } = require('../package.json');
const built = path.join(ROOT, 'src-tauri', 'target', 'release', 'bundle', 'nsis', `Pagbalatik_${version}_x64-setup.exe`);
const name = `Pagbalatik-Setup-${version}.exe`;
const dry = process.argv.includes('--dry-run');

if (!fs.existsSync(built)) {
  console.log(`  no installer at ${path.relative(ROOT, built)}; run \`npm run dist\``);
  process.exit(1);
}
const old = fs.existsSync(DIST) ? fs.readdirSync(DIST).filter((f) => /^Pagbalatik-Setup-.*\.exe$/.test(f) && f !== name) : [];
for (const f of old) {
  if (!dry) fs.rmSync(path.join(DIST, f));
  console.log(`  ${dry ? 'would remove' : 'removed'}  dist/${f}`);
}
if (!dry) {
  fs.mkdirSync(DIST, { recursive: true });
  fs.copyFileSync(built, path.join(DIST, name));
}
console.log(`  ${dry ? 'would copy' : 'copied'}   dist/${name} (${(fs.statSync(built).size / 1048576).toFixed(2)} MB)`);
