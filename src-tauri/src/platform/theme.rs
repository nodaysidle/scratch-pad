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

/// Parses `#rrggbb` into RGB bytes, returning `None` for any other format.
pub fn parse_hex_rgb(value: &str) -> Option<(u8, u8, u8)> {
    if !is_hex_color(value) {
        return None;
    }
    let r = u8::from_str_radix(&value[1..3], 16).ok()?;
    let g = u8::from_str_radix(&value[3..5], 16).ok()?;
    let b = u8::from_str_radix(&value[5..7], 16).ok()?;
    Some((r, g, b))
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

fn env_path(name: &str) -> Option<PathBuf> {
    std::env::var_os(name).filter(|value| !value.is_empty()).map(PathBuf::from)
}

/// Resolves the Omarchy active theme palette path across XDG state and config locations.
pub fn resolve_palette_path(
    xdg_state: Option<&Path>,
    xdg_config: Option<&Path>,
    home: Option<&Path>,
) -> Option<PathBuf> {
    let rel = "omarchy/current/theme/colors.toml";
    let mut candidates = Vec::new();
    if let Some(dir) = xdg_state.filter(|p| !p.as_os_str().is_empty()) {
        candidates.push(dir.join(rel));
    }
    if let Some(dir) = home.filter(|p| !p.as_os_str().is_empty()) {
        candidates.push(dir.join(".local/state").join(rel));
    }
    if let Some(dir) = xdg_config.filter(|p| !p.as_os_str().is_empty()) {
        candidates.push(dir.join(rel));
    }
    let fallback =
        home.filter(|p| !p.as_os_str().is_empty()).map(|dir| dir.join(".config").join(rel));
    if let Some(ref path) = fallback {
        candidates.push(path.clone());
    }
    candidates.into_iter().find(|path| path.is_file()).or(fallback)
}

/// Where Omarchy keeps the active theme's palette.
pub fn active_palette_path() -> Option<PathBuf> {
    let xdg_state = env_path("XDG_STATE_HOME");
    let xdg_config = env_path("XDG_CONFIG_HOME");
    let home = env_path("HOME");
    resolve_palette_path(xdg_state.as_deref(), xdg_config.as_deref(), home.as_deref())
}

/// The active theme's colours; empty when there is no Omarchy theme.
pub fn current_palette() -> BTreeMap<String, String> {
    active_palette_path().map(|path| read_palette(&path)).unwrap_or_default()
}

/// The active theme's colours; empty when there is no Omarchy theme. Never fails.
#[tauri::command(async)]
pub fn theme_palette() -> Result<BTreeMap<String, String>, AppError> {
    Ok(current_palette())
}
