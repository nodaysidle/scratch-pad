// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createErrorBanner } from "../../src/errors"
import {
  createNoteStore,
  type Note,
  type SingleNoteEditor,
} from "../../src/features/singlenoteeditorfeature"
import { createOpenPlainTextFileToReplaceNoteFeature } from "../../src/features/openplaintextfiletoreplacenotefeature"

const flushMicrotasks = async () => {
  for (let i = 0; i < 6; i++) {
    await Promise.resolve()
  }
}

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

  it("leaves text area and stored note unchanged when open dialog is cancelled", async () => {
    const store = createNoteStore()
    store.set({ note: [{ id: 1, text: "Unchanged" }], draft: "Unchanged" })
    const errors = createErrorBanner(root)
    const replaceNote = vi.fn().mockResolvedValue(true)
    const editor: SingleNoteEditor = {
      setDraft: vi.fn(),
      replaceNote,
      flush: vi.fn().mockResolvedValue(undefined),
    }
    const confirm = vi.fn().mockResolvedValue(true)

    const feature = createOpenPlainTextFileToReplaceNoteFeature({
      call: vi.fn(),
      errors,
      store,
      editor,
      confirm,
      openDialog: vi.fn().mockResolvedValue(null),
    })

    await feature.openFile()
    await flushMicrotasks()

    expect(confirm).not.toHaveBeenCalled()
    expect(replaceNote).not.toHaveBeenCalled()
    expect(store.get().draft).toBe("Unchanged")
  })

  it("leaves text area and stored note unchanged when confirmation is cancelled (ACC-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE-01)", async () => {
    const store = createNoteStore()
    store.set({ note: [{ id: 1, text: "Draft one" }], draft: "Draft one" })
    const errors = createErrorBanner(root)
    const replaceNote = vi.fn().mockResolvedValue(true)
    const editor: SingleNoteEditor = {
      setDraft: vi.fn(),
      replaceNote,
      flush: vi.fn().mockResolvedValue(undefined),
    }
    const confirm = vi.fn().mockResolvedValue(false)

    const feature = createOpenPlainTextFileToReplaceNoteFeature({
      call: vi.fn(),
      errors,
      store,
      editor,
      confirm,
      openDialog: vi.fn().mockResolvedValue("/path/to/file.txt"),
    })

    await feature.openFile()
    await flushMicrotasks()

    expect(confirm).toHaveBeenCalledWith(
      "Replace the current note with the contents of this file?",
      "Replace"
    )
    expect(replaceNote).not.toHaveBeenCalled()
    expect(store.get().draft).toBe("Draft one")
  })

  it("replaces text area and stored note with file contents on confirmation (ACC-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE-02)", async () => {
    const store = createNoteStore()
    store.set({ note: [{ id: 1, text: "Draft one" }], draft: "Draft one" })
    const errors = createErrorBanner(root)
    let storedNote: Note[] = [{ id: 1, text: "Draft one" }]

    const editor: SingleNoteEditor = {
      setDraft: vi.fn(),
      replaceNote: vi.fn().mockImplementation(async (text: string) => {
        store.set({ draft: text })
        storedNote = [{ id: 1, text }]
        store.set({ note: storedNote })
        return true
      }),
      flush: vi.fn().mockResolvedValue(undefined),
    }

    const feature = createOpenPlainTextFileToReplaceNoteFeature({
      call: async <T>(cmd: string, args?: Record<string, unknown>): Promise<T> => {
        if (cmd === "read_text_file" && (args as { path: string })?.path === "/path/to/draft2.txt") {
          return "Draft two" as unknown as T
        }
        throw new Error(`unexpected ${cmd}`)
      },
      errors,
      store,
      editor,
      confirm: vi.fn().mockResolvedValue(true),
      openDialog: vi.fn().mockResolvedValue("/path/to/draft2.txt"),
    })

    await feature.openFile()
    await flushMicrotasks()

    expect(editor.replaceNote).toHaveBeenCalledWith("Draft two")
    expect(store.get().draft).toBe("Draft two")
    expect(store.get().note[0]?.text).toBe("Draft two")
  })

  it("keeps previous values and shows error message when file cannot be read, then retries without re-asking (ACC-OPEN-PLAIN-TEXT-FILE-TO-REPLACE-NOTE-03)", async () => {
    const store = createNoteStore()
    store.set({ note: [{ id: 1, text: "Original note" }], draft: "Original note" })
    const errors = createErrorBanner(root)
    const replaceNote = vi.fn().mockResolvedValue(true)
    const editor: SingleNoteEditor = {
      setDraft: vi.fn(),
      replaceNote,
      flush: vi.fn().mockResolvedValue(undefined),
    }
    const confirm = vi.fn().mockResolvedValue(true)
    let failRead = true

    const feature = createOpenPlainTextFileToReplaceNoteFeature({
      call: async <T>(cmd: string, args?: Record<string, unknown>): Promise<T> => {
        if (cmd === "read_text_file") {
          if (failRead) throw { kind: "invalid", message: "invalid utf8" }
          return "Recovered content" as unknown as T
        }
        throw new Error(`unexpected ${cmd}`)
      },
      errors,
      store,
      editor,
      confirm,
      openDialog: vi.fn().mockResolvedValue("/bad/file.txt"),
    })

    await feature.openFile()
    await flushMicrotasks()

    expect(replaceNote).not.toHaveBeenCalled()
    expect(store.get().draft).toBe("Original note")

    const banner = document.querySelector<HTMLElement>(".error-banner")!
    expect(banner.hidden).toBe(false)
    expect(banner.querySelector("p")?.textContent).toBe("The file could not be opened.")
    expect(confirm).toHaveBeenCalledTimes(1)

    failRead = false
    const retryBtn = [...banner.querySelectorAll("button")].find(b => b.textContent === "Retry")!
    retryBtn.click()
    await flushMicrotasks()

    // Retried without re-asking confirmation
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(replaceNote).toHaveBeenCalledWith("Recovered content")
  })
  it("asks again before a retry replaces text typed after the failure", async () => {
    const store = createNoteStore()
    store.set({ note: [{ id: 1, text: "Original note" }], draft: "Original note" })
    const errors = createErrorBanner(root)
    const replaceNote = vi.fn().mockResolvedValue(true)
    const editor: SingleNoteEditor = {
      setDraft: vi.fn(),
      replaceNote,
      flush: vi.fn().mockResolvedValue(true),
    }
    const confirm = vi.fn().mockResolvedValue(true)
    let failRead = true

    const feature = createOpenPlainTextFileToReplaceNoteFeature({
      call: async <T>(cmd: string): Promise<T> => {
        if (cmd === "read_text_file") {
          if (failRead) throw { kind: "invalid", message: "invalid utf8" }
          return "Recovered content" as unknown as T
        }
        throw new Error(`unexpected ${cmd}`)
      },
      errors,
      store,
      editor,
      confirm,
      openDialog: vi.fn().mockResolvedValue("/bad/file.txt"),
    })

    await feature.openFile()
    await flushMicrotasks()
    expect(confirm).toHaveBeenCalledTimes(1)

    store.set({ draft: "Typed after the failure" })
    confirm.mockResolvedValueOnce(false)
    failRead = false
    const banner = document.querySelector<HTMLElement>(".error-banner")!
    const retryBtn = [...banner.querySelectorAll("button")].find(b => b.textContent === "Retry")!
    retryBtn.click()
    await flushMicrotasks()

    expect(confirm).toHaveBeenCalledTimes(2)
    expect(replaceNote).not.toHaveBeenCalled()
  })

  it("clears the file-open error banner when a subsequent read succeeds", async () => {
    const store = createNoteStore()
    store.set({ note: [{ id: 1, text: "Original note" }], draft: "Original note" })
    const errors = createErrorBanner(root)
    const replaceNote = vi.fn().mockResolvedValue(true)
    const editor: SingleNoteEditor = {
      setDraft: vi.fn(),
      replaceNote,
      flush: vi.fn().mockResolvedValue(true),
    }
    let failRead = true

    const feature = createOpenPlainTextFileToReplaceNoteFeature({
      call: async <T>(cmd: string): Promise<T> => {
        if (cmd === "read_text_file") {
          if (failRead) throw { kind: "invalid", message: "invalid utf8" }
          return "Good content" as unknown as T
        }
        throw new Error(`unexpected ${cmd}`)
      },
      errors,
      store,
      editor,
      confirm: vi.fn().mockResolvedValue(true),
      openDialog: vi.fn().mockResolvedValue("/path/to/file.txt"),
    })

    await feature.openFile()
    await flushMicrotasks()
    const banner = document.querySelector<HTMLElement>(".error-banner")!
    expect(banner.hidden).toBe(false)
    expect(banner.querySelector("p")?.textContent).toBe("The file could not be opened.")

    failRead = false
    await feature.openFile()
    await flushMicrotasks()
    expect(banner.hidden).toBe(true)
    expect(replaceNote).toHaveBeenCalledWith("Good content")
  })

  it("prevents concurrent openFile calls from opening stacked file dialogs", async () => {
    const store = createNoteStore()
    const errors = createErrorBanner(root)
    const editor: SingleNoteEditor = {
      setDraft: vi.fn(),
      replaceNote: vi.fn().mockResolvedValue(true),
      flush: vi.fn().mockResolvedValue(true),
    }
    let resolveDialog: (value: string | null) => void = () => {}
    const openDialog = vi.fn(
      () => new Promise<string | null>(resolve => { resolveDialog = resolve }),
    )

    const feature = createOpenPlainTextFileToReplaceNoteFeature({
      call: vi.fn(),
      errors,
      store,
      editor,
      confirm: vi.fn().mockResolvedValue(false),
      openDialog,
    })

    const first = feature.openFile()
    const second = feature.openFile()
    expect(openDialog).toHaveBeenCalledTimes(1)

    resolveDialog(null)
    await Promise.all([first, second])

    const third = feature.openFile()
    expect(openDialog).toHaveBeenCalledTimes(2)
    resolveDialog(null)
    await third
  })
})
