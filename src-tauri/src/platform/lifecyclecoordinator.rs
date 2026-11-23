use tauri::{AppHandle, Manager, Runtime};

/// Brings the main window to the front. `tauri-plugin-single-instance` calls this in the running
/// instance when the app is launched a second time (the second process exits by itself).
pub fn focus_main_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}
