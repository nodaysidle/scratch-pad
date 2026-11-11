//! Composition root. `app_builder` registers every plugin and command; `run()` and the packaging
//! test both use it, so a command missing from one is missing from both. `run()` owns the one
//! `setup` closure: `Builder::setup` replaces any earlier one, so a second call silently drops the first.

pub mod database;
pub mod error;

use std::sync::Mutex;

use tauri::{Manager, Runtime, State};

use crate::error::AppError;

/// The stores every command reads through `State<'_, AppState>`.
pub struct AppState {
    pub database: Mutex<rusqlite::Connection>,
}

#[tauri::command]
fn schema_version(state: State<'_, AppState>) -> Result<usize, AppError> {
    let busy = |_| AppError::Storage("The saved records are busy.".into());
    let connection = state.database.lock().map_err(busy)?;
    database::user_version(&connection)
}

/// Opens the stores in `folder` and hands them to Tauri. `run()` passes the app-data folder; tests
/// pass a temporary one (the mock runtime does not run `setup`, and tests must not touch real data).
pub fn manage_state<R: Runtime, M: Manager<R>>(
    manager: &M,
    folder: &std::path::Path,
) -> Result<(), AppError> {
    let unavailable = |_| AppError::Storage("The app-data folder could not be created.".into());
    std::fs::create_dir_all(folder).map_err(unavailable)?;
    let database = Mutex::new(database::open(folder)?);
    manager.manage(AppState { database });
    Ok(())
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
        platform::datastore::read_text_file,
        platform::datastore::write_markdown_export_file,
    ])
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    app_builder(tauri::Builder::default())
        .setup(|app| {
            let folder = app.path().app_data_dir()?;
            manage_state(app, &folder)?;
            Ok(())
        })
        .build(context())
        .expect("the app could not start")
        .run(|_app, _event| {});
}

pub mod platform;
