use std::path::{Path, PathBuf};

fn collect_files(dir: &Path, out: &mut Vec<PathBuf>) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    let mut paths: Vec<PathBuf> = entries.flatten().map(|entry| entry.path()).collect();
    paths.sort();
    for path in paths {
        if path.is_dir() {
            collect_files(&path, out);
        } else if path.is_file() {
            out.push(path);
        }
    }
}

fn extract_fn_name(line: &str) -> Option<String> {
    let after_fn = line.strip_prefix("fn ").or_else(|| line.split(" fn ").nth(1))?;
    let name = after_fn
        .trim_start()
        .split(|c: char| c == '(' || c == '<' || c.is_whitespace())
        .next()?
        .trim();
    (!name.is_empty()).then(|| name.to_string())
}

/// The text between the `(` after `fn name` and its matching `)`, which may span several lines.
fn parameter_list(from_line: &str, name: &str) -> String {
    let after_name = from_line.find(&format!("fn {name}")).map_or("", |at| &from_line[at..]);
    let Some((_, params)) = after_name.split_once('(') else {
        return String::new();
    };
    let mut depth = 1;
    for (at, c) in params.char_indices() {
        match c {
            '(' => depth += 1,
            ')' => depth -= 1,
            _ => {}
        }
        if depth == 0 {
            return params[..at].to_string();
        }
    }
    params.to_string()
}

/// Returns each Tauri command's name with the text of its parameter list.
pub fn tauri_command_signatures(source: &str) -> Vec<(String, String)> {
    let mut commands = Vec::new();
    let mut pending_command = false;
    let mut offset = 0;
    for raw_line in source.split_inclusive('\n') {
        let line_start = offset;
        offset += raw_line.len();
        let line = raw_line.trim();
        if line.starts_with("//") {
            continue;
        }
        if let Some(rest) = line.strip_prefix("#[tauri::command") {
            pending_command = true;
            if let Some((_, after_attr)) = rest.split_once(']') {
                let after_attr = after_attr.trim();
                if !after_attr.is_empty() {
                    if let Some(name) = extract_fn_name(after_attr) {
                        let params = parameter_list(&source[line_start..], &name);
                        commands.push((name, params));
                        pending_command = false;
                    }
                }
            }
            continue;
        }
        if pending_command {
            if line.starts_with('#') || line.is_empty() {
                continue;
            }
            if let Some(name) = extract_fn_name(line) {
                let params = parameter_list(&source[line_start..], &name);
                commands.push((name, params));
            }
            pending_command = false;
        }
    }
    commands
}

/// True when a parameter list has a parameter that carries a filesystem path: a type that mentions
/// `Path` (so `PathBuf` and `&Path` too), or a name that is `path` or ends in `_path`.
fn takes_a_path(params: &str) -> bool {
    let mut parts = Vec::new();
    let (mut depth, mut start) = (0, 0);
    for (at, c) in params.char_indices() {
        match c {
            '<' | '(' | '[' => depth += 1,
            '>' | ')' | ']' => depth -= 1,
            ',' if depth == 0 => {
                parts.push(&params[start..at]);
                start = at + 1;
            }
            _ => {}
        }
    }
    parts.push(&params[start..]);
    parts.iter().any(|part| {
        let Some((name, ty)) = part.split_once(':') else {
            return false;
        };
        let name = name.trim();
        ty.contains("Path") || name == "path" || name.ends_with("_path")
    })
}

fn is_same_file(a: &Path, b: &Path) -> bool {
    if a == b {
        return true;
    }
    match (std::fs::canonicalize(a), std::fs::canonicalize(b)) {
        (Ok(ca), Ok(cb)) => ca == cb,
        _ => false,
    }
}

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

    // 1. Verify #[tauri::command] registration dynamically across all src/**/*.rs files
    let lib_code: String = lib_rs
        .lines()
        .filter(|line| !line.trim_start().starts_with("//"))
        .collect::<Vec<_>>()
        .join("\n");
    let handler_block = lib_code
        .split_once("generate_handler![")
        .and_then(|(_, rest)| rest.split_once(']'))
        .map(|(inside, _)| inside);
    if handler_block.is_none() {
        violations.push("generate_handler![...] is missing from lib.rs".into());
    }
    let registered: Vec<String> = handler_block
        .unwrap_or("")
        .split(',')
        .map(|item| {
            let item = item.trim();
            item.rsplit("::").next().unwrap_or(item).trim().to_string()
        })
        .filter(|name| !name.is_empty())
        .collect();

    let mut rust_files = Vec::new();
    collect_files(&manifest_dir.join("src"), &mut rust_files);
    for path in rust_files {
        if path.extension().and_then(|ext| ext.to_str()) != Some("rs") {
            continue;
        }
        let source = std::fs::read_to_string(&path).unwrap_or_default();
        for (cmd, params) in tauri_command_signatures(&source) {
            if !registered.iter().any(|name| name == &cmd) {
                violations
                    .push(format!("Command '{cmd}' is missing from lib.rs generate_handler!"));
            }
            if takes_a_path(&params) {
                violations.push(format!("Command '{cmd}' takes a path from the webview"));
            }
        }
    }

    // 2. Verify tauri-plugin initialization
    for line in cargo_toml.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("tauri-plugin-") {
            if let Some(crate_name) = trimmed.split('=').next() {
                let plugin_name = crate_name.trim().replace('-', "_");
                let init_call = format!("{plugin_name}::init(");
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

    // 4. Verify no test doubles in production files (recursive walk, skipping packaging.rs itself)
    let root = manifest_dir.parent().unwrap_or(manifest_dir);
    let packaging_rs_path = manifest_dir.join("src/platform/packaging.rs");
    let prod_dirs = [root.join("src"), manifest_dir.join("src")];
    for dir in prod_dirs {
        let mut files = Vec::new();
        collect_files(&dir, &mut files);
        for path in files {
            if is_same_file(&path, &packaging_rs_path) {
                continue;
            }
            let content = std::fs::read_to_string(&path).unwrap_or_default();
            if content.contains("mock_builder") || content.contains("MockRuntime") {
                violations
                    .push(format!("Test double found in production file: {}", path.display()));
            }
        }
    }

    violations
}
