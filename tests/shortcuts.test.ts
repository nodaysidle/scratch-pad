// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest"
import { bindShortcuts, type ShortcutActions } from "../src/shortcuts"

const press = (key: string, init: KeyboardEventInit = {}): KeyboardEvent => {
  const event = new KeyboardEvent("keydown", { key, cancelable: true, ...init })
  document.dispatchEvent(event)
  return event
}

let unbind: (() => void) | null = null

const setup = (extra: Partial<ShortcutActions> = {}) => {
  const actions: ShortcutActions = { open: vi.fn(), save: vi.fn(), find: vi.fn(), ...extra }
  unbind = bindShortcuts(document, actions)
  return actions
}

describe("bindShortcuts", () => {
  afterEach(() => {
    unbind?.()
    unbind = null
    document.body.innerHTML = ""
    window.getSelection()?.removeAllRanges()
  })
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

  it("Ctrl+Shift+S exports Markdown, prevents the default and does not save", () => {
    const exportMarkdown = vi.fn()
    const actions = setup({ exportMarkdown })
    const event = press("S", { ctrlKey: true, shiftKey: true })
    expect(exportMarkdown).toHaveBeenCalledTimes(1)
    expect(actions.save).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(true)
  })

  it("Ctrl+S does not export Markdown", () => {
    const exportMarkdown = vi.fn()
    const actions = setup({ exportMarkdown })
    press("s", { ctrlKey: true })
    expect(actions.save).toHaveBeenCalledTimes(1)
    expect(exportMarkdown).not.toHaveBeenCalled()
  })

  it("Ctrl+Shift+S without an exportMarkdown action does nothing and is not prevented", () => {
    const actions = setup()
    const event = press("s", { ctrlKey: true, shiftKey: true })
    expect(actions.save).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })

  it("uses the physical key on a non-Latin layout, but a Latin key wins", () => {
    const actions = setup()
    press("ы", { ctrlKey: true, code: "KeyS" })
    expect(actions.save).toHaveBeenCalledTimes(1)
    press("s", { ctrlKey: true, code: "KeyO" })
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

  it("Ctrl+Shift+C runs copyAll when no text is selected", () => {
    const copyAll = vi.fn()
    setup({ copyAll })
    const textarea = document.createElement("textarea")
    textarea.value = "hello"
    document.body.append(textarea)
    textarea.focus()
    textarea.setSelectionRange(2, 2)

    const event = press("c", { ctrlKey: true, shiftKey: true })
    expect(copyAll).toHaveBeenCalledTimes(1)
    expect(event.defaultPrevented).toBe(true)
  })

  it("Ctrl+Shift+C ignores when textarea or window has an active selection", () => {
    const copyAll = vi.fn()
    setup({ copyAll })
    const textarea = document.createElement("textarea")
    textarea.value = "hello"
    document.body.append(textarea)
    textarea.focus()
    textarea.setSelectionRange(0, 3)

    const e1 = press("C", { ctrlKey: true, shiftKey: true })
    expect(copyAll).not.toHaveBeenCalled()
    expect(e1.defaultPrevented).toBe(false)

    textarea.setSelectionRange(0, 0)
    const p = document.createElement("p")
    p.textContent = "selected"
    document.body.append(p)
    const range = document.createRange()
    range.selectNodeContents(p)
    const selection = window.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)

    const e2 = press("c", { ctrlKey: true, shiftKey: true })
    expect(copyAll).not.toHaveBeenCalled()
    expect(e2.defaultPrevented).toBe(false)
  })

  it("Escape dismisses a visible error banner unless a dialog or find bar is open", () => {
    const dismissError = vi.fn()
    setup({ dismissError })

    // No error banner yet -> no-op
    expect(press("Escape").defaultPrevented).toBe(false)
    expect(dismissError).not.toHaveBeenCalled()

    const banner = document.createElement("div")
    banner.className = "error-banner"
    banner.hidden = true
    document.body.append(banner)

    // Hidden error banner -> no-op
    expect(press("Escape").defaultPrevented).toBe(false)
    expect(dismissError).not.toHaveBeenCalled()

    // Visible find bar takes precedence over error banner
    banner.hidden = false
    const findBar = document.createElement("div")
    findBar.className = "find-bar"
    document.body.append(findBar)
    expect(press("Escape").defaultPrevented).toBe(false)
    expect(dismissError).not.toHaveBeenCalled()

    // Hidden find bar lets Escape dismiss the error banner
    findBar.hidden = true
    const dismissed = press("Escape")
    expect(dismissed.defaultPrevented).toBe(true)
    expect(dismissError).toHaveBeenCalledTimes(1)
  })

  it("cleanup function removes the keydown listener", () => {
    const actions = setup()
    unbind?.()
    unbind = null
    const event = press("o", { ctrlKey: true })
    expect(actions.open).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })
})
