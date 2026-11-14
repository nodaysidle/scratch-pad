# Plan 003: Scratch Pad looks and behaves like a native Omarchy/Hyprland app in any tile

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: this plan is applied on top of plans 001 and 002.
> Confirm both are present before starting:
> `test -f .gitignore && test -f src/close.ts && grep -c "let loaded = false" src/features/singlenoteeditorfeature.ts`
> → prints `1` and exits 0. If not, STOP: the dependencies are missing.
> Then compare the "Current state" excerpts below against the live code; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (visual change that tests cannot fully judge; a reviewer does a launch check afterwards)
- **Depends on**: plans/001-baseline.md, plans/002-data-safety.md
- **Category**: direction
- **Planned at**: commit `c1e1b39`, 2026-11-14

## Why this matters

Scratch Pad ships only for Arch Linux with Omarchy (Hyprland, a tiling Wayland
compositor), but its stylesheet is an Apple design: it asks for `-apple-system`
and SF Pro (which do not exist on Linux), uses Apple blue, draws a title header,
and puts a 360px-high text box inside a scrolling page. The window also declares
a 720x480 minimum, larger than many tiles. Under a tiling window manager the app
should be what a terminal is: the editor fills whatever tile it is given, text is
the system monospace font, the compositor draws the border, rounding and shadow,
and everything works from the keyboard. This plan does that. Colours come from
three CSS variables so that plan 004 can feed them from the active Omarchy theme.

## Design decisions (already made — do not revisit)

- **No chrome of its own.** No title header, no window decorations
  (`decorations: false`), no outer border, radius or shadow, no animations.
  Hyprland provides all of that.
- **One font.** `font: 13px/1.5 monospace`. The generic `monospace` family
  resolves to the font the user picked in Omarchy (JetBrainsMono Nerd Font by
  default), so do not name a specific font.
- **Layout.** The textarea fills the window with 14px padding (the stock Omarchy
  terminal padding). One status bar at the bottom holds the status text on the
  left and the two buttons on the right. The error banner is a single line at
  the top.
- **Colours.** Three inputs: `--bg`, `--fg`, `--accent`. Everything else is
  mixed from them in CSS. Defaults are the CSS system colours `Canvas`,
  `CanvasText`, `AccentColor`. The accent is used only for the caret, focus
  outlines and outlined (never filled) elements, because some themes have an
  accent equal to the text colour.
- **Controls.** 28px high, 1px border, square corners, transparent fill.
- **Keyboard.** `Ctrl+O` opens a text file, `Ctrl+S` saves as Markdown, the note
  has focus at launch, and focus returns to where it was after the confirm dialog.
- **Button labels stay** exactly `Open text file` and `Save as Markdown` (fixed by `PRD.md`).
- **Window.** 875x600 when floating (Omarchy's size for floating utility
  windows), minimum 360x200.

## Current state

Plain TypeScript and DOM, no framework. `src/main.ts` builds the page and wires
three feature factories. The content security policy is `style-src 'self'`:
no `style` attributes, no `<style>` elements; classes in `src/style.css` or
single properties like `element.style.gap = "8px"` only.

### `src/main.ts` (lines 20-25)

```ts
root.innerHTML = `
  <header class="app-header">
    <h1>Scratch Pad</h1>
  </header>
  <section class="app-content" aria-label="Scratch Pad"></section>
`
```

Near the end of the file, after the features are created:

```ts
slots.mount("actions", openFeature.button, saveFeature.button)
slots.mount("status", saveFeature.status)
```

`openFeature.openFile()` and `saveFeature.saveMarkdown()` are the two actions
the buttons run.

### `src/errors.ts` (lines 24-26) — no change needed

```ts
  const header = host.querySelector(".app-header")
  if (header) header.after(banner)
  else host.prepend(banner)
```

With the header gone the banner is prepended to `#app`, above the content.
That is the wanted position.

### `src/features/singlenoteeditorfeature.ts` — view setup (about lines 54-73)

```ts
  const actionsHost = activeSlots.host("actions")
  actionsHost.className = "toolbar"

  const statusHost = activeSlots.host("status")
  statusHost.style.marginBottom = "8px"

  const textarea = document.createElement("textarea")
  textarea.setAttribute("aria-label", "Note")
  textarea.rows = 16
  textarea.style.width = "100%"
  textarea.style.minHeight = "360px"
  textarea.readOnly = true

  const editorPanel = panel(textarea)
  host.replaceChildren(actionsHost, statusHost, editorPanel)
```

