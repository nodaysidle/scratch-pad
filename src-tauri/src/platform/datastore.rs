use std::io::{Read, Write};
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};

use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::error::AppError;
use crate::platform::permissioncoordinator::{existing_file, save_target};
use crate::AppState;

/// Maximum plain-text file size accepted when opening a file into the note (10 MiB).
pub const MAX_OPEN_BYTES: u64 = 10 * 1024 * 1024;

static TEMP_COUNTER: AtomicU64 = AtomicU64::new(0);

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Note {
    pub id: i64,
    pub text: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct NoteInput {
    pub text: String,
}

pub fn create_note_in_db(connection: &mut Connection, input: NoteInput) -> Result<Note, AppError> {
    let tx = connection
        .transaction()
        .map_err(|_| AppError::Storage("The note could not be saved.".into()))?;
    tx.execute("INSERT INTO note (text) VALUES (?1)", [&input.text])
        .map_err(|_| AppError::Storage("The note could not be saved.".into()))?;
    let id = tx.last_insert_rowid();
    let note = tx
        .query_row("SELECT id, text FROM note WHERE id = ?1", [id], |row| {
            Ok(Note { id: row.get(0)?, text: row.get(1)? })
        })
        .map_err(|_| AppError::Storage("The note could not be saved.".into()))?;
    tx.commit().map_err(|_| AppError::Storage("The note could not be saved.".into()))?;
    Ok(note)
}

pub fn list_note_in_db(connection: &Connection) -> Result<Vec<Note>, AppError> {
    let mut stmt = connection
        .prepare("SELECT id, text FROM note ORDER BY id DESC")
        .map_err(|_| AppError::Storage("The note could not be loaded.".into()))?;
    let rows = stmt
        .query_map([], |row| Ok(Note { id: row.get(0)?, text: row.get(1)? }))
        .map_err(|_| AppError::Storage("The note could not be loaded.".into()))?;
    let mut notes = Vec::new();
    for row in rows {
        notes.push(row.map_err(|_| AppError::Storage("The note could not be loaded.".into()))?);
    }
    Ok(notes)
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
            _ => AppError::Storage("The note could not be loaded.".into()),
        })
}

pub fn update_note_in_db(
    connection: &mut Connection,
    id: i64,
    input: NoteInput,
) -> Result<Note, AppError> {
    let tx = connection
        .transaction()
        .map_err(|_| AppError::Storage("The note could not be saved.".into()))?;
    let changed = tx
        .execute("UPDATE note SET text = ?1 WHERE id = ?2", rusqlite::params![input.text, id])
        .map_err(|_| AppError::Storage("The note could not be saved.".into()))?;
    if changed == 0 {
        return Err(AppError::NotFound("The note could not be found.".into()));
    }
    let note = tx
        .query_row("SELECT id, text FROM note WHERE id = ?1", [id], |row| {
            Ok(Note { id: row.get(0)?, text: row.get(1)? })
        })
        .map_err(|_| AppError::Storage("The note could not be saved.".into()))?;
    tx.commit().map_err(|_| AppError::Storage("The note could not be saved.".into()))?;
    Ok(note)
}

#[tauri::command(async)]
pub fn create_note(state: State<'_, AppState>, input: NoteInput) -> Result<Note, AppError> {
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
) -> Result<Note, AppError> {
    state.with_db(|conn| update_note_in_db(conn, id, input))
}

#[tauri::command(async)]
pub fn read_text_file(path: String) -> Result<String, AppError> {
    let canonical = existing_file(Path::new(&path))?;
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

#[tauri::command(async)]
pub fn write_markdown_export_file(path: String, content: String) -> Result<(), AppError> {
    let target = save_target(Path::new(&path))?;
    let parent =
        target.parent().ok_or_else(|| AppError::Invalid("The file could not be saved.".into()))?;
    let seq = TEMP_COUNTER.fetch_add(1, Ordering::Relaxed);
    let temp_name = format!(".scratch-pad-export-{}-{seq}.tmp", std::process::id());
    let temp_path = parent.join(temp_name);

    let write_result = (|| -> std::io::Result<()> {
        let mut file = std::fs::OpenOptions::new().write(true).create_new(true).open(&temp_path)?;
        file.write_all(content.as_bytes())?;
        file.sync_all()?;
        drop(file);
        std::fs::rename(&temp_path, &target)?;
        Ok(())
    })();

    if write_result.is_err() {
        let _ = std::fs::remove_file(&temp_path);
        return Err(AppError::Storage("The file could not be saved.".into()));
    }
    Ok(())
}
