# Plan 015: Autosave after 10 seconds, and Ctrl+S saves the note now

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. Do NOT edit `docs/plans/README.md`: the reviewer
> maintains the index.
>
> **Drift check (run first)**: `git diff --stat e56b0ea..HEAD -- src tests README.md docs/specs`
> must be empty (the only later commit adds this plan file). Otherwise compare
> the excerpts below with the live code; on a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW-MED (it changes what Ctrl+S does)
- **Depends on**: none
- **Category**: direction (owner decision, 2026-11-24)
- **Planned at**: commit `e56b0ea`, 2026-11-24

## Why this matters

The owner finds an autosave every one or five seconds distracting and decided:
the note is written after 10 seconds without typing, and there is a manual
save. Today there is no way to save on demand, and Ctrl+S, the key everyone
presses to save, opens the "Save as Markdown" export dialog instead. After this
plan Ctrl+S writes the note at once and the export moves to Ctrl+Shift+S.
Saving when the window loses focus and when it closes stays as it is: those are
silent and protect the text.

## Current state

- `src/features/singlenoteeditorfeature.ts` line 36-37:

```ts
/** The note is written after this long without typing, and at once on blur and close. */
export const IDLE_SAVE_MS = 5000
```

  The editor returned by `createSingleNoteEditorFeature` has
  `flush: () => Promise<boolean>`: it cancels the idle timer and writes any
  unsaved text now; it resolves true when nothing is left unsaved. A failed
  write already shows the "The note could not be saved." banner with Retry.

- `src/shortcuts.ts`: `ShortcutActions` is
  `{ open, save, find, copyAll?, dismissError? }`. With Ctrl held and Shift not
  held, the letters `o`, `s`, `f` run `open`, `save`, `find`. With Ctrl+Shift,
  only `c` is handled (`copyAll`, when nothing is selected) and the branch
  returns. A helper `letterOf(event)` gives the shortcut letter (it also works
  on non-Latin layouts); use it.

- `src/main.ts` wires them (lines 106-116 at `e56b0ea`):

```ts
openFeature.button.title = "Ctrl+O"
openFeature.button.dataset.key = "^O"
saveFeature.button.title = "Ctrl+S"
saveFeature.button.dataset.key = "^S"
bindShortcuts(document, {
  open: () => void openFeature.openFile(),
  save: () => void saveFeature.saveMarkdown(),
  find: find.open,
  copyAll,
  dismissError: errors.dismiss,
})
```

  `saveFeature` is the Markdown export (`saveFeature.saveMarkdown()` opens the
  save dialog); `editor.flush` is the note save. `data-key` is the key hint
  drawn before the button label by CSS.

- `tests/features/singlenoteeditorfeature.test.ts` advances a fake clock with
  the literal `clock.advance(5000)` in about twelve places, and one test title
  says "saves typed text 5000 ms after typing stops".
- `tests/shortcuts.test.ts` builds actions with
  `{ open: vi.fn(), save: vi.fn(), find: vi.fn(), ...extra }`.
- `README.md` line 21 says "saves after 5 seconds of idle"; the "Keyboard
  shortcuts" table has `| \`Ctrl+S\` | Save note as Markdown |`.
- `docs/specs/PRD.md`, `docs/specs/ARD.md` and `docs/specs/TRD.md` describe the
  delay in prose as "one second after typing stops", "one second after the
  last keystroke" and "the one-second delay".

Conventions: no semicolons, double quotes, two-space indent, arrow functions,
short `//` comments that say why. Tests are Vitest with happy-dom.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install (fresh worktree only) | `npm ci` | exit 0 |
| Typecheck | `npm run typecheck` | exit 0 |
| Tests | `npm test` | exit 0, all pass |

Do not run cargo commands; this plan changes no Rust.

## Scope

**In scope**:
- `src/features/singlenoteeditorfeature.ts` (the constant and its comment only)
- `src/shortcuts.ts`
- `src/main.ts`
- `tests/features/singlenoteeditorfeature.test.ts`
- `tests/shortcuts.test.ts`
- `README.md`
- `docs/specs/PRD.md`, `docs/specs/ARD.md`, `docs/specs/TRD.md` (the delay wording only)

**Out of scope**:
- `docs/specs/TASKS.md` and `docs/specs/blueprint.json`: the record of the
  original build; leave them.
- `src/features/savenoteasmarkdownfilefeature.ts`, `src/features/modelinefeature.ts`,
  `src/style.css`, `src/close.ts`, everything under `src-tauri/`.
- Saving on window blur and on close: unchanged.
- No new button and no setting for the delay.

