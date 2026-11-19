// @vitest-environment happy-dom
import { describe, expect, it } from "vitest"
import { button, clampedText, confirmDialog, emptyState, field, multilineText, panel, setEnabled } from "../src/ui"

describe("ui building blocks", () => {
  it("disables a command until it has something to act on", () => {
    const edit = button("Edit", () => {}, { disabled: true })
    expect(edit.disabled).toBe(true)
    setEnabled(edit, true)
    expect(edit.disabled).toBe(false)
    expect(edit.type).toBe("button")
  })

  it("fills an empty list with a message and a hint", () => {
    const empty = emptyState("No prompts yet", "Click Add to create one.")
    expect(empty.className).toBe("empty-state")
    expect(empty.textContent).toContain("Click Add to create one.")
  })

  it("confirms in the page: Delete resolves true, Cancel and Escape resolve false", async () => {
    const asked = confirmDialog("Delete this item?", "Delete")
    const buttons = [...document.querySelectorAll<HTMLButtonElement>(".dialog button")]
    expect(buttons.map(item => item.textContent)).toEqual(["Cancel", "Delete"])
    buttons[1]!.click()
    expect(await asked).toBe(true)
    expect(document.querySelector(".dialog")).toBeNull()
    const cancelled = confirmDialog("Delete this item?", "Delete")
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))
    expect(await cancelled).toBe(false)
  })

  it("clamps long text and keeps the full text on hover", () => {
    const text = clampedText("A long prompt that goes on and on.", 3)
    expect(text.className).toBe("clamp-3")
    expect(text.title).toBe("A long prompt that goes on and on.")
  })

  it("builds a labelled field, a panel, and text that keeps its line breaks", () => {
    const input = document.createElement("input")
    const labelled = field("Title", input)
    expect(labelled.tagName).toBe("LABEL")
    expect(labelled.className).toBe("field")
    expect(labelled.querySelector("span")?.textContent).toBe("Title")
    expect(labelled.contains(input)).toBe(true)
    const text = multilineText("line one\n  indented")
    expect(text.className).toBe("pre-wrap")
    expect(text.textContent).toBe("line one\n  indented")
    expect(panel(labelled, text).className).toBe("panel")
  })

  it("makes the page behind the dialog inert and gives focus back", async () => {
    document.body.innerHTML = '<main id="app"><textarea></textarea></main>'
    const textarea = document.querySelector("textarea")!
    textarea.focus()
    const asked = confirmDialog("Sure?", "Yes")
    expect(document.querySelector("#app")!.hasAttribute("inert")).toBe(true)
    document.querySelector<HTMLButtonElement>(".dialog button")!.click()
    await asked
    expect(document.querySelector("#app")!.hasAttribute("inert")).toBe(false)
    expect(document.activeElement).toBe(textarea)
  })

  it("works when there is no #app element", async () => {
    document.body.innerHTML = ""
    const asked = confirmDialog("Sure?", "Yes")
    document.querySelectorAll<HTMLButtonElement>(".dialog button")[1]!.click()
    expect(await asked).toBe(true)
  })

  it("links the dialog message with aria-labelledby and does not duplicate aria-label", async () => {
    document.body.innerHTML = ""
    const asked = confirmDialog("Replace the note?", "Replace")
    const dialog = document.querySelector<HTMLElement>(".dialog")!
    const message = dialog.querySelector<HTMLParagraphElement>("p")!
    expect(dialog.hasAttribute("aria-label")).toBe(false)
    expect(message.id).toMatch(/^dialog-msg-\d+$/)
    expect(dialog.getAttribute("aria-labelledby")).toBe(message.id)
    document.querySelector<HTMLButtonElement>(".dialog button")!.click()
    await asked
  })

  it("traps Tab and Shift+Tab focus between Cancel and confirm buttons", async () => {
    document.body.innerHTML = ""
    const asked = confirmDialog("Sure?", "Replace")
    const buttons = [...document.querySelectorAll<HTMLButtonElement>(".dialog button")]
    const cancel = buttons[0]!
    const confirm = buttons[1]!
    expect(document.activeElement).toBe(cancel)

    const tab = new KeyboardEvent("keydown", { key: "Tab", cancelable: true })
    document.dispatchEvent(tab)
    expect(tab.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(confirm)

    const shiftTab = new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, cancelable: true })
    document.dispatchEvent(shiftTab)
    expect(shiftTab.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(cancel)

    cancel.click()
    await asked
  })

  it("cancels and resolves false when clicking the backdrop overlay", async () => {
    document.body.innerHTML = ""
    const asked = confirmDialog("Sure?", "Delete")
    const overlay = document.querySelector<HTMLElement>(".dialog-overlay")!
    const dialog = document.querySelector<HTMLElement>(".dialog")!

    dialog.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    expect(document.querySelector(".dialog-overlay")).not.toBeNull()

    overlay.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    expect(await asked).toBe(false)
    expect(document.querySelector(".dialog-overlay")).toBeNull()
  })

  it("keeps #app inert across nested dialogs until the last one closes", async () => {
    document.body.innerHTML = '<main id="app"><textarea></textarea></main>'
    const app = document.querySelector<HTMLElement>("#app")!
    const first = confirmDialog("First?", "OK")
    expect(app.hasAttribute("inert")).toBe(true)

    const second = confirmDialog("Second?", "OK")
    expect(app.hasAttribute("inert")).toBe(true)

    const overlays = [...document.querySelectorAll<HTMLElement>(".dialog-overlay")]
    expect(overlays.length).toBe(2)

    overlays[1]!.querySelector<HTMLButtonElement>("button")!.click()
    expect(await second).toBe(false)
    expect(app.hasAttribute("inert")).toBe(true)

    overlays[0]!.querySelector<HTMLButtonElement>("button")!.click()
    expect(await first).toBe(false)
    expect(app.hasAttribute("inert")).toBe(false)
  })
})
