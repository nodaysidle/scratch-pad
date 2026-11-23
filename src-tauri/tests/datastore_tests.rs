use std::os::unix::fs::PermissionsExt;

use scratch_pad_lib as backend;
use scratch_pad_lib::error::AppError;
use scratch_pad_lib::platform::datastore::{
    create_note_in_db, get_note_in_db, list_note_in_db, read_text_at, update_note_in_db,
    write_text_at, Note, NoteId, NoteInput, MAX_OPEN_BYTES,
};

fn read_text_file(path: String) -> Result<String, AppError> {
    read_text_at(std::path::Path::new(&path))
}

fn write_markdown_export_file(path: String, content: String) -> Result<(), AppError> {
    write_text_at(std::path::Path::new(&path), &content)
}

#[test]
fn note_crud_whitespace_empty_and_reopen_persistence() {
    let dir = tempfile::tempdir().unwrap();
    let first_id: i64;
    let second_id: i64;

    {
        let mut conn = backend::database::open(dir.path()).unwrap();
        assert_eq!(list_note_in_db(&conn).unwrap(), vec![]);

        let created_empty = create_note_in_db(&mut conn, NoteInput { text: "".into() }).unwrap();
        assert_eq!(get_note_in_db(&conn, created_empty.id).unwrap().text, "");

        let updated =
            update_note_in_db(&mut conn, created_empty.id, NoteInput { text: "   ".into() })
                .unwrap();
        assert_eq!(updated, NoteId { id: created_empty.id });
        first_id = updated.id;
        assert_eq!(get_note_in_db(&conn, first_id).unwrap().text, "   ");

        second_id =
            create_note_in_db(&mut conn, NoteInput { text: "Second\nline".into() }).unwrap().id;
        assert!(second_id > first_id);
        // The list is only the newest note.
        assert_eq!(
            list_note_in_db(&conn).unwrap(),
            vec![Note { id: second_id, text: "Second\nline".into() }]
        );

        assert_eq!(
            get_note_in_db(&conn, 9999),
            Err(AppError::NotFound("The note could not be found.".into()))
        );
        assert_eq!(
            update_note_in_db(&mut conn, 9999, NoteInput { text: "nope".into() }),
            Err(AppError::NotFound("The note could not be found.".into()))
        );
    }

    let reopened = backend::database::open(dir.path()).unwrap();
    assert_eq!(
        list_note_in_db(&reopened).unwrap(),
        vec![Note { id: second_id, text: "Second\nline".into() }]
    );
}

#[test]
fn writes_return_only_the_id() {
    let dir = tempfile::tempdir().unwrap();
    let mut conn = backend::database::open(dir.path()).unwrap();
    let created = create_note_in_db(&mut conn, NoteInput { text: "secret text".into() }).unwrap();
    let json = serde_json::to_value(created).unwrap();
    assert_eq!(json, serde_json::json!({ "id": created.id }));
}

#[test]
fn read_text_file_handles_valid_empty_missing_dir_and_invalid_utf8() {
    let dir = tempfile::tempdir().unwrap();

    let empty_path = dir.path().join("empty.txt");
    std::fs::write(&empty_path, b"").unwrap();
    assert_eq!(read_text_file(empty_path.to_string_lossy().into()).unwrap(), "");

    let utf8_path = dir.path().join("note.txt");
    let raw_text = "  Hello\nWorld  \n";
    std::fs::write(&utf8_path, raw_text.as_bytes()).unwrap();
    assert_eq!(read_text_file(utf8_path.to_string_lossy().into()).unwrap(), raw_text);

    let missing_path = dir.path().join("missing.txt");
    assert!(matches!(
        read_text_file(missing_path.to_string_lossy().into()),
        Err(AppError::Invalid(_))
    ));
    assert!(!missing_path.exists());

    assert!(matches!(
        read_text_file(dir.path().to_string_lossy().into()),
        Err(AppError::Invalid(_))
    ));

    let bad_utf8_path = dir.path().join("bad.bin");
    let bad_bytes: &[u8] = &[0xff, 0xfe, 0xfd];
    std::fs::write(&bad_utf8_path, bad_bytes).unwrap();
    assert!(matches!(
        read_text_file(bad_utf8_path.to_string_lossy().into()),
        Err(AppError::Invalid(_))
    ));
    assert_eq!(std::fs::read(&bad_utf8_path).unwrap(), bad_bytes);
}

