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

  const banner = () => document.querySelector<HTMLElement>(".error-banner")!
  const retry = () =>
    [...banner().querySelectorAll("button")].find(b => b.textContent === "Retry")!

  const setup = (draft: string, call: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>) => {
    const store = createNoteStore()
    store.set({ note: [{ id: 1, text: "Previous" }], draft })
    const calls: Array<{ cmd: string; args: unknown }> = []
    const feature = createSaveNoteAsMarkdownFileFeature({
      call: (async (cmd: string, args?: Record<string, unknown>) => {
        calls.push({ cmd, args })
        return call(cmd, args)
      }) as never,
      errors: createErrorBanner(root),
      store,
      now,
    })
    return { feature, store, calls }
  }

  it("cancelling the save panel writes no file and shows no message (ACC-SAVE-NOTE-AS-MARKDOWN-FILE-01)", async () => {
    const { feature } = setup("Existing note", async () => false)

    await feature.saveMarkdown()
    await flushMicrotasks()

    expect(feature.status.textContent).toBe("")
    expect(banner().hidden).toBe(true)
  })

  it("saving an empty note produces '# Scratch Pad\\n\\n' (ACC-SAVE-NOTE-AS-MARKDOWN-FILE-02)", async () => {
    const { feature, calls } = setup("", async () => true)

    await feature.saveMarkdown()
    await flushMicrotasks()

    expect(calls).toEqual([
      {
        cmd: "save_markdown_file",
        args: { suggestedName: "scratchpad-14-11-2026.md", content: "# Scratch Pad\n\n" },
      },
    ])
    expect(feature.status.textContent).toBe("The file was saved.")
  })

  it("sends the current draft and the suggested name, and never a path (ACC-SAVE-NOTE-AS-MARKDOWN-FILE-03)", async () => {
    const { feature, calls } = setup("Hello", async () => true)

    await feature.saveMarkdown()
    await flushMicrotasks()

    expect(calls).toEqual([
      {
        cmd: "save_markdown_file",
        args: { suggestedName: "hello-14-11-2026.md", content: "# Scratch Pad\n\nHello" },
      },
    ])
    expect(feature.status.textContent).toBe("The file was saved.")
  })

  it("leaves status empty, shows an error, and Retry saves the current text when the write fails (ACC-SAVE-NOTE-AS-MARKDOWN-FILE-04)", async () => {
    let shouldFail = true
    const { feature, store, calls } = setup("Hello", async () => {
      if (shouldFail) throw { kind: "storage", message: "disk error" }
      return true
    })

    await feature.saveMarkdown()
    await flushMicrotasks()

    expect(feature.status.textContent).toBe("")
    expect(banner().hidden).toBe(false)
    expect(banner().querySelector("p")?.textContent).toBe("The file could not be saved.")

    store.set({ draft: "Hello again" })
    shouldFail = false
    retry().click()
    await flushMicrotasks()

    expect(feature.status.textContent).toBe("The file was saved.")
    expect(calls).toHaveLength(2)
    expect(calls[1]?.args).toEqual({
      suggestedName: "helloagain-14-11-2026.md",
      content: "# Scratch Pad\n\nHello again",
    })
    expect(banner().hidden).toBe(true)
  })

  it("prevents concurrent saveMarkdown calls from stacking save dialogs", async () => {
    let resolveDialog: (value: boolean) => void = () => {}
    const call = vi.fn(() => new Promise<boolean>(resolve => { resolveDialog = resolve }))
    const { feature } = setup("Hello", call)

    const first = feature.saveMarkdown()
    const second = feature.saveMarkdown()
    expect(call).toHaveBeenCalledTimes(1)

    resolveDialog(false)
    await Promise.all([first, second])

    const third = feature.saveMarkdown()
    expect(call).toHaveBeenCalledTimes(2)
    resolveDialog(false)
    await third
  })

  it("shows no 'saved' status when the text changed while the dialog was open", async () => {
    const { feature, store } = setup("Hello", async () => {
      store.set({ draft: "Hello, edited meanwhile" })
      return true
    })

    await feature.saveMarkdown()
    await flushMicrotasks()

    expect(feature.status.textContent).toBe("")
  })

  it("clears 'The file was saved.' status after a subsequent draft edit", async () => {
    const { feature, store } = setup("Hello", async () => true)

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
