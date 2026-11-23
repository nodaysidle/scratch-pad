/** A replacement of value[from, to) by text, and where the selection should be afterwards. */
export interface IndentEdit {
  from: number
  to: number
  text: string
  selStart: number
  selEnd: number
}

const INDENT = "  "

/** The whole lines a selection touches: a selection ending just after a newline does not include the next line. */
export const lineBlock = (
  value: string,
  start: number,
  end: number,
): { lineStart: number; blockEnd: number; lines: string[] } => {
  const lineStart = start === 0 ? 0 : value.lastIndexOf("\n", start - 1) + 1
  const effectiveEnd = end > start && value[end - 1] === "\n" ? end - 1 : end
  const lineEnd = value.indexOf("\n", effectiveEnd)
  const blockEnd = lineEnd === -1 ? value.length : lineEnd
  return { lineStart, blockEnd, lines: value.slice(lineStart, blockEnd).split("\n") }
}

const outdentCount = (line: string): number => {
  if (line.startsWith("  ")) return 2
  if (line.startsWith(" ") || line.startsWith("\t")) return 1
  return 0
}

/** Tab: two spaces at a caret, two spaces before every line of a selection. */
export const indentEdit = (value: string, start: number, end: number): IndentEdit => {
  if (start === end) {
    return { from: start, to: start, text: INDENT, selStart: start + 2, selEnd: start + 2 }
  }
  const { lineStart, blockEnd, lines } = lineBlock(value, start, end)
  return {
    from: lineStart,
    to: blockEnd,
    text: lines.map(line => INDENT + line).join("\n"),
    selStart: start === lineStart ? lineStart : start + 2,
    selEnd: end + lines.length * 2,
  }
}

/** Shift+Tab: removes up to two spaces or one tab from the start of every line touched; null when there is nothing to remove. */
export const outdentEdit = (value: string, start: number, end: number): IndentEdit | null => {
  const { lineStart, blockEnd, lines } = lineBlock(value, start, end)
  const removals = lines.map(outdentCount)
  const totalRemoved = removals.reduce((sum, count) => sum + count, 0)
  if (totalRemoved === 0) return null

  const firstRemoved = removals[0] ?? 0
  const selStart = lineStart + Math.max(0, start - lineStart - firstRemoved)
  let selEnd: number
  if (start === end) {
    selEnd = selStart
  } else if (value[end - 1] === "\n") {
    selEnd = end - totalRemoved
  } else {
    const lastLine = lines[lines.length - 1] ?? ""
    const lastRemoved = removals[removals.length - 1] ?? 0
    const lastLineStart = blockEnd - lastLine.length
    selEnd = lastLineStart - (totalRemoved - lastRemoved) + Math.max(0, end - lastLineStart - lastRemoved)
  }
  return {
    from: lineStart,
    to: blockEnd,
    text: lines.map((line, index) => line.slice(removals[index] ?? 0)).join("\n"),
    selStart,
    selEnd: Math.max(selStart, selEnd),
  }
}
