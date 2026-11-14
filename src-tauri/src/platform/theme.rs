//! The active Omarchy theme's palette. Read-only, one fixed file, and only allowlisted keys with
//! validated values leave this module, so the frontend can put them straight into CSS.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use crate::error::AppError;

const COLOR_KEYS: &[&str] = &[
    "background",
    "foreground",
    "accent",
    "selection",
    "selection_background",
    "selection_foreground",
    "red",
    "color1",
];
// A real colors.toml is a few kilobytes; anything far larger is not a palette.
const MAX_BYTES: u64 = 256 * 1024;

fn is_hex_color(value: &str) -> bool {
    value.len() == 7
        && value.starts_with('#')
        && value[1..].chars().all(|character| character.is_ascii_hexdigit())
}

/// Parses `key = "value"` lines. Unknown keys and values that are not `#rrggbb`
/// (or `light`/`dark` for `mode`) are dropped.
pub fn parse_palette(text: &str) -> BTreeMap<String, String> {
    let mut palette = BTreeMap::new();
    for line in text.lines() {
        let Some((key, rest)) = line.split_once('=') else { continue };
        let key = key.trim();
        let Some(value) = rest.trim().strip_prefix('"').and_then(|quoted| quoted.split('"').next())
        else {
            continue;
        };
        let valid = if key == "mode" {
            value == "light" || value == "dark"
        } else {
            COLOR_KEYS.contains(&key) && is_hex_color(value)
        };
        if valid {
            palette.insert(key.to_string(), value.to_string());
        }
    }
    palette
}

/// The palette in `path`, or an empty map when the file is missing, unreadable or too large.
/// Omarchy removes and recreates the theme folder on every switch, so a missing file is normal.
pub fn read_palette(path: &Path) -> BTreeMap<String, String> {
    match std::fs::metadata(path) {
        Ok(metadata) if metadata.is_file() && metadata.len() <= MAX_BYTES => {}
        _ => return BTreeMap::new(),
    }
    std::fs::read_to_string(path).map(|text| parse_palette(&text)).unwrap_or_default()
}

/// Where Omarchy keeps the active theme's palette.
pub fn active_palette_path() -> Option<PathBuf> {
    let home = std::env::var_os("HOME")?;
    Some(Path::new(&home).join(".config/omarchy/current/theme/colors.toml"))
}

/// The active theme's colours; empty when there is no Omarchy theme. Never fails.
#[tauri::command(async)]
pub fn theme_palette() -> Result<BTreeMap<String, String>, AppError> {
    Ok(active_palette_path().map(|path| read_palette(&path)).unwrap_or_default())
}