(`textarea.readOnly = true` was added by plan 002.) `activeSlots.host(name)`
returns a `<div data-slot="name">`. Inside `reload`, after a successful load,
plan 002 added `textarea.readOnly = false`.

### `src/features/savenoteasmarkdownfilefeature.ts` (about lines 26-29)

```ts
  const statusElement = document.createElement("p")
  statusElement.setAttribute("role", "status")
  statusElement.className = "muted"
  statusElement.style.margin = "4px 0"
```

### `src/ui.ts` — `confirmDialog` (lines 84-110)

```ts
export const confirmDialog = (message: string, confirmLabel: string): Promise<boolean> =>
  new Promise(resolve => {
    const overlay = document.createElement("div")
    overlay.className = "dialog-overlay"
    const dialog = document.createElement("div")
    dialog.className = "dialog"
    dialog.setAttribute("role", "alertdialog")
    dialog.setAttribute("aria-modal", "true")
    dialog.setAttribute("aria-label", message)
    const text = document.createElement("p")
    text.textContent = message
    const finish = (answer: boolean) => {
      document.removeEventListener("keydown", onKey)
      overlay.remove()
      resolve(answer)
    }
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") finish(false) }
    const actions = document.createElement("div")
    actions.className = "dialog-actions"
    const cancel = button("Cancel", () => finish(false))
    actions.append(cancel, button(confirmLabel, () => finish(true), { primary: true }))
    dialog.append(text, actions)
    overlay.append(dialog)
    document.addEventListener("keydown", onKey)
    document.body.append(overlay)
    cancel.focus()
  })
```

The overlay is appended to `<body>`, outside `<main id="app">`.

### `src/style.css` (87 lines)

Starts with `/* Native-feeling base: system font, system colors in light and dark, no page scroll.`
and `font: 13px/1.45 -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;`.
It is replaced completely in step 1.

### `src-tauri/tauri.conf.json` — the window (lines 13-22)

```json
    "windows": [
      {
        "label": "main",
        "title": "Scratch Pad",
        "width": 960,
        "height": 640,
        "minWidth": 720,
        "minHeight": 480
      }
    ],
```

### `TRD.md` line 351 contains this clause

`buttons are sized to their label, not stretched across the window; body text uses the system font.`

### Conventions to match

- TypeScript: no semicolons, double quotes, two-space indent, arrow functions, no `any`.
- Tests: Vitest with `// @vitest-environment happy-dom` as the first line of DOM
  tests; see `tests/ui.test.ts` for a short example.
- Some existing tests build a DOM that still contains
  `<header class="app-header">`. That is their own fixture; leave it.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install JS deps (fresh checkout only) | `npm ci` | exit 0 |
| Typecheck | `npm run typecheck` | exit 0 |
| Frontend tests | `npm test` | all pass |
| Production frontend build | `npm run build` | exit 0, writes `dist-web/` |
| Everything | `npm run check` | exit 0 |

The first cargo command in a fresh checkout compiles all dependencies (several
minutes). Do NOT launch the app (`npm run tauri dev`); a reviewer does the
visual launch check after you finish.

## Scope

**In scope** (the only files you should modify):
- `src/style.css` (replace)
- `src/main.ts`
- `src/shortcuts.ts` (create)
- `src/ui.ts` (only `confirmDialog`)
- `src/features/singlenoteeditorfeature.ts` (only the view setup and one focus call)
- `src/features/savenoteasmarkdownfilefeature.ts` (delete one line)
- `src-tauri/tauri.conf.json` (only the window object)
- `tests/shortcuts.test.ts` (create)
- `tests/ui.test.ts` (add tests; do not change existing ones)
- `tests/features/singlenoteeditorfeature.test.ts` (add tests; do not change existing ones)
- `README.md`, `TRD.md` (the edits in step 7 only)

**Out of scope** (do NOT touch):
- `kit/` — frozen starter snapshot; it keeps the old stylesheet on purpose.
- Rust source under `src-tauri/src/`, `src-tauri/capabilities/`, `Cargo.toml`.
- The unused helpers in `src/ui.ts` (`toolbar`, `emptyState`, `clampedText`,
  `field`, `panel`, `multilineText`, `setEnabled`) and in `src/store.ts`. They
  lose their CSS in step 1 but stay exported, because existing tests import them.
