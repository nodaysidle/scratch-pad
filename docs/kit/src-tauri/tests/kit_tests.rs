use scratch_pad_lib as backend;

use serde_json::{json, Value};
use tauri::ipc::{CallbackFn, InvokeBody};
use tauri::test::{get_ipc_response, mock_builder, MockRuntime, INVOKE_KEY};
use tauri::webview::InvokeRequest;
use tauri::{WebviewWindow, WebviewWindowBuilder};

fn invoke(webview: &WebviewWindow<MockRuntime>, cmd: &str, body: Value) -> Result<Value, Value> {
    get_ipc_response(
        webview,
        InvokeRequest {
            cmd: cmd.into(),
            callback: CallbackFn(0),
            error: CallbackFn(1),
            // Debug builds serve the frontend from devUrl; any other origin is remote and refused.
            url: "http://localhost:1420".parse().unwrap(),
            body: InvokeBody::Json(body),
            headers: Default::default(),
            invoke_key: INVOKE_KEY.to_string(),
        },
    )
    .map(|response| response.deserialize::<Value>().unwrap())
}

/// The real builder, context, and capabilities, with the stores in a temporary folder.
#[test]
fn every_command_is_registered_and_allowed() {
    let app = backend::app_builder(mock_builder()).build(backend::context()).expect("app builds");
    let folder = tempfile::tempdir().unwrap();
    backend::manage_state(&app, folder.path()).unwrap();
    let builder = WebviewWindowBuilder::new(&app, "main", Default::default());
    let webview = builder.build().expect("webview");
    // The data task appends the first migration, so compare with the list instead of a fixed number.
    let migrations = backend::database::MIGRATIONS.len();
    assert_eq!(invoke(&webview, "schema_version", json!({})).unwrap(), json!(migrations));
    assert!(invoke(&webview, "no_such_command", json!({})).is_err());
}

#[test]
fn migrations_apply_in_order_and_record_the_schema_version() {
    use backend::database::{migrate, user_version};
    let mut connection = rusqlite::Connection::open_in_memory().unwrap();
    let create = "CREATE TABLE sample (id INTEGER PRIMARY KEY)";
    let alter = "ALTER TABLE sample ADD COLUMN name TEXT";
    migrate(&mut connection, &[create]).unwrap();
    assert_eq!(user_version(&connection).unwrap(), 1);
    migrate(&mut connection, &[create, alter]).unwrap();
    assert_eq!(user_version(&connection).unwrap(), 2);
    migrate(&mut connection, &[create, alter]).unwrap();
    assert_eq!(user_version(&connection).unwrap(), 2, "applied migrations never run twice");
}

#[test]
fn open_creates_a_missing_data_folder() {
    let parent = tempfile::tempdir().unwrap();
    let folder = parent.path().join("fresh").join("install");
    let connection = backend::database::open(&folder).unwrap();
    assert_eq!(
        backend::database::user_version(&connection).unwrap(),
        backend::database::MIGRATIONS.len()
    );
    assert!(folder.join("records.sqlite3").is_file());
}