## Git workflow

- Branch: `advisor/015-save-on-demand` (you are already on it).
- Commit message style: `feat: autosave after 10 seconds and Ctrl+S saves the note now`.
- Do NOT push.

## Steps

### Step 1: Ten seconds

Set `IDLE_SAVE_MS = 10_000` and extend its comment: also at once on Ctrl+S.
In `tests/features/singlenoteeditorfeature.test.ts`, import `IDLE_SAVE_MS` and
replace every `clock.advance(5000)` that waits for the idle save with
`clock.advance(IDLE_SAVE_MS)`; rename the test title to say "after the idle
delay". Add one assertion that `IDLE_SAVE_MS` is `10000` and one that nothing
is written at 9,999 ms.

**Verify**: `npm test` → exit 0.

### Step 2: Ctrl+S saves the note, Ctrl+Shift+S exports

In `src/shortcuts.ts`:
- add `exportMarkdown?: () => void` to `ShortcutActions`; update the doc
  comment of `bindShortcuts` (Ctrl+S saves the note now, Ctrl+Shift+S exports);
- in the Ctrl+Shift branch, handle the letter `s`: when `actions.exportMarkdown`
  exists, `preventDefault()` and call it; keep the `c` behaviour and the
  final `return`.

In `src/main.ts`:
- `save: () => void editor.flush()`;
- `exportMarkdown: () => void saveFeature.saveMarkdown()`;
- the export button's hint becomes `saveFeature.button.title = "Ctrl+Shift+S"`
  and `saveFeature.button.dataset.key = "^⇧S"`.

**Verify**: `npm run typecheck` → exit 0.

### Step 3: Tests

In `tests/shortcuts.test.ts`: Ctrl+S calls `save` and not `exportMarkdown`;
Ctrl+Shift+S calls `exportMarkdown`, prevents the default and does not call
`save`; Ctrl+Shift+S without an `exportMarkdown` action does nothing and is
not prevented; Ctrl+Shift+C still copies.

In `tests/features/singlenoteeditorfeature.test.ts`: typing and then calling
`flush()` before the idle delay writes the text exactly once, and advancing
the clock past the delay afterwards writes nothing more (if an existing test
already proves this, extend it rather than duplicating).

**Verify**: `npm test` → exit 0.

### Step 4: Words

- `README.md`: line 21 becomes "saves after 10 seconds of idle, when you press
  `Ctrl+S`, when the window loses focus, and on close" (keep the rest of the
  sentence); in the shortcuts table `Ctrl+S` becomes "Save the note now" and a
  new row `Ctrl+Shift+S` "Save note as Markdown" follows it.
- `docs/specs/PRD.md`, `ARD.md`, `TRD.md`: replace "one second" with
  "ten seconds" and "one-second" with "ten-second" where they describe the
  autosave delay, and nowhere else. In each file, after the FIRST sentence
  that states the delay, add: "Ctrl+S writes the note at once." Do not change
  IDs, headings or acceptance-criteria identifiers.

**Verify**: `grep -rn "one second\|one-second" docs/specs/PRD.md docs/specs/ARD.md docs/specs/TRD.md`
→ no match that is about the autosave delay; `grep -n "5 seconds" README.md` → no match.

## Done criteria

- [ ] `npm run typecheck` exits 0
- [ ] `npm test` exits 0 with the new cases
- [ ] `grep -n "IDLE_SAVE_MS = 10_000" src/features/singlenoteeditorfeature.ts` matches
- [ ] `grep -n "advance(5000)" tests/features/singlenoteeditorfeature.test.ts` returns nothing
- [ ] `grep -n "editor.flush()" src/main.ts` shows the `save` action
- [ ] `git diff --name-only e56b0ea..HEAD -- . ':!docs/plans'` lists only in-scope files

## STOP conditions

- The excerpts do not match the live code.
- A `clock.advance(5000)` in the tests is not waiting for the idle save and
  the test fails when it becomes 10 seconds: report which test.
- The specs use the phrase "one second" for something other than the autosave
  delay and you cannot tell which: report the lines, change nothing there.
- A verification fails twice after a reasonable fix attempt.

## Maintenance notes

- A power loss or crash can now lose up to 10 seconds of typing (blur and
  close still save at once). That is the owner's choice.
- NOT verified in a real window: that WebKitGTK delivers Ctrl+Shift+S to the
  page, and how the `^⇧S` hint renders in the terminal font.
- People used to Ctrl+S opening the export dialog will find it on
  Ctrl+Shift+S; the button and its hint say so.
