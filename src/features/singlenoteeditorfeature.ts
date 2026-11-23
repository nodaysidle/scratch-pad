import type { call as apiCall } from "../api"
import type { createErrorBanner } from "../errors"
import { createSlots, createStore } from "../store"
import { indentEdit, outdentEdit, type IndentEdit } from "./indent"

export interface Note {
  id: number
  text: string
}

export interface NoteInput {
  text: string
}

export interface SharedViewState {
  note: Note[]
  draft: string
  /** True from the first edit until the text on screen is the text last written; the mode line reads this instead of comparing strings. */
  dirty: boolean
  loadError: string | null
}

export interface Timers {
  set: (fn: () => void, ms: number) => number
  clear: (id: number) => void
}

export const createNoteStore = () =>
  createStore<SharedViewState>({
    note: [],
    draft: "",
    dirty: false,
    loadError: null,
  })

/** The note is written after this long without typing, and at once on blur and close. */
export const IDLE_SAVE_MS = 5000

export const store = createNoteStore()
export const slots = createSlots()

export interface SingleNoteEditorDeps {
  call: typeof apiCall
  errors: ReturnType<typeof createErrorBanner>
  store: ReturnType<typeof createNoteStore>
  timers: Timers
  slots?: ReturnType<typeof createSlots>
  host?: HTMLElement | null
}

export interface SingleNoteEditor {
  setDraft: (text: string) => void
  replaceNote: (text: string) => Promise<boolean>
  /** Writes any unsaved text now. Resolves true when nothing is left unsaved. */
  flush: () => Promise<boolean>
}

/** The editor as main.ts sees it: features that read the cursor or selection need the element. */
export interface SingleNoteEditorView extends SingleNoteEditor {
  textarea: HTMLTextAreaElement
}

export const createSingleNoteEditorFeature = (
  deps: SingleNoteEditorDeps,
): SingleNoteEditorView => {
  const activeSlots = deps.slots ?? slots
  const host =
    deps.host ??
    document.querySelector<HTMLElement>(".app-content") ??
    document.body

  const actionsHost = activeSlots.host("actions")
  actionsHost.className = "toolbar"

  const statusHost = activeSlots.host("status")

  const textarea = document.createElement("textarea")
  textarea.className = "editor"
  textarea.setAttribute("aria-label", "Note")
  textarea.spellcheck = false
  textarea.placeholder = "Type here. The note saves as you type."
  textarea.readOnly = true

  const statusBar = document.createElement("footer")
  statusBar.className = "status-bar"
  statusBar.append(statusHost, actionsHost)
  host.replaceChildren(textarea, statusBar)

  // The draft the textarea already shows: a reference check per store change instead of reading the whole value.
  let shown = ""
  deps.store.subscribe(() => {
    const currentDraft = deps.store.get().draft
    if (currentDraft !== shown) {
      shown = currentDraft
      textarea.value = currentDraft
    }
  })

  let pendingTimer: number | null = null
  // Nothing may be saved before the stored note is known: a save without it would create a second note.
  let loaded = false
  let savedText = ""
  let writeChain: Promise<void> = Promise.resolve()

  const reload = async (): Promise<void> => {
    try {
      const records = await deps.call<Note[]>("list_note")
      const first = records[0] // at most one note exists
      savedText = first?.text ?? ""
      loaded = true
      textarea.readOnly = false
      textarea.focus()
      deps.store.set({ note: first ? [first] : [], draft: savedText, dirty: false, loadError: null })
      deps.errors.clear("The note could not be loaded.")
    } catch {
      deps.store.set({ note: [], draft: "", dirty: false, loadError: "The note could not be loaded." })
      deps.errors.show("The note could not be loaded.", retryLoad)
    }
  }

  const retryLoad = (): void => {
    writeChain = writeChain.then(reload)
  }

  writeChain = reload()

  const saveDraft = (): Promise<boolean> => {
    const next = writeChain.then(async () => {
      if (!loaded) return false
      const text = deps.store.get().draft
      const existing = deps.store.get().note[0]
      if (existing && text === savedText) {
        deps.store.set({ dirty: false })
        deps.errors.clear("The note could not be saved.")
        return true
      }
      try {
        // The commands answer with the id only: what was written is what was sent.
        const saved = existing
          ? await deps.call<{ id: number }>("update_note", { id: existing.id, input: { text } })
          : await deps.call<{ id: number }>("create_note", { input: { text } })
        savedText = text
        // One compare per write: typing during the write leaves the note unsaved.
        deps.store.set({ note: [{ id: saved.id, text }], dirty: deps.store.get().draft !== text })
        deps.errors.clear("The note could not be saved.")
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
    if (!loaded) return
    shown = text
    deps.store.set({ draft: text, dirty: true })
    if (pendingTimer !== null) {
      deps.timers.clear(pendingTimer)
    }
    pendingTimer = deps.timers.set(() => {
      pendingTimer = null
      void saveDraft()
    }, IDLE_SAVE_MS)
  }

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

  const flush = async (): Promise<boolean> => {
    if (pendingTimer !== null) {
      deps.timers.clear(pendingTimer)
      pendingTimer = null
    }
    await writeChain
    if (!loaded || !deps.store.get().dirty) return true
    return saveDraft()
  }

  // Leaving the window writes the note now rather than waiting for the idle timer.
  window.addEventListener("blur", () => {
    void flush()
  })

  textarea.addEventListener("input", () => {
    setDraft(textarea.value)
  })

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

  textarea.addEventListener("keydown", event => {
    if (document.querySelector(".dialog-overlay")) return

    if (
      event.key === "F6" &&
      !event.ctrlKey &&
      !event.altKey &&
      !event.shiftKey &&
      !event.metaKey
    ) {
      const target = [...statusBar.querySelectorAll<HTMLButtonElement>("button")].find(
        btn => !btn.disabled && !btn.hidden && !btn.closest("[hidden]") && btn.tabIndex >= 0,
      )
      if (target) {
        event.preventDefault()
        target.focus()
      }
      return
    }

    if (event.key !== "Tab" || textarea.readOnly || event.ctrlKey || event.altKey || event.metaKey) {
      return
    }

    event.preventDefault()
    const { selectionStart, selectionEnd, value } = textarea
    const edit = event.shiftKey
      ? outdentEdit(value, selectionStart, selectionEnd)
      : indentEdit(value, selectionStart, selectionEnd)
    if (edit) applyEdit(edit)
  })

  statusBar.addEventListener("keydown", event => {
    if (
      event.key === "F6" &&
      !event.ctrlKey &&
      !event.altKey &&
      !event.shiftKey &&
      !event.metaKey &&
      !document.querySelector(".dialog-overlay")
    ) {
      event.preventDefault()
      textarea.focus()
    }
  })

  return {
    setDraft,
    replaceNote,
    flush,
    textarea,
  }
}
