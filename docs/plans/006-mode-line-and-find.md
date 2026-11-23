# Plan 006: The bottom bar is an editor mode line, and Ctrl+F finds text in the note

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: this plan is applied on top of plan 005.
> Confirm it is present: `grep -c "var(--font-size, 13px)" src/style.css && test -f src/font.ts`
> → prints `1` and exits 0. If not, STOP: the dependency is missing.
> Then compare the "Current state" excerpts below against the live code; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (visual and interaction change; a reviewer checks it in the running app)
- **Depends on**: plans/005-terminal-font-size.md
- **Category**: direction
- **Planned at**: commit `af9d1ba` plus plan 005, 2026-11-14

## Why this matters

Scratch Pad is a one-note desktop app for Omarchy (Hyprland, tiling). It looks
like a terminal and is used from the keyboard, but its bottom bar is nearly
empty: two bordered buttons and nothing else. The owner asked for a more modern
and more functional scratch pad and chose two things:

1. **A mode line**, like `nano` or `vim` have: whether the note is saved, where
   the cursor is, how many words the note holds, and the two actions shown as
   quiet key hints instead of bordered buttons.
2. **Find in note**: Ctrl+F, type, Enter to jump from match to match.

## Design (decided — do not revisit)

The visual language is a terminal editor's, not a web app's. All colours come
from the existing CSS variables (`--bg`, `--fg`, `--accent`, `--fg-dim`,
`--line`, `--bg-raised`); one monospace font; no icons, cards, shadows,
rounded corners, gradients or animations.

```
 note text fills the tile

 -----------------------------------------------------------------------
 ● Saved   12:4   182 words        ^O Open text file  ^S Save as Markdown
```

While finding, the left part is replaced by the find field:

```
 Find [query________]  3 of 12      ^O Open text file  ^S Save as Markdown
```

- **Save state**: `Saved` when the stored note equals the text on screen,
  `Unsaved` otherwise. A dot before it is dim when saved and accent-coloured
  when unsaved. Nothing is shown while the note failed to load.
- **Cursor**: `line:column`, both starting at 1, with a tooltip
  `Line 12, column 4`.
- **Words**: `182 words`, `1 word`, `0 words`.
- **Actions**: the same two buttons with the same labels (`Open text file`,
  `Save as Markdown`; these strings are fixed by `PRD.md`), restyled without a
  border, each preceded by its key written the terminal way: `^O`, `^S`.
- **Empty note**: the textarea shows the placeholder
  `Type here. The note saves as you type.`
- **Find**:
  - `Ctrl+F` shows the find field in the mode line and focuses it, with any
    previous query selected.
  - Typing shows a count: `12 matches`, `1 match`, `No matches`; nothing for an
    empty query. Matching ignores case and matches do not overlap.
  - `Enter` jumps to the next match after the cursor, wrapping at the end;
    `Shift+Enter` to the previous one. The match is selected in the note, the
    note scrolls so the match is visible, **focus moves to the note** (so the
    selection is painted), and the count becomes `3 of 12`.
  - While the find field is shown, `Enter` and `Shift+Enter` keep meaning next
    and previous even when focus is in the note. This is deliberate: otherwise
    a second Enter would replace the selected match with a line break.
  - `Esc` hides the find field and focuses the note. The current match stays selected.
  - With no matches, `Enter` does nothing.
  - Find never changes the note's text.

## Current state

Plain TypeScript and DOM, no framework. Features are factory functions that
receive their dependencies. The content security policy is `style-src 'self'`:
no `style` attributes and no `<style>` elements; use classes from
`src/style.css` or single properties (`element.style.width = "10px"`).

### `src/features/singlenoteeditorfeature.ts`

The shared state and the editor's public interface:

