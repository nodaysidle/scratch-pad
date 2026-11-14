# Scratch Pad

One always-available note for Linux, saved as you type. A Tauri 2 desktop app
(Rust backend, TypeScript DOM frontend, SQLite storage) built for Arch Linux
with Omarchy (Hyprland on Wayland).

- The note is saved one second after you stop typing, and again when the window closes.
- **Open text file** replaces the note with a plain-text file, after a confirmation.
- **Save as Markdown** exports the note as a `.md` file.
- Nothing leaves the device. There is no network access.

The note lives in `~/.local/share/com.scratch.pad/records.sqlite3`.

## Develop

Requirements: Node.js with npm, a Rust toolchain (1.85 or newer), and the Tauri 2
Linux system packages (`webkit2gtk-4.1`, `gtk3`).

```sh
npm ci                 # install the pinned JavaScript dependencies
npm run tauri dev      # run the app with live reload
npm run check          # typecheck, frontend tests, rustfmt, clippy, Rust tests
```

`npm test` runs only the frontend tests; `npm run check` runs everything and is
the gate before any commit.

## Build and install

```sh
./scripts/package_linux.sh --install-binary
```

This builds the release binary and installs it for the current user:

- `~/.local/bin/scratch-pad`, with the previous binary kept in `dist/rollback/`;
- the icon `~/.local/share/icons/hicolor/scalable/apps/scratch-pad.svg`;
- the launcher entry `~/.local/share/applications/scratch-pad.desktop`.

The binary, the entry, the icon and the window class are all named
`scratch-pad`, so the app appears in the Omarchy launcher (`Super + Space`)
with its icon. Use `scratch-pad` as the class in Hyprland window rules.

The app can also be packaged as an AppImage:

```sh
./scripts/package_linux.sh            # builds dist/scratch-pad.AppImage
./scripts/package_linux.sh --install  # also installs the AppImage under ~/.local
```

On current Arch Linux that build fails inside the `linuxdeploy` tool Tauri
downloads into `~/.cache/tauri`. `BUILD-NOTES.md`, entries 2 and 3, describes
the two local fixes it needs.

## Keyboard

| Key | Action |
|---|---|
| `Ctrl+O` | Open text file (replaces the note after a confirmation) |
| `Ctrl+S` | Save as Markdown |
| `Esc` | Cancel the confirmation |

The note has focus at launch. Closing is left to the window manager
(`SUPER+W` on Omarchy).

## Design

Scratch Pad is styled as an Omarchy/Hyprland app, like a terminal: it fills
whatever tile it is given and draws no chrome of its own.

- No header and no window decorations (`decorations: false`); Hyprland draws the
  border, rounding and shadow.
- One font: the system `monospace` family at 13px, so it follows the Omarchy font setting.
- Every colour derives from three CSS variables in `src/style.css`: `--bg`, `--fg`
  and `--accent`. The accent is used for the caret, focus and outlines only,
  never as a fill behind text.
- Controls are 28px high with a 1px border and square corners. No animations.
- Minimum window size is 360x200; the layout must work at that size.

These rules replace the look described in `kit/README.md` ("system font",
"no task edits src/style.css"), which applied to the original build only.

To float it as a scratchpad, add a rule to `~/.config/hypr/hyprland.lua` once
you know the window class (`hyprctl clients` while the app runs):

    o.window("^(scratch-pad|com\\.scratch\\.pad)$", { tag = "+floating-window" })

## Theme

Scratch Pad has no colours of its own. It reads the active Omarchy theme from
`~/.config/omarchy/current/theme/colors.toml` and checks it once a second, so
switching the Omarchy theme recolours an open window without a restart.

- Only three keys are required, because they are the only ones every theme
  defines: `background`, `foreground` and `accent`. Borders, dim text, the
  dialog surface and the selection are mixed from them in `src/style.css`.
- Used when present: `mode`, `selection_background` (or `selection`) together
  with `selection_foreground`, and `red` (or `color1`) for error text.
- Without an Omarchy theme the app uses the system light or dark colours.

The Rust side is `src-tauri/src/platform/theme.rs` (one command, a fixed path,
an allowlist of keys); the frontend side is `src/theme.ts`.

## Layout

| Path | What it holds |
|---|---|
| `src/` | TypeScript frontend: `main.ts` wires the features in `src/features/` |
| `src-tauri/src/` | Rust commands, SQLite migrations, file access |
| `tests/`, `src-tauri/tests/` | Vitest and cargo tests |
| `scripts/package_linux.sh` | Build and install (binary or AppImage) |
| `PRD.md`, `ARD.md`, `TRD.md`, `TASKS.md`, `AGENTS.md` | The specification the app was built from |
| `kit/` | Frozen snapshot of the starter files the build began with. Not part of the app; do not edit. `kit/README.md` holds the original build-time rules. |
| `plans/` | Improvement plans and their status |

## Rules that still hold

- Versions are exact (`=` in `Cargo.toml`, no `^` in `package.json`) because they
  were tested together. Change one only on purpose, never by a broad update.
- Database migrations in `src-tauri/src/database.rs` are append-only.
- Every Rust command returns `Result<T, AppError>`; no raw error text reaches the frontend.
- The content security policy is `style-src 'self'`: no `style` attributes and no
  `<style>` elements. Set single properties (`element.style.gap = "8px"`) or use
  classes from `src/style.css`.
- User-visible strings (button labels, messages) come from `PRD.md`. Change the
  PRD when you change one.
