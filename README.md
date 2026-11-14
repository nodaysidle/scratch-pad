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
./scripts/package_linux.sh            # builds dist/scratch-pad.AppImage
./scripts/package_linux.sh --install  # also installs it under ~/.local with a desktop entry
```

The AppImage build needs two local fixes to the tools Tauri downloads into
`~/.cache/tauri`; without them it fails on current Arch Linux. They are
described in `BUILD-NOTES.md`, entries 2 and 3. If that cache is cleared, apply
them again.

## Layout

| Path | What it holds |
|---|---|
| `src/` | TypeScript frontend: `main.ts` wires the features in `src/features/` |
| `src-tauri/src/` | Rust commands, SQLite migrations, file access |
| `tests/`, `src-tauri/tests/` | Vitest and cargo tests |
| `scripts/package_linux.sh` | AppImage build and install |
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
