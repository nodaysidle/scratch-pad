# Plan 010: File dialogs belong to the window, open failures say why, and the tests check what they claim

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. Do NOT edit `docs/plans/README.md`: the reviewer
> maintains the index.
>
> **Drift check (run first)**: `git diff --stat bb5a1a2..HEAD -- src-tauri/`
> must be empty. Otherwise compare the "Current state" excerpts against the
> live code; on a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW-MED (one Tauri API whose trait bounds must compile under the mock runtime)
- **Depends on**: none
- **Category**: bug + tests
- **Planned at**: commit `bb5a1a2`, 2026-11-24

## Why this matters

Scratch Pad's Rust side owns the file dialogs so the webview never names a
path. Four things around that are weak:

1. The open and save dialogs are created without a parent window, so the note
   window stays usable behind them (a second dialog can be opened, the window
   can be closed), and on a tiling compositor a dialog without a parent may be
   tiled instead of floated.
2. A file over 10 MiB, a file that is not UTF-8 and a path that is not a
   regular file all fail with the same "The file could not be opened.", and the
   reason the note store failed to open at startup is thrown away, so nothing
   reaches the journal.
3. The test named `the_webview_cannot_name_a_path` calls two commands that were
   removed, so it passes whatever the code does.
4. The watcher test models a theme switch as "delete the folder and recreate
   it"; the real `omarchy-theme-set` builds `current/next-theme` and renames it
   to `current/theme`.

## Current state

`src-tauri/src/platform/datastore.rs`:

- `pub const MAX_OPEN_BYTES: u64 = 10 * 1024 * 1024;` (line 15).
- `read_text_at` (lines 125-143):

```rust
/// Reads a chosen file as UTF-8 text, refusing anything that is not a regular file of at most 10 MiB.
pub fn read_text_at(path: &Path) -> Result<String, AppError> {
    let canonical = existing_file(path)?;
    let file = std::fs::File::open(&canonical)
        .map_err(|_| AppError::Storage("The file could not be opened.".into()))?;
    let meta =
        file.metadata().map_err(|_| AppError::Storage("The file could not be opened.".into()))?;
    if !meta.is_file() || meta.len() > MAX_OPEN_BYTES {
        return Err(AppError::Invalid("The file could not be opened.".into()));
    }
    let mut bytes = Vec::new();
    Read::take(file, MAX_OPEN_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| AppError::Storage("The file could not be opened.".into()))?;
    if bytes.len() as u64 > MAX_OPEN_BYTES {
        return Err(AppError::Invalid("The file could not be opened.".into()));
    }
    String::from_utf8(bytes).map_err(|_| AppError::Invalid("The file could not be opened.".into()))
}
```

- The two dialog commands (lines 177-210):

```rust
#[tauri::command(async)]
pub fn open_text_file<R: Runtime>(app: AppHandle<R>) -> Result<Option<String>, AppError> {
    let Some(picked) = app.dialog().file().blocking_pick_file() else {
        return Ok(None);
    };
    let path = picked
        .into_path()
        .map_err(|_| AppError::Invalid("The file could not be opened.".into()))?;
    read_text_at(&path).map(Some)
}

#[tauri::command(async)]
pub fn save_markdown_file<R: Runtime>(
    app: AppHandle<R>,
    suggested_name: String,
    content: String,
) -> Result<bool, AppError> {
    // The name is only a suggestion for the dialog: keep its last component so it cannot steer the folder.
    let name = Path::new(&suggested_name)
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_default();
    let Some(picked) = app.dialog().file().set_file_name(name).blocking_save_file() else {
        return Ok(false);
    };
    ...
}
```

- `tauri-plugin-dialog` 2.7.2's `FileDialogBuilder` has
  `pub fn set_parent<W: raw_window_handle::HasWindowHandle + raw_window_handle::HasDisplayHandle>(mut self, parent: &W) -> Self`
  (desktop only). A command can take the calling window as an injected
  argument `window: tauri::WebviewWindow<R>`; it is not part of the JSON the
  frontend sends, so no frontend change is needed.

