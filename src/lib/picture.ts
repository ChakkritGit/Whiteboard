'use client'

import { PALETTE } from './palette'
import { isPictureSrc } from './image-rules'
import { connectorEnds } from './geometry'
import { inkPath } from './ink'
import { FRAME_DASH, SKETCH, linePaths, seedOf, shapePaths, type SketchKind } from './sketch'
import type { Item } from './types'

/**
 * A board as a picture.
 *
 * Drawn from the items rather than photographed off the screen. Copying what
 * the browser has already laid out — html2canvas and its relatives — means
 * shipping a second, approximate CSS engine and getting back whatever happened
 * to be on screen at the time: the current zoom, the current pan, whatever the
 * viewport cut off. Drawing from the data gives the whole board at any
 * resolution, with no dependency, and the export is the same on every machine.
 *
 * The cost is that this file has to agree with `board-item.tsx` about what a
 * sticky looks like. That is a real cost and the reason the constants below name
 * what they are rather than sitting inline: when the note changes, this is the
 * list to walk.
 */

export type PictureFormat = 'png' | 'jpeg' | 'pdf'

/** The light theme, always: an exported picture is a document, not a screenshot. */
const CANVAS = '#f4f2ee'
const INK = '#1f2430'
const PANEL = '#ffffff'

/** Read per picture, not at load: the hand font's family name is only known once Next has set it. */
const font = () => {
  const hand = getComputedStyle(document.documentElement).getPropertyValue('--font-hand').trim()
  return `${hand ? hand + ', ' : ''}ui-sans-serif, system-ui, 'Noto Sans Thai', sans-serif`
}

/** Matching `board-item.tsx`: sticky `p-3`, text `p-1`, both 15px on 1.375. */
const STICKY_PAD = 12
const TEXT_PAD = 4
const BODY_SIZE = 15
const NOTE_SIZE = 13
const LINE_HEIGHT = 1.375

/** Space left round the outside, in board units. */
const MARGIN = 48

export type Bounds = { x: number; y: number; w: number; h: number }

/** Everything the board occupies, with room to breathe. */
export function boundsOf(items: Item[]): Bounds {
  if (!items.length) return { x: 0, y: 0, w: 640, h: 400 }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const item of items) {
    // A frame's label sits above its box, and a rotated item reaches past its
    // own corners; both are covered by taking the item's diagonal.
    const reach = item.angle ? Math.hypot(item.w, item.h) / 2 - Math.min(item.w, item.h) / 2 : 0
    minX = Math.min(minX, item.x - reach)
    minY = Math.min(minY, item.y - reach - (item.kind === 'frame' ? 30 : 0))
    maxX = Math.max(maxX, item.x + item.w + reach)
    maxY = Math.max(maxY, item.y + item.h + reach)
  }

  return {
    x: minX - MARGIN,
    y: minY - MARGIN,
    w: maxX - minX + MARGIN * 2,
    h: maxY - minY + MARGIN * 2,
  }
}

function roundedRect(ctx: CanvasRenderingContext2D, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(radius, 0)
  ctx.arcTo(w, 0, w, h, radius)
  ctx.arcTo(w, h, 0, h, radius)
  ctx.arcTo(0, h, 0, 0, radius)
  ctx.arcTo(0, 0, w, 0, radius)
  ctx.closePath()
}

/**
 * The same hand-drawn box the board draws, from the same `d` strings: the fill
 * `SKETCH.offset` off the outline, then the outline on top.
 */
function sketch(
  ctx: CanvasRenderingContext2D,
  item: Item,
  kind: SketchKind,
  line: string,
  fill?: string,
  solid = false,
) {
  const shape = item.shape === 'ellipse' || item.shape === 'diamond' ? item.shape : 'rect'
  const paths = shapePaths(item.w, item.h, seedOf(item.id), kind, line, fill, shape)
  if (paths.fill && fill) {
    ctx.save()
    ctx.translate(SKETCH.offset, SKETCH.offset)
    ctx.fillStyle = fill
    ctx.fill(new Path2D(paths.fill))
    ctx.restore()
  }
  ctx.strokeStyle = line
  ctx.lineWidth = SKETCH.strokeWidth
  ctx.lineCap = 'round'
  if (kind === 'frame' && !solid) ctx.setLineDash(FRAME_DASH)
  ctx.stroke(new Path2D(paths.outline))
  ctx.setLineDash([])
}

