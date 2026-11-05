# Pagbalatik

Natal charts and traditional-astrology reports for Windows, saved on demand as PDF or DOCX. It began as the
Chart panel of [FEMT PC](https://github.com/jamy-sky/femt-pc) and uses FEMT's chart engine, city list and themes.

**0.9 beta.** The first report is the natal reading. The chart sheet, transit forecast and comparison are planned,
and so are the prayer and psalm for each remedy (from FEMT).

## What it does

- **Chart:** the wheel for a birth moment and place (FEMT's: Ascendant on the left, Whole sign, Porphyry, Placidus or
  Equal houses), with positions and aspects. **Transits** puts the current sky, or any moment, in a ring around it.
  The degrees of the Ascendant and Midheaven are written beside them on the wheel.
  Pick a city from the offline list and its time zone is set for you; the clock time stays as entered.
- **Saved charts:** as many people as you like, with tags, search, copy, import and export. If FEMT is installed, its
  saved birth chart can be added with one click.
- **Natal reading:** a report in the traditional manner, previewed page by page:
  the nativity at a glance (sect, rulers, lots); essential and accidental dignity with Lilly's points; the bounds (Egyptian and Chaldean, after Ptolemy I.20–21) and faces of every planet, angle and sign; temperament
  and the quality of the soul; the seven planets; the twelve houses by their lords; lots and fixed stars;
  profections and firdaria; **working with the chart** (FEMT's five actions, magnify, strengthen, neutralize,
  restrain and settle, with elections, Ficino's way of life, Agrippa's correspondences and Culpeper's plants); and
  its method and sources. Sections, house system, triplicities and style (Vellum or Clean, A4 or Letter) are chosen
  per reading. Judgments of death are left out unless you turn them on.
- **Save PDF / Save DOCX:** the PDF is the preview, printed by WebView2. The DOCX is built natively, with real headings
  and tables you can edit in Word, and the wheel as a picture.
- **Settings:** your logo (PNG, JPG or SVG) in the upper left of every report, on the cover and in each page's
  header or on the cover only; your practice name and contact lines; the theme; where new charts start.

Charts and settings are kept on this PC only, in `%APPDATA%\pagbalatik\pagbalatik-data.json`, with the logo in
`%APPDATA%\pagbalatik\branding`.

## Sources

The reading is our own wording; the rules come from public-domain texts, cited under each section of the report:
Ptolemy (*Tetrabiblos*, Robbins 1940 and Ashmand 1822), Valens, Firmicus Maternus, Bonatti, Lilly (*Christian
Astrology*, 1647), Ramesey (*Astrologia Restaurata*, 1653), Gadbury; for the remedies, Ficino (*De vita* III),
Agrippa (*Three Books of Occult Philosophy*, 1651) and Culpeper (*The Complete Herbal*, 1653). The Agrippa, Culpeper
and Ficino entries were checked against the texts; `scripts/test-traditional.js` holds the tables to them.

## Run from source

Requires [Node.js](https://nodejs.org/) 20 or later, [Rust](https://rustup.rs/) and the Visual Studio C++ Build Tools.

```bash
npm install
npm test
npm run dist
```

`npm test` checks the chart engine and the traditional tables and rules. `npm run dist` builds the Windows installer
into `dist/` as `Pagbalatik-Setup-<version>.exe`. To run it unpackaged, `npx tauri build --debug --no-bundle` and
start `src-tauri/target/debug/pagbalatik.exe` (set `PAGBALATIK_USER_DATA` to a folder to use a throwaway profile).

The page is in `src/renderer`; `src-tauri/src` holds the files, the PDF (`pdf.rs`) and the DOCX (`docx.rs`).

**The report comes from the mockup.** `mockups/natal-report-mockup.html` is the reviewed design and wording of the
natal reading. `node scripts/build-report.js` turns it into `src/renderer/report.js` and `report.css`: change the
mockup, then rebuild, so the two never drift apart. `scripts/e2e-export.js` saves a reading as PDF and DOCX from
the running app (see its header for how to start the app for it).

## Mockups

`mockups/` holds the design mockups, each one HTML file you can open in a browser: `astro-app-mockup.html` (the app)
and `natal-report-mockup.html` (the natal reading, its options and the logo setting).
