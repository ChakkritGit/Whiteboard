'use client'

import { ACCEPT, MAX_INPUT_BYTES, MAX_SRC } from './image-rules'

/** Why a picture was not added, as a code; the caller has the words in the right language. */
export class UploadError extends Error {
  constructor(readonly code: 'tooBig' | 'wrongType' | 'boardFull') {
    super(code)
    this.name = 'UploadError'
  }
}

const SIDES = [1280, 960, 720]
const QUALITIES = [0.82, 0.7, 0.55]

const toDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })

/** Draw the bitmap at `w` x `h` and encode it, from whichever canvas this browser has. */
async function encode(bitmap: ImageBitmap, w: number, h: number, type: string, quality: number): Promise<Blob> {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(w, h)
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h)
    return canvas.convertToBlob({ type, quality })
  }
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h)
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('encode'))), type, quality),
  )
}

/**
 * Shrink a picture in the browser and return it as a data URL for the document.
 *
 * Re-encoded as WebP (JPEG where the browser cannot write WebP), at falling
 * sizes and qualities, until it fits `MAX_SRC`. That also makes a GIF a still.
 */
export async function pictureFromFile(file: File): Promise<{ src: string; aspect: number; width: number }> {
  if (!ACCEPT.split(',').includes(file.type)) throw new UploadError('wrongType')
  if (file.size > MAX_INPUT_BYTES) throw new UploadError('tooBig')

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    // The browser could not read it, so it is not a picture whatever it is called.
    throw new UploadError('wrongType')
  }
  try {
    if (!bitmap.width || !bitmap.height) throw new UploadError('wrongType')
    const aspect = bitmap.width / bitmap.height
    let type = 'image/webp'
    for (const side of SIDES) {
      const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height))
      const w = Math.max(1, Math.round(bitmap.width * scale))
      const h = Math.max(1, Math.round(bitmap.height * scale))
      for (const quality of QUALITIES) {
        let blob = await encode(bitmap, w, h, type, quality)
        if (type === 'image/webp' && blob.type !== 'image/webp') {
          // No WebP encoder here: the browser fell back to PNG, so use JPEG from now on.
          type = 'image/jpeg'
          blob = await encode(bitmap, w, h, type, quality)
        }
        const src = await toDataUrl(blob)
        if (src.length <= MAX_SRC) return { src, aspect, width: w }
      }
    }
    throw new UploadError('tooBig')
  } finally {
    bitmap.close()
  }
}
