import { getStroke } from 'perfect-freehand'

const avg = (a: number, b: number) => (a + b) / 2

/** The outline polygon as a closed path of quadratic curves through midpoints. */
function svgPath(pts: number[][]): string {
  const len = pts.length
  if (len < 4) return ''
  let a = pts[0]
  let b = pts[1]
  const c = pts[2]
  let d = `M${a[0].toFixed(2)},${a[1].toFixed(2)} Q${b[0].toFixed(2)},${b[1].toFixed(2)} ${avg(b[0], c[0]).toFixed(2)},${avg(b[1], c[1]).toFixed(2)} T`
  for (let i = 2, max = len - 1; i < max; i++) {
    a = pts[i]
    b = pts[i + 1]
    d += `${avg(a[0], b[0]).toFixed(2)},${avg(a[1], b[1]).toFixed(2)} `
  }
  return d + 'Z'
}

/**
 * A stroke as the filled outline of variable-width ink.
 *
 * `points` is flat `[x, y, ...]` and `pressure` runs parallel, one value per
 * pair. Without pressure (mouse, touch, strokes from before) the width is
 * simulated from speed, so those strokes are not hairlines. A filled path, not
 * a stroked one: the width varies along it.
 */
export function inkPath(points: number[], pressure: number[] | undefined, width: number, highlight: boolean): string {
  const triples: number[][] = []
  for (let i = 0; i + 1 < points.length; i += 2) triples.push([points[i], points[i + 1], pressure?.[i / 2] ?? 0.5])
  // A single point is doubled so the library returns a round dot.
  if (triples.length === 1) triples.push([triples[0][0], triples[0][1], triples[0][2]])
  if (!triples.length) return ''
  return svgPath(
    getStroke(triples, {
      size: width * 1.6,
      thinning: highlight ? 0 : 0.6,
      smoothing: 0.5,
      streamline: 0.45,
      simulatePressure: !pressure,
      last: true,
    }),
  )
}
