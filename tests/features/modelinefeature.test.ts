// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { countLines, countWords, createModeLineFeature, positionOf } from "../../src/features/modelinefeature"
import { createNoteStore } from "../../src/features/singlenoteeditorfeature"

let cleanup: (() => void) | null = null

const setup = () => {
  const store = createNoteStore()
  const textarea = document.createElement("textarea")
  document.body.append(textarea)
  const { element, destroy } = createModeLineFeature({ store, textarea })
  cleanup = destroy
  const spans = element.querySelectorAll("span")
  return { store, textarea, destroy, state: spans[0]!, position: spans[1]!, words: spans[2]! }
}

describe("countWords", () => {
  it("counts whitespace-separated words", () => {
    expect(countWords("")).toBe(0)
    expect(countWords("   \n ")).toBe(0)
    expect(countWords("one")).toBe(1)
    expect(countWords("one  two\nthree")).toBe(3)
  })
})

describe("countLines", () => {
  it("counts 0 lines for empty text and newlines + 1 otherwise", () => {
    expect(countLines("")).toBe(0)
    expect(countLines("one")).toBe(1)
    expect(countLines("one\n")).toBe(2)
    expect(countLines("one\ntwo\nthree")).toBe(3)
  })
})

describe("positionOf", () => {
  it("gives the 1-based line and column", () => {
    expect(positionOf("", 0)).toEqual({ line: 1, column: 1 })
    expect(positionOf("ab\ncd", 2)).toEqual({ line: 1, column: 3 })
    expect(positionOf("ab\ncd", 3)).toEqual({ line: 2, column: 1 })
    expect(positionOf("ab\ncd", 5)).toEqual({ line: 2, column: 3 })
  })
})

describe("ModeLineFeature", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
  })

  afterEach(() => {
    cleanup?.()
    cleanup = null
  })

  it("shows Saved when the stored note equals the text", () => {
    const { store, state } = setup()
    store.set({ note: [{ id: 1, text: "hi" }], draft: "hi" })
    expect(state.textContent).toBe("Saved")
    expect(state.dataset.state).toBe("saved")
  })

  it("shows Unsaved when they differ, and for a new note with text", () => {
    const { store, state } = setup()
    store.set({ note: [{ id: 1, text: "hi" }], draft: "hi there" })
    expect(state.textContent).toBe("Unsaved")
    expect(state.dataset.state).toBe("unsaved")
    store.set({ note: [], draft: "x" })
    expect(state.textContent).toBe("Unsaved")
    store.set({ note: [], draft: "" })
    expect(state.textContent).toBe("Saved")
  })

  it("shows no save state when the note failed to load", () => {
    const { store, state } = setup()
    store.set({ loadError: "The note could not be loaded." })
    expect(state.textContent).toBe("")
    expect(state.dataset.state).toBeUndefined()
  })

  it("counts words with the right noun", () => {
    const { store, words } = setup()
    store.set({ draft: "one" })
    expect(words.textContent).toBe("1 word")
    store.set({ draft: "one two" })
    expect(words.textContent).toBe("2 words")
    store.set({ draft: "" })
    expect(words.textContent).toBe("0 words")
  })

  it("shows the cursor position", () => {
    const { textarea, position } = setup()
    textarea.value = "ab\ncd"
    textarea.setSelectionRange(4, 4)
    textarea.dispatchEvent(new Event("keyup"))
    expect(position.textContent).toBe("2:2")
    expect(position.title).toBe("Line 2, column 2")
  })

  it("shows selection count when text is selected and returns to line:col when collapsed", () => {
    const { textarea, position } = setup()
    textarea.value = "hello world"
    textarea.setSelectionRange(2, 7)
    textarea.dispatchEvent(new Event("select"))
    expect(position.textContent).toBe("1:3 · 5 sel")
    expect(position.title).toBe("Line 1, column 3, 5 selected")

    textarea.setSelectionRange(7, 7)
    textarea.dispatchEvent(new Event("keyup"))
    expect(position.textContent).toBe("1:8")
    expect(position.title).toBe("Line 1, column 8")
  })

  it("enriches words.title with word, char, and line telemetry", () => {
    const { store, words } = setup()
    expect(words.title).toBe("0 words, 0 chars, 0 lines")
    store.set({ draft: "a" })
    expect(words.title).toBe("1 word, 1 char, 1 line")
    store.set({ draft: "one two\nthree" })
    expect(words.textContent).toBe("3 words")
    expect(words.title).toBe("3 words, 13 chars, 2 lines")
  })

  it("ignores document selectionchange events when focus is not in the textarea", () => {
    const { textarea, position } = setup()
    const other = document.createElement("input")
    document.body.append(other)
    textarea.value = "abcdef"
    textarea.setSelectionRange(0, 0)
    textarea.dispatchEvent(new Event("keyup"))
    expect(position.textContent).toBe("1:1")

    other.focus()
    Object.defineProperty(textarea, "selectionStart", { get: () => 1, configurable: true })
    Object.defineProperty(textarea, "selectionEnd", { get: () => 4, configurable: true })
    document.dispatchEvent(new Event("selectionchange"))
    expect(position.textContent).toBe("1:1")

    textarea.focus()
    document.dispatchEvent(new Event("selectionchange"))
    expect(position.textContent).toBe("1:2 · 3 sel")
  })

  it("skips redundant DOM writes when position has not changed", () => {
    const { textarea, position } = setup()
    textarea.value = "hello"
    textarea.setSelectionRange(2, 2)
    textarea.dispatchEvent(new Event("keyup"))
    const spy = vi.spyOn(position, "textContent", "set")
    textarea.dispatchEvent(new Event("click"))
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it("destroy unsubscribes from store and removes DOM listeners", () => {
    const { store, textarea, destroy, position, words } = setup()
    store.set({ draft: "one" })
    expect(words.textContent).toBe("1 word")

    destroy()
    store.set({ draft: "one two three" })
    expect(words.textContent).toBe("1 word")

    textarea.value = "changed"
    textarea.setSelectionRange(3, 6)
    textarea.focus()
    textarea.dispatchEvent(new Event("keyup"))
    document.dispatchEvent(new Event("selectionchange"))
    expect(position.textContent).toBe("1:1")
  })
})
