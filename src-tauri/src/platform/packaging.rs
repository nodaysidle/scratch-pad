use std::path::Path;

/// Checks for violations of CON-RUNTIME-WIRING across configuration and source files.
/// Returns a list of error messages for any detected violations.
pub fn verify_runtime_wiring(manifest_dir: &Path) -> Vec<String> {
    let mut violations = Vec::new();

    let lib_rs_path = manifest_dir.join("src/lib.rs");
    let cargo_toml_path = manifest_dir.join("Cargo.toml");
    let tauri_conf_path = manifest_dir.join("tauri.conf.json");
    let cap_path = manifest_dir.join("capabilities/default.json");

    let lib_rs = std::fs::read_to_string(&lib_rs_path).unwrap_or_default();
    let cargo_toml = std::fs::read_to_string(&cargo_toml_path).unwrap_or_default();
    let tauri_conf_str = std::fs::read_to_string(&tauri_conf_path).unwrap_or_default();
    let cap_str = std::fs::read_to_string(&cap_path).unwrap_or_default();

    // 1. Verify #[tauri::command] registration
    let commands = [
        "schema_version",
        "create_note",
        "list_note",
        "get_note",
        "update_note",
        "read_text_file",
        "write_markdown_export_file",
        "theme_palette",
        "terminal_font",
    ];
    for cmd in commands {
        if !lib_rs.contains(cmd) {
            violations.push(format!("Command '{cmd}' is missing from lib.rs generate_handler!"));
        }
    }

    // 2. Verify tauri-plugin initialization
    for line in cargo_toml.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("tauri-plugin-") {
            if let Some(crate_name) = trimmed.split('=').next() {
                let plugin_name = crate_name.trim().replace('-', "_");
                let init_call = format!("{plugin_name}::init()");
                if !lib_rs.contains(&init_call) {
                    violations.push(format!("Plugin '{plugin_name}' is not initialized in lib.rs"));
                }
            }
        }
    }

    // 3. Verify window labels in capabilities/default.json
    let conf_val: serde_json::Value = serde_json::from_str(&tauri_conf_str).unwrap_or_default();
    let cap_val: serde_json::Value = serde_json::from_str(&cap_str).unwrap_or_default();

    let cap_windows = cap_val["windows"]
        .as_array()
        .map(|arr| arr.iter().filter_map(|v| v.as_str()).map(String::from).collect::<Vec<_>>())
        .unwrap_or_default();

    if let Some(windows) = conf_val["app"]["windows"].as_array() {
        for win in windows {
            if let Some(label) = win["label"].as_str() {
                if !cap_windows.contains(&label.to_string()) {
                    violations.push(format!(
                        "Window label '{label}' from tauri.conf.json is missing in capabilities/default.json"
                    ));
                }
            }
        }
    }

    // 4. Verify no test doubles in production files
    let root = manifest_dir.parent().unwrap_or(manifest_dir);
    let prod_dirs = [root.join("src"), manifest_dir.join("src")];
    for dir in prod_dirs {
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() {
                    let content = std::fs::read_to_string(&path).unwrap_or_default();
                    if content.contains("mock_builder") || content.contains("MockRuntime") {
                        violations.push(format!(
                            "Test double found in production file: {}",
                            path.display()
                        ));
                    }
                }
            }
        }
    }

    violations
}