`src-tauri/src/error.rs`: the only error type, `AppError::{Storage, NotFound, Invalid}(String)`;
the string is shown to the user. Rule of this repo: commands return only
`AppError`; no raw error text crosses to the frontend. Writing the raw cause to
stderr is allowed.

`src-tauri/src/lib.rs` (lines 107-110), where the startup failure is dropped:

```rust
            // The one place the database is opened and migrated.
            if manage_state(app, &folder).is_err() {
                manage_degraded_state(app, &folder);
            }
```

`manage_state` returns `Result<(), AppError>`; `backend::database::open(folder)`
opens `records.sqlite3` inside `folder`.

`src-tauri/src/platform/packaging.rs`: `pub fn verify_runtime_wiring(manifest_dir: &Path) -> Vec<String>`
returns violations as strings. It walks `src/**/*.rs`, uses the private
`extract_tauri_commands(source) -> Vec<String>` (line-based: finds
`#[tauri::command...]` and the following `fn name`) and reports commands missing
from `generate_handler!` as `"Command '{cmd}' is missing from lib.rs generate_handler!"`.

`src-tauri/tests/packaging_tests.rs`:
- the dead test (lines 63-82) `the_webview_cannot_name_a_path` invokes
  `read_text_file` and `write_markdown_export_file`, which no longer exist;
- `runtime_wiring_scans_recursively_for_commands_and_test_doubles` builds a fake
  project in a temp folder and asserts on the violations: use it as the pattern;
- `degraded_state_recovers_when_database_folder_becomes_available` is the
  pattern for store-failure tests (`backend::manage_state`,
  `backend::manage_degraded_state`, `invoke(&webview, "schema_version", json!({}))`).

`src-tauri/tests/datastore_tests.rs` tests `read_text_at` through a local
wrapper `read_text_file(path: String)` and matches `Err(AppError::Invalid(_))`
(lines 74-105 and 159-167).

`src-tauri/src/platform/omarchy.rs` line 20:
`/// Quiet time after the last file event before one event is sent: a theme switch writes many files.`
and the doc of `watch` says `on_change` is called "once per burst of relevant events".

`src-tauri/tests/omarchy_tests.rs` (lines 38-59), the test to complement:

```rust
#[test]
fn a_theme_switch_that_recreates_the_theme_folder_sends_one_event() {
    let root = tempfile::tempdir().unwrap();
    let current = root.path().join("omarchy/current");
    let theme = current.join("theme");
    std::fs::create_dir_all(&theme).unwrap();
    std::fs::write(theme.join("colors.toml"), "background = \"#000000\"\n").unwrap();
    let (_watcher, rx) =
        watching(plan(Some(theme.join("colors.toml")), Some(root.path().join("config"))));

    // What Omarchy does on a switch: delete the folder, then bring a new one back.
    std::fs::remove_dir_all(&theme).unwrap();
    std::fs::create_dir_all(&theme).unwrap();
    std::fs::write(theme.join("colors.toml"), "background = \"#ffffff\"\n").unwrap();

    rx.recv_timeout(WAIT).expect("a change event");
    assert!(rx.recv_timeout(Duration::from_millis(600)).is_err(), "the burst is one event");
    ...
```

Conventions: rustfmt with the repo's `src-tauri/rustfmt.toml`; clippy with
`-D warnings`; doc comments are plain sentences; user-facing strings are short
sentences ending in a period.

## Commands you will need

Run from the repo (worktree) root. To avoid a full rebuild in a fresh
worktree, first run
`export CARGO_TARGET_DIR=/home/arch/dev/nodaysidle/scratch-pad/src-tauri/target`
in every shell that runs cargo.

