'use client'

import { PALETTE } from './palette'
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
const LINE = '#e5e3df'
const PANEL = '#ffffff'

const FONT =
  "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans Thai', sans-serif"

/** Matching `board-item.tsx`: sticky `p-3`, text `p-1`, both 15px on 1.375. */
const STICKY_PAD = 12
const TEXT_PAD = 4
const BODY_SIZE = 15
const NOTE_SIZE = 13
const LINE_HEIGHT = 1.375
const RADIUS = 8
const FRAME_RADIUS = 12

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
  ctx.font = `${weight} ${size}px ${FONT}`
  ctx.fillStyle = colour
  ctx.textBaseline = 'top'
  const step = size * LINE_HEIGHT
  wrap(ctx, text, width).forEach((line, i) => ctx.fillText(line, x, y + i * step))
  return wrap(ctx, text, width).length * step
}

function drawItem(ctx: CanvasRenderingContext2D, item: Item) {
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
      if (points.length >= 4) {
        ctx.beginPath()
        for (let i = 0; i < points.length; i += 2) {
          const px = points[i] - item.x
          const py = points[i + 1] - item.y
          if (i === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        }
        ctx.strokeStyle = item.highlight ? swatch.dot : INK
        ctx.globalAlpha = item.highlight ? 0.45 : 1
        ctx.lineWidth = item.stroke ?? 3
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.stroke()
        ctx.globalAlpha = 1
      }
      break
    }

    case 'frame': {
      ctx.fillStyle = PANEL
      ctx.globalAlpha = 0.5
      roundedRect(ctx, item.w, item.h, FRAME_RADIUS)
      ctx.fill()
      ctx.globalAlpha = 1

      ctx.strokeStyle = LINE
      ctx.lineWidth = 2
      ctx.setLineDash([6, 6])
      roundedRect(ctx, item.w, item.h, FRAME_RADIUS)
      ctx.stroke()
      ctx.setLineDash([])

      // The label chip, above the top-left corner.
      const label = item.text || 'Frame'
      ctx.font = `600 12px ${FONT}`
      const width = Math.min(ctx.measureText(label).width + 16, item.w)
      ctx.fillStyle = INK
      ctx.save()
      ctx.translate(0, -28)
      roundedRect(ctx, width, 22, 6)
      ctx.fill()
      ctx.fillStyle = CANVAS
      ctx.textBaseline = 'middle'
      ctx.fillText(label, 8, 12)
      ctx.restore()
      break
    }

    case 'shape': {
      ctx.fillStyle = swatch.dot
      roundedRect(ctx, item.w, item.h, RADIUS)
      ctx.fill()
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
      ctx.save()
      ctx.shadowColor = 'rgba(16, 24, 40, 0.12)'
      ctx.shadowBlur = 6
      ctx.shadowOffsetY = 2
      ctx.fillStyle = swatch.dot
      roundedRect(ctx, item.w, item.h, RADIUS)
      ctx.fill()
      ctx.restore()

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

/** How many device pixels per board unit, capped so a huge board still encodes. */
function scaleFor(bounds: Bounds, want: number) {
  const longest = Math.max(bounds.w, bounds.h)
  return Math.min(want, Math.max(1, 8000 / longest))
}

export function toCanvas(items: Item[], want = 2) {
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
  for (const item of [...items].sort((a, b) => a.z - b.z)) drawItem(ctx, item)

  return { canvas, scale, bounds }
}