#[test]
fn write_markdown_export_file_atomic_and_preserves_existing_on_failure() {
    let dir = tempfile::tempdir().unwrap();

    let missing_parent_target = dir.path().join("no_such_dir").join("scratch-pad.md");
    assert!(matches!(
        write_markdown_export_file(
            missing_parent_target.to_string_lossy().into(),
            "# Scratch Pad\n\nHello".into(),
        ),
        Err(AppError::Invalid(_))
    ));
    assert!(!dir.path().join("no_such_dir").exists());

    let file_as_parent = dir.path().join("plain-file.txt");
    std::fs::write(&file_as_parent, b"original").unwrap();
    let under_file_target = file_as_parent.join("scratch-pad.md");
    assert!(matches!(
        write_markdown_export_file(
            under_file_target.to_string_lossy().into(),
            "# Scratch Pad\n\nHello".into(),
        ),
        Err(AppError::Invalid(_))
    ));
    assert_eq!(std::fs::read(&file_as_parent).unwrap(), b"original");

    let target = dir.path().join("scratch-pad.md");
    write_markdown_export_file(
        target.to_string_lossy().into(),
        "# Scratch Pad\n\nFirst export".into(),
    )
    .unwrap();
    assert_eq!(std::fs::read_to_string(&target).unwrap(), "# Scratch Pad\n\nFirst export");

    let locked_dir = dir.path().join("locked");
    std::fs::create_dir(&locked_dir).unwrap();
    let existing_in_locked = locked_dir.join("scratch-pad.md");
    std::fs::write(&existing_in_locked, b"# Scratch Pad\n\nKeep me").unwrap();
    std::fs::set_permissions(&locked_dir, std::fs::Permissions::from_mode(0o555)).unwrap();

    let result = write_markdown_export_file(
        existing_in_locked.to_string_lossy().into(),
        "# Scratch Pad\n\nOverwrite attempt".into(),
    );
    std::fs::set_permissions(&locked_dir, std::fs::Permissions::from_mode(0o755)).unwrap();

    assert!(matches!(result, Err(AppError::Storage(_))));
    assert_eq!(std::fs::read(&existing_in_locked).unwrap(), b"# Scratch Pad\n\nKeep me");
}

#[test]
fn read_text_file_rejects_oversized_file() {
    let dir = tempfile::tempdir().unwrap();
    let big_path = dir.path().join("too-big.txt");
    let file = std::fs::File::create(&big_path).unwrap();
    file.set_len(MAX_OPEN_BYTES + 1).unwrap();
    drop(file);

    assert!(matches!(read_text_file(big_path.to_string_lossy().into()), Err(AppError::Invalid(_))));
}

#[test]
fn open_enables_wal_journal_mode_and_busy_timeout() {
    let dir = tempfile::tempdir().unwrap();
    let conn = backend::database::open(dir.path()).unwrap();
    let journal_mode: String = conn.query_row("PRAGMA journal_mode", [], |row| row.get(0)).unwrap();
    let busy_timeout: i64 = conn.query_row("PRAGMA busy_timeout", [], |row| row.get(0)).unwrap();
    assert!(journal_mode.eq_ignore_ascii_case("wal"), "expected wal, got {journal_mode}");
    assert_eq!(busy_timeout, 5000);
}

#[test]
fn export_writes_through_a_symlink_and_keeps_the_link() {
    let dir = tempfile::tempdir().unwrap();
    let real = dir.path().join("real.md");
    std::fs::write(&real, b"old").unwrap();
    let link = dir.path().join("link.md");
    std::os::unix::fs::symlink(&real, &link).unwrap();

    write_markdown_export_file(link.to_string_lossy().into(), "new".into()).unwrap();

    assert!(std::fs::symlink_metadata(&link).unwrap().is_symlink(), "the link must survive");
    assert_eq!(std::fs::read_to_string(&real).unwrap(), "new");
    assert_eq!(std::fs::read_to_string(&link).unwrap(), "new");
}

#[test]
fn export_writes_through_a_link_to_another_folder_and_leaves_no_temp_file() {
    let dir = tempfile::tempdir().unwrap();
    let elsewhere = dir.path().join("elsewhere");
    std::fs::create_dir(&elsewhere).unwrap();
    let real = elsewhere.join("real.md");
    std::fs::write(&real, b"old").unwrap();
    let link = dir.path().join("link.md");
    std::os::unix::fs::symlink(&real, &link).unwrap();

    write_markdown_export_file(link.to_string_lossy().into(), "new".into()).unwrap();

    assert_eq!(std::fs::read_to_string(&real).unwrap(), "new");
    for folder in [dir.path(), elsewhere.as_path()] {
        let leftovers: Vec<_> = std::fs::read_dir(folder)
            .unwrap()
            .flatten()
            .filter(|entry| entry.file_name().to_string_lossy().ends_with(".tmp"))
            .collect();
        assert!(leftovers.is_empty(), "temp files left in {folder:?}");
    }
}

#[test]
fn export_refuses_a_dangling_symlink_without_replacing_it() {
    let dir = tempfile::tempdir().unwrap();
    let link = dir.path().join("dangling.md");
    std::os::unix::fs::symlink(dir.path().join("missing.md"), &link).unwrap();

    assert!(matches!(
        write_markdown_export_file(link.to_string_lossy().into(), "new".into()),
        Err(AppError::Invalid(_))
    ));
    assert!(std::fs::symlink_metadata(&link).unwrap().is_symlink());
}

#[test]
fn export_keeps_an_existing_files_permissions() {
    let dir = tempfile::tempdir().unwrap();
    let target = dir.path().join("private.md");
    std::fs::write(&target, b"old").unwrap();
    std::fs::set_permissions(&target, std::fs::Permissions::from_mode(0o600)).unwrap();

    write_markdown_export_file(target.to_string_lossy().into(), "new".into()).unwrap();

    assert_eq!(std::fs::read_to_string(&target).unwrap(), "new");
    assert_eq!(std::fs::metadata(&target).unwrap().permissions().mode() & 0o777, 0o600);
}
