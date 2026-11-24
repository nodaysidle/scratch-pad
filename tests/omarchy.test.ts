// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest"
import {
  applyPalette,
  cssFontSize,
  followOmarchy,
  type OmarchyFollowDeps,
  type OmarchyState,
  type Palette,
  type TerminalFont,
} from "../src/omarchy"

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

describe("cssFontSize", () => {
  it("turns points into pixels at scale 1", () => {
    expect(cssFontSize({ size_pt: 12, scale: 1 }, 1)).toBe("16.00px")
  })

  it("divides out GTK text scaling", () => {
    expect(cssFontSize({ size_pt: 12, scale: 1 }, 1.1667)).toBe("13.71px")
  })

  it("gives a HiDPI monitor the same CSS size", () => {
    expect(cssFontSize({ size_pt: 12, scale: 2 }, 2.3334)).toBe("13.71px")
  })

  it("returns null without a size, a scale or a pixel ratio", () => {
    expect(cssFontSize({ size_pt: null, scale: 1 }, 1)).toBeNull()
    expect(cssFontSize({ size_pt: 12, scale: 0 }, 1)).toBeNull()
    expect(cssFontSize({ size_pt: 12, scale: 1 }, 0)).toBeNull()
  })
})

describe("followOmarchy", () => {
  const dark: Palette = { background: "#000000", foreground: "#e0e0e0", accent: "#cc0000" }
  const light: Palette = { background: "#faf4ed", foreground: "#575279", accent: "#d7827e" }

  const setup = async () => {
    const root = document.createElement("div")
    let palette: Palette | Error = dark
    let font: TerminalFont | Error = { size_pt: 12, scale: 1 }
    // The next two calls (one read) wait for release() and answer with the held values.
    let held: { values: Record<string, unknown>; gate: Promise<void>; left: number } | undefined
    const call = vi.fn(async <T>(command: string): Promise<T> => {
      if (held && held.left > 0) {
        held.left -= 1
        const { values, gate } = held
        await gate
        return values[command] as T
      }
      const answer = command === "theme_palette" ? palette : font
      if (answer instanceof Error) throw answer
      return answer as T
    })
    let emit: (payload: OmarchyState) => void = () => {}
    const listen = vi.fn(
      async (_event: string, handler: (event: { payload: OmarchyState }) => void) => {
        emit = payload => handler({ payload })
      },
    )
    const win = new EventTarget() as unknown as Window
    await followOmarchy({
      call: call as OmarchyFollowDeps["call"],
      listen: listen as unknown as OmarchyFollowDeps["listen"],
      root,
      pixelRatio: () => 1,
      win,
    })
    return {
      root,
      call,
      listen,
      win,
      emit: (state: Partial<OmarchyState>) => emit({ palette: dark, font: { size_pt: 12, scale: 1 }, ...state }),
      answer: (next: { palette?: Palette | Error; font?: TerminalFont | Error }) => {
        if (next.palette) palette = next.palette
        if (next.font) font = next.font
      },
      hold: (values: { palette: Palette; font: TerminalFont }): (() => void) => {
        let release = () => {}
        const gate = new Promise<void>(resolve => (release = resolve))
        held = { values: { theme_palette: values.palette, terminal_font: values.font }, gate, left: 2 }
        return release
      },
    }
  }

  it("applies the theme and the font size at start and subscribes to omarchy-changed", async () => {
    const { root, call, listen } = await setup()
    expect(prop(root, "--bg")).toBe("#000000")
    expect(prop(root, "--font-size")).toBe("16.00px")
    expect(call).toHaveBeenCalledWith("theme_palette")
    expect(call).toHaveBeenCalledWith("terminal_font")
    expect(listen).toHaveBeenCalledWith("omarchy-changed", expect.any(Function))
  })

  it("never sets up polling", () => {
    const spy = vi.spyOn(globalThis, "setInterval")
    return setup().then(() => {
      expect(spy).not.toHaveBeenCalled()
      spy.mockRestore()
    })
  })

  it("recolours and resizes from the event payload without calling the commands again", async () => {
    const { root, call, emit } = await setup()
    call.mockClear()
    emit({ palette: light, font: { size_pt: 9, scale: 1 } })
    expect(prop(root, "--bg")).toBe("#faf4ed")
    expect(prop(root, "--font-size")).toBe("12.00px")
    expect(call).not.toHaveBeenCalled()
  })

  it("keeps the last colours while the theme file is missing and the last size while no terminal config states one", async () => {
    const { root, emit } = await setup()
    emit({ palette: {}, font: { size_pt: null, scale: 1 } })
    expect(prop(root, "--bg")).toBe("#000000")
    expect(prop(root, "--font-size")).toBe("16.00px")
  })

  it("does not touch the page when nothing changed", async () => {
    const { root, emit } = await setup()
    const spy = vi.spyOn(root.style, "setProperty")
    emit({})
    expect(spy).not.toHaveBeenCalled()
  })

  it("re-reads on window focus, so a change of monitor scale is picked up", async () => {
    const { root, call, win, answer } = await setup()
    answer({ palette: light, font: { size_pt: 12, scale: 2 } })
    call.mockClear()
    win.dispatchEvent(new Event("focus"))
    await vi.waitFor(() => expect(prop(root, "--bg")).toBe("#faf4ed"))
    expect(prop(root, "--font-size")).toBe("32.00px")
    expect(call).toHaveBeenCalledTimes(2)
  })

  const flush = () => new Promise(resolve => setTimeout(resolve, 0))

  it("ignores a re-read that finishes after a newer pushed event", async () => {
    const { root, win, emit, hold } = await setup()
    const release = hold({ palette: dark, font: { size_pt: 12, scale: 1 } })
    win.dispatchEvent(new Event("focus"))
    emit({ palette: light })
    release()
    await flush()
    expect(prop(root, "--bg")).toBe("#faf4ed")
  })

  it("keeps the later of two overlapping re-reads when the earlier one finishes last", async () => {
    const { root, win, hold } = await setup()
    const releaseFirst = hold({ palette: dark, font: { size_pt: 12, scale: 1 } })
    win.dispatchEvent(new Event("focus"))
    const releaseSecond = hold({ palette: light, font: { size_pt: 12, scale: 1 } })
    win.dispatchEvent(new Event("focus"))
    releaseSecond()
    await vi.waitFor(() => expect(prop(root, "--bg")).toBe("#faf4ed"))
    releaseFirst()
    await flush()
    expect(prop(root, "--bg")).toBe("#faf4ed")
  })

  it("applies what it can when one command fails, and survives both failing", async () => {
    const root = document.createElement("div")
    const call = vi.fn(async <T>(command: string): Promise<T> => {
      if (command === "theme_palette") throw new Error("ipc")
      return { size_pt: 12, scale: 1 } as T
    })
    const listen = vi.fn(async () => {
      throw new Error("no tauri runtime")
    })
    await followOmarchy({
      call: call as OmarchyFollowDeps["call"],
      listen: listen as unknown as OmarchyFollowDeps["listen"],
      root,
      pixelRatio: () => 1,
      win: new EventTarget() as unknown as Window,
    })
    expect(prop(root, "--bg")).toBe("")
    expect(prop(root, "--font-size")).toBe("16.00px")

    const failing = vi.fn(async () => {
      throw new Error("ipc")
    })
    await expect(
      followOmarchy({
        call: failing as unknown as OmarchyFollowDeps["call"],
        listen: listen as unknown as OmarchyFollowDeps["listen"],
        root: document.createElement("div"),
        pixelRatio: () => 1,
        win: new EventTarget() as unknown as Window,
      }),
    ).resolves.toBeUndefined()
  })
})
