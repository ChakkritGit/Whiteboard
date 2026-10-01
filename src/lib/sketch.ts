import rough from 'roughjs'
import type { Options } from 'roughjs/bin/core'

/** What an item is drawn as: a note, a shape, or a dashed frame. */
export type SketchKind = 'sticky' | 'shape' | 'frame'

export const SKETCH = { roughness: 1.2, bowing: 1.5, strokeWidth: 1.75, offset: 2 } as const
export const FRAME_DASH = [8, 6]

/**
 * The wobble comes from the item id alone, so every peer and every render draws
 * the same outline. FNV-1a over the UTF-16 units, folded to 1..2^31-1 because
 * roughjs treats a seed of 0 as "pick one at random".
 */
export function seedOf(id: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193)
  return (h >>> 1) || 1
}

const gen = rough.generator()
const cache = new Map<string, { fill?: string; outline: string }>()

const lines = new Map<string, string>()

const size = (n: number) => (Number.isFinite(n) ? Math.max(1, n) : 1)

export type SketchShape = 'rect' | 'ellipse' | 'diamond'

/**
 * SVG path data for a hand-drawn box, ellipse or diamond. The fill is its own
 * path, drawn from a different seed so that it can sit 2px off the outline, like
 * a second print pass; that offset is the renderer's job (`SKETCH.offset`), not
 * baked in here. Frames have an outline only.
 */
export function shapePaths(
  w: number,
  h: number,
  seed: number,
  kind: SketchKind,
  line: string,
  fill?: string,
  shape: SketchShape = 'rect',
): { fill?: string; outline: string } {
  w = size(w)
  h = size(h)
  const key = `${seed}|${w}|${h}|${kind}|${line}|${fill ?? ''}|${shape}`
  const hit = cache.get(key)
  if (hit) return hit

  const draw = (opts: Options) =>
    shape === 'ellipse'
      ? gen.ellipse(w / 2, h / 2, w, h, opts)
      : shape === 'diamond'
        ? gen.polygon([[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]], opts)
        : gen.rectangle(0, 0, w, h, opts)

  const outline = gen.toPaths(
    draw({
      seed,
      roughness: SKETCH.roughness,
      bowing: SKETCH.bowing,
      stroke: line,
      strokeWidth: SKETCH.strokeWidth,
      strokeLineDash: kind === 'frame' ? FRAME_DASH : undefined,
    }),
  )
    .map((p) => p.d)
    .join(' ')
  const body =
    fill && kind !== 'frame'
      ? gen
          .toPaths(
            draw({
              seed: seed + 1,
              roughness: 0.8,
              fill,
              fillStyle: 'solid',
              stroke: 'none',
            }),
          )
          .find((p) => p.fill && p.fill !== 'none')?.d
      : undefined

  const out = { fill: body, outline }
  // ponytail: clear-all at 500, an LRU if big boards thrash
  if (cache.size > 500) cache.clear()
  cache.set(key, out)
  return out
}

/** The rectangle `shapePaths` draws, for callers that never meant anything else. */
export const rectPaths = (
  w: number,
  h: number,
  seed: number,
  kind: SketchKind,
  line: string,
  fill?: string,
) => shapePaths(w, h, seed, kind, line, fill)

/**
 * SVG path data for a hand-drawn line, with an arrowhead if asked: two short
 * strokes back from the end point, 14 units long, 28 degrees either side of the
 * line. Drawn exactly where the points say, so the caller shifts them first.
 */
export function linePaths(
  points: [number, number, number, number],
  seed: number,
  line: string,
  head: 'end' | 'none',
): string {
  const [x1, y1, x2, y2] = points
  const key = `${seed}|${points.join(',')}|${line}|${head}`
  const hit = lines.get(key)
  if (hit !== undefined) return hit

  const opts = { seed, roughness: SKETCH.roughness, bowing: SKETCH.bowing, stroke: line, strokeWidth: SKETCH.strokeWidth }
  const parts = [gen.line(x1, y1, x2, y2, opts)]
  if (head === 'end') {
    const back = Math.atan2(y1 - y2, x1 - x2)
    for (const turn of [0.489, -0.489]) {
      const a = back + turn
      parts.push(gen.line(x2, y2, x2 + 14 * Math.cos(a), y2 + 14 * Math.sin(a), { ...opts, seed: seed + 2 }))
    }
  }
  const d = parts.flatMap((p) => gen.toPaths(p).map((q) => q.d)).join(' ')
  // ponytail: clear-all at 500, an LRU if big boards thrash
  if (lines.size > 500) lines.clear()
  lines.set(key, d)
  return d
}
