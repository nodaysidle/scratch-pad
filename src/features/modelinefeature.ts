import type { createNoteStore } from "./singlenoteeditorfeature"

/** Words separated by whitespace; an empty or blank note has none. */
export const countWords = (text: string): number => {
  const trimmed = text.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

/** The 1-based line and column of a position in the text. */
export const positionOf = (text: string, index: number): { line: number; column: number } => {
  const before = text.slice(0, index)
  return { line: before.split("\n").length, column: index - before.lastIndexOf("\n") }
}

export interface ModeLineDeps {
  store: ReturnType<typeof createNoteStore>
  textarea: HTMLTextAreaElement
}

/** The editor's status line: whether the note is saved, where the cursor is, and how long the note is. */
export const createModeLineFeature = (deps: ModeLineDeps): { element: HTMLElement } => {
  const element = document.createElement("div")
  element.className = "mode-line"
  const state = document.createElement("span")
  const position = document.createElement("span")
  const words = document.createElement("span")
  element.append(state, position, words)

  const renderState = (): void => {
    const { note, draft, loadError } = deps.store.get()
    // A note that failed to load is neither saved nor unsaved.
    const label = loadError ? "" : (note[0]?.text ?? "") === draft ? "Saved" : "Unsaved"
    state.textContent = label
    if (label) state.dataset.state = label.toLowerCase()
    else delete state.dataset.state
    const count = countWords(draft)
    words.textContent = `${count} ${count === 1 ? "word" : "words"}`
  }

  const renderPosition = (): void => {
    const { line, column } = positionOf(deps.textarea.value, deps.textarea.selectionStart)
    position.textContent = `${line}:${column}`
    position.title = `Line ${line}, column ${column}`
  }

  deps.store.subscribe(() => {
    renderState()
    renderPosition()
  })
  for (const type of ["keyup", "click", "input", "select", "focus"]) {
    deps.textarea.addEventListener(type, renderPosition)
  }
  document.addEventListener("selectionchange", renderPosition)
  renderState()
  renderPosition()
  return { element }
}
