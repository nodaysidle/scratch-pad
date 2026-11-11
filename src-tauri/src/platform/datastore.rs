use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::error::AppError;
use crate::AppState;

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

fn existing_file(path: &Path) -> Result<PathBuf, AppError> {
    let canonical = std::fs::canonicalize(path)
        .map_err(|_| AppError::Invalid("The file could not be opened.".into()))?;
    if !canonical.is_file() {
        return Err(AppError::Invalid("The file could not be opened.".into()));
    }
    Ok(canonical)
}

fn save_target(path: &Path) -> Result<PathBuf, AppError> {
    let file_name =
        path.file_name().ok_or_else(|| AppError::Invalid("The file could not be saved.".into()))?;
    let parent = path
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .ok_or_else(|| AppError::Invalid("The file could not be saved.".into()))?;
    let canonical_parent = std::fs::canonicalize(parent)
        .map_err(|_| AppError::Invalid("The file could not be saved.".into()))?;
    if !canonical_parent.is_dir() {
        return Err(AppError::Invalid("The file could not be saved.".into()));
    }
    let target = canonical_parent.join(file_name);
    if target.is_dir() {
        return Err(AppError::Invalid("The file could not be saved.".into()));
    }
    Ok(target)
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

#[tauri::command]
pub fn create_note(state: State<'_, AppState>, input: NoteInput) -> Result<Note, AppError> {
    let mut connection = state
        .database
        .lock()
        .map_err(|_| AppError::Storage("The saved records are busy.".into()))?;
    create_note_in_db(&mut connection, input)
}

#[tauri::command]
pub fn list_note(state: State<'_, AppState>) -> Result<Vec<Note>, AppError> {
    let connection = state
        .database
        .lock()
        .map_err(|_| AppError::Storage("The saved records are busy.".into()))?;
    list_note_in_db(&connection)
}

#[tauri::command]
pub fn get_note(state: State<'_, AppState>, id: i64) -> Result<Note, AppError> {
    let connection = state
        .database
        .lock()
        .map_err(|_| AppError::Storage("The saved records are busy.".into()))?;
    get_note_in_db(&connection, id)
}

#[tauri::command]
pub fn update_note(
    state: State<'_, AppState>,
    id: i64,
    input: NoteInput,
) -> Result<Note, AppError> {
    let mut connection = state
        .database
        .lock()
        .map_err(|_| AppError::Storage("The saved records are busy.".into()))?;
    update_note_in_db(&mut connection, id, input)
}

#[tauri::command]
pub fn read_text_file(path: String) -> Result<String, AppError> {
    let canonical = existing_file(Path::new(&path))?;
    let bytes = std::fs::read(&canonical)
        .map_err(|_| AppError::Storage("The file could not be opened.".into()))?;
    String::from_utf8(bytes).map_err(|_| AppError::Invalid("The file could not be opened.".into()))
}

#[tauri::command]
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
