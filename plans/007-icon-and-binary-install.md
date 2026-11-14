# Plan 007: Scratch Pad has its own icon and an install command that works on current Arch

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat af9d1ba..HEAD -- app-icon.svg src-tauri/icons scripts/package_linux.sh`
> must be empty. If any of those changed, compare the "Current state" excerpts
> against the live files; on a mismatch, treat it as a STOP condition.
> (`README.md` may already have changed through other plans; that is expected.)

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (independent of plans 005 and 006; it touches other files)
- **Category**: dx
- **Planned at**: commit `af9d1ba`, 2026-11-14

## Why this matters

Scratch Pad is a one-note desktop app for Omarchy (Arch Linux, Hyprland). Two
things are wrong with how it shows up on the desktop:

1. **Its icon is a placeholder**: a blue square on a dark square, left over from
   the starter kit.
2. **Its install command does not work.** `./scripts/package_linux.sh --install`
   builds an AppImage, and that step fails on current Arch Linux inside the
   `linuxdeploy` tool Tauri downloads. The app on the owner's machine was
   therefore installed by hand as a plain binary. Its launcher entry is named
   `com.scratch.pad.desktop`, while the window's class (Wayland app id) is
   `scratch-pad`; Omarchy's convention is one name for the binary, the
   `.desktop` file, the icon and the window class.

After this plan the repo has the real icon, and
`./scripts/package_linux.sh --install-binary` builds the app and installs the
binary, an SVG icon and a launcher entry, all named `scratch-pad`, so it
appears in the Omarchy app launcher with its icon.

## Design (decided — do not revisit)

- **Icon**: the owner chose concept "lines and cursor" in neutral dark: a
  charcoal rounded square with three light text lines and a block cursor after
  the last line. One square SVG, no gradients, no text. The exact file is in step 1.
- **The AppImage path stays as it is.** `./scripts/package_linux.sh` and
  `--install` keep their current behaviour, because `AGENTS.md` and `TRD.md`
  describe them in several places. This plan only **adds** `--install-binary`.
- `--install-binary` installs, for the current user:
  - the release binary to `~/.local/bin/scratch-pad` (the previous one is kept
    as `dist/rollback/scratch-pad`);
  - `app-icon.svg` to `~/.local/share/icons/hicolor/scalable/apps/scratch-pad.svg`;
  - a launcher entry `~/.local/share/applications/scratch-pad.desktop`;
  - and removes the two files older installs left behind:
    `~/.local/share/applications/com.scratch.pad.desktop` and
    `~/.local/share/icons/hicolor/128x128/apps/scratch-pad.png`.

## Current state

### `app-icon.svg` (whole file, the placeholder)

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" rx="224" fill="#1d1d1f"/>
  <rect x="272" y="272" width="480" height="480" rx="96" fill="#0a84ff"/>
</svg>
```

### `src-tauri/icons/`

Generated from `app-icon.svg` by `npm run tauri -- icon app-icon.svg`. All of
its files are tracked in git (PNG sizes, `icon.ico`, `icon.icns`, and `android/`
and `ios/` folders). `src-tauri/tauri.conf.json` lists five of them under
`bundle.icon`; do not edit that list.

### `scripts/package_linux.sh` (whole file)

```bash
#!/usr/bin/env bash
# Build an AppImage, install it for the current user, and add the desktop entry.
# Usage: scripts/package_linux.sh [--install]
set -euo pipefail

cd "$(dirname "$0")/.."
SLUG="scratch-pad"
APP_NAME='Scratch Pad'
INSTALL_DIR="$HOME/.local"

install=false
for arg in "$@"; do
  case "$arg" in
    --install) install=true ;;
    *) echo "Unknown argument: $arg" >&2; exit 2 ;;
  esac
done

[ -f src-tauri/icons/128x128.png ] || npm run tauri -- icon app-icon.svg
npm run tauri -- build --bundles appimage

mkdir -p dist
APPIMAGE="$(find src-tauri/target/release/bundle/appimage -maxdepth 1 -name '*.AppImage' | head -1)"
if [ -z "$APPIMAGE" ]; then
  echo "AppImage was not produced" >&2
  exit 1
fi
cp "$APPIMAGE" "dist/$SLUG.AppImage"

if [ "$install" = false ]; then
  echo "Built dist/$SLUG.AppImage; rerun with --install to install it."
  exit 0
fi

mkdir -p "$INSTALL_DIR/bin" "$INSTALL_DIR/share/applications" "$INSTALL_DIR/share/icons/hicolor/128x128/apps"
if [ -f "$INSTALL_DIR/bin/$SLUG.AppImage" ]; then
  mkdir -p dist/rollback
  cp "$INSTALL_DIR/bin/$SLUG.AppImage" "dist/rollback/$SLUG.AppImage"
fi
install -m755 "dist/$SLUG.AppImage" "$INSTALL_DIR/bin/$SLUG.AppImage"
install -m644 src-tauri/icons/128x128.png "$INSTALL_DIR/share/icons/hicolor/128x128/apps/$SLUG.png"
cat > "$INSTALL_DIR/share/applications/com.scratch.pad.desktop" <<DESKTOP
[Desktop Entry]
Name=$APP_NAME
Comment=$APP_NAME
Exec=env GDK_BACKEND=wayland $INSTALL_DIR/bin/$SLUG.AppImage
Icon=$SLUG
Terminal=false
Type=Application
Categories=Utility;
StartupWMClass=com.scratch.pad
DESKTOP
echo "Installed $APP_NAME under $INSTALL_DIR"
```

