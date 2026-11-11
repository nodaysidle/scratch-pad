use std::path::Path;

use rusqlite::Connection;

use crate::error::AppError;

/// Schema changes, applied in order. Feature tasks append their tables; never edit one that has shipped.
pub const MIGRATIONS: &[&str] = &[];

/// The records database in the app-data folder (created when missing); PRAGMA user_version holds the schema version.
pub fn open(folder: &Path) -> Result<Connection, AppError> {
    // A fresh install has no app-data folder yet, and launch opens the store before manage_state would create it.
    std::fs::create_dir_all(folder)
        .map_err(|_| AppError::Storage("The app-data folder could not be created.".into()))?;
    let mut connection = Connection::open(folder.join("records.sqlite3"))
        .map_err(|_| AppError::Storage("The saved records could not be opened.".into()))?;
    migrate(&mut connection, MIGRATIONS)?;
    Ok(connection)
}

/// Applies the migrations after the stored version, each in its own transaction with its version.
pub fn migrate(connection: &mut Connection, migrations: &[&str]) -> Result<(), AppError> {
    let failed = |_| AppError::Storage("The saved records could not be upgraded.".into());
    let version = user_version(connection)?;
    for (index, sql) in migrations.iter().enumerate().skip(version) {
        let transaction = connection.transaction().map_err(failed)?;
        transaction.execute_batch(sql).map_err(failed)?;
        transaction.pragma_update(None, "user_version", index + 1).map_err(failed)?;
        transaction.commit().map_err(failed)?;
    }
    Ok(())
}

pub fn user_version(connection: &Connection) -> Result<usize, AppError> {
    connection
        .query_row("PRAGMA user_version", [], |row| row.get(0))
        .map_err(|_| AppError::Storage("The saved records could not be read.".into()))
}
