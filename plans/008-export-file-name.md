# Plan 008: "Save as Markdown" suggests a file name taken from the note and today's date

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat b53b72f..HEAD -- src/features/savenoteasmarkdownfilefeature.ts src/main.ts tests/features/savenoteasmarkdownfilefeature.test.ts`
> must be empty. If not, compare the "Current state" excerpts against the live
> code; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none beyond `master` at `b53b72f`
- **Category**: direction
- **Planned at**: commit `b53b72f`, 2026-11-14

## Why this matters

Scratch Pad is a one-note desktop app. Its "Save as Markdown" action opens a
save dialog that always suggests the same file name, `scratch-pad.md`. The
owner exports the note often and has to retype the name each time, or
overwrites the previous export. The owner asked for the suggestion to describe
the note and carry the date, for example `apikeys-14-11-2026.md`.

## Design (decided — do not revisit)

The suggested file name is `<slug>-<dd>-<mm>-<yyyy>.md`.

- **Slug**: taken from the first line of the note that contains a letter or a
  digit. That line is lowercased, accents are removed (`č` becomes `c`), every
  other character is dropped so the words are joined with nothing between them,
  and the result is cut to 40 characters. Markdown heading marks fall away by
  the same rule: `# API keys` gives `apikeys`. The only hyphens in the name are
  the ones around the date.
- **No usable line** (empty note, or only punctuation): the slug is `scratchpad`.
- **Date**: today in the local time zone, day first, zero-padded: `14-11-2026`.
- It is only the *suggestion* in the save dialog. The user can still type any name.
- The exported content does not change: `# Scratch Pad`, a blank line, the note text.

Examples (date 14 November 2026):

| Note's first lines | Suggested name |
|---|---|
| `apikeys` | `apikeys-14-11-2026.md` |
| `# API keys` | `apikeys-14-11-2026.md` |
| (blank line), `   `, `Ključi za strežnik!` | `kljucizastreznik-14-11-2026.md` |
| `---`, `TODO: call Ana @ 5pm` | `todocallana5pm-14-11-2026.md` |
| (empty note) | `scratchpad-14-11-2026.md` |

## Current state

### `src/features/savenoteasmarkdownfilefeature.ts`

The dependencies and the function that opens the dialog:

```ts
export type SaveDialogAdapter = (options: {
  defaultPath: string
}) => Promise<string | null>

export interface SaveNoteAsMarkdownFileDeps {
  call: typeof apiCall
  errors: ReturnType<typeof createErrorBanner>
  store: ReturnType<typeof createNoteStore>
  saveDialog: SaveDialogAdapter
}
```

```ts
  const saveMarkdown = async (): Promise<void> => {
    statusElement.textContent = ""
    const chosenPath = await deps.saveDialog({
      defaultPath: "scratch-pad.md",
    })
    if (!chosenPath) return
    await performWrite(chosenPath)
  }
```

`deps.store.get().draft` is the note text on screen.

### `src/main.ts`

```ts
export const saveFeature = createSaveNoteAsMarkdownFileFeature({
  call,
  errors,
  store,
  saveDialog: opts => save(opts),
})
```

### `tests/features/savenoteasmarkdownfilefeature.test.ts`

Six tests. Each builds the feature with `call`, `errors`, `store` and
`saveDialog`. One of them asserts the old name:

```ts
      saveDialog: vi.fn().mockImplementation(async (opts: { defaultPath: string }) => {
        expect(opts.defaultPath).toBe("scratch-pad.md")
        return "/path/to/my-note.md"
      }),
```

In that test the note text (`draft`) is `"Hello"`.

### Conventions to match

- A feature never reads the clock itself. It takes `now: () => Date` in its
  dependencies; `src/main.ts` passes `() => new Date()` and tests pass a fixed date.
- TypeScript: no semicolons, double quotes, two-space indent, arrow functions, no `any`.
- The documents `PRD.md`, `ARD.md` and `TRD.md` state the suggested file name
  in six places with the exact phrase `the suggested file name is scratch-pad.md`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install JS deps (fresh checkout only) | `npm ci` | exit 0 |
| Typecheck | `npm run typecheck` | exit 0 |
| One test file | `npx vitest run tests/features/savenoteasmarkdownfilefeature.test.ts` | all pass |
| Everything | `npm run check` | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `src/features/savenoteasmarkdownfilefeature.ts`
- `src/main.ts` (one line)
- `tests/features/savenoteasmarkdownfilefeature.test.ts`
- `PRD.md`, `ARD.md`, `TRD.md` (only the phrase replacement in step 3)
- `README.md` (one sentence, step 3)

**Out of scope** (do NOT touch):
- The exported content (`"# Scratch Pad\n\n" + draft`) and every other string.
- `blueprint.json`, `TASKS.md`, `kit/`, everything under `src-tauri/` (the Rust
  tests use `scratch-pad.md` as an arbitrary file name; leave them).
- No new dependency. No setting for the name format.

## Git workflow

- Branch: `advisor/008-export-file-name`.
- One commit per step, message style `feat: <what>` / `docs: <what>`.
- Do NOT push or open a PR.

## Steps

### Step 1: Build the name from the note and the date

In `src/features/savenoteasmarkdownfilefeature.ts`:

1. Add `now: () => Date` to `SaveNoteAsMarkdownFileDeps`, with the comment
   `/** Today's date goes into the suggested file name. */`.

