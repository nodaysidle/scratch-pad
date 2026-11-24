# Plan 014: A slow theme re-read never overwrites a newer pushed theme

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. Do NOT edit `docs/plans/README.md`: the reviewer
> maintains the index.
>
> **Drift check (run first)**: `git diff --stat bb5a1a2..HEAD -- src/omarchy.ts tests/omarchy.test.ts`
> must be empty; otherwise compare the excerpt below with the live code and
> STOP on a mismatch.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `bb5a1a2`, 2026-11-24

## Why this matters

Scratch Pad follows the Omarchy theme two ways: Rust pushes an
`omarchy-changed` event when the theme files change, and the window re-reads
both values whenever it regains focus. Switching theme from the Omarchy menu
returns focus to the window, so a re-read can start while the old theme is
still on disk; the pushed event then applies the new colours, and the slower
re-read resolves afterwards and puts the old colours back. The window then
shows the previous theme until the next focus or theme change.

## Current state

`src/omarchy.ts`, inside `followOmarchy` (lines 90-110):

```ts
  const read = async (): Promise<void> => {
    // No Tauri runtime or a failed call: the stylesheet's fallback colours and size stay.
    const [palette, font] = await Promise.allSettled([
      deps.call<Palette>("theme_palette"),
      deps.call<TerminalFont>("terminal_font"),
    ])
    apply({
      palette: palette.status === "fulfilled" ? palette.value : undefined,
      font: font.status === "fulfilled" ? font.value : undefined,
    })
  }

  try {
    await deps.listen<OmarchyState>("omarchy-changed", event => apply(event.payload))
  } catch {
    // Outside a Tauri runtime (such as unit tests) there are no events; the startup read still applies.
  }
  const win = deps.win ?? (typeof window !== "undefined" ? window : undefined)
  win?.addEventListener("focus", () => void read())
  await read()
```

`apply(state)` sets the colours and font size when they are complete and
different from what is applied. Nothing orders a read against an event.

Tests: `tests/omarchy.test.ts`, Vitest + happy-dom. Its `setup()` inside
`describe("followOmarchy", ...)` returns `{ root, call, listen, emit, win, answer }`:
`call` is a `vi.fn` answering from the current `palette`/`font`, `answer({...})`
changes what later calls return, `emit(state)` delivers an `omarchy-changed`
payload, `win.dispatchEvent(new Event("focus"))` triggers a re-read. The
constants `light` (background `#faf4ed`) and the default dark palette
(background `#000000`) are defined there. Model new tests on
"re-reads on window focus, so a change of monitor scale is picked up".

Conventions: no semicolons, double quotes, two-space indent, short `//`
comments that say why.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install (fresh worktree only) | `npm ci` | exit 0 |
| Typecheck | `npm run typecheck` | exit 0 |
| Tests | `npm test` | exit 0, all pass |

## Scope

**In scope**:
- `src/omarchy.ts`
- `tests/omarchy.test.ts`

**Out of scope**: every other file, including `src/main.ts` and anything under `src-tauri/`.

## Git workflow

- Branch: continue on the current branch of this worktree, or `advisor/014-theme-read-order`.
- Commit message style: `fix: a slow theme re-read no longer undoes a newer pushed theme`.
- Do NOT push.

## Steps

### Step 1: Order reads against events

In `followOmarchy`:
- add `let latest = 0` with a comment: counts reads and pushed events, so a
  read that finishes after something newer is dropped;
- the event handler becomes `event => { latest += 1; apply(event.payload) }`;
- `read` takes `const mine = ++latest` before awaiting and returns without
  applying when `mine !== latest` after the await.

**Verify**: `npm run typecheck` → exit 0; `npm test` → exit 0.

### Step 2: Tests

Add to `tests/omarchy.test.ts`:
1. A re-read that resolves after a pushed event is ignored: make the next
   `theme_palette`/`terminal_font` calls return promises you resolve by hand
   (old dark palette); dispatch `focus`; `emit({ palette: light, font: ... })`;
   then resolve the held calls and flush microtasks. `--bg` stays `#faf4ed`.
2. Two overlapping re-reads: the first to start resolves last with older
   values; the applied colours are those of the later read.
3. A re-read with no event in between still applies (the existing focus test
   already covers this; keep it passing).

If the existing `setup()` cannot hold a call open, extend it inside the test
file (for example a `hold()` helper returning a `release()` function) without
changing what existing tests see.

**Verify**: `npm test` → exit 0 including the two new cases.

## Done criteria

- [ ] `npm run typecheck` exits 0
- [ ] `npm test` exits 0 with the two new tests
- [ ] `git diff --name-only bb5a1a2..HEAD -- src tests` lists `src/omarchy.ts` and `tests/omarchy.test.ts` only (plus plan 010's files if run in the same worktree: those are all under `src-tauri/`)

## STOP conditions

- The excerpt does not match the live code.
- A verification fails twice after a reasonable fix attempt.
- The fix seems to need a change in Rust or in `src/main.ts`.

## Maintenance notes

- An event cancels a read in flight even when the event carries an incomplete
  palette (mid-switch). That is safe because the backend sends another event
  when the switch settles, and the next focus re-reads.
- NOT verified in a real window: how often the race actually occurs with
  Omarchy's menu; the fix is correct regardless of timing.
