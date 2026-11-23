# Development

## Commands

```bash
npm run tauri dev      # run with live reload
npm run check          # typecheck, frontend tests, rustfmt, clippy, Rust tests
```

`npm run check` is the gate before any commit.

## Repository layout

| Path | What it holds |
|---|---|
| `src/` | TypeScript frontend (`main.ts` wires the features in `src/features/`) |
| `src-tauri/src/` | Rust commands, SQLite migrations, native dialogs, file access, theme and font watcher |
| `tests/`, `src-tauri/tests/` | Vitest and Cargo test suites |
| `scripts/package_linux.sh` | Build and install script (binary or AppImage) |
| `docs/specs/` | Specification packet (`PRD.md`, `ARD.md`, `TRD.md`, `TASKS.md`, `blueprint.json`) |
| `docs/plans/` | Improvement plans and their status |
| `docs/kit/` | Frozen snapshot of the starter files the build began with (do not edit) |
| `docs/BUILD-NOTES.md`, `docs/BUILD-REPORT.md` | Packaging notes and build record |

## Tested on

| Target | State |
|---|---|
| Hyprland (Arch, Omarchy) | Verified in the installed app: autosave and restore, live theme switch, open and save as Markdown, Tab then undo |
| Second launch focusing the running window | Not verified in a real window |
| Other desktops | Untested |

## Rules that hold

- Dependency versions are exact (`=` in `Cargo.toml`, no `^` in `package.json`) because they were tested together. Change one only on purpose.
- Database migrations in `src-tauri/src/database.rs` are append-only.
- Every Rust command returns `Result<T, AppError>`. Raw error text never reaches the frontend.
- Content Security Policy uses `style-src 'self'`: no `style` attributes and no `<style>` elements. Set single properties (`element.style.gap = "8px"`) or use classes from `src/style.css`.
- User-visible strings come from `docs/specs/PRD.md`. Update the PRD when you change one.
