/** What the window does when asked to close: save first, and close without saving only if the user says so. */
export const createCloseHandler =
  (deps: {
    flush: () => Promise<boolean>
    confirm: (message: string, confirmLabel: string) => Promise<boolean>
  }) => {
    let closing = false
    return async (event: { preventDefault: () => void }): Promise<void> => {
      if (closing) {
        event.preventDefault()
        return
      }
      closing = true
      try {
        if (await deps.flush()) return
        if (!(await deps.confirm("The note could not be saved. Close without saving?", "Close"))) {
          event.preventDefault()
        }
      } finally {
        closing = false
      }
    }
  }
