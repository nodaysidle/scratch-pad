# Plan 005: Scratch Pad text is the same size as the terminal's, and follows it when it changes

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat af9d1ba..HEAD -- src src-tauri/src tests src-tauri/tests ARD.md README.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none beyond `master` at `af9d1ba` (plans 001-004 are merged)
- **Category**: direction
- **Planned at**: commit `af9d1ba`, 2026-11-14

## Why this matters

Scratch Pad is a one-note desktop app for Omarchy (Arch Linux, Hyprland). It is
styled like a terminal and usually sits in a tile next to one. Its font
*family* already matches the terminal, because both use the system `monospace`
font that Omarchy sets. Its *size* does not: the stylesheet hard-codes `13px`,
while the owner's terminal (Ghostty) is set to 12pt, which is 16px on screen,
so the note's text is visibly smaller than the terminal's beside it. After this
plan the app reads the font size from the default terminal's config, renders at
exactly that size, and follows a change within about a second, so one setting
adjusts both.

## Facts this plan is built on

- A terminal font size is in **points**. On screen, `pixels = points × 4/3`
  (96 dpi), times the monitor scale. 12pt is 16px at scale 1.
- The app's webview multiplies every CSS pixel by `window.devicePixelRatio`.
  On Omarchy that ratio is `monitor scale × GTK text-scaling-factor` (1.1667 on
  the owner's machine at monitor scale 1). Terminals ignore the GTK text
  scaling. So the CSS size that lands on the terminal's pixel size is:

  `css_px = points × 4/3 × monitor_scale ÷ devicePixelRatio`

  Example: `12 × 4/3 × 1 ÷ 1.1667 = 13.71px` CSS, which renders at 16px.
- The default terminal is the first entry of `~/.config/xdg-terminals.list`,
  for example `com.mitchellh.ghostty.desktop`. The file may be missing.
- Where each terminal keeps its font size (all under `$HOME/.config`):

  | Terminal | File | Line shape |
  |---|---|---|
  | Ghostty | `ghostty/config` | `font-size = 12` |
  | kitty | `kitty/kitty.conf` | `font_size 11.0` |
  | foot | `foot/foot.ini` | `font=JetBrainsMono Nerd Font:size=9` (first font before any comma) |
  | Alacritty | `alacritty/alacritty.toml` | `size = 9` inside the `[font]` section |

- The font family needs no work: do not read or set it.

## Design decisions (already made — do not revisit)

- One new Rust command, `terminal_font`, in a new file. It returns
  `{ "size_pt": number | null, "scale": number }`: the default terminal's font
  size in points (null when unknown) and the window's monitor scale factor.
  It never fails. No plugin, no capability entry, no new dependency.
- A size is accepted only if it parses as a number from 6 to 72 inclusive.
- Terminal choice: read `xdg-terminals.list`; the first non-empty line that is
  not a `#` comment names the terminal if it contains `ghostty`, `kitty`,
  `foot` or `alacritty` (case-insensitive; check in that order). If that
  terminal's config gives a size, use it. Otherwise (file missing, unknown
  terminal, or no size found) try the four configs in the order Ghostty,
  Alacritty, kitty, foot and use the first size found.
- The frontend sets one CSS variable, `--font-size`, on the root element with
  `style.setProperty` (the content security policy forbids `style` attributes
  and `<style>` elements). The stylesheet uses it with `13px` as the fallback.
- It polls once a second through the same injected timer the theme follower
  uses, and touches the page only when the computed size changed.
- No in-app zoom keys, no settings screen, no stored preference.

## Current state

Plain TypeScript and DOM frontend, Rust backend, Tauri 2. The theme follower
added earlier is the model for this plan; read both of its files first.

### `src/style.css` — the lines this plan changes

```css
  font: 13px/1.5 monospace;
```

(inside the `:root { ... }` block), and two fixed sizes further down:

```css
  padding: 4px 14px; color: var(--fg-dim); border-top: 1px solid var(--line); font-size: 12px;
```