/**
 * Text as the note lays it out: wrapped to the width, breaking inside a word
 * when a word alone is wider than the note — which `overflow-wrap: anywhere`
 * does on the board and Thai, written without spaces, needs constantly.
 */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number) {
  const lines: string[] = []

  for (const paragraph of text.split('\n')) {
    if (!paragraph) {
      lines.push('')
      continue
    }

    let line = ''
    for (const word of paragraph.split(/(\s+)/)) {
      if (!word) continue
      if (ctx.measureText(line + word).width <= width || !line) {
        // A single word too wide for the note is broken by character.
        if (ctx.measureText(word).width > width && !line) {
          let chunk = ''
          for (const char of word) {
            if (ctx.measureText(chunk + char).width > width && chunk) {
              lines.push(chunk)
              chunk = char
            } else {
              chunk += char
            }
          }
          line = chunk
          continue
        }
        line += word
      } else {
        lines.push(line.trimEnd())
        line = word.trimStart()
      }
    }
    lines.push(line)
  }

  return lines
}

function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number,
  size: number,
  weight: number,
  colour: string,
) {
  ctx.font = `${weight} ${size}px ${font()}`
  ctx.fillStyle = colour
  ctx.textBaseline = 'top'
  const step = size * LINE_HEIGHT
  wrap(ctx, text, width).forEach((line, i) => ctx.fillText(line, x, y + i * step))
  return wrap(ctx, text, width).length * step
}

/** What the board shows for a picture that will not load: ink hatching and a small picture mark. */
function drawMissing(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.save()
  ctx.fillStyle = PANEL
  ctx.fillRect(0, 0, w, h)
  ctx.beginPath()
  ctx.rect(0, 0, w, h)
  ctx.clip()
  ctx.strokeStyle = 'rgba(31, 36, 48, 0.15)'
  ctx.lineWidth = 2
  ctx.beginPath()
  for (let d = -h; d < w; d += 9) {
    ctx.moveTo(d, h)
    ctx.lineTo(d + h, 0)
  }
  ctx.stroke()
  ctx.translate(w / 2 - 16, h / 2 - 16)
  ctx.scale(32 / 24, 32 / 24)
  ctx.strokeStyle = 'rgba(31, 36, 48, 0.5)'
  ctx.lineWidth = 1.7
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.stroke(new Path2D('M4 5h16v14H4V5ZM4 16l5-5 4 4 3-3 4 4'))
  ctx.restore()
}

function drawItem(ctx: CanvasRenderingContext2D, item: Item, pictures: Map<string, HTMLImageElement | null>) {
  const swatch = PALETTE[item.color] ?? PALETTE.yellow

  ctx.save()
  if (item.angle) {
    ctx.translate(item.x + item.w / 2, item.y + item.h / 2)
    ctx.rotate((item.angle * Math.PI) / 180)
    ctx.translate(-item.w / 2, -item.h / 2)
  } else {
    ctx.translate(item.x, item.y)
  }

  switch (item.kind) {
    case 'stroke': {
      const points = item.points ?? []
      if (points.length >= 2) {
        const local = points.map((value, i) => value - (i % 2 === 0 ? item.x : item.y))
        ctx.fillStyle = item.highlight ? swatch.dot : INK
        ctx.globalAlpha = item.highlight ? 0.45 : 1
        ctx.fill(new Path2D(inkPath(local, item.pressure, item.stroke ?? 3, !!item.highlight)))
        ctx.globalAlpha = 1
      }
      break
    }

    case 'image': {
      const img = item.src ? pictures.get(item.src) : null
      if (img) ctx.drawImage(img, 0, 0, item.w, item.h)
      else drawMissing(ctx, item.w, item.h)
      sketch(ctx, item, 'frame', 'rgba(31, 36, 48, 0.7)', undefined, true)
      break
    }

    case 'frame': {
      ctx.fillStyle = PANEL
      ctx.globalAlpha = 0.5
      ctx.fillRect(0, 0, item.w, item.h)
      ctx.globalAlpha = 1
      sketch(ctx, item, 'frame', 'rgba(31, 36, 48, 0.7)')

      // The label chip, above the top-left corner.
      const label = item.text || 'Frame'
      ctx.font = `600 12px ${font()}`
      const width = Math.min(ctx.measureText(label).width + 16, item.w)
      ctx.fillStyle = '#6366F1'
      ctx.save()
      ctx.translate(0, -28)
      roundedRect(ctx, width, 22, 6)
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.textBaseline = 'middle'
      ctx.fillText(label, 8, 12)
      ctx.restore()
      break
    }

    case 'shape': {
      sketch(ctx, item, 'shape', swatch.line, swatch.tint)
      if (item.text) {
        // Centred both ways, in the inset the board uses, and clipped to the shape's box.
        const pad = item.shape === 'diamond' ? item.w * 0.18 : 12
        const width = item.w - pad * 2
        ctx.save()
        ctx.beginPath()
        ctx.rect(0, 0, item.w, item.h)
        ctx.clip()
        ctx.font = `${item.weight ?? 600} ${BODY_SIZE}px ${font()}`
        const lines = wrap(ctx, item.text, width)
        const step = BODY_SIZE * LINE_HEIGHT
        ctx.fillStyle = swatch.deep
        ctx.textBaseline = 'top'
        ctx.textAlign = 'center'
        const top = (item.h - lines.length * step) / 2
        lines.forEach((line, i) => ctx.fillText(line, item.w / 2, Math.max(0, top) + i * step))
        ctx.restore()
      }
      break
    }

    case 'text': {
      drawText(
        ctx,
        item.text,
        TEXT_PAD,
        TEXT_PAD,
        item.w - TEXT_PAD * 2,
        BODY_SIZE,
        item.weight ?? 500,
        swatch.deep,
      )
      break
    }

    // A comment is a sticky that happens to carry a name; both are drawn here.
    default: {
      sketch(ctx, item, 'sticky', swatch.line, swatch.tint)

      const width = item.w - STICKY_PAD * 2
      const used = drawText(
        ctx,
        item.text,
        STICKY_PAD,
        STICKY_PAD,
        width,
        BODY_SIZE,
        item.weight ?? 600,
        swatch.deep,
      )
      if (item.note) {
        ctx.globalAlpha = 0.75
        drawText(ctx, item.note, STICKY_PAD, STICKY_PAD + used + 6, width, NOTE_SIZE, 400, swatch.deep)
        ctx.globalAlpha = 1
      }
      break
    }
  }

  ctx.restore()
}

