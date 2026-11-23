import type { call as apiCall } from "../api"
import type { createErrorBanner } from "../errors"
import type { confirmDialog } from "../ui"
import { button } from "../ui"
import type {
  createNoteStore,
  SingleNoteEditor,
} from "./singlenoteeditorfeature"

export interface OpenPlainTextFileDeps {
  call: typeof apiCall
  errors: ReturnType<typeof createErrorBanner>
  store: ReturnType<typeof createNoteStore>
  editor: Pick<SingleNoteEditor, "replaceNote">
  confirm: typeof confirmDialog
}

export interface OpenPlainTextFileFeature {
  button: HTMLButtonElement
  openFile: () => Promise<void>
}

export const createOpenPlainTextFileToReplaceNoteFeature = (
  deps: OpenPlainTextFileDeps,
): OpenPlainTextFileFeature => {
  const question = "Replace the current note with the contents of this file?"
  let busy = false

  // Rust shows the file dialog and reads the chosen file in one step, so no path reaches this code.
  const openFile = async (): Promise<void> => {
    if (busy) return
    busy = true
    try {
      const text = await deps.call<string | null>("open_text_file")
      if (text === null) return
      deps.errors.clear("The file could not be opened.")
      if (!(await deps.confirm(question, "Replace"))) return
      await deps.editor.replaceNote(text)
    } catch {
      deps.errors.show("The file could not be opened.", () => void openFile())
    } finally {
      busy = false
    }
  }

  const actionButton = button("Open text file", () => {
    void openFile()
  })

  return {
    button: actionButton,
    openFile,
  }
}
