import { useEffect, useRef } from 'react'

// Horizontal inset: room for the gold endcaps (drawn by ThemeAudioPlayer) at each end, with the
// mist filling the space between them. The pointer→position mapping uses the same inset, so
// what you point at is where playback lands.
export const MIST_PAD = 28

interface Props {
  fraction: number        // 0–1 playback position
  active: boolean         // playing (mist drifts); false = paused / idle (frozen and dimmer)
  hover: number | null    // 0–1 position under the pointer, if any (drives the gold slice)
}

type RGB = [number, number, number]

interface Wisp {
  ax: number; vx: number      // anchor x and drift velocity (px, px/s)
  ay: number; amp: number     // vertical offset and wobble amplitude
  dx: number                  // horizontal sway amplitude
  fx: number; fy: number; phase: number
  age: number; life: number
  size: number; aspect: number
  strength: number
  bright: boolean
  trail: boolean              // shed by the head as it moves, vs. the standing body of mist
}

// A short-lived gold streak pulled up or down the hover slice. It's positioned relative to the
// slice, so it travels with the pointer and nothing is ever left behind.
interface Streak {
  dx: number; y: number; vy: number
  age: number; life: number
  w: number; h: number
}

interface Sprites { soft: HTMLCanvasElement; bright: HTMLCanvasElement }

interface Palette {
  key: string
  additive: boolean
  cyan: Sprites
  gold: Sprites
}

function parseColor(value: string, fallback: RGB): RGB {
  const v = value.trim()
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v)
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split('').map(c => c + c).join('') : hex[1]
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
  }
  const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(v)
  return rgb ? [+rgb[1], +rgb[2], +rgb[3]] : fallback
}

// A soft round puff, pre-rendered once per colour and stretched at draw time into a wisp.
function makeSprite([r, g, b]: RGB, core: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const ctx = c.getContext('2d')!
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, `rgba(${r},${g},${b},${core})`)
  grad.addColorStop(0.35, `rgba(${r},${g},${b},${core * 0.42})`)
  grad.addColorStop(0.7, `rgba(${r},${g},${b},${core * 0.1})`)
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 64, 64)
  return c
}

const lighten = ([r, g, b]: RGB, by: number): RGB =>
  [r + (255 - r) * by, g + (255 - g) * by, b + (255 - b) * by].map(Math.round) as RGB

// The mist is tinted from the theme's own tokens, so dark and light mode each get their colours.
function readPalette(el: HTMLElement): Palette {
  const cs = getComputedStyle(el)
  const tok = (name: string, fb: RGB) => parseColor(cs.getPropertyValue(name), fb)
  const cyan = tok('--accent-hex', [11, 196, 227])
  const gold = tok('--text-accent-gold', [200, 155, 60])
  const bg = tok('--bg-surface', [10, 20, 40])
  const dark = (bg[0] * 299 + bg[1] * 587 + bg[2] * 114) / 1000 < 128
  // Bright cores glow toward white on dark backgrounds; on light ones they stay saturated.
  const cyanBright = dark ? lighten(cyan, 0.55) : cyan
  const goldBright = dark ? lighten(gold, 0.5) : gold
  return {
    key: [cyan, gold, dark].join('|'),
    additive: dark,
    cyan: { soft: makeSprite(cyan, dark ? 0.55 : 0.5), bright: makeSprite(cyanBright, 1) },
    gold: { soft: makeSprite(gold, dark ? 0.55 : 0.5), bright: makeSprite(goldBright, 1) },
  }
}

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

interface State {
  wisps: Wisp[]
  t: number              // simulation clock; only advances while playing, so pausing freezes the mist
  head: number           // displayed head x (eased toward the target so seeks glide)
  slice: number          // 0–1 how present the gold hover slice is (fades in and out)
  sx: number             // slice x: exactly the pointer (no easing, so nothing lags or trails)
  hx: number             // last pointer x, kept so the slice can fade out where it was
  streaks: Streak[]
  streakEmit: number
  dimMix: number         // 0 playing → 1 paused/idle
  emit: number
  raf: number
  last: number
  frame: number
  palette: Palette | null
  w: number
  h: number
}

