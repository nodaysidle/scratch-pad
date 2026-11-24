<div align="center">
  <img src="app-icon.svg" width="88" alt="Scratch Pad icon">
  <h1>Scratch Pad</h1>
  <p><strong>One always-ready note for Arch Linux and Hyprland, saved as you type.</strong></p>
  <p>A native Tauri 2 app with no window chrome that follows your Omarchy theme and terminal font live.</p>

  <p>
    <img src="https://img.shields.io/badge/Arch%20%2F%20Hyprland-Omarchy%20Native-1793D1?style=flat-square&logo=arch-linux&logoColor=white" alt="Arch / Hyprland / Omarchy">
    <img src="https://img.shields.io/badge/Tauri-2-24C8D8?style=flat-square&logo=tauri&logoColor=white" alt="Tauri 2">
    <img src="https://img.shields.io/badge/Storage-Local%20SQLite-232326?style=flat-square" alt="Local SQLite">
    <img src="https://img.shields.io/badge/version-0.2.0-555555?style=flat-square" alt="Version 0.2.0">
  </p>
</div>

---

Scratch Pad opens straight into your note with the cursor ready. There are no tabs, no titlebar, no sidebar, and no settings dialogs. Hyprland handles borders, rounding, and closing (`SUPER+W`), while Scratch Pad stays out of the way until you need somewhere to drop text, snippets, or quick thoughts.

## Highlights

- **One note, saved automatically:** saves after 10 seconds of idle, when you press `Ctrl+S`, when the window loses focus, and on close. If a closing save fails, the window stays open and tells you.
- **Follows Omarchy live:** watches `~/.config/omarchy/current/theme/colors.toml` and recolours immediately on theme switch without polling. Matches your terminal's `monospace` font and pixel size (Ghostty, Alacritty, kitty, or foot; 13px fallback).
- **Zero chrome, tiling first:** no header or decorations, 360x200 minimum size, built to sit cleanly in a tile or float as a scratchpad. On a wide tile the text keeps a readable column of about 100 characters.
- **Open and export:** load any UTF-8 plain-text file (up to 10 MiB, with confirmation) or export as Markdown with a date-stamped filename derived from your first line (for example `apikeys-14-11-2026.md`).
- **Practical editor basics:** find with next/previous match, Tab / Shift+Tab indent that preserves undo, copy the full note in one chord, and a quiet mode line that shows only the save state, and a bar of shortcut keys (`^F`, `^O`, `^S`, `^⇧S`) that includes a Save button (`Ctrl+S`).
- **Strictly offline:** no network access, no accounts, no telemetry. Your note lives in `~/.local/share/com.scratch.pad/records.sqlite3`, and native file dialogs run in Rust so the webview never sees filesystem paths.

## Install

Requires Arch Linux with Hyprland on Wayland, Node.js (`npm`), Rust 1.85+, and Tauri 2 system packages (`webkit2gtk-4.1`, `gtk3`).

```bash
git clone https://github.com/nodaysidle/scratch-pad.git
cd scratch-pad
npm ci
./scripts/package_linux.sh --install-binary
```

This installs `~/.local/bin/scratch-pad`, its SVG icon, and a desktop entry so it appears in the Omarchy launcher (`Super + Space`). The previous binary is backed up to `dist/rollback/`. Launching it again focuses the running window instead of opening a duplicate.

> Note: The AppImage target (`--install`) currently fails on Arch inside `linuxdeploy`. Use `--install-binary` for now; see [docs/BUILD-NOTES.md](docs/BUILD-NOTES.md) for details.

## Hyprland setup

Keep the note opaque in Omarchy 4.5 (`~/.config/hypr/hyprland.lua`):

```lua
o.window({ class = "scratch-pad" }, { tag = "-default-opacity", opacity = "1.0 1.0" })
```

Optionally float it as a scratchpad:

```lua
o.window({ class = "scratch-pad" }, { tag = "+floating-window" })
```

## Keyboard shortcuts

| Key | Action |
|---|---|
| `Ctrl+O` | Open a plain-text file (replaces current note after confirmation; `Ctrl+Z` brings the old note back) |
| `Ctrl+S` | Save the note now |
| `Ctrl+Shift+S` | Save note as Markdown |
| `Ctrl+F` | Find in note |
| `Enter` / `Shift+Enter` | Next / previous match while find is open |
| `Ctrl+Shift+C` | Copy entire note when nothing is selected |
| `Tab` / `Shift+Tab` | Indent / outdent current line or selection |
| `Enter` | New line with the same indent; continues `-`, `*`, `+`, `1.` and `- [ ]` lists (Enter on an empty item ends the list) |
| `F6` | Toggle focus between the note and the mode line |
| `Esc` | Close find, cancel confirmation, or dismiss an error banner |

## Theme and font details

Scratch Pad ships no palette of its own. It reads `background`, `foreground`, and `accent` from `~/.config/omarchy/current/theme/colors.toml` (plus optional `mode`, `selection_background`/`selection`, `selection_foreground`, and `red`/`color1`), and derives borders, dim text, and dialogs in `src/style.css`. The accent colour is used only for the caret, focus, and outlines. Without Omarchy, it falls back to system light or dark colours.

Because Omarchy deletes and recreates the theme directory on a switch, `src-tauri/src/platform/omarchy.rs` watches the parent directories and pushes a single `omarchy-changed` event while keeping the last valid palette during the swap.

## Development and docs

```bash
npm run tauri dev      # run with live reload
npm run check          # typecheck, Vitest, rustfmt, clippy, Cargo tests
```

- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for repo layout, test status, and project rules
- [docs/BUILD-NOTES.md](docs/BUILD-NOTES.md) and [docs/BUILD-REPORT.md](docs/BUILD-REPORT.md) for packaging details
- [docs/specs/](docs/specs/) for the original specification packet (`PRD`, `ARD`, `TRD`, `TASKS`)
- [docs/plans/](docs/plans/) for improvement plans
