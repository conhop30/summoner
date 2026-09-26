// The launch screen (in index.html) stays up until the app has what it needs to show something real;
// see startupGate.ts for the waiting. This is the part that touches the page.
import { createStartupGate } from './startupGate'

/** How long the launch screen fades out for; the stylesheet in index.html uses the same. */
const FADE_MS = 240
const GIVE_UP_MS = 6000

/** Whether the app starts on the gallery, which is where a normal launch lands. */
function startsOnGallery(hash: string): boolean {
  return hash === '' || hash === '#' || hash === '#/'
}

function removeLaunchScreen() {
  const screen = document.getElementById('splash')
  if (!screen) return
  // Two frames, so the app underneath has painted before the screen starts to fade.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    screen.classList.add('done')
    setTimeout(() => screen.remove(), FADE_MS + 60)
  }))
}

const gate = createStartupGate(
  ['settings', ...(startsOnGallery(window.location.hash) ? ['gallery'] : [])],
  removeLaunchScreen,
  GIVE_UP_MS,
)

/** A part of the app that the launch screen waits for: "settings" and, on the gallery, "gallery". */
export function startupReady(part: string): void {
  gate.ready(part)
}
