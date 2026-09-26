// The launch screen (in index.html) stays up until the app has what it needs to show something real,
// so the window never sits blank between opening and its first data. Each part of the app that
// has to be ready reports in; when the last one has, the screen goes. A timeout means a part that
// never reports (a failed load) can't leave the screen up for good.

export interface StartupGate {
  /** Reports that a part is ready. Reporting twice, or a part nobody was waiting for, does nothing. */
  ready(part: string): void
  /** Gives up waiting and opens the gate. */
  open(): void
  readonly isOpen: boolean
}

export function createStartupGate(waitingFor: string[], onOpen: () => void, timeoutMs: number): StartupGate {
  const waiting = new Set(waitingFor)
  let isOpen = false
  let timer: ReturnType<typeof setTimeout> | undefined

  function open() {
    if (isOpen) return
    isOpen = true
    if (timer !== undefined) clearTimeout(timer)
    onOpen()
  }

  if (waiting.size === 0) open()
  else timer = setTimeout(open, timeoutMs)

  return {
    ready(part) {
      waiting.delete(part)
      if (waiting.size === 0) open()
    },
    open,
    get isOpen() { return isOpen },
  }
}
