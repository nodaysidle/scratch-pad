/** Ctrl+O, Ctrl+S and Ctrl+F run the three actions. Super is left alone: it belongs to the window manager. */
export const bindShortcuts = (target: Document, actions: { open: () => void; save: () => void; find: () => void }): void => {
  target.addEventListener("keydown", event => {
    if (!event.ctrlKey || event.altKey || event.shiftKey || event.metaKey) return
    // A confirmation is open: its buttons are the only valid actions.
    if (target.querySelector(".dialog-overlay")) return
    const action = { o: actions.open, s: actions.save, f: actions.find }[event.key.toLowerCase()]
    if (!action) return
    event.preventDefault()
    action()
  })
}