/** A line or arrow, from the same `d` as the board, in world space. A bound end follows its item. */
function drawConnector(ctx: CanvasRenderingContext2D, item: Item, ends: [number, number, number, number]) {
  const line = (PALETTE[item.color] ?? PALETTE.slate).line
  const head = item.head === 'end' ? 'end' : 'none'
  ctx.save()
  ctx.strokeStyle = line
  ctx.lineWidth = SKETCH.strokeWidth
  ctx.lineCap = 'round'
  ctx.stroke(new Path2D(linePaths(ends, seedOf(item.id), line, head)))
  ctx.restore()
}

/** How many device pixels per board unit, capped so a huge board still encodes. */
function scaleFor(bounds: Bounds, want: number) {
  const longest = Math.max(bounds.w, bounds.h)
  return Math.min(want, Math.max(1, 8000 / longest))
}

/**
 * Every picture the board uses, loaded for drawing. One that fails to load is
 * `null` and is drawn as the placeholder: a missing file must not stop an export.
 * A data URL needs no CORS, so the canvas is not tainted. Only a `src` that
 * passes `isPictureSrc` is loaded: a peer wrote the rest.
 */
async function loadPictures(items: Item[]) {
  const keys = new Set(items.flatMap((i) => (i.kind === 'image' && isPictureSrc(i.src) ? [i.src] : [])))
  const loaded = new Map<string, HTMLImageElement | null>()
  await Promise.all(
    [...keys].map(async (key) => {
      const img = new Image()
      img.src = key
      try {
        await img.decode()
        loaded.set(key, img)
      } catch {
        loaded.set(key, null)
      }
    }),
  )
  return loaded
}

export async function toCanvas(items: Item[], want = 2) {
  const pictures = await loadPictures(items)
  const bounds = boundsOf(items)
  const scale = scaleFor(bounds, want)

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bounds.w * scale)
  canvas.height = Math.round(bounds.h * scale)

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas unavailable')

  ctx.fillStyle = CANVAS
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.scale(scale, scale)
  ctx.translate(-bounds.x, -bounds.y)

  // Back to front, the same order the board stacks them in.
  const byId = new Map(items.filter((i) => i.kind !== 'connector').map((i) => [i.id, i]))
  for (const item of [...items].sort((a, b) => a.z - b.z)) {
    if (item.kind === 'connector') drawConnector(ctx, item, connectorEnds(item, byId))
    else drawItem(ctx, item, pictures)
  }

  return { canvas, scale, bounds }
}
