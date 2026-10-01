/**
 * The room server, as a Cloudflare Worker.
 *
 * A Worker on its own cannot do this: it has no memory between requests and no
 * way to hold a socket open. A Durable Object can — and one object per room is
 * the shape this problem already has. Cloudflare routes every connection for a
 * given room name to the same object, wherever in the world it is, so the object
 * *is* the room and there is nothing to coordinate between instances.
 *
 * The relay is the same protocol as the local `scripts/server.mjs`, against the
 * same `yjs` and `y-protocols` the browser uses. Do not swap in a prebuilt
 * server package: one of them pulls a second copy of Yjs in beside its own, and
 * then cursors move while nothing anybody draws ever arrives.
 */
import * as Y from 'yjs'
import * as sync from 'y-protocols/sync'
import * as awarenessProtocol from 'y-protocols/awareness'
import * as encoding from 'lib0/encoding'
import * as decoding from 'lib0/decoding'
import { EXT_TYPES, IMAGE_TYPES, KEY_RE, MAX_IMAGE_BYTES, sniff } from '../../src/lib/image-rules'

const MESSAGE_SYNC = 0
const MESSAGE_AWARENESS = 1

export interface Env {
  ROOM: DurableObjectNamespace
  /** Where pictures are kept: the document holds only the key. */
  IMAGES: R2Bucket
  UPLOADS: RateLimit
  /** Pages allowed to upload, comma-separated. */
  SITE_ORIGINS: string
}

const text = (status: number, body: string, headers: Record<string, string> = {}) =>
  new Response(body, { status, headers: { 'content-type': 'text/plain', ...headers } })

/**
 * Read at most the limit and no more. The header is only a claim, so it is
 * checked first for the cheap refusal and then the stream is counted, which is
 * what actually bounds the memory. Null means too big.
 */
async function readCapped(request: Request): Promise<Uint8Array | null> {
  if (Number(request.headers.get('content-length') ?? 0) > MAX_IMAGE_BYTES) return null
  const reader = request.body?.getReader()
  if (!reader) return new Uint8Array(0)
  const parts: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.length
    if (size > MAX_IMAGE_BYTES) {
      await reader.cancel()
      return null
    }
    parts.push(value)
  }
  const bytes = new Uint8Array(size)
  let at = 0
  for (const part of parts) {
    bytes.set(part, at)
    at += part.length
  }
  return bytes
}

/** The picture routes, beside the socket. Null for anything that is not one of them. */
async function pictures(request: Request, env: Env, url: URL): Promise<Response | null> {
  if (url.pathname === '/img') {
    const origin = request.headers.get('Origin')
    const sites = (env.SITE_ORIGINS ?? 'http://localhost:3000').split(',').map((s) => s.trim())
    const ok = origin !== null && sites.includes(origin)
    const allowed: Record<string, string> = ok ? { 'access-control-allow-origin': origin, vary: 'Origin' } : {}
    if (request.method === 'OPTIONS') {
      return text(204, '', {
        ...allowed,
        'access-control-allow-methods': 'POST',
        'access-control-allow-headers': 'Content-Type',
      })
    }
    if (request.method !== 'POST') return null
    // A page on another site must not be able to fill the bucket. A request with
    // no Origin is not a browser, and CORS is not what stops those.
    if (origin !== null && !ok) return text(403, 'origin not allowed\n')
    const { success } = await env.UPLOADS.limit({ key: request.headers.get('CF-Connecting-IP') ?? 'unknown' })
    if (!success) return text(429, 'too many uploads\n', allowed)

    const bytes = await readCapped(request)
    if (!bytes) return text(413, 'too big\n', allowed)
    // The type comes from the bytes, not from the header or a file name, which
    // are whatever the sender typed.
    const type = sniff(bytes)
    if (!type) return text(415, 'not a png, jpeg, webp or gif\n', allowed)
    const key = `${crypto.randomUUID()}.${IMAGE_TYPES[type]}`
    await env.IMAGES.put(key, bytes, { httpMetadata: { contentType: type } })
    return Response.json({ key }, { headers: allowed })
  }

  if (url.pathname.startsWith('/img/') && request.method === 'GET') {
    // Decoded before it is checked, so `%2e%2e` is no way round the pattern.
    let key: string
    try {
      key = decodeURIComponent(url.pathname.slice(5))
    } catch {
      key = ''
    }
    if (!KEY_RE.test(key)) return text(400, 'bad key\n')
    const found = await env.IMAGES.get(key)
    if (!found) return text(404, 'not found\n')
    return new Response(found.body, {
      headers: {
        'content-type': EXT_TYPES[key.split('.')[1]],
        'cache-control': 'public, max-age=31536000, immutable',
        'x-content-type-options': 'nosniff',
        'content-security-policy': "default-src 'none'",
        // The export draws these into a canvas, which needs CORS on the image.
        'access-control-allow-origin': '*',
      },
    })
  }

  return null
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    const picture = await pictures(request, env, url)
    if (picture) return picture

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('whiteboard rooms\n', { headers: { 'content-type': 'text/plain' } })
    }

    // The room name is the path, which is what the client's provider puts there.
    // `idFromName` is what guarantees everyone on one link lands in one object;
    // two different links can never reach the same one.
    let name: string
    try {
      name = decodeURIComponent(url.pathname.slice(1)) || 'default'
    } catch {
      return new Response('bad room\n', { status: 400 })
    }
    return env.ROOM.get(env.ROOM.idFromName(name)).fetch(request)
  },
}

