/**
 * What an uploaded picture has to be, shared by the app and both room servers.
 *
 * Imports nothing on purpose: the Node server, the Cloudflare worker, the
 * browser and the check script all load this file as it is.
 */

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export const IMAGE_TYPES = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
} as const

/** The other way round, for serving a stored picture by its extension. */
export const EXT_TYPES: Record<string, string> = Object.fromEntries(
  Object.entries(IMAGE_TYPES).map(([type, ext]) => [ext, type]),
)

/** A stored picture's name: a lowercase uuid and one of the four extensions. Nothing else is ever a key. */
export const KEY_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp|gif)$/

const starts = (bytes: Uint8Array, at: number, head: number[]) =>
  bytes.length >= at + head.length && head.every((b, i) => bytes[at + i] === b)

/**
 * The type the bytes say they are, or null.
 *
 * Read from the first bytes, never from the file name or the `Content-Type` the
 * browser sent: both are whatever the sender typed, and a file called `.png`
 * that is really HTML or SVG would otherwise be served back from our own origin.
 */
export function sniff(bytes: Uint8Array): keyof typeof IMAGE_TYPES | null {
  if (starts(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png'
  if (starts(bytes, 0, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (starts(bytes, 0, [0x47, 0x49, 0x46, 0x38])) return 'image/gif'
  // RIFF, four bytes of length, then WEBP.
  if (starts(bytes, 0, [0x52, 0x49, 0x46, 0x46]) && starts(bytes, 8, [0x57, 0x45, 0x42, 0x50])) return 'image/webp'
  return null
}