- Button labels, message strings, the `aria-label="Note"` on the textarea, the
  save/load logic added by plan 002 (`loaded`, `savedText`, `readOnly`, `flush`).
- No `transparent: true`, no `enableGTKAppId`, no new npm or cargo dependency,
  no web fonts, no icons, no animations or transitions.

## Git workflow

- Branch: `advisor/003-tiling-native-redesign`.
- One commit per step, message style `feat: <what>` / `docs: <what>`.
- Do NOT push or open a PR.

## Steps

### Step 1: Replace `src/style.css`

Replace the whole file with exactly this:

```css
/* Omarchy-native base. The app draws no chrome of its own: the compositor provides the window
   border, rounding and shadow. One monospace font (whatever the system maps "monospace" to).
   Every colour comes from --bg, --fg and --accent; the theme follower may override those three
   (and --sel-bg, --sel-fg, --danger) on the root element. The values here are the fallback. */
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

@media (prefers-color-scheme: dark) {
  :root { --danger: #ff6b6b; }
}

* { box-sizing: border-box; }
[hidden] { display: none !important; }
::selection { color: var(--sel-fg); background: var(--sel-bg); }

html, body { height: 100%; margin: 0; }
body { color: var(--fg); background: var(--bg); overflow: hidden; }
#app { display: flex; flex-direction: column; height: 100%; }
.app-content { display: flex; flex: 1; flex-direction: column; min-height: 0; }

/* The note fills the tile. 14px matches the stock terminal padding and clears rounded window corners. */
.editor {
  flex: 1; min-height: 0; width: 100%; padding: 14px;
  color: var(--fg); background: var(--bg); caret-color: var(--accent);
  border: 0; outline: 0; resize: none; font: inherit;
}

.status-bar {
  display: flex; flex: 0 0 auto; align-items: center; gap: 8px;
  padding: 4px 14px; color: var(--fg-dim); border-top: 1px solid var(--line); font-size: 12px;
}
.status-bar > [data-slot="status"] { flex: 1; min-width: 0; }
.status-bar p { margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.toolbar { display: flex; flex: 0 0 auto; gap: 8px; }
.muted { color: var(--fg-dim); }

.error-banner {
  display: flex; flex: 0 0 auto; align-items: center; gap: 12px;
  padding: 6px 14px; color: var(--danger); border-bottom: 1px solid var(--danger); font-size: 12px;
}
.error-banner p { flex: 1; margin: 0; }
.error-banner button { padding: 0; color: inherit; background: none; border: 0; font: inherit; font-weight: 700; cursor: pointer; }

.button {
  display: inline-flex; flex: 0 0 auto; align-items: center; justify-content: center;
  height: 28px; padding: 0 10px; color: var(--fg); background: transparent;
  border: 1px solid var(--line); border-radius: 0; font: inherit; white-space: nowrap; cursor: pointer;
}
.button:hover:not(:disabled) { background: var(--bg-raised); }
.button.primary { border-color: var(--accent); }
.button:disabled { opacity: 0.45; cursor: default; }

.dialog-overlay {
  position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
  padding: 14px; background: color-mix(in srgb, var(--bg) 70%, transparent);
}
.dialog { max-width: 420px; padding: 14px; background: var(--bg-raised); border: 1px solid var(--accent); }
.dialog p { margin: 0 0 14px; }
.dialog-actions { display: flex; justify-content: flex-end; gap: 8px; }

button:focus-visible { outline: 1px solid var(--accent); outline-offset: 2px; }
```

The `.editor` has `outline: 0` on purpose: it is the whole window, and its focus
is shown by the caret. Buttons keep a visible focus outline.

**Verify**: `grep -c "apple" src/style.css` → `0`

**Verify**: `grep -c "font: 13px/1.5 monospace" src/style.css` → `1`

**Verify**: `npm run build` → exit 0 (Vite accepts the CSS).

### Step 2: The editor fills the window, with a status bar under it

In `src/features/singlenoteeditorfeature.ts`, replace the view setup shown in
"Current state" with:

```ts
  const actionsHost = activeSlots.host("actions")
  actionsHost.className = "toolbar"

  const statusHost = activeSlots.host("status")

  const textarea = document.createElement("textarea")
  textarea.className = "editor"
  textarea.setAttribute("aria-label", "Note")
  textarea.spellcheck = false
  textarea.readOnly = true

  const statusBar = document.createElement("footer")
  statusBar.className = "status-bar"
  statusBar.append(statusHost, actionsHost)
  host.replaceChildren(textarea, statusBar)
```

