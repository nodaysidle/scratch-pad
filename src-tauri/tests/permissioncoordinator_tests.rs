use std::path::Path;

use scratch_pad_lib::error::AppError;
use scratch_pad_lib::platform::permissioncoordinator::{existing_file, save_target};

#[test]
fn existing_file_resolves_valid_file_and_rejects_missing_or_directory() {
    let dir = tempfile::tempdir().unwrap();
    let canonical_dir = std::fs::canonicalize(dir.path()).unwrap();

    let file_path = dir.path().join("note.txt");
    std::fs::write(&file_path, b"hello").unwrap();

    let resolved = existing_file(&file_path).unwrap();
    assert_eq!(resolved, canonical_dir.join("note.txt"));

    let missing = dir.path().join("missing.txt");
    assert!(matches!(existing_file(&missing), Err(AppError::Invalid(_))));
    assert!(!missing.exists());

    assert!(matches!(existing_file(dir.path()), Err(AppError::Invalid(_))));
}

#[test]
fn save_target_resolves_parent_and_rejects_missing_or_non_directory_parent_or_directory_target() {
    let dir = tempfile::tempdir().unwrap();
    let canonical_dir = std::fs::canonicalize(dir.path()).unwrap();

    let new_target = dir.path().join("scratch-pad.md");
    let resolved_new = save_target(&new_target).unwrap();
    assert_eq!(resolved_new, canonical_dir.join("scratch-pad.md"));

    std::fs::write(&new_target, b"existing").unwrap();
    let resolved_existing = save_target(&new_target).unwrap();
    assert_eq!(resolved_existing, canonical_dir.join("scratch-pad.md"));

    let missing_parent_target = dir.path().join("missing_parent").join("scratch-pad.md");
    assert!(matches!(save_target(&missing_parent_target), Err(AppError::Invalid(_))));
    assert!(!dir.path().join("missing_parent").exists());

    let file_as_parent = dir.path().join("some_file.txt");
    std::fs::write(&file_as_parent, b"data").unwrap();
    assert!(matches!(save_target(&file_as_parent.join("out.md")), Err(AppError::Invalid(_))));

    let subdir = dir.path().join("subdir");
    std::fs::create_dir(&subdir).unwrap();
    assert!(matches!(save_target(&subdir), Err(AppError::Invalid(_))));

    assert!(matches!(
        save_target(Path::new("relative_without_parent.md")),
        Err(AppError::Invalid(_))
    ));
}
