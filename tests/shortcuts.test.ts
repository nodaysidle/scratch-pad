// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest"
import { bindShortcuts } from "../src/shortcuts"

const press = (key: string, init: KeyboardEventInit = {}): KeyboardEvent => {
  const event = new KeyboardEvent("keydown", { key, cancelable: true, ...init })
  document.dispatchEvent(event)
  return event
}

const setup = () => {
  const actions = { open: vi.fn(), save: vi.fn(), find: vi.fn() }
  bindShortcuts(document, actions)
  return actions
}

describe("bindShortcuts", () => {
  it("Ctrl+O opens and prevents the default", () => {
    const actions = setup()
    const event = press("o", { ctrlKey: true })
    expect(actions.open).toHaveBeenCalledTimes(1)
    expect(actions.save).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(true)
  })

  it("Ctrl+F opens find and prevents the default", () => {
    const actions = setup()
    const event = press("f", { ctrlKey: true })
    expect(actions.find).toHaveBeenCalledTimes(1)
    expect(actions.open).not.toHaveBeenCalled()
    expect(actions.save).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(true)
  })

  it("Ctrl+S saves, also with an uppercase key", () => {
    const actions = setup()
    press("s", { ctrlKey: true })
    press("S", { ctrlKey: true })
    expect(actions.save).toHaveBeenCalledTimes(2)
    expect(actions.open).not.toHaveBeenCalled()
  })

  it("ignores other combinations and does not prevent default", () => {
    const actions = setup()
    const events = [
      press("o"),
      press("s", { ctrlKey: true, shiftKey: true }),
      press("o", { ctrlKey: true, altKey: true }),
      press("x", { ctrlKey: true }),
    ]
    expect(actions.open).not.toHaveBeenCalled()
    expect(actions.save).not.toHaveBeenCalled()
    expect(events.map(e => e.defaultPrevented)).toEqual([false, false, false, false])
  })

  it("does nothing while a confirmation dialog is open", () => {
    const actions = setup()
    const overlay = document.createElement("div")
    overlay.className = "dialog-overlay"
    document.body.append(overlay)
    press("s", { ctrlKey: true })
    overlay.remove()
    expect(actions.save).not.toHaveBeenCalled()
  })
})
