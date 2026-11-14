import { open, save } from "@tauri-apps/plugin-dialog"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { call } from "./api"
import { createCloseHandler } from "./close"
import { createErrorBanner } from "./errors"
import { confirmDialog } from "./ui"
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

slots.mount("actions", openFeature.button, saveFeature.button)
slots.mount("status", saveFeature.status)

try {
  void getCurrentWindow().onCloseRequested(
    createCloseHandler({ flush: editor.flush, confirm: confirmDialog }),
  )
} catch {
  // Outside a Tauri window runtime (such as unit tests), window close events are unavailable.
}
