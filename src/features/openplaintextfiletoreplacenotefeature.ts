import type { call as apiCall } from "../api"
import type { createErrorBanner } from "../errors"
import type { confirmDialog } from "../ui"
import { button } from "../ui"
import type {
  createNoteStore,
  SingleNoteEditor,
} from "./singlenoteeditorfeature"

export type OpenDialogAdapter = () => Promise<string | string[] | null>

export interface OpenPlainTextFileDeps {
  call: typeof apiCall
  errors: ReturnType<typeof createErrorBanner>
  store: ReturnType<typeof createNoteStore>
  editor: Pick<SingleNoteEditor, "replaceNote">
  confirm: typeof confirmDialog
  openDialog: OpenDialogAdapter
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

  const readAndReplace = async (path: string): Promise<void> => {
    try {
      const text = await deps.call<string>("read_text_file", { path })
      deps.errors.clear("The file could not be opened.")
      await deps.editor.replaceNote(text)
    } catch {
      const draftAtFailure = deps.store.get().draft
      deps.errors.show("The file could not be opened.", async () => {
        // The user confirmed replacing the note as it was then; text typed since needs a new yes.
        if (deps.store.get().draft !== draftAtFailure && !(await deps.confirm(question, "Replace"))) return
        void readAndReplace(path)
      })
    }
  }

  const openFile = async (): Promise<void> => {
    if (busy) return
    busy = true
    try {
      const selected = await deps.openDialog()
      if (!selected) return
      const chosenPath = Array.isArray(selected) ? selected[0] : selected
      if (!chosenPath) return

      const confirmed = await deps.confirm(question, "Replace")
      if (!confirmed) return

      await readAndReplace(chosenPath)
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
