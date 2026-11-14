// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest"
import { countWords, createModeLineFeature, positionOf } from "../../src/features/modelinefeature"
import { createNoteStore } from "../../src/features/singlenoteeditorfeature"

const setup = () => {
  const store = createNoteStore()
  const textarea = document.createElement("textarea")
  document.body.append(textarea)
  const { element } = createModeLineFeature({ store, textarea })
  const spans = element.querySelectorAll("span")
  return { store, textarea, state: spans[0]!, position: spans[1]!, words: spans[2]! }
}

describe("countWords", () => {
  it("counts whitespace-separated words", () => {
    expect(countWords("")).toBe(0)
    expect(countWords("   \n ")).toBe(0)
    expect(countWords("one")).toBe(1)
    expect(countWords("one  two\nthree")).toBe(3)
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
})
