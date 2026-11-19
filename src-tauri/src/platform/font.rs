//! The default terminal's font size, so the note can be set at the same size. Read-only; only a
//! validated number leaves this module.

use std::path::Path;

use serde::Serialize;

use crate::error::AppError;

// Terminal configs are a few kilobytes; anything far larger is not one.
const MAX_BYTES: u64 = 256 * 1024;
const TERMINALS: &[&str] = &["ghostty", "alacritty", "kitty", "foot"];

#[derive(Serialize, Debug, Clone, PartialEq)]
pub struct TerminalFont {
    /// Font size in points, or None when no terminal config states one.
    pub size_pt: Option<f64>,
    /// The monitor scale factor of the window.
    pub scale: f64,
}

fn valid_size(text: &str) -> Option<f64> {
    let size: f64 = text.trim().trim_matches('"').parse().ok()?;
    (6.0..=72.0).contains(&size).then_some(size)
}

fn strip_inline_comment<'a>(terminal: &str, line: &'a str) -> &'a str {
    let line = line.split('#').next().unwrap_or(line);
    if terminal == "foot" {
        return line.split(';').next().unwrap_or(line);
    }
    if let Some(idx) = line.find(';') {
        if idx == 0 || line[..idx].chars().next_back().is_some_and(char::is_whitespace) {
            return &line[..idx];
        }
    }
    line
}

/// The font size a terminal's config text states. `terminal` is one of TERMINALS.
pub fn parse_size(terminal: &str, text: &str) -> Option<f64> {
    let mut section = String::new();
    let mut last = None;
    for raw_line in text.lines() {
        let line = strip_inline_comment(terminal, raw_line).trim();
        if line.is_empty() {
            continue;
        }
        if line.starts_with('[') {
            section = line.to_string();
            continue;
        }
        let found = match terminal {
            "ghostty" => line
                .split_once('=')
                .filter(|(key, _)| key.trim() == "font-size")
                .and_then(|(_, value)| valid_size(value)),
            "kitty" => line.strip_prefix("font_size").and_then(valid_size),
            "foot" => line
                .split_once('=')
                .filter(|(key, _)| key.trim() == "font")
                .and_then(|(_, value)| value.split(',').next())
                .and_then(|first| first.split_once(":size="))
                .and_then(|(_, size)| valid_size(size.split(':').next().unwrap_or(""))),
            "alacritty" => line
                .split_once('=')
                .filter(|(key, _)| section == "[font]" && key.trim() == "size")
                .and_then(|(_, value)| valid_size(value)),
            _ => None,
        };
        if found.is_some() {
            last = found;
        }
    }
    last
}

fn config_path(config_dir: &Path, terminal: &str) -> std::path::PathBuf {
    match terminal {
        "ghostty" => config_dir.join("ghostty/config"),
        "kitty" => config_dir.join("kitty/kitty.conf"),
        "foot" => config_dir.join("foot/foot.ini"),
        _ => config_dir.join("alacritty/alacritty.toml"),
    }
}

fn read_small(path: &Path) -> Option<String> {
    let metadata = std::fs::metadata(path).ok()?;
    if !metadata.is_file() || metadata.len() > MAX_BYTES {
        return None;
    }
    std::fs::read_to_string(path).ok()
}

fn size_of(config_dir: &Path, terminal: &str) -> Option<f64> {
    parse_size(terminal, &read_small(&config_path(config_dir, terminal))?)
}

/// The terminal named by the first entry of xdg-terminals.list, if it is one we can read.
pub fn default_terminal(list: &str) -> Option<&'static str> {
    let entry =
        list.lines().map(str::trim).find(|line| !line.is_empty() && !line.starts_with('#'))?;
    let entry = entry.to_ascii_lowercase();
    ["ghostty", "kitty", "foot", "alacritty"].into_iter().find(|name| entry.contains(name))
}

/// The default terminal's font size under `config_dir` (normally ~/.config); when the default
/// terminal is unknown or states no size, the first size any known terminal's config states.
pub fn terminal_size(config_dir: &Path) -> Option<f64> {
    let preferred = read_small(&config_dir.join("xdg-terminals.list"))
        .and_then(|list| default_terminal(&list))
        .and_then(|terminal| size_of(config_dir, terminal));
    preferred.or_else(|| TERMINALS.iter().find_map(|terminal| size_of(config_dir, terminal)))
}

/// The terminal's font size and this window's scale factor. Never fails.
#[tauri::command(async)]
pub fn terminal_font<R: tauri::Runtime>(
    window: tauri::Window<R>,
) -> Result<TerminalFont, AppError> {
    let config_dir = std::env::var_os("XDG_CONFIG_HOME")
        .filter(|value| !value.is_empty())
        .map(std::path::PathBuf::from)
        .or_else(|| {
            std::env::var_os("HOME")
                .filter(|value| !value.is_empty())
                .map(|home| Path::new(&home).join(".config"))
        });
    let size_pt = config_dir.and_then(|dir| terminal_size(&dir));
    Ok(TerminalFont { size_pt, scale: window.scale_factor().unwrap_or(1.0) })
}
