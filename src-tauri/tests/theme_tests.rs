use std::path::{Path, PathBuf};

use scratch_pad_lib::platform::theme::{parse_palette, read_palette};

const FULL_THEME: &str = r##"mode = "dark"
accent = "#cc0000"
selection = "#1a1a1a"
selection_background = "#1a1a1a"
selection_foreground = "#ffffff"
background = "#000000"
foreground = "#e0e0e0"
red = "#cc0000"
hyprland_active_border = "rgb(cc0000) rgb(800000) 45deg"
"##;

const THIN_THEME: &str = r##"# a thin theme (quattro-glass): no mode, aligned keys, long comment blocks
accent               = "#FFFFFF"
foreground           = "#E0E0E0"
background           = "#0A0A0A"
selection_foreground = "#0A0A0A"
selection_background = "#C8C8C8"
color1 = "#F2798F"
"##;

#[test]
fn parses_a_full_palette() {
    let palette = parse_palette(FULL_THEME);
    assert_eq!(palette["background"], "#000000");
    assert_eq!(palette["foreground"], "#e0e0e0");
    assert_eq!(palette["accent"], "#cc0000");
    assert_eq!(palette["mode"], "dark");
    assert_eq!(palette["selection_foreground"], "#ffffff");
    assert_eq!(palette["red"], "#cc0000");
    assert!(!palette.contains_key("hyprland_active_border"));
}

#[test]
fn parses_a_thin_palette_with_padded_keys_and_comments() {
    let palette = parse_palette(THIN_THEME);
    assert_eq!(palette["accent"], "#FFFFFF");
    assert_eq!(palette["background"], "#0A0A0A");
    assert_eq!(palette["color1"], "#F2798F");
    assert!(!palette.contains_key("mode"));
    assert!(!palette.contains_key("red"));
}

#[test]
fn drops_values_that_are_not_plain_hex_colors() {
    let text = r##"background = "red"
foreground = "#12345"
accent = "#12345g"
red = "#000000; background: url(x)"
selection = "rgb(1, 2, 3)"
mode = "sepia"
accent = #cc0000
# foreground = "#ffffff"
"##;
    assert!(parse_palette(text).is_empty());
}

#[test]
fn a_missing_or_oversized_file_is_an_empty_palette() {
    let dir = tempfile::tempdir().unwrap();
    assert!(read_palette(&dir.path().join("missing.toml")).is_empty());
    assert!(read_palette(dir.path()).is_empty());

    let big = dir.path().join("big.toml");
    std::fs::write(&big, format!("{}\nbackground = \"#000000\"\n", "#".repeat(300_000))).unwrap();
    assert!(read_palette(&big).is_empty());

    let small = dir.path().join("small.toml");
    std::fs::write(&small, "background = \"#101010\"\n").unwrap();
    assert_eq!(read_palette(&small)["background"], "#101010");
}

#[test]
fn every_installed_omarchy_theme_has_the_three_required_colors() {
    let mut folders = vec![PathBuf::from("/usr/share/omarchy/themes")];
    if let Some(home) = std::env::var_os("HOME") {
        folders.push(Path::new(&home).join(".config/omarchy/themes"));
    }
    let mut checked = 0;
    let mut failing = Vec::new();
    for folder in folders.iter().filter(|folder| folder.is_dir()) {
        for entry in std::fs::read_dir(folder).unwrap().flatten() {
            let colors = entry.path().join("colors.toml");
            if !colors.is_file() {
                continue;
            }
            checked += 1;
            let palette = read_palette(&colors);
            if ["background", "foreground", "accent"].iter().any(|key| !palette.contains_key(*key))
            {
                failing.push(entry.path().display().to_string());
            }
        }
    }
    println!("checked {checked} installed Omarchy themes");
    assert!(failing.is_empty(), "themes missing a required colour: {failing:?}");
}
