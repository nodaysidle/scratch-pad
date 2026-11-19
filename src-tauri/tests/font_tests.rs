use std::fs;

use scratch_pad_lib::platform::font::{default_terminal, parse_size, terminal_size};

#[test]
fn parses_each_terminal_format() {
    assert_eq!(
        parse_size("ghostty", "font-family = \"JetBrainsMono Nerd Font\"\nfont-size = 12\n"),
        Some(12.0)
    );
    assert_eq!(
        parse_size("kitty", "font_family JetBrainsMono Nerd Font\nfont_size 11.5\n"),
        Some(11.5)
    );
    assert_eq!(
        parse_size(
            "foot",
            "[main]\nfont=JetBrainsMono Nerd Font:size=9,Noto Color Emoji:size=20\n"
        ),
        Some(9.0)
    );
    assert_eq!(
        parse_size(
            "alacritty",
            "[window]\nsize = 3\n\n[font]\nnormal = { family = \"JetBrainsMono Nerd Font\" }\nsize = 9\n"
        ),
        Some(9.0)
    );
    // A size outside [font] is not the font size, even when it is a sane number.
    assert_eq!(parse_size("alacritty", "[window]\nsize = 20\n"), None);
}

#[test]
fn rejects_sizes_that_are_not_sane_numbers() {
    for text in [
        "font-size = 500",
        "font-size = 2",
        "font-size = big",
        "font-size = 12; rm",
        "# font-size = 12",
    ] {
        assert_eq!(parse_size("ghostty", text), None, "{text}");
    }
    assert_eq!(parse_size("unknown", "font-size = 12"), None);
}

#[test]
fn finds_the_default_terminal() {
    assert_eq!(
        default_terminal("# comment\n\ncom.mitchellh.ghostty.desktop\nfoot.desktop\n"),
        Some("ghostty")
    );
    assert_eq!(default_terminal("Alacritty.desktop\n"), Some("alacritty"));
    assert_eq!(default_terminal("org.wezfurlong.wezterm.desktop\n"), None);
    assert_eq!(default_terminal(""), None);
}

#[test]
fn uses_the_default_terminal_then_falls_back() {
    let dir = tempfile::tempdir().unwrap();
    let config = dir.path();
    assert_eq!(terminal_size(config), None);

    fs::create_dir_all(config.join("foot")).unwrap();
    fs::write(config.join("foot/foot.ini"), "font=Mono:size=9\n").unwrap();
    fs::create_dir_all(config.join("ghostty")).unwrap();
    fs::write(config.join("ghostty/config"), "font-size = 12\n").unwrap();
    // No list file: the fallback order starts with Ghostty.
    assert_eq!(terminal_size(config), Some(12.0));

    let list = config.join("xdg-terminals.list");
    fs::write(&list, "foot.desktop\n").unwrap();
    assert_eq!(terminal_size(config), Some(9.0));

    fs::write(&list, "org.wezfurlong.wezterm.desktop\n").unwrap();
    assert_eq!(terminal_size(config), Some(12.0));

    // kitty is the default but has no config: fall back.
    fs::write(&list, "kitty.desktop\n").unwrap();
    assert_eq!(terminal_size(config), Some(12.0));
}

#[test]
fn strips_inline_comments_and_uses_last_valid_setting() {
    assert_eq!(parse_size("ghostty", "font-size = 11 # base\nfont-size = 14 # pt\n"), Some(14.0));
    assert_eq!(parse_size("ghostty", "font-size = 13 ; spaced comment\n"), Some(13.0));
    assert_eq!(
        parse_size("ghostty", "font-size = 14 # valid\nfont-size = 500 # invalid\n"),
        Some(14.0)
    );
    assert_eq!(
        parse_size("kitty", "font_size 10 # first\nfont_size 12.5 # override\n"),
        Some(12.5)
    );
    assert_eq!(
        parse_size(
            "foot",
            "[main] # header\nfont=Mono:size=9 ; first\nfont=Mono:size=11.5 # override\n"
        ),
        Some(11.5)
    );
    assert_eq!(
        parse_size("alacritty", "[font] # section\nsize = 10 # base\nsize = 13 # override\n"),
        Some(13.0)
    );
}
