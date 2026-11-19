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
      if (existing && text === savedText) {
        deps.errors.clear("The note could not be saved.")
        return true
      }
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

  const outdentCount = (line: string): number => {
    if (line.startsWith("  ")) return 2
    if (line.startsWith(" ") || line.startsWith("\t")) return 1
    return 0
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
    const value = textarea.value
    const start = textarea.selectionStart
    const end = textarea.selectionEnd

    if (!event.shiftKey) {
      if (start === end) {
        textarea.value = value.slice(0, start) + "  " + value.slice(end)
        textarea.setSelectionRange(start + 2, start + 2)
        setDraft(textarea.value)
        return
      }

      const lineStart = start === 0 ? 0 : value.lastIndexOf("\n", start - 1) + 1
      const effectiveEnd = end > start && value[end - 1] === "\n" ? end - 1 : end
      const lineEndSearch = value.indexOf("\n", effectiveEnd)
      const blockEnd = lineEndSearch === -1 ? value.length : lineEndSearch
      const lines = value.slice(lineStart, blockEnd).split("\n")
      const indented = lines.map(line => "  " + line).join("\n")

      textarea.value = value.slice(0, lineStart) + indented + value.slice(blockEnd)
      const newStart = start === lineStart ? lineStart : start + 2
      const newEnd = end + lines.length * 2
      textarea.setSelectionRange(newStart, newEnd)
      setDraft(textarea.value)
      return
    }

    const lineStart = start === 0 ? 0 : value.lastIndexOf("\n", start - 1) + 1
    const effectiveEnd = end > start && value[end - 1] === "\n" ? end - 1 : end
    const lineEndSearch = value.indexOf("\n", effectiveEnd)
    const blockEnd = lineEndSearch === -1 ? value.length : lineEndSearch
    const lines = value.slice(lineStart, blockEnd).split("\n")
    const removals = lines.map(outdentCount)
    const totalRemoved = removals.reduce((sum, count) => sum + count, 0)
    if (totalRemoved === 0) return

    const outdented = lines.map((line, index) => line.slice(removals[index] ?? 0)).join("\n")
    textarea.value = value.slice(0, lineStart) + outdented + value.slice(blockEnd)

    const firstRemoved = removals[0] ?? 0
    const newStart = lineStart + Math.max(0, start - lineStart - firstRemoved)
    let newEnd: number
    if (start === end) {
      newEnd = newStart
    } else if (value[end - 1] === "\n") {
      newEnd = end - totalRemoved
    } else {
      const lastLine = lines[lines.length - 1] ?? ""
      const lastRemoved = removals[removals.length - 1] ?? 0
      const lastLineStart = blockEnd - lastLine.length
      const removedBeforeLast = totalRemoved - lastRemoved
      newEnd = lastLineStart - removedBeforeLast + Math.max(0, end - lastLineStart - lastRemoved)
    }

    textarea.setSelectionRange(newStart, Math.max(newStart, newEnd))
    setDraft(textarea.value)
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
