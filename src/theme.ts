/** The allowlisted keys of the active Omarchy theme, as the theme_palette command returns them. */
export type Palette = Record<string, string | undefined>

const OVERRIDES = ["--bg", "--fg", "--accent", "--sel-bg", "--sel-fg", "--danger"] as const

// The rule Omarchy uses when a theme does not state its mode.
const isLight = (hex: string): boolean =>
  [1, 3, 5].reduce((sum, at) => sum + parseInt(hex.slice(at, at + 2), 16), 0) > 382

/** True when the palette has the three colours every theme defines; anything less is "no theme right now". */
export const isComplete = (palette: Palette): boolean =>
  Boolean(palette.background && palette.foreground && palette.accent)

/** Sets the theme's colours on the root element; every other colour derives from them in style.css. */
export const applyPalette = (root: HTMLElement, palette: Palette): void => {
  const { background, foreground, accent } = palette
  if (!background || !foreground || !accent) return
  for (const name of OVERRIDES) root.style.removeProperty(name)
  root.style.setProperty("--bg", background)
  root.style.setProperty("--fg", foreground)
  root.style.setProperty("--accent", accent)
  const selection = palette.selection_background ?? palette.selection
  // Only as a pair: a theme's selection background under our own text colour can be unreadable.
  if (selection && palette.selection_foreground) {
    root.style.setProperty("--sel-bg", selection)
    root.style.setProperty("--sel-fg", palette.selection_foreground)
  }
  const danger = palette.red ?? palette.color1
  if (danger) root.style.setProperty("--danger", danger)
  root.style.setProperty("color-scheme", palette.mode ?? (isLight(background) ? "light" : "dark"))
}

export interface ThemeFollowDeps {
  call: <T>(command: string) => Promise<T>
  root: HTMLElement
  every: (fn: () => void, ms: number) => unknown
  doc?: Document
  win?: Window
}

/**
 * Applies the active theme now and again whenever it changes.
 * shortcut: polls once a second instead of watching the file, because Omarchy deletes and recreates
 * the theme folder on a switch; move to a watcher on the parent folder only if polling ever shows up in a profile.
 */
export const followTheme = (deps: ThemeFollowDeps): (() => Promise<void>) => {
  let applied = ""
  let inFlight = false
  let current: Promise<void> | null = null
  const doc = deps.doc ?? (typeof document !== "undefined" ? document : undefined)
  const win = deps.win ?? (typeof window !== "undefined" ? window : undefined)

  const refresh = (): Promise<void> => {
    if (inFlight && current) return current
    inFlight = true
    current = (async () => {
      try {
        const palette = await deps.call<Palette>("theme_palette")
        // Mid-switch the file is briefly missing: keep the colours we have.
        if (!isComplete(palette)) return
        const next = JSON.stringify(palette)
        if (next === applied) return
        applied = next
        applyPalette(deps.root, palette)
      } catch {
        // No Tauri runtime or a failed call: the stylesheet's fallback colours stay.
      } finally {
        inFlight = false
        current = null
      }
    })()
    return current
  }

  void refresh()
  deps.every(() => {
    if (doc?.hidden) return
    void refresh()
  }, 1000)
  doc?.addEventListener("visibilitychange", () => {
    if (!doc.hidden) void refresh()
  })
  win?.addEventListener("focus", () => {
    void refresh()
  })
  return refresh
}
