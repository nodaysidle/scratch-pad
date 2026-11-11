import { messageFor } from "./api"

/** One place for user-visible failures: features report here and the banner shows the message. */
export const createErrorBanner = (host: HTMLElement) => {
  const banner = document.createElement("div")
  banner.className = "error-banner"
  banner.setAttribute("role", "alert")
  banner.hidden = true
  const text = document.createElement("p")
  const retry = document.createElement("button")
  retry.type = "button"
  retry.textContent = "Retry"
  retry.hidden = true
  let repeat: (() => void) | undefined
  retry.addEventListener("click", () => {
    banner.hidden = true
    repeat?.()
  })
  const dismiss = document.createElement("button")
  dismiss.type = "button"
  dismiss.textContent = "Dismiss"
  dismiss.addEventListener("click", () => { banner.hidden = true })
  banner.append(text, retry, dismiss)
  const header = host.querySelector(".app-header")
  if (header) header.after(banner)
  else host.prepend(banner)

  // onRetry gives the message a Retry button that repeats the failed command; omit it for a message with no retry.
  const show = (message: string, onRetry?: () => void) => {
    text.textContent = message
    repeat = onRetry
    retry.hidden = !onRetry
    banner.hidden = false
  }

  return {
    /** A message the frontend wrote for the user, with an optional retry action. */
    show,
    /** A failed command: shows the message Rust wrote, never a raw runtime error. */
    report: (error: unknown, onRetry?: () => void) => show(messageFor(error), onRetry),
    dismiss: () => { banner.hidden = true },
  }
}
