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

#[cfg(unix)]
#[test]
fn instance_listener_focuses_existing_and_cleans_stale_socket() {
    use std::os::unix::fs::PermissionsExt;
    use std::os::unix::net::UnixListener;
    use std::sync::mpsc;
    use std::time::Duration;

    use scratch_pad_lib::platform::lifecyclecoordinator::{
        start_instance_listener, try_focus_existing,
    };

    let dir = tempfile::tempdir().unwrap();
    let sock = dir.path().join("instance.sock");

    // No socket yet: returns false.
    assert!(!try_focus_existing(dir.path()));

    // Create a stale socket (bind and drop listener without removing socket file).
    {
        let _stale = UnixListener::bind(&sock).unwrap();
    }
    assert!(sock.exists());
    assert!(!try_focus_existing(dir.path()));
    assert!(!sock.exists(), "stale socket should be removed when connection is refused");

    // Start active listener and verify focus delivery + permissions + cleanup on exit().
    let (tx, rx) = mpsc::channel();
    start_instance_listener(dir.path(), move || {
        let _ = tx.send(());
    })
    .unwrap();

    assert!(sock.exists());
    let mode = std::fs::metadata(&sock).unwrap().permissions().mode() & 0o777;
    assert_eq!(mode, 0o600);

    assert!(try_focus_existing(dir.path()));
    rx.recv_timeout(Duration::from_secs(2)).expect("on_focus callback should fire");

    exit();
    assert!(!sock.exists(), "exit() should clean up the instance socket");
}
