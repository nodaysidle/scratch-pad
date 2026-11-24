use std::path::PathBuf;
use std::sync::mpsc;
use std::time::Duration;

use notify::RecursiveMode;
use scratch_pad_lib::platform::omarchy::{plan, watch, WatchPlan};

const QUIET: Duration = Duration::from_millis(100);
const WAIT: Duration = Duration::from_secs(5);

#[test]
fn plan_watches_the_folder_above_the_theme_folder_and_the_terminal_folders() {
    let planned = plan(
        Some(PathBuf::from("/h/.config/omarchy/current/theme/colors.toml")),
        Some(PathBuf::from("/h/.config")),
    );
    assert!(planned
        .folders
        .contains(&(PathBuf::from("/h/.config/omarchy/current"), RecursiveMode::Recursive)));
    for terminal in ["ghostty", "kitty", "foot", "alacritty"] {
        let dir = PathBuf::from("/h/.config").join(terminal);
        assert!(planned.folders.contains(&(dir.clone(), RecursiveMode::NonRecursive)));
        assert!(planned.relevant.contains(&dir));
    }
    assert!(planned.relevant.contains(&PathBuf::from("/h/.config/xdg-terminals.list")));
    assert_eq!(plan(None, None), WatchPlan::default());
}

fn watching(plan: WatchPlan) -> (notify::RecommendedWatcher, mpsc::Receiver<()>) {
    let (tx, rx) = mpsc::channel();
    let watcher = watch(plan, QUIET, move || {
        let _ = tx.send(());
    })
    .unwrap();
    (watcher, rx)
}

#[test]
fn recreating_the_theme_folder_sends_one_event_per_burst_and_keeps_watching() {
    let root = tempfile::tempdir().unwrap();
    let current = root.path().join("omarchy/current");
    let theme = current.join("theme");
    std::fs::create_dir_all(&theme).unwrap();
    std::fs::write(theme.join("colors.toml"), "background = \"#000000\"\n").unwrap();
    let (_watcher, rx) =
        watching(plan(Some(theme.join("colors.toml")), Some(root.path().join("config"))));

    // Delete the folder, then bring a new one back, all within the quiet time.
    std::fs::remove_dir_all(&theme).unwrap();
    std::fs::create_dir_all(&theme).unwrap();
    std::fs::write(theme.join("colors.toml"), "background = \"#ffffff\"\n").unwrap();

    rx.recv_timeout(WAIT).expect("a change event");
    assert!(rx.recv_timeout(Duration::from_millis(600)).is_err(), "the burst is one event");

    // The new folder is watched too.
    std::fs::write(theme.join("colors.toml"), "background = \"#123456\"\n").unwrap();
    rx.recv_timeout(WAIT).expect("an event for the recreated folder");
}

#[test]
fn the_real_theme_switch_renames_next_theme_over_theme_and_keeps_watching() {
    let root = tempfile::tempdir().unwrap();
    let current = root.path().join("omarchy/current");
    let theme = current.join("theme");
    let next = current.join("next-theme");
    std::fs::create_dir_all(&theme).unwrap();
    std::fs::write(theme.join("colors.toml"), "background = \"#000000\"\n").unwrap();
    let (_watcher, rx) =
        watching(plan(Some(theme.join("colors.toml")), Some(root.path().join("config"))));

    // What omarchy-theme-set does: build next-theme, drop theme, rename next-theme to theme.
    std::fs::create_dir_all(&next).unwrap();
    std::fs::write(next.join("colors.toml"), "background = \"#ffffff\"\n").unwrap();
    std::fs::remove_dir_all(&theme).unwrap();
    std::fs::rename(&next, &theme).unwrap();

    // A slow switch may send more than one event, so only "at least one" is asserted.
    rx.recv_timeout(WAIT).expect("at least one change event");
    while rx.recv_timeout(Duration::from_millis(600)).is_ok() {}

    std::fs::write(theme.join("colors.toml"), "background = \"#123456\"\n").unwrap();
    rx.recv_timeout(WAIT).expect("an event for the renamed folder");
}

#[test]
fn a_terminal_font_change_sends_an_event_and_unrelated_files_do_not() {
    let config = tempfile::tempdir().unwrap();
    std::fs::create_dir(config.path().join("ghostty")).unwrap();
    let (_watcher, rx) = watching(plan(None, Some(config.path().to_path_buf())));

    std::fs::write(config.path().join("unrelated.conf"), "x").unwrap();
    assert!(rx.recv_timeout(Duration::from_millis(600)).is_err(), "unrelated file is ignored");

    std::fs::write(config.path().join("ghostty/config"), "font-size = 14\n").unwrap();
    rx.recv_timeout(WAIT).expect("a change event");
}

#[test]
fn missing_folders_are_skipped_and_dropping_the_watcher_ends_the_thread() {
    let root = tempfile::tempdir().unwrap();
    let (watcher, rx) = watching(plan(
        Some(root.path().join("nope/current/theme/colors.toml")),
        Some(root.path().join("no-config")),
    ));
    drop(watcher);
    // The callback's sender is gone once the thread has ended.
    assert_eq!(rx.recv_timeout(WAIT), Err(mpsc::RecvTimeoutError::Disconnected));
}
