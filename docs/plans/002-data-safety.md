# Plan 002: The note is never silently lost on close, after a failed load, or through a stale Retry

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat c1e1b39..HEAD -- src/main.ts src/errors.ts src/features tests`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none (independent of plan 001; touches different files)
- **Category**: bug
- **Planned at**: commit `c1e1b39`, 2026-11-14

## Why this matters

Scratch Pad is a Tauri 2 app that keeps exactly one note and autosaves it. Its
only job is not to lose that note, and today it can in four ways:

1. **Close after a failed save.** The close handler waits for `flush()` and then
   the window is destroyed whatever happened. A save that fails at close time,
   or an autosave that failed earlier (error banner showing), loses the text.
2. **Second note after a failed load.** If the first load fails, the app treats
   the note as absent. The next keystroke *creates* a new row, and because the
   list is ordered newest-first the original note is never shown again.
3. **Typing before the load finishes** makes the app discard the loaded text and
   overwrite the stored note with the few characters typed.
4. **Stale error state.** The error banner stays up after a later save succeeds.
   The "Open text file" Retry replaces the note without asking again even when
   the user has typed since. The "Save as Markdown" Retry writes the text from
   the time of the failure, not the current text.

All existing tests pass, so none of these paths is covered. This plan fixes them
and adds a test for each.

## Current state

The frontend is plain TypeScript and DOM, no framework. Each feature is a
factory function that receives its dependencies (`call` for Rust commands,
`errors` for the banner, `store` for shared state), so tests pass fakes.

### `src/features/singlenoteeditorfeature.ts` (the editor; 186 lines)

The public interface (lines 45-49):

```ts
export interface SingleNoteEditor {
  setDraft: (text: string) => void
  replaceNote: (text: string) => Promise<boolean>
  flush: () => Promise<void>
}
```

The load, save and flush logic (lines 82-175):

```ts
  let pendingTimer: number | null = null
  let hasUserEdited = false
  let writeChain: Promise<void> = Promise.resolve()

  const reload = async (): Promise<void> => {
    try {
      const records = await deps.call<Note[]>("list_note")
      const first = records[0]
      if (hasUserEdited) {
        deps.store.set({
          note: first ? [first] : [],
          loadError: null,
        })
      } else {
        deps.store.set({
          note: first ? [first] : [],
          draft: first?.text ?? "",
          loadError: null,
        })
      }
    } catch {
      deps.store.set({
        note: [],
        draft: hasUserEdited ? deps.store.get().draft : "",
        loadError: "The note could not be loaded.",
      })
      deps.errors.show("The note could not be loaded.", () => {
        void reload()
      })
    }
  }

  writeChain = reload()

  const saveDraft = (): Promise<boolean> => {
    const next = writeChain.then(async () => {
      const text = deps.store.get().draft
      const existing = deps.store.get().note[0]
      try {
        const saved = existing
          ? await deps.call<Note>("update_note", {
              id: existing.id,
              input: { ...existing, text },
            })
          : await deps.call<Note>("create_note", {
              input: { text },
            })
        deps.store.set({ note: [saved] })
        return true
      } catch {
        deps.errors.show("The note could not be saved.", () => {
          void saveDraft()
        })
        return false
      }
    })
    writeChain = next.then(
      () => undefined,
      () => undefined,
    )
    return next
  }

  const setDraft = (text: string): void => {
    hasUserEdited = true
    deps.store.set({ draft: text })
    if (pendingTimer !== null) {
      deps.timers.clear(pendingTimer)
    }
    pendingTimer = deps.timers.set(() => {
      pendingTimer = null
      void saveDraft()
    }, 1000)
  }

  const replaceNote = (text: string): Promise<boolean> => {
    hasUserEdited = true
    if (pendingTimer !== null) {
      deps.timers.clear(pendingTimer)
      pendingTimer = null
    }
    deps.store.set({ draft: text })
    return saveDraft()
  }

  const flush = async (): Promise<void> => {
    if (pendingTimer !== null) {
      deps.timers.clear(pendingTimer)
      pendingTimer = null
      await saveDraft()
      return
    }
    await writeChain
  }
