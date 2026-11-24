# Plan 012: Enter keeps the indent and continues a list

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. Do NOT edit `docs/plans/README.md`: the reviewer
> maintains the index.
>
> **Drift check (run first)**: this plan is written to run after plan 011 in
> the same worktree. `git diff --stat bb5a1a2..HEAD -- src/features/indent.ts tests/features/indent.test.ts`
> must be empty; `src/features/singlenoteeditorfeature.ts` may differ only by
> plan 011's changes (`insertWhole`, `UNDOABLE_REPLACE_MAX`). Otherwise STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW-MED (a new Enter handler next to the find bar's)
- **Depends on**: none functionally; ordered after docs/plans/011-undoable-open.md because both edit `singlenoteeditorfeature.ts`
- **Category**: direction (quality of life)
- **Planned at**: commit `bb5a1a2`, 2026-11-24

## Why this matters

The note is where snippets and quick lists go, and Tab already indents by two
spaces. But Enter is the plain textarea default, so every new line starts at
column 0 and the indent or the list marker is typed again on every line.

## Current state

`src/features/indent.ts` holds the pure edit functions. The shared shape (lines 1-8):

```ts
/** A replacement of value[from, to) by text, and where the selection should be afterwards. */
export interface IndentEdit {
  from: number
  to: number
  text: string
  selStart: number
  selEnd: number
}
```

`indentEdit(value, start, end): IndentEdit` and
`outdentEdit(value, start, end): IndentEdit | null` follow it; `null` means
"nothing to do, let the key through".

`src/features/singlenoteeditorfeature.ts` applies an edit with `applyEdit(edit)`
(it inserts through `document.execCommand("insertText")` so undo survives) and
handles keys on the textarea (lines 218-248 at `bb5a1a2`):

```ts
  textarea.addEventListener("keydown", event => {
    if (document.querySelector(".dialog-overlay")) return

    if (event.key === "F6" && /* no modifiers */) {
      ...
      return
    }

    if (event.key !== "Tab" || textarea.readOnly || event.ctrlKey || event.altKey || event.metaKey) {
      return
    }

    event.preventDefault()
    const { selectionStart, selectionEnd, value } = textarea
    const edit = event.shiftKey
      ? outdentEdit(value, selectionStart, selectionEnd)
      : indentEdit(value, selectionStart, selectionEnd)
    if (edit) applyEdit(edit)
  })
```

The find bar (`src/features/findfeature.ts`) has a document-level handler:
while `.find-bar` is not hidden, Enter means "next match" and Shift+Enter
"previous match", including when focus is in the note. The textarea's own
listener runs before it, so the new Enter code must stand aside while the find
bar is open.

`README.md` has a "Keyboard shortcuts" table with the row
`| \`Tab\` / \`Shift+Tab\` | Indent / outdent current line or selection |`.

Conventions: no semicolons, double quotes, two-space indent, arrow functions,
short `//` comments that say why. Tests: `tests/features/indent.test.ts` holds
table-style cases for the pure functions; `tests/features/singlenoteeditorfeature.test.ts`
has "indents with two spaces on Tab for collapsed and multi-line selections"
as the pattern for key tests.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install (fresh worktree only) | `npm ci` | exit 0 |
| Typecheck | `npm run typecheck` | exit 0 |
| Tests | `npm test` | exit 0, all pass |

## Scope

**In scope**:
- `src/features/indent.ts`
- `src/features/singlenoteeditorfeature.ts` (the `keydown` listener and the import line only)
- `tests/features/indent.test.ts`
- `tests/features/singlenoteeditorfeature.test.ts`
- `README.md` (one new row in the shortcuts table)

**Out of scope**:
- `src/features/findfeature.ts`, `src/shortcuts.ts`, `src/main.ts`,
  `src/omarchy.ts`, `src-tauri/` — changed by other plans in parallel.
- Any setting or toggle: the app has no settings.

## Git workflow

- Branch: continue on plan 011's branch in the same worktree, or
  `advisor/012-enter-auto-indent` from it.
- Commit message style: `feat: Enter keeps the indent and continues a list`.
- Do NOT push.

## Steps

### Step 1: `enterEdit` in `src/features/indent.ts`

Add `export const enterEdit = (value: string, start: number, end: number): IndentEdit | null`.
Definitions: `lineStart` is the index after the last `"\n"` before `start` (0
if none); `lineEnd` is the next `"\n"` at or after `start` (or the end of the
text); `leading` is the run of spaces and tabs at the start of the line;
`marker` is what follows `leading` if it matches one of:

- a bullet: `- `, `* ` or `+ `, optionally followed by a checkbox `[ ] `, `[x] ` or `[X] `;
- a number: one or more digits, then `.` or `)`, then a space.

Rules, in order:

