// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest"
import { cssFontSize, followTerminalFont, type FontFollowDeps, type TerminalFont } from "../src/font"

const size = (root: HTMLElement): string => root.style.getPropertyValue("--font-size")

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

describe("followTerminalFont", () => {
  const setup = async () => {
    const root = document.createElement("div")
    let answer: TerminalFont | Error = { size_pt: 12, scale: 1 }
    const call = vi.fn(async <T>(_command: string): Promise<T> => {
      if (answer instanceof Error) throw answer
      return answer as T
    })
    const every = vi.fn()
    const refresh = followTerminalFont({ call: call as FontFollowDeps["call"], root, every, pixelRatio: () => 1 })
    await refresh()
    return { root, call, every, refresh, answer: (next: TerminalFont | Error) => { answer = next } }
  }

  it("sets the size at start and polls every second", async () => {
    const { root, call, every } = await setup()
    expect(size(root)).toBe("16.00px")
    expect(call).toHaveBeenCalledWith("terminal_font")
    expect(every).toHaveBeenCalledTimes(1)
    expect(every).toHaveBeenCalledWith(expect.any(Function), 1000)
  })

  it("follows a change", async () => {
    const { root, refresh, answer } = await setup()
    answer({ size_pt: 9, scale: 1 })
    await refresh()
    expect(size(root)).toBe("12.00px")
  })

  it("keeps the last size when the terminal config is gone or the call fails", async () => {
    const { root, refresh, answer } = await setup()
    answer({ size_pt: null, scale: 1 })
    await expect(refresh()).resolves.toBeUndefined()
    expect(size(root)).toBe("16.00px")
    answer(new Error("ipc"))
    await expect(refresh()).resolves.toBeUndefined()
    expect(size(root)).toBe("16.00px")
  })

  it("does not touch the page when nothing changed", async () => {
    const { root, refresh } = await setup()
    const spy = vi.spyOn(root.style, "setProperty")
    await refresh()
    expect(spy).not.toHaveBeenCalled()
  })
})
