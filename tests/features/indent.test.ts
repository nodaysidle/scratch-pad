import { describe, expect, it } from "vitest"
import { enterEdit, indentEdit, lineBlock, outdentEdit } from "../../src/features/indent"

const apply = (value: string, edit: { from: number; to: number; text: string }): string =>
  value.slice(0, edit.from) + edit.text + value.slice(edit.to)

describe("lineBlock", () => {
  it("covers the whole lines a selection touches", () => {
    expect(lineBlock("ab\ncd\nef", 4, 7)).toEqual({ lineStart: 3, blockEnd: 8, lines: ["cd", "ef"] })
    expect(lineBlock("ab\ncd", 1, 1)).toEqual({ lineStart: 0, blockEnd: 2, lines: ["ab"] })
  })

  it("leaves out the line after a selection that ends just past a newline", () => {
    expect(lineBlock("ab\ncd", 0, 3)).toEqual({ lineStart: 0, blockEnd: 2, lines: ["ab"] })
  })
})

describe("indentEdit", () => {
  it("inserts two spaces at a caret", () => {
    expect(indentEdit("abc", 1, 1)).toEqual({ from: 1, to: 1, text: "  ", selStart: 3, selEnd: 3 })
  })

  it("indents every selected line and keeps the selection on the same text", () => {
    const edit = indentEdit("alpha\nbeta\ngamma", 2, 9)
    expect(apply("alpha\nbeta\ngamma", edit)).toBe("  alpha\n  beta\ngamma")
    expect([edit.selStart, edit.selEnd]).toEqual([4, 13])
  })
})

describe("outdentEdit", () => {
  it("removes two spaces or one tab or one space per line", () => {
    const value = "  alpha\n\tbeta\n gamma"
    const edit = outdentEdit(value, 2, 16)!
    expect(apply(value, edit)).toBe("alpha\nbeta\ngamma")
    expect([edit.selStart, edit.selEnd]).toEqual([0, 12])
  })

  it("is null when no line has anything to remove", () => {
    expect(outdentEdit("a\nb", 0, 3)).toBeNull()
  })

  it("outdents the caret's line and keeps the caret on the same character", () => {
    const edit = outdentEdit("  ab", 4, 4)!
    expect(apply("  ab", edit)).toBe("ab")
    expect([edit.selStart, edit.selEnd]).toEqual([2, 2])
  })
})

describe("enterEdit", () => {
  // "|" marks the caret in the input; returns the text after the edit, with "|" at the new caret, or null.
  const run = (input: string): string | null => {
    const start = input.indexOf("|")
    const value = input.replace("|", "")
    const edit = enterEdit(value, start, start)
    if (!edit) return null
    const out = apply(value, edit)
    return out.slice(0, edit.selStart) + "|" + out.slice(edit.selEnd)
  }

  it.each([
    ["abc|", null],
    ["  abc|", "  abc\n  |"],
    ["\tabc|", "\tabc\n\t|"],
    ["  ab|c", "  ab\n  |c"],
    [" | abc", " \n | abc"],
    ["- one|", "- one\n- |"],
    ["  * one|", "  * one\n  * |"],
    ["9. nine|", "9. nine\n10. |"],
    ["1) a|", "1) a\n2) |"],
    ["- [x] done|", "- [x] done\n- [ ] |"],
    ["- |", "|"],
    ["  - |", "  |"],
    ["-| one", null],
    ["a\n  b|", "a\n  b\n  |"],
  ])("%j", (input, expected) => {
    expect(run(input)).toBe(expected)
  })

  it("replaces a selection by a newline and the indent", () => {
    const edit = enterEdit("  abc", 3, 5)!
    expect(apply("  abc", edit)).toBe("  a\n  ")
  })
})
