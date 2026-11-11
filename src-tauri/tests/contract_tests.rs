use std::path::Path;

const FOUNDATION_FILES: &[&str] = &[
    "package.json",
    "src/main.ts",
    "src/style.css",
    "tests/contract.test.ts",
    "src-tauri/Cargo.toml",
    "src-tauri/src/main.rs",
    "src-tauri/src/lib.rs",
    "src-tauri/src/platform/mod.rs",
    "src-tauri/tests/contract_tests.rs",
    "src-tauri/tauri.conf.json",
    "src-tauri/capabilities/default.json",
    "app-icon.svg",
    "README.md",
    "tsconfig.json",
    "vite.config.ts",
    "index.html",
    "src/api.ts",
    "src/errors.ts",
    "src/ui.ts",
    "src/store.ts",
    "tests/store.test.ts",
    "tests/kit.test.ts",
    "tests/ui.test.ts",
    "scripts/package_linux.sh",
    "src-tauri/build.rs",
    "src-tauri/rustfmt.toml",
    "src-tauri/src/error.rs",
    "src-tauri/src/database.rs",
    "src-tauri/tests/kit_tests.rs",
];

#[test]
fn foundation_files_and_identity_match_contract() {
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    let root = manifest_dir.parent().expect("project root");

    for relative in FOUNDATION_FILES {
        let path = root.join(relative);
        assert!(path.is_file(), "missing foundation file: {relative}");
    }

    let tauri_conf = std::fs::read_to_string(manifest_dir.join("tauri.conf.json")).unwrap();
    let conf: serde_json::Value = serde_json::from_str(&tauri_conf).unwrap();
    assert_eq!(conf["identifier"], "com.scratch.pad");
    assert_eq!(conf["productName"], "Scratch Pad");

    let lib_rs = std::fs::read_to_string(manifest_dir.join("src/lib.rs")).unwrap();
    assert!(lib_rs.contains("tauri::Builder"));
}
