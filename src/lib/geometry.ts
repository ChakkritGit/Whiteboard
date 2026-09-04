import type { Item } from './types'

/** Turn a vector by an angle in degrees. */
export function turn(dx: number, dy: number, degrees: number) {
  const radians = (degrees * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return { x: dx * cos - dy * sin, y: dx * sin + dy * cos }
}

/**
 * The upright box that contains an item, turned or not.
 *
 * A rotated note still has to be findable by a rectangular marquee and still has
 * to fit inside Fit, and both of those work in screen axes. The four corners are
 * turned about the centre and the extremes taken, which is the whole of it.
 */
export function bounds(item: Item) {
  if (!item.angle) return { x: item.x, y: item.y, w: item.w, h: item.h }

  const cx = item.x + item.w / 2
  const cy = item.y + item.h / 2
  const corners = [
    turn(-item.w / 2, -item.h / 2, item.angle),
    turn(item.w / 2, -item.h / 2, item.angle),
    turn(item.w / 2, item.h / 2, item.angle),
    turn(-item.w / 2, item.h / 2, item.angle),
  ]
  const xs = corners.map((corner) => cx + corner.x)
  const ys = corners.map((corner) => cy + corner.y)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  return { x: minX, y: minY, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY }
}

/** Whether two upright boxes overlap at all. */
export function overlaps(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}