Remove the now-unused `import { panel } from "../ui"` line.

In the same file, in `reload`, directly after the line `textarea.readOnly = false`,
add `textarea.focus()`.

In `src/features/savenoteasmarkdownfilefeature.ts`, delete the line
`statusElement.style.margin = "4px 0"`.

**Verify**: `grep -c "minHeight\|rows = \|marginBottom\|panel" src/features/singlenoteeditorfeature.ts` → `0`

**Verify**: `grep -c "style.margin" src/features/savenoteasmarkdownfilefeature.ts` → `0`

**Verify**: `npm run typecheck && npm test` → exit 0, all tests pass.

### Step 3: Remove the header

In `src/main.ts`, replace the `root.innerHTML = ...` statement with:

```ts
root.innerHTML = `<section class="app-content" aria-label="Scratch Pad"></section>`
```

**Verify**: `grep -c "app-header" src/main.ts` → `0`

### Step 4: Keyboard shortcuts

Create `src/shortcuts.ts`:

```ts
/** Ctrl+O and Ctrl+S run the two actions. Super is left alone: it belongs to the window manager. */
export const bindShortcuts = (target: Document, actions: { open: () => void; save: () => void }): void => {
  target.addEventListener("keydown", event => {
    if (!event.ctrlKey || event.altKey || event.shiftKey || event.metaKey) return
    // A confirmation is open: its buttons are the only valid actions.
    if (target.querySelector(".dialog-overlay")) return
    const action = { o: actions.open, s: actions.save }[event.key.toLowerCase()]
    if (!action) return
    event.preventDefault()
    action()
  })
}
```

If TypeScript rejects the index expression under `noUncheckedIndexedAccess`,
write it as two `if` branches instead; keep the behaviour identical.

In `src/main.ts`, import it and, after the two `slots.mount(...)` lines, add:

```ts
openFeature.button.title = "Ctrl+O"
saveFeature.button.title = "Ctrl+S"
bindShortcuts(document, {
  open: () => void openFeature.openFile(),
  save: () => void saveFeature.saveMarkdown(),
})
```

Create `tests/shortcuts.test.ts` (first line `// @vitest-environment happy-dom`)
with these tests, each binding to the test `document` with `vi.fn()` actions and
dispatching `new KeyboardEvent("keydown", { key, ctrlKey: true, cancelable: true })`:

1. `Ctrl+O` calls `open` once and the event's `defaultPrevented` is `true`.
2. `Ctrl+S` calls `save` once; uppercase `key: "S"` with `ctrlKey` also works.
3. Plain `o`, `Ctrl+Shift+S`, `Ctrl+Alt+O` and `Ctrl+X` call nothing and do not
   prevent default.
4. With an element of class `dialog-overlay` appended to `document.body`,
   `Ctrl+S` calls nothing. Remove the element at the end of the test.

Because every test adds a listener to the same `document`, use fresh `vi.fn()`
actions per test and assert on those only.

**Verify**: `npx vitest run tests/shortcuts.test.ts` → 4 tests pass.

**Verify**: `npm run typecheck` → exit 0.

### Step 5: The confirm dialog blocks the page behind it and gives focus back

In `src/ui.ts`, change `confirmDialog` so that it remembers the focused element,
makes `#app` inert while open, and restores both on close. Add at the top of the
promise body:

```ts
    const app = document.querySelector<HTMLElement>("#app")
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
```

Change `finish` to:

```ts
    const finish = (answer: boolean) => {
      document.removeEventListener("keydown", onKey)
      overlay.remove()
      app?.removeAttribute("inert")
      previous?.focus()
      resolve(answer)
    }
```

and directly before `document.body.append(overlay)` add
`app?.setAttribute("inert", "")`.

Add two tests to `tests/ui.test.ts` (inside the existing `describe`):

1. **"makes the page behind the dialog inert and gives focus back"** — set
   `document.body.innerHTML = '<main id="app"><textarea></textarea></main>'`,
   focus the textarea, call `confirmDialog("Sure?", "Yes")`. Assert
   `document.querySelector("#app")!.hasAttribute("inert")` is `true`. Click the
   Cancel button (`.dialog button`, first one), await the promise, then assert
   `inert` is gone and `document.activeElement` is the textarea.
