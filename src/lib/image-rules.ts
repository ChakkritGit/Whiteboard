/**
 * What a picture in the document has to be.
 *
 * Imports nothing on purpose: the browser and the check script load this file
 * as it is.
 *
 * A picture is a Base64 data URL inside the doc. A client joining a room gets
 * the whole doc in one WebSocket message and Cloudflare caps that at 1MB, so a
 * picture is small and a board has a budget for all of them together.
 */

/** The longest `src` one picture may have, in characters (about 150KB of bytes). */
export const MAX_SRC = 200_000

/** The most `src` characters every picture on a board may add up to. */
export const BOARD_BUDGET = 600_000

/** A file bigger than this is refused before it is decoded. */
export const MAX_INPUT_BYTES = 20 * 1024 * 1024

export const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif'

/** The only shapes of `src` that are ever drawn. No SVG: it can carry script. */
export const DATA_URL_RE = /^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/

/** True for a `src` that is safe to hand to an `<img>`. Anything a peer wrote is checked with this. */
export function isPictureSrc(src: unknown): src is string {
  return typeof src === 'string' && src.length <= MAX_SRC && DATA_URL_RE.test(src)
}

/** What is left of the board's picture budget; negative when it is over. */
export function budgetLeft(items: { kind: string; src?: string }[]): number {
  return BOARD_BUDGET - items.reduce((sum, i) => sum + (i.kind === 'image' ? (i.src?.length ?? 0) : 0), 0)
}
