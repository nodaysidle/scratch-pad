// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createErrorBanner } from "../../src/errors"
import {
  createNoteStore,
  type SingleNoteEditor,
} from "../../src/features/singlenoteeditorfeature"
import { createOpenPlainTextFileToReplaceNoteFeature } from "../../src/features/openplaintextfiletoreplacenotefeature"

const flushMicrotasks = async () => {
  for (let i = 0; i < 6; i++) {
    await Promise.resolve()
  }
}

const question = "Replace the current note with the contents of this file?"

describe("OpenPlainTextFileToReplaceNoteFeature", () => {
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

  const setup = (
    call: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>,
    confirmAnswer = true,
  ) => {
    const store = createNoteStore()
    store.set({ note: [{ id: 1, text: "Draft one" }], draft: "Draft one" })
    const replaceNote = vi.fn().mockResolvedValue(true)
    const editor: SingleNoteEditor = {
      setDraft: vi.fn(),
      replaceNote,
      flush: vi.fn().mockResolvedValue(true),
    }
    const confirm = vi.fn().mockResolvedValue(confirmAnswer)
    const feature = createOpenPlainTextFileToReplaceNoteFeature({
      call: vi.fn(call) as never,
      errors: createErrorBanner(root),
      store,
      editor,
      confirm,
    })
    return { feature, store, replaceNote, confirm }
  }

  const banner = () => document.querySelector<HTMLElement>(".error-banner")!
  const retry = () =>
    [...banner().querySelectorAll("button")].find(b => b.textContent === "Retry")!

  it("leaves the note unchanged and asks nothing when the open dialog is cancelled", async () => {
    const { feature, store, replaceNote, confirm } = setup(async () => null)

    await feature.openFile()
    await flushMicrotasks()

    expect(confirm).not.toHaveBeenCalled()
    expect(replaceNote).not.toHaveBeenCalled()
    expect(store.get().draft).toBe("Draft one")
    expect(banner().hidden).toBe(true)
  })

  it("asks Rust to pick and read the file, sending no path and no arguments (ACC-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE-01)", async () => {
    const call = vi.fn(async () => "Draft two")
    const { feature } = setup(call)

    await feature.openFile()

    expect(call).toHaveBeenCalledTimes(1)
    expect(call.mock.calls[0]).toEqual(["open_text_file"])
  })

  it("leaves the note unchanged when the confirmation is declined", async () => {
    const { feature, store, replaceNote, confirm } = setup(async () => "Draft two", false)

    await feature.openFile()
    await flushMicrotasks()

    expect(confirm).toHaveBeenCalledWith(question, "Replace")
    expect(replaceNote).not.toHaveBeenCalled()
    expect(store.get().draft).toBe("Draft one")
  })

  it("replaces the note with the file's contents on confirmation (ACC-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE-02)", async () => {
    const { feature, replaceNote, confirm } = setup(async () => "Draft two")

    await feature.openFile()
    await flushMicrotasks()

    expect(confirm).toHaveBeenCalledWith(question, "Replace")
    expect(replaceNote).toHaveBeenCalledWith("Draft two")
  })

  it("replaces the note with an empty file", async () => {
    const { feature, replaceNote } = setup(async () => "")

    await feature.openFile()

    expect(replaceNote).toHaveBeenCalledWith("")
  })

  it("keeps the note and shows an error when the file cannot be read, then Retry shows the dialog again (ACC-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE-03)", async () => {
    let failRead = true
    const { feature, store, replaceNote, confirm } = setup(async () => {
      if (failRead) throw { kind: "invalid", message: "The file could not be opened." }
      return "Recovered content"
    })

    await feature.openFile()
    await flushMicrotasks()

    expect(replaceNote).not.toHaveBeenCalled()
    expect(store.get().draft).toBe("Draft one")
    expect(confirm).not.toHaveBeenCalled()
    expect(banner().hidden).toBe(false)
    expect(banner().querySelector("p")?.textContent).toBe("The file could not be opened.")

    failRead = false
    retry().click()
    await flushMicrotasks()

    expect(confirm).toHaveBeenCalledTimes(1)
    expect(replaceNote).toHaveBeenCalledWith("Recovered content")
    expect(banner().hidden).toBe(true)
  })

  it("clears the error banner when a later open succeeds", async () => {
    let failRead = true
    const { feature, replaceNote } = setup(async () => {
      if (failRead) throw { kind: "invalid", message: "invalid utf8" }
      return "Good content"
    })

    await feature.openFile()
    await flushMicrotasks()
    expect(banner().hidden).toBe(false)

    failRead = false
    await feature.openFile()
    await flushMicrotasks()
    expect(banner().hidden).toBe(true)
    expect(replaceNote).toHaveBeenCalledWith("Good content")
  })

  it("prevents concurrent openFile calls from stacking file dialogs", async () => {
    let resolveDialog: (value: string | null) => void = () => {}
    const call = vi.fn(() => new Promise<string | null>(resolve => { resolveDialog = resolve }))
    const { feature } = setup(call)

    const first = feature.openFile()
    const second = feature.openFile()
    expect(call).toHaveBeenCalledTimes(1)

    resolveDialog(null)
    await Promise.all([first, second])

    const third = feature.openFile()
    expect(call).toHaveBeenCalledTimes(2)
    resolveDialog(null)
    await third
  })
})
