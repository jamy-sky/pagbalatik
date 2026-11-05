//! Pagbalatik's Tauri side: the files the page can't reach on its own, and the two report formats.
//! The page talks to it through src/renderer/bridge.js (window.app).
use std::fs;
use std::path::{Path, PathBuf};

use base64::Engine;
use serde_json::Value;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use tauri_plugin_dialog::DialogExt;

mod docx;
mod pdf;

// ---------- the profile: %APPDATA%\pagbalatik ----------
// Development builds can be pointed at a throwaway profile with PAGBALATIK_USER_DATA.
fn profile(app: &AppHandle) -> Result<PathBuf, String> {
    if cfg!(debug_assertions) {
        if let Some(dir) = std::env::var_os("PAGBALATIK_USER_DATA") {
            return Ok(PathBuf::from(dir));
        }
    }
    app.path().data_dir().map(|d| d.join("pagbalatik")).map_err(|e| e.to_string())
}

fn data_file(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(profile(app)?.join("pagbalatik-data.json"))
}

fn write_atomic(file: &Path, bytes: &[u8]) -> Result<(), String> {
    if let Some(dir) = file.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let tmp = file.with_extension("tmp");
    fs::write(&tmp, bytes).map_err(|e| e.to_string())?;
    fs::rename(&tmp, file).map_err(|e| e.to_string())
}

fn read_json(file: &Path) -> Option<Value> {
    serde_json::from_str(&fs::read_to_string(file).ok()?).ok()
}

#[tauri::command]
async fn store_load(app: AppHandle) -> Value {
    data_file(&app).ok().and_then(|f| read_json(&f)).unwrap_or(Value::Null)
}

#[tauri::command]
async fn store_save(app: AppHandle, data: Value) -> Result<bool, String> {
    let text = serde_json::to_string_pretty(&data).map_err(|e| e.to_string())?;
    write_atomic(&data_file(&app)?, text.as_bytes())?;
    Ok(true)
}

#[tauri::command]
fn store_path(app: AppHandle) -> Result<String, String> {
    Ok(data_file(&app)?.display().to_string())
}

// ---------- the report logo ----------
// One file, branding\logo.<ext>, handed to the page as a data URL so it can go straight into the report.
const LOGO_TYPES: [&str; 4] = ["png", "jpg", "jpeg", "svg"];

fn branding(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(profile(app)?.join("branding"))
}

fn mime(ext: &str) -> &'static str {
    match ext {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "svg" => "image/svg+xml",
        _ => "application/octet-stream",
    }
}

fn logo_file(app: &AppHandle) -> Option<PathBuf> {
    let dir = branding(app).ok()?;
    LOGO_TYPES.iter().map(|e| dir.join(format!("logo.{e}"))).find(|p| p.exists())
}

fn data_url(path: &Path) -> Option<String> {
    let ext = path.extension()?.to_str()?.to_lowercase();
    let bytes = fs::read(path).ok()?;
    Some(format!("data:{};base64,{}", mime(&ext), base64::engine::general_purpose::STANDARD.encode(bytes)))
}

#[tauri::command]
async fn logo_get(app: AppHandle) -> Option<String> {
    data_url(&logo_file(&app)?)
}

#[tauri::command]
async fn logo_pick(app: AppHandle) -> Result<Option<String>, String> {
    let mut dialog = app.dialog().file().set_title("Choose a logo for your reports").add_filter("Images", &LOGO_TYPES);
    if let Some(win) = app.get_webview_window("main") {
        dialog = dialog.set_parent(&win);
    }
    let Some(src) = dialog.blocking_pick_file().and_then(|p| p.into_path().ok()) else { return Ok(None) };
    let ext = src.extension().and_then(|e| e.to_str()).map(|e| e.to_lowercase().replace("jpeg", "jpg")).unwrap_or_default();
    if !LOGO_TYPES.contains(&ext.as_str()) {
        return Err("The logo must be a PNG, JPG or SVG file.".into());
    }
    let dir = branding(&app)?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    if let Some(old) = logo_file(&app) {
        let _ = fs::remove_file(old);
    }
    let dest = dir.join(format!("logo.{ext}"));
    fs::copy(&src, &dest).map_err(|e| e.to_string())?;
    Ok(data_url(&dest))
}

#[tauri::command]
async fn logo_clear(app: AppHandle) -> bool {
    logo_file(&app).map(|f| fs::remove_file(f).is_ok()).unwrap_or(true)
}

