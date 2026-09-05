'use client'

import { jpegToPdf } from './pdf'
import { toCanvas, type PictureFormat } from './picture'
import type { BoardFile, Item } from './types'

/**
 * Reading and writing a board as a file.
 *
 * Plain JSON rather than the CRDT's own binary update: a file somebody can open,
 * read and diff is worth more than one only this app can decode, and the board
 * is small enough that the size difference does not matter. The trade is that an
 * exported file carries the board's contents but not its history.
 */

export function toFile(items: Item[], title: string, groups?: Record<string, string>): BoardFile {
  return {
    format: 'whiteboard',
    version: 1,
    title,
    savedAt: new Date().toISOString(),
    items,
    groups,
  }
}

export function download(items: Item[], title: string, groups?: Record<string, string>) {
  const blob = new Blob([JSON.stringify(toFile(items, title, groups), null, 2)], {
    type: 'application/json',
  })
  save(blob, `${slug(title)}.whiteboard.json`)
}

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  // Revoking on the next tick rather than immediately: Safari has not finished
  // with the URL when `click()` returns.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function encode(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('encode failed'))),
      type,
      quality,
    )
  })
}

/**
 * The board as a picture: the whole of it, not the part that happens to be on
 * screen, and at twice the resolution so it holds up when someone zooms in.
 *
 * The PDF goes through the same JPEG as the JPEG export — a PDF can carry those
 * bytes as they are, so the page is a wrapper round a picture that has already
 * been made rather than a second rendering of the board.
 */
export async function downloadPicture(items: Item[], title: string, format: PictureFormat) {
  if (!items.length) throw new EmptyBoard()

  const { canvas, scale } = toCanvas(items, 2)

  if (format === 'png') {
    save(await encode(canvas, 'image/png'), `${slug(title)}.png`)
    return
  }

  const jpeg = await encode(canvas, 'image/jpeg', 0.92)
  if (format === 'jpeg') {
    save(jpeg, `${slug(title)}.jpg`)
    return
  }

  const bytes = new Uint8Array(await jpeg.arrayBuffer())
  // The page is the board at its own size: the picture is twice as many pixels,
  // so the points-per-pixel halves with it.
  save(
    jpegToPdf(bytes, canvas.width, canvas.height, 0.75 / scale),
    `${slug(title)}.pdf`,
  )
}

/** There is nothing to draw. Named, so the caller can say it in the right language. */
export class EmptyBoard extends Error {
  constructor() {
    super('emptyBoard')
    this.name = 'EmptyBoard'
  }
}

/**
 * Read a file back, refusing anything that is not one of ours.
 *
 * Everything is checked rather than trusted: an import is the one place a board
 * takes in something it did not write, and a missing `x` would put a note at
 * `NaN` where nobody could ever find or select it again.
 */
/**
 * Why a file was refused, as a code rather than a sentence.
 *
 * The message has to be shown in the reader's language, and this module has no
 * business knowing which one that is — so it names the problem and lets the
 * caller find the words.
 */
export class BadFile extends Error {
  constructor(readonly code: 'notJson' | 'notOurs' | 'newer' | 'noItems' | 'damaged', readonly detail?: string) {
    super(code)
    this.name = 'BadFile'
  }
}

export async function readFile(
  file: File,
): Promise<{ items: Item[]; title: string; groups: Record<string, string> }> {
  const text = await file.text()

  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new BadFile('notJson')
  }

  if (!isRecord(data) || data.format !== 'whiteboard') {
    throw new BadFile('notOurs')
  }
  if (data.version !== 1) {
    throw new BadFile('newer', String(data.version))
  }
  if (!Array.isArray(data.items)) throw new BadFile('noItems')

  const items = data.items.filter(isItem)
  if (items.length !== data.items.length) {
    throw new BadFile('damaged')
  }

  // Groups arrived after version 1 shipped, so a file without them is a valid
  // file, not a damaged one.
  const groups: Record<string, string> = {}
  if (isRecord(data.groups)) {
    Object.entries(data.groups).forEach(([id, name]) => {
      if (typeof name === 'string') groups[id] = name
    })
  }

  return {
    items,
    title: typeof data.title === 'string' ? data.title : 'Imported board',
    groups,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isItem(value: unknown): value is Item {
  if (!isRecord(value)) return false
  const numbers = ['x', 'y', 'w', 'h', 'z'] as const
  return (
    typeof value.id === 'string' &&
    typeof value.kind === 'string' &&
    typeof value.text === 'string' &&
    typeof value.color === 'string' &&
    numbers.every((key) => typeof value[key] === 'number' && Number.isFinite(value[key]))
  )
}

function slug(title: string) {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9฀-๿]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'board'
  )
}
