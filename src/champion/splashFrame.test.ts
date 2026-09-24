import { describe, it, expect } from 'vitest'
import { galleryFrame, GALLERY_TILE_RATIO } from './splashFrame'

const BOX = { w: 300, h: 200 }
const HD = { w: 1920, h: 1080 } // 16:9, the recommended shape

describe('galleryFrame', () => {
  it('has the gallery tile\'s shape', () => {
    const f = galleryFrame(HD, BOX, { x: 50, y: 50 })
    expect(f.width / f.height).toBeCloseTo(GALLERY_TILE_RATIO, 5)
  })

  it('for a 16:9 image fills the preview\'s height and a narrow slice of its width', () => {
    const f = galleryFrame(HD, BOX, { x: 50, y: 50 })
    expect(f.top).toBeCloseTo(0, 5)
    expect(f.height).toBeCloseTo(200, 5)
    expect(f.width).toBeCloseTo(144, 5)
    expect(f.left).toBeCloseTo(78, 5)
  })

  it('sits against the left edge at position 0% and the right edge at 100%', () => {
    expect(galleryFrame(HD, BOX, { x: 0, y: 50 }).left).toBeCloseTo(0, 5)
    const right = galleryFrame(HD, BOX, { x: 100, y: 50 })
    expect(right.left + right.width).toBeCloseTo(BOX.w, 5)
  })

  it('moves rightwards as the position increases', () => {
    const lefts = [0, 25, 50, 75, 100].map(x => galleryFrame(HD, BOX, { x, y: 50 }).left)
    expect([...lefts].sort((a, b) => a - b)).toEqual(lefts)
  })

  it('stays inside the preview for a wide image', () => {
    for (const x of [0, 33, 50, 80, 100]) {
      const f = galleryFrame({ w: 3000, h: 1000 }, BOX, { x, y: 50 })
      expect(f.left).toBeGreaterThanOrEqual(-1e-9)
      expect(f.left + f.width).toBeLessThanOrEqual(BOX.w + 1e-9)
    }
  })

  it('a portrait image makes the gallery keep more height than the 3:2 preview shows (known limitation)', () => {
    // Recorded so the behaviour is deliberate: the frame is drawn true to the crop and the
    // preview clips it, rather than the frame being squeezed to fit.
    const f = galleryFrame({ w: 1000, h: 2000 }, BOX, { x: 50, y: 50 })
    expect(f.height).toBeGreaterThan(BOX.h)
  })
})
