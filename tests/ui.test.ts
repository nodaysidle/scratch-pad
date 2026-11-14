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
})