```

`writeChain` serialises every load and save so they never overlap. Keep that.

### `src/errors.ts` (the banner; 43 lines)

`createErrorBanner(host)` returns `{ show, report, dismiss }`. `show(message, onRetry?)`
puts `message` in the banner's `<p>` (the local variable `text`), stores the
retry closure, and un-hides the banner (the local variable `banner`). Nothing
hides it when the failed operation later succeeds.

### `src/main.ts` (composition root; lines 58-64)

```ts
try {
  void getCurrentWindow().onCloseRequested(async () => {
    await editor.flush()
  })
} catch {
  // Outside a Tauri window runtime (such as unit tests), window close events are unavailable.
}
```

Tauri's `onCloseRequested` passes the handler an event object with
`preventDefault()`. After the handler resolves, Tauri destroys the window unless
`preventDefault()` was called. `src/main.ts` runs side effects on import and
cannot be imported in a test, which is why step 4 puts the new logic in its own file.

### `src/features/openplaintextfiletoreplacenotefeature.ts` (lines 29-38)

```ts
  const readAndReplace = async (path: string): Promise<void> => {
    try {
      const text = await deps.call<string>("read_text_file", { path })
      await deps.editor.replaceNote(text)
    } catch {
      deps.errors.show("The file could not be opened.", () => {
        void readAndReplace(path)
      })
    }
  }
```

The confirmation is asked in `openFile` with
`deps.confirm("Replace the current note with the contents of this file?", "Replace")`.

### `src/features/savenoteasmarkdownfilefeature.ts` (lines 31-53)

```ts
  const performWrite = async (path: string, content: string): Promise<void> => {
    try {
      await deps.call("write_markdown_export_file", { path, content })
      statusElement.textContent = "The file was saved."
    } catch {
      statusElement.textContent = ""
      deps.errors.show("The file could not be saved.", () => {
        statusElement.textContent = ""
        void performWrite(path, content)
      })
    }
  }

  const saveMarkdown = async (): Promise<void> => {
    statusElement.textContent = ""
    const chosenPath = await deps.saveDialog({
      defaultPath: "scratch-pad.md",
    })
    if (!chosenPath) return

    const content = "# Scratch Pad\n\n" + deps.store.get().draft
    await performWrite(chosenPath, content)
  }
```

### Conventions to match

- No semicolons, double quotes, two-space indent, arrow functions, `const`.
- User-visible strings are fixed by `PRD.md`. Keep every existing string exactly:
  `"The note could not be loaded."`, `"The note could not be saved."`,
  `"The file could not be opened."`, `"The file could not be saved."`,
  `"The file was saved."`, `"Replace the current note with the contents of this file?"`, `"Replace"`.
- `tsconfig.json` has `strict` and `noUncheckedIndexedAccess`; do not use `any`.
- Tests live in `tests/` and `tests/features/`, start with
  `// @vitest-environment happy-dom`, and build their own `call` fakes. Use
  `tests/features/singlenoteeditorfeature.test.ts` as the pattern: it has
  `createFakeTimers()` (a manual clock with `advance(ms)`) and
  `flushMicrotasks()`, and builds the DOM in `beforeEach`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install JS deps (fresh checkout only) | `npm ci` | exit 0 |
| Typecheck | `npm run typecheck` | exit 0, no output errors |
| All frontend tests | `npm test` | all pass |
| One test file | `npx vitest run tests/features/singlenoteeditorfeature.test.ts` | all pass |

No Rust file changes in this plan, so cargo is not needed.

## Scope

**In scope** (the only files you should modify):
- `src/features/singlenoteeditorfeature.ts`
- `src/features/openplaintextfiletoreplacenotefeature.ts`
- `src/features/savenoteasmarkdownfilefeature.ts`
- `src/errors.ts`
- `src/main.ts`
- `src/close.ts` (create)
- `tests/features/singlenoteeditorfeature.test.ts`
- `tests/features/openplaintextfiletoreplacenotefeature.test.ts`
- `tests/features/savenoteasmarkdownfilefeature.test.ts`
- `tests/close.test.ts` (create)

**Out of scope** (do NOT touch):
- `kit/` — frozen starter snapshot. `kit/src/errors.ts` will differ from
  `src/errors.ts` after this plan; that is expected.
- Everything under `src-tauri/` — no backend change. In particular do not add a
  "get or create" command and do not change `ORDER BY id DESC`.
- `src/style.css`, `src/ui.ts`, `src/store.ts`, `src/api.ts`, `index.html`.
- The shape of the store (`note: Note[]` stays an array) and the `loadError` field.
- Do not add a save timeout, a "Saving…" indicator, or button busy states.

## Git workflow

