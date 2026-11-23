// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createModeLineFeature, positionOf } from "../../src/features/modelinefeature"
import { createNoteStore } from "../../src/features/singlenoteeditorfeature"

let cleanup: (() => void) | null = null

// Position updates run on the next animation frame; tests run the queued frame by hand.
let frames: Array<() => void> = []
const runFrame = (): void => {
  const queued = frames
  frames = []
  for (const fn of queued) fn()
}

const setup = () => {
  const store = createNoteStore()
  const textarea = document.createElement("textarea")
  document.body.append(textarea)
  const { element, destroy } = createModeLineFeature({ store, textarea })
  cleanup = destroy
  const spans = element.querySelectorAll("span")
  runFrame()
  return { store, textarea, destroy, state: spans[0]!, position: spans[1]!, spans }
}

describe("positionOf", () => {
  it("gives the 1-based line and column", () => {
    expect(positionOf("", 0)).toEqual({ line: 1, column: 1 })
    expect(positionOf("ab\ncd", 2)).toEqual({ line: 1, column: 3 })
    expect(positionOf("ab\ncd", 3)).toEqual({ line: 2, column: 1 })
    expect(positionOf("ab\ncd", 5)).toEqual({ line: 2, column: 3 })
    expect(positionOf("\nab", 0)).toEqual({ line: 1, column: 1 })
    expect(positionOf("a\n\nb", 3)).toEqual({ line: 3, column: 1 })
  })
})

describe("ModeLineFeature", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
    frames = []
    vi.stubGlobal("requestAnimationFrame", (fn: () => void) => frames.push(fn))
    vi.stubGlobal("cancelAnimationFrame", () => {
      frames = []
    })
  })

  afterEach(() => {
    cleanup?.()
    cleanup = null
    vi.unstubAllGlobals()
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

  it("has no word, character or line count", () => {
    const { store, spans } = setup()
    store.set({ draft: "one two three" })
    runFrame()
    expect(spans.length).toBe(2)
    expect(document.body.textContent).not.toMatch(/word|char/)
  })

  it("shows no save state when the note failed to load", () => {
    const { store, state } = setup()
    store.set({ loadError: "The note could not be loaded." })
    expect(state.textContent).toBe("")
    expect(state.dataset.state).toBeUndefined()
  })

  it("shows the cursor position", () => {
    const { textarea, position } = setup()
    textarea.value = "ab\ncd"
    textarea.setSelectionRange(4, 4)
    textarea.dispatchEvent(new Event("keyup"))
    runFrame()
    expect(position.textContent).toBe("2:2")
    expect(position.title).toBe("Line 2, column 2")
  })

  it("shows selection count when text is selected and returns to line:col when collapsed", () => {
    const { textarea, position } = setup()
    textarea.value = "hello world"
    textarea.setSelectionRange(2, 7)
    textarea.dispatchEvent(new Event("select"))
    runFrame()
    expect(position.textContent).toBe("1:3 · 5 sel")
    expect(position.title).toBe("Line 1, column 3, 5 selected")

    textarea.setSelectionRange(7, 7)
    textarea.dispatchEvent(new Event("keyup"))
    runFrame()
    expect(position.textContent).toBe("1:8")
    expect(position.title).toBe("Line 1, column 8")
  })

  it("coalesces position updates into one per frame", () => {
    const { textarea, position } = setup()
    textarea.value = "ab\ncd"
    textarea.setSelectionRange(4, 4)
    textarea.dispatchEvent(new Event("keyup"))
    textarea.dispatchEvent(new Event("input"))
    textarea.dispatchEvent(new Event("click"))
    expect(frames.length).toBe(1)
    expect(position.textContent).toBe("1:1")
    runFrame()
    expect(position.textContent).toBe("2:2")
  })

  it("does not rescan the text when only a key or click fires and the caret did not move", () => {
    const { textarea } = setup()
    textarea.value = "ab\ncd"
    textarea.setSelectionRange(4, 4)
    textarea.dispatchEvent(new Event("keyup"))
    runFrame()
    const read = vi.spyOn(textarea, "value", "get")
    textarea.dispatchEvent(new Event("keyup"))
    runFrame()
    expect(read).not.toHaveBeenCalled()
    read.mockRestore()
  })

  it("ignores document selectionchange events when focus is not in the textarea", () => {
    const { textarea, position } = setup()
    const other = document.createElement("input")
    document.body.append(other)
    textarea.value = "abcdef"
    textarea.setSelectionRange(0, 0)
    textarea.dispatchEvent(new Event("keyup"))
    runFrame()
    expect(position.textContent).toBe("1:1")

    other.focus()
    Object.defineProperty(textarea, "selectionStart", { get: () => 1, configurable: true })
    Object.defineProperty(textarea, "selectionEnd", { get: () => 4, configurable: true })
    document.dispatchEvent(new Event("selectionchange"))
    runFrame()
    expect(position.textContent).toBe("1:1")

    textarea.focus()
    runFrame() // focus schedules an update of its own
    document.dispatchEvent(new Event("selectionchange"))
    runFrame()
    expect(position.textContent).toBe("1:2 · 3 sel")
  })

  it("skips redundant DOM writes when position has not changed", () => {
    const { textarea, position } = setup()
    textarea.value = "hello"
    textarea.setSelectionRange(2, 2)
    textarea.dispatchEvent(new Event("keyup"))
    runFrame()
    const spy = vi.spyOn(position, "textContent", "set")
    textarea.dispatchEvent(new Event("input"))
    runFrame()
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it("destroy unsubscribes from store and removes DOM listeners", () => {
    const { store, textarea, destroy, state, position } = setup()
    store.set({ dirty: true })
    expect(state.textContent).toBe("Unsaved")

    destroy()
    store.set({ dirty: false })
    expect(state.textContent).toBe("Unsaved")

    textarea.value = "changed"
    textarea.setSelectionRange(3, 6)
    textarea.focus()
    textarea.dispatchEvent(new Event("keyup"))
    document.dispatchEvent(new Event("selectionchange"))
    runFrame()
    expect(position.textContent).toBe("1:1")
  })
})