2. Add this exported function above `createSaveNoteAsMarkdownFileFeature`:

   ```ts
   /**
    * The file name the save dialog suggests: the note's first line with letters or digits, lowercased
    * with its words joined, then the date as dd-mm-yyyy. A note with no such line is called scratchpad.
    */
   export const exportFileName = (text: string, date: Date): string => {
     const slugs = text.split("\n").map(line =>
       line
         .normalize("NFKD")
         .replace(/[̀-ͯ]/g, "")
         .toLowerCase()
         .replace(/[^a-z0-9]+/g, "")
         .slice(0, 40),
     )
     const slug = slugs.find(Boolean) ?? "scratchpad"
     const two = (value: number): string => String(value).padStart(2, "0")
     return `${slug}-${two(date.getDate())}-${two(date.getMonth() + 1)}-${date.getFullYear()}.md`
   }
   ```

3. In `saveMarkdown`, replace `defaultPath: "scratch-pad.md",` with
   `defaultPath: exportFileName(deps.store.get().draft, deps.now()),`.

In `src/main.ts`, add `now: () => new Date(),` to the object passed to
`createSaveNoteAsMarkdownFileFeature`.

**Verify**: `grep -c '"scratch-pad.md"' src/features/savenoteasmarkdownfilefeature.ts` → `0`

**Verify**: `grep -c "now: () => new Date()" src/main.ts` → `1`

### Step 2: Tests

In `tests/features/savenoteasmarkdownfilefeature.test.ts`:

1. Import `exportFileName` next to `createSaveNoteAsMarkdownFileFeature`.
2. Near the top of the file add
   `const now = () => new Date(2026, 10, 14)` (14 November 2026, local time)
   and pass `now` in the dependencies of **every** existing
   `createSaveNoteAsMarkdownFileFeature({...})` call.
3. In the existing test that asserts the suggested name, change the expected
   value from `"scratch-pad.md"` to `"hello-14-11-2026.md"`. This is the one
   existing assertion this plan changes on purpose; change no other.
4. Add a `describe("exportFileName", ...)` block with these tests, all using
   `new Date(2026, 10, 14)` unless stated:
   - `exportFileName("apikeys", d)` is `"apikeys-14-11-2026.md"`.
   - `exportFileName("# API keys\nsecond line", d)` is `"apikeys-14-11-2026.md"`.
   - `exportFileName("\n   \nKljuči za strežnik!\nmore", d)` is `"kljucizastreznik-14-11-2026.md"`.
   - `exportFileName("---\nTODO: call Ana @ 5pm", d)` is `"todocallana5pm-14-11-2026.md"`.
   - `exportFileName("", d)` and `exportFileName("!!!\n   \n***", d)` are both `"scratchpad-14-11-2026.md"`.
   - a first line of 60 letters `a` gives a slug of exactly 40 `a`s; and
     `exportFileName("a".repeat(39) + " bcd", d)` is `"a".repeat(39) + "b-14-11-2026.md"`
     (the words are joined first, then the cut keeps 40 characters).
   - `exportFileName("x", new Date(2027, 0, 5))` is `"x-05-01-2027.md"` (zero-padded day and month).
   - the result never contains `/`, a space or an upper-case letter for the
     input `"My Notes / Drafts\\ v2"`: it is `"mynotesdraftsv2-14-11-2026.md"`; and the only hyphens in any result are the three around the date parts.

**Verify**: `npx vitest run tests/features/savenoteasmarkdownfilefeature.test.ts` → all pass (6 existing + 8 new = 14).

**Verify**: `npm run typecheck` → exit 0.

### Step 3: Docs

In `PRD.md`, `ARD.md` and `TRD.md`, replace every occurrence of the phrase

`the suggested file name is scratch-pad.md`

with

`the suggested file name is the note's first line in lower case with its words joined, followed by the date as dd-mm-yyyy, for example apikeys-14-11-2026.md, or scratchpad-14-11-2026.md when the note has no usable first line`

Change nothing else in those files.

In `README.md`, change the bullet
`- **Save as Markdown** exports the note as a `.md` file.`
to
`- **Save as Markdown** exports the note as a `.md` file. The suggested name is the note's first line and the date, for example `apikeys-14-11-2026.md`.`

**Verify**: `grep -c "the suggested file name is scratch-pad.md" PRD.md ARD.md TRD.md` → each file prints `0`

**Verify**: `grep -c "apikeys-14-11-2026.md" PRD.md ARD.md TRD.md` → `PRD.md:3`, `ARD.md:2`, `TRD.md:1`

**Verify**: `npm run check` → exit 0, with 88 frontend tests (80 existing + 8).

## Test plan

Covered in step 2: eight new tests for the name, one existing assertion updated
to the new expected name. The dialog itself is not opened by tests.

## Done criteria

ALL must hold:

- [ ] `npm run check` exits 0, with 88 frontend tests passed
- [ ] `grep -rn '"scratch-pad.md"' src/` returns no matches
- [ ] `grep -c "exportFileName" src/features/savenoteasmarkdownfilefeature.ts` prints `2`
- [ ] `git diff --name-only b53b72f..HEAD` lists only in-scope files
- [ ] `git diff --stat b53b72f..HEAD -- src-tauri kit blueprint.json TASKS.md` is empty

## STOP conditions

Stop and report back (do not improvise) if:

- The drift check shows changes, or an excerpt in "Current state" does not match.
- The phrase counts in step 3 differ from the expected ones before you edit
  (run `grep -c "the suggested file name is scratch-pad.md" PRD.md ARD.md TRD.md`
  first: it must print 3, 2 and 1).
- A test for `exportFileName` fails with the function exactly as written in
  step 1. Report the input and the output; do not change the expected value.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- The slug keeps only `a-z` and `0-9`. A note whose first line is written in a
  script without Latin letters (for example Cyrillic) falls through to the next
  line, and in the end to `scratchpad`.
- Two exports on the same day suggest the same name; the save dialog asks
  before overwriting.
- `blueprint.json` and `TASKS.md` still mention `scratch-pad.md`. They are the
  historical input the app was generated from and are left as they are.
