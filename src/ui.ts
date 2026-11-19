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

let openDialogs = 0
let dialogSeq = 0

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
    const messageId = `dialog-msg-${++dialogSeq}`
    dialog.setAttribute("aria-labelledby", messageId)
    const text = document.createElement("p")
    text.id = messageId
    text.textContent = message
    let settled = false
    const finish = (answer: boolean) => {
      if (settled) return
      settled = true
      document.removeEventListener("keydown", onKey)
      overlay.remove()
      openDialogs = Math.max(0, openDialogs - 1)
      if (openDialogs === 0) {
        app?.removeAttribute("inert")
      }
      previous?.focus()
      resolve(answer)
    }
    const actions = document.createElement("div")
    actions.className = "dialog-actions"
    const cancel = button("Cancel", () => finish(false))
    const confirm = button(confirmLabel, () => finish(true), { primary: true })
    const onKey = (event: KeyboardEvent) => {
      const overlays = document.querySelectorAll(".dialog-overlay")
      if (overlays[overlays.length - 1] !== overlay) return
      if (event.key === "Escape") {
        finish(false)
        return
      }
      if (event.key === "Tab") {
        event.preventDefault()
        if (document.activeElement === cancel) {
          confirm.focus()
        } else {
          cancel.focus()
        }
      }
    }
    overlay.addEventListener("click", event => {
      if (event.target === overlay) finish(false)
    })
    actions.append(cancel, confirm)
    dialog.append(text, actions)
    overlay.append(dialog)
    document.addEventListener("keydown", onKey)
    openDialogs += 1
    app?.setAttribute("inert", "")
    document.body.append(overlay)
    cancel.focus()
  })
