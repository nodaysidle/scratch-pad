/** Start positions of every match of query in text; case-insensitive, matches never overlap. */
export const findMatches = (text: string, query: string): number[] => {
  if (!query) return []
  const haystack = text.toLowerCase()
  const needle = query.toLowerCase()
  const matches: number[] = []
  for (let at = haystack.indexOf(needle); at !== -1; at = haystack.indexOf(needle, at + needle.length)) {
    matches.push(at)
  }
  return matches
}

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
}

export interface FindFeature {
  element: HTMLElement
  open: () => void
}

/** Find in the note: a field in the status line; Enter and Shift+Enter step through the matches. */
export const createFindFeature = (deps: FindDeps): FindFeature => {
  const element = document.createElement("div")
  element.className = "find-bar"
  element.hidden = true
  const label = document.createElement("label")
  label.textContent = "Find"
  const input = document.createElement("input")
  input.type = "text"
  input.setAttribute("aria-label", "Find in note")
  input.spellcheck = false
  const count = document.createElement("span")
  count.setAttribute("role", "status")
  element.append(label, input, count)

  const describe = (total: number): string =>
    !input.value ? "" : total === 0 ? "No matches" : total === 1 ? "1 match" : `${total} matches`

  const step = (backwards: boolean): void => {
    const matches = findMatches(deps.textarea.value, input.value)
    if (matches.length === 0) {
      count.textContent = describe(0)
      return
    }
    // Going forwards starts after the current selection, so a repeated Enter moves on.
    const cursor = backwards ? deps.textarea.selectionStart : deps.textarea.selectionEnd
    const selected = deps.textarea.selectionEnd > deps.textarea.selectionStart
    const index = stepFrom(matches, selected || backwards ? cursor : deps.textarea.selectionStart, backwards)
    const at = matches[index]
    if (at === undefined) return
    deps.textarea.focus()
    deps.textarea.setSelectionRange(at, at + input.value.length)
    deps.reveal(at)
    count.textContent = `${index + 1} of ${matches.length}`
  }

  const close = (): void => {
    element.hidden = true
    deps.textarea.focus()
  }

  input.addEventListener("input", () => {
    count.textContent = describe(findMatches(deps.textarea.value, input.value).length)
  })

  // While the field is shown, Enter means "next match" in the note too: a plain Enter there
  // would replace the selected match with a line break.
  document.addEventListener("keydown", event => {
    if (element.hidden || document.querySelector(".dialog-overlay")) return
    if (event.key === "Escape") {
      event.preventDefault()
      close()
    } else if (event.key === "Enter" && !event.ctrlKey && !event.altKey && !event.metaKey) {
      event.preventDefault()
      step(event.shiftKey)
    }
  })

  return {
    element,
    open: () => {
      element.hidden = false
      input.focus()
      input.select()
      count.textContent = describe(findMatches(deps.textarea.value, input.value).length)
    },
  }
}
