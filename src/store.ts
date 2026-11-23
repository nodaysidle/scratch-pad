/** The shared view state of the main screen: one object, changed only through set, observed through subscribe. */
export const createStore = <S extends object>(initial: S) => {
  let state = initial
  const listeners = new Set<() => void>()
  return {
    get: (): S => state,
    /** Merges the patch into the state and tells every subscriber, so every view re-renders from one source. */
    set: (patch: Partial<S>): void => {
      state = { ...state, ...patch }
      for (const listener of [...listeners]) listener()
    },
    /** Returns the function that unsubscribes. */
    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
}

/**
 * Named mount points of the main screen. The task that builds the screen places each host with host(name);
 * a later task adds its control with mount(name, element) from main.ts and never edits the screen's file.
 */
export const createSlots = () => {
  const hosts = new Map<string, HTMLElement>()
  const host = (name: string): HTMLElement => {
    let element = hosts.get(name)
    if (!element) {
      element = document.createElement("div")
      element.dataset.slot = name
      hosts.set(name, element)
    }
    return element
  }
  return {
    host,
    mount: (name: string, ...children: HTMLElement[]): void => host(name).append(...children),
  }
}
