# Plan 013: Find starts from the selection, jumps as you type, and says when it wraps

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. Do NOT edit `docs/plans/README.md`: the reviewer
> maintains the index.
>
> **Drift check (run first)**: this plan is written against the code as plan
> 009 leaves it. Confirm plan 009 is present:
> `grep -n "refresh" src/features/findfeature.ts` must show a `refresh` member
> and a `countedText` variable. If not, STOP.

## Status

- **Priority**: P2
- **Effort**: S-M
- **Risk**: MED (one behaviour depends on how WebKitGTK paints a selection in an unfocused textarea)
- **Depends on**: docs/plans/009-keyboard-layering.md
- **Category**: direction (quality of life)
- **Planned at**: commit `bb5a1a2`, 2026-11-24

## Why this matters

"Select a word, press Ctrl+F" is the most common way to search, and today the
find field ignores the selection, so the word is typed again. Typing a query
only updates a count; nothing moves until Enter. And when stepping passes the
last match and starts again at the top, the only sign is the count changing
from "3 of 3" to "1 of 3".

## Current state

`src/features/findfeature.ts` (line numbers are from commit `bb5a1a2`; plan 009
adds a few lines above some of them):

- `stepFrom(matches, cursor, backwards)` (lines 62-70) returns the index of the
  match to go to and wraps silently. It is exported and tested; do not change
  its signature.
- `step(backwards)` inside `createFindFeature` (lines 121-138):

```ts
  const step = (backwards: boolean): void => {
    const ranges = findMatchRanges(deps.textarea.value, input.value)
    if (ranges.length === 0) {
      count.textContent = describe(0)
      return
    }
    const starts = ranges.map(range => range.start)
    // Going forwards starts after the current selection, so a repeated Enter moves on.
    const cursor = backwards ? deps.textarea.selectionStart : deps.textarea.selectionEnd
    const selected = deps.textarea.selectionEnd > deps.textarea.selectionStart
    const index = stepFrom(starts, selected || backwards ? cursor : deps.textarea.selectionStart, backwards)
    const range = ranges[index]
    if (!range) return
    deps.textarea.focus()
    deps.textarea.setSelectionRange(range.start, range.end)
    deps.reveal(range.start)
    count.textContent = `${index + 1} of ${ranges.length}`
  }
```

- `open` (lines 175-180):

```ts
    open: () => {
      element.hidden = false
      input.focus()
      input.select()
      refreshCount()
    },
```

- `input.addEventListener("input", refreshCount)` (line 152): typing only counts.
- `deps.reveal(index)` scrolls the note so that position is visible.
- The count element has `role="status"`; its texts are `""`, `"No matches"`,
  `"1 match"`, `"N matches"` and `"I of N"`.

Conventions: no semicolons, double quotes, two-space indent, arrow functions,
short `//` comments that say why. Tests: `tests/features/findfeature.test.ts`,
Vitest + happy-dom; its `setup(text)` returns
`{ textarea, reveal, feature, input, count, type }` and `press(key, shiftKey)`
dispatches a keydown on `document`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install (fresh worktree only) | `npm ci` | exit 0 |
| Typecheck | `npm run typecheck` | exit 0 |
| Tests | `npm test` | exit 0, all pass |

## Scope

**In scope**:
- `src/features/findfeature.ts`
- `tests/features/findfeature.test.ts`

**Out of scope**:
- Every other file. In particular `src/main.ts`, `src/shortcuts.ts`,
  `src/features/singlenoteeditorfeature.ts`, `README.md`, `src/style.css`.
- Replace, regular expressions, and case-sensitive search: not part of this plan.

## Git workflow

- Branch: continue on the branch plan 009 was done on (the same worktree), or
  `advisor/013-quicker-find` from it.
- Commit message style: `feat: find starts from the selection and jumps as you type`.
- Do NOT push.

## Steps

### Step 1: Pre-fill from the selection

In `open`, before focusing the field: read the textarea's selected text. When it
is non-empty, has no line break and is at most 200 characters, set
`input.value` to it. Also remember where the search starts:
`anchor = deps.textarea.selectionStart` (a new `let anchor = 0` in the closure).
Then focus, select and count as today.

**Verify**: `npm run typecheck` → exit 0.

### Step 2: Jump to the first match while typing

Replace the field's `input` listener with a function that:
1. computes `ranges = findMatchRanges(deps.textarea.value, input.value)`;
2. with no query: `deps.textarea.setSelectionRange(anchor, anchor)` and clears
   the count;
3. with no matches: shows `"No matches"` and leaves the selection alone;
4. otherwise picks `index = stepFrom(starts, anchor, false)`, calls
   `deps.textarea.setSelectionRange(range.start, range.end)` and
   `deps.reveal(range.start)`, and shows `"I of N"`.

It must NOT call `deps.textarea.focus()`: the caret stays in the find field so
typing continues. Keep `countedText` (from plan 009) updated wherever the count
is written from the current text.

Enter then moves on from the previewed match (this already follows from `step`
starting after the current selection).

**Verify**: `npx vitest run tests/features/findfeature.test.ts` → existing
tests that only expected a count after typing may need their expectation
updated to the new `"I of N"` text; update those assertions, do not delete
the tests.

### Step 3: Say when a step wraps

In `step`, after choosing `range`, decide whether the step wrapped: going
forwards it wrapped when `range.start` is before the position the search
started from; going backwards when `range.start` is at or after it. When it
wrapped and there is more than one match, show `"I of N (wrapped)"`.

**Verify**: `npm test` → exit 0.

## Test plan

Add to `tests/features/findfeature.test.ts` (model them on the existing
`createFindFeature` tests in that file):

1. Selection pre-fill: select `"beta"` in `"alpha beta gamma beta"`, call
   `feature.open()`: the input value is `"beta"`.
2. No pre-fill for a selection containing `"\n"` or longer than 200 characters:
   the input keeps its previous value.
3. Typing jumps: caret at 0 in `"one two one two"`, open, `type("two")`: the
   textarea selection is `[4, 7]`, `reveal` was called with `4`, the count is
   `"1 of 2"`, and `document.activeElement` is the find input.
4. Typing from a caret after the first match selects the second match.
5. Clearing the query collapses the selection back to the caret position find
   was opened at.
6. Wrap: with two matches and the second selected, Enter shows
   `"1 of 2 (wrapped)"`; Shift+Enter from the first shows `"2 of 2 (wrapped)"`;
   a step that does not wrap shows no `(wrapped)`.

## Done criteria

- [ ] `npm run typecheck` exits 0
- [ ] `npm test` exits 0, including the six new cases
- [ ] `grep -n "(wrapped)" src/features/findfeature.ts` returns a match
- [ ] Only the two in-scope files differ from the state plan 009 left

## STOP conditions

- Plan 009's `refresh`/`countedText` are missing from `findfeature.ts`.
- A step's verification fails twice after a reasonable fix attempt.
- Making an existing test pass would need a change outside the two files.

## Maintenance notes

- NOT verified in a real window: whether WebKitGTK paints the selected match
  while focus is in the find field. If it does not, the note still scrolls to
  the match and the count shows the position; a painted cue would then need a
  highlight layer, which is a separate design.
- After the first Enter focus moves to the note with the match selected, so the
  next typed character replaces the match (undo restores it). This is unchanged
  from before; changing it means deciding where focus lives during a search.
