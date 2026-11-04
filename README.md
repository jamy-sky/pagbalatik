# Pagbalatik

A standalone Windows app for natal charts and traditional-astrology reports, spun off from the Chart panel of
[FEMT PC](https://github.com/jamy-sky/femt-pc). Planned as a [Tauri](https://tauri.app/) app, with reports saved on demand as PDF or DOCX.

Nothing is built yet. `mockups/` holds the design mockups, each a single HTML file you can open in a browser:

- `astro-app-mockup.html`: the app (chart, saved charts, report builder, report types, how it would be built).
- `natal-report-mockup.html`: the first report, a natal reading in the traditional manner, with its options and the logo setting.

Both run FEMT's chart engine (`chart-engine.js`, inlined), so the positions are real. The people in them are made up.

## Plan

1. Natal reading (first)
2. Chart sheet
3. Transit forecast
4. Comparison

The natal reading includes **Working with the chart**: FEMT's five actions (magnify, strengthen, neutralize, restrain,
settle) applied to each planet, with timing (elections), way of life (Ficino), correspondences (Agrippa) and plants
(Culpeper). Planned next for that section: the prayer and psalm for each action, from FEMT.