- Branch: `advisor/002-data-safety`.
- One commit per step, message style `fix: <what>` (for example
  `fix: keep the window open when the closing save fails`).
- Do NOT push or open a PR.

## Steps

### Step 1: `errors.clear(message)` hides the banner only for its own message

In `src/errors.ts`, add a `clear` member to the returned object, next to `dismiss`:

```ts
    /** Hides the banner if it still shows this message: the operation that failed has now succeeded. */
    clear: (message: string) => { if (text.textContent === message) banner.hidden = true },
```

**Verify**: `npm run typecheck` → exit 0.

### Step 2: The editor saves only after a successful load, and reports whether everything is saved

Edit `src/features/singlenoteeditorfeature.ts`:

1. In `SingleNoteEditor`, change `flush: () => Promise<void>` to
   `flush: () => Promise<boolean>` and give it this doc comment:
   `/** Writes any unsaved text now. Resolves true when nothing is left unsaved. */`

2. Right after the textarea is created, add `textarea.readOnly = true`.

3. Replace `let hasUserEdited = false` with:

   ```ts
   // Nothing may be saved before the stored note is known: a save without it would create a second note.
   let loaded = false
   let savedText = ""
   ```

4. Replace `reload` with:

   ```ts
   const reload = async (): Promise<void> => {
     try {
       const records = await deps.call<Note[]>("list_note")
       const first = records[0]
       savedText = first?.text ?? ""
       loaded = true
       textarea.readOnly = false
       deps.store.set({ note: first ? [first] : [], draft: savedText, loadError: null })
       deps.errors.clear("The note could not be loaded.")
     } catch {
       deps.store.set({ note: [], draft: "", loadError: "The note could not be loaded." })
       deps.errors.show("The note could not be loaded.", retryLoad)
     }
   }

   const retryLoad = (): void => {
     writeChain = writeChain.then(reload)
   }
   ```

   `reload` never rejects, so chaining it keeps `writeChain` a `Promise<void>`
   that never rejects. Declare `retryLoad` with `const` after `reload`; it is
   only called later, so the order is fine.

5. In `saveDraft`, the function passed to `writeChain.then` must start with a
   guard, record the saved text on success, and clear its own banner message:

   ```ts
   const next = writeChain.then(async () => {
     if (!loaded) return false
     const text = deps.store.get().draft
     const existing = deps.store.get().note[0]
     try {
       const saved = existing
         ? await deps.call<Note>("update_note", { id: existing.id, input: { ...existing, text } })
         : await deps.call<Note>("create_note", { input: { text } })
       savedText = text
       deps.store.set({ note: [saved] })
       deps.errors.clear("The note could not be saved.")
       return true
     } catch {
       deps.errors.show("The note could not be saved.", () => {
         void saveDraft()
       })
       return false
     }
   })
   ```

   Leave the `writeChain = next.then(...)` and `return next` lines as they are.

6. `setDraft`: remove `hasUserEdited = true` and make the first line
   `if (!loaded) return`.

7. `replaceNote`: remove `hasUserEdited = true`. Make its first statement:

   ```ts
   if (!loaded) {
     deps.errors.show("The note could not be loaded.", retryLoad)
     return Promise.resolve(false)
   }
   ```

8. Replace `flush` with:

   ```ts
   const flush = async (): Promise<boolean> => {
     if (pendingTimer !== null) {
       deps.timers.clear(pendingTimer)
       pendingTimer = null
     }
     await writeChain
     if (!loaded || deps.store.get().draft === savedText) return true
     return saveDraft()
   }
   ```

   This also retries a save that failed earlier: the draft still differs from
   `savedText`, so `flush` saves again.

After the edit, `hasUserEdited` must not appear anywhere in the file.

**Verify**: `grep -c hasUserEdited src/features/singlenoteeditorfeature.ts` → `0`

**Verify**: `npm run typecheck` → exit 0.

**Verify**: `npx vitest run tests/features/singlenoteeditorfeature.test.ts` → the
5 existing tests pass unchanged. If one fails, re-read the step; do not edit the
existing tests' assertions.

### Step 3: Editor tests for the fixed paths

Add these tests to `tests/features/singlenoteeditorfeature.test.ts`, inside the
existing `describe`, modelled on the existing tests (same `beforeEach` DOM,
`createFakeTimers`, `flushMicrotasks`, a `call` fake that records every command
into a `calls` array):

