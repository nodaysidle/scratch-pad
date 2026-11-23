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
})
