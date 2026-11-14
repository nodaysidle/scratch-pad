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
  /** Today's date goes into the suggested file name. */
  now: () => Date
}

export interface SaveNoteAsMarkdownFileFeature {
  button: HTMLButtonElement
  status: HTMLParagraphElement
  saveMarkdown: () => Promise<void>
}

/**
 * The file name the save dialog suggests: the note's first line with letters or digits, lowercased
 * with its words joined, then the date as dd-mm-yyyy. A note with no such line is called scratchpad.
 */
export const exportFileName = (text: string, date: Date): string => {
  const slugs = text.split("\n").map(line =>
    line
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 40),
  )
  const slug = slugs.find(Boolean) ?? "scratchpad"
  const two = (value: number): string => String(value).padStart(2, "0")
  return `${slug}-${two(date.getDate())}-${two(date.getMonth() + 1)}-${date.getFullYear()}.md`
}

export const createSaveNoteAsMarkdownFileFeature = (
  deps: SaveNoteAsMarkdownFileDeps,
): SaveNoteAsMarkdownFileFeature => {
  const statusElement = document.createElement("p")
  statusElement.setAttribute("role", "status")
  statusElement.className = "muted"

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
      defaultPath: exportFileName(deps.store.get().draft, deps.now()),
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
