//! Pushes Omarchy changes (theme colours, terminal font size) to the webview instead of letting it
//! poll. One file watcher watches the *folders* that hold the files: Omarchy deletes and recreates
//! the theme folder on a switch, which a watch on the file itself would not survive.

use std::collections::BTreeMap;
use std::path::PathBuf;
use std::sync::mpsc::{self, RecvTimeoutError};
use std::sync::Mutex;
use std::time::Duration;

use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, Runtime};

use crate::platform::{font, theme};

/// The Tauri event the webview listens to.
pub const EVENT: &str = "omarchy-changed";

/// Quiet time after the last file event before one event is sent: a theme switch writes many files.
const QUIET: Duration = Duration::from_millis(250);

/// The event payload: what `theme_palette` and `terminal_font` return, together.
#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct OmarchyState {
    pub palette: BTreeMap<String, String>,
    pub font: font::TerminalFont,
}

/// The folders to watch and the paths inside them that matter. Watching a folder reports every
/// change in it, so events outside `relevant` are dropped.
#[derive(Debug, Default, PartialEq)]
pub struct WatchPlan {
    pub folders: Vec<(PathBuf, RecursiveMode)>,
    pub relevant: Vec<PathBuf>,
}

/// Plans the watch: the folder above the theme folder (so its removal is seen), and the config
/// folder with each terminal's own folder (editors replace files by renaming).
pub fn plan(palette_file: Option<PathBuf>, config_dir: Option<PathBuf>) -> WatchPlan {
    let mut plan = WatchPlan::default();
    // .../omarchy/current/theme/colors.toml -> .../omarchy/current
    if let Some(current) = palette_file.as_deref().and_then(|file| file.parent()?.parent()) {
        plan.folders.push((current.to_path_buf(), RecursiveMode::Recursive));
        plan.relevant.push(current.to_path_buf());
    }
    if let Some(config) = config_dir {
        plan.relevant.push(config.join("xdg-terminals.list"));
        plan.folders.push((config.clone(), RecursiveMode::NonRecursive));
        for terminal in font::TERMINALS {
            let dir = config.join(terminal);
            plan.folders.push((dir.clone(), RecursiveMode::NonRecursive));
            plan.relevant.push(dir);
        }
    }
    plan
}

/// Starts watching `plan` and calls `on_change` once per burst of relevant events. The watcher
/// stops (and its thread ends) when the returned value is dropped. A folder that does not exist
/// (no Omarchy, no such terminal) is skipped.
pub fn watch(
    plan: WatchPlan,
    quiet: Duration,
    mut on_change: impl FnMut() + Send + 'static,
) -> notify::Result<RecommendedWatcher> {
    let (tx, rx) = mpsc::channel();
    let relevant = plan.relevant;
    let mut watcher = notify::recommended_watcher(move |event: notify::Result<notify::Event>| {
        let Ok(event) = event else { return };
        if event.paths.iter().any(|path| relevant.iter().any(|keep| path.starts_with(keep))) {
            let _ = tx.send(());
        }
    })?;
    for (folder, mode) in plan.folders {
        let _ = watcher.watch(&folder, mode);
    }
    std::thread::spawn(move || {
        while rx.recv().is_ok() {
            loop {
                match rx.recv_timeout(quiet) {
                    Ok(()) => {}
                    Err(RecvTimeoutError::Timeout) => {
                        on_change();
                        break;
                    }
                    Err(RecvTimeoutError::Disconnected) => return,
                }
            }
        }
    });
    Ok(watcher)
}

/// Reads the palette and the terminal font as the window sees them now.
pub fn snapshot<R: Runtime>(app: &AppHandle<R>) -> OmarchyState {
    let scale = app.get_webview_window("main").and_then(|win| win.scale_factor().ok());
    OmarchyState {
        palette: theme::current_palette(),
        font: font::read_terminal_font(scale.unwrap_or(1.0)),
    }
}

/// Starts the watcher and keeps it alive in managed state; each burst of changes emits `EVENT`.
pub fn start<R: Runtime>(app: &AppHandle<R>) -> notify::Result<()> {
    let handle = app.clone();
    let watcher =
        watch(plan(theme::active_palette_path(), font::config_dir()), QUIET, move || {
            let _ = handle.emit(EVENT, snapshot(&handle));
        })?;
    app.manage(Mutex::new(watcher));
    Ok(())
}
