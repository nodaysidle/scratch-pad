// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createFindFeature, findMatches, stepFrom, type FindFeature } from "../../src/features/findfeature"

let current: FindFeature | null = null

const setup = (text: string) => {
  const textarea = document.createElement("textarea")
  textarea.value = text
  document.body.append(textarea)
  const reveal = vi.fn()
  const feature = createFindFeature({ textarea, reveal })
  document.body.append(feature.element)
  current = feature
  const input = feature.element.querySelector("input")!
  const count = feature.element.querySelector('[role="status"]')!
  const type = (query: string): void => {
    input.value = query
    input.dispatchEvent(new Event("input"))
  }
  return { textarea, reveal, feature, input, count, type }
}

const press = (key: string, shiftKey = false): KeyboardEvent => {
  const event = new KeyboardEvent("keydown", { key, shiftKey, bubbles: true, cancelable: true })
  document.dispatchEvent(event)
  return event
}

describe("findMatches", () => {
  it("finds every match, ignoring case, without overlaps", () => {
    expect(findMatches("Hello hello HELLO", "hello")).toEqual([0, 6, 12])
    expect(findMatches("aaaa", "aa")).toEqual([0, 2])
    expect(findMatches("abc", "")).toEqual([])
    expect(findMatches("abc", "x")).toEqual([])
  })
})

describe("stepFrom", () => {
  it("picks the next or previous match and wraps", () => {
    const matches = [2, 10, 20]
    expect(stepFrom(matches, 0, false)).toBe(0)
    expect(stepFrom(matches, 10, false)).toBe(1)
    expect(stepFrom(matches, 21, false)).toBe(0)
    expect(stepFrom(matches, 10, true)).toBe(0)
    expect(stepFrom(matches, 2, true)).toBe(2)
    expect(stepFrom(matches, 25, true)).toBe(2)
  })
})

describe("FindFeature", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
  })

  // Every instance keeps its document keydown listener; a hidden one ignores keys.
  afterEach(() => {
    if (current) current.element.hidden = true
    current = null
  })

  it("opens with the field focused and hidden before that", () => {
    const { feature, input } = setup("one")
    expect(feature.element.hidden).toBe(true)
    feature.open()
    expect(feature.element.hidden).toBe(false)
    expect(document.activeElement).toBe(input)
  })

  it("counts matches while typing", () => {
    const { feature, count, type } = setup("one two one")
    feature.open()
    type("one")
    expect(count.textContent).toBe("2 matches")
    type("two")
    expect(count.textContent).toBe("1 match")
    type("zzz")
    expect(count.textContent).toBe("No matches")
    type("")
    expect(count.textContent).toBe("")
  })

  it("Enter selects the next match, focuses the note and reports its number", () => {
    const { textarea, reveal, feature, count, type } = setup("one two one")
    textarea.setSelectionRange(0, 0)
    feature.open()
    type("one")
    press("Enter")
    expect([textarea.selectionStart, textarea.selectionEnd]).toEqual([0, 3])
    expect(document.activeElement).toBe(textarea)
    expect(count.textContent).toBe("1 of 2")
    expect(reveal).toHaveBeenCalledWith(0)
    press("Enter")
    expect([textarea.selectionStart, textarea.selectionEnd]).toEqual([8, 11])
    expect(count.textContent).toBe("2 of 2")
    press("Enter")
    expect([textarea.selectionStart, textarea.selectionEnd]).toEqual([0, 3])
    expect(count.textContent).toBe("1 of 2")
  })

  it("Shift+Enter goes backwards and wraps", () => {
    const { textarea, feature, count, type } = setup("one two one")
    textarea.setSelectionRange(0, 0)
    feature.open()
    type("one")
    press("Enter", true)
    expect([textarea.selectionStart, textarea.selectionEnd]).toEqual([8, 11])
    expect(count.textContent).toBe("2 of 2")
    press("Enter", true)
    expect([textarea.selectionStart, textarea.selectionEnd]).toEqual([0, 3])
    expect(count.textContent).toBe("1 of 2")
  })

  it("Enter with no matches changes nothing", () => {
    const { textarea, reveal, feature, type } = setup("one two one")
    textarea.setSelectionRange(4, 4)
    feature.open()
    type("zzz")
    press("Enter")
    expect([textarea.selectionStart, textarea.selectionEnd]).toEqual([4, 4])
    expect(reveal).not.toHaveBeenCalled()
    expect(textarea.value).toBe("one two one")
  })

  it("Escape hides the field and focuses the note", () => {
    const { textarea, feature } = setup("one")
    feature.open()
    press("Escape")
    expect(feature.element.hidden).toBe(true)
    expect(document.activeElement).toBe(textarea)
  })

  it("keys are left alone while the field is hidden", () => {
    const { textarea, input } = setup("one two one")
    textarea.setSelectionRange(4, 4)
    input.value = "one"
    const event = press("Enter")
    expect(event.defaultPrevented).toBe(false)
    expect([textarea.selectionStart, textarea.selectionEnd]).toEqual([4, 4])
  })

  it("Enter is prevented while the field is shown", () => {
    const { feature, type } = setup("one two one")
    feature.open()
    type("one")
    expect(press("Enter").defaultPrevented).toBe(true)
  })
})