// The theme player's progress indicator. There is no bar: the played part of the song is a
// bank of drifting hextech mist, thickest at its leading edge, which sheds small wisps as it
// moves. Hovering cuts a gold slice through the mist at the pointer.
export default function MistCanvas({ fraction, active, hover }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const props = useRef({ fraction, active, hover })
  props.current = { fraction, active, hover }
  const kickRef = useRef<() => void>(() => {})

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const S: State = {
      wisps: [], t: 0, head: NaN, slice: 0, sx: 0, hx: 0, streaks: [], streakEmit: 0, dimMix: 1, emit: 0,
      raf: 0, last: 0, frame: 0, palette: null, w: 0, h: 0,
    }

    const fit = () => {
      const dpr = window.devicePixelRatio || 1
      S.w = canvas.clientWidth
      S.h = canvas.clientHeight
      canvas.width = Math.max(1, Math.round(S.w * dpr))
      canvas.height = Math.max(1, Math.round(S.h * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const spawn = (x0: number, head: number) => {
      // Most of the standing mist gathers toward the head and thins out behind it.
      const span = Math.max(1, head - x0)
      const ax = head - span * Math.pow(Math.random(), 1.9)
      const life = rand(3, 6.5)
      S.wisps.push({
        ax, vx: rand(-5, 5), ay: rand(-5, 5), amp: rand(2, 6), dx: rand(6, 20),
        fx: rand(0.25, 0.7), fy: rand(0.4, 1.1), phase: rand(0, 6.28),
        age: rand(0, life), life,
        size: rand(11, 21), aspect: rand(2, 4.2), strength: rand(0.2, 0.42),
        bright: false, trail: false,
      })
    }

    const step = (dt: number): boolean => {
      const { fraction: f, active: on, hover: hv } = props.current
      const still = reduced.matches
      const x0 = MIST_PAD, x1 = S.w - MIST_PAD
      const target = x0 + clamp01(f) * (x1 - x0)
      if (Number.isNaN(S.head)) S.head = target
      const glide = Math.min(1, dt * 16)
      S.head += (target - S.head) * glide
      const moving = Math.abs(target - S.head) > 0.2
      if (!moving) S.head = target

      const sim = on && !still ? dt : 0
      S.t += sim
      for (const w of S.wisps) w.age += sim
      S.wisps = S.wisps.filter(w => w.age < w.life)

      // Keep the standing bank at a density proportional to how much of the song has played.
      const want = Math.min(260, Math.round((S.head - x0) * 0.6))
      let have = 0
      for (const w of S.wisps) if (!w.trail) have++
      for (let i = 0; have < want && i < 10; i++, have++) spawn(x0, S.head)

      // While playing, the leading edge sheds small bright wisps that drift back into the bank.
      if (sim > 0) {
        S.emit += sim * 26
        while (S.emit >= 1 && S.wisps.length < 420) {
          S.emit -= 1
          const life = rand(1.1, 2.3)
          S.wisps.push({
            ax: S.head, vx: -rand(12, 38), ay: rand(-3, 3), amp: rand(1.5, 4), dx: rand(1, 4),
            fx: rand(1, 2), fy: rand(1, 2.4), phase: rand(0, 6.28),
            age: 0, life, size: rand(6, 11), aspect: rand(1.6, 3), strength: rand(0.5, 0.85),
            bright: true, trail: true,
          })
        }
      }

      // The gold slice sits exactly on the pointer and only exists while it's over the mist: it
      // fades out fast when the pointer leaves, and never glides in from where it last was.
      const hovering = hv !== null
      if (hovering) {
        S.hx = x0 + clamp01(hv) * (x1 - x0)
        S.sx = S.hx
      }
      S.slice += ((hovering ? 1 : 0) - S.slice) * Math.min(1, dt * (hovering ? 16 : 24))
      if (!hovering && S.slice < 0.01) { S.slice = 0; S.streaks = [] }

      for (const k of S.streaks) {
        k.age += dt
        k.y += k.vy * dt
      }
      S.streaks = S.streaks.filter(k => k.age < k.life)
      if (hovering && !still) {
        S.streakEmit += dt * 70
        while (S.streakEmit >= 1 && S.streaks.length < 60) {
          S.streakEmit -= 1
          S.streaks.push({
            dx: rand(-3, 3), y: S.h / 2 + rand(-14, 14),
            vy: (Math.random() < 0.5 ? -1 : 1) * rand(45, 130),
            age: 0, life: rand(0.35, 0.8),
            w: rand(4, 8), h: rand(14, 30),
          })
        }
      }

      const ease = Math.min(1, dt * 9)
      S.dimMix += ((on ? 0 : 1) - S.dimMix) * ease
      const settled = Math.abs((on ? 0 : 1) - S.dimMix) < 0.01
      if (settled) S.dimMix = on ? 0 : 1
      return (on && !still) || moving || !settled || hovering || S.slice > 0
    }

    const draw = () => {
      if (S.frame++ % 45 === 0 || !S.palette) {
        const key = readPalette(canvas)
        if (!S.palette || S.palette.key !== key.key) S.palette = key
      }
      const pal = S.palette!
      const x0 = MIST_PAD
      const cy = S.h / 2
      const dim = 1 - 0.5 * S.dimMix
      const slice = S.slice

      ctx.clearRect(0, 0, S.w, S.h)
      ctx.globalCompositeOperation = pal.additive ? 'lighter' : 'source-over'

      // g is how gold this puff is (0 cyan … 1 gold); only mist near the slice ever gets any.
      const puff = (bright: boolean, x: number, y: number, w: number, h: number, a: number, g = 0) => {
        if (a < 0.01) return
        const cyan = bright ? pal.cyan.bright : pal.cyan.soft
        const gold = bright ? pal.gold.bright : pal.gold.soft
        if (g < 0.99) { ctx.globalAlpha = Math.min(1, a) * (1 - g); ctx.drawImage(cyan, x - w / 2, y - h / 2, w, h) }
        if (g > 0.01) { ctx.globalAlpha = Math.min(1, a) * g; ctx.drawImage(gold, x - w / 2, y - h / 2, w, h) }
      }
      const goldNear = (x: number) => slice * Math.pow(clamp01(1 - Math.abs(x - S.sx) / 30), 2)

      const head = S.head
      const span = Math.max(1, head - x0)

      // Standing mist and shed wisps.
      for (const w of S.wisps) {
        const env = Math.sin(Math.PI * (w.age / w.life))
        const x = w.ax + w.vx * w.age + Math.sin(w.age * w.fx + w.phase) * w.dx
        const y = cy + w.ay + Math.sin(w.age * w.fy + w.phase * 1.7) * w.amp
        const edge = clamp01((head - x) / 18 + 0.15)
        const along = 0.3 + 0.7 * clamp01((x - x0) / span)
        puff(w.bright, x, y, w.size * w.aspect, w.size, env * edge * along * w.strength * dim, goldNear(x))
      }

      // The gold slice: a strong vertical blade of gold where the pointer is, with gold streaks
      // pulled up and down it. It lives only while hovering and doesn't trail the pointer.
      if (slice > 0.01) {
        for (const k of S.streaks) {
          const env = Math.sin(Math.PI * (k.age / k.life))
          puff(true, S.sx + k.dx, k.y, k.w, k.h, env * 0.9 * slice, slice)
        }
        const shimmer = 0.9 + 0.1 * Math.sin(S.hx * 0.05 + performance.now() / 90)
        puff(true, S.sx, cy, 12, S.h * 1.05, 0.7 * shimmer * slice, 1)
        puff(true, S.sx, cy, 4, S.h * 0.9, 1 * shimmer * slice, 1)
      }

      ctx.globalAlpha = 1
    }

    const tick = (now: number) => {
      S.raf = 0
      const dt = Math.min(0.05, (now - S.last) / 1000)
      S.last = now
      const more = step(dt)
      draw()
      if (more) S.raf = requestAnimationFrame(tick)
    }

    const kick = () => {
      if (S.raf || S.w === 0) return
      S.last = performance.now()
      S.raf = requestAnimationFrame(tick)
    }
    kickRef.current = kick

    fit()
    const ro = new ResizeObserver(() => { fit(); S.head = NaN; kick() })
    ro.observe(canvas)
    kick()
    return () => { ro.disconnect(); if (S.raf) cancelAnimationFrame(S.raf); kickRef.current = () => {} }
  }, [])

  // Any prop change wakes the render loop; it stops itself again once everything has settled.
  useEffect(() => { kickRef.current() }, [fraction, active, hover])

  return <canvas ref={canvasRef} className="mist-canvas" aria-hidden="true" />
}
