//! DOCX reports. The page walks its own report pages into a small model (src/renderer/docx-model.js) and this
//! turns it into real Word headings, paragraphs and tables, so the document can be edited, not just looked at.
//! The chart wheel arrives as SVG and is drawn to a PNG with resvg.
//!
//! Model: { page: {w_mm, h_mm}, accent: "8E2A1C", header: {logo?, logo_h_pt, text}?, footer: "text"?, blocks: [...] }
//! Blocks: {t:"h", level:1..3, runs}, {t:"p", runs, style?, align?}, {t:"bullet", runs},
//!         {t:"table", rows:[[{runs, shade?, w?}]], head?}, {t:"img", src (data URL), w_pt, h_pt, align?},
//!         {t:"svg", svg, w_pt, h_pt, align?}, {t:"break"}
//! Runs:   {text, b?, i?, sym?, color?, size?}
use std::io::Cursor;

use base64::Engine;
use docx_rs::*;
use serde_json::Value;

const SYMBOL_FONT: &str = "Segoe UI Symbol";
const TEXT_FONT: &str = "Palatino Linotype";
const UI_FONT: &str = "Segoe UI";
const EMU_PER_PT: f64 = 12700.0;
const TWIP_PER_MM: f64 = 56.6929;

fn s<'a>(v: &'a Value, k: &str) -> &'a str {
    v.get(k).and_then(Value::as_str).unwrap_or("")
}
fn f(v: &Value, k: &str, d: f64) -> f64 {
    v.get(k).and_then(Value::as_f64).unwrap_or(d)
}
fn b(v: &Value, k: &str) -> bool {
    v.get(k).and_then(Value::as_bool).unwrap_or(false)
}
fn arr<'a>(v: &'a Value, k: &str) -> &'a [Value] {
    v.get(k).and_then(Value::as_array).map(Vec::as_slice).unwrap_or(&[])
}
fn fonts(name: &str) -> RunFonts {
    RunFonts::new().ascii(name).hi_ansi(name).east_asia(name).cs(name)
}
fn hex(c: &str) -> String {
    c.trim_start_matches('#').to_uppercase()
}

fn run(r: &Value, base_pt: f64, base_font: &str) -> Run {
    let mut run = Run::new().add_text(s(r, "text"));
    run = run.size((f(r, "size", base_pt) * 2.0).round() as usize);
    run = run.fonts(fonts(if b(r, "sym") { SYMBOL_FONT } else { base_font }));
    if b(r, "b") {
        run = run.bold();
    }
    if b(r, "i") {
        run = run.italic();
    }
    if !s(r, "color").is_empty() {
        run = run.color(hex(s(r, "color")));
    }
    run
}

fn para(runs: &[Value], base_pt: f64, base_font: &str) -> Paragraph {
    runs.iter().fold(Paragraph::new(), |p, r| p.add_run(run(r, base_pt, base_font)))
}

fn align(p: Paragraph, a: &str) -> Paragraph {
    match a {
        "center" => p.align(AlignmentType::Center),
        "right" => p.align(AlignmentType::Right),
        "justify" => p.align(AlignmentType::Both),
        _ => p,
    }
}

fn spacing(before_pt: f64, after_pt: f64) -> LineSpacing {
    LineSpacing::new().before((before_pt * 20.0) as u32).after((after_pt * 20.0) as u32)
}

/// Decodes a data URL to bytes; SVG is drawn to PNG first. Returns PNG/JPEG bytes.
fn image_bytes(src: &str, w_pt: f64, h_pt: f64) -> Result<Vec<u8>, String> {
    let (head, data) = src.split_once(',').ok_or("bad image data")?;
    let raw = if head.ends_with(";base64") {
        base64::engine::general_purpose::STANDARD.decode(data).map_err(|e| e.to_string())?
    } else {
        percent_decode(data).into_bytes()
    };
    if head.contains("image/svg") {
        svg_png(std::str::from_utf8(&raw).map_err(|e| e.to_string())?, w_pt, h_pt)
    } else {
        Ok(raw)
    }
}

fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(v) = u8::from_str_radix(&s[i + 1..i + 3], 16) {
                out.push(v);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// Draws an SVG at three times its printed size (about 216 dpi), so the wheel stays sharp in Word.
pub fn svg_png(svg: &str, w_pt: f64, h_pt: f64) -> Result<Vec<u8>, String> {
    let mut opt = resvg::usvg::Options::default();
    opt.font_family = UI_FONT.into();
    opt.fontdb_mut().load_system_fonts();
    let tree = resvg::usvg::Tree::from_str(svg, &opt).map_err(|e| format!("Could not read the chart drawing: {e}"))?;
    let (w, h) = ((w_pt * 3.0).round().max(1.0) as u32, (h_pt * 3.0).round().max(1.0) as u32);
    let mut pixmap = resvg::tiny_skia::Pixmap::new(w, h).ok_or("image too large")?;
    let size = tree.size();
    let t = resvg::tiny_skia::Transform::from_scale(w as f32 / size.width(), h as f32 / size.height());
    resvg::render(&tree, t, &mut pixmap.as_mut());
    pixmap.encode_png().map_err(|e| e.to_string())
}

fn picture(bytes: &[u8], w_pt: f64, h_pt: f64) -> Pic {
    Pic::new(bytes).size((w_pt * EMU_PER_PT) as u32, (h_pt * EMU_PER_PT) as u32)
}

fn table(t: &Value, content_twips: f64, accent: &str) -> Table {
    let rows = arr(t, "rows");
    let ncols = rows.iter().map(|r| r.as_array().map_or(0, Vec::len)).max().unwrap_or(1).max(1);
    // Column widths: given as fractions on the first row's cells, or equal.
    let first = rows.first().and_then(Value::as_array);
    let fracs: Vec<f64> = (0..ncols)
        .map(|i| first.and_then(|r| r.get(i)).map(|c| f(c, "w", 0.0)).unwrap_or(0.0))
        .collect();
    let total: f64 = fracs.iter().sum();
    let widths: Vec<usize> = fracs
        .iter()
        .map(|w| if total > 0.0 { (content_twips * w / total) as usize } else { (content_twips / ncols as f64) as usize })
        .collect();
    let head = b(t, "head");
    let mut out = Vec::new();
    for (ri, r) in rows.iter().enumerate() {
        let cells = r.as_array().map(Vec::as_slice).unwrap_or(&[]);
        let mut row_cells = Vec::new();
        for ci in 0..ncols {
            let c = cells.get(ci).cloned().unwrap_or(Value::Null);
            let is_head = head && ri == 0;
            let runs: Vec<Value> = arr(&c, "runs")
                .iter()
                .map(|r| {
                    let mut r = r.clone();
                    if is_head {
                        r["b"] = Value::Bool(true);
                        r["color"] = Value::String(accent.into());
                    }
                    r
                })
                .collect();
            let p = align(para(&runs, if is_head { 7.5 } else { 9.0 }, UI_FONT), s(&c, "align")).line_spacing(spacing(1.0, 1.0));
            let mut cell = TableCell::new().add_paragraph(p).width(widths[ci], WidthType::Dxa);
            let shade = s(&c, "shade");
            if !shade.is_empty() {
                cell = cell.shading(Shading::new().fill(hex(shade)));
            }
            row_cells.push(cell);
        }
        out.push(TableRow::new(row_cells));
    }
    // Light rules between rows, as on the page, instead of Word's full grid; a little room inside each cell.
    let rule = |pos| TableBorder::new(pos).size(4).color("D9CFBA");
    let borders = TableBorders::with_empty()
        .set(rule(TableBorderPosition::Top))
        .set(rule(TableBorderPosition::Bottom))
        .set(rule(TableBorderPosition::InsideH));
    Table::new(out)
        .set_grid(widths)
        .width(content_twips as usize, WidthType::Dxa)
        .set_borders(borders)
        .margins(TableCellMargins::new().margin(20, 70, 20, 70))
}

pub fn build(model: &Value) -> Result<Vec<u8>, String> {
    let page = model.get("page").cloned().unwrap_or(Value::Null);
    let (w_mm, h_mm) = (f(&page, "w_mm", 210.0), f(&page, "h_mm", 297.0));
    let margin_mm = 16.0;
    let content_twips = (w_mm - 2.0 * margin_mm) * TWIP_PER_MM;
    let accent = { let a = s(model, "accent"); if a.is_empty() { "8E2A1C".to_string() } else { hex(a) } };

    let heading = |id: &str, name: &str, pt: usize, color: &str| {
        Style::new(id, StyleType::Paragraph).name(name).size(pt * 2).bold().color(color)
    };
    let mut doc = Docx::new()
        .page_size((w_mm * TWIP_PER_MM) as u32, (h_mm * TWIP_PER_MM) as u32)
        .page_margin(
            PageMargin::new()
                .top((margin_mm * TWIP_PER_MM) as i32)
                .bottom((margin_mm * TWIP_PER_MM) as i32)
                .left((margin_mm * TWIP_PER_MM) as i32)
                .right((margin_mm * TWIP_PER_MM) as i32)
                .header((7.0 * TWIP_PER_MM) as i32)
                .footer((7.0 * TWIP_PER_MM) as i32),
        )
        .add_style(heading("Heading1", "Heading 1", 17, &accent))
        .add_style(heading("Heading2", "Heading 2", 9, &accent))
        .add_style(heading("Heading3", "Heading 3", 12, "1D1A14"));

    // The header carries the logo in the upper left, and the person's name.
    if let Some(h) = model.get("header").filter(|h| !h.is_null()) {
        let mut p = Paragraph::new();
        let logo = s(h, "logo");
        if !logo.is_empty() {
            let hpt = f(h, "logo_h_pt", 26.0);
            let wpt = f(h, "logo_w_pt", hpt);
            if let Ok(bytes) = image_bytes(logo, wpt, hpt) {
                p = p.add_run(Run::new().add_image(picture(&bytes, wpt, hpt))).add_run(Run::new().add_text("   "));
            }
        }
        p = p.add_run(Run::new().add_text(s(h, "text")).size(16).color("4A4234").fonts(fonts(UI_FONT)));
        doc = doc.header(Header::new().add_paragraph(p));
        // The cover has the logo large already: no header on the first page.
        if b(model, "cover") {
            doc = doc.first_header(Header::new());
        }
    }
    let foot = s(model, "footer");
    if !foot.is_empty() {
        doc = doc.footer(Footer::new().add_paragraph(
            Paragraph::new().add_run(Run::new().add_text(foot).size(15).color("8A7D62").fonts(fonts(UI_FONT))),
        ));
    }

    for blk in arr(model, "blocks") {
        match s(blk, "t") {
            "h" => {
                let level = f(blk, "level", 2.0) as u8;
                let (style, pt, before, after) = match level {
                    1 => ("Heading1", 17.0, 0.0, 6.0),
                    3 => ("Heading3", 12.0, 8.0, 2.0),
                    _ => ("Heading2", 9.0, 10.0, 3.0),
                };
                let runs: Vec<Value> = arr(blk, "runs").to_vec();
                let mut p = para(&runs, pt, TEXT_FONT).style(style).line_spacing(spacing(before, after));
                if level == 2 {
                    p = runs.iter().fold(Paragraph::new(), |p, r| {
                        let mut r = r.clone();
                        r["text"] = Value::String(s(&r, "text").to_uppercase());
                        p.add_run(run(&r, 8.5, UI_FONT).bold().color(accent.clone()))
                    }).style(style).line_spacing(spacing(before, after));
                }
                doc = doc.add_paragraph(p);
            }
            "p" => {
                let (pt, font, color, after) = match s(blk, "style") {
                    "small" => (8.5, UI_FONT, Some("4A4234"), 3.0),
                    "src" => (8.0, UI_FONT, Some("8A7D62"), 4.0),
                    "kicker" => (9.0, UI_FONT, Some("8A7D62"), 4.0),
                    "title" => (30.0, TEXT_FONT, Some(accent.as_str()), 4.0),
                    _ => (10.5, TEXT_FONT, None, 5.0),
                };
                let runs: Vec<Value> = arr(blk, "runs")
                    .iter()
                    .map(|r| {
                        let mut r = r.clone();
                        if let Some(c) = color {
                            if r.get("color").is_none() {
                                r["color"] = Value::String(c.into());
                            }
                        }
                        if s(blk, "style") == "src" {
                            r["i"] = Value::Bool(true);
                        }
                        r
                    })
                    .collect();
                let p = align(para(&runs, pt, font), s(blk, "align")).line_spacing(spacing(0.0, after));
                doc = doc.add_paragraph(p);
            }
            "bullet" => {
                let mut runs = vec![serde_json::json!({ "text": "•  " })];
                runs.extend(arr(blk, "runs").iter().cloned());
                doc = doc.add_paragraph(para(&runs, 9.0, UI_FONT).indent(Some(280), Some(SpecialIndentType::Hanging(200)), None, None).line_spacing(spacing(0.0, 1.5)));
            }
            "table" => {
                doc = doc.add_table(table(blk, content_twips, &accent));
                doc = doc.add_paragraph(Paragraph::new().line_spacing(spacing(0.0, 2.0)));
            }
            "img" | "svg" => {
                let (w, h) = (f(blk, "w_pt", 100.0), f(blk, "h_pt", 100.0));
                let bytes = if s(blk, "t") == "svg" { svg_png(s(blk, "svg"), w, h)? } else { image_bytes(s(blk, "src"), w, h)? };
                let p = align(Paragraph::new().add_run(Run::new().add_image(picture(&bytes, w, h))), s(blk, "align"));
                doc = doc.add_paragraph(p);
            }
            "break" => {
                doc = doc.add_paragraph(Paragraph::new().add_run(Run::new().add_break(BreakType::Page)));
            }
            _ => {}
        }
    }

    let mut buf = Cursor::new(Vec::new());
    doc.build().pack(&mut buf).map_err(|e| e.to_string())?;
    Ok(buf.into_inner())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn builds_a_document() {
        let svg = r##"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="none" stroke="#8E2A1C" stroke-width="4"/></svg>"##;
        let model = json!({
            "page": { "w_mm": 210, "h_mm": 297 },
            "header": { "text": "Sample · Natal reading" },
            "footer": "Pagbalatik",
            "blocks": [
                { "t": "h", "level": 1, "runs": [{ "text": "The nativity" }] },
                { "t": "p", "runs": [{ "text": "Sun in " }, { "text": "♊", "sym": true }, { "text": " Gemini", "b": true }] },
                { "t": "table", "head": true, "rows": [[{ "runs": [{ "text": "Planet" }], "w": 2 }, { "runs": [{ "text": "Score" }], "w": 1 }], [{ "runs": [{ "text": "Mars" }] }, { "runs": [{ "text": "+23" }], "shade": "f3ecdd" }]] },
                { "t": "svg", "svg": svg, "w_pt": 120, "h_pt": 120, "align": "center" },
                { "t": "break" },
                { "t": "bullet", "runs": [{ "text": "A reason." }] }
            ]
        });
        let bytes = build(&model).expect("docx");
        assert!(bytes.len() > 2000);
        assert_eq!(&bytes[0..2], b"PK");
    }
}
