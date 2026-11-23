# Plan 004: Scratch Pad wears the active Omarchy theme and recolours live when the theme changes

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: this plan is applied on top of plan 003.
> Confirm it is present before starting:
> `grep -c -- "--accent: AccentColor" src/style.css && test -f src/shortcuts.ts`
> → prints `1` and exits 0. If not, STOP: the dependency is missing.
> Then compare the "Current state" excerpts below against the live code; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (reads one file the user did not pick in a dialog; must never break the app when that file is absent or odd)
- **Depends on**: plans/003-tiling-native-redesign.md (which includes 001 and 002)
- **Category**: direction
- **Planned at**: commit `c1e1b39`, 2026-11-14

## Why this matters

Omarchy (the Arch Linux desktop this app targets) has a system-wide theme. The
owner has 61 themes installed and switches between them; terminals, the bar and
the launcher all recolour on a switch. Scratch Pad must do the same: it has no
colours of its own, it shows the active theme's colours, and when the theme is
switched while the app is open the window recolours by itself within about a
second, without a restart. It must work for every theme, including ones not yet
installed, and fall back to plain system colours where Omarchy is absent.

## How Omarchy themes work (facts this plan is built on)

- The active theme's palette is the file
  `$HOME/.config/omarchy/current/theme/colors.toml`
  (`~/.config/omarchy/current` is a symlink into `~/.local/state/omarchy/`).
- On a theme switch Omarchy **deletes the `theme` directory and moves a new one
  into place**. For a moment the file does not exist. A file watch on it would
  die, so this plan polls instead, and keeps the last good colours when a read fails.
- The file is flat `key = "value"` lines with `#` comments. Keys may be padded
  with spaces before `=`. Colour values are always `"#rrggbb"` (upper or lower
  case hex). Real examples:

  ```toml
  # a thin theme (quattro-glass): no mode, aligned keys, long comment blocks
  accent               = "#FFFFFF"
  foreground           = "#E0E0E0"
  background           = "#0A0A0A"
  selection_foreground = "#0A0A0A"
  selection_background = "#C8C8C8"
  color1 = "#F2798F"
  ```

  ```toml
  # a full theme
  mode = "dark"
  accent = "#cc0000"
  selection = "#1a1a1a"
  selection_background = "#1a1a1a"
  selection_foreground = "#ffffff"
  background = "#000000"
  foreground = "#e0e0e0"
  red = "#cc0000"
  hyprland_active_border = "rgb(cc0000) rgb(800000) 45deg"
  ```

- Across all 61 installed themes **only three keys are always present:
  `background`, `foreground`, `accent`.** Everything else is missing somewhere
  (`mode`, `red`, `selection*`, `muted`, `color0`..`color15`, ...). 13 themes are light.
- Therefore: the app takes those three, and the stylesheet from plan 003 mixes
  every other colour from them. Optional keys refine the result when present.

## Design decisions (already made — do not revisit)

- **One Rust command, no plugin.** `theme_palette` reads that one fixed path and
  returns a map containing only allowlisted keys with validated values. No
  `tauri-plugin-fs`, no new capability, no new crate, no TOML parser dependency
  (the format is simple enough for a line parser).
- **Allowlist**: `background`, `foreground`, `accent`, `selection`,
  `selection_background`, `selection_foreground`, `red`, `color1`, `mode`.
  Colour values must match `#` + exactly six hex digits. `mode` must be `light`
  or `dark`. Anything else is dropped. This is what makes it safe to put the
  values into CSS.
- **Never an error.** A missing, unreadable or oversized file yields an empty
  map. The frontend treats a map without all three required keys as "no theme
  right now" and changes nothing.
- **Polling.** The frontend asks once at start and then every 1000 ms, and
  touches the DOM only when the answer changed.
- **Applying.** Colours are set as CSS custom properties on `<html>` with
  `style.setProperty` (allowed by the `style-src 'self'` content security
  policy; `style` attributes and `<style>` elements are not).
- **Light or dark** comes from `mode`; when `mode` is missing, a background whose
  red+green+blue sum is above 382 is light (the rule Omarchy itself uses).
- **Selection colours** from the theme are used only when both a selection
  background (`selection_background`, else `selection`) and
  `selection_foreground` are present; otherwise the stylesheet's derived
  selection stays. This avoids unreadable selected text.

