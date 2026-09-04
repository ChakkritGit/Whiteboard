'use client'

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
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${slug(title)}.whiteboard.json`
  link.click()
  // Revoking on the next tick rather than immediately: Safari has not finished
  // with the URL when `click()` returns.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Read a file back, refusing anything that is not one of ours.
 *
 * Everything is checked rather than trusted: an import is the one place a board
 * takes in something it did not write, and a missing `x` would put a note at
 * `NaN` where nobody could ever find or select it again.
 */
export async function readFile(
  file: File,
): Promise<{ items: Item[]; title: string; groups: Record<string, string> }> {
  const text = await file.text()

  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('That file is not JSON.')
  }

  if (!isRecord(data) || data.format !== 'whiteboard') {
    throw new Error('That is not a whiteboard file.')
  }
  if (data.version !== 1) {
    throw new Error(`This board was written by a newer version (${String(data.version)}).`)
  }
  if (!Array.isArray(data.items)) throw new Error('That file has no items in it.')

  const items = data.items.filter(isItem)
  if (items.length !== data.items.length) {
    throw new Error('Some items in that file are damaged.')
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