1. **"does not create a second note when the first load failed"** — `list_note`
   throws. After `flushMicrotasks()`: the textarea's `readOnly` is `true`. Set
   `textarea.value = "typed"`, dispatch `input`, `clock.advance(1000)`,
   `flushMicrotasks()`. Assert no call with command `create_note` or
   `update_note` was recorded. Then make `list_note` succeed with
   `[{ id: 1, text: "Original" }]`, click the banner's Retry button,
   `flushMicrotasks()`: assert `textarea.readOnly` is `false`,
   `textarea.value` is `"Original"`, and the banner is hidden.

2. **"ignores typing until the stored note has loaded"** — `list_note` returns a
   promise you resolve by hand (store the `resolve` function, as the existing
   "serializes saves" test does for `create_note`). Before resolving: assert
   `textarea.readOnly` is `true`, call `editor.setDraft("early")`, assert
   `store.get().draft` is `""`. Resolve with `[{ id: 1, text: "Stored" }]`,
   `flushMicrotasks()`: assert `textarea.value` is `"Stored"`.
   `clock.advance(1000)`, `flushMicrotasks()`: assert no `update_note` or
   `create_note` call was made.

3. **"flush reports a failed save and retries an earlier failed save"** —
   `list_note` returns `[{ id: 1, text: "Initial" }]`; `update_note` throws
   while a `failWrites` flag is true. `editor.setDraft("New")`,
   `clock.advance(1000)`, `flushMicrotasks()` (the autosave fails). Then
   `expect(await editor.flush()).toBe(false)`. Set `failWrites = false`;
   `expect(await editor.flush()).toBe(true)` and the stored text is `"New"`.
   Then `expect(await editor.flush()).toBe(true)` again and assert the number of
   `update_note` calls did not grow (nothing left to save).

4. **"hides its error message once a later save succeeds"** — same setup as
   test 3: after the failed autosave the banner is visible with
   `"The note could not be saved."`. Set `failWrites = false`, type again
   (`textarea.value = "Newer"`, dispatch `input`), `clock.advance(1000)`,
   `flushMicrotasks()`: assert `banner.hidden` is `true`.

5. **"flush does not create a note when nothing was typed"** — `list_note`
   returns `[]`. `expect(await editor.flush()).toBe(true)`; assert no
   `create_note` call.

**Verify**: `npx vitest run tests/features/singlenoteeditorfeature.test.ts` → 10 tests pass.

### Step 4: The window stays open when the closing save fails

Create `src/close.ts`:

```ts
/** What the window does when asked to close: save first, and close without saving only if the user says so. */
export const createCloseHandler =
  (deps: {
    flush: () => Promise<boolean>
    confirm: (message: string, confirmLabel: string) => Promise<boolean>
  }) =>
  async (event: { preventDefault: () => void }): Promise<void> => {
    if (await deps.flush()) return
    if (!(await deps.confirm("The note could not be saved. Close without saving?", "Close"))) {
      event.preventDefault()
    }
  }
```

In `src/main.ts`, import it (`import { createCloseHandler } from "./close"`) and
replace the body of the `try` block with:

```ts
  void getCurrentWindow().onCloseRequested(
    createCloseHandler({ flush: editor.flush, confirm: confirmDialog }),
  )
```

`confirmDialog` is already imported in `src/main.ts`. Keep the `try`/`catch` and its comment.

Create `tests/close.test.ts` (no DOM needed, so no `happy-dom` header) with
three tests using `vi.fn()`:

1. saved (`flush` resolves `true`) → `confirm` not called, `preventDefault` not called.
2. not saved, user declines (`confirm` resolves `false`) → `preventDefault` called
   once, and `confirm` was called with
   `("The note could not be saved. Close without saving?", "Close")`.
3. not saved, user confirms (`confirm` resolves `true`) → `preventDefault` not called.

**Verify**: `npx vitest run tests/close.test.ts` → 3 tests pass.

**Verify**: `npm run typecheck` → exit 0.

### Step 5: Retry acts on the current note, not on old state

In `src/features/openplaintextfiletoreplacenotefeature.ts`, move the question
text into a constant and make the Retry ask again when the note changed since
the failure:

