// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createErrorBanner } from "../../src/errors"
import { createNoteStore } from "../../src/features/singlenoteeditorfeature"
import {
  createSaveNoteAsMarkdownFileFeature,
  exportFileName,
} from "../../src/features/savenoteasmarkdownfilefeature"

const now = () => new Date(2026, 10, 14)

const flushMicrotasks = async () => {
  for (let i = 0; i < 6; i++) {
    await Promise.resolve()
  }
}

describe("SaveNoteAsMarkdownFileFeature", () => {
  let root: HTMLElement

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="app">
        <header class="app-header"><h1>Scratch Pad</h1></header>
        <section class="app-content" aria-label="Scratch Pad"></section>
      </div>
    `
    root = document.querySelector<HTMLElement>("#app")!
  })

  it("cancelling the save panel writes no file and shows no message (ACC-SAVE-NOTE-AS-MARKDOWN-FILE-01)", async () => {
    const store = createNoteStore()
    store.set({ note: [{ id: 1, text: "Existing note" }], draft: "Existing note" })
    const errors = createErrorBanner(root)
    const call = vi.fn()

    const feature = createSaveNoteAsMarkdownFileFeature({
      call,
      errors,
      store,
      now,
      saveDialog: vi.fn().mockResolvedValue(null),
    })

    await feature.saveMarkdown()
    await flushMicrotasks()

    expect(call).not.toHaveBeenCalled()
    expect(feature.status.textContent).toBe("")
    const banner = document.querySelector<HTMLElement>(".error-banner")!
    expect(banner.hidden).toBe(true)
  })

  it("saving an empty note produces '# Scratch Pad\\n\\n' (ACC-SAVE-NOTE-AS-MARKDOWN-FILE-02)", async () => {
    const store = createNoteStore()
    store.set({ note: [{ id: 1, text: "Old note" }], draft: "" })
    const errors = createErrorBanner(root)
    const callArgs: Array<{ cmd: string; args: unknown }> = []

    const feature = createSaveNoteAsMarkdownFileFeature({
      call: async <T>(cmd: string, args?: Record<string, unknown>): Promise<T> => {
        callArgs.push({ cmd, args })
        return undefined as unknown as T
      },
      errors,
      store,
      now,
      saveDialog: vi.fn().mockResolvedValue("/path/to/scratch-pad.md"),
    })

    await feature.saveMarkdown()
    await flushMicrotasks()

    expect(callArgs).toEqual([
      {
        cmd: "write_markdown_export_file",
        args: { path: "/path/to/scratch-pad.md", content: "# Scratch Pad\n\n" },
      },
    ])
    expect(feature.status.textContent).toBe("The file was saved.")
  })

  it("saving a note whose text is 'Hello' produces '# Scratch Pad\\n\\nHello' using the current draft (ACC-SAVE-NOTE-AS-MARKDOWN-FILE-03)", async () => {
    const store = createNoteStore()
    // Stored note is empty or older, but draft is 'Hello' (typed less than 1s ago)
    store.set({ note: [{ id: 1, text: "Previous" }], draft: "Hello" })
    const errors = createErrorBanner(root)
    const callArgs: Array<{ cmd: string; args: unknown }> = []

    const feature = createSaveNoteAsMarkdownFileFeature({
      call: async <T>(cmd: string, args?: Record<string, unknown>): Promise<T> => {
        callArgs.push({ cmd, args })
        return undefined as unknown as T
      },
      errors,
      store,
      now,
      saveDialog: vi.fn().mockImplementation(async (opts: { defaultPath: string }) => {
        expect(opts.defaultPath).toBe("hello-14-11-2026.md")
        return "/path/to/my-note.md"
      }),
    })

    await feature.saveMarkdown()
    await flushMicrotasks()

    expect(callArgs).toEqual([
      {
        cmd: "write_markdown_export_file",
        args: { path: "/path/to/my-note.md", content: "# Scratch Pad\n\nHello" },
      },
    ])
    expect(feature.status.textContent).toBe("The file was saved.")
  })

  it("leaves status empty, shows error message, and allows retry when write fails (ACC-SAVE-NOTE-AS-MARKDOWN-FILE-04)", async () => {
    const store = createNoteStore()
    store.set({ note: [{ id: 1, text: "Hello" }], draft: "Hello" })
    const errors = createErrorBanner(root)
    let shouldFail = true
    const callArgs: Array<{ cmd: string; args: unknown }> = []

    const feature = createSaveNoteAsMarkdownFileFeature({
      call: async <T>(cmd: string, args?: Record<string, unknown>): Promise<T> => {
        callArgs.push({ cmd, args })
        if (shouldFail) throw { kind: "storage", message: "disk error" }
        return undefined as unknown as T
      },
      errors,
      store,
      now,
      saveDialog: vi.fn().mockResolvedValue("/path/to/fail.md"),
    })

    await feature.saveMarkdown()
    await flushMicrotasks()

    expect(feature.status.textContent).toBe("")
    const banner = document.querySelector<HTMLElement>(".error-banner")!
    expect(banner.hidden).toBe(false)
    expect(banner.querySelector("p")?.textContent).toBe("The file could not be saved.")

    shouldFail = false
    const retryBtn = [...banner.querySelectorAll("button")].find(b => b.textContent === "Retry")!
    retryBtn.click()
    await flushMicrotasks()

    expect(feature.status.textContent).toBe("The file was saved.")
    expect(callArgs.length).toBe(2)
  })
  it("a retry exports the current text", async () => {
    const store = createNoteStore()
    store.set({ note: [{ id: 1, text: "Hello" }], draft: "Hello" })
    const errors = createErrorBanner(root)
    let shouldFail = true
    const callArgs: Array<{ cmd: string; args: unknown }> = []

    const feature = createSaveNoteAsMarkdownFileFeature({
      call: async <T>(cmd: string, args?: Record<string, unknown>): Promise<T> => {
        callArgs.push({ cmd, args })
        if (shouldFail) throw { kind: "storage", message: "disk error" }
        return undefined as unknown as T
      },
      errors,
      store,
      now,
      saveDialog: vi.fn().mockResolvedValue("/path/to/fail.md"),
    })

    await feature.saveMarkdown()
    await flushMicrotasks()

    store.set({ draft: "Hello again" })
    shouldFail = false
    const banner = document.querySelector<HTMLElement>(".error-banner")!
    const retryBtn = [...banner.querySelectorAll("button")].find(b => b.textContent === "Retry")!
    retryBtn.click()
    await flushMicrotasks()

    expect(callArgs[1]?.args).toEqual({
      path: "/path/to/fail.md",
      content: "# Scratch Pad\n\nHello again",
    })
  })

  it("prevents concurrent saveMarkdown calls from stacking save dialogs", async () => {
    const store = createNoteStore()
    store.set({ note: [{ id: 1, text: "Hello" }], draft: "Hello" })
    const errors = createErrorBanner(root)
    let resolveDialog: (value: string | null) => void = () => {}
    const saveDialog = vi.fn(
      () => new Promise<string | null>(resolve => { resolveDialog = resolve }),
    )

    const feature = createSaveNoteAsMarkdownFileFeature({
      call: vi.fn(),
      errors,
      store,
      now,
      saveDialog,
    })

    const first = feature.saveMarkdown()
    const second = feature.saveMarkdown()
    expect(saveDialog).toHaveBeenCalledTimes(1)

    resolveDialog(null)
    await Promise.all([first, second])

    const third = feature.saveMarkdown()
    expect(saveDialog).toHaveBeenCalledTimes(2)
    resolveDialog(null)
    await third
  })

  it("clears 'The file was saved.' status after a subsequent draft edit", async () => {
    const store = createNoteStore()
    store.set({ note: [{ id: 1, text: "Hello" }], draft: "Hello" })
    const errors = createErrorBanner(root)

    const feature = createSaveNoteAsMarkdownFileFeature({
      call: async <T>(): Promise<T> => undefined as unknown as T,
      errors,
      store,
      now,
      saveDialog: vi.fn().mockResolvedValue("/path/to/note.md"),
    })

    await feature.saveMarkdown()
    await flushMicrotasks()
    expect(feature.status.textContent).toBe("The file was saved.")

    store.set({ note: [{ id: 1, text: "Hello" }] })
    expect(feature.status.textContent).toBe("The file was saved.")

    store.set({ draft: "Hello edited" })
    expect(feature.status.textContent).toBe("")
  })
})

describe("exportFileName", () => {
  const d = new Date(2026, 10, 14)

  it("uses a plain first line as the slug", () => {
    expect(exportFileName("apikeys", d)).toBe("apikeys-14-11-2026.md")
  })

  it("drops Markdown heading marks, lowercases and joins the words", () => {
    expect(exportFileName("# API keys\nsecond line", d)).toBe("apikeys-14-11-2026.md")
  })

  it("skips blank lines and removes accents", () => {
    expect(exportFileName("\n   \nKljuči za strežnik!\nmore", d)).toBe(
      "kljucizastreznik-14-11-2026.md",
    )
  })

  it("skips a line with no letters or digits", () => {
    expect(exportFileName("---\nTODO: call Ana @ 5pm", d)).toBe("todocallana5pm-14-11-2026.md")
  })

  it("falls back to scratchpad when no line is usable", () => {
    expect(exportFileName("", d)).toBe("scratchpad-14-11-2026.md")
    expect(exportFileName("!!!\n   \n***", d)).toBe("scratchpad-14-11-2026.md")
  })

  it("joins the words first, then cuts the slug to 40 characters", () => {
    expect(exportFileName("a".repeat(60), d)).toBe("a".repeat(40) + "-14-11-2026.md")
    expect(exportFileName("a".repeat(39) + " bcd", d)).toBe("a".repeat(39) + "b-14-11-2026.md")
  })

  it("zero-pads the day and month", () => {
    expect(exportFileName("x", new Date(2027, 0, 5))).toBe("x-05-01-2027.md")
  })

  it("never contains a slash, a space, an upper-case letter or a hyphen outside the date", () => {
    const name = exportFileName("My Notes / Drafts\\ v2", d)
    expect(name).toBe("mynotesdraftsv2-14-11-2026.md")
    expect(name.split("-").length - 1).toBe(3)
  })
})
