import type { call as apiCall } from "../api"
import type { createErrorBanner } from "../errors"
import { button } from "../ui"
import type { createNoteStore } from "./singlenoteeditorfeature"

export interface SaveNoteAsMarkdownFileDeps {
  call: typeof apiCall
  errors: ReturnType<typeof createErrorBanner>
  store: ReturnType<typeof createNoteStore>
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
  let busy = false
  let savedDraft: string | null = null

  deps.store.subscribe(() => {
    if (statusElement.textContent === "The file was saved." && deps.store.get().draft !== savedDraft) {
      statusElement.textContent = ""
    }
  })

  // Rust shows the save dialog and writes the chosen file in one step, so no path reaches this code.
  const saveMarkdown = async (): Promise<void> => {
    if (busy) return
    busy = true
    statusElement.textContent = ""
    const draft = deps.store.get().draft
    try {
      const saved = await deps.call<boolean>("save_markdown_file", {
        suggestedName: exportFileName(draft, deps.now()),
        content: "# Scratch Pad\n\n" + draft,
      })
      if (!saved) return
      if (deps.store.get().draft === draft) {
        savedDraft = draft
        statusElement.textContent = "The file was saved."
      }
      deps.errors.clear("The file could not be saved.")
    } catch {
      deps.errors.show("The file could not be saved.", () => void saveMarkdown())
    } finally {
      busy = false
    }
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