| Purpose | Command | Expected on success |
|---|---|---|
| Install (fresh worktree only; the Tauri build embeds the frontend) | `npm ci && npx vite build` | exit 0 |
| Format check | `cargo fmt --manifest-path src-tauri/Cargo.toml --check` | exit 0 |
| Lint | `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | exit 0 |
| Tests | `cargo test --manifest-path src-tauri/Cargo.toml` | all pass |

If `cargo` reports that the frontend dist folder is missing, check
`build.frontendDist` in `src-tauri/tauri.conf.json` and make sure the Vite
build output is there; that is setup, not a deviation.

## Scope

**In scope**:
- `src-tauri/src/platform/datastore.rs`
- `src-tauri/src/platform/packaging.rs`
- `src-tauri/src/platform/omarchy.rs` (comments only)
- `src-tauri/src/lib.rs` (the `manage_state` failure branch only)
- `src-tauri/tests/datastore_tests.rs`
- `src-tauri/tests/packaging_tests.rs`
- `src-tauri/tests/omarchy_tests.rs`

**Out of scope**:
- `src-tauri/src/database.rs` (migrations are append-only), `error.rs`,
  `capabilities/default.json`, `tauri.conf.json`, `Cargo.toml` (no new
  dependency is needed), `src-tauri/gen/`.
- Everything under `src/` and `tests/`: the frontend is changed by other plans
  in parallel (plan 011 makes it show these messages).
- `src-tauri/src/platform/permissioncoordinator.rs`.

## Git workflow

- Branch: `advisor/010-backend-hardening` (from the current HEAD).
- Commit message style: `fix: attach the file dialogs to the note window`.
- Do NOT push.

## Steps

### Step 1: Parent the dialogs

Add `window: tauri::WebviewWindow<R>` as a parameter to `open_text_file` and
`save_markdown_file` and call `.set_parent(&window)` on the file dialog builder
before `blocking_pick_file()` / `blocking_save_file()`. Update the doc comments
(the dialog belongs to the note window, so the note cannot be used behind it).

**Verify**: `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` → exit 0.

### Step 2: A name that cannot steer the folder, as a tested function

Extract the name cleanup from `save_markdown_file` into
`pub fn suggested_file_name(suggested: &str) -> String` in `datastore.rs`
(same behaviour: last path component, empty string when there is none) and
call it from the command.

**Verify**: `cargo test --manifest-path src-tauri/Cargo.toml --test datastore_tests` → pass.

### Step 3: Distinct reasons for a refused file

In `read_text_at`, keep the error kinds, change the messages:
- longer than `MAX_OPEN_BYTES` (both checks): `"The file is larger than 10 MiB."`
- not valid UTF-8: `"The file is not UTF-8 text."`
- everything else keeps `"The file could not be opened."`.

Use module constants like the existing `SAVE_FAILED` / `LOAD_FAILED`.

**Verify**: `cargo test --manifest-path src-tauri/Cargo.toml --test datastore_tests` → pass
(existing tests match on the kind only, so they should still pass).

### Step 4: Say why the store is unavailable

In `src-tauri/src/lib.rs`, turn the branch into
`if let Err(err) = manage_state(app, &folder) { eprintln!("scratch-pad: the note store is unavailable: {err}"); manage_degraded_state(app, &folder); }`.
In `src-tauri/src/database.rs` nothing changes. If you find that the `AppError`
there hides the underlying rusqlite/io error, do not widen the change: the
message alone is enough for this plan.

**Verify**: clippy command → exit 0.

### Step 5: A wiring check that really forbids path arguments

In `packaging.rs`:
1. Add a function that, for a Rust source text, returns each Tauri command's
   name together with the text of its parameter list (from the `(` after the
   function name to its matching `)`, which may span several lines). Make it
   `pub` so it can be tested.
2. In `verify_runtime_wiring`, for every command add the violation
   `"Command '{cmd}' takes a path from the webview"` when a parameter's type
   mentions `Path` (this covers `PathBuf` and `&Path`) or a parameter is named
   `path` or ends in `_path`.

In `packaging_tests.rs`:
3. Delete the test `the_webview_cannot_name_a_path`.
4. Extend the fake project in
   `runtime_wiring_scans_recursively_for_commands_and_test_doubles` (or add a
   sibling test built the same way) with a registered command
   `pub fn path_cmd(path: String) {}` and one with a multi-line signature
   taking `target: std::path::PathBuf`; assert both are reported with
   "takes a path", and that a command taking `suggested_name: String, content: String`
   is not.

`runtime_wiring_has_no_violations` (already present) then proves the real
commands take no path.

**Verify**: `cargo test --manifest-path src-tauri/Cargo.toml --test packaging_tests` → pass.

### Step 6: Remaining tests

See "Test plan". Also update the two comments in `omarchy.rs` so they say the
callback runs at least once per burst of changes (a switch that pauses longer
than the quiet time sends more than one event; each carries the state at that
moment).

**Verify**: all three commands in the table → exit 0.

## Test plan

`src-tauri/tests/datastore_tests.rs`:
1. `suggested_file_name`: `"notes.md"` → `"notes.md"`, `"../x.md"` → `"x.md"`,
   `"/etc/passwd"` → `"passwd"`, `".."` → `""`, `""` → `""`.
2. Messages: an oversized file gives `AppError::Invalid` with
   `"The file is larger than 10 MiB."`; invalid UTF-8 gives
   `"The file is not UTF-8 text."`; a missing file keeps
   `"The file could not be opened."`. (`AppError` implements `PartialEq`.)

`src-tauri/tests/packaging_tests.rs`:
3. The "takes a path" cases from Step 5.
4. A corrupt store: write a few garbage bytes to `records.sqlite3` in a temp
   folder; `backend::manage_state(&app, folder)` returns `Err`; then
   `backend::manage_degraded_state(&app, folder)`, build the webview, and
   `invoke(&webview, "schema_version", json!({}))` returns `Err` without a
   panic. (If `manage_state` returns `Ok` for garbage bytes, see STOP conditions.)

`src-tauri/tests/omarchy_tests.rs`:
5. The real switch: create `current/theme/colors.toml`, start watching, create
   `current/next-theme/colors.toml`, `remove_dir_all(theme)`,
   `rename(next-theme, theme)`. Drain events until none arrives for 600 ms and
   assert at least one arrived. Then write `theme/colors.toml` again and assert
   an event arrives (the renamed folder is watched). Do not assert an exact
   event count.
6. In the existing recreate test, rename it and relax the wording if needed so
   it does not claim more than it checks; keep its assertions.

## Done criteria

- [ ] `cargo fmt --manifest-path src-tauri/Cargo.toml --check` exits 0
- [ ] `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` exits 0
- [ ] `cargo test --manifest-path src-tauri/Cargo.toml` exits 0
- [ ] `grep -n "set_parent" src-tauri/src/platform/datastore.rs` shows two matches
- [ ] `grep -rn "read_text_file\|write_markdown_export_file" src-tauri/tests/packaging_tests.rs` returns nothing
- [ ] `grep -n "takes a path" src-tauri/src/platform/packaging.rs` returns a match
- [ ] `git diff --name-only bb5a1a2..HEAD -- . ':!docs'` lists only in-scope files

## STOP conditions

- `set_parent(&window)` does not compile for the generic `R: Runtime` after one
  reasonable attempt (for example a missing trait bound): report the compiler
  error; do not add dependencies or `cfg` gates on your own.
- `manage_state` succeeds on a `records.sqlite3` full of garbage bytes: report
  it (that would be a real startup bug) and leave test 4 out.
- The new watcher test fails because no event arrives after the rename: report
  it with the output; that is a product bug, not a test problem. Do not weaken
  the assertion.
- Any step needs a file outside the scope list.
- A verification fails twice after a reasonable fix attempt.

## Maintenance notes

- NOT verified in a real window: that the parented dialog floats above the note
  on Hyprland and blocks it. Check once in the installed app (Ctrl+O, then try
  to type in the note).
- New commands are now checked for path-like parameters by name and type text;
  a path smuggled in a struct field would not be caught.
- Still open and not part of this plan: on Wayland a second launch calls
  `set_focus()` without an activation token (`platform/lifecyclecoordinator.rs`),
  so Hyprland may only mark the window urgent. Needs one real double launch.
