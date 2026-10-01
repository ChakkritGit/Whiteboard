'use client'

import { IMG_BASE } from './board'
import { IMAGE_TYPES, MAX_IMAGE_BYTES } from './image-rules'

/** Why a picture was not added, as a code; the caller has the words in the right language. */
export class UploadError extends Error {
  constructor(readonly code: 'tooBig' | 'wrongType' | 'tooMany' | 'offline') {
    super(code)
    this.name = 'UploadError'
  }
}

/**
 * Send a picture to the image store and say what it measures.
 *
 * Type and size are checked here first only to fail early and kindly; the server
 * checks both again from the bytes and is the one that counts.
 */
export async function uploadImage(file: File): Promise<{ key: string; aspect: number; width: number }> {
  if (!Object.hasOwn(IMAGE_TYPES, file.type)) throw new UploadError('wrongType')
  if (file.size > MAX_IMAGE_BYTES) throw new UploadError('tooBig')

  let width: number
  let height: number
  try {
    const bitmap = await createImageBitmap(file)
    ;({ width, height } = bitmap)
    bitmap.close()
  } catch {
    // The browser could not read it, so it is not a picture whatever it is called.
    throw new UploadError('wrongType')
  }
  if (!width || !height) throw new UploadError('wrongType')

  let response: Response
  try {
    response = await fetch(`${IMG_BASE}/img`, { method: 'POST', body: file, headers: { 'content-type': file.type } })
  } catch {
    throw new UploadError('offline')
  }
  if (response.status === 413) throw new UploadError('tooBig')
  if (response.status === 415) throw new UploadError('wrongType')
  if (response.status === 429) throw new UploadError('tooMany')
  if (!response.ok) throw new UploadError('offline')

  const { key } = (await response.json()) as { key: string }
  return { key, aspect: width / height, width }
}
