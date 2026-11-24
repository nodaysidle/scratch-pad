export interface ShortcutActions {
  open: () => void
  save: () => void
  find: () => void
  copyAll?: () => void
  dismissError?: () => void
}

// On a non-Latin layout event.key is that layout's letter; the physical key still says which shortcut.
const letterOf = (event: KeyboardEvent): string =>
  /^[a-z]$/i.test(event.key)
    ? event.key.toLowerCase()
    : event.code?.startsWith("Key")
      ? event.code.slice(3).toLowerCase()
      : ""

const hasActiveSelection = (target: Document): boolean => {
  if (typeof window !== "undefined" && (window.getSelection()?.toString() ?? "").length > 0) {
    return true
  }
  const active = target.activeElement
  if (active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement) {
    return active.selectionStart !== active.selectionEnd
  }
  return false
}

/**
 * Ctrl+O, Ctrl+S, Ctrl+F, Ctrl+Shift+C (when nothing is selected), and Esc (dismiss error banner).
 * Super is left alone: it belongs to the window manager.
 */
export const bindShortcuts = (target: Document, actions: ShortcutActions): (() => void) => {
  const onKeyDown = (event: KeyboardEvent): void => {
    // A confirmation is open: its buttons are the only valid actions.
    if (target.querySelector(".dialog-overlay")) return

    if (
      event.key === "Escape" &&
      !event.ctrlKey &&
      !event.altKey &&
      !event.shiftKey &&
      !event.metaKey
    ) {
      // Another layer (find) already took this Esc.
      if (event.defaultPrevented) return
      if (target.querySelector(".find-bar:not([hidden])")) return
      if (target.querySelector(".error-banner:not([hidden])") && actions.dismissError) {
        event.preventDefault()
        actions.dismissError()
      }
      return
    }

    if (!event.ctrlKey || event.altKey || event.metaKey) return

    if (event.shiftKey) {
      if (letterOf(event) === "c" && actions.copyAll && !hasActiveSelection(target)) {
        event.preventDefault()
        actions.copyAll()
      }
      return
    }

    const action = { o: actions.open, s: actions.save, f: actions.find }[letterOf(event)]
    if (!action) return
    event.preventDefault()
    action()
  }

  target.addEventListener("keydown", onKeyDown)
  return () => {
    target.removeEventListener("keydown", onKeyDown)
  }
}
