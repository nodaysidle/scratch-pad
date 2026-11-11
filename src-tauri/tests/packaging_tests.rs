use std::path::Path;

use scratch_pad_lib as backend;
use scratch_pad_lib::platform::packaging::verify_runtime_wiring;
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
            url: "http://localhost:1420".parse().unwrap(),
            body: InvokeBody::Json(body),
            headers: Default::default(),
            invoke_key: INVOKE_KEY.to_string(),
        },
    )
    .map(|response| response.deserialize::<Value>().unwrap())
}

#[test]
fn runtime_wiring_has_no_violations() {
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    let violations = verify_runtime_wiring(manifest_dir);
    assert!(violations.is_empty(), "runtime wiring violations detected: {:?}", violations);
}

#[test]
fn app_builder_can_invoke_all_data_store_commands() {
    let app = backend::app_builder(mock_builder()).build(backend::context()).expect("app builds");
    let folder = tempfile::tempdir().unwrap();
    backend::manage_state(&app, folder.path()).unwrap();
    let builder = WebviewWindowBuilder::new(&app, "main", Default::default());
    let webview = builder.build().expect("webview");

    let version = invoke(&webview, "schema_version", json!({})).unwrap();
    assert_eq!(version, json!(backend::database::MIGRATIONS.len()));

    let created = invoke(
        &webview,
        "create_note",
        json!({
            "input": {
                "text": "Initial note"
            }
        }),
    )
    .unwrap();
    let id = created["id"].as_i64().expect("created note id");
    assert_eq!(created["text"], "Initial note");

    let list = invoke(&webview, "list_note", json!({})).unwrap();
    assert_eq!(list, json!([{"id": id, "text": "Initial note"}]));

    let fetched = invoke(&webview, "get_note", json!({ "id": id })).unwrap();
    assert_eq!(fetched, created);

    let updated = invoke(
        &webview,
        "update_note",
        json!({
            "id": id,
            "input": {
                "text": "Updated note"
            }
        }),
    )
    .unwrap();
    assert_eq!(updated["text"], "Updated note");

    let temp_file = folder.path().join("plain.txt");
    std::fs::write(&temp_file, b"Plain file content").unwrap();
    let read_back =
        invoke(&webview, "read_text_file", json!({ "path": temp_file.to_string_lossy() })).unwrap();
    assert_eq!(read_back, "Plain file content");

    let export_target = folder.path().join("exported.md");
    let export_result = invoke(
        &webview,
        "write_markdown_export_file",
        json!({
            "path": export_target.to_string_lossy(),
            "content": "# Scratch Pad\n\nUpdated note"
        }),
    );
    assert!(export_result.is_ok());
    assert_eq!(std::fs::read_to_string(&export_target).unwrap(), "# Scratch Pad\n\nUpdated note");
}
