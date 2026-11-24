# Plan 009: Keys go to the right layer (find, error banner, buttons)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. Do NOT edit `docs/plans/README.md`: the reviewer
> maintains the index.
>
> **Drift check (run first)**: `git diff --stat bb5a1a2..HEAD -- src/features/findfeature.ts src/shortcuts.ts src/main.ts tests/features/findfeature.test.ts tests/shortcuts.test.ts`
> If any of these changed, compare the "Current state" excerpts against the
> live code before proceeding; on a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `bb5a1a2`, 2026-11-24

## Why this matters

Scratch Pad is keyboard first, and four listeners decide what a key means by
asking the DOM what is open. Two combinations are wrong today. With a save-error
banner showing and the find bar open, one Esc closes find and also dismisses the
banner, taking its Retry button with it. While find is open, Enter on any
focused button (previous match, close find, Retry) steps to the next match
instead of pressing the button. Also, the find count goes stale when Ctrl+O
replaces the note, and Ctrl+S/O/F do nothing on a non-Latin keyboard layout.
All 125 tests pass with these bugs because no test builds the pieces together.

## Current state

- `src/features/findfeature.ts` — the find bar. Its document-level key handler (lines 159-171):

```ts
  const onDocumentKeyDown = (event: KeyboardEvent): void => {
    if (element.hidden || document.querySelector(".dialog-overlay")) return
    if (event.key === "Escape") {
      event.preventDefault()
      close()
    } else if (event.key === "Enter" && !event.ctrlKey && !event.altKey && !event.metaKey) {
      event.preventDefault()
      step(event.shiftKey)
    }
  }
  document.addEventListener("keydown", onDocumentKeyDown)
```

  The count is refreshed only from two `input` events (lines 116-118, 150-157):

```ts
  const refreshCount = (): void => {
    count.textContent = describe(findMatches(deps.textarea.value, input.value).length)
  }
  ...
  input.addEventListener("input", refreshCount)

  const onTextareaInput = (): void => {
    if (!element.hidden) refreshCount()
  }
  deps.textarea.addEventListener("input", onTextareaInput)
```

  The public shape (lines 78-82) is `{ element, open, destroy }`.

- `src/shortcuts.ts` — global shortcuts. The Esc branch (lines 29-42) and the letter lookup (line 54):

```ts
    if (event.key === "Escape" && !event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey) {
      if (target.querySelector(".find-bar:not([hidden])")) return
      if (target.querySelector(".error-banner:not([hidden])") && actions.dismissError) {
        event.preventDefault()
        actions.dismissError()
      }
      return
    }
    ...
      if (event.key.toLowerCase() === "c" && actions.copyAll && !hasActiveSelection(target)) {
    ...
    const action = { o: actions.open, s: actions.save, f: actions.find }[event.key.toLowerCase()]
```

  (The Esc condition is spread over several lines in the file.)

- `src/main.ts` — composition root. Find is created at line 72
  (`const find = createFindFeature({ textarea: editor.textarea, reveal })`),
  `bindShortcuts(document, {...})` is called at line 108. Both add a `keydown`
  listener to `document`, so find's runs first. Find hides its bar, then the
  shortcut handler sees no open find bar and dismisses the banner: that is the
  Esc bug.

- Why the count goes stale: opening a file sets the store's `draft`, and a store
  subscriber in `src/features/singlenoteeditorfeature.ts` assigns
  `textarea.value`. Assigning a value fires no `input` event.

- The store (`src/store.ts`) has `subscribe(listener): () => void`. `main.ts`
  imports `store` from `./features/singlenoteeditorfeature`.

- Conventions: no semicolons, double quotes, two-space indent, arrow functions,
  short `//` comments that say why. Tests are Vitest with
  `// @vitest-environment happy-dom` on line 1; see `tests/shortcuts.test.ts`
  (it defines a `press(key, init)` helper that dispatches a cancelable `keydown`
  on `document`) and `tests/features/findfeature.test.ts` (its `setup(text)`
  builds a textarea and the feature).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install (fresh worktree only) | `npm ci` | exit 0 |
| Typecheck | `npm run typecheck` | exit 0 |
| Tests | `npm test` | exit 0, all pass |
| One file | `npx vitest run tests/keyboard.test.ts` | all pass |

Do not run cargo commands; this plan changes no Rust.

## Scope

**In scope** (the only files you may modify):
- `src/features/findfeature.ts`
- `src/shortcuts.ts`
- `src/main.ts`
- `tests/features/findfeature.test.ts`
- `tests/shortcuts.test.ts`
- `tests/keyboard.test.ts` (create)

**Out of scope**:
- `src/features/singlenoteeditorfeature.ts`, `src/features/indent.ts`,
  `src/features/openplaintextfiletoreplacenotefeature.ts`, `src/omarchy.ts`,
  `README.md`, anything under `src-tauri/` — other plans are changing these in
  parallel; touching them causes merge conflicts.
