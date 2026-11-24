// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest"
import { createModeLineFeature } from "../../src/features/modelinefeature"
import { createNoteStore } from "../../src/features/singlenoteeditorfeature"

let cleanup: (() => void) | null = null

const setup = () => {
  const store = createNoteStore()
  const textarea = document.createElement("textarea")
  document.body.append(textarea)
  const { element, destroy } = createModeLineFeature({ store })
  cleanup = destroy
  return { store, textarea, destroy, element, state: element.querySelector("span")! }
}

describe("ModeLineFeature", () => {
  afterEach(() => {
    cleanup?.()
    cleanup = null
    document.body.innerHTML = ""
  })

  it("follows the dirty flag", () => {
    const { store, state } = setup()
    store.set({ note: [{ id: 1, text: "hi" }], draft: "hi", dirty: true })
    expect(state.textContent).toBe("Unsaved")
    store.set({ dirty: false })
    expect(state.textContent).toBe("Saved")
    expect(state.dataset.state).toBe("saved")
  })

  it("shows Unsaved for a new note with text and Saved once it is written", () => {
    const { store, state } = setup()
    store.set({ draft: "x", dirty: true })
    expect(state.textContent).toBe("Unsaved")
    expect(state.dataset.state).toBe("unsaved")
    store.set({ note: [{ id: 1, text: "x" }], dirty: false })
    expect(state.textContent).toBe("Saved")
  })

  it("shows no save state when the note failed to load", () => {
    const { store, state } = setup()
    store.set({ loadError: "The note could not be loaded." })
    expect(state.textContent).toBe("")
    expect(state.dataset.state).toBeUndefined()
  })

  it("has a single child and shows nothing about the caret or the text", () => {
    const { store, textarea, element } = setup()
    store.set({ draft: "one two three" })
    textarea.value = "one two three"
    textarea.setSelectionRange(2, 7)
    for (const type of ["input", "focus", "keyup", "click", "select"]) textarea.dispatchEvent(new Event(type))
    expect(element.children.length).toBe(1)
    expect(element.textContent).toBe("Saved")
  })

  it("destroy unsubscribes from the store", () => {
    const { store, destroy, state } = setup()
    store.set({ dirty: true })
    expect(state.textContent).toBe("Unsaved")
    destroy()
    store.set({ dirty: false })
    expect(state.textContent).toBe("Unsaved")
  })
})
