# Plan 016: A quiet bar and a reading column

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. Do NOT edit `docs/plans/README.md`: the reviewer
> maintains the index.
>
> **Drift check (run first)**: `git diff --stat 32ea742..HEAD -- src tests README.md`
> must be empty (the only later commit adds this plan file). Otherwise compare
> the excerpts below with the live code; on a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: S-M
- **Risk**: LOW-MED (visual change that tests cannot see)
- **Depends on**: none
- **Category**: direction (owner approved proposals 1 and 3 on 2026-11-24)
- **Planned at**: commit `32ea742`, 2026-11-24

## Why this matters

The owner finds the bottom bar distracting but does not want it emptied
("less is more, but minimalism is not nothingness"). It reads
`● Saved  14:62      ^F Find  ^O Open text file  ^⇧S Save as Markdown`. Three
things are wrong with it: `14:62` (the cursor's line and column) reads like a
clock; there is no visible way to save now although Ctrl+S does it; and on a
narrow tile the bar wraps onto several rows. Separately, on a wide tile the
note's lines run the full width of the window, which is hard to read.

After this plan the bar keeps its words but is clearer, and the text sits in a
centred column of at most about 100 characters.

Target bar, wide: `● Saved  Ln 14, Col 62        ^F Find  ^O Open  ^S Save  ^⇧S Export`
Target bar, narrow (640px or less): `● Saved  14, 62            ^F  ^O  ^S  ^⇧S`

## Current state

`src/features/modelinefeature.ts` — the left part of the bar. It creates
`<div class="mode-line">` with two spans, `state` and `position`:

```ts
  const renderState = (): void => {
    const { dirty, loadError } = deps.store.get()
    // A note that failed to load is neither saved nor unsaved.
    const label = loadError ? "" : dirty ? "Unsaved" : "Saved"
    if (label === lastLabel) return
    lastLabel = label
    state.textContent = label
    if (label) state.dataset.state = label.toLowerCase()
    else delete state.dataset.state
  }
```

`renderPosition(textChanged)` writes `"line:column"` or
`"line:column · N sel"` into `position` (and a `title`), using the exported
`positionOf(text, index)`, which scans the text before the caret. Updates are
coalesced to one per animation frame (`schedulePosition`), driven by the store
subscription, the textarea's `input`, `focus`, `keyup`, `click`, `select`
events and the document's `selectionchange`.

`src/style.css` (relevant rules):

```css
.editor {
  flex: 1; min-height: 0; width: 100%; padding: 16px 18px; scroll-padding-block: 24px;
  ...
}
.editor-mirror {
  position: absolute; top: 0; left: 0; visibility: hidden; flex: none; height: auto; min-height: 0;
  white-space: pre-wrap; overflow-wrap: break-word; pointer-events: none;
}
.mode-line { display: flex; flex: 0 0 auto; gap: 2ch; white-space: nowrap; font-variant-numeric: tabular-nums; }
.mode-line [data-state]::before { content: "\25CF"; margin-right: 1ch; color: var(--line); }
.mode-line [data-state="unsaved"] { color: var(--fg); }
.mode-line [data-state="unsaved"]::before { color: var(--accent); }
.toolbar { display: flex; flex: 0 0 auto; gap: 1ch; }
.status-bar .button { height: auto; padding: 2px 6px; color: var(--fg-dim); border-color: transparent; }
.button[data-key]::before { content: attr(data-key); margin-right: 1ch; color: var(--fg); }
```

`.editor-mirror` is an invisible copy of the note (it also has the class
`editor`) that `src/main.ts` uses to measure where a find match sits; it is
given the textarea's `clientWidth` and must wrap text exactly like the textarea.

`src/main.ts` builds the three bar buttons with `button(label, onClick)` from
`src/ui.ts` and gives each a hint, for example:

```ts
const findButton = button("Find", () => find.open())
findButton.title = "Ctrl+F"
findButton.dataset.key = "^F"
...
slots.mount("actions", findButton, openFeature.button, saveFeature.button)
...
openFeature.button.title = "Ctrl+O"
openFeature.button.dataset.key = "^O"
saveFeature.button.title = "Ctrl+Shift+S"
saveFeature.button.dataset.key = "^⇧S"
```

The actions slot's element has the class `toolbar` and sits inside
`<footer class="status-bar">`. `editor.flush()` saves the note now (it is what
Ctrl+S calls). F6 moves focus from the note to the first enabled button in the
bar.

`src/features/singlenoteeditorfeature.ts` line 84:
`textarea.placeholder = "Type here. The note saves as you type."`

`README.md` Highlights says "a quiet mode line for save state and cursor position".

Conventions: no semicolons, double quotes, two-space indent, arrow functions,
short `//` comments that say why. Colours only through the CSS variables
(`--fg`, `--fg-dim`, `--accent`, `--line`, `--bg`): the app ships no palette.
Tests are Vitest with happy-dom; it does not apply stylesheets.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install (fresh worktree only) | `npm ci` | exit 0 |
| Typecheck | `npm run typecheck` | exit 0 |
| Tests | `npm test` | exit 0, all pass |
| Build | `npx vite build` | exit 0 (proves the CSS parses) |

Do not run cargo commands; this plan changes no Rust.

## Scope

**In scope**:
- `src/features/modelinefeature.ts`
- `src/main.ts`
- `src/style.css`
- `src/features/singlenoteeditorfeature.ts` (the `placeholder` line only)
- `tests/features/modelinefeature.test.ts`
- `tests/features/singlenoteeditorfeature.test.ts` (the placeholder assertion only)
- `README.md` (wording only)

**Out of scope**:
- `src/ui.ts` (shared base file; the confirm dialog's buttons use `button()` and must keep their labels).
- `src/features/findfeature.ts`, `src/shortcuts.ts`, `src-tauri/`, `docs/specs/`.
- New colours, fonts, icons or animations. No settings.

## Git workflow

- Branch: `advisor/016-quiet-bar` (you are already on it).
- Commit message style: `feat: a quiet bar and a reading column`.
- Do NOT push.

## Steps

### Step 1: The position cannot be mistaken for a time

In `modelinefeature.ts` `renderPosition`: the text becomes two spans inside
`position`, so the stylesheet can shorten it on a narrow tile:
`<span class="pos-long">Ln 14, Col 62</span><span class="pos-short">14, 62</span>`,
and with a selection ` · N sel` follows (in both). The `title` stays
`"Line 14, column 62"` / `"Line 14, column 62, N selected"`. Build the spans
once and only update their `textContent` when it changes (the function already
avoids redundant DOM writes; keep that). The save-state span (`Saved` /
`Unsaved` with the dot) is NOT changed.

In `style.css`: `.mode-line .pos-short { display: none; }`, and inside the
existing `@media (max-width: 520px)` block change nothing; add a new block
`@media (max-width: 640px)` that hides `.pos-long` and shows `.pos-short`.

**Verify**: `npm run typecheck` → exit 0.

### Step 2: Shorter labels and a Save button

In `main.ts`:
- add a small local helper used for all bar buttons, which moves the button's
  text into `<span class="button-label">`, sets `aria-label` to the full name,
  `title` to `"<full name> (<shortcut>)"` and `data-key` to the hint. The
  visible labels become `Find`, `Open`, `Save`, `Export`; the full names are
  "Find in note", "Open text file", "Save the note now", "Save as Markdown";
- add the Save button: `button("Save", () => void editor.flush())` with hint
  `^S` / `Ctrl+S`, mounted between Open and Export.

The buttons created by `openFeature` and `saveFeature` keep their own text in
their feature files; only `main.ts` rewrites what is shown.

**Verify**: `npm run typecheck` → exit 0.

### Step 3: One row on a narrow tile

In `style.css`:
- `.button-label { margin-left: 1ch; }` and remove the `margin-right` of
  `.button[data-key]::before` (the label now carries the gap);
- in the new `@media (max-width: 640px)` block:
  `.toolbar .button-label { display: none; }`, and show the labels again while
  the toolbar holds keyboard focus:
  `.toolbar:focus-within .button-label { display: inline; }`.

With labels hidden the bar must fit one row at 360 px wide.

**Verify**: `npx vite build` → exit 0.

### Step 4: The empty note names the keys

Set the placeholder to (a real line break after the first sentence):

```
Type here. The note saves by itself.
Ctrl+F find · Ctrl+O open a file · Ctrl+S save now · Ctrl+Shift+S save as Markdown · Ctrl+Shift+C copy all
```

**Verify**: `npm test` → the placeholder test fails until its expected string is updated in Step 6.

### Step 5: The reading column

In `style.css`, `.editor`: keep the block padding of 16px and make the inline
padding grow on a wide window so the text column is at most 100 characters:

```css
  padding: 16px max(18px, calc((100% - 100ch) / 2));
```

with a comment saying why (a readable line length on a wide tile; narrow tiles
keep 18px). `.editor-mirror` already has the class `editor`, so it takes the
same padding; do not give it a different one.

**Verify**: `npx vite build` → exit 0.

### Step 6: Tests and README

See "Test plan". In `README.md`, keep the mode-line wording, mention the Save button (`Ctrl+S`), and add to the "Zero chrome, tiling first" highlight that on a wide
tile the text keeps a readable column of about 100 characters.

**Verify**: `npm test` → exit 0.

## Test plan

`tests/features/modelinefeature.test.ts`:
1. The cursor position: `.pos-long` reads `"Ln 1, Col 3"` and `.pos-short`
   `"1, 3"`; the title is `"Line 1, column 3"`.
2. With 5 characters selected both end in `" · 5 sel"` and the title ends in
   `", 5 selected"`; collapsing the selection removes it.
3. Update the existing tests that asserted `"1:3"`-style text to the new
   format; keep every existing test's intent (state, coalescing,
   selectionchange focus check, redundant DOM writes, `destroy`).
4. The save-state tests stay as they are and must still pass unchanged.

`tests/features/singlenoteeditorfeature.test.ts`: the placeholder assertion
uses the new two-line text.

No test imports `src/main.ts`; do not add one.

## Done criteria

- [ ] `npm run typecheck` exits 0
- [ ] `npm test` exits 0
- [ ] `npx vite build` exits 0
- [ ] `grep -n "pos-long" src/features/modelinefeature.ts src/style.css` matches in both files
- [ ] `grep -n "100ch" src/style.css` returns a match
- [ ] `grep -n "button-label" src/main.ts src/style.css` matches in both files
- [ ] `grep -n "editor.flush()" src/main.ts` shows two uses (the shortcut and the Save button)
- [ ] `git diff --name-only 32ea742..HEAD -- . ':!docs/plans'` lists only in-scope files

## STOP conditions

- The excerpts do not match the live code.
- A verification fails twice after a reasonable fix attempt.
- The change seems to need `src/ui.ts` or `src/features/findfeature.ts`.

## Maintenance notes

- NOT verifiable by tests, to check in the installed app: the bar on one row
  at the 360x200 minimum; labels appearing after F6 on a narrow tile; the column
  on a wide tile and that find still scrolls a match into view (the mirror
  must wrap exactly like the note); the two-line placeholder in WebKitGTK.
- The owner read `14:62` as a time; the position is now spelled `Ln 14, Col 62`. The owner may
  still want it gone: that is one span to remove.
- The find bar replaces the mode line while open (existing CSS); the key hints stay.
