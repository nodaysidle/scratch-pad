use std::os::unix::fs::PermissionsExt;

use scratch_pad_lib as backend;
use scratch_pad_lib::error::AppError;
use scratch_pad_lib::platform::datastore::{
    create_note_in_db, get_note_in_db, list_note_in_db, read_text_file, update_note_in_db,
    write_markdown_export_file, Note, NoteInput,
};

#[test]
fn note_crud_whitespace_empty_and_reopen_persistence() {
    let dir = tempfile::tempdir().unwrap();
    let first: Note;
    let second: Note;

    {
        let mut conn = backend::database::open(dir.path()).unwrap();
        let created_empty = create_note_in_db(&mut conn, NoteInput { text: "".into() }).unwrap();
        assert_eq!(created_empty.text, "");
        assert_eq!(get_note_in_db(&conn, created_empty.id).unwrap().text, "");

        first = update_note_in_db(&mut conn, created_empty.id, NoteInput { text: "   ".into() })
            .unwrap();
        assert_eq!(first.id, created_empty.id);
        assert_eq!(first.text, "   ");
        assert_eq!(get_note_in_db(&conn, first.id).unwrap().text, "   ");

        second = create_note_in_db(&mut conn, NoteInput { text: "Second\nline".into() }).unwrap();
        let listed = list_note_in_db(&conn).unwrap();
        assert_eq!(listed, vec![second.clone(), first.clone()]);

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
    let listed_after = list_note_in_db(&reopened).unwrap();
    assert_eq!(listed_after, vec![second, first]);
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
