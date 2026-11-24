import type { call as apiCall } from "../api"
import type { createErrorBanner } from "../errors"
import type { confirmDialog } from "../ui"
import { button } from "../ui"
import type {
  createNoteStore,
  SingleNoteEditor,
} from "./singlenoteeditorfeature"
import { UNDOABLE_REPLACE_MAX } from "./singlenoteeditorfeature"

const OPEN_FAILED = "The file could not be opened."

// A failed command carries a message written for the user; anything else (a runtime error) gets the general one.
const reasonFor = (error: unknown): string => {
  const candidate = error as { kind?: unknown; message?: unknown } | null
  return typeof candidate === "object" && candidate !== null &&
    typeof candidate.kind === "string" && typeof candidate.message === "string"
    ? candidate.message
    : OPEN_FAILED
}

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
  const questionFor = (text: string): string =>
    text.length <= UNDOABLE_REPLACE_MAX
      ? "Replace the current note with the contents of this file? Ctrl+Z brings the old note back until you close the app."
      : "Replace the current note with the contents of this file? The file is large, so this cannot be undone."
  let busy = false
  let lastMessage = OPEN_FAILED

  // Rust shows the file dialog and reads the chosen file in one step, so no path reaches this code.
  const openFile = async (): Promise<void> => {
    if (busy) return
    busy = true
    try {
      const text = await deps.call<string | null>("open_text_file")
      if (text === null) return
      deps.errors.clear(lastMessage)
      if (!(await deps.confirm(questionFor(text), "Replace"))) return
      await deps.editor.replaceNote(text)
    } catch (error) {
      lastMessage = reasonFor(error)
      deps.errors.show(lastMessage, () => void openFile())
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
