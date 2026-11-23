import { createErrorBanner } from "./errors"

// Composition root: feature tasks add their views to .app-content and call Rust commands through
// call() from ./api; each feature task states how it reports a failure (errors.show).
const root = document.querySelector<HTMLElement>("#app")
if (!root) throw new Error("#app is missing from index.html")

root.innerHTML = `
  <header class="app-header">
    <h1>Scratch Pad</h1>
  </header>
  <section class="app-content" aria-label="Scratch Pad"></section>
`

export const errors = createErrorBanner(root)
