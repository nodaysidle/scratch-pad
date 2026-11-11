use std::path::Path;

use crate::database;
use crate::error::AppError;

/// Opens and migrates the database at launch, dropping the connection before `manage_state`.
pub fn launch(folder: &Path) -> Result<(), AppError> {
    let connection = database::open(folder)?;
    drop(connection);
    Ok(())
}

/// Releases resources held by the application on exit.
pub fn exit() {}