## Current state

### `src/style.css` (written by plan 003) — the root block

```css
:root {
  color-scheme: light dark;
  --bg: Canvas;
  --fg: CanvasText;
  --accent: AccentColor;
  --danger: #b3261e;
  --bg-raised: color-mix(in srgb, var(--bg) 92%, var(--fg));
  --fg-dim: color-mix(in srgb, var(--fg) 65%, var(--bg));
  --line: color-mix(in srgb, var(--fg) 25%, var(--bg));
  --sel-bg: color-mix(in srgb, var(--accent) 35%, var(--bg));
  --sel-fg: var(--fg);
  font: 13px/1.5 monospace;
}
```

This plan does not edit the stylesheet. It overrides `--bg`, `--fg`, `--accent`,
and optionally `--sel-bg`, `--sel-fg`, `--danger` and `color-scheme`, on the
root element at runtime.

### `src/api.ts` — how the frontend calls Rust

```ts
export const call = <T>(command: string, args?: Record<string, unknown>): Promise<T> => invoke<T>(command, args)
```

### `src/main.ts` — composition root

It imports `call` from `./api` and creates each feature by passing dependencies
in, for example timers:

```ts
  timers: {
    set: (fn, ms) => window.setTimeout(fn, ms),
    clear: id => window.clearTimeout(id),
  },
```

Features never touch `window` timers directly, so tests can pass fakes. Follow
the same pattern.

### `src-tauri/src/lib.rs` — command registration (lines 46-57)

```rust
pub fn app_builder<R: Runtime>(builder: tauri::Builder<R>) -> tauri::Builder<R> {
    let builder = builder.plugin(tauri_plugin_dialog::init());
    builder.invoke_handler(tauri::generate_handler![
        schema_version,
        platform::datastore::create_note,
        platform::datastore::list_note,
        platform::datastore::get_note,
        platform::datastore::update_note,
        platform::datastore::read_text_file,
        platform::datastore::write_markdown_export_file,
    ])
}
```

### `src-tauri/src/platform/mod.rs` (whole file)

```rust
// Platform owners are added by TASKS.md. Each owner declares its module here.
pub mod datastore;
pub mod lifecyclecoordinator;
pub mod packaging;
pub mod permissioncoordinator;
```

### `src-tauri/src/platform/packaging.rs` (lines 19-27) — a list that must name every command

```rust
    let commands = [
        "schema_version",
        "create_note",
        "list_note",
        "get_note",
        "update_note",
        "read_text_file",
        "write_markdown_export_file",
    ];
```

### `src-tauri/src/error.rs` — the only error type commands may return

```rust
pub enum AppError {
    Storage(String),
    NotFound(String),
    Invalid(String),
}
```

### Conventions to match

- Rust: every command returns `Result<T, AppError>`. `rustfmt.toml` sets
  `use_small_heuristics = "Max"`; run `cargo fmt`. Clippy runs with `-D warnings`.
- Rust tests are integration tests in `src-tauri/tests/<owner>_tests.rs` that
  import the library as `scratch_pad_lib`; see
  `src-tauri/tests/permissioncoordinator_tests.rs` (uses `tempfile::tempdir()`).
  `tempfile` is already a dev-dependency.
- Commands need no entry in `src-tauri/capabilities/default.json`; the app's own
  commands are allowed once registered in `generate_handler!`.
- TypeScript: no semicolons, double quotes, two-space indent, arrow functions, no `any`.
- Design docs: `ARD.md` says the app reads only files the user picks in a dialog.
  Step 6 records the one exception this plan introduces.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install JS deps (fresh checkout only) | `npm ci` | exit 0 |
| Typecheck | `npm run typecheck` | exit 0 |
| Frontend tests | `npm test` | all pass |
| Format Rust | `cargo fmt --manifest-path src-tauri/Cargo.toml` | exit 0 |
| One Rust test file | `cargo test --manifest-path src-tauri/Cargo.toml --test theme_tests` | all pass |
| Everything | `npm run check` | exit 0 |

