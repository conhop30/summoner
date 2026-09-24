// How the splash art is cropped where it is shown. Every place uses `object-fit: cover` with the
// champion's `image_position`, so the same image is framed differently by each box.

/** The gallery tile's width ÷ height (see .tile-image in ChampionTile.css). */
export const GALLERY_TILE_RATIO = 0.72

/** The View page banner is at most --content-max-width (1440px) wide. */
export const VIEW_BANNER_MAX_WIDTH = 1440

/** What we tell people to upload: 16:9 like League splash art, sharp on 2x screens at the banner's widest. */
export const SPLASH_RECOMMENDED = { ratio: '16:9', width: 2880, height: 1620 }

export interface FrameRect { left: number; top: number; width: number; height: number }

/**
 * Where the gallery tile's crop lands inside the editor's splash box, in that box's pixels.
 * Both boxes cover-fit the image and align it by the same object-position percentages, so this
 * is the region of the image the gallery shows, mapped into the editor's preview.
 */
export function galleryFrame(
  image: { w: number; h: number },
  box: { w: number; h: number },
  position: { x: number; y: number },
): FrameRect {
  // The editor preview: cover-fit, then offset by the position percentages.
  const s = Math.max(box.w / image.w, box.h / image.h)
  const offX = (box.w - image.w * s) * (position.x / 100)
  const offY = (box.h - image.h * s) * (position.y / 100)

  // The gallery tile (unit height): cover-fit the same way, in the image's own pixels.
  const g = Math.max(GALLERY_TILE_RATIO / image.w, 1 / image.h)
  const vw = GALLERY_TILE_RATIO / g
  const vh = 1 / g
  const left = (image.w - vw) * (position.x / 100)
  const top = (image.h - vh) * (position.y / 100)

  return { left: offX + left * s, top: offY + top * s, width: vw * s, height: vh * s }
}
