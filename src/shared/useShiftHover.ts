import { useEffect, useState } from 'react'

/**
 * Whether Shift is held while the pointer is over something, as the game does for ability
 * tooltips. Spread `hoverProps` on the element to watch; `detailed` is true only while both hold.
 * Shift is read from the window, so it works without the element having focus, and is dropped when the window loses focus so it
 * can't get stuck on.
 */
export function useShiftHover() {
  const [hovering, setHovering] = useState(false)
  const [shift, setShift] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => setShift(e.shiftKey)
    const off = () => setShift(false)
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    window.addEventListener('blur', off)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
      window.removeEventListener('blur', off)
    }
  }, [])

  return {
    detailed: hovering && shift,
    hoverProps: {
      onMouseEnter: () => setHovering(true),
      onMouseLeave: () => setHovering(false),
    },
  }
}