The first cargo command in a fresh checkout compiles all dependencies (several
minutes). Do NOT launch the app and do NOT run any `omarchy-*` command (in
particular never `omarchy-theme-set`: it changes the owner's whole desktop).

## Scope

**In scope** (the only files you should modify):
- `src-tauri/src/platform/theme.rs` (create)
- `src-tauri/src/platform/mod.rs` (one line)
- `src-tauri/src/platform/packaging.rs` (one list entry)
- `src-tauri/src/lib.rs` (one list entry)
- `src-tauri/tests/theme_tests.rs` (create)
- `src/theme.ts` (create)
- `src/main.ts` (wire it)
- `tests/theme.test.ts` (create)
- `ARD.md`, `README.md` (the edits in step 6 only)

**Out of scope** (do NOT touch):
- `src/style.css` — the token names are the contract; do not add theme colours there.
- `src-tauri/Cargo.toml`, `Cargo.lock`, `package.json`, `package-lock.json` — no new dependencies.
- `src-tauri/capabilities/default.json`, `src-tauri/tauri.conf.json`.
- `kit/`.
- Anything under `~/.config/omarchy` or `/usr/share/omarchy`: read-only, and only from tests.
- No file watcher, no Omarchy hook or template installation, no window
  transparency, no reading of other theme files (`gtk.css`, `hyprland.lua`, fonts).

## Git workflow

- Branch: `advisor/004-follow-omarchy-theme`.
- One commit per step, message style `feat: <what>` / `docs: <what>`.
- Do NOT push or open a PR.

## Steps

### Step 1: The palette reader in Rust

Create `src-tauri/src/platform/theme.rs`:

```rust
//! The active Omarchy theme's palette. Read-only, one fixed file, and only allowlisted keys with
//! validated values leave this module, so the frontend can put them straight into CSS.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use crate::error::AppError;

const COLOR_KEYS: &[&str] = &[
    "background",
    "foreground",
    "accent",
    "selection",
    "selection_background",
    "selection_foreground",
    "red",
    "color1",
];
// A real colors.toml is a few kilobytes; anything far larger is not a palette.
const MAX_BYTES: u64 = 256 * 1024;

fn is_hex_color(value: &str) -> bool {
    value.len() == 7
        && value.starts_with('#')
        && value[1..].chars().all(|character| character.is_ascii_hexdigit())
}

/// Parses `key = "value"` lines. Unknown keys and values that are not `#rrggbb`
/// (or `light`/`dark` for `mode`) are dropped.
pub fn parse_palette(text: &str) -> BTreeMap<String, String> {
    let mut palette = BTreeMap::new();
    for line in text.lines() {
        let Some((key, rest)) = line.split_once('=') else { continue };
        let key = key.trim();
        let Some(value) = rest.trim().strip_prefix('"').and_then(|quoted| quoted.split('"').next())
        else {
            continue;
        };
        let valid = if key == "mode" {
            value == "light" || value == "dark"
        } else {
            COLOR_KEYS.contains(&key) && is_hex_color(value)
        };
        if valid {
            palette.insert(key.to_string(), value.to_string());
        }
    }
    palette
}

/// The palette in `path`, or an empty map when the file is missing, unreadable or too large.
/// Omarchy removes and recreates the theme folder on every switch, so a missing file is normal.
pub fn read_palette(path: &Path) -> BTreeMap<String, String> {
    match std::fs::metadata(path) {
        Ok(metadata) if metadata.is_file() && metadata.len() <= MAX_BYTES => {}
        _ => return BTreeMap::new(),
    }
    std::fs::read_to_string(path).map(|text| parse_palette(&text)).unwrap_or_default()
}

/// Where Omarchy keeps the active theme's palette.
pub fn active_palette_path() -> Option<PathBuf> {
    let home = std::env::var_os("HOME")?;
    Some(Path::new(&home).join(".config/omarchy/current/theme/colors.toml"))
}

/// The active theme's colours; empty when there is no Omarchy theme. Never fails.
#[tauri::command(async)]
pub fn theme_palette() -> Result<BTreeMap<String, String>, AppError> {
    Ok(active_palette_path().map(|path| read_palette(&path)).unwrap_or_default())
}
```

`#[tauri::command(async)]` runs the command off the UI thread; it is polled once
a second. A commented line such as `# accent = "#fff"` is dropped because its
key is `# accent`, which is not in the allowlist.

Register it:

- `src-tauri/src/platform/mod.rs`: add `pub mod theme;` as the last line.
- `src-tauri/src/lib.rs`: add `platform::theme::theme_palette,` as the last
  entry of `generate_handler![...]`.
- `src-tauri/src/platform/packaging.rs`: add `"theme_palette",` as the last
  entry of the `commands` array.

Run `cargo fmt --manifest-path src-tauri/Cargo.toml`.

**Verify**: `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` → exit 0.

**Verify**: `cargo test --manifest-path src-tauri/Cargo.toml` → all existing tests pass.

### Step 2: Rust tests, including every installed theme

Create `src-tauri/tests/theme_tests.rs` with these tests
(`use scratch_pad_lib::platform::theme::{parse_palette, read_palette};`):

1. **`parses_a_full_palette`** — parse the "full theme" example from this plan's
   "How Omarchy themes work" section. Assert `background` is `#000000`,
   `foreground` is `#e0e0e0`, `accent` is `#cc0000`, `mode` is `dark`,
   `selection_foreground` is `#ffffff`, `red` is `#cc0000`, and that the map has
   no key `hyprland_active_border`.
2. **`parses_a_thin_palette_with_padded_keys_and_comments`** — parse the "thin
   theme" example (keep the leading `#` comment line and the padded `=`).
   Assert `accent` is `#FFFFFF`, `background` is `#0A0A0A`, `color1` is
   `#F2798F`, and the map has no `mode` and no `red`.
3. **`drops_values_that_are_not_plain_hex_colors`** — parse a text with one line
   each of: `background = "red"`, `foreground = "#12345"`, `accent = "#12345g"`,
   `red = "#000000; background: url(x)"`, `selection = "rgb(1, 2, 3)"`,
   `mode = "sepia"`, `accent = #cc0000` (no quotes), `# foreground = "#ffffff"`.
   Assert the resulting map is empty.
4. **`a_missing_or_oversized_file_is_an_empty_palette`** — with
   `tempfile::tempdir()`: `read_palette` of a path that does not exist is
   empty; of the directory itself is empty; of a file holding 300 000 bytes of
   `#` characters followed by `\nbackground = "#000000"\n` is empty; of a file
   holding `background = "#101010"\n` has `background` equal to `#101010`.
5. **`every_installed_omarchy_theme_has_the_three_required_colors`** — for each of
   the two folders `/usr/share/omarchy/themes` and
   `$HOME/.config/omarchy/themes` (skip a folder that does not exist, skip the
   second when `HOME` is unset): for every entry, if `<entry>/colors.toml` is a
   file (`Path::is_file` follows symlinks, which matters here), call
   `read_palette` on it and assert the map contains `background`, `foreground`
   and `accent`; collect the names of themes that fail and assert the list is
   empty with a message that prints it. Count the themes checked and
   `println!` the count. The test passes with zero themes on a machine without Omarchy.

**Verify**: `cargo test --manifest-path src-tauri/Cargo.toml --test theme_tests -- --nocapture`
→ 5 tests pass. On the owner's machine the printed count is 82 (24 stock
entries with a palette minus one without, plus 59 user entries); any number
above 0 with no failures is acceptable, as is 0 on a machine without Omarchy.

