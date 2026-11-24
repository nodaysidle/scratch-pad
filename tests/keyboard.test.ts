// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createErrorBanner } from "../src/errors"
import { createFindFeature, type FindFeature } from "../src/features/findfeature"
import { bindShortcuts } from "../src/shortcuts"

// The real modules composed in main.ts order: find's document listener is added before the shortcuts'.
let find: FindFeature
let unbind: () => void

const setup = () => {
  const app = document.createElement("div")
  app.id = "app"
  document.body.append(app)
  const errors = createErrorBanner(app)
  const textarea = document.createElement("textarea")
  textarea.value = "one two one two one"
  document.body.append(textarea)
  find = createFindFeature({ textarea, reveal: vi.fn() })
  document.body.append(find.element)
  unbind = bindShortcuts(document, { open: vi.fn(), save: vi.fn(), find: find.open, dismissError: errors.dismiss })
  const input = find.element.querySelector("input")!
  input.value = "one"
  textarea.setSelectionRange(0, 0)
  find.open()
  return { errors, textarea, input, banner: app.querySelector<HTMLElement>(".error-banner")! }
}

const key = (target: EventTarget, key: string, init: KeyboardEventInit = {}): KeyboardEvent => {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init })
  target.dispatchEvent(event)
  return event
}

describe("keyboard layering", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
  })
  afterEach(() => {
    unbind()
    find.destroy()
    document.body.innerHTML = ""
  })

  it("one Esc closes find and leaves the error banner; the next Esc dismisses it", () => {
    const { errors, banner } = setup()
    errors.show("x", vi.fn())
    key(document.body, "Escape")
    expect(find.element.hidden).toBe(true)
    expect(banner.hidden).toBe(false)
    key(document.body, "Escape")
    expect(banner.hidden).toBe(true)
  })

  it("Enter on a focused button is left to the button", () => {
    const { textarea } = setup()
    const prev = find.element.querySelector<HTMLButtonElement>('[aria-label="Previous match"]')!
    prev.focus()
    const event = key(prev, "Enter")
    expect(event.defaultPrevented).toBe(false)
    expect([textarea.selectionStart, textarea.selectionEnd]).toEqual([0, 0])
  })

  it("Enter in the find field steps to the first match", () => {
    const { textarea, input } = setup()
    const event = key(input, "Enter")
    expect(event.defaultPrevented).toBe(true)
    expect([textarea.selectionStart, textarea.selectionEnd]).toEqual([0, 3])
  })

  it("Enter while an input method is composing is not taken", () => {
    const { input } = setup()
    expect(key(input, "Enter", { isComposing: true }).defaultPrevented).toBe(false)
  })
})