```ts
export interface SharedViewState {
  note: Note[]          // the stored note: [] or [{ id, text }]
  draft: string         // the text on screen
  loadError: string | null
}

export interface SingleNoteEditor {
  setDraft: (text: string) => void
  replaceNote: (text: string) => Promise<boolean>
  /** Writes any unsaved text now. Resolves true when nothing is left unsaved. */
  flush: () => Promise<boolean>
}

export const createSingleNoteEditorFeature = (
  deps: SingleNoteEditorDeps,
): SingleNoteEditor => {
```

Its view setup:

```ts
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

and it ends with:

```ts
  return {
    setDraft,
    replaceNote,
    flush,
  }
```

`statusHost` is `<div data-slot="status">` and `actionsHost` is
`<div data-slot="actions" class="toolbar">`. The store is updated on every
keystroke (`draft`) and after every save (`note`). A failed save leaves `note`
at the old text, so `note[0]?.text !== draft` is exactly "unsaved".

### `src/main.ts` — the wiring this plan extends

```ts
slots.mount("actions", openFeature.button, saveFeature.button)
slots.mount("status", saveFeature.status)

openFeature.button.title = "Ctrl+O"
saveFeature.button.title = "Ctrl+S"
bindShortcuts(document, {
  open: () => void openFeature.openFile(),
  save: () => void saveFeature.saveMarkdown(),
})
```

`saveFeature.status` is a `<p role="status" class="muted">` that shows
`The file was saved.` after an export. `editor` is the value returned by
`createSingleNoteEditorFeature`. `store` is imported from the editor module.

### `src/shortcuts.ts` (whole file)

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

### `src/style.css` — the status bar rules today

```css
.status-bar {
  display: flex; flex: 0 0 auto; align-items: center; gap: 8px;
  padding: 4px 14px; color: var(--fg-dim); border-top: 1px solid var(--line); font-size: 0.92em;
}
.status-bar > [data-slot="status"] { flex: 1; min-width: 0; }
.status-bar p { margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.toolbar { display: flex; flex: 0 0 auto; gap: 8px; }
```

`.button` is a 28px-high bordered button, also used by the confirm dialog.
`.editor` is the textarea: `flex: 1; padding: 14px; font: inherit; resize: none; border: 0; outline: 0`.

### Conventions to match

- TypeScript: no semicolons, double quotes, two-space indent, arrow functions,
  `const`, no `any`. `tsconfig.json` has `strict` and `noUncheckedIndexedAccess`.
- Tests: Vitest, first line `// @vitest-environment happy-dom` for DOM tests.
  Model new feature tests on `tests/shortcuts.test.ts` (keyboard events) and
  `tests/features/singlenoteeditorfeature.test.ts` (store-driven DOM).
- Existing tests create fake editors typed as `SingleNoteEditor`
  (`{ setDraft, replaceNote, flush }`). Do not add a required member to that
  interface; step 1 adds a separate extended interface instead.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install JS deps (fresh checkout only) | `npm ci` | exit 0 |
| Typecheck | `npm run typecheck` | exit 0 |
| Frontend tests | `npm test` | all pass |
| Production frontend build | `npm run build` | exit 0 |
| Everything | `npm run check` | exit 0 |

No Rust file changes in this plan. Do NOT launch the app.

## Scope

**In scope** (the only files you should modify):
- `src/features/singlenoteeditorfeature.ts` (expose the textarea, add the placeholder)
- `src/features/modelinefeature.ts` (create)
- `src/features/findfeature.ts` (create)
- `src/shortcuts.ts`
- `src/main.ts`
- `src/style.css`
- `tests/features/modelinefeature.test.ts` (create)
- `tests/features/findfeature.test.ts` (create)
- `tests/shortcuts.test.ts` (add one test)
- `tests/features/singlenoteeditorfeature.test.ts` (add one test)
- `README.md` (the edits in step 6 only)

**Out of scope** (do NOT touch):
- Everything under `src-tauri/`, `kit/`, `package.json`, lockfiles.
- The save, load and flush logic of the editor; the store shape; `src/errors.ts`,
  `src/theme.ts`, `src/font.ts`, `src/ui.ts`, `src/close.ts`.
- Button labels and every existing user-visible string.
- No replace, no regular expressions, no case-sensitivity toggle, no match
  highlighting other than the one selected match, no line numbers, no Markdown
  rendering, no new dependency.

## Git workflow

- Branch: `advisor/006-mode-line-and-find`.
- One commit per step, message style `feat: <what>` / `test: <what>` / `docs: <what>`.
- Do NOT push or open a PR.

## Steps

### Step 1: The editor exposes its textarea and shows a placeholder

In `src/features/singlenoteeditorfeature.ts`:

- After the `SingleNoteEditor` interface add:

  ```ts
  /** The editor as main.ts sees it: features that read the cursor or selection need the element. */
  export interface SingleNoteEditorView extends SingleNoteEditor {
    textarea: HTMLTextAreaElement
  }
  ```

- Change the factory's return type from `SingleNoteEditor` to `SingleNoteEditorView`
  and add `textarea,` to the returned object.
- After `textarea.spellcheck = false` add
  `textarea.placeholder = "Type here. The note saves as you type."`

Add one test to `tests/features/singlenoteeditorfeature.test.ts`:
**"returns its textarea and shows a hint in an empty note"** — the returned
`editor.textarea` is the `textarea[aria-label="Note"]` element in the document
and its `placeholder` is `Type here. The note saves as you type.`

**Verify**: `npm run typecheck && npm test` → exit 0; 62 tests (61 after plan 005 + 1).

### Step 2: The mode line

Create `src/features/modelinefeature.ts`:

```ts
import type { createNoteStore } from "./singlenoteeditorfeature"

/** Words separated by whitespace; an empty or blank note has none. */
export const countWords = (text: string): number => {
  const trimmed = text.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

/** The 1-based line and column of a position in the text. */
export const positionOf = (text: string, index: number): { line: number; column: number } => {
  const before = text.slice(0, index)
  return { line: before.split("\n").length, column: index - before.lastIndexOf("\n") }
}

export interface ModeLineDeps {
  store: ReturnType<typeof createNoteStore>
  textarea: HTMLTextAreaElement
}

/** The editor's status line: whether the note is saved, where the cursor is, and how long the note is. */
export const createModeLineFeature = (deps: ModeLineDeps): { element: HTMLElement } => {
  const element = document.createElement("div")
  element.className = "mode-line"
  const state = document.createElement("span")
  const position = document.createElement("span")
  const words = document.createElement("span")
  element.append(state, position, words)

  const renderState = (): void => {
    const { note, draft, loadError } = deps.store.get()
    // A note that failed to load is neither saved nor unsaved.
    const label = loadError ? "" : (note[0]?.text ?? "") === draft ? "Saved" : "Unsaved"
    state.textContent = label
    if (label) state.dataset.state = label.toLowerCase()
    else delete state.dataset.state
    const count = countWords(draft)
    words.textContent = `${count} ${count === 1 ? "word" : "words"}`
  }

  const renderPosition = (): void => {
    const { line, column } = positionOf(deps.textarea.value, deps.textarea.selectionStart)
    position.textContent = `${line}:${column}`
    position.title = `Line ${line}, column ${column}`
  }

  deps.store.subscribe(() => {
    renderState()
    renderPosition()
  })
  for (const type of ["keyup", "click", "input", "select", "focus"]) {
    deps.textarea.addEventListener(type, renderPosition)
  }
  document.addEventListener("selectionchange", renderPosition)
  renderState()
  renderPosition()
  return { element }
}
```

Create `tests/features/modelinefeature.test.ts` (happy-dom). Build a store with
`createNoteStore()` and a `textarea` appended to `document.body`. Tests:

1. `countWords`: `""` → 0, `"   \n "` → 0, `"one"` → 1, `"one  two\nthree"` → 3.
2. `positionOf`: `("", 0)` → `{ line: 1, column: 1 }`; `("ab\ncd", 2)` → `{ line: 1, column: 3 }`;
   `("ab\ncd", 3)` → `{ line: 2, column: 1 }`; `("ab\ncd", 5)` → `{ line: 2, column: 3 }`.
3. **shows Saved when the stored note equals the text** — `store.set({ note: [{ id: 1, text: "hi" }], draft: "hi" })`;
   the first span's text is `Saved` and its `dataset.state` is `saved`.
4. **shows Unsaved when they differ, and for a new note with text** —
   `store.set({ draft: "hi there" })` → `Unsaved`, `dataset.state` `unsaved`;
   and with `note: []`, `draft: "x"` → `Unsaved`; with `note: []`, `draft: ""` → `Saved`.
5. **shows no save state when the note failed to load** — `store.set({ loadError: "The note could not be loaded." })`
   → first span text `""` and `dataset.state` is `undefined`.
6. **counts words with the right noun** — `draft: "one"` → `1 word`; `draft: "one two"` → `2 words`; `draft: ""` → `0 words`.
7. **shows the cursor position** — set `textarea.value = "ab\ncd"`, `textarea.setSelectionRange(4, 4)`,
   dispatch `new Event("keyup")` on the textarea; the second span's text is `2:2` and its `title` is `Line 2, column 2`.

**Verify**: `npx vitest run tests/features/modelinefeature.test.ts` → 7 tests pass.

### Step 3: Find in note

Create `src/features/findfeature.ts`:

```ts
/** Start positions of every match of query in text; case-insensitive, matches never overlap. */
export const findMatches = (text: string, query: string): number[] => {
  if (!query) return []
  const haystack = text.toLowerCase()
  const needle = query.toLowerCase()
  const matches: number[] = []
  for (let at = haystack.indexOf(needle); at !== -1; at = haystack.indexOf(needle, at + needle.length)) {
    matches.push(at)
  }
  return matches
}

/** Which match to go to from a cursor position: the next one at or after it, or the previous one before it; wraps. */
export const stepFrom = (matches: number[], cursor: number, backwards: boolean): number => {
  if (backwards) {
    const before = matches.filter(at => at < cursor).length - 1
    return before >= 0 ? before : matches.length - 1
  }
  const next = matches.findIndex(at => at >= cursor)
  return next >= 0 ? next : 0
}

export interface FindDeps {
  textarea: HTMLTextAreaElement
  /** Scrolls the note so the character at this position is visible. */
  reveal: (index: number) => void
}

export interface FindFeature {
  element: HTMLElement
  open: () => void
}

/** Find in the note: a field in the status line; Enter and Shift+Enter step through the matches. */
export const createFindFeature = (deps: FindDeps): FindFeature => {
  const element = document.createElement("div")
  element.className = "find-bar"
  element.hidden = true
  const label = document.createElement("label")
  label.textContent = "Find"
  const input = document.createElement("input")
  input.type = "text"
  input.setAttribute("aria-label", "Find in note")
  input.spellcheck = false
  const count = document.createElement("span")
  count.setAttribute("role", "status")
  element.append(label, input, count)

  const describe = (total: number): string =>
    !input.value ? "" : total === 0 ? "No matches" : total === 1 ? "1 match" : `${total} matches`

  const step = (backwards: boolean): void => {
    const matches = findMatches(deps.textarea.value, input.value)
    if (matches.length === 0) {
      count.textContent = describe(0)
      return
    }
    // Going forwards starts after the current selection, so a repeated Enter moves on.
    const cursor = backwards ? deps.textarea.selectionStart : deps.textarea.selectionEnd
    const selected = deps.textarea.selectionEnd > deps.textarea.selectionStart
    const index = stepFrom(matches, selected || backwards ? cursor : deps.textarea.selectionStart, backwards)
    const at = matches[index]
    if (at === undefined) return
    deps.textarea.focus()
    deps.textarea.setSelectionRange(at, at + input.value.length)
    deps.reveal(at)
    count.textContent = `${index + 1} of ${matches.length}`
  }

  const close = (): void => {
    element.hidden = true
    deps.textarea.focus()
  }

  input.addEventListener("input", () => {
    count.textContent = describe(findMatches(deps.textarea.value, input.value).length)
  })

  // While the field is shown, Enter means "next match" in the note too: a plain Enter there
  // would replace the selected match with a line break.
  document.addEventListener("keydown", event => {
    if (element.hidden || document.querySelector(".dialog-overlay")) return
    if (event.key === "Escape") {
      event.preventDefault()
      close()
    } else if (event.key === "Enter" && !event.ctrlKey && !event.altKey && !event.metaKey) {
      event.preventDefault()
      step(event.shiftKey)
    }
  })

  return {
    element,
    open: () => {
      element.hidden = false
      input.focus()
      input.select()
      count.textContent = describe(findMatches(deps.textarea.value, input.value).length)
    },
  }
}
```

Create `tests/features/findfeature.test.ts` (happy-dom). In `beforeEach` set
`document.body.innerHTML = ""`. Helper: create a `textarea` with a given value
appended to `document.body`, `reveal = vi.fn()`, create the feature, append
`feature.element` to `document.body`. To type a query: set `input.value` and
dispatch `new Event("input")` on the input. To press a key: dispatch
`new KeyboardEvent("keydown", { key, shiftKey, bubbles: true, cancelable: true })` on `document`.

Because every feature instance adds a `document` keydown listener and they are
never removed, earlier instances stay alive across tests: before each test,
hide leftovers by keeping every created feature's `element.hidden = true` at
the end of the test (an `afterEach` that hides the current feature's element is enough).

Tests:

1. `findMatches`: `("Hello hello HELLO", "hello")` → `[0, 6, 12]`; `("aaaa", "aa")` → `[0, 2]`;
   `("abc", "")` → `[]`; `("abc", "x")` → `[]`.
2. `stepFrom`: with `[2, 10, 20]` — `(…, 0, false)` → 0; `(…, 10, false)` → 1; `(…, 21, false)` → 0 (wraps);
   `(…, 10, true)` → 0; `(…, 2, true)` → 2 (wraps); `(…, 25, true)` → 2.
3. **opens with the field focused and hidden before that** — `element.hidden` is `true` after creation;
   after `open()` it is `false` and `document.activeElement` is the input.
4. **counts matches while typing** — text `"one two one"`: query `one` → `2 matches`; query `two` → `1 match`;
   query `zzz` → `No matches`; query `""` → `""`.
5. **Enter selects the next match, focuses the note and reports its number** — text `"one two one"`,
   cursor at 0 (`setSelectionRange(0, 0)`), `open()`, query `one`, press Enter:
   `selectionStart` 0, `selectionEnd` 3, `document.activeElement` is the textarea, count `1 of 2`,
   `reveal` called with `0`. Press Enter again: selection `8`–`11`, count `2 of 2`. Again: wraps to `0`–`3`.
6. **Shift+Enter goes backwards and wraps** — same text, cursor at 0, query `one`, press Shift+Enter:
   selection `8`–`11`, count `2 of 2`. Press Shift+Enter again: `0`–`3`.
7. **Enter with no matches changes nothing** — query `zzz`, cursor at 4: after Enter the selection is still `4`–`4`,
   `reveal` not called, the textarea's `value` unchanged.
8. **Escape hides the field and focuses the note** — after `open()` and Escape: `element.hidden` is `true`,
   `document.activeElement` is the textarea.
9. **keys are left alone while the field is hidden** — without `open()`, an Enter keydown event's
   `defaultPrevented` is `false` and the selection does not change.
10. **Enter is prevented while the field is shown** — after `open()` with a matching query, the Enter
    event's `defaultPrevented` is `true`.

**Verify**: `npx vitest run tests/features/findfeature.test.ts` → 10 tests pass.

### Step 4: Ctrl+F

In `src/shortcuts.ts`, add `find` to the actions:

- signature: `actions: { open: () => void; save: () => void; find: () => void }`
- lookup: `{ o: actions.open, s: actions.save, f: actions.find }`
- doc comment: `/** Ctrl+O, Ctrl+S and Ctrl+F run the three actions. Super is left alone: it belongs to the window manager. */`

Update the existing tests in `tests/shortcuts.test.ts` so each `actions` object
also has `find: vi.fn()`, and add one test: **"Ctrl+F opens find and prevents the default"**.

**Verify**: `npx vitest run tests/shortcuts.test.ts` → 5 tests pass.

### Step 5: Wire it and style it

In `src/main.ts`, import `createModeLineFeature` and `createFindFeature`, and
replace the block shown in "Current state" with:

```ts
// Where a position in the note sits vertically, measured with an off-screen copy of the text
// (a textarea cannot report the position of a character).
const reveal = (index: number): void => {
  const mirror = document.createElement("div")
  mirror.className = "editor editor-mirror"
  mirror.style.width = `${editor.textarea.clientWidth}px`
  mirror.textContent = editor.textarea.value.slice(0, index)
  editor.textarea.after(mirror)
  const top = mirror.offsetHeight
  mirror.remove()
  editor.textarea.scrollTop = Math.max(0, top - editor.textarea.clientHeight / 2)
}

const modeLine = createModeLineFeature({ store, textarea: editor.textarea })
const find = createFindFeature({ textarea: editor.textarea, reveal })

slots.mount("actions", openFeature.button, saveFeature.button)
slots.mount("status", modeLine.element, find.element, saveFeature.status)

openFeature.button.title = "Ctrl+O"
openFeature.button.dataset.key = "^O"
saveFeature.button.title = "Ctrl+S"
saveFeature.button.dataset.key = "^S"
bindShortcuts(document, {
  open: () => void openFeature.openFile(),
  save: () => void saveFeature.saveMarkdown(),
  find: find.open,
})
```

In `src/style.css`, replace the four status-bar rules shown in "Current state"
with:

```css
/* The mode line: save state, cursor, word count on the left; the actions as key hints on the right. */
.status-bar {
  display: flex; flex: 0 0 auto; flex-wrap: wrap; align-items: center; gap: 2px 2ch;
  padding: 4px 14px; color: var(--fg-dim); border-top: 1px solid var(--line); font-size: 0.92em;
}
.status-bar > [data-slot="status"] { display: flex; flex: 1 1 auto; align-items: center; gap: 2ch; min-width: 0; }
.status-bar p { flex: 1 1 0; min-width: 0; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.toolbar { display: flex; flex: 0 0 auto; gap: 1ch; }

.mode-line { display: flex; flex: 0 0 auto; gap: 2ch; white-space: nowrap; font-variant-numeric: tabular-nums; }
.mode-line [data-state]::before { content: "\25CF"; margin-right: 1ch; color: var(--line); }
.mode-line [data-state="unsaved"] { color: var(--fg); }
.mode-line [data-state="unsaved"]::before { color: var(--accent); }
/* Finding takes the mode line's place. */
.status-bar:has(.find-bar:not([hidden])) .mode-line { display: none; }

.find-bar { display: flex; flex: 0 1 auto; align-items: center; gap: 1ch; min-width: 0; white-space: nowrap; }
.find-bar input {
  width: 24ch; min-width: 8ch; padding: 2px 6px; color: var(--fg); background: var(--bg-raised);
  border: 1px solid var(--line); border-radius: 0; outline: 0; font: inherit;
}
.find-bar input:focus-visible { border-color: var(--accent); }

/* In the mode line the actions are key hints, not boxes. */
.status-bar .button { height: auto; padding: 2px 6px; color: var(--fg-dim); border-color: transparent; }
.status-bar .button:hover:not(:disabled) { color: var(--fg); }
.button[data-key]::before { content: attr(data-key); margin-right: 1ch; color: var(--fg); }
```

and add, directly after the `.editor { ... }` rule:

```css
.editor::placeholder { color: var(--fg-dim); }
/* An off-screen copy of the note's text, used to measure where a match sits. */
.editor-mirror {
  position: absolute; visibility: hidden; flex: none; height: auto; min-height: 0;
  white-space: pre-wrap; overflow-wrap: break-word; pointer-events: none;
}
```

Check that `.app-content` (the parent of the textarea) has `position: relative`
so the mirror is positioned inside it; if it has no `position`, add
`position: relative;` to the `.app-content` rule.

**Verify**: `npm run typecheck` → exit 0.

**Verify**: `npm run build` → exit 0.

**Verify**: `grep -c "mode-line" src/style.css` → at least `4`; `grep -c "find: find.open" src/main.ts` → `1`.

### Step 6: Docs

In `README.md`, in the table under `## Keyboard`, add these rows after the `Ctrl+S` row:

```markdown
| `Ctrl+F` | Find in the note |
| `Enter` / `Shift+Enter` | Next / previous match, while the find field is shown |
```

and change the `Esc` row to: ``| `Esc` | Close the find field, or cancel the confirmation |``

In the `## Design` section, add this bullet at the end of the list:

```markdown
- The bottom line is a mode line, as in a terminal editor: save state, cursor
  position (`line:column`), word count, then the actions as key hints (`^O`, `^S`).
  Finding (`Ctrl+F`) takes its place while active.
```

**Verify**: `grep -c "Ctrl+F" README.md` → at least `1`.

**Verify**: `npm run check` → exit 0.

## Test plan

- `tests/features/modelinefeature.test.ts` (new, 7 tests) — step 2.
- `tests/features/findfeature.test.ts` (new, 10 tests) — step 3.
- `tests/shortcuts.test.ts` (+1) — step 4.
- `tests/features/singlenoteeditorfeature.test.ts` (+1) — step 1.
- Expected total: 61 (after plan 005) + 19 = 80 frontend tests.
- Layout, scrolling to a match and the look are checked by the reviewer in the
  running app with screenshots; you do not launch the app.

## Done criteria

ALL must hold:

- [ ] `npm run check` exits 0, with 80 frontend tests passed
- [ ] `npm run build` exits 0
- [ ] `grep -c "SingleNoteEditorView" src/features/singlenoteeditorfeature.ts` prints at least `2`
- [ ] `grep -rn "Open text file\|Save as Markdown" src/features | wc -l` prints the same number as on the starting commit (labels unchanged)
- [ ] `git diff --stat <starting commit>..HEAD -- src-tauri kit package.json package-lock.json src/errors.ts src/theme.ts src/font.ts src/ui.ts src/close.ts` is empty
- [ ] `git diff --name-only <starting commit>..HEAD` lists only in-scope files

## STOP conditions

Stop and report back (do not improvise) if:

- The dependency check in the header fails (plan 005 not applied).
- An excerpt in "Current state" does not match the live code.
- An existing test fails and the fix would mean changing that test's
  assertions (adding `find: vi.fn()` to the shortcut tests' actions is expected
  and allowed).
- A find test cannot pass because happy-dom does not implement
  `setSelectionRange`, `selectionStart` or focus for a textarea. Report which
  call fails; do not rewrite the feature around it.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- New user-visible strings not in `PRD.md`: `Saved`, `Unsaved`, `N words`,
  `Find`, `N matches`, `No matches`, `N of M`, and the placeholder
  `Type here. The note saves as you type.` The owner may want them recorded there.
- While the find field is shown, Enter cannot insert a line break in the note.
  That is intended; Esc closes the field.
- `reveal` in `src/main.ts` depends on the `.editor-mirror` rule copying the
  textarea's padding, font and wrapping. If the editor's CSS changes, check
  that a far-down match still scrolls into view.
- A reviewer should check, in the running app: the mode line at a narrow width
  (it wraps to two lines), `Unsaved` appearing while typing and returning to
  `Saved`, and Ctrl+F on a note long enough to scroll.
- Deferred: replace, case-sensitive search, highlighting all matches.
