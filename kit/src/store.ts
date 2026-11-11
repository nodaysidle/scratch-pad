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
/** What a form submit handler returns: the validation message for the form's message slot, or null when nothing is shown there. */
export type SubmitResult = string | null

export const createSlots = () => {
  const hosts = new Map<string, HTMLElement>()
  const rowRenders = new Map<string, Array<(record: never) => HTMLElement>>()
  const handlers = new Map<string, () => SubmitResult | Promise<SubmitResult>>()
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
    /** A later task registers how its control renders in each row; the list calls row(name, record) once per row on every render. */
    mountRow: <T>(name: string, render: (record: T) => HTMLElement): void => {
      rowRenders.set(name, [...(rowRenders.get(name) ?? []), render as (record: never) => HTMLElement])
    },
    row: <T>(name: string, record: T): HTMLElement => {
      const element = document.createElement("div")
      element.dataset.slot = name
      for (const render of rowRenders.get(name) ?? []) element.append((render as (record: T) => HTMLElement)(record))
      return element
    },
    /** A later task registers the action a shared control runs (the form's confirm runs "add" or "edit"); run(name) calls it. */
    handle: (name: string, action: () => SubmitResult | Promise<SubmitResult>): void => { handlers.set(name, action) },
    /** The handler's validation message for the form's message slot, or null (saved, or failed into the errors banner, or no handler). */
    run: async (name: string): Promise<SubmitResult> => (await handlers.get(name)?.()) ?? null,
  }
}
