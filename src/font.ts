/** What the terminal_font command returns: the terminal's font size in points and the monitor scale. */
export interface TerminalFont {
  size_pt: number | null
  scale: number
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

export interface FontFollowDeps {
  call: <T>(command: string) => Promise<T>
  root: HTMLElement
  every: (fn: () => void, ms: number) => unknown
  pixelRatio: () => number
}

/** Sets the note's font size to the terminal's now and again whenever it changes. */
export const followTerminalFont = (deps: FontFollowDeps): (() => Promise<void>) => {
  let applied = ""
  const refresh = async (): Promise<void> => {
    try {
      const size = cssFontSize(await deps.call<TerminalFont>("terminal_font"), deps.pixelRatio())
      // No terminal config right now: keep the size we have.
      if (!size || size === applied) return
      applied = size
      deps.root.style.setProperty("--font-size", size)
    } catch {
      // No Tauri runtime or a failed call: the stylesheet's fallback size stays.
    }
  }
  void refresh()
  deps.every(() => void refresh(), 1000)
  return refresh
}
