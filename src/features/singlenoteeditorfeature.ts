import type { call as apiCall } from "../api"
import type { createErrorBanner } from "../errors"
import { createSlots, createStore } from "../store"
import { panel } from "../ui"

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
  flush: () => Promise<void>
}

export const createSingleNoteEditorFeature = (
  deps: SingleNoteEditorDeps,
): SingleNoteEditor => {
  const activeSlots = deps.slots ?? slots
  const host =
    deps.host ??
    document.querySelector<HTMLElement>(".app-content") ??
    document.body

  const actionsHost = activeSlots.host("actions")
  actionsHost.className = "toolbar"

  const statusHost = activeSlots.host("status")
  statusHost.style.marginBottom = "8px"

  const textarea = document.createElement("textarea")
  textarea.setAttribute("aria-label", "Note")
  textarea.rows = 16
  textarea.style.width = "100%"
  textarea.style.minHeight = "360px"

  const editorPanel = panel(textarea)
  host.replaceChildren(actionsHost, statusHost, editorPanel)

  deps.store.subscribe(() => {
    const currentDraft = deps.store.get().draft
    if (textarea.value !== currentDraft) {
      textarea.value = currentDraft
    }
  })

  let pendingTimer: number | null = null
  let hasUserEdited = false
  let writeChain: Promise<void> = Promise.resolve()

  const reload = async (): Promise<void> => {
    try {
      const records = await deps.call<Note[]>("list_note")
      const first = records[0]
      if (hasUserEdited) {
        deps.store.set({
          note: first ? [first] : [],
          loadError: null,
        })
      } else {
        deps.store.set({
          note: first ? [first] : [],
          draft: first?.text ?? "",
          loadError: null,
        })
      }
    } catch {
      deps.store.set({
        note: [],
        draft: hasUserEdited ? deps.store.get().draft : "",
        loadError: "The note could not be loaded.",
      })
      deps.errors.show("The note could not be loaded.", () => {
        void reload()
      })
    }
  }

  writeChain = reload()

  const saveDraft = (): Promise<boolean> => {
    const next = writeChain.then(async () => {
      const text = deps.store.get().draft
      const existing = deps.store.get().note[0]
      try {
        const saved = existing
          ? await deps.call<Note>("update_note", {
              id: existing.id,
              input: { ...existing, text },
            })
          : await deps.call<Note>("create_note", {
              input: { text },
            })
        deps.store.set({ note: [saved] })
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
    hasUserEdited = true
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
    hasUserEdited = true
    if (pendingTimer !== null) {
      deps.timers.clear(pendingTimer)
      pendingTimer = null
    }
    deps.store.set({ draft: text })
    return saveDraft()
  }

  const flush = async (): Promise<void> => {
    if (pendingTimer !== null) {
      deps.timers.clear(pendingTimer)
      pendingTimer = null
      await saveDraft()
      return
    }
    await writeChain
  }

  textarea.addEventListener("input", () => {
    setDraft(textarea.value)
  })

  return {
    setDraft,
    replaceNote,
    flush,
  }
}
