import { listen } from "@tauri-apps/api/event"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { call } from "./api"
import { createCloseHandler } from "./close"
import { createErrorBanner } from "./errors"
import { followOmarchy } from "./omarchy"
import { bindShortcuts } from "./shortcuts"
import { button, confirmDialog } from "./ui"
import { createFindFeature, type MatchRange } from "./features/findfeature"
import { createModeLineFeature } from "./features/modelinefeature"
import { createOpenPlainTextFileToReplaceNoteFeature } from "./features/openplaintextfiletoreplacenotefeature"
import { createSaveNoteAsMarkdownFileFeature } from "./features/savenoteasmarkdownfilefeature"
import {
  createSingleNoteEditorFeature,
  slots,
  store,
} from "./features/singlenoteeditorfeature"

// Composition root: feature tasks add their views to .app-content and call Rust commands through
// call() from ./api; each feature task states how it reports a failure (errors.show).
const root = document.querySelector<HTMLElement>("#app")
if (!root) throw new Error("#app is missing from index.html")

root.innerHTML = `<section class="app-content" aria-label="Scratch Pad"></section>`

export const errors = createErrorBanner(root)

export const editor = createSingleNoteEditorFeature({
  call,
  errors,
  store,
  slots,
  timers: {
    set: (fn, ms) => window.setTimeout(fn, ms),
    clear: id => window.clearTimeout(id),
  },
})

export const openFeature = createOpenPlainTextFileToReplaceNoteFeature({
  call,
  errors,
  store,
  editor,
  confirm: confirmDialog,
})

export const saveFeature = createSaveNoteAsMarkdownFileFeature({
  call,
  errors,
  store,
  now: () => new Date(),
})

// Where a position in the note sits vertically, measured with an off-screen copy of the text
// (a textarea cannot report the position of a character). A zero-width marker ensures trailing
// newlines create a measurable line box.
const reveal = (index: number): void => {
  const mirror = document.createElement("div")
  mirror.className = "editor editor-mirror"
  mirror.style.width = `${editor.textarea.clientWidth}px`
  const marker = document.createElement("span")
  marker.className = "editor-mirror-marker"
  marker.textContent = "\u200b"
  mirror.append(document.createTextNode(editor.textarea.value.slice(0, index)), marker)
  editor.textarea.after(mirror)
  const top = marker.offsetTop
  mirror.remove()
  editor.textarea.scrollTop = Math.max(0, top - editor.textarea.clientHeight / 2)
}

// The previewed match is painted on a transparent copy of the note laid over the textarea, because
// WebKitGTK does not draw a selection in an unfocused textarea. Same metrics, so it wraps like the note.
let highlightBox: HTMLDivElement | null = null
let highlightText: HTMLDivElement | null = null
const syncHighlightScroll = (): void => {
  if (highlightText) highlightText.style.transform = `translateY(-${editor.textarea.scrollTop}px)`
}
const highlight = (range: MatchRange | null): void => {
  if (!range) {
    highlightBox?.remove()
    highlightBox = null
    highlightText = null
    editor.textarea.removeEventListener("scroll", syncHighlightScroll)
    return
  }
  if (!highlightBox || !highlightText) {
    highlightBox = document.createElement("div")
    highlightBox.className = "editor-highlight"
    highlightText = document.createElement("div")
    highlightText.className = "editor editor-mirror editor-highlight-text"
    highlightBox.append(highlightText)
    editor.textarea.after(highlightBox)
    editor.textarea.addEventListener("scroll", syncHighlightScroll)
  }
  const { value, clientWidth, clientHeight } = editor.textarea
  highlightBox.style.width = `${clientWidth}px`
  highlightBox.style.height = `${clientHeight}px`
  highlightText.style.width = `${clientWidth}px`
  const mark = document.createElement("mark")
  mark.textContent = value.slice(range.start, range.end)
  highlightText.replaceChildren(document.createTextNode(value.slice(0, range.start)), mark)
  syncHighlightScroll()
}

const modeLine = createModeLineFeature({ store })
const find = createFindFeature({ textarea: editor.textarea, reveal, highlight })
// A replaced note (Ctrl+O) assigns textarea.value and fires no input event.
store.subscribe(find.refresh)

// Wraps the visible text so the stylesheet can hide it; the full name stays for screen readers and the tooltip.
const labelled = (element: HTMLButtonElement, label: string, name: string, shortcut: string, hint: string): void => {
  const text = document.createElement("span")
  text.className = "button-label"
  text.textContent = label
  element.replaceChildren(text)
  element.setAttribute("aria-label", name)
  element.title = `${name} (${shortcut})`
  element.dataset.key = hint
}

const findButton = button("Find", () => find.open())
labelled(findButton, "Find", "Find in note", "Ctrl+F", "^F")
const saveNowButton = button("Save", () => void editor.flush())
labelled(saveNowButton, "Save", "Save the note now", "Ctrl+S", "^S")

const copyStatus = document.createElement("span")
copyStatus.className = "copy-status"
copyStatus.setAttribute("role", "status")
let copyTimer: number | null = null

const copyAll = (): void => {
  const write = navigator.clipboard?.writeText(store.get().draft)
  if (!write) return
  void write.then(
    () => {
      copyStatus.textContent = "Copied."
      if (copyTimer !== null) window.clearTimeout(copyTimer)
      copyTimer = window.setTimeout(() => {
        copyTimer = null
        copyStatus.textContent = ""
      }, 1500)
    },
    () => {
      // Clipboard access denied or unavailable; leave copy status empty.
    },
  )
}

slots.mount("actions", findButton, openFeature.button, saveNowButton, saveFeature.button)
slots.mount("status", modeLine.element, find.element, saveFeature.status, copyStatus)

labelled(openFeature.button, "Open", "Open text file", "Ctrl+O", "^O")
labelled(saveFeature.button, "Export", "Save as Markdown", "Ctrl+Shift+S", "^⇧S")
bindShortcuts(document, {
  open: () => void openFeature.openFile(),
  save: () => void editor.flush(),
  exportMarkdown: () => void saveFeature.saveMarkdown(),
  find: find.open,
  copyAll,
  dismissError: errors.dismiss,
})

void followOmarchy({
  call,
  listen,
  root: document.documentElement,
  pixelRatio: () => window.devicePixelRatio,
})

try {
  void getCurrentWindow().onCloseRequested(
    createCloseHandler({ flush: editor.flush, confirm: confirmDialog }),
  )
} catch {
  // Outside a Tauri window runtime (such as unit tests), window close events are unavailable.
}
