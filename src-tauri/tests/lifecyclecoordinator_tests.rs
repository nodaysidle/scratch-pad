use scratch_pad_lib as backend;
use scratch_pad_lib::error::AppError;
use scratch_pad_lib::platform::lifecyclecoordinator::focus_main_window;
use tauri::test::mock_builder;
use tauri::{Manager, WebviewWindowBuilder};

#[test]
fn manage_state_opens_the_database_once_creating_and_migrating_it() {
    let app = backend::app_builder(mock_builder()).build(backend::context()).expect("app builds");
    let dir = tempfile::tempdir().unwrap();
    let subfolder = dir.path().join("nested").join("app_data");
    assert!(!subfolder.exists());

    backend::manage_state(&app, &subfolder).unwrap();
    assert!(subfolder.join("records.sqlite3").is_file());
    let version =
        app.state::<backend::AppState>().with_db(|conn| backend::database::user_version(conn));
    assert_eq!(version, Ok(backend::database::MIGRATIONS.len()));

    // A path that is a file cannot become the app-data folder: the error is clean and nothing is created.
    let app = backend::app_builder(mock_builder()).build(backend::context()).expect("app builds");
    let file_path = dir.path().join("not_a_directory");
    std::fs::write(&file_path, b"lock").unwrap();
    assert!(matches!(backend::manage_state(&app, &file_path), Err(AppError::Storage(_))));
    assert_eq!(std::fs::read(&file_path).unwrap(), b"lock");
}

#[test]
fn focus_main_window_is_harmless_without_a_window_and_with_one() {
    let app = backend::app_builder(mock_builder()).build(backend::context()).expect("app builds");
    focus_main_window(app.handle());
    WebviewWindowBuilder::new(&app, "main", Default::default()).build().expect("webview");
    focus_main_window(app.handle());
}
