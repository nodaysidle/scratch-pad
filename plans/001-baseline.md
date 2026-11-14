# Plan 001: The repo ignores its build output, has one check command, and a README for the finished app

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat c1e1b39..HEAD -- .gitignore package.json README.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `c1e1b39`, 2026-11-14

## Why this matters

Scratch Pad is a finished Tauri 2 desktop app (one autosaved note, Linux only),
but the repo still looks like the starter kit it was built from. There is no
committed `.gitignore`: build output is only ignored through the local, unshared
`.git/info/exclude`, so a fresh clone or a new git worktree shows `node_modules/`
and `dist/` as untracked and a `git add -A` would commit them. Checking the code
takes five separate commands typed from memory. And `README.md` still says
"starter kit" and tells the reader to copy files from `kit/`, which was done
long ago. After this plan a clone is clean, `npm run check` verifies everything,
and the README describes the real app.

## Current state

- `.gitignore` — does not exist.
- `package.json` — scripts today (lines 6-12):

  ```json
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "typecheck": "tsc --noEmit",
    "test": "vitest run --exclude 'kit/**'",
    "tauri": "tauri"
  },
  ```

- `README.md` — starts with `# Scratch Pad starter kit` and is byte-identical
  to `kit/README.md`. `kit/` is a frozen snapshot of the starter files; it keeps
  its own copy of these rules, so nothing is lost by rewriting the root README.
- `tests/contract.test.ts` imports `../README.md?raw` and only asserts it is a
  non-empty string. `src-tauri/tests/contract_tests.rs` only asserts the file
  exists.
- Tracked generated files that must stay tracked: `src-tauri/gen/schemas/*.json`
  and both lockfiles. Do not ignore `src-tauri/gen/`.
- All of these pass today and must still pass after this plan:
  `npm run typecheck`, `npm test` (26 tests),
  `cargo fmt --manifest-path src-tauri/Cargo.toml --check`,
  `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`
  (prints one harmless manifest warning about `tauri-codegen`; exit code is 0),
  `cargo test --manifest-path src-tauri/Cargo.toml` (12 tests).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install JS deps (fresh checkout only) | `npm ci` | exit 0 |
| Typecheck | `npm run typecheck` | exit 0 |
| Frontend tests | `npm test` | 26 passed |
| Everything | `npm run check` (after step 2) | exit 0 |

The first `cargo` command in a fresh checkout compiles all dependencies and can
take several minutes. That is normal; use a long timeout.

## Scope

**In scope** (the only files you should modify):
- `.gitignore` (create)
- `package.json` (add one script line)
- `README.md` (replace content)

**Out of scope** (do NOT touch):
- `kit/` — frozen starter snapshot, including `kit/README.md`.
- `package-lock.json` — adding a script does not change it. If it changes, revert it.
- `PRD.md`, `ARD.md`, `TRD.md`, `TASKS.md`, `AGENTS.md`, `BUILD-NOTES.md`, `BUILD-REPORT.md`.
- Any file under `src/`, `src-tauri/`, `tests/`, `scripts/`.
- No new dependencies, no ESLint/Prettier, no CI config, no git hooks.

## Git workflow

- Branch: `advisor/001-baseline` (create it from the commit you start on).
- One commit per step. Message style follows the repo's last docs commit
  (`docs: add BUILD-NOTES.md and BUILD-REPORT.md`): use
  `chore: add .gitignore`, `chore: add npm run check`, `docs: describe the finished app in README`.
- Do NOT push or open a PR.

## Steps

### Step 1: Create `.gitignore`

Create `.gitignore` in the repo root with exactly this content:

```gitignore
node_modules/
dist/
dist-web/
src-tauri/target/
.optim-jev/
graft/
```

**Verify**: `git check-ignore -v --no-index node_modules/ dist/ dist-web/ src-tauri/target/ .optim-jev/ graft/`
→ six lines, each starting with `.gitignore:`.

**Verify**: `git ls-files src-tauri/gen | wc -l` → `4` (generated schemas stay tracked).

### Step 2: Add the `check` script

In `package.json`, add this line to `"scripts"` directly after the `"test"` line
(keep the existing lines unchanged, mind the commas):

```json
"check": "tsc --noEmit && vitest run --exclude 'kit/**' && cargo fmt --manifest-path src-tauri/Cargo.toml --check && cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings && cargo test --manifest-path src-tauri/Cargo.toml",
```

**Verify**: `npm run check` → exit 0; output includes `26 passed` from Vitest
and six `test result: ok.` lines from cargo.

**Verify**: `git status --short` → shows only `.gitignore` (if not yet committed) and `package.json`; `package-lock.json` is not listed.

### Step 3: Replace `README.md`

Replace the whole file with the text below. Keep the wording; fix nothing else.

````markdown
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
````

**Verify**: `head -1 README.md` → `# Scratch Pad`

**Verify**: `grep -c "starter kit" README.md` → `0`

**Verify**: `npm test` → 26 passed (the contract test still finds a non-empty README).

## Test plan

No new tests. This plan adds no logic. The gate is that the existing suites
still pass through the new single command.

## Done criteria

ALL must hold:

- [ ] `npm run check` exits 0
- [ ] `git check-ignore -v --no-index node_modules/ dist/ dist-web/ src-tauri/target/ .optim-jev/ graft/` prints six lines and exits 0
- [ ] `git ls-files src-tauri/gen | wc -l` prints `4`
- [ ] `head -1 README.md` prints `# Scratch Pad`
- [ ] `git diff --name-only c1e1b39..HEAD` lists exactly `.gitignore`, `README.md`, `package.json`
- [ ] `diff -q README.md kit/README.md` reports that the files differ (kit copy untouched: `git diff --stat c1e1b39..HEAD -- kit` is empty)

## STOP conditions

Stop and report back (do not improvise) if:

- `npm run check` fails on a step that passed before your change (for example
  `cargo fmt --check` or clippy). Report the output; do not reformat or edit
  source files to make it pass.
- `package-lock.json` changes and reverting it does not make `npm run check` pass.
- A `.gitignore` already exists at the repo root.

## Maintenance notes

- Plan 003 adds a "Design" section and a "Keyboard" section to this README, and
  plan 004 adds a "Theme" section. Keep the section order above so those plans
  can append after "Build and install".
- `.git/info/exclude` on the owner's machine duplicates these ignore rules.
  That is harmless; do not edit it.
- Deferred on purpose: lint/format tooling for TypeScript, CI, and folding the
  `BUILD-NOTES.md` cache patches into `package_linux.sh`.
