import type { call as apiCall } from "../api"
import type { createErrorBanner } from "../errors"
import { createSlots, createStore } from "../store"

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
    loadError: null,
  })

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

  deps.store.subscribe(() => {
    const currentDraft = deps.store.get().draft
    if (textarea.value !== currentDraft) {
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
      const first = records[0]
      savedText = first?.text ?? ""
      loaded = true
      textarea.readOnly = false
      textarea.focus()
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

  writeChain = reload()

  const saveDraft = (): Promise<boolean> => {
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
    writeChain = next.then(
      () => undefined,
      () => undefined,
    )
    return next
  }

  const setDraft = (text: string): void => {
    if (!loaded) return
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
    if (!loaded) {
      deps.errors.show("The note could not be loaded.", retryLoad)
      return Promise.resolve(false)
    }
    if (pendingTimer !== null) {
      deps.timers.clear(pendingTimer)
      pendingTimer = null
    }
    deps.store.set({ draft: text })
    return saveDraft()
  }

  const flush = async (): Promise<boolean> => {
    if (pendingTimer !== null) {
      deps.timers.clear(pendingTimer)
      pendingTimer = null
    }
    await writeChain
    if (!loaded || deps.store.get().draft === savedText) return true
    return saveDraft()
  }

  textarea.addEventListener("input", () => {
    setDraft(textarea.value)
  })

  return {
    setDraft,
    replaceNote,
    flush,
    textarea,
  }
}
