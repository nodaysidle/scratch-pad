# scratch-pad

One always-available note for Arch Linux and Hyprland, saved as you type. A native Tauri 2 app that follows the active Omarchy theme and the terminal's font, and draws no chrome of its own.

## Features
- **One note, always there**: opens with the cursor in the note. It is saved after 5 seconds of idle, when the window loses focus and when it closes. If the closing save fails, the window stays open and asks.
- **Open text file**: replaces the note with a plain-text file (up to 10 MiB, UTF-8), after a confirmation.
- **Save as Markdown**: exports the note as a `.md` file. The suggested name is the note's first line and the date, for example `apikeys-14-11-2026.md`.
- **Omarchy native**: recolours live when you switch the Omarchy theme and renders at the same pixel size as your terminal (Ghostty, Alacritty, kitty or foot). A file watcher pushes the change; nothing polls.
- **Tiling first**: no header, no decorations, 360x200 minimum. Hyprland draws the border, rounding and shadow.
- **Editor basics**: find with next and previous match, Tab and Shift+Tab indent that keeps undo, copy the whole note, and a mode line with save state and cursor position.

## Privacy
Stays on your machine. No network access, no account, no telemetry. The note lives in `~/.local/share/com.scratch.pad/records.sqlite3`. The webview never receives a file path: the open and save dialogs run in the Rust backend, which has no other file access.

## Tested on
| Desktop | State |
|---|---|
| Hyprland (Arch, Omarchy) | Verified in the installed app: autosave and restore, live theme switch, open and save as Markdown, Tab then undo |
| Second launch focusing the running window | Not verified in a real window |
| Other desktops | Untested |

## Requirements
- Arch Linux with Hyprland on Wayland (Omarchy recommended)
- Node.js with npm, Rust 1.85 or newer, and the Tauri 2 system packages (`webkit2gtk-4.1`, `gtk3`)

## Install
```bash
git clone https://github.com/nodaysidle/scratch-pad && cd scratch-pad
npm ci
./scripts/package_linux.sh --install-binary
```
This installs `~/.local/bin/scratch-pad`, its icon and a launcher entry, all named `scratch-pad`, so it appears in the Omarchy launcher (`Super + Space`). The previous binary is kept in `dist/rollback/`. Launching it again focuses the running window instead of opening a second one.

The AppImage (`./scripts/package_linux.sh --install`) fails on current Arch inside the `linuxdeploy` tool Tauri downloads; `BUILD-NOTES.md` entries 2 and 3 describe the two local fixes it needs. Use `--install-binary` until then.

## Keyboard
| Key | Action |
|---|---|
| `Ctrl+O` | Open text file (replaces the note after a confirmation) |
| `Ctrl+S` | Save as Markdown |
| `Ctrl+F` | Find in the note |
| `Ctrl+Shift+C` | Copy the entire note when nothing is selected |
| `Tab` / `Shift+Tab` | Indent / outdent the current line or selected lines |
| `F6` | Toggle focus between the note and the mode line |
| `Enter` / `Shift+Enter` | Next / previous match while the find field is shown |
| `Esc` | Close find, cancel a confirmation, or dismiss an error banner |

Closing is left to the window manager (`SUPER+W` on Omarchy).

## Hyprland setup
Keep the note opaque (Omarchy 4.5, `~/.config/hypr/hyprland.lua`):
```lua
o.window({ class = "scratch-pad" }, { tag = "-default-opacity", opacity = "1.0 1.0" })
```
Optionally float it as a scratchpad as well:
```lua
o.window({ class = "scratch-pad" }, { tag = "+floating-window" })
```

## Theme and font
Scratch Pad has no colours of its own. It reads `~/.config/omarchy/current/theme/colors.toml`.
- Required keys: `background`, `foreground` and `accent`, the only three every Omarchy theme defines. Borders, dim text, dialogs and selection are mixed from them in `src/style.css`.
- Used when present: `mode`, `selection_background` (or `selection`) with `selection_foreground`, and `red` (or `color1`) for error text.
- The accent is used for the caret, focus and outlines only, never as a fill behind text.
- Without an Omarchy theme the app uses the system light or dark colours.
- The font is the system `monospace` family, which Omarchy keeps equal to the terminal's. The size is read from the default terminal's config; without one the note uses 13px.

Omarchy deletes and recreates the theme folder on a switch, so the watcher in `src-tauri/src/platform/omarchy.rs` watches the parent folders and sends one `omarchy-changed` event that `src/omarchy.ts` applies. The app keeps the last good colours while the file is missing.

## Develop
```bash
npm run tauri dev      # run with live reload
npm run check          # typecheck, frontend tests, rustfmt, clippy, Rust tests
```
`npm run check` is the gate before any commit.

| Path | What it holds |
|---|---|
| `src/` | TypeScript frontend: `main.ts` wires the features in `src/features/` |
| `src-tauri/src/` | Rust commands, SQLite migrations, dialogs and file access, the theme and font watcher |
| `tests/`, `src-tauri/tests/` | Vitest and cargo tests |
| `scripts/package_linux.sh` | Build and install (binary or AppImage) |
| `PRD.md`, `ARD.md`, `TRD.md`, `TASKS.md`, `AGENTS.md` | The specification the app was built from |
| `kit/` | Frozen snapshot of the starter files the build began with. Not part of the app; do not edit. |
| `plans/` | Improvement plans and their status |

## Rules that still hold
- Versions are exact (`=` in `Cargo.toml`, no `^` in `package.json`) because they were tested together. Change one only on purpose.
- Database migrations in `src-tauri/src/database.rs` are append-only.
- Every Rust command returns `Result<T, AppError>`; no raw error text reaches the frontend.
- The content security policy is `style-src 'self'`: no `style` attributes and no `<style>` elements. Set single properties (`element.style.gap = "8px"`) or use classes from `src/style.css`.
- User-visible strings come from `PRD.md`. Change the PRD when you change one.
