// Small building blocks for screens that look native. Features compose these instead of styling raw
// elements, so buttons, empty lists, settings rows, and long text look and behave the same everywhere.

type Handler = () => void

/** A button sized to its label. Use primary for the one main action on a screen. */
export const button = (label: string, onClick: Handler, options: { primary?: boolean; disabled?: boolean } = {}): HTMLButtonElement => {
  const element = document.createElement("button")
  element.type = "button"
  element.className = options.primary ? "button primary" : "button"
  element.textContent = label
  element.disabled = options.disabled ?? false
  element.addEventListener("click", onClick)
  return element
}

/** A command with nothing to act on stays disabled until it has one. */
export const setEnabled = (element: HTMLButtonElement, enabled: boolean): void => {
  element.disabled = !enabled
}

/** A row of controls: a search field or other flexible control grows, buttons keep their size. */
export const toolbar = (...children: HTMLElement[]): HTMLElement => {
  const element = document.createElement("div")
  element.className = "toolbar"
  element.append(...children)
  return element
}

/** What an empty list shows: one centered message and a hint saying how to fill it. */
export const emptyState = (title: string, hint = ""): HTMLElement => {
  const element = document.createElement("div")
  element.className = "empty-state"
  const heading = document.createElement("strong")
  heading.textContent = title
  element.append(heading)
  if (hint) {
    const detail = document.createElement("span")
    detail.textContent = hint
    element.append(detail)
  }
  return element
}

/** Long text in a list, cut to a few lines with an ellipsis; the full text shows on hover. */
export const clampedText = (text: string, lines: 2 | 3 = 2): HTMLElement => {
  const element = document.createElement("p")
  element.className = `clamp-${lines}`
  element.textContent = text
  element.title = text
  return element
}

/** One labelled control of a form: the label text above the control, tied to it for screen readers. */
export const field = (label: string, control: HTMLElement): HTMLLabelElement => {
  const element = document.createElement("label")
  element.className = "field"
  const caption = document.createElement("span")
  caption.textContent = label
  element.append(caption, control)
  return element
}

/** A bordered block that groups related content: the detail view of the selected record, or a form. */
export const panel = (...children: HTMLElement[]): HTMLElement => {
  const element = document.createElement("section")
  element.className = "panel"
  element.append(...children)
  return element
}

/** Stored text shown exactly as entered: line breaks and indentation are kept and long lines wrap. */
export const multilineText = (text: string): HTMLElement => {
  const element = document.createElement("p")
  element.className = "pre-wrap"
  element.textContent = text
  return element
}

/**
 * A confirmation inside the page (no browser or plugin dialog): a modal with the message, a Cancel
 * button, and a confirm button labelled confirmLabel. Resolves true on confirm, false on Cancel or Escape.
 */
export const confirmDialog = (message: string, confirmLabel: string): Promise<boolean> =>
  new Promise(resolve => {
    const app = document.querySelector<HTMLElement>("#app")
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const overlay = document.createElement("div")
    overlay.className = "dialog-overlay"
    const dialog = document.createElement("div")
    dialog.className = "dialog"
    dialog.setAttribute("role", "alertdialog")
    dialog.setAttribute("aria-modal", "true")
    dialog.setAttribute("aria-label", message)
    const text = document.createElement("p")
    text.textContent = message
    const finish = (answer: boolean) => {
      document.removeEventListener("keydown", onKey)
      overlay.remove()
      app?.removeAttribute("inert")
      previous?.focus()
      resolve(answer)
    }
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") finish(false) }
    const actions = document.createElement("div")
    actions.className = "dialog-actions"
    const cancel = button("Cancel", () => finish(false))
    actions.append(cancel, button(confirmLabel, () => finish(true), { primary: true }))
    dialog.append(text, actions)
    overlay.append(dialog)
    document.addEventListener("keydown", onKey)
    app?.setAttribute("inert", "")
    document.body.append(overlay)
    cancel.focus()
  })
