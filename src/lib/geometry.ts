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

/** What an edge point needs to know about an item. `x`, `y` is the top-left, as on `Item`. */
export type Box = {
  x: number
  y: number
  w: number
  h: number
  angle?: number
  shape?: 'rect' | 'ellipse' | 'diamond'
}

/**
 * Where the line from a box's centre toward a point leaves the box.
 *
 * Worked in the box's own frame, so a turned box leaves from its true edge: the
 * target is turned back by the angle, the ray is cut against the upright shape,
 * and the hit is turned forward again.
 */
export function edgePoint(box: Box, toward: { x: number; y: number }) {
  const cx = box.x + box.w / 2
  const cy = box.y + box.h / 2
  const angle = box.angle ?? 0
  const local = turn(toward.x - cx, toward.y - cy, -angle)
  const hw = box.w / 2
  const hh = box.h / 2
  const ax = Math.abs(local.x)
  const ay = Math.abs(local.y)
  if (!ax && !ay) return { x: cx, y: cy }

  // How far along the ray, in units of the ray, the outline is.
  const t =
    box.shape === 'ellipse'
      ? 1 / Math.sqrt((local.x / hw) ** 2 + (local.y / hh) ** 2)
      : box.shape === 'diamond'
        ? 1 / (ax / hw + ay / hh)
        : Math.min(ax ? hw / ax : Infinity, ay ? hh / ay : Infinity)
  const out = turn(local.x * t, local.y * t, angle)
  return { x: cx + out.x, y: cy + out.y }
}

/**
 * Both ends of a connector. A bound end is the edge point aimed at the other
 * end's anchor (its centre if bound, else its stored point); a free end, or one
 * whose item is gone, is the stored point.
 */
export function connectorEnds(
  conn: Pick<Item, 'from' | 'to' | 'points'>,
  byId: Map<string, Box>,
): [number, number, number, number] {
  const p = conn.points ?? []
  const [x1, y1, x2, y2] = [0, 1, 2, 3].map((i) => p[i] ?? 0)
  const a = conn.from ? byId.get(conn.from) : undefined
  const b = conn.to ? byId.get(conn.to) : undefined
  const centre = (box: Box) => ({ x: box.x + box.w / 2, y: box.y + box.h / 2 })
  const aim = a ? centre(a) : { x: x1, y: y1 }
  const bim = b ? centre(b) : { x: x2, y: y2 }
  const start = a ? edgePoint(a, bim) : { x: x1, y: y1 }
  const end = b ? edgePoint(b, aim) : { x: x2, y: y2 }
  return [start.x, start.y, end.x, end.y]
}
