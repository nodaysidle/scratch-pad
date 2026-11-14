// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest"
import { applyPalette, followTheme, type Palette, type ThemeFollowDeps } from "../src/theme"

const prop = (root: HTMLElement, name: string): string => root.style.getPropertyValue(name)

describe("applyPalette", () => {
  it("sets the three colours and derives dark mode from mode", () => {
    const root = document.createElement("div")
    applyPalette(root, { background: "#000000", foreground: "#e0e0e0", accent: "#cc0000", mode: "dark" })
    expect(prop(root, "--bg")).toBe("#000000")
    expect(prop(root, "--fg")).toBe("#e0e0e0")
    expect(prop(root, "--accent")).toBe("#cc0000")
    expect(prop(root, "color-scheme")).toBe("dark")
  })

  it("derives light or dark from the background when mode is missing", () => {
    const light = document.createElement("div")
    applyPalette(light, { background: "#FAF7F2", foreground: "#222222", accent: "#cc0000" })
    expect(prop(light, "color-scheme")).toBe("light")
    const dark = document.createElement("div")
    applyPalette(dark, { background: "#0A0A0A", foreground: "#e0e0e0", accent: "#cc0000" })
    expect(prop(dark, "color-scheme")).toBe("dark")
  })

  it("uses theme selection colours only as a pair", () => {
    const base = { background: "#000000", foreground: "#e0e0e0", accent: "#cc0000" }
    const both = document.createElement("div")
    applyPalette(both, { ...base, selection_background: "#111111", selection_foreground: "#eeeeee" })
    expect(prop(both, "--sel-bg")).toBe("#111111")
    expect(prop(both, "--sel-fg")).toBe("#eeeeee")
    const onlySelection = document.createElement("div")
    applyPalette(onlySelection, { ...base, selection: "#222222" })
    expect(prop(onlySelection, "--sel-bg")).toBe("")
    expect(prop(onlySelection, "--sel-fg")).toBe("")
    const fallbackPair = document.createElement("div")
    applyPalette(fallbackPair, { ...base, selection: "#222222", selection_foreground: "#eeeeee" })
    expect(prop(fallbackPair, "--sel-bg")).toBe("#222222")
  })

  it("uses red, else color1, for --danger, else leaves it unset", () => {
    const base = { background: "#000000", foreground: "#e0e0e0", accent: "#cc0000" }
    const red = document.createElement("div")
    applyPalette(red, { ...base, red: "#ff0000", color1: "#00ff00" })
    expect(prop(red, "--danger")).toBe("#ff0000")
    const color1 = document.createElement("div")
    applyPalette(color1, { ...base, color1: "#00ff00" })
    expect(prop(color1, "--danger")).toBe("#00ff00")
    const none = document.createElement("div")
    applyPalette(none, base)
    expect(prop(none, "--danger")).toBe("")
  })

  it("clears a previous theme's optional colours", () => {
    const root = document.createElement("div")
    applyPalette(root, {
      background: "#000000",
      foreground: "#e0e0e0",
      accent: "#cc0000",
      selection_background: "#111111",
      selection_foreground: "#eeeeee",
      red: "#ff0000",
    })
    applyPalette(root, { background: "#101010", foreground: "#e0e0e0", accent: "#cc0000" })
    expect(prop(root, "--sel-bg")).toBe("")
    expect(prop(root, "--sel-fg")).toBe("")
    expect(prop(root, "--danger")).toBe("")
    expect(prop(root, "--bg")).toBe("#101010")
  })

  it("ignores an incomplete palette", () => {
    const root = document.createElement("div")
    applyPalette(root, { background: "#000000", foreground: "#e0e0e0", accent: "#cc0000" })
    applyPalette(root, { background: "#ffffff" })
    expect(prop(root, "--bg")).toBe("#000000")
  })
})

describe("followTheme", () => {
  const setup = async () => {
    const root = document.createElement("div")
    let answer: Palette | Error = { background: "#000000", foreground: "#e0e0e0", accent: "#cc0000" }
    const call = vi.fn(async <T>(_command: string): Promise<T> => {
      if (answer instanceof Error) throw answer
      return answer as T
    })
    const every = vi.fn()
    const refresh = followTheme({ call: call as ThemeFollowDeps["call"], root, every })
    await refresh()
    return { root, call, every, refresh, answer: (next: Palette | Error) => { answer = next } }
  }

  it("applies the theme at start and polls every second", async () => {
    const { root, call, every } = await setup()
    expect(prop(root, "--bg")).toBe("#000000")
    expect(call).toHaveBeenCalledWith("theme_palette")
    expect(every).toHaveBeenCalledTimes(1)
    expect(every).toHaveBeenCalledWith(expect.any(Function), 1000)
  })

  it("recolours when the theme changes", async () => {
    const { root, refresh, answer } = await setup()
    answer({ background: "#faf4ed", foreground: "#575279", accent: "#d7827e" })
    await refresh()
    expect(prop(root, "--bg")).toBe("#faf4ed")
  })

  it("keeps the last colours while the file is missing or the call fails", async () => {
    const { root, refresh, answer } = await setup()
    answer({})
    await refresh()
    expect(prop(root, "--bg")).toBe("#000000")
    answer(new Error("ipc"))
    await expect(refresh()).resolves.toBeUndefined()
    expect(prop(root, "--bg")).toBe("#000000")
  })

  it("does not touch the page when nothing changed", async () => {
    const { root, refresh } = await setup()
    const spy = vi.spyOn(root.style, "setProperty")
    await refresh()
    expect(spy).not.toHaveBeenCalled()
  })
})