1. **End a list**: when `start === end`, there is a marker, and the whole line
   is exactly `leading + marker` (nothing typed after it): remove the marker.
   Return `{ from: lineStart + leading.length, to: lineEnd, text: "", selStart: lineStart + leading.length, selEnd: same }`.
2. **Caret inside the leading whitespace** (`start < lineStart + leading.length`):
   carry only the whitespace before the caret:
   `indent = value.slice(lineStart, start)`, no marker.
3. **Caret before the end of the marker**
   (`start < lineStart + leading.length + marker.length`): carry `leading` only.
4. **Otherwise** carry `leading` plus the next marker: a bullet repeats itself
   (a checkbox always continues unchecked, `[ ] `); a number is incremented and
   keeps its `.` or `)`.
5. If what would be carried is the empty string, return `null` (the browser's
   own Enter is right).
6. Otherwise return `{ from: start, to: end, text: "\n" + carried, selStart: start + 1 + carried.length, selEnd: same }`.

**Verify**: `npm run typecheck` → exit 0.

### Step 2: Wire Enter in the textarea

In the `keydown` listener of `src/features/singlenoteeditorfeature.ts`, add an
Enter branch BEFORE the existing `event.key !== "Tab"` guard (import
`enterEdit` in the existing import from `./indent`):

- only for `event.key === "Enter"` with no Ctrl, Alt, Meta or Shift;
- not when `textarea.readOnly`, not when `event.isComposing`;
- not when `document.querySelector(".find-bar:not([hidden])")` (find owns Enter then);
- compute `enterEdit(value, selectionStart, selectionEnd)`; if it is `null`,
  return WITHOUT `preventDefault`; otherwise `event.preventDefault()` and
  `applyEdit(edit)`;
- the branch always ends with `return`.

The Tab code below must behave exactly as before.

**Verify**: `npm test` → exit 0.

### Step 3: Tests and README

See "Test plan". In `README.md`, add under the Tab row:
`| \`Enter\` | New line with the same indent; continues \`-\`, \`*\`, \`+\`, \`1.\` and \`- [ ]\` lists (Enter on an empty item ends the list) |`

**Verify**: `npm test` → exit 0 including the new cases.

## Test plan

`tests/features/indent.test.ts` — a table for `enterEdit` (`|` marks the caret):

| Before | After |
|---|---|
| `abc|` | `null` |
| `  abc|` | `  abc\n  |` |
| `\tabc|` | `\tabc\n\t|` |
| `  ab|c` | `  ab\n  |c` |
| ` | abc` (caret after one of two spaces) | one space carried |
| `- one|` | `- one\n- |` |
| `  * one|` | `  * one\n  * |` |
| `9. nine|` | `9. nine\n10. |` |
| `1) a|` | `1) a\n2) |` |
| `- [x] done|` | `- [x] done\n- [ ] |` |
| `- |` (empty item) | marker removed, line is empty, caret at line start |
| `  - |` | `  |` |
| `-|` + ` one` (caret inside the marker) | `null` (nothing to carry) |
| selection `a[bc]` on line `  abc` | selected text replaced by `\n  ` |
| second line of a multi-line text | uses that line's indent, not the first line's |

`tests/features/singlenoteeditorfeature.test.ts` — after the Tab tests:

1. Enter on `"  abc"` with the caret at the end prevents the default and the
   textarea holds `"  abc\n  "`.
2. Enter on `"abc"` does not prevent the default (value unchanged by the handler).
3. Enter with a `.find-bar` element present and not hidden is not handled by
   the textarea (not prevented by it, value unchanged); with the bar `hidden` it is.
4. Shift+Enter and an Enter with `isComposing: true` are not handled.
5. Enter while the textarea is read-only (before the note loads) is not handled.

## Done criteria

- [ ] `npm run typecheck` exits 0
- [ ] `npm test` exits 0, including the new cases
- [ ] `grep -n "export const enterEdit" src/features/indent.ts` returns a match
- [ ] `grep -n "enterEdit" src/features/singlenoteeditorfeature.ts` returns matches (import and use)
- [ ] Only in-scope files differ from the state plan 011 left

## STOP conditions

- The `keydown` listener no longer looks like the excerpt (beyond plan 011's additions elsewhere in the file).
- A step's verification fails twice after a reasonable fix attempt.
- The change seems to need `src/features/findfeature.ts`.

## Maintenance notes

- NOT verified in a real window: that the inserted line scrolls into view at
  the bottom of the note the way a native Enter does, and that one Ctrl+Z
  undoes the whole inserted line.
- If the find bar's selector or visibility rule changes, the guard in Step 2
  must follow it.
- Numbered lists are continued, not renumbered: inserting in the middle of a
  list leaves the following numbers as they were.
