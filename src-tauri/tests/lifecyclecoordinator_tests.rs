use scratch_pad_lib as backend;
use scratch_pad_lib::error::AppError;
use scratch_pad_lib::platform::lifecyclecoordinator::{exit, launch};

#[test]
fn launch_creates_missing_folder_migrates_idempotently_and_fails_cleanly_on_file_path() {
    let dir = tempfile::tempdir().unwrap();
    let subfolder = dir.path().join("nested").join("app_data");
    assert!(!subfolder.exists());

    launch(&subfolder).unwrap();
    assert!(subfolder.is_dir());
    assert!(subfolder.join("records.sqlite3").is_file());

    let first_version = {
        let conn = backend::database::open(&subfolder).unwrap();
        backend::database::user_version(&conn).unwrap()
    };
    assert_eq!(first_version, backend::database::MIGRATIONS.len());

    launch(&subfolder).unwrap();
    let second_version = {
        let conn = backend::database::open(&subfolder).unwrap();
        backend::database::user_version(&conn).unwrap()
    };
    assert_eq!(second_version, first_version);

    let file_path = dir.path().join("not_a_directory");
    std::fs::write(&file_path, b"lock").unwrap();
    assert!(matches!(launch(&file_path), Err(AppError::Storage(_))));
    assert_eq!(std::fs::read(&file_path).unwrap(), b"lock");
    assert!(!file_path.join("records.sqlite3").exists());

    exit();
}
