/** Ctrl+O and Ctrl+S run the two actions. Super is left alone: it belongs to the window manager. */
export const bindShortcuts = (target: Document, actions: { open: () => void; save: () => void }): void => {
  target.addEventListener("keydown", event => {
    if (!event.ctrlKey || event.altKey || event.shiftKey || event.metaKey) return
    // A confirmation is open: its buttons are the only valid actions.
    if (target.querySelector(".dialog-overlay")) return
    const action = { o: actions.open, s: actions.save }[event.key.toLowerCase()]
    if (!action) return
    event.preventDefault()
    action()
  })
}
