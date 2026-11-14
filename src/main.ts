import { open, save } from "@tauri-apps/plugin-dialog"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { call } from "./api"
import { createCloseHandler } from "./close"
import { createErrorBanner } from "./errors"
import { followTerminalFont } from "./font"
import { bindShortcuts } from "./shortcuts"
import { followTheme } from "./theme"
import { confirmDialog } from "./ui"
import { createFindFeature } from "./features/findfeature"
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
  openDialog: () => open({ multiple: false, directory: false }),
})

export const saveFeature = createSaveNoteAsMarkdownFileFeature({
  call,
  errors,
  store,
  saveDialog: opts => save(opts),
})

// Where a position in the note sits vertically, measured with an off-screen copy of the text
// (a textarea cannot report the position of a character).
const reveal = (index: number): void => {
  const mirror = document.createElement("div")
  mirror.className = "editor editor-mirror"
  mirror.style.width = `${editor.textarea.clientWidth}px`
  mirror.textContent = editor.textarea.value.slice(0, index)
  editor.textarea.after(mirror)
  const top = mirror.offsetHeight
  mirror.remove()
  editor.textarea.scrollTop = Math.max(0, top - editor.textarea.clientHeight / 2)
}

const modeLine = createModeLineFeature({ store, textarea: editor.textarea })
const find = createFindFeature({ textarea: editor.textarea, reveal })

slots.mount("actions", openFeature.button, saveFeature.button)
slots.mount("status", modeLine.element, find.element, saveFeature.status)

openFeature.button.title = "Ctrl+O"
openFeature.button.dataset.key = "^O"
saveFeature.button.title = "Ctrl+S"
saveFeature.button.dataset.key = "^S"
bindShortcuts(document, {
  open: () => void openFeature.openFile(),
  save: () => void saveFeature.saveMarkdown(),
  find: find.open,
})

followTheme({
  call,
  root: document.documentElement,
  every: (fn, ms) => window.setInterval(fn, ms),
})
followTerminalFont({
  call,
  root: document.documentElement,
  every: (fn, ms) => window.setInterval(fn, ms),
  pixelRatio: () => window.devicePixelRatio,
})

try {
  void getCurrentWindow().onCloseRequested(
    createCloseHandler({ flush: editor.flush, confirm: confirmDialog }),
  )
} catch {
  // Outside a Tauri window runtime (such as unit tests), window close events are unavailable.
}
