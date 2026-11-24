import type { createNoteStore } from "./singlenoteeditorfeature"

export interface ModeLineDeps {
  store: ReturnType<typeof createNoteStore>
}

export interface ModeLineFeature {
  element: HTMLElement
  destroy: () => void
}

/** The editor's status line: whether the note is saved, and nothing else. */
export const createModeLineFeature = (deps: ModeLineDeps): ModeLineFeature => {
  const element = document.createElement("div")
  element.className = "mode-line"
  const state = document.createElement("span")
  element.append(state)

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

  const unsubscribe = deps.store.subscribe(renderState)
  renderState()

  return { element, destroy: unsubscribe }
}