```ts
  const question = "Replace the current note with the contents of this file?"

  const readAndReplace = async (path: string): Promise<void> => {
    try {
      const text = await deps.call<string>("read_text_file", { path })
      await deps.editor.replaceNote(text)
    } catch {
      const draftAtFailure = deps.store.get().draft
      deps.errors.show("The file could not be opened.", async () => {
        // The user confirmed replacing the note as it was then; text typed since needs a new yes.
        if (deps.store.get().draft !== draftAtFailure && !(await deps.confirm(question, "Replace"))) return
        void readAndReplace(path)
      })
    }
  }
```

Use `question` in `openFile` too, in place of the string literal there.
`errors.show` types its retry as `() => void`; an async function is assignable.

In `src/features/savenoteasmarkdownfilefeature.ts`, build the content inside
`performWrite` so a Retry exports the current text. `performWrite` takes only
`path`:

```ts
  const performWrite = async (path: string): Promise<void> => {
    const content = "# Scratch Pad\n\n" + deps.store.get().draft
    try {
      await deps.call("write_markdown_export_file", { path, content })
      statusElement.textContent = "The file was saved."
      deps.errors.clear("The file could not be saved.")
    } catch {
      statusElement.textContent = ""
      deps.errors.show("The file could not be saved.", () => {
        statusElement.textContent = ""
        void performWrite(path)
      })
    }
  }
```

and `saveMarkdown` ends with `await performWrite(chosenPath)` (delete its
`const content = ...` line).

Add tests:

- In `tests/features/openplaintextfiletoreplacenotefeature.test.ts`:
  **"asks again before a retry replaces text typed after the failure"** — copy the
  setup of the existing test "keeps previous values and shows error message when
  file cannot be read, then retries without re-asking". After the failed read,
  call `store.set({ draft: "Typed after the failure" })`, make `confirm` resolve
  `false` for its next call (`confirm.mockResolvedValueOnce(false)`), set
  `failRead = false`, click Retry, `flushMicrotasks()`. Assert `confirm` was
  called 2 times and `replaceNote` was not called. The existing test (draft
  unchanged, no second question) must keep passing unchanged.
- In `tests/features/savenoteasmarkdownfilefeature.test.ts`:
  **"a retry exports the current text"** — copy the setup of the existing test
  "leaves status empty, shows error message, and allows retry when write fails".
  After the failed write, `store.set({ draft: "Hello again" })`, set
  `shouldFail = false`, click Retry, `flushMicrotasks()`. Assert the second
  recorded call's `args` equal
  `{ path: "/path/to/fail.md", content: "# Scratch Pad\n\nHello again" }`.

**Verify**: `npm test` → all pass; the count is 26 existing + 5 (step 3) + 3 (step 4) + 2 (step 5) = 36.

**Verify**: `npm run typecheck` → exit 0.

## Test plan

Covered in steps 3, 4 and 5: ten new tests, each named for the failure it
prevents. Do not weaken or delete an existing test. Assert on recorded `call`
arguments and on DOM state (`readOnly`, `banner.hidden`, `textarea.value`), not
on values a mock wrote itself.

## Done criteria

ALL must hold:

- [ ] `npm run typecheck` exits 0
- [ ] `npm test` exits 0 with 36 tests passed
- [ ] `grep -rn "hasUserEdited" src/` returns no matches
- [ ] `grep -c "event.preventDefault()" src/close.ts` prints `1`
- [ ] `grep -n "createCloseHandler" src/main.ts` returns two matches (import and use)
- [ ] `git diff --name-only c1e1b39..HEAD` lists only files from the in-scope list
- [ ] `git diff --stat c1e1b39..HEAD -- kit src-tauri` is empty

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" does not match the excerpts.
- An existing test fails after step 2 and the cause is not a typo in your edit.
  In particular, if "serializes saves so writes never overlap and flush() writes
  pending text immediately" fails, report it; do not change that test.
- Fixing something appears to need a change under `src-tauri/` or to the store shape.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- New user-visible string not in `PRD.md`: `"The note could not be saved. Close without saving?"`
  with the button `"Close"`. A reviewer should decide whether to add it to the PRD.
- `flush()` now returns a boolean; any future caller must use it.
- The banner still has one slot: a second failure replaces the first one's Retry.
  Left as is on purpose; revisit only if two failures at once becomes common.
- Not fixed here: a save that hangs forever keeps the window open with no way
  out except `SUPER+Q`/kill. Two running instances can still overwrite each
  other's note (needs a single-instance guard in the backend).
- Plan 003 edits the same editor file for layout and focuses the textarea after
  load; it must keep `textarea.readOnly` and the `loaded` guard intact.
