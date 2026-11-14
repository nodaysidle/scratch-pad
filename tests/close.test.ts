import { describe, expect, it, vi } from "vitest"
import { createCloseHandler } from "../src/close"

describe("createCloseHandler", () => {
  it("closes without asking when everything is saved", async () => {
    const flush = vi.fn().mockResolvedValue(true)
    const confirm = vi.fn()
    const event = { preventDefault: vi.fn() }

    await createCloseHandler({ flush, confirm })(event)

    expect(confirm).not.toHaveBeenCalled()
    expect(event.preventDefault).not.toHaveBeenCalled()
  })

  it("keeps the window open when the save failed and the user declines", async () => {
    const flush = vi.fn().mockResolvedValue(false)
    const confirm = vi.fn().mockResolvedValue(false)
    const event = { preventDefault: vi.fn() }

    await createCloseHandler({ flush, confirm })(event)

    expect(confirm).toHaveBeenCalledWith("The note could not be saved. Close without saving?", "Close")
    expect(event.preventDefault).toHaveBeenCalledTimes(1)
  })

  it("closes when the save failed and the user confirms", async () => {
    const flush = vi.fn().mockResolvedValue(false)
    const confirm = vi.fn().mockResolvedValue(true)
    const event = { preventDefault: vi.fn() }

    await createCloseHandler({ flush, confirm })(event)

    expect(event.preventDefault).not.toHaveBeenCalled()
  })
})
