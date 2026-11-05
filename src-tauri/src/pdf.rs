//! PDF reports: WebView2 prints the page to a PDF, using the page's print styles, so the PDF is the preview.
use tauri::WebviewWindow;

#[cfg(windows)]
pub async fn print(window: &WebviewWindow, path: &str, width_in: f64, height_in: f64) -> Result<(), String> {
    use std::sync::mpsc;
    use std::time::Duration;
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        ICoreWebView2Environment6, ICoreWebView2_7, COREWEBVIEW2_PRINT_ORIENTATION_PORTRAIT,
    };
    use webview2_com::PrintToPdfCompletedHandler;
    use windows::core::{Interface, HSTRING};

    let (tx, rx) = mpsc::channel::<Result<(), String>>();
    let file = HSTRING::from(path);
    window
        .with_webview(move |wv| {
            let fail = tx.clone();
            let started = (|| -> windows::core::Result<()> {
                unsafe {
                    let core = wv.controller().CoreWebView2()?;
                    let core7: ICoreWebView2_7 = core.cast()?;
                    let env6: ICoreWebView2Environment6 = wv.environment().cast()?;
                    let settings = env6.CreatePrintSettings()?;
                    settings.SetOrientation(COREWEBVIEW2_PRINT_ORIENTATION_PORTRAIT)?;
                    settings.SetPageWidth(width_in)?;
                    settings.SetPageHeight(height_in)?;
                    settings.SetMarginTop(0.0)?;
                    settings.SetMarginBottom(0.0)?;
                    settings.SetMarginLeft(0.0)?;
                    settings.SetMarginRight(0.0)?;
                    settings.SetShouldPrintBackgrounds(true)?;
                    settings.SetShouldPrintHeaderAndFooter(false)?;
                    let handler = PrintToPdfCompletedHandler::create(Box::new(move |result, ok| {
                        let _ = tx.send(match (result, ok) {
                            (Ok(()), true) => Ok(()),
                            (Ok(()), false) => Err("WebView2 could not write the PDF (is the file open elsewhere?)".into()),
                            (Err(e), _) => Err(e.to_string()),
                        });
                        Ok(())
                    }));
                    core7.PrintToPdf(&file, &settings, &handler)
                }
            })();
            if let Err(e) = started {
                let _ = fail.send(Err(format!("Could not start printing: {e}")));
            }
        })
        .map_err(|e| e.to_string())?;
    tauri::async_runtime::spawn_blocking(move || rx.recv_timeout(Duration::from_secs(120)))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|_| "Printing the PDF took too long.".to_string())?
}

#[cfg(not(windows))]
pub async fn print(_window: &WebviewWindow, _path: &str, _w: f64, _h: f64) -> Result<(), String> {
    Err("PDF export needs WebView2 (Windows).".into())
}
