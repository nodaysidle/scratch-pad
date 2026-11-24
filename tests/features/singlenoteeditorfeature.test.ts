// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createErrorBanner } from "../../src/errors"
import { createSlots } from "../../src/store"
import { createNoteStore, createSingleNoteEditorFeature, UNDOABLE_REPLACE_MAX, type Note } from "../../src/features/singlenoteeditorfeature"

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

  it("returns its textarea and shows a hint in an empty note", () => {
    const editor = createSingleNoteEditorFeature({
      call: async <T>(command: string): Promise<T> => {
        if (command === "list_note") return [] as unknown as T
        throw new Error(`unexpected ${command}`)
      },
      errors: createErrorBanner(root),
      store: createNoteStore(),
      timers: createFakeTimers().timers,
    })

    expect(editor.textarea).toBe(document.querySelector('textarea[aria-label="Note"]'))
    expect(editor.textarea.placeholder).toBe("Type here. The note saves as you type.")
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

  it("saves typed text 5000 ms after typing stops and debounces intermediate changes (ACC-SINGLE-NOTE-EDITOR-01, ACC-SINGLE-NOTE-EDITOR-02)", async () => {
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
          return { id: created.id } as unknown as T
        }
        if (command === "update_note") {
          const { id, input } = args as { id: number; input: { text: string } }
          const updated: Note = { id, text: input.text }
          stored.splice(0, stored.length, updated)
          return { id: updated.id } as unknown as T
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

    clock.advance(4500)
    await flushMicrotasks()

    expect(stored).toEqual([{ id: 1, text: "First draft updated" }])
    expect(calls.filter(c => c.command === "create_note").length).toBe(1)
    expect(calls.filter(c => c.command === "update_note").length).toBe(0)

    textarea.value = "  leading and trailing  "
    textarea.dispatchEvent(new Event("input"))
    clock.advance(5000)
    await flushMicrotasks()

    expect(stored).toEqual([{ id: 1, text: "  leading and trailing  " }])
    expect(calls.filter(c => c.command === "create_note").length).toBe(1)
    expect(calls.filter(c => c.command === "update_note").length).toBe(1)

    textarea.value = ""
    textarea.dispatchEvent(new Event("input"))
    clock.advance(5000)
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
          return { id: updated.id } as unknown as T
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
    clock.advance(5000)
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
          return { id: updated.id } as unknown as T
        }
        throw new Error(`unexpected ${command}`)
      },
      errors,
      store,
      timers: clock.timers,
    })

    await flushMicrotasks()

    editor.setDraft("First")
    clock.advance(5000)
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
    clock.advance(5000)
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

    clock.advance(5000)
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
          return { id: updated.id } as unknown as T
        }
        throw new Error(`unexpected ${command}`)
      },
      errors,
      store,
      timers: clock.timers,
    })

    await flushMicrotasks()
    editor.setDraft("New")
    clock.advance(5000)
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
          return { id } as unknown as T
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
    clock.advance(5000)
    await flushMicrotasks()

    const banner = document.querySelector<HTMLElement>(".error-banner")!
    expect(banner.hidden).toBe(false)
    expect(banner.querySelector("p")?.textContent).toBe("The note could not be saved.")

    failWrites = false
    textarea.value = "Newer"
    textarea.dispatchEvent(new Event("input"))
    clock.advance(5000)
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

  it("skips update_note when edits revert back to the last saved text before the debounce fires", async () => {
    const stored: Note[] = [{ id: 1, text: "Original" }]
    const calls: Array<{ command: string; args: unknown }> = []
    const clock = createFakeTimers()
    const store = createNoteStore()

    createSingleNoteEditorFeature({
      call: async <T>(command: string, args?: Record<string, unknown>): Promise<T> => {
        calls.push({ command, args })
        if (command === "list_note") return [...stored] as unknown as T
        throw new Error(`unexpected ${command}`)
      },
      errors: createErrorBanner(root),
      store,
      timers: clock.timers,
    })

    await flushMicrotasks()
    const textarea = document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Note"]')!

    textarea.value = "Originalx"
    textarea.dispatchEvent(new Event("input"))
    clock.advance(500)

    textarea.value = "Original"
    textarea.dispatchEvent(new Event("input"))
    clock.advance(5000)
    await flushMicrotasks()

    expect(calls.filter(c => c.command === "update_note")).toEqual([])
  })

  it("indents with two spaces on Tab for collapsed and multi-line selections", async () => {
    const stored: Note[] = [{ id: 1, text: "alpha\nbeta\ngamma" }]
    const clock = createFakeTimers()
    const store = createNoteStore()

    const editor = createSingleNoteEditorFeature({
      call: async <T>(command: string): Promise<T> => {
        if (command === "list_note") return [...stored] as unknown as T
        throw new Error(`unexpected ${command}`)
      },
      errors: createErrorBanner(root),
      store,
      timers: clock.timers,
    })

    await flushMicrotasks()
    const textarea = editor.textarea

    textarea.setSelectionRange(2, 2)
    const collapsedTab = new KeyboardEvent("keydown", { key: "Tab", cancelable: true })
    textarea.dispatchEvent(collapsedTab)
    expect(collapsedTab.defaultPrevented).toBe(true)
    expect(textarea.value).toBe("al  pha\nbeta\ngamma")
    expect(textarea.selectionStart).toBe(4)
    expect(textarea.selectionEnd).toBe(4)
    expect(store.get().draft).toBe("al  pha\nbeta\ngamma")

    textarea.value = "alpha\nbeta\ngamma"
    textarea.setSelectionRange(1, 9)
    const multiTab = new KeyboardEvent("keydown", { key: "Tab", cancelable: true })
    textarea.dispatchEvent(multiTab)
    expect(multiTab.defaultPrevented).toBe(true)
    expect(textarea.value).toBe("  alpha\n  beta\ngamma")
    expect(textarea.selectionStart).toBe(3)
    expect(textarea.selectionEnd).toBe(13)
    expect(store.get().draft).toBe("  alpha\n  beta\ngamma")
  })

  it("outdents up to two spaces or one tab on Shift+Tab", async () => {
    const stored: Note[] = [{ id: 1, text: "  alpha\n\tbeta\n gamma" }]
    const clock = createFakeTimers()
    const store = createNoteStore()

    const editor = createSingleNoteEditorFeature({
      call: async <T>(command: string): Promise<T> => {
        if (command === "list_note") return [...stored] as unknown as T
        throw new Error(`unexpected ${command}`)
      },
      errors: createErrorBanner(root),
      store,
      timers: clock.timers,
    })

    await flushMicrotasks()
    const textarea = editor.textarea

    textarea.setSelectionRange(2, 16)
    const shiftTab = new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, cancelable: true })
    textarea.dispatchEvent(shiftTab)
    expect(shiftTab.defaultPrevented).toBe(true)
    expect(textarea.value).toBe("alpha\nbeta\ngamma")
    expect(textarea.selectionStart).toBe(0)
    expect(textarea.selectionEnd).toBe(12)
    expect(store.get().draft).toBe("alpha\nbeta\ngamma")
  })

  it("toggles focus between the textarea and the status bar on F6", async () => {
    const testSlots = createSlots()
    const hiddenContainer = document.createElement("div")
    hiddenContainer.hidden = true
    const hiddenBtn = document.createElement("button")
    hiddenBtn.textContent = "Hidden find"
    hiddenContainer.append(hiddenBtn)

    const openBtn = document.createElement("button")
    openBtn.textContent = "Open text file"
    testSlots.mount("status", hiddenContainer)
    testSlots.mount("actions", openBtn)

    const editor = createSingleNoteEditorFeature({
      call: async <T>(command: string): Promise<T> => {
        if (command === "list_note") return [] as unknown as T
        throw new Error(`unexpected ${command}`)
      },
      errors: createErrorBanner(root),
      store: createNoteStore(),
      timers: createFakeTimers().timers,
      slots: testSlots,
    })

    await flushMicrotasks()
    expect(document.activeElement).toBe(editor.textarea)

    const toStatus = new KeyboardEvent("keydown", { key: "F6", cancelable: true })
    editor.textarea.dispatchEvent(toStatus)
    expect(toStatus.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(openBtn)

    const toEditor = new KeyboardEvent("keydown", { key: "F6", bubbles: true, cancelable: true })
    openBtn.dispatchEvent(toEditor)
    expect(toEditor.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(editor.textarea)
  })

  it("keeps the saved text itself, tracks dirty, and never needs the commands to echo text", async () => {
    const calls: Array<{ command: string; args: unknown }> = []
    const store = createNoteStore()
    const clock = createFakeTimers()
    const editor = createSingleNoteEditorFeature({
      call: async <T>(command: string, args?: Record<string, unknown>): Promise<T> => {
        calls.push({ command, args })
        if (command === "list_note") return [] as unknown as T
        if (command === "create_note") return { id: 7 } as unknown as T
        if (command === "update_note") return { id: 7 } as unknown as T
        throw new Error(`unexpected ${command}`)
      },
      errors: createErrorBanner(root),
      store,
      timers: clock.timers,
    })
    await flushMicrotasks()
    expect(store.get().dirty).toBe(false)

    editor.textarea.value = "one"
    editor.textarea.dispatchEvent(new Event("input"))
    expect(store.get().dirty).toBe(true)
    clock.advance(5000)
    await flushMicrotasks()
    expect(store.get().note).toEqual([{ id: 7, text: "one" }])
    expect(store.get().dirty).toBe(false)

    editor.textarea.value = "two"
    editor.textarea.dispatchEvent(new Event("input"))
    await editor.flush()
    expect(calls.at(-1)).toEqual({ command: "update_note", args: { id: 7, input: { text: "two" } } })
    expect(store.get().note).toEqual([{ id: 7, text: "two" }])
    expect(store.get().dirty).toBe(false)
    // Nothing left to write: no further call.
    const count = calls.length
    await editor.flush()
    expect(calls.length).toBe(count)
  })

  it("writes the note when the window loses focus, without waiting for the idle timer", async () => {
    const calls: string[] = []
    const store = createNoteStore()
    const editor = createSingleNoteEditorFeature({
      call: async <T>(command: string): Promise<T> => {
        calls.push(command)
        if (command === "list_note") return [] as unknown as T
        return { id: 1 } as unknown as T
      },
      errors: createErrorBanner(root),
      store,
      timers: createFakeTimers().timers,
    })
    await flushMicrotasks()
    editor.textarea.value = "typed"
    editor.textarea.dispatchEvent(new Event("input"))
    expect(calls).toEqual(["list_note"])

    window.dispatchEvent(new Event("blur"))
    await flushMicrotasks()
    expect(calls).toEqual(["list_note", "create_note"])
    expect(store.get().dirty).toBe(false)
  })

  it("indents through execCommand so the undo history survives, and falls back to assigning the value", async () => {
    const store = createNoteStore()
    const editor = createSingleNoteEditorFeature({
      call: async <T>(command: string): Promise<T> => {
        if (command === "list_note") return [{ id: 1, text: "a\nb" }] as unknown as T
        throw new Error(`unexpected ${command}`)
      },
      errors: createErrorBanner(root),
      store,
      timers: createFakeTimers().timers,
    })
    await flushMicrotasks()
    const textarea = editor.textarea
    const original = document.execCommand
    const exec = vi.fn((_command: string, _ui?: boolean, text?: string) => {
      textarea.setRangeText(text ?? "")
      textarea.dispatchEvent(new Event("input"))
      return true
    })
    document.execCommand = exec as unknown as typeof document.execCommand
    try {
      textarea.setSelectionRange(0, 3)
      textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", cancelable: true }))
      expect(exec).toHaveBeenCalledWith("insertText", false, "  a\n  b")
      expect(textarea.value).toBe("  a\n  b")
      expect(store.get().draft).toBe("  a\n  b")
      expect([textarea.selectionStart, textarea.selectionEnd]).toEqual([0, 7])

      exec.mockReturnValueOnce(false)
      textarea.setSelectionRange(7, 7)
      textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", cancelable: true }))
      expect(textarea.value).toBe("  a\n  b  ")
      expect(store.get().draft).toBe("  a\n  b  ")
    } finally {
      document.execCommand = original
    }
  })

  describe("replaceNote", () => {
    const setupReplace = async () => {
      const store = createNoteStore()
      const updates: string[] = []
      const editor = createSingleNoteEditorFeature({
        call: async <T>(command: string, args?: Record<string, unknown>): Promise<T> => {
          if (command === "list_note") return [{ id: 1, text: "old" }] as unknown as T
          if (command === "update_note") {
            updates.push((args?.input as { text: string }).text)
            return undefined as unknown as T
          }
          throw new Error(`unexpected ${command}`)
        },
        errors: createErrorBanner(root),
        store,
        timers: createFakeTimers().timers,
      })
      await flushMicrotasks()
      return { editor, store, updates, textarea: editor.textarea }
    }

    const withExec = async (
      exec: (command: string, ui?: boolean, text?: string) => boolean,
      body: () => Promise<void>,
    ) => {
      const original = document.execCommand
      document.execCommand = exec as unknown as typeof document.execCommand
      try {
        await body()
      } finally {
        document.execCommand = original
      }
    }

    it("replaces through execCommand as one undoable edit and saves once", async () => {
      const { editor, store, updates, textarea } = await setupReplace()
      const exec = vi.fn((_c: string, _u?: boolean, text?: string) => {
        textarea.setRangeText(text ?? "", 0, textarea.value.length, "end")
        textarea.dispatchEvent(new Event("input"))
        return true
      })
      await withExec(exec, async () => {
        await editor.replaceNote("new text")
        expect(exec).toHaveBeenCalledTimes(1)
        expect(exec).toHaveBeenCalledWith("insertText", false, "new text")
        expect(textarea.value).toBe("new text")
        expect(store.get().draft).toBe("new text")
        expect([textarea.selectionStart, textarea.selectionEnd]).toEqual([0, 0])
      })
      expect(updates).toEqual(["new text"])
    })

    it("assigns the value and saves once when execCommand does not exist", async () => {
      const { editor, updates, textarea } = await setupReplace()
      await editor.replaceNote("new text")
      expect(textarea.value).toBe("new text")
      expect(updates).toEqual(["new text"])
    })

    it("falls back to assigning when execCommand returns true but changes nothing", async () => {
      const { editor, updates, textarea } = await setupReplace()
      await withExec(() => true, async () => {
        await editor.replaceNote("new text")
      })
      expect(textarea.value).toBe("new text")
      expect(updates).toEqual(["new text"])
    })

    it("never calls execCommand for a text above the undo limit", async () => {
      const { editor, updates, textarea } = await setupReplace()
      const exec = vi.fn(() => true)
      const big = "x".repeat(UNDOABLE_REPLACE_MAX + 1)
      await withExec(exec, async () => {
        await editor.replaceNote(big)
      })
      expect(exec).not.toHaveBeenCalled()
      expect(textarea.value).toBe(big)
      expect(updates).toEqual([big])
    })

    it("replaces with an empty text through execCommand delete", async () => {
      const { editor, textarea } = await setupReplace()
      const exec = vi.fn((command: string) => {
        if (command === "delete") {
          textarea.value = ""
          textarea.dispatchEvent(new Event("input"))
        }
        return true
      })
      await withExec(exec, async () => {
        await editor.replaceNote("")
      })
      expect(exec).toHaveBeenCalledWith("delete")
      expect(textarea.value).toBe("")
    })
  })

  describe("Enter", () => {
    const setupEnter = async (text: string, loaded = true) => {
      const store = createNoteStore()
      const editor = createSingleNoteEditorFeature({
        call: async <T>(command: string): Promise<T> => {
          if (command === "list_note") {
            return (loaded ? [{ id: 1, text }] : new Promise(() => {})) as unknown as T
          }
          throw new Error(`unexpected ${command}`)
        },
        errors: createErrorBanner(root),
        store,
        timers: createFakeTimers().timers,
      })
      await flushMicrotasks()
      const textarea = editor.textarea
      textarea.setSelectionRange(text.length, text.length)
      const press = (init: KeyboardEventInit = {}) => {
        const event = new KeyboardEvent("keydown", { key: "Enter", cancelable: true, ...init })
        textarea.dispatchEvent(event)
        return event
      }
      return { textarea, press }
    }

    it("keeps the indent of the current line", async () => {
      const { textarea, press } = await setupEnter("  abc")
      expect(press().defaultPrevented).toBe(true)
      expect(textarea.value).toBe("  abc\n  ")
    })

    it("leaves a line without indent to the browser", async () => {
      const { textarea, press } = await setupEnter("abc")
      expect(press().defaultPrevented).toBe(false)
      expect(textarea.value).toBe("abc")
    })

    it("stands aside while the find bar is open, and not when it is hidden", async () => {
      const { textarea, press } = await setupEnter("  abc")
      const bar = document.createElement("div")
      bar.className = "find-bar"
      document.body.append(bar)
      expect(press().defaultPrevented).toBe(false)
      expect(textarea.value).toBe("  abc")
      bar.hidden = true
      expect(press().defaultPrevented).toBe(true)
      expect(textarea.value).toBe("  abc\n  ")
    })

    it("ignores Shift+Enter and Enter during composition", async () => {
      const { textarea, press } = await setupEnter("  abc")
      expect(press({ shiftKey: true }).defaultPrevented).toBe(false)
      expect(press({ isComposing: true }).defaultPrevented).toBe(false)
      expect(textarea.value).toBe("  abc")
    })

    it("ignores Enter while the note is read-only", async () => {
      const { textarea, press } = await setupEnter("  abc", false)
      expect(textarea.readOnly).toBe(true)
      expect(press().defaultPrevented).toBe(false)
    })
  })
})
