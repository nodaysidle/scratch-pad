// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest"
import { createErrorBanner } from "../../src/errors"
import {
  createNoteStore,
  createSingleNoteEditorFeature,
  type Note,
} from "../../src/features/singlenoteeditorfeature"

const createFakeTimers = () => {
  let now = 0
  let nextId = 1
  const pending = new Map<number, { due: number; fn: () => void }>()
  return {
    timers: {
      set: (fn: () => void, ms: number): number => {
        const id = nextId++
        pending.set(id, { due: now + ms, fn })
        return id
      },
      clear: (id: number): void => {
        pending.delete(id)
      },
    },
    advance: (ms: number): void => {
      now += ms
      for (const [id, entry] of [...pending.entries()]) {
        if (entry.due <= now) {
          pending.delete(id)
          entry.fn()
        }
      }
    },
  }
}

const flushMicrotasks = async () => {
  for (let i = 0; i < 6; i++) {
    await Promise.resolve()
  }
}

describe("SingleNoteEditorFeature", () => {
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

  it("loads an existing stored note into the single text area on startup (ACC-SINGLE-NOTE-EDITOR-04)", async () => {
    const stored: Note[] = [{ id: 1, text: "Stored note from earlier" }]
    const clock = createFakeTimers()
    const store = createNoteStore()
    const errors = createErrorBanner(root)

    createSingleNoteEditorFeature({
      call: async <T>(command: string): Promise<T> => {
        if (command === "list_note") return [...stored] as unknown as T
        throw new Error(`unexpected ${command}`)
      },
      errors,
      store,
      timers: clock.timers,
    })

    await flushMicrotasks()

    const textareas = document.querySelectorAll<HTMLTextAreaElement>('textarea[aria-label="Note"]')
    expect(textareas.length).toBe(1)
    expect(textareas[0]!.value).toBe("Stored note from earlier")
    expect(store.get().draft).toBe("Stored note from earlier")
  })

  it("lays out the note above a status bar and focuses it once loaded", async () => {
    createSingleNoteEditorFeature({
      call: async <T>(command: string): Promise<T> => {
        if (command === "list_note") return [] as unknown as T
        throw new Error(`unexpected ${command}`)
      },
      errors: createErrorBanner(root),
      store: createNoteStore(),
      timers: createFakeTimers().timers,
    })

    await flushMicrotasks()

    const content = document.querySelector(".app-content")!
    expect(content.children.length).toBe(2)
    const textarea = content.children[0]!
    expect(textarea.tagName).toBe("TEXTAREA")
    expect(textarea.classList.contains("editor")).toBe(true)
    const bar = content.children[1]!
    expect(bar.matches("footer.status-bar")).toBe(true)
    expect(bar.children[0]!.matches('[data-slot="status"]')).toBe(true)
    expect(bar.children[1]!.matches('[data-slot="actions"]')).toBe(true)
    expect(document.activeElement).toBe(textarea)
  })

  it("shows empty text area and error banner with retry when initial load fails", async () => {
    let shouldFail = true
    const stored: Note[] = [{ id: 1, text: "Recovered after retry" }]
    const clock = createFakeTimers()
    const store = createNoteStore()
    const errors = createErrorBanner(root)

    createSingleNoteEditorFeature({
      call: async <T>(command: string): Promise<T> => {
        if (command === "list_note") {
          if (shouldFail) throw { kind: "storage", message: "db error" }
          return [...stored] as unknown as T
        }
        throw new Error(`unexpected ${command}`)
      },
      errors,
      store,
      timers: clock.timers,
    })

    await flushMicrotasks()

    const textarea = document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Note"]')!
    expect(textarea.value).toBe("")
    const banner = document.querySelector<HTMLElement>(".error-banner")!
    expect(banner.hidden).toBe(false)
    expect(banner.querySelector("p")?.textContent).toBe("The note could not be loaded.")

    shouldFail = false
    const retryBtn = [...banner.querySelectorAll("button")].find(b => b.textContent === "Retry")!
    retryBtn.click()
    await flushMicrotasks()

    expect(textarea.value).toBe("Recovered after retry")
  })

  it("saves typed text 1000 ms after typing stops and debounces intermediate changes (ACC-SINGLE-NOTE-EDITOR-01, ACC-SINGLE-NOTE-EDITOR-02)", async () => {
    const stored: Note[] = []
    const calls: Array<{ command: string; args: unknown }> = []
    const clock = createFakeTimers()
    const store = createNoteStore()
    const errors = createErrorBanner(root)

    createSingleNoteEditorFeature({
      call: async <T>(command: string, args?: Record<string, unknown>): Promise<T> => {
        calls.push({ command, args })
        if (command === "list_note") return [...stored] as unknown as T
        if (command === "create_note") {
          const input = (args as { input: { text: string } }).input
          const created: Note = { id: 1, text: input.text }
          stored.splice(0, stored.length, created)
          return created as unknown as T
        }
        if (command === "update_note") {
          const { id, input } = args as { id: number; input: { text: string } }
          const updated: Note = { id, text: input.text }
          stored.splice(0, stored.length, updated)
          return updated as unknown as T
        }
        throw new Error(`unexpected ${command}`)
      },
      errors,
      store,
      timers: clock.timers,
    })

    await flushMicrotasks()
    const textarea = document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Note"]')!

    textarea.value = "First draft"
    textarea.dispatchEvent(new Event("input"))
    clock.advance(500)
    expect(stored).toEqual([])

    textarea.value = "First draft updated"
    textarea.dispatchEvent(new Event("input"))
    clock.advance(500)
    expect(stored).toEqual([])

    clock.advance(500)
    await flushMicrotasks()

    expect(stored).toEqual([{ id: 1, text: "First draft updated" }])
    expect(calls.filter(c => c.command === "create_note").length).toBe(1)
    expect(calls.filter(c => c.command === "update_note").length).toBe(0)

    textarea.value = "  leading and trailing  "
    textarea.dispatchEvent(new Event("input"))
    clock.advance(1000)
    await flushMicrotasks()

    expect(stored).toEqual([{ id: 1, text: "  leading and trailing  " }])
    expect(calls.filter(c => c.command === "create_note").length).toBe(1)
    expect(calls.filter(c => c.command === "update_note").length).toBe(1)

    textarea.value = ""
    textarea.dispatchEvent(new Event("input"))
    clock.advance(1000)
    await flushMicrotasks()

    expect(stored).toEqual([{ id: 1, text: "" }])
  })

  it("preserves previous stored note and shows error message on failed write, then retries (ACC-SINGLE-NOTE-EDITOR-03)", async () => {
    const stored: Note[] = [{ id: 1, text: "Initial saved" }]
    let failWrites = true
    const clock = createFakeTimers()
    const store = createNoteStore()
    const errors = createErrorBanner(root)

    createSingleNoteEditorFeature({
      call: async <T>(command: string, args?: Record<string, unknown>): Promise<T> => {
        if (command === "list_note") return [...stored] as unknown as T
        if (command === "update_note") {
          if (failWrites) throw { kind: "storage", message: "disk full" }
          const { id, input } = args as { id: number; input: { text: string } }
          const updated: Note = { id, text: input.text }
          stored.splice(0, stored.length, updated)
          return updated as unknown as T
        }
        throw new Error(`unexpected ${command}`)
      },
      errors,
      store,
      timers: clock.timers,
    })

    await flushMicrotasks()
    const textarea = document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Note"]')!

    textarea.value = "Unsaved new text"
    textarea.dispatchEvent(new Event("input"))
    clock.advance(1000)
    await flushMicrotasks()

    expect(stored).toEqual([{ id: 1, text: "Initial saved" }])
    expect(store.get().note).toEqual([{ id: 1, text: "Initial saved" }])
    expect(textarea.value).toBe("Unsaved new text")

    const banner = document.querySelector<HTMLElement>(".error-banner")!
    expect(banner.hidden).toBe(false)
    expect(banner.querySelector("p")?.textContent).toBe("The note could not be saved.")

    failWrites = false
    const retryBtn = [...banner.querySelectorAll("button")].find(b => b.textContent === "Retry")!
    retryBtn.click()
    await flushMicrotasks()

    expect(stored).toEqual([{ id: 1, text: "Unsaved new text" }])
  })

  it("serializes saves so writes never overlap and flush() writes pending text immediately", async () => {
    const stored: Note[] = []
    let resolveCreate: ((note: Note) => void) | null = null
    const clock = createFakeTimers()
    const store = createNoteStore()
    const errors = createErrorBanner(root)

    const editor = createSingleNoteEditorFeature({
      call: async <T>(command: string, args?: Record<string, unknown>): Promise<T> => {
        if (command === "list_note") return [...stored] as unknown as T
        if (command === "create_note") {
          const input = (args as { input: { text: string } }).input
          return new Promise<Note>(resolve => {
            resolveCreate = note => {
              stored.splice(0, stored.length, note)
              resolve(note)
            }
            void input
          }) as unknown as T
        }
        if (command === "update_note") {
          const { id, input } = args as { id: number; input: { text: string } }
          const updated: Note = { id, text: input.text }
          stored.splice(0, stored.length, updated)
          return updated as unknown as T
        }
        throw new Error(`unexpected ${command}`)
      },
      errors,
      store,
      timers: clock.timers,
    })

    await flushMicrotasks()

    editor.setDraft("First")
    clock.advance(1000)
    await flushMicrotasks()
    expect(resolveCreate).not.toBeNull()

    editor.setDraft("Flushed while create in flight")
    const flushPromise = editor.flush()

    resolveCreate!({ id: 7, text: "First" })
    await flushPromise

    expect(stored).toEqual([{ id: 7, text: "Flushed while create in flight" }])
  })
  it("does not create a second note when the first load failed", async () => {
    const calls: Array<{ command: string; args: unknown }> = []
    let failList = true
    const clock = createFakeTimers()
    const store = createNoteStore()
    const errors = createErrorBanner(root)

    createSingleNoteEditorFeature({
      call: async <T>(command: string, args?: Record<string, unknown>): Promise<T> => {
        calls.push({ command, args })
        if (command === "list_note") {
          if (failList) throw { kind: "storage", message: "db error" }
          return [{ id: 1, text: "Original" }] as unknown as T
        }
        throw new Error(`unexpected ${command}`)
      },
      errors,
      store,
      timers: clock.timers,
    })

    await flushMicrotasks()
    const textarea = document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Note"]')!
    expect(textarea.readOnly).toBe(true)

    textarea.value = "typed"
    textarea.dispatchEvent(new Event("input"))
    clock.advance(1000)
    await flushMicrotasks()
    expect(calls.filter(c => c.command === "create_note" || c.command === "update_note")).toEqual([])

    failList = false
    const banner = document.querySelector<HTMLElement>(".error-banner")!
    const retryBtn = [...banner.querySelectorAll("button")].find(b => b.textContent === "Retry")!
    retryBtn.click()
    await flushMicrotasks()

    expect(textarea.readOnly).toBe(false)
    expect(textarea.value).toBe("Original")
    expect(banner.hidden).toBe(true)
  })

  it("ignores typing until the stored note has loaded", async () => {
    const calls: Array<{ command: string; args: unknown }> = []
    let resolveList: ((notes: Note[]) => void) | null = null
    const clock = createFakeTimers()
    const store = createNoteStore()
    const errors = createErrorBanner(root)

    const editor = createSingleNoteEditorFeature({
      call: async <T>(command: string, args?: Record<string, unknown>): Promise<T> => {
        calls.push({ command, args })
        if (command === "list_note") {
          return new Promise<Note[]>(resolve => {
            resolveList = resolve
          }) as unknown as T
        }
        throw new Error(`unexpected ${command}`)
      },
      errors,
      store,
      timers: clock.timers,
    })

    const textarea = document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Note"]')!
    expect(textarea.readOnly).toBe(true)
    editor.setDraft("early")
    expect(store.get().draft).toBe("")

    resolveList!([{ id: 1, text: "Stored" }])
    await flushMicrotasks()
    expect(textarea.value).toBe("Stored")

    clock.advance(1000)
    await flushMicrotasks()
    expect(calls.filter(c => c.command === "create_note" || c.command === "update_note")).toEqual([])
  })

  it("flush reports a failed save and retries an earlier failed save", async () => {
    const stored: Note[] = [{ id: 1, text: "Initial" }]
    const calls: Array<{ command: string; args: unknown }> = []
    let failWrites = true
    const clock = createFakeTimers()
    const store = createNoteStore()
    const errors = createErrorBanner(root)

    const editor = createSingleNoteEditorFeature({
      call: async <T>(command: string, args?: Record<string, unknown>): Promise<T> => {
        calls.push({ command, args })
        if (command === "list_note") return [...stored] as unknown as T
        if (command === "update_note") {
          if (failWrites) throw { kind: "storage", message: "disk full" }
          const { id, input } = args as { id: number; input: { text: string } }
          const updated: Note = { id, text: input.text }
          stored.splice(0, stored.length, updated)
          return updated as unknown as T
        }
        throw new Error(`unexpected ${command}`)
      },
      errors,
      store,
      timers: clock.timers,
    })

    await flushMicrotasks()
    editor.setDraft("New")
    clock.advance(1000)
    await flushMicrotasks()

    expect(await editor.flush()).toBe(false)
    failWrites = false
    expect(await editor.flush()).toBe(true)
    expect(stored).toEqual([{ id: 1, text: "New" }])

    const updates = calls.filter(c => c.command === "update_note").length
    expect(await editor.flush()).toBe(true)
    expect(calls.filter(c => c.command === "update_note").length).toBe(updates)
  })

  it("hides its error message once a later save succeeds", async () => {
    const stored: Note[] = [{ id: 1, text: "Initial" }]
    let failWrites = true
    const clock = createFakeTimers()
    const store = createNoteStore()
    const errors = createErrorBanner(root)

    createSingleNoteEditorFeature({
      call: async <T>(command: string, args?: Record<string, unknown>): Promise<T> => {
        if (command === "list_note") return [...stored] as unknown as T
        if (command === "update_note") {
          if (failWrites) throw { kind: "storage", message: "disk full" }
          const { id, input } = args as { id: number; input: { text: string } }
          return { id, text: input.text } as unknown as T
        }
        throw new Error(`unexpected ${command}`)
      },
      errors,
      store,
      timers: clock.timers,
    })

    await flushMicrotasks()
    const textarea = document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Note"]')!
    textarea.value = "New"
    textarea.dispatchEvent(new Event("input"))
    clock.advance(1000)
    await flushMicrotasks()

    const banner = document.querySelector<HTMLElement>(".error-banner")!
    expect(banner.hidden).toBe(false)
    expect(banner.querySelector("p")?.textContent).toBe("The note could not be saved.")

    failWrites = false
    textarea.value = "Newer"
    textarea.dispatchEvent(new Event("input"))
    clock.advance(1000)
    await flushMicrotasks()

    expect(banner.hidden).toBe(true)
  })

  it("flush does not create a note when nothing was typed", async () => {
    const calls: Array<{ command: string; args: unknown }> = []
    const clock = createFakeTimers()
    const store = createNoteStore()
    const errors = createErrorBanner(root)

    const editor = createSingleNoteEditorFeature({
      call: async <T>(command: string, args?: Record<string, unknown>): Promise<T> => {
        calls.push({ command, args })
        if (command === "list_note") return [] as unknown as T
        throw new Error(`unexpected ${command}`)
      },
      errors,
      store,
      timers: clock.timers,
    })

    await flushMicrotasks()
    expect(await editor.flush()).toBe(true)
    expect(calls.filter(c => c.command === "create_note")).toEqual([])
  })
})