### `README.md` — the section this plan edits

```markdown
## Build and install

```sh
./scripts/package_linux.sh            # builds dist/scratch-pad.AppImage
./scripts/package_linux.sh --install  # also installs it under ~/.local with a desktop entry
```

The AppImage build needs two local fixes to the tools Tauri downloads into
`~/.cache/tauri`; without them it fails on current Arch Linux. They are
described in `BUILD-NOTES.md`, entries 2 and 3. If that cache is cleared, apply
them again.
```

and one row of the table under `## Layout`:

`| `scripts/package_linux.sh` | AppImage build and install |`

### Facts

- The window class (Wayland app id) of the running app is the binary's file
  name. Installed as `scratch-pad`, the class is `scratch-pad`.
- `tests/contract.test.ts` and `src-tauri/tests/contract_tests.rs` only require
  that `app-icon.svg` and `scripts/package_linux.sh` exist and are not empty.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install JS deps (fresh checkout only) | `npm ci` | exit 0 |
| Regenerate bundle icons | `npm run tauri -- icon app-icon.svg` | exit 0 |
| Shell syntax check | `bash -n scripts/package_linux.sh` | exit 0, no output |
| Everything | `npm run check` | exit 0 |

**Never run `scripts/package_linux.sh` with `--install` or `--install-binary`**:
they write into the owner's home folder. The reviewer runs the install. You may
not run the script at all; its checks in this plan are static.

## Scope

**In scope** (the only files you should modify):
- `app-icon.svg`
- `src-tauri/icons/**` (regenerated files only)
- `scripts/package_linux.sh`
- `README.md` (the edits in step 4 only)

**Out of scope** (do NOT touch):
- `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, anything under `src/`, `src-tauri/src/`, `tests/`, `kit/`.
- `AGENTS.md`, `TRD.md`, `PRD.md`, `ARD.md`, `BUILD-NOTES.md`, `BUILD-REPORT.md`.
- The behaviour of the script when called with no argument or with `--install`.
- Anything under the home folder outside the worktree.

## Git workflow

- Branch: `advisor/007-icon-and-binary-install`.
- One commit per step, message style `feat: <what>` / `docs: <what>`.
- Do NOT push or open a PR.

## Steps

### Step 1: The icon

Replace the whole content of `app-icon.svg` with exactly:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#232326"/>
  <rect x="14" y="17" width="36" height="5" fill="#d9d9de"/>
  <rect x="14" y="28" width="26" height="5" fill="#d9d9de"/>
  <rect x="14" y="39" width="12" height="5" fill="#d9d9de"/>
  <rect x="30" y="35" width="8" height="13" fill="#d9d9de"/>
</svg>
```

**Verify**: `grep -c "0a84ff" app-icon.svg` → `0`; `grep -c 'viewBox="0 0 64 64"' app-icon.svg` → `1`.

### Step 2: Regenerate the bundle icons

Run `npm run tauri -- icon app-icon.svg`.

Then run `git status --short src-tauri/icons`. Every line must start with ` M`
(a tracked file that changed). If a line starts with `??` (a new, untracked
file), delete that file: this plan only refreshes the icons that already exist.

**Verify**: `git status --short src-tauri/icons | grep -c '^??'` → `0`

**Verify**: `git status --short src-tauri/icons | grep -c '^ M'` → at least `5`
(the five files listed in `tauri.conf.json` are among them:
`git status --short src-tauri/icons | grep -cE 'icons/(32x32\.png|128x128\.png|128x128@2x\.png|icon\.icns|icon\.ico)$'` → `5`)

**Verify**: `npm run check` → exit 0 (the icons are compiled into the app and its tests).

### Step 3: `--install-binary`

Edit `scripts/package_linux.sh`:

1. Replace the two comment lines at the top (lines 2-3) with:

   ```bash
   # Build Scratch Pad and install it for the current user.
   # Usage: scripts/package_linux.sh [--install | --install-binary]
   #   (no argument)     build dist/scratch-pad.AppImage
   #   --install         build the AppImage and install it under ~/.local
   #   --install-binary  build the plain release binary and install it under ~/.local with its
   #                     icon and launcher entry. Use this on current Arch Linux, where the
   #                     AppImage step fails inside linuxdeploy (see BUILD-NOTES.md).
   ```

2. In the `case`, add a line before the `*)` line:
   `    --install-binary) install_binary=true ;;`
   and, next to `install=false`, add `install_binary=false`.