### Step 3: Apply a palette to the page

Create `src/theme.ts`:

```ts
/** The allowlisted keys of the active Omarchy theme, as the theme_palette command returns them. */
export type Palette = Record<string, string | undefined>

const OVERRIDES = ["--bg", "--fg", "--accent", "--sel-bg", "--sel-fg", "--danger"] as const

// The rule Omarchy uses when a theme does not state its mode.
const isLight = (hex: string): boolean =>
  [1, 3, 5].reduce((sum, at) => sum + parseInt(hex.slice(at, at + 2), 16), 0) > 382

/** True when the palette has the three colours every theme defines; anything less is "no theme right now". */
export const isComplete = (palette: Palette): boolean =>
  Boolean(palette.background && palette.foreground && palette.accent)

/** Sets the theme's colours on the root element; every other colour derives from them in style.css. */
export const applyPalette = (root: HTMLElement, palette: Palette): void => {
  const { background, foreground, accent } = palette
  if (!background || !foreground || !accent) return
  for (const name of OVERRIDES) root.style.removeProperty(name)
  root.style.setProperty("--bg", background)
  root.style.setProperty("--fg", foreground)
  root.style.setProperty("--accent", accent)
  const selection = palette.selection_background ?? palette.selection
  // Only as a pair: a theme's selection background under our own text colour can be unreadable.
  if (selection && palette.selection_foreground) {
    root.style.setProperty("--sel-bg", selection)
    root.style.setProperty("--sel-fg", palette.selection_foreground)
  }
  const danger = palette.red ?? palette.color1
  if (danger) root.style.setProperty("--danger", danger)
  root.style.setProperty("color-scheme", palette.mode ?? (isLight(background) ? "light" : "dark"))
}
```

