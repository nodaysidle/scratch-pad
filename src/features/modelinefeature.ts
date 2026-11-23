import type { createNoteStore } from "./singlenoteeditorfeature"

/** The 1-based line and column of a position in the text; reads only the text before it. */
export const positionOf = (text: string, index: number): { line: number; column: number } => {
  let line = 1
  for (let at = text.indexOf("\n"); at !== -1 && at < index; at = text.indexOf("\n", at + 1)) line++
  const lineStart = index === 0 ? 0 : text.lastIndexOf("\n", index - 1) + 1
  return { line, column: index - lineStart + 1 }
}

export interface ModeLineDeps {
  store: ReturnType<typeof createNoteStore>
  textarea: HTMLTextAreaElement
}

export interface ModeLineFeature {
  element: HTMLElement
  destroy: () => void
}

/** The editor's status line: whether the note is saved and where the cursor is. */
export const createModeLineFeature = (deps: ModeLineDeps): ModeLineFeature => {
  const element = document.createElement("div")
  element.className = "mode-line"
  const state = document.createElement("span")
  const position = document.createElement("span")
  element.append(state, position)

  let lastLabel: string | null = null
  const renderState = (): void => {
    const { dirty, loadError } = deps.store.get()
    // A note that failed to load is neither saved nor unsaved.
    const label = loadError ? "" : dirty ? "Unsaved" : "Saved"
    if (label === lastLabel) return
    lastLabel = label
    state.textContent = label
    if (label) state.dataset.state = label.toLowerCase()
    else delete state.dataset.state
  }

  let lastPosText = ""
  let lastPosTitle = ""
  let lastStart = -1
  let lastEnd = -1

  // Line and column only change with the text or the caret, so a plain click or key that moves neither costs nothing.
  const renderPosition = (textChanged: boolean): void => {
    const start = deps.textarea.selectionStart
    const end = deps.textarea.selectionEnd
    if (!textChanged && start === lastStart && end === lastEnd) return
    lastStart = start
    lastEnd = end
    const { line, column } = positionOf(deps.textarea.value, start)
    const selected = Math.max(0, end - start)
    const nextText = selected > 0 ? `${line}:${column} · ${selected} sel` : `${line}:${column}`
    const nextTitle =
      selected > 0
        ? `Line ${line}, column ${column}, ${selected} selected`
        : `Line ${line}, column ${column}`
    if (nextText !== lastPosText) {
      position.textContent = nextText
      lastPosText = nextText
    }
    if (nextTitle !== lastPosTitle) {
      position.title = nextTitle
      lastPosTitle = nextTitle
    }
  }

  // Updates are coalesced to one per frame.
  let frame = 0
  let pendingTextChange = false
  const schedulePosition = (textChanged: boolean): void => {
    pendingTextChange ||= textChanged
    if (frame) return
    frame = requestAnimationFrame(() => {
      frame = 0
      const changed = pendingTextChange
      pendingTextChange = false
      renderPosition(changed)
    })
  }

  const unsubscribe = deps.store.subscribe(() => {
    renderState()
    schedulePosition(true)
  })
  const textChangeEvents = ["input", "focus"] as const
  const caretEvents = ["keyup", "click", "select"] as const
  const onTextEvent = (): void => schedulePosition(true)
  const onCaretEvent = (): void => schedulePosition(false)
  for (const type of textChangeEvents) deps.textarea.addEventListener(type, onTextEvent)
  for (const type of caretEvents) deps.textarea.addEventListener(type, onCaretEvent)
  const onSelectionChange = (): void => {
    if (document.activeElement !== deps.textarea) return
    schedulePosition(false)
  }
  document.addEventListener("selectionchange", onSelectionChange)

  renderState()
  renderPosition(true)

  const destroy = (): void => {
    unsubscribe()
    for (const type of textChangeEvents) deps.textarea.removeEventListener(type, onTextEvent)
    for (const type of caretEvents) deps.textarea.removeEventListener(type, onCaretEvent)
    document.removeEventListener("selectionchange", onSelectionChange)
    if (frame) cancelAnimationFrame(frame)
    frame = 0
  }

  return { element, destroy }
}