(in `.status-bar`) and

```css
  padding: 6px 14px; color: var(--danger); border-bottom: 1px solid var(--danger); font-size: 12px;
```

(in `.error-banner`).

### `src/theme.ts` — the pattern to copy (lines 33-62)

```ts
export interface ThemeFollowDeps {
  call: <T>(command: string) => Promise<T>
  root: HTMLElement
  every: (fn: () => void, ms: number) => unknown
}

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

### `src/main.ts` — where the theme follower is started

```ts
followTheme({
  call,
  root: document.documentElement,
  every: (fn, ms) => window.setInterval(fn, ms),
})
```

### `src-tauri/src/platform/theme.rs` — the Rust pattern to copy

It has pure functions (`parse_palette(text)`, `read_palette(path)`), a size cap
`MAX_BYTES`, `active_palette_path()` built from `std::env::var_os("HOME")`, and
a thin command:

```rust
#[tauri::command(async)]
pub fn theme_palette() -> Result<BTreeMap<String, String>, AppError> {
    Ok(active_palette_path().map(|path| read_palette(&path)).unwrap_or_default())
}
```

### Registration points

- `src-tauri/src/platform/mod.rs` ends with `pub mod theme;`
- `src-tauri/src/lib.rs`: the last entry of `generate_handler![...]` is
  `platform::theme::theme_palette,`
- `src-tauri/src/platform/packaging.rs`: the last entry of the `commands`
  array is `"theme_palette",`

### Conventions to match

- Rust: every command returns `Result<T, AppError>` (`crate::error::AppError`).
  `rustfmt.toml` sets `use_small_heuristics = "Max"`; run `cargo fmt`. Clippy
  runs with `-D warnings`. Tests are integration tests in
  `src-tauri/tests/<name>_tests.rs` importing `scratch_pad_lib`; see
  `src-tauri/tests/theme_tests.rs` (uses `tempfile::tempdir()`).
- TypeScript: no semicolons, double quotes, two-space indent, arrow functions,
  no `any`. Tests start with `// @vitest-environment happy-dom`; see
  `tests/theme.test.ts`, including how it casts a `vi.fn` mock to the `call` type.
- `ARD.md` has a line `- CON-PLATFORM-THEME: ...` recording the theme file as an
  exception to "only read files the user picked". This plan adds a sibling line.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install JS deps (fresh checkout only) | `npm ci` | exit 0 |
| Typecheck | `npm run typecheck` | exit 0 |
| Frontend tests | `npm test` | all pass |
| Format Rust | `cargo fmt --manifest-path src-tauri/Cargo.toml` | exit 0 |
| One Rust test file | `cargo test --manifest-path src-tauri/Cargo.toml --test font_tests` | all pass |
| Everything | `npm run check` | exit 0 |

Do NOT launch the app. Do NOT edit or create anything under `~/.config`. Do NOT
run any `omarchy` or `hyprctl` command.

## Scope

**In scope** (the only files you should modify):
- `src-tauri/src/platform/font.rs` (create)
- `src-tauri/src/platform/mod.rs` (one line)
- `src-tauri/src/platform/packaging.rs` (one list entry)
- `src-tauri/src/lib.rs` (one list entry)
- `src-tauri/tests/font_tests.rs` (create)
- `src/font.ts` (create)
- `src/main.ts` (wire it)
- `src/style.css` (three declarations)
- `tests/font.test.ts` (create)
- `ARD.md`, `README.md` (the edits in step 5 only)

