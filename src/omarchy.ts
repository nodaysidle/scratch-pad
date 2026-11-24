/** The allowlisted keys of the active Omarchy theme, as the theme_palette command returns them. */
export type Palette = Record<string, string | undefined>

/** What the terminal_font command returns: the terminal's font size in points and the monitor scale. */
export interface TerminalFont {
  size_pt: number | null
  scale: number
}

/** The omarchy-changed event payload: both commands' results together. */
export interface OmarchyState {
  palette: Palette
  font: TerminalFont
}

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

/**
 * The CSS size that renders at the terminal's pixel size. A point is 4/3 px, scaled by the monitor;
 * the webview then multiplies CSS px by devicePixelRatio (monitor scale times GTK text scaling,
 * which terminals ignore), so divide by it.
 */
export const cssFontSize = (font: TerminalFont, pixelRatio: number): string | null => {
  if (!font.size_pt || !(font.scale > 0) || !(pixelRatio > 0)) return null
  return `${(((font.size_pt * 4) / 3) * font.scale / pixelRatio).toFixed(2)}px`
}

export interface OmarchyFollowDeps {
  call: <T>(command: string) => Promise<T>
  /** Subscribes to a Tauri event; resolves once the subscription is active. */
  listen: <T>(event: string, handler: (event: { payload: T }) => void) => Promise<unknown>
  root: HTMLElement
  pixelRatio: () => number
  win?: Window
}

/**
 * Applies the theme colours and the terminal font size now, and again on every omarchy-changed event
 * the backend pushes (it watches the files). The window regaining focus re-reads once, because a
 * change of monitor scale is not a file change. Resolves when the startup read has been applied.
 */
export const followOmarchy = async (deps: OmarchyFollowDeps): Promise<void> => {
  let appliedPalette = ""
  let appliedSize = ""
  // Counts reads and pushed events, so a read that finishes after something newer is dropped.
  let latest = 0

  const apply = (state: Partial<OmarchyState>): void => {
    const { palette, font } = state
    // Mid-switch the theme file is briefly missing: keep the colours we have.
    if (palette && isComplete(palette)) {
      const next = JSON.stringify(palette)
      if (next !== appliedPalette) {
        appliedPalette = next
        applyPalette(deps.root, palette)
      }
    }
    // No terminal config right now: keep the size we have.
    const size = font ? cssFontSize(font, deps.pixelRatio()) : null
    if (size && size !== appliedSize) {
      appliedSize = size
      deps.root.style.setProperty("--font-size", size)
    }
  }

  const read = async (): Promise<void> => {
    const mine = ++latest
    // No Tauri runtime or a failed call: the stylesheet's fallback colours and size stay.
    const [palette, font] = await Promise.allSettled([
      deps.call<Palette>("theme_palette"),
      deps.call<TerminalFont>("terminal_font"),
    ])
    if (mine !== latest) return
    apply({
      palette: palette.status === "fulfilled" ? palette.value : undefined,
      font: font.status === "fulfilled" ? font.value : undefined,
    })
  }

  try {
    await deps.listen<OmarchyState>("omarchy-changed", event => {
      latest += 1
      apply(event.payload)
    })
  } catch {
    // Outside a Tauri runtime (such as unit tests) there are no events; the startup read still applies.
  }
  const win = deps.win ?? (typeof window !== "undefined" ? window : undefined)
  win?.addEventListener("focus", () => void read())
  await read()
}
