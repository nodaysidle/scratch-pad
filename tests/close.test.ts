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

  it("prevents re-entrant close events while a close check is already in flight", async () => {
    let resolveFlush: (value: boolean) => void = () => {}
    const flush = vi.fn().mockImplementation(
      () => new Promise<boolean>(resolve => { resolveFlush = resolve }),
    )
    const confirm = vi.fn().mockResolvedValue(false)
    const handler = createCloseHandler({ flush, confirm })

    const firstEvent = { preventDefault: vi.fn() }
    const secondEvent = { preventDefault: vi.fn() }

    const first = handler(firstEvent)
    await handler(secondEvent)

    expect(secondEvent.preventDefault).toHaveBeenCalledTimes(1)
    expect(flush).toHaveBeenCalledTimes(1)
    expect(confirm).not.toHaveBeenCalled()

    resolveFlush(true)
    await first
    expect(firstEvent.preventDefault).not.toHaveBeenCalled()

    const thirdEvent = { preventDefault: vi.fn() }
    const third = handler(thirdEvent)
    expect(flush).toHaveBeenCalledTimes(2)
    resolveFlush(true)
    await third
  })
})