export class Room implements DurableObject {
  private doc = new Y.Doc()
  private awareness = new awarenessProtocol.Awareness(this.doc)
  /**
   * Socket to the awareness clients it speaks for.
   *
   * A set of sockets is not enough: on disconnect the room has to know *whose*
   * presence to withdraw, and awareness does not record that — its `meta` holds
   * a clock and a timestamp and nothing about where the state came from. So the
   * pairing is noted down at the one moment both are in hand, in the awareness
   * handler below.
   */
  private conns = new Map<WebSocket, Set<number>>()

  constructor() {
    this.awareness.setLocalState(null)

    this.doc.on('update', (update: Uint8Array, origin: unknown) => {
      const message = encoding.createEncoder()
      encoding.writeVarUint(message, MESSAGE_SYNC)
      sync.writeUpdate(message, update)
      this.broadcast(encoding.toUint8Array(message), origin)
    })

    this.awareness.on(
      'update',
      ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
        const owned = this.conns.get(origin as WebSocket)
        if (owned) {
          added.forEach((client) => owned.add(client))
          removed.forEach((client) => owned.delete(client))
        }

        const message = encoding.createEncoder()
        encoding.writeVarUint(message, MESSAGE_AWARENESS)
        encoding.writeVarUint8Array(
          message,
          awarenessProtocol.encodeAwarenessUpdate(this.awareness, added.concat(updated, removed)),
        )
        this.broadcast(encoding.toUint8Array(message), origin)
      },
    )
  }

  private broadcast(payload: Uint8Array, except: unknown) {
    for (const conn of this.conns.keys()) {
      // Not back to whoever sent it: they already have it, and echoing costs a
      // round trip on every keystroke.
      if (conn === except) continue
      try {
        conn.send(payload)
      } catch {
        this.conns.delete(conn)
      }
    }
  }

  async fetch(): Promise<Response> {
    const pair = new WebSocketPair()
    const client = pair[0]
    const server = pair[1]
    server.accept()
    this.conns.set(server, new Set())

    // Our half of the handshake: here is what I have, send me what I am missing.
    const hello = encoding.createEncoder()
    encoding.writeVarUint(hello, MESSAGE_SYNC)
    sync.writeSyncStep1(hello, this.doc)
    server.send(encoding.toUint8Array(hello))

    const states = this.awareness.getStates()
    if (states.size > 0) {
      const message = encoding.createEncoder()
      encoding.writeVarUint(message, MESSAGE_AWARENESS)
      encoding.writeVarUint8Array(
        message,
        awarenessProtocol.encodeAwarenessUpdate(this.awareness, Array.from(states.keys())),
      )
      server.send(encoding.toUint8Array(message))
    }

    server.addEventListener('message', (event: MessageEvent) => {
      // Garbage bytes make the decoders throw, and an exception escaping here can
      // reset the object, taking the room's only copy of the board with it.
      try {
        const data = event.data
        const bytes = new Uint8Array(typeof data === 'string' ? new TextEncoder().encode(data) : data)
        const decoder = decoding.createDecoder(bytes)
        const encoder = encoding.createEncoder()

        switch (decoding.readVarUint(decoder)) {
          case MESSAGE_SYNC:
            encoding.writeVarUint(encoder, MESSAGE_SYNC)
            // `server` as the origin is what stops the update coming straight back
            // to the socket it arrived on.
            sync.readSyncMessage(decoder, encoder, this.doc, server)
            if (encoding.length(encoder) > 1) server.send(encoding.toUint8Array(encoder))
            break

          case MESSAGE_AWARENESS:
            awarenessProtocol.applyAwarenessUpdate(
              this.awareness,
              decoding.readVarUint8Array(decoder),
              server,
            )
            break
        }
      } catch {
        server.close(1003, 'bad message')
        leave()
      }
    })

    const leave = () => {
      // Withdraw this socket's presence at once, and tell the room. Without it
      // the person who just refreshed haunts the board as a second cursor until
      // y-protocols times the stale state out thirty seconds later — which is
      // exactly what a refresh looked like: two of you, then one.
      const owned = this.conns.get(server)
      this.conns.delete(server)
      if (owned && owned.size > 0) {
        awarenessProtocol.removeAwarenessStates(this.awareness, Array.from(owned), null)
      }
    }
    server.addEventListener('close', leave)
    server.addEventListener('error', leave)

    return new Response(null, { status: 101, webSocket: client })
  }
}
