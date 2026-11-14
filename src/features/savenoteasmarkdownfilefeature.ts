import type { call as apiCall } from "../api"
import type { createErrorBanner } from "../errors"
import { button } from "../ui"
import type { createNoteStore } from "./singlenoteeditorfeature"

export type SaveDialogAdapter = (options: {
  defaultPath: string
}) => Promise<string | null>

export interface SaveNoteAsMarkdownFileDeps {
  call: typeof apiCall
  errors: ReturnType<typeof createErrorBanner>
  store: ReturnType<typeof createNoteStore>
  saveDialog: SaveDialogAdapter
}

export interface SaveNoteAsMarkdownFileFeature {
  button: HTMLButtonElement
  status: HTMLParagraphElement
  saveMarkdown: () => Promise<void>
}

export const createSaveNoteAsMarkdownFileFeature = (
  deps: SaveNoteAsMarkdownFileDeps,
): SaveNoteAsMarkdownFileFeature => {
  const statusElement = document.createElement("p")
  statusElement.setAttribute("role", "status")
  statusElement.className = "muted"
  statusElement.style.margin = "4px 0"

  const performWrite = async (path: string): Promise<void> => {
    const content = "# Scratch Pad\n\n" + deps.store.get().draft
    try {
      await deps.call("write_markdown_export_file", { path, content })
      statusElement.textContent = "The file was saved."
      deps.errors.clear("The file could not be saved.")
    } catch {
      statusElement.textContent = ""
      deps.errors.show("The file could not be saved.", () => {
        statusElement.textContent = ""
        void performWrite(path)
      })
    }
  }

  const saveMarkdown = async (): Promise<void> => {
    statusElement.textContent = ""
    const chosenPath = await deps.saveDialog({
      defaultPath: "scratch-pad.md",
    })
    if (!chosenPath) return
    await performWrite(chosenPath)
  }

  const actionButton = button("Save as Markdown", () => {
    void saveMarkdown()
  })

  return {
    button: actionButton,
    status: statusElement,
    saveMarkdown,
  }
}
