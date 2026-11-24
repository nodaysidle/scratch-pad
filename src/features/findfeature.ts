export interface MatchRange {
  start: number
  end: number
}

// The note is searched on every keystroke while the bar is open, so its lowercase copy is kept until the text changes.
let foldedSource = ""
let foldedText = ""
const lowerCased = (text: string): string => {
  if (text !== foldedSource) {
    foldedSource = text
    foldedText = text.toLowerCase()
  }
  return foldedText
}

/**
 * Start and end UTF-16 ranges of every match of query in text; case-insensitive, matches never overlap.
 * Maps case-folded positions back to original UTF-16 offsets so characters such as İ (U+0130) do not drift.
 */
export const findMatchRanges = (text: string, query: string): MatchRange[] => {
  if (!query) return []
  const haystack = lowerCased(text)
  const needle = query.toLowerCase()
  if (!needle) return []

  const ranges: MatchRange[] = []
  if (haystack.length === text.length) {
    for (let at = haystack.indexOf(needle); at !== -1; at = haystack.indexOf(needle, at + needle.length)) {
      ranges.push({ start: at, end: at + needle.length })
    }
    return ranges
  }

  const startMap: number[] = []
  const endMap: number[] = []
  for (let i = 0; i < text.length; ) {
    const cp = text.codePointAt(i) ?? 0
    const step = cp > 0xffff ? 2 : 1
    const lowerLen = text.slice(i, i + step).toLowerCase().length
    for (let j = 0; j < lowerLen; j++) {
      startMap.push(i)
      endMap.push(i + step)
    }
    i += step
  }

  for (let at = haystack.indexOf(needle); at !== -1; at = haystack.indexOf(needle, at + needle.length)) {
    const start = startMap[at]
    const end = endMap[at + needle.length - 1]
    if (start !== undefined && end !== undefined) {
      ranges.push({ start, end })
    }
  }
  return ranges
}

/** Start positions of every match of query in text; case-insensitive, matches never overlap. */
export const findMatches = (text: string, query: string): number[] =>
  findMatchRanges(text, query).map(range => range.start)

/** Which match to go to from a cursor position: the next one at or after it, or the previous one before it; wraps. */
export const stepFrom = (matches: number[], cursor: number, backwards: boolean): number => {
  if (backwards) {
    const before = matches.filter(at => at < cursor).length - 1
    return before >= 0 ? before : matches.length - 1
  }
  const next = matches.findIndex(at => at >= cursor)
  return next >= 0 ? next : 0
}

export interface FindDeps {
  textarea: HTMLTextAreaElement
  /** Scrolls the note so the character at this position is visible. */
  reveal: (index: number) => void
  /** Paints the previewed match while focus is in the find field, where the textarea's own selection is not drawn; null removes it. */
  highlight?: (range: MatchRange | null) => void
}

export interface FindFeature {
  element: HTMLElement
  open: () => void
  /** Recounts when the note's text changed without an input event (a replaced note). */
  refresh: () => void
  destroy: () => void
}

let findInputSeq = 0

