use std::io::{Read, Write};
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};

use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Runtime, State};
use tauri_plugin_dialog::DialogExt;

use crate::error::AppError;
use crate::platform::permissioncoordinator::{existing_file, save_target};
use crate::AppState;

/// Maximum plain-text file size accepted when opening a file into the note (10 MiB).
pub const MAX_OPEN_BYTES: u64 = 10 * 1024 * 1024;

static TEMP_COUNTER: AtomicU64 = AtomicU64::new(0);

const SAVE_FAILED: &str = "The note could not be saved.";
const LOAD_FAILED: &str = "The note could not be loaded.";

/// Turns any rusqlite failure into the one storage error, so call sites only say what failed.
trait OrStorage<T> {
    fn or_storage(self, message: &str) -> Result<T, AppError>;
}

impl<T> OrStorage<T> for rusqlite::Result<T> {
    fn or_storage(self, message: &str) -> Result<T, AppError> {
        self.map_err(|_| AppError::Storage(message.into()))
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Note {
    pub id: i64,
    pub text: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct NoteInput {
    pub text: String,
}

/// What a write returns: the id only; the caller already holds the text it sent.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub struct NoteId {
    pub id: i64,
}

pub fn create_note_in_db(
    connection: &mut Connection,
    input: NoteInput,
) -> Result<NoteId, AppError> {
    let tx = connection.transaction().or_storage(SAVE_FAILED)?;
    tx.execute("INSERT INTO note (text) VALUES (?1)", [&input.text]).or_storage(SAVE_FAILED)?;
    let id = tx.last_insert_rowid();
    tx.commit().or_storage(SAVE_FAILED)?;
    Ok(NoteId { id })
}

/// The newest note, or nothing when none exists yet (the app keeps a single note).
pub fn list_note_in_db(connection: &Connection) -> Result<Vec<Note>, AppError> {
    let mut stmt = connection
        .prepare("SELECT id, text FROM note ORDER BY id DESC LIMIT 1")
        .or_storage(LOAD_FAILED)?;
    let rows = stmt
        .query_map([], |row| Ok(Note { id: row.get(0)?, text: row.get(1)? }))
        .or_storage(LOAD_FAILED)?;
    rows.collect::<rusqlite::Result<Vec<_>>>().or_storage(LOAD_FAILED)
}

pub fn get_note_in_db(connection: &Connection, id: i64) -> Result<Note, AppError> {
    connection
        .query_row("SELECT id, text FROM note WHERE id = ?1", [id], |row| {
            Ok(Note { id: row.get(0)?, text: row.get(1)? })
        })
        .map_err(|err| match err {
            rusqlite::Error::QueryReturnedNoRows => {
                AppError::NotFound("The note could not be found.".into())
            }
            _ => AppError::Storage(LOAD_FAILED.into()),
        })
}

pub fn update_note_in_db(
    connection: &mut Connection,
    id: i64,
    input: NoteInput,
) -> Result<NoteId, AppError> {
    let tx = connection.transaction().or_storage(SAVE_FAILED)?;
    let changed = tx
        .execute("UPDATE note SET text = ?1 WHERE id = ?2", rusqlite::params![input.text, id])
        .or_storage(SAVE_FAILED)?;
    if changed == 0 {
        return Err(AppError::NotFound("The note could not be found.".into()));
    }
    tx.commit().or_storage(SAVE_FAILED)?;
    Ok(NoteId { id })
}

#[tauri::command(async)]
pub fn create_note(state: State<'_, AppState>, input: NoteInput) -> Result<NoteId, AppError> {
    state.with_db(|conn| create_note_in_db(conn, input))
}

#[tauri::command(async)]
pub fn list_note(state: State<'_, AppState>) -> Result<Vec<Note>, AppError> {
    state.with_db(|conn| list_note_in_db(conn))
}

#[tauri::command(async)]
pub fn get_note(state: State<'_, AppState>, id: i64) -> Result<Note, AppError> {
    state.with_db(|conn| get_note_in_db(conn, id))
}

#[tauri::command(async)]
pub fn update_note(
    state: State<'_, AppState>,
    id: i64,
    input: NoteInput,
) -> Result<NoteId, AppError> {
    state.with_db(|conn| update_note_in_db(conn, id, input))
}

/// Reads a chosen file as UTF-8 text, refusing anything that is not a regular file of at most 10 MiB.
pub fn read_text_at(path: &Path) -> Result<String, AppError> {
    let canonical = existing_file(path)?;
    let file = std::fs::File::open(&canonical)
        .map_err(|_| AppError::Storage("The file could not be opened.".into()))?;
    let meta =
        file.metadata().map_err(|_| AppError::Storage("The file could not be opened.".into()))?;
    if !meta.is_file() || meta.len() > MAX_OPEN_BYTES {
        return Err(AppError::Invalid("The file could not be opened.".into()));
    }
    let mut bytes = Vec::new();
    Read::take(file, MAX_OPEN_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| AppError::Storage("The file could not be opened.".into()))?;
    if bytes.len() as u64 > MAX_OPEN_BYTES {
        return Err(AppError::Invalid("The file could not be opened.".into()));
    }
    String::from_utf8(bytes).map_err(|_| AppError::Invalid("The file could not be opened.".into()))
}

/// Writes `content` to `path` atomically (temp file + rename in the target's folder). A symlink is
/// written through to the file it points at, and an existing file keeps its permissions.
pub fn write_text_at(path: &Path, content: &str) -> Result<(), AppError> {
    let failed = || AppError::Storage("The file could not be saved.".into());
    let mut target = save_target(path)?;
    if std::fs::symlink_metadata(&target).is_ok_and(|meta| meta.is_symlink()) {
        // A dangling link has nothing to resolve to; refuse rather than replace the link.
        target = std::fs::canonicalize(&target)
            .map_err(|_| AppError::Invalid("The file could not be saved.".into()))?;
    }
    let existing = std::fs::metadata(&target).ok();
    let parent = target.parent().ok_or_else(failed)?;
    let seq = TEMP_COUNTER.fetch_add(1, Ordering::Relaxed);
    let temp_path = parent.join(format!(".scratch-pad-export-{}-{seq}.tmp", std::process::id()));

    let write_result = (|| -> std::io::Result<()> {
        let mut file = std::fs::OpenOptions::new().write(true).create_new(true).open(&temp_path)?;
        file.write_all(content.as_bytes())?;
        if let Some(meta) = &existing {
            file.set_permissions(meta.permissions())?;
        }
        file.sync_all()?;
        drop(file);
        std::fs::rename(&temp_path, &target)
    })();

    if write_result.is_err() {
        let _ = std::fs::remove_file(&temp_path);
        return Err(failed());
    }
    Ok(())
}

/// Shows the open dialog and reads the chosen file in one step, so the webview never names a path.
/// `None` means the user cancelled.
#[tauri::command(async)]
pub fn open_text_file<R: Runtime>(app: AppHandle<R>) -> Result<Option<String>, AppError> {
    let Some(picked) = app.dialog().file().blocking_pick_file() else {
        return Ok(None);
    };
    let path = picked
        .into_path()
        .map_err(|_| AppError::Invalid("The file could not be opened.".into()))?;
    read_text_at(&path).map(Some)
}

/// Shows the save dialog (suggesting `suggested_name`) and writes the chosen file in one step.
/// Returns false when the user cancelled.
#[tauri::command(async)]
pub fn save_markdown_file<R: Runtime>(
    app: AppHandle<R>,
    suggested_name: String,
    content: String,
) -> Result<bool, AppError> {
    // The name is only a suggestion for the dialog: keep its last component so it cannot steer the folder.
    let name = Path::new(&suggested_name)
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_default();
    let Some(picked) = app.dialog().file().set_file_name(name).blocking_save_file() else {
        return Ok(false);
    };
    let path =
        picked.into_path().map_err(|_| AppError::Invalid("The file could not be saved.".into()))?;
    write_text_at(&path, &content).map(|()| true)
}
