import { describe, expect, it } from "vitest"
import { messageFor } from "../src/api"

describe("command errors", () => {
  it("shows the message Rust wrote for the user", () => {
    expect(messageFor({ kind: "storage", message: "Settings could not be saved." })).toBe("Settings could not be saved.")
  })

  it("never shows a raw runtime error", () => {
    expect(messageFor("IPC failed: stack trace")).toBe("Something went wrong. Try again.")
  })
})