2. **"works when there is no #app element"** — set `document.body.innerHTML = ""`,
   open the dialog, click the confirm button, expect the promise to resolve `true`.

**Verify**: `npx vitest run tests/ui.test.ts` → 7 tests pass (5 existing + 2).

### Step 6: Window settings for tiling

In `src-tauri/tauri.conf.json`, replace the window object with:

```json
      {
        "label": "main",
        "title": "Scratch Pad",
        "width": 875,
        "height": 600,
        "minWidth": 360,
        "minHeight": 200,
        "decorations": false
      }
```

**Verify**: `node -e "const w=require('./src-tauri/tauri.conf.json').app.windows[0]; console.log(w.decorations, w.minWidth, w.minHeight, w.width, w.height, w.label)"` → `false 360 200 875 600 main`

**Verify**: `cargo test --manifest-path src-tauri/Cargo.toml` → all pass (the config is compiled into the tests).

### Step 7: Editor tests and docs

Add to `tests/features/singlenoteeditorfeature.test.ts` (inside the existing
`describe`, same setup as its first test):

1. **"lays out the note above a status bar and focuses it once loaded"** — after
   `flushMicrotasks()`: `.app-content` has exactly two children; the first is
   the `textarea` with class `editor`; the second is a `footer.status-bar` that
   contains `[data-slot="status"]` followed by `[data-slot="actions"]`;
   `document.activeElement` is the textarea.

In `TRD.md`, in the line that contains
`buttons are sized to their label, not stretched across the window; body text uses the system font.`,
replace `body text uses the system font` with
`all text uses the system monospace font`. Change nothing else on that line.

In `README.md`, insert these two sections directly before the `## Layout` heading:

```markdown
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
```

**Verify**: `grep -c "all text uses the system monospace font" TRD.md` → `1`

**Verify**: `grep -c "^## Keyboard\|^## Design" README.md` → `2`

**Verify**: `npm run check` → exit 0.

## Test plan

- `tests/shortcuts.test.ts` (new, 4 tests) — step 4.
- `tests/ui.test.ts` (+2 tests) — step 5.
- `tests/features/singlenoteeditorfeature.test.ts` (+1 test) — step 7.
- Expected total after this plan: 36 (after plan 002) + 7 = 43 frontend tests.
- Visual result is checked by the reviewer, not by you: they launch the app,
  confirm there is no title bar, that the note fills the tile at several sizes,
  and take a screenshot.

## Done criteria

ALL must hold:

- [ ] `npm run check` exits 0, with 43 frontend tests passed
- [ ] `npm run build` exits 0
- [ ] `grep -rn "apple\|SF Pro" src/` returns no matches, and `grep -c "app-header" src/main.ts` prints `0` (the lookup in `src/errors.ts` stays)
- [ ] `grep -c "decorations\": false" src-tauri/tauri.conf.json` prints `1`
- [ ] `grep -rn "style.minHeight\|style.width\|style.margin" src/` returns no matches
- [ ] `git status --short` and `git diff --name-only` against the starting commit list only in-scope files
- [ ] `git diff --stat <starting commit>..HEAD -- kit src-tauri/src src-tauri/capabilities` is empty

## STOP conditions

Stop and report back (do not improvise) if:

- The dependency check in the header fails (plans 001/002 not applied).
- The code at the locations in "Current state" does not match the excerpts.
- An existing test fails and the fix would mean changing that test's assertions.
- `cargo test` fails after step 6 with an error about the window configuration.
- You find yourself wanting to edit a file under `kit/` or a Rust source file.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- **Unverified until the reviewer's launch check:** that `decorations: false`
  removes the GTK header bar under tao 0.35 on Hyprland, and what the window
  class is (`scratch-pad` or `com.scratch.pad`). If a title bar still shows, the
  fallback is a Hyprland window rule, not more app code.
- `src/ui.ts` still exports list/form helpers whose CSS classes no longer
  exist. They are unused; delete them together with their tests in
  `tests/ui.test.ts` and `tests/store.test.ts` in a later cleanup.
- `kit/` now differs from `src/` in `style.css`, `ui.ts`, `errors.ts` and
  `main.ts`. `kit/` is a historical snapshot; do not sync it.
- Plan 004 overrides `--bg`, `--fg`, `--accent`, `--sel-bg`, `--sel-fg` and
  `--danger` at runtime. Keep those names stable.
- New keyboard shortcuts are not in `PRD.md`; the owner may want to record them there.
