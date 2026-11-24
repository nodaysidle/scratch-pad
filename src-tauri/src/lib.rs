//! Composition root. `app_builder` registers every plugin and command; `run()` and the packaging
//! test both use it, so a command missing from one is missing from both. `run()` owns the one
//! `setup` closure: `Builder::setup` replaces any earlier one, so a second call silently drops the first.

pub mod database;
pub mod error;

use std::path::PathBuf;
use std::sync::Mutex;

use tauri::{Manager, Runtime, State};

use crate::error::AppError;

/// The stores every command reads through `State<'_, AppState>`.
pub struct AppState {
    pub database: Mutex<Option<rusqlite::Connection>>,
    folder: Option<PathBuf>,
}

impl AppState {
    /// Runs `f` against the active database connection, lazily opening it in degraded mode.
    pub fn with_db<T>(
        &self,
        f: impl FnOnce(&mut rusqlite::Connection) -> Result<T, AppError>,
    ) -> Result<T, AppError> {
        let busy = |_| AppError::Storage("The saved records are busy.".into());
        let mut guard = self.database.lock().map_err(busy)?;
        if guard.is_none() {
            let dir = self.folder.as_deref().ok_or_else(|| {
                AppError::Storage("The saved records could not be opened.".into())
            })?;
            let connection = database::open(dir)?;
            *guard = Some(connection);
        }
        let connection = guard
            .as_mut()
            .ok_or_else(|| AppError::Storage("The saved records could not be opened.".into()))?;
        f(connection)
    }
}

#[tauri::command(async)]
fn schema_version(state: State<'_, AppState>) -> Result<usize, AppError> {
    state.with_db(|conn| database::user_version(conn))
}

/// Opens the stores in `folder` and hands them to Tauri. `run()` passes the app-data folder; tests
/// pass a temporary one (the mock runtime does not run `setup`, and tests must not touch real data).
pub fn manage_state<R: Runtime, M: Manager<R>>(
    manager: &M,
    folder: &std::path::Path,
) -> Result<(), AppError> {
    let unavailable = |_| AppError::Storage("The app-data folder could not be created.".into());
    std::fs::create_dir_all(folder).map_err(unavailable)?;
    let database = Mutex::new(Some(database::open(folder)?));
    manager.manage(AppState { database, folder: Some(folder.to_path_buf()) });
    Ok(())
}

/// Registers an empty database state so the window can still open and show a Retry banner.
pub fn manage_degraded_state<R: Runtime, M: Manager<R>>(manager: &M, folder: &std::path::Path) {
    manager.manage(AppState { database: Mutex::new(None), folder: Some(folder.to_path_buf()) });
}

/// The app's one generated context (config, capabilities, icons). Tests build with it too, so a
/// command the capabilities refuse fails in tests exactly as it would in the app.
pub fn context<R: Runtime>() -> tauri::Context<R> {
    tauri::generate_context!()
}

/// Plugins and commands only; `run()` adds state and the window behavior.
pub fn app_builder<R: Runtime>(builder: tauri::Builder<R>) -> tauri::Builder<R> {
    let builder = builder.plugin(tauri_plugin_dialog::init());
    builder.invoke_handler(tauri::generate_handler![
        schema_version,
        platform::datastore::create_note,
        platform::datastore::list_note,
        platform::datastore::get_note,
        platform::datastore::update_note,
        platform::datastore::open_text_file,
        platform::datastore::save_markdown_file,
        platform::theme::theme_palette,
        platform::font::terminal_font,
    ])
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Registered first, as the plugin requires: a second launch exits and focuses this instance.
    let single_instance = tauri_plugin_single_instance::init(|app, _args, _cwd| {
        platform::lifecyclecoordinator::focus_main_window(app)
    });
    app_builder(tauri::Builder::default().plugin(single_instance))
        .setup(|app| {
            let folder = app.path().app_data_dir()?;
            if let Some((r, g, b)) = platform::theme::active_palette_path()
                .map(|p| platform::theme::read_palette(&p))
                .and_then(|pal| {
                    pal.get("background").and_then(|hex| platform::theme::parse_hex_rgb(hex))
                })
            {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.set_background_color(Some(tauri::window::Color(r, g, b, 255)));
                }
            }
            // The one place the database is opened and migrated.
            if let Err(err) = manage_state(app, &folder) {
                eprintln!("scratch-pad: the note store is unavailable: {err}");
                manage_degraded_state(app, &folder);
            }
            // Without a watcher the colours and font are still read once at startup.
            let _ = platform::omarchy::start(app.handle());
            Ok(())
        })
        .build(context())
        .expect("the app could not start")
        .run(|_app, _event| {});
}

pub mod platform;