- `src/ui.ts` (the confirm dialog's own key handling is correct).
- `docs/kit/` (a historical snapshot).

## Git workflow

- Branch: `advisor/009-keyboard-layering` (create from the current HEAD).
- One commit per step or one for the plan; message style from `git log`:
  `fix: one Esc closes find without dismissing the error banner`.
- Do NOT push.

## Steps

### Step 1: Esc is handled once

In `src/shortcuts.ts`, at the top of the Esc branch (before the find-bar
check), add `if (event.defaultPrevented) return` with a comment that another
layer (find) already took this Esc. Keep the existing find-bar check.

**Verify**: `npm run typecheck` → exit 0.

### Step 2: Enter belongs to a focused button; composition is left alone

In `src/features/findfeature.ts` `onDocumentKeyDown`:
- return early when `event.isComposing` is true (an input method is committing text);
- in the Enter branch, do nothing (no `preventDefault`, no `step`) when
  `event.target instanceof HTMLButtonElement`, so Enter presses the button.

Enter in the find field and in the note must keep stepping.

**Verify**: `npx vitest run tests/features/findfeature.test.ts` → all pass.

### Step 3: Shortcuts work on non-Latin layouts

In `src/shortcuts.ts`, add a small helper and use it in both places that read
`event.key.toLowerCase()`:

```ts
// On a non-Latin layout event.key is that layout's letter; the physical key still says which shortcut.
const letterOf = (event: KeyboardEvent): string =>
  /^[a-z]$/i.test(event.key)
    ? event.key.toLowerCase()
    : event.code?.startsWith("Key")
      ? event.code.slice(3).toLowerCase()
      : ""
```

A Latin `event.key` always wins, so Dvorak and similar layouts keep working by letter.

**Verify**: `npx vitest run tests/shortcuts.test.ts` → all pass.

### Step 4: The find count follows a replaced note

In `src/features/findfeature.ts`:
- keep the text the count was computed for: `let countedText = ""`, set in
  `refreshCount` (`countedText = deps.textarea.value`);
- add `refresh: () => void` to the `FindFeature` interface and the returned
  object: it returns when the bar is hidden or `deps.textarea.value === countedText`,
  otherwise calls `refreshCount()`. The equality guard matters: the store also
  notifies when only the save state changes, and that must not overwrite a
  "2 of 3" position.

In `src/main.ts`, after `find` is created: `store.subscribe(find.refresh)`
with a one-line comment (a replaced note fires no input event).

**Verify**: `npm run typecheck` → exit 0; `npm test` → exit 0.

### Step 5: Tests

See "Test plan". **Verify**: `npm test` → exit 0 with the new tests.

## Test plan

Create `tests/keyboard.test.ts` (happy-dom), composing the real modules in
`main.ts` order: a `#app` element, `createErrorBanner(app)` from `src/errors`,
a textarea, `createFindFeature({ textarea, reveal: vi.fn() })` appended to the
body, THEN `bindShortcuts(document, { open, save, find: find.open, dismissError: errors.dismiss })`.
In `afterEach` call the unbind function and `find.destroy()` and empty the body.
Cases:

1. Banner shown (`errors.show("x", vi.fn())`) and find open: one `Escape`
   keydown hides the find bar and leaves `.error-banner` visible; a second
   `Escape` hides the banner.
2. Find open with query matching three places: focus the "Previous match"
   button (`[aria-label="Previous match"]`) and dispatch a cancelable, bubbling
   `Enter` keydown ON THE BUTTON: `event.defaultPrevented` is `false` and the
   textarea selection did not move.
3. Same setup, `Enter` dispatched on the find input: `defaultPrevented` is
   `true` and the first match is selected.
4. An `Enter` keydown with `isComposing: true` on the input is not prevented.

Add to `tests/shortcuts.test.ts`: `press("ы", { ctrlKey: true, code: "KeyS" })`
calls `save`; `press("s", { ctrlKey: true, code: "KeyO" })` calls `save`, not `open`.

Add to `tests/features/findfeature.test.ts`: with the bar open and a count
shown, assign `textarea.value` directly (no event) and call `feature.refresh()`:
the count text matches the new text; calling `refresh()` again after an Enter
step leaves the "N of M" text untouched.

## Done criteria

- [ ] `npm run typecheck` exits 0
- [ ] `npm test` exits 0; `tests/keyboard.test.ts` exists with the four cases
- [ ] `grep -n "defaultPrevented" src/shortcuts.ts` returns a match
- [ ] `grep -n "store.subscribe(find.refresh)" src/main.ts` returns a match
- [ ] `git diff --name-only bb5a1a2..HEAD` lists only in-scope files

## STOP conditions

- The excerpts in "Current state" do not match the live code.
- happy-dom does not deliver `isComposing` or `code` on a constructed
  `KeyboardEvent` (then report; do not change production code to suit the test).
- A step's verification fails twice after a reasonable fix attempt.
- The fix seems to need a file outside the scope list.

## Maintenance notes

- The layers still coordinate through `event.defaultPrevented` and DOM queries.
  If a fourth overlay is added, move to one dispatcher in `main.ts` that asks
  layers in priority order (dialog, find, banner).
- Plan 013 builds on `findfeature.ts` as this plan leaves it.
- Not verified in a real window: what WebKitGTK reports for `event.key`,
  `event.code` and `isComposing` under fcitx5/ibus and a Cyrillic layout.