**Out of scope** (do NOT touch):
- `src/theme.ts`, `src-tauri/src/platform/theme.rs` — copy the pattern, do not refactor them into a shared helper.
- `src-tauri/Cargo.toml`, `Cargo.lock`, `package.json`, `package-lock.json`, `src-tauri/capabilities/`, `src-tauri/tauri.conf.json`.
- `kit/`.
- The font family, line height, padding, and any terminal setting other than the font size.
- Terminal config includes (for example Ghostty's `config-file = ...` lines): do not follow them.

## Git workflow

- Branch: `advisor/005-terminal-font-size`.
- One commit per step, message style `feat: <what>` / `test: <what>` / `docs: <what>`.
- Do NOT push or open a PR.

## Steps

### Step 1: The font-size reader in Rust

Create `src-tauri/src/platform/font.rs`:

```rust
//! The default terminal's font size, so the note can be set at the same size. Read-only; only a
//! validated number leaves this module.

use std::path::Path;

use serde::Serialize;

use crate::error::AppError;

// Terminal configs are a few kilobytes; anything far larger is not one.
const MAX_BYTES: u64 = 256 * 1024;
const TERMINALS: &[&str] = &["ghostty", "alacritty", "kitty", "foot"];

#[derive(Serialize, Debug, Clone, PartialEq)]
pub struct TerminalFont {
    /// Font size in points, or None when no terminal config states one.
    pub size_pt: Option<f64>,
    /// The monitor scale factor of the window.
    pub scale: f64,
}

fn valid_size(text: &str) -> Option<f64> {
    let size: f64 = text.trim().trim_matches('"').parse().ok()?;
    (6.0..=72.0).contains(&size).then_some(size)
}

/// The font size a terminal's config text states. `terminal` is one of TERMINALS.
pub fn parse_size(terminal: &str, text: &str) -> Option<f64> {
    let mut section = String::new();
    for line in text.lines() {
        let line = line.trim();
        if line.starts_with('#') || line.starts_with(';') {
            continue;
        }
        if line.starts_with('[') {
            section = line.to_string();
            continue;
        }
        let found = match terminal {
            "ghostty" => line
                .split_once('=')
                .filter(|(key, _)| key.trim() == "font-size")
                .and_then(|(_, value)| valid_size(value)),
            "kitty" => line.strip_prefix("font_size").and_then(valid_size),
            "foot" => line
                .split_once('=')
                .filter(|(key, _)| key.trim() == "font")
                .and_then(|(_, value)| value.split(',').next())
                .and_then(|first| first.split_once(":size="))
                .and_then(|(_, size)| valid_size(size.split(':').next().unwrap_or(""))),
            "alacritty" => line
                .split_once('=')
                .filter(|(key, _)| section == "[font]" && key.trim() == "size")
                .and_then(|(_, value)| valid_size(value)),
            _ => None,
        };
        if found.is_some() {
            return found;
        }
    }
    None
}

fn config_path(config_dir: &Path, terminal: &str) -> std::path::PathBuf {
    match terminal {
        "ghostty" => config_dir.join("ghostty/config"),
        "kitty" => config_dir.join("kitty/kitty.conf"),
        "foot" => config_dir.join("foot/foot.ini"),
        _ => config_dir.join("alacritty/alacritty.toml"),
    }
}

fn read_small(path: &Path) -> Option<String> {
    let metadata = std::fs::metadata(path).ok()?;
    if !metadata.is_file() || metadata.len() > MAX_BYTES {
        return None;
    }
    std::fs::read_to_string(path).ok()
}

fn size_of(config_dir: &Path, terminal: &str) -> Option<f64> {
    parse_size(terminal, &read_small(&config_path(config_dir, terminal))?)
}

/// The terminal named by the first entry of xdg-terminals.list, if it is one we can read.
pub fn default_terminal(list: &str) -> Option<&'static str> {
    let entry = list.lines().map(str::trim).find(|line| !line.is_empty() && !line.starts_with('#'))?;
    let entry = entry.to_ascii_lowercase();
    ["ghostty", "kitty", "foot", "alacritty"].into_iter().find(|name| entry.contains(name))
}

/// The default terminal's font size under `config_dir` (normally ~/.config); when the default
/// terminal is unknown or states no size, the first size any known terminal's config states.
pub fn terminal_size(config_dir: &Path) -> Option<f64> {
    let preferred = read_small(&config_dir.join("xdg-terminals.list"))
        .and_then(|list| default_terminal(&list))
        .and_then(|terminal| size_of(config_dir, terminal));
    preferred.or_else(|| TERMINALS.iter().find_map(|terminal| size_of(config_dir, terminal)))
}

/// The terminal's font size and this window's scale factor. Never fails.
#[tauri::command(async)]
pub fn terminal_font<R: tauri::Runtime>(window: tauri::Window<R>) -> Result<TerminalFont, AppError> {
    let size_pt = std::env::var_os("HOME")
        .and_then(|home| terminal_size(&Path::new(&home).join(".config")));
    Ok(TerminalFont { size_pt, scale: window.scale_factor().unwrap_or(1.0) })
}
```

Register it:

- `src-tauri/src/platform/mod.rs`: add `pub mod font;` (keep the list alphabetical if it is; otherwise as the last line).
- `src-tauri/src/lib.rs`: add `platform::font::terminal_font,` as the last entry of `generate_handler![...]`.
- `src-tauri/src/platform/packaging.rs`: add `"terminal_font",` as the last entry of the `commands` array.

Run `cargo fmt --manifest-path src-tauri/Cargo.toml` (it may re-wrap the code above; that is fine).

**Verify**: `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` → exit 0.

**Verify**: `cargo test --manifest-path src-tauri/Cargo.toml` → all 17 existing tests pass.

### Step 2: Rust tests

Create `src-tauri/tests/font_tests.rs`
(`use scratch_pad_lib::platform::font::{default_terminal, parse_size, terminal_size};`):

1. **`parses_each_terminal_format`** —
   - `parse_size("ghostty", "font-family = \"JetBrainsMono Nerd Font\"\nfont-size = 12\n")` is `Some(12.0)`.
   - `parse_size("kitty", "font_family JetBrainsMono Nerd Font\nfont_size 11.5\n")` is `Some(11.5)`.
   - `parse_size("foot", "[main]\nfont=JetBrainsMono Nerd Font:size=9,Noto Color Emoji:size=20\n")` is `Some(9.0)`.
   - `parse_size("alacritty", "[window]\nsize = 3\n\n[font]\nnormal = { family = \"JetBrainsMono Nerd Font\" }\nsize = 9\n")` is `Some(9.0)`
     (the `size` under `[window]` is ignored; note 3 would be rejected anyway, so also assert
     `parse_size("alacritty", "[window]\nsize = 20\n")` is `None`).
2. **`rejects_sizes_that_are_not_sane_numbers`** — each of these is `None`:
   `parse_size("ghostty", "font-size = 500")`, `"font-size = 2"`, `"font-size = big"`,
   `"font-size = 12; rm"`, `"# font-size = 12"`, and `parse_size("unknown", "font-size = 12")`.
3. **`finds_the_default_terminal`** — `default_terminal("# comment\n\ncom.mitchellh.ghostty.desktop\nfoot.desktop\n")`
   is `Some("ghostty")`; `default_terminal("Alacritty.desktop\n")` is `Some("alacritty")`;
   `default_terminal("org.wezfurlong.wezterm.desktop\n")` is `None`; `default_terminal("")` is `None`.
4. **`uses_the_default_terminal_then_falls_back`** — with `tempfile::tempdir()` as the config dir:
   - empty dir → `terminal_size` is `None`.
   - write `foot/foot.ini` with `font=Mono:size=9` and `ghostty/config` with `font-size = 12`, no
     list file → `Some(12.0)` (fallback order starts with Ghostty).
   - add `xdg-terminals.list` containing `foot.desktop` → `Some(9.0)`.
   - change the list to `org.wezfurlong.wezterm.desktop` → `Some(12.0)`.
   - change the list to `kitty.desktop` (no kitty config exists) → `Some(12.0)`.

**Verify**: `cargo test --manifest-path src-tauri/Cargo.toml --test font_tests` → 4 tests pass.

### Step 3: Use the size in the frontend

In `src/style.css`:

- change `font: 13px/1.5 monospace;` to `font: var(--font-size, 13px)/1.5 monospace;`
- in `.status-bar`, change `font-size: 12px;` to `font-size: 0.92em;`
- in `.error-banner`, change `font-size: 12px;` to `font-size: 0.92em;`

Also extend the comment at the top of the file with one sentence: `--font-size is set at runtime to the terminal's font size; 13px is the fallback.`

Create `src/font.ts`:

```ts
/** What the terminal_font command returns: the terminal's font size in points and the monitor scale. */
export interface TerminalFont {
  size_pt: number | null
  scale: number
}

/**
 * The CSS size that renders at the terminal's pixel size. A point is 4/3 px, scaled by the monitor;
 * the webview then multiplies CSS px by devicePixelRatio (monitor scale times GTK text scaling,
 * which terminals ignore), so divide by it.
 */
export const cssFontSize = (font: TerminalFont, pixelRatio: number): string | null => {
  if (!font.size_pt || !(font.scale > 0) || !(pixelRatio > 0)) return null
  return `${(((font.size_pt * 4) / 3) * font.scale / pixelRatio).toFixed(2)}px`
}

export interface FontFollowDeps {
  call: <T>(command: string) => Promise<T>
  root: HTMLElement
  every: (fn: () => void, ms: number) => unknown
  pixelRatio: () => number
}

/** Sets the note's font size to the terminal's now and again whenever it changes. */
export const followTerminalFont = (deps: FontFollowDeps): (() => Promise<void>) => {
  let applied = ""
  const refresh = async (): Promise<void> => {
    try {
      const size = cssFontSize(await deps.call<TerminalFont>("terminal_font"), deps.pixelRatio())
      // No terminal config right now: keep the size we have.
      if (!size || size === applied) return
      applied = size
      deps.root.style.setProperty("--font-size", size)
    } catch {
      // No Tauri runtime or a failed call: the stylesheet's fallback size stays.
    }
  }
  void refresh()
  deps.every(() => void refresh(), 1000)
  return refresh
}
```

In `src/main.ts`, import `followTerminalFont` from `./font` and add, directly
after the `followTheme({...})` call:

```ts
followTerminalFont({
  call,
  root: document.documentElement,
  every: (fn, ms) => window.setInterval(fn, ms),
  pixelRatio: () => window.devicePixelRatio,
})
```

**Verify**: `npm run typecheck` → exit 0.

**Verify**: `grep -c "var(--font-size, 13px)" src/style.css` → `1`; `grep -c "font-size: 12px" src/style.css` → `0`.

**Verify**: `npm run build` → exit 0.

### Step 4: Frontend tests

Create `tests/font.test.ts` (first line `// @vitest-environment happy-dom`),
modelled on `tests/theme.test.ts`:

`cssFontSize`:

1. `cssFontSize({ size_pt: 12, scale: 1 }, 1)` is `"16.00px"`.
2. `cssFontSize({ size_pt: 12, scale: 1 }, 1.1667)` is `"13.71px"`.
3. `cssFontSize({ size_pt: 12, scale: 2 }, 2.3334)` is `"13.71px"` (a HiDPI monitor gives the same CSS size).
4. It returns `null` for `size_pt: null`, for `scale: 0`, and for a pixel ratio of `0`.

`followTerminalFont` (use a mutable `answer: TerminalFont | Error` read by the
`call` mock, a `vi.fn()` for `every`, a fresh `document.createElement("div")`
as `root`, and `pixelRatio: () => 1`; `await refresh()` runs one poll):

5. **sets the size at start and polls every second** — `--font-size` is `16.00px`;
   `call` was called with `"terminal_font"`; `every` was called once with a function and `1000`.
6. **follows a change** — set `answer` to `{ size_pt: 9, scale: 1 }`, `await refresh()`; `--font-size` is `12.00px`.
7. **keeps the last size when the terminal config is gone or the call fails** — `answer = { size_pt: null, scale: 1 }`,
   then `answer = new Error("ipc")`; after each `await refresh()` the value is still `16.00px` and the promise did not reject.
8. **does not touch the page when nothing changed** — spy on `root.style.setProperty` after the first apply;
   a second `await refresh()` with the same answer makes no call.

**Verify**: `npx vitest run tests/font.test.ts` → 8 tests pass.

**Verify**: `npm test` → 61 tests pass (53 existing + 8).

### Step 5: Docs

In `ARD.md`, directly after the line starting `- CON-PLATFORM-THEME:`, add:

```markdown
- CON-PLATFORM-FONT: A second fixed exception to CON-PLATFORM-FILES: the app reads the font size from the default terminal's config (~/.config/xdg-terminals.list, then ghostty/config, alacritty/alacritty.toml, kitty/kitty.conf or foot/foot.ini) through the terminal_font command. It is read-only, and only one validated number (6 to 72 points) reaches the frontend.
```

In `README.md`, insert this section directly before the `## Layout` heading:

```markdown
## Font

The note uses the system `monospace` font, which Omarchy sets to the same
family as the terminal (`omarchy font set <name>` changes both). The size is
read from the default terminal's config and checked once a second, so the note
renders at the terminal's pixel size and follows it when it changes. To change
the size, change the terminal's: for Ghostty, `font-size` in
`~/.config/ghostty/config`.

Supported terminals: Ghostty, Alacritty, kitty and foot. Without one of their
configs the note uses 13px. The Rust side is `src-tauri/src/platform/font.rs`;
the frontend side is `src/font.ts`.
```

**Verify**: `grep -c "CON-PLATFORM-FONT" ARD.md` → `1`; `grep -c "^## Font" README.md` → `1`.

**Verify**: `npm run check` → exit 0.

## Test plan

- `src-tauri/tests/font_tests.rs` (new, 4 tests): each terminal's format, bad
  values, default-terminal detection, fallback order.
- `tests/font.test.ts` (new, 8 tests): the size conversion and the follower.
- The reviewer checks the result in the running app by measuring the character
  width against the terminal's; you do not launch the app.

## Done criteria

ALL must hold:

- [ ] `npm run check` exits 0; Vitest reports 61 tests; cargo reports 21 tests in total (17 existing + 4)
- [ ] `grep -c "platform::font::terminal_font" src-tauri/src/lib.rs` prints `1`
- [ ] `grep -c "terminal_font" src-tauri/src/platform/packaging.rs` prints `1`
- [ ] `grep -c "var(--font-size, 13px)" src/style.css` prints `1`
- [ ] `git diff --stat af9d1ba..HEAD -- src-tauri/Cargo.toml src-tauri/Cargo.lock package.json package-lock.json src-tauri/capabilities src-tauri/tauri.conf.json src/theme.ts src-tauri/src/platform/theme.rs kit` is empty
- [ ] `git diff --name-only af9d1ba..HEAD` lists only in-scope files

## STOP conditions

Stop and report back (do not improvise) if:

- The drift check shows changes, or an excerpt in "Current state" does not match.
- A command taking `window: tauri::Window<R>` does not compile inside
  `generate_handler!` with the pinned Tauri version, or the existing test
  `every_command_is_registered_and_allowed` / `runtime_wiring_has_no_violations`
  fails after registration. Report the error; do not change dependency versions.
- You find yourself wanting to add a crate, a plugin, or a capability entry.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- The size is exact only for the font size itself. Line height (1.5 here, the
  terminal's own cell height there) and padding (14px here, the terminal's own
  setting there) are not read, so rows in the note and the terminal do not line
  up one to one.
- Terminal config includes are not followed; a size set only in an included
  file is not seen.
- To support another terminal, add its name to `TERMINALS`, `default_terminal`,
  `config_path` and `parse_size`, with a test for its line shape.
- Deferred: in-app zoom keys (Ctrl with plus and minus) and following the
  terminal's padding.