/** Find in the note: a field in the status line; Enter and Shift+Enter step through the matches. */
export const createFindFeature = (deps: FindDeps): FindFeature => {
  const element = document.createElement("div")
  element.className = "find-bar"
  element.hidden = true
  const inputId = `find-input-${++findInputSeq}`
  const label = document.createElement("label")
  label.htmlFor = inputId
  label.textContent = "Find"
  const input = document.createElement("input")
  input.id = inputId
  input.type = "text"
  input.setAttribute("aria-label", "Find in note")
  input.spellcheck = false

  const navButton = (symbol: string, ariaLabel: string, title: string, onClick: () => void): HTMLButtonElement => {
    const btn = document.createElement("button")
    btn.type = "button"
    btn.className = "button find-nav"
    btn.textContent = symbol
    btn.setAttribute("aria-label", ariaLabel)
    btn.title = title
    btn.addEventListener("click", onClick)
    return btn
  }

  const count = document.createElement("span")
  count.setAttribute("role", "status")

  const describe = (total: number): string =>
    !input.value ? "" : total === 0 ? "No matches" : total === 1 ? "1 match" : `${total} matches`

  let countedText = ""
  const refreshCount = (): void => {
    countedText = deps.textarea.value
    count.textContent = describe(findMatches(deps.textarea.value, input.value).length)
  }

  // Where the search started: typing jumps to the first match at or after it.
  let anchor = 0

  const step = (backwards: boolean): void => {
    // The textarea takes focus here, so its own selection shows.
    deps.highlight?.(null)
    const ranges = findMatchRanges(deps.textarea.value, input.value)
    if (ranges.length === 0) {
      count.textContent = describe(0)
      return
    }
    const starts = ranges.map(range => range.start)
    // Going forwards starts after the current selection, so a repeated Enter moves on.
    const cursor = backwards ? deps.textarea.selectionStart : deps.textarea.selectionEnd
    const selected = deps.textarea.selectionEnd > deps.textarea.selectionStart
    const from = selected || backwards ? cursor : deps.textarea.selectionStart
    const index = stepFrom(starts, from, backwards)
    const range = ranges[index]
    if (!range) return
    const wrapped = ranges.length > 1 && (backwards ? range.start >= from : range.start < from)
    deps.textarea.focus()
    deps.textarea.setSelectionRange(range.start, range.end)
    deps.reveal(range.start)
    count.textContent = `${index + 1} of ${ranges.length}${wrapped ? " (wrapped)" : ""}`
  }

  const close = (): void => {
    element.hidden = true
    deps.highlight?.(null)
    deps.textarea.focus()
  }

  const prevButton = navButton("↑", "Previous match", "Shift+Enter", () => step(true))
  const nextButton = navButton("↓", "Next match", "Enter", () => step(false))
  const closeButton = navButton("×", "Close find", "Esc", close)

  element.append(label, input, prevButton, nextButton, count, closeButton)

  // Typing previews the first match from where find was opened; focus stays in the field.
  input.addEventListener("input", () => {
    countedText = deps.textarea.value
    const ranges = findMatchRanges(deps.textarea.value, input.value)
    if (!input.value) {
      deps.textarea.setSelectionRange(anchor, anchor)
      deps.highlight?.(null)
      count.textContent = ""
      return
    }
    const range = ranges[stepFrom(ranges.map(r => r.start), anchor, false)]
    if (!range) {
      deps.highlight?.(null)
      count.textContent = describe(0)
      return
    }
    deps.textarea.setSelectionRange(range.start, range.end)
    deps.reveal(range.start)
    deps.highlight?.(range)
    count.textContent = `${ranges.indexOf(range) + 1} of ${ranges.length}`
  })

  const onTextareaInput = (): void => {
    if (element.hidden) return
    // The text changed under the highlight, so its position is stale.
    deps.highlight?.(null)
    refreshCount()
  }
  deps.textarea.addEventListener("input", onTextareaInput)

  // While the field is shown, Enter means "next match" in the note too: a plain Enter there
  // would replace the selected match with a line break.
  const onDocumentKeyDown = (event: KeyboardEvent): void => {
    if (element.hidden || document.querySelector(".dialog-overlay")) return
    if (event.isComposing) return
    if (event.key === "Escape") {
      event.preventDefault()
      close()
    } else if (event.key === "Enter" && !event.ctrlKey && !event.altKey && !event.metaKey) {
      // Enter on a focused button presses that button.
      if (event.target instanceof HTMLButtonElement) return
      event.preventDefault()
      step(event.shiftKey)
    }
  }
  document.addEventListener("keydown", onDocumentKeyDown)

  return {
    element,
    open: () => {
      const picked = deps.textarea.value.slice(deps.textarea.selectionStart, deps.textarea.selectionEnd)
      if (picked && picked.length <= 200 && !/[\r\n]/.test(picked)) input.value = picked
      anchor = deps.textarea.selectionStart
      element.hidden = false
      input.focus()
      input.select()
      refreshCount()
    },
    // The equality guard keeps a store notification (save state only) from overwriting "2 of 3".
    refresh: () => {
      if (!element.hidden && deps.textarea.value !== countedText) refreshCount()
    },
    destroy: () => {
      deps.highlight?.(null)
      document.removeEventListener("keydown", onDocumentKeyDown)
      deps.textarea.removeEventListener("input", onTextareaInput)
    },
  }
}
