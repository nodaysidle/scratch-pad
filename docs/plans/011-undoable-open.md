# Plan 011: Opening a file can be undone, and a failed open says why

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. Do NOT edit `docs/plans/README.md`: the reviewer
> maintains the index.
>
> **Drift check (run first)**: `git diff --stat bb5a1a2..HEAD -- src/features/singlenoteeditorfeature.ts src/features/openplaintextfiletoreplacenotefeature.ts tests/features/singlenoteeditorfeature.test.ts tests/features/openplaintextfiletoreplacenotefeature.test.ts README.md`
> If any of these changed, compare the "Current state" excerpts against the
> live code; on a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED (relies on `document.execCommand`, with a fallback)
- **Depends on**: none
- **Category**: direction (quality of life) + bug
- **Planned at**: commit `bb5a1a2`, 2026-11-24

## Why this matters

Ctrl+O replaces the one note with a file's text. The replacement assigns
`textarea.value`, which empties the browser's undo history, and the app keeps
no copy of the old text. Opening the wrong file therefore loses the note for
good; the confirmation dialog is the only guard. Tab indent in this app already
keeps undo by inserting through `document.execCommand("insertText")`; doing the
same for the replacement makes Ctrl+Z bring the old note back.

Second, every failed open shows "The file could not be opened." even when Rust
knows the reason (the backend is getting distinct messages such as "larger than
10 MiB" in plan 010). The frontend should show the message Rust wrote.

## Current state

`src/features/singlenoteeditorfeature.ts`:

- A store subscriber mirrors the draft into the textarea (lines 89-97):

```ts
  // The draft the textarea already shows: a reference check per store change instead of reading the whole value.
  let shown = ""
  deps.store.subscribe(() => {
    const currentDraft = deps.store.get().draft
    if (currentDraft !== shown) {
      shown = currentDraft
      textarea.value = currentDraft
    }
  })
```

- `setDraft` (lines 161-172) is what the textarea's `input` event calls: it sets
  `shown = text`, sets `{ draft: text, dirty: true }` in the store and restarts
  the idle-save timer (`pendingTimer`).
- `replaceNote` (lines 174-185):

```ts
  const replaceNote = (text: string): Promise<boolean> => {
    if (!loaded) {
      deps.errors.show("The note could not be loaded.", retryLoad)
      return Promise.resolve(false)
    }
    if (pendingTimer !== null) {
      deps.timers.clear(pendingTimer)
      pendingTimer = null
    }
    deps.store.set({ draft: text, dirty: true })
    return saveDraft()
  }
```

- `applyEdit` (lines 206-216) is the exemplar for undo-preserving edits:

```ts
  // execCommand keeps the browser's undo history; without it (or if it refuses) the value is assigned directly.
  const applyEdit = (edit: IndentEdit): void => {
    textarea.setSelectionRange(edit.from, edit.to)
    const done = typeof document.execCommand === "function" && document.execCommand("insertText", false, edit.text)
    if (!done) {
      const value = textarea.value
      textarea.value = value.slice(0, edit.from) + edit.text + value.slice(edit.to)
      setDraft(textarea.value)
    }
    textarea.setSelectionRange(edit.selStart, edit.selEnd)
  }
```

  In a real webview `execCommand("insertText")` fires the textarea's `input`
  event synchronously, so `setDraft` has already run when it returns. happy-dom
  (the test DOM) has no `execCommand`; the existing test "indents through
  execCommand so the undo history survives, and falls back to assigning the
  value" (near line 698 of the test file) shows how tests install a fake one.

`src/features/openplaintextfiletoreplacenotefeature.ts` (whole flow, lines 26-44):

```ts
  const question = "Replace the current note with the contents of this file?"
  let busy = false

  // Rust shows the file dialog and reads the chosen file in one step, so no path reaches this code.
  const openFile = async (): Promise<void> => {
    if (busy) return
    busy = true
    try {
      const text = await deps.call<string | null>("open_text_file")
      if (text === null) return
      deps.errors.clear("The file could not be opened.")
      if (!(await deps.confirm(question, "Replace"))) return
      await deps.editor.replaceNote(text)
    } catch {
      deps.errors.show("The file could not be opened.", () => void openFile())
    } finally {
      busy = false
    }
  }
```

A failed Rust command rejects with an object `{ kind: string, message: string }`
(see `CommandError` in `src/api.ts`); `message` is written for the user.
`deps.errors.clear(message)` hides the banner only if it still shows exactly
that message.

`README.md` has a "Keyboard shortcuts" table; its first row is
`| \`Ctrl+O\` | Open a plain-text file (replaces current note after confirmation) |`.

Conventions: no semicolons, double quotes, two-space indent, arrow functions,
short `//` comments that say why, user-facing text in plain sentences.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install (fresh worktree only) | `npm ci` | exit 0 |
| Typecheck | `npm run typecheck` | exit 0 |
| Tests | `npm test` | exit 0, all pass |

Do not run cargo commands; this plan changes no Rust.

## Scope

**In scope**:
- `src/features/singlenoteeditorfeature.ts`
- `src/features/openplaintextfiletoreplacenotefeature.ts`
- `tests/features/singlenoteeditorfeature.test.ts`
- `tests/features/openplaintextfiletoreplacenotefeature.test.ts`
- `README.md` (the Ctrl+O row only)

**Out of scope**:
- `src/api.ts`, `src/errors.ts`, `src/ui.ts` (shared base files).
- `src/features/findfeature.ts`, `src/shortcuts.ts`, `src/main.ts`,
  `src/omarchy.ts`, anything under `src-tauri/` — other plans change these in
  parallel.
- Persisting the old note anywhere (the spec allows one stored note only).

## Git workflow

- Branch: `advisor/011-undoable-open` (from the current HEAD).
- Commit message style: `feat: Ctrl+Z brings the note back after opening a file`.
- Do NOT push.

## Steps

### Step 1: Replace through the undo history

In `src/features/singlenoteeditorfeature.ts`:

1. Export a constant with a comment:
   `export const UNDOABLE_REPLACE_MAX = 1_000_000` — the longest text (in
   UTF-16 units) replaced through the undo history; above it the value is
   assigned directly, because inserting many megabytes as one edit may stall
   the webview.
2. Add a helper inside the feature, next to `applyEdit`:

```ts
  // Replaces the whole note as one undoable edit. False when the textarea did not take it (no execCommand,
  // a refusal, or a text too long), and the caller then assigns the value.
  const insertWhole = (text: string): boolean => {
    if (text.length > UNDOABLE_REPLACE_MAX || typeof document.execCommand !== "function") return false
    textarea.focus()
    textarea.select()
    const done = text === "" ? document.execCommand("delete") : document.execCommand("insertText", false, text)
    // The input event has run setDraft by now; anything else means the edit did not land.
    return done && textarea.value === text.replace(/\r\n?/g, "\n") && deps.store.get().draft === textarea.value
  }
```

3. In `replaceNote`, after the `loaded` check: call `insertWhole(text)` FIRST,
   then clear `pendingTimer` as today (the input event may have started it),
   then only when `insertWhole` returned false do
   `deps.store.set({ draft: text, dirty: true })`. Afterwards put the caret at
   the start (`textarea.setSelectionRange(0, 0)` and `textarea.scrollTop = 0`)
   and `return saveDraft()`.

The order matters: `saveDraft` must still run exactly once and at once.

**Verify**: `npm run typecheck` → exit 0; `npm test` → exit 0 (existing tests
use the fallback path because happy-dom has no `execCommand`).

### Step 2: Say in the dialog whether it can be undone

In `src/features/openplaintextfiletoreplacenotefeature.ts`, import
`UNDOABLE_REPLACE_MAX` (a value import from `./singlenoteeditorfeature`) and
build the question from the loaded text:

- `text.length <= UNDOABLE_REPLACE_MAX`:
  `"Replace the current note with the contents of this file? Ctrl+Z brings the old note back until you close the app."`
- otherwise:
  `"Replace the current note with the contents of this file? The file is large, so this cannot be undone."`

**Verify**: `npm run typecheck` → exit 0.

### Step 3: Show the reason Rust gave

In the same file:

1. Add a module-level `const OPEN_FAILED = "The file could not be opened."`
   and a helper that returns the command's own message only for a real command
   error:

```ts
// A failed command carries a message written for the user; anything else (a runtime error) gets the general one.
const reasonFor = (error: unknown): string => {
  const candidate = error as { kind?: unknown; message?: unknown } | null
  return typeof candidate === "object" && candidate !== null &&
    typeof candidate.kind === "string" && typeof candidate.message === "string"
    ? candidate.message
    : OPEN_FAILED
}
```

2. Keep the last message shown in a `let lastMessage = OPEN_FAILED`; in
   `catch (error)` set `lastMessage = reasonFor(error)` and show it with the
   same Retry; replace `deps.errors.clear("The file could not be opened.")`
   with `deps.errors.clear(lastMessage)`.

**Verify**: `npm test` → exit 0 after updating the assertions in Step 4.

### Step 4: Tests and README

See "Test plan". In `README.md` change the Ctrl+O row's description to
`Open a plain-text file (replaces current note after confirmation; \`Ctrl+Z\` brings the old note back)`.

**Verify**: `npm test` → exit 0.

## Test plan

`tests/features/singlenoteeditorfeature.test.ts` — model on the existing
execCommand test near line 698 (it installs a fake `document.execCommand` and
removes it afterwards):

1. With a fake `execCommand` that, for `insertText`, replaces the textarea's
   selected range with the text and dispatches an `input` event, then returns
   true: `replaceNote("new text")` leaves `textarea.value === "new text"`,
   calls `execCommand("insertText", false, "new text")`, and results in exactly
   one `update_note` call carrying `"new text"`. Assert the textarea value was
   NOT assigned directly, e.g. by spying on the `value` setter or by checking
   the fake was the only writer.
2. With no `execCommand` (default happy-dom): `replaceNote` still replaces the
   text and saves once (this is today's behaviour; keep or extend the existing test).
3. With a fake `execCommand` that returns true but changes nothing: the
   fallback assigns the text and it is saved once.
4. A text longer than `UNDOABLE_REPLACE_MAX` never calls `execCommand`.
5. Replacing with `""` uses `execCommand("delete")`.

`tests/features/openplaintextfiletoreplacenotefeature.test.ts` — the file has a
`const question = ...` near the top; update it to the new undoable wording, and add:

6. A text longer than `UNDOABLE_REPLACE_MAX` is confirmed with the "cannot be undone" wording.
7. `call` rejecting with `{ kind: "invalid", message: "The file is larger than 10 MiB." }`
   shows exactly that message in the banner, with Retry.
8. `call` rejecting with `new Error("ipc")` shows `"The file could not be opened."`.
9. After a failure with a custom message, a successful open hides the banner.

## Done criteria

- [ ] `npm run typecheck` exits 0
- [ ] `npm test` exits 0, including the new cases
- [ ] `grep -n "UNDOABLE_REPLACE_MAX" src/features/singlenoteeditorfeature.ts src/features/openplaintextfiletoreplacenotefeature.ts` matches in both files
- [ ] `git diff --name-only bb5a1a2..HEAD` lists only in-scope files

## STOP conditions

- The excerpts in "Current state" do not match the live code.
- `replaceNote` would have to change its signature or return type.
- A step's verification fails twice after a reasonable fix attempt.
- The change seems to need `src/api.ts`, `src/errors.ts` or `src/main.ts`.

## Maintenance notes

- NOT verified in a real window: that WebKitGTK treats the whole replacement as
  one undo step, and how long `insertText` takes near the 1,000,000 character
  limit. Check both in the installed app (open a file, press Ctrl+Z) before
  relying on the dialog's promise; lower the constant if it stalls.
- The undo history lives in the webview, so it ends when the app closes; the
  dialog text says so.
- Plan 012 adds an Enter handler to the same file's `keydown` listener.