// ---------- FEMT's birth chart ----------
// FEMT PC keeps the birth moment of its Chart (Transits) in %APPDATA%\femt-pc\femt-pc-data.json.
#[tauri::command]
async fn femt_birth(app: AppHandle) -> Value {
    let Ok(dir) = app.path().data_dir() else { return Value::Null };
    read_json(&dir.join("femt-pc").join("femt-pc-data.json"))
        .and_then(|v| v.pointer("/settings/chart/birth").cloned())
        .unwrap_or(Value::Null)
}

// ---------- files the person chooses ----------
fn save_dialog(app: &AppHandle, title: &str, name: &str, filter: (&str, &[&str])) -> Option<PathBuf> {
    let mut dialog = app.dialog().file().set_title(title).set_file_name(name).add_filter(filter.0, filter.1);
    if let Some(docs) = app.path().document_dir().ok() {
        dialog = dialog.set_directory(docs);
    }
    if let Some(win) = app.get_webview_window("main") {
        dialog = dialog.set_parent(&win);
    }
    dialog.blocking_save_file().and_then(|p| p.into_path().ok())
}

/// Asks where to save a report. Returns the chosen path, or null if the person cancelled.
#[tauri::command]
async fn report_path(app: AppHandle, kind: String, name: String) -> Option<String> {
    let (label, ext): (&str, &[&str]) = if kind == "docx" { ("Word document", &["docx"]) } else { ("PDF", &["pdf"]) };
    let file = format!("{}.{}", sanitize(&name), ext[0]);
    save_dialog(&app, "Save the report", &file, (label, ext)).map(|p| p.display().to_string())
}

fn sanitize(name: &str) -> String {
    let s: String = name.chars().map(|c| if r#"\/:*?"<>|"#.contains(c) { '-' } else { c }).collect();
    s.trim().trim_end_matches('.').to_string()
}

#[tauri::command]
async fn export_text(app: AppHandle, name: String, text: String) -> Result<Option<String>, String> {
    let Some(path) = save_dialog(&app, "Export charts", &name, ("Pagbalatik charts", &["json"])) else { return Ok(None) };
    write_atomic(&path, text.as_bytes())?;
    Ok(Some(path.display().to_string()))
}

#[tauri::command]
async fn import_text(app: AppHandle) -> Result<Option<String>, String> {
    let mut dialog = app.dialog().file().set_title("Import charts").add_filter("Pagbalatik charts", &["json"]);
    if let Some(win) = app.get_webview_window("main") {
        dialog = dialog.set_parent(&win);
    }
    let Some(path) = dialog.blocking_pick_file().and_then(|p| p.into_path().ok()) else { return Ok(None) };
    fs::read_to_string(path).map(Some).map_err(|e| e.to_string())
}

#[tauri::command]
fn open_path(path: String) {
    let _ = tauri_plugin_opener::open_path(path, None::<&str>);
}

#[tauri::command]
fn open_url(url: String) {
    if url.starts_with("https://") || url.starts_with("http://") {
        let _ = tauri_plugin_opener::open_url(url, None::<&str>);
    }
}

// ---------- the reports ----------
/// Prints the page's print view (the report pages, see styles.css @media print) to a PDF.
#[tauri::command]
async fn export_pdf(window: WebviewWindow, path: String, width: f64, height: f64) -> Result<String, String> {
    pdf::print(&window, &path, width, height).await?;
    Ok(path)
}

/// Builds a Word document from the report model the page sends (see src/renderer/docx-model.js).
#[tauri::command]
async fn export_docx(path: String, model: Value) -> Result<String, String> {
    let bytes = docx::build(&model)?;
    write_atomic(Path::new(&path), &bytes)?;
    Ok(path)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.unminimize();
                let _ = win.set_focus();
            }
        }));
    }
    builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            store_load,
            store_save,
            store_path,
            logo_get,
            logo_pick,
            logo_clear,
            femt_birth,
            report_path,
            export_text,
            import_text,
            open_path,
            open_url,
            export_pdf,
            export_docx,
        ])
        .setup(|app| {
            WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("Pagbalatik")
                .inner_size(1360.0, 880.0)
                .min_inner_size(980.0, 640.0)
                // The page draws the title bar and the window buttons, as FEMT does.
                .decorations(false)
                .background_color(tauri::window::Color(5, 7, 15, 255))
                .on_navigation(|url| {
                    let local = url.scheme() == "tauri" || url.host_str() == Some("tauri.localhost");
                    if !local && matches!(url.scheme(), "http" | "https") {
                        let _ = tauri_plugin_opener::open_url(url.as_str(), None::<&str>);
                    }
                    local
                })
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Pagbalatik could not start");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn file_names_are_cleaned() {
        assert_eq!(sanitize("Natal reading: Maria / Santos?"), "Natal reading- Maria - Santos-");
        assert_eq!(sanitize(" Report. "), "Report");
    }
}