**Verify**: `npm run typecheck` → exit 0.

### Step 4: Follow the theme while the app runs

Add to `src/theme.ts`:

```ts
export interface ThemeFollowDeps {
  call: <T>(command: string) => Promise<T>
  root: HTMLElement
  every: (fn: () => void, ms: number) => unknown
}

/**
 * Applies the active theme now and again whenever it changes.
 * shortcut: polls once a second instead of watching the file, because Omarchy deletes and recreates
 * the theme folder on a switch; move to a watcher on the parent folder only if polling ever shows up in a profile.
 */
export const followTheme = (deps: ThemeFollowDeps): (() => Promise<void>) => {
  let applied = ""
  const refresh = async (): Promise<void> => {
    try {
      const palette = await deps.call<Palette>("theme_palette")
      // Mid-switch the file is briefly missing: keep the colours we have.
      if (!isComplete(palette)) return
      const next = JSON.stringify(palette)
      if (next === applied) return
      applied = next
      applyPalette(deps.root, palette)
    } catch {
      // No Tauri runtime or a failed call: the stylesheet's fallback colours stay.
    }
  }
  void refresh()
  deps.every(() => void refresh(), 1000)
  return refresh
}
```

In `src/main.ts`, import `followTheme` from `./theme` and add, after the
features are mounted:

```ts
followTheme({
  call,
  root: document.documentElement,
  every: (fn, ms) => window.setInterval(fn, ms),
})
```

**Verify**: `npm run typecheck` → exit 0.

### Step 5: Frontend tests

Create `tests/theme.test.ts` (first line `// @vitest-environment happy-dom`).
Use a fresh `document.createElement("div")` as `root` in every test and read
results with `root.style.getPropertyValue(name)`.

`applyPalette`:

1. **sets the three colours and derives dark mode from `mode`** — palette
   `{ background: "#000000", foreground: "#e0e0e0", accent: "#cc0000", mode: "dark" }`
   → `--bg` `#000000`, `--fg` `#e0e0e0`, `--accent` `#cc0000`, `color-scheme` `dark`.
2. **derives light or dark from the background when `mode` is missing** —
   background `#FAF7F2` → `color-scheme` `light`; background `#0A0A0A` → `dark`.
3. **uses theme selection colours only as a pair** — with
   `selection_background` and `selection_foreground` both set, `--sel-bg` and
   `--sel-fg` equal them; with only `selection` set, `--sel-bg` and `--sel-fg`
   are both `""`; with `selection` and `selection_foreground` set, `--sel-bg`
   equals `selection`.
4. **uses `red`, else `color1`, for `--danger`, else leaves it unset.**
5. **clears a previous theme's optional colours** — apply a palette with
   selection pair and `red`, then apply one with only the three required keys:
   `--sel-bg`, `--sel-fg` and `--danger` are `""`, `--bg` is the new background.
6. **ignores an incomplete palette** — apply a complete palette, then
   `{ background: "#ffffff" }`: `--bg` is still the first background.

`followTheme`. Use this setup in each test so the answer can be changed between
polls without counting calls:

```ts
let answer: Palette | Error = { background: "#000000", foreground: "#e0e0e0", accent: "#cc0000" }
const call = vi.fn(async <T>(_command: string): Promise<T> => {
  if (answer instanceof Error) throw answer
  return answer as T
})
const every = vi.fn()
const refresh = followTheme({ call, root, every })
await refresh() // one poll; resolves after the palette is applied
```

`refresh` is the function `followTheme` returns; each `await refresh()` is one
poll. Change `answer`, then `await refresh()` again.

7. **applies the theme at start and polls every second** — after the setup,
   `--bg` is `#000000`, `call` was called with `"theme_palette"`, and `every`
   was called once with a function and `1000`.
8. **recolours when the theme changes** — set `answer` to a palette with
   background `#faf4ed`, `await refresh()`; `--bg` is `#faf4ed`.
