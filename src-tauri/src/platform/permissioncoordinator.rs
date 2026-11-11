use std::path::{Path, PathBuf};

use crate::error::AppError;

/// Canonicalizes an existing file path selected by the user; rejects missing paths or directories.
pub fn existing_file(path: &Path) -> Result<PathBuf, AppError> {
    let canonical = std::fs::canonicalize(path)
        .map_err(|_| AppError::Invalid("The file could not be opened.".into()))?;
    if !canonical.is_file() {
        return Err(AppError::Invalid("The file could not be opened.".into()));
    }
    Ok(canonical)
}

/// Canonicalizes the parent directory of a user-chosen save target and joins the file name.
pub fn save_target(path: &Path) -> Result<PathBuf, AppError> {
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
