// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest"
import { createSlots, createStore } from "../src/store"

describe("shared view state and slots", () => {
  it("merges a patch and notifies subscribers until they unsubscribe", () => {
    const store = createStore({ query: "", selectedId: null as number | null })
    const listener = vi.fn()
    const stop = store.subscribe(listener)
    store.set({ query: "tea" })
    expect(store.get()).toEqual({ query: "tea", selectedId: null })
    expect(listener).toHaveBeenCalledTimes(1)
    stop()
    store.set({ selectedId: 3 })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it("mounts a control into the host the screen placed, whichever is built first", () => {
    const slots = createSlots()
    const control = document.createElement("button")
    slots.mount("filter", control)
    expect(slots.host("filter").contains(control)).toBe(true)
    expect(slots.host("filter")).toBe(slots.host("filter"))
  })

  it("renders a registered row control once per row with that row's record, and runs a registered handler", async () => {
    const slots = createSlots()
    slots.mountRow("row-actions", (record: { id: number }) => {
      const button = document.createElement("button")
      button.textContent = "Row " + record.id
      return button
    })
    expect(slots.row("row-actions", { id: 1 }).textContent).toBe("Row 1")
    expect(slots.row("row-actions", { id: 2 }).textContent).toBe("Row 2")
    expect(slots.row("row-actions", { id: 2 })).not.toBe(slots.row("row-actions", { id: 2 }))
    const submit = vi.fn(() => "Enter a name.")
    slots.handle("add", submit)
    await expect(slots.run("add")).resolves.toBe("Enter a name.")
    await expect(slots.run("edit")).resolves.toBeNull()
    expect(submit).toHaveBeenCalledTimes(1)
  })
})
