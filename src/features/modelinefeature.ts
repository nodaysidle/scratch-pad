import type { createNoteStore } from "./singlenoteeditorfeature"

const isWhitespace = (code: number): boolean => {
  if (code <= 32) return code === 32 || (code >= 9 && code <= 13)
  if (code < 0xa0) return false
  return (
    code === 0xa0 ||
    code === 0x1680 ||
    (code >= 0x2000 && code <= 0x200a) ||
    code === 0x2028 ||
    code === 0x2029 ||
    code === 0x202f ||
    code === 0x205f ||
    code === 0x3000 ||
    code === 0xfeff
  )
}

/** Words separated by whitespace; an empty or blank note has none. */
export const countWords = (text: string): number => {
  let words = 0
  let inWord = false
  for (let i = 0; i < text.length; i++) {
    const ws = isWhitespace(text.charCodeAt(i))
    if (!ws && !inWord) {
      words++
      inWord = true
    } else if (ws) {
      inWord = false
    }
  }
  return words
}

/** Number of lines in the text (0 for an empty note, otherwise newline count + 1). */
export const countLines = (text: string): number => {
  if (!text) return 0
  let lines = 1
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10) lines++
  }
  return lines
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

export interface ModeLineFeature {
  element: HTMLElement
  destroy: () => void
}

/** The editor's status line: whether the note is saved, where the cursor is, and how long the note is. */
export const createModeLineFeature = (deps: ModeLineDeps): ModeLineFeature => {
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
    const chars = draft.length
    const lines = countLines(draft)
    words.textContent = `${count} ${count === 1 ? "word" : "words"}`
    words.title = `${count} ${count === 1 ? "word" : "words"}, ${chars} ${chars === 1 ? "char" : "chars"}, ${lines} ${lines === 1 ? "line" : "lines"}`
  }

  let lastPosText = ""
  let lastPosTitle = ""

  const renderPosition = (): void => {
    const start = deps.textarea.selectionStart
    const end = deps.textarea.selectionEnd
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

  const unsubscribe = deps.store.subscribe(() => {
    renderState()
    renderPosition()
  })
  const textareaEvents = ["keyup", "click", "input", "select", "focus"] as const
  for (const type of textareaEvents) {
    deps.textarea.addEventListener(type, renderPosition)
  }
  const onSelectionChange = (): void => {
    if (document.activeElement !== deps.textarea) return
    renderPosition()
  }
  document.addEventListener("selectionchange", onSelectionChange)

  renderState()
  renderPosition()

  const destroy = (): void => {
    unsubscribe()
    for (const type of textareaEvents) {
      deps.textarea.removeEventListener(type, renderPosition)
    }
    document.removeEventListener("selectionchange", onSelectionChange)
  }

  return { element, destroy }
}