9. **keeps the last colours while the file is missing or the call fails** — set
   `answer = {}`, `await refresh()`: `--bg` is still `#000000`. Set
   `answer = new Error("ipc")`, `await refresh()`: `--bg` is still `#000000`
   and the promise did not reject.
10. **does not touch the page when nothing changed** — after the setup, spy with
    `const spy = vi.spyOn(root.style, "setProperty")`, `await refresh()` with the
    same answer; `spy` was not called.

**Verify**: `npx vitest run tests/theme.test.ts` → 10 tests pass.

**Verify**: `npm test` → 53 tests pass (43 after plan 003 + 10).

### Step 6: Record the decision in the docs

In `ARD.md`, the line starting `- CON-PLATFORM-FILES:` appears in the "Security
and Privacy" part of the file. Directly after that line, add:

```markdown
- CON-PLATFORM-THEME: One fixed exception to CON-PLATFORM-FILES: the app reads the active Omarchy theme palette at ~/.config/omarchy/current/theme/colors.toml through the theme_palette command. It is read-only, never written, and only an allowlist of colour keys with validated #rrggbb values (plus mode light or dark) reaches the frontend.
```

In `README.md`, insert this section directly before the `## Layout` heading:

```markdown
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
```

**Verify**: `grep -c "CON-PLATFORM-THEME" ARD.md` → `1`

**Verify**: `grep -c "^## Theme" README.md` → `1`

**Verify**: `npm run check` → exit 0.

## Test plan

- `src-tauri/tests/theme_tests.rs` (new, 5 tests) — parser, file handling, and
  every installed theme. Step 2.
- `tests/theme.test.ts` (new, 10 tests) — applying and following. Step 5.
- The live behaviour (a visible recolour when the palette file changes) is
  checked by the reviewer after you finish, against a throwaway `HOME`, so the
  owner's desktop theme is never switched by an agent.

## Done criteria

ALL must hold:

- [ ] `npm run check` exits 0; Vitest reports 53 tests, and cargo reports 17 tests in total (12 existing + 5)
- [ ] `cargo test --manifest-path src-tauri/Cargo.toml --test theme_tests` passes 5 tests
- [ ] `grep -c "platform::theme::theme_palette" src-tauri/src/lib.rs` prints `1`
- [ ] `grep -c "theme_palette" src-tauri/src/platform/packaging.rs` prints `1`
- [ ] `git diff --stat <starting commit>..HEAD -- src-tauri/Cargo.toml src-tauri/Cargo.lock package.json package-lock.json src-tauri/capabilities src/style.css kit` is empty
- [ ] `grep -rn "omarchy-theme-set\|tauri-plugin-fs\|notify" src src-tauri/src src-tauri/Cargo.toml` returns no matches
- [ ] `git diff --name-only` against the starting commit lists only in-scope files

## STOP conditions

Stop and report back (do not improvise) if:

- The dependency check in the header fails (plan 003 not applied).
- `every_installed_omarchy_theme_has_the_three_required_colors` fails: report the
  theme names it prints. Do not loosen the test or the parser to make it pass.
- The kit test `every_command_is_registered_and_allowed` or the packaging test
  `runtime_wiring_has_no_violations` fails after step 1 and adding the three
  registration lines exactly as written does not fix it.
- `#[tauri::command(async)]` does not compile with the pinned Tauri version.
  Report the error; do not change dependency versions.
- You find yourself wanting to add a crate, a plugin, or a capability entry.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- The contract between the two halves is the six CSS variable names
  (`--bg`, `--fg`, `--accent`, `--sel-bg`, `--sel-fg`, `--danger`) plus
  `color-scheme`. Renaming one in `src/style.css` needs the same rename in `src/theme.ts`.
- To support another palette key, add it to `COLOR_KEYS` in `theme.rs` and use
  it in `applyPalette`. Keep the value check; it is what makes the values safe in CSS.
- Contrast is not checked. A theme whose `foreground` is close to its
  `background` will be hard to read here exactly as it is in the terminal.
- Deferred: following the Omarchy font size, matching Hyprland's corner
  rounding, and translucency (do that with a Hyprland opacity window rule, not
  a transparent Tauri window).
- A reviewer should scrutinise `parse_palette`: it is the trust boundary
  between a file on disk and CSS.