3. Directly after the `done` that closes the argument loop, insert this block:

   ```bash
   if [ "$install_binary" = true ]; then
     npm run tauri -- build --no-bundle
     BIN="src-tauri/target/release/$SLUG"
     if [ ! -x "$BIN" ]; then
       echo "Release binary was not produced" >&2
       exit 1
     fi
     APPS="$INSTALL_DIR/share/applications"
     ICONS="$INSTALL_DIR/share/icons/hicolor"
     mkdir -p dist "$INSTALL_DIR/bin" "$APPS" "$ICONS/scalable/apps"
     cp "$BIN" "dist/$SLUG"
     if [ -f "$INSTALL_DIR/bin/$SLUG" ]; then
       mkdir -p dist/rollback
       cp "$INSTALL_DIR/bin/$SLUG" "dist/rollback/$SLUG"
     fi
     install -m755 "dist/$SLUG" "$INSTALL_DIR/bin/$SLUG"
     install -m644 app-icon.svg "$ICONS/scalable/apps/$SLUG.svg"
     # One name for the binary, the launcher entry, the icon and the window class, so the
     # compositor and the launcher match the window to this entry.
     cat > "$APPS/$SLUG.desktop" <<DESKTOP
   [Desktop Entry]
   Type=Application
   Name=$APP_NAME
   Comment=One note, saved as you type
   Exec=env GDK_BACKEND=wayland "$INSTALL_DIR/bin/$SLUG"
   Icon=$SLUG
   Terminal=false
   Categories=Utility;TextEditor;
   StartupWMClass=$SLUG
   DESKTOP
     # Left behind by earlier installs under the old names.
     rm -f "$APPS/com.scratch.pad.desktop" "$ICONS/128x128/apps/$SLUG.png"
     command -v update-desktop-database >/dev/null && update-desktop-database "$APPS" || true
     command -v gtk-update-icon-cache >/dev/null && gtk-update-icon-cache -q -t "$ICONS" || true
     echo "Installed $APP_NAME as $INSTALL_DIR/bin/$SLUG"
     exit 0
   fi
   ```

   Inside the heredoc the lines from `[Desktop Entry]` to `DESKTOP` must start
   at column 1 in the real file (no leading spaces), exactly like the existing
   heredoc further down in the script. The indentation shown above belongs to
   this Markdown list, not to the file.

Leave everything after that block unchanged.

**Verify**: `bash -n scripts/package_linux.sh` → exit 0, no output.

**Verify**: `grep -c -- "--install-binary" scripts/package_linux.sh` → at least `3`.

**Verify**: `grep -n "^\[Desktop Entry\]" scripts/package_linux.sh | wc -l` → `2` (both heredocs start at column 1).

**Verify**: `git diff af9d1ba -- scripts/package_linux.sh | grep -c '^-[^-]'` → `2` (only the two old comment lines were removed).

If `shellcheck` is installed (`command -v shellcheck`), run
`shellcheck scripts/package_linux.sh` and fix any error it reports **in the
block you added**; leave warnings about the pre-existing lines alone.

### Step 4: README

In `README.md`, replace the whole `## Build and install` section (shown in
"Current state", from the heading down to the paragraph ending `apply them again.`)
with:

````markdown
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
````

In the table under `## Layout`, change the row for the script to:

`| `scripts/package_linux.sh` | Build and install (binary or AppImage) |`

**Verify**: `grep -c -- "--install-binary" README.md` → `1`

**Verify**: `grep -c "scratch-pad.desktop" README.md` → `1`

**Verify**: `npm run check` → exit 0.

## Test plan

No new automated tests: this plan changes an image, generated icons, a shell
script and a README. The gates are `bash -n`, the greps above, and
`npm run check` still passing. The reviewer runs the install and checks the
launcher entry and icon on the real desktop.

## Done criteria

ALL must hold:

- [ ] `npm run check` exits 0
- [ ] `bash -n scripts/package_linux.sh` exits 0
- [ ] `grep -c "d9d9de" app-icon.svg` prints `4`
- [ ] `git status --short` is empty after the last commit
- [ ] `git diff --name-only af9d1ba..HEAD` lists only `app-icon.svg`, `README.md`, `scripts/package_linux.sh` and files under `src-tauri/icons/`
- [ ] `git diff af9d1ba..HEAD --stat -- src-tauri/tauri.conf.json AGENTS.md TRD.md src tests kit` is empty

## STOP conditions

Stop and report back (do not improvise) if:

- `npm run tauri -- icon app-icon.svg` fails, or refuses the SVG. Do not
  convert the icon by other means; report the error.
- `npm run check` fails after step 2.
- The script in the repo does not match the excerpt in "Current state".
- You find yourself about to run the script with any argument, or to write
  anything outside the worktree.

## Maintenance notes

- `AGENTS.md` and `TRD.md` still name the AppImage as the app's artifact and
  `--install` as the install command. They are left as they are on purpose; the
  owner decides whether the binary install becomes the documented default.
- The launcher icon is a fixed file and does not follow the Omarchy theme; the
  owner chose a neutral dark one for that reason.
- If the binary is ever renamed, the window class changes with it: update
  `SLUG`, the `.desktop` file name and `StartupWMClass` together.
