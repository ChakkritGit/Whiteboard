/**
 * The room server.
 *
 * A board is a room and a room is a URL — there is no account, no database and
 * no session. This relays Yjs updates between whoever is in a room and holds the
 * document in memory while at least one person is; the copy that outlives
 * everyone leaving is the one in each browser's IndexedDB, and the file an
 * export writes.
 *
 * Written against the same `yjs` and `y-protocols` the browser uses rather than
 * a prebuilt server package. The obvious one pulled a second, different copy of
 * Yjs in beside its own and the two could not read each other's updates:
 * awareness went through, so cursors moved, while every document update died on
 * `store.getClock is not a function` and nothing anyone drew ever arrived.
 *
 *   node scripts/server.mjs        # ws://localhost:1234
 */
import { createServer } from 'node:http'
import { createReadStream } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { WebSocketServer } from 'ws'
import * as Y from 'yjs'
import * as sync from 'y-protocols/sync'
import * as awarenessProtocol from 'y-protocols/awareness'
import * as encoding from 'lib0/encoding'
import * as decoding from 'lib0/decoding'
import { EXT_TYPES, IMAGE_TYPES, KEY_RE, MAX_IMAGE_BYTES, sniff } from '../src/lib/image-rules.ts'

const MESSAGE_SYNC = 0
const MESSAGE_AWARENESS = 1

const port = Number(process.env.PORT ?? 1234)

/** One shared document per room, alive while anyone is in it. */
const rooms = new Map()

function room(name) {
  let entry = rooms.get(name)
  if (entry) return entry

  const doc = new Y.Doc()
  const awareness = new awarenessProtocol.Awareness(doc)
  awareness.setLocalState(null)
  // Socket to the awareness clients it speaks for. A set of sockets is not
  // enough: on disconnect the room has to know *whose* presence to withdraw, and
  // awareness itself does not record that — its `meta` holds a clock and a
  // timestamp and nothing about where the state came from.
  entry = { doc, awareness, conns: new Map() }

  doc.on('update', (update, origin) => {
    const message = encoding.createEncoder()
    encoding.writeVarUint(message, MESSAGE_SYNC)
    sync.writeUpdate(message, update)
    const payload = encoding.toUint8Array(message)
    entry.conns.forEach((_owned, conn) => {
      // Not back to whoever sent it: they already have it, and echoing costs a
      // round trip on every keystroke.
      if (conn !== origin) send(conn, payload)
    })
  })

  awareness.on('update', ({ added, updated, removed }, origin) => {
    // Note down which client arrived on which socket, while the origin is still
    // in hand. This is the only moment the connection and the client id are
    // known together.
    const owned = entry.conns.get(origin)
    if (owned) {
      added.forEach((client) => owned.add(client))
      removed.forEach((client) => owned.delete(client))
    }

    const changed = added.concat(updated, removed)
    const message = encoding.createEncoder()
    encoding.writeVarUint(message, MESSAGE_AWARENESS)
    encoding.writeVarUint8Array(message, awarenessProtocol.encodeAwarenessUpdate(awareness, changed))
    const payload = encoding.toUint8Array(message)
    entry.conns.forEach((_owned, conn) => {
      if (conn !== origin) send(conn, payload)
    })
  })

  rooms.set(name, entry)
  return entry
}

function send(conn, payload) {
  if (conn.readyState !== conn.OPEN) return
  try {
    conn.send(payload)
  } catch {
    conn.close()
  }
}

/**
 * Pictures live in a folder at the repo's root, not in the document: a document
 * update has to fit a socket message, a picture does not. The board holds only
 * the key.
 */
const IMAGES = fileURLToPath(new URL('../.images/', import.meta.url))
const SITES = (process.env.SITE_ORIGINS ?? 'http://localhost:3000').split(',').map((s) => s.trim())

// ponytail: per process, so a restart forgets it and two processes do not share
// it. The worker uses Cloudflare's own limiter; move this to one if this ever
// runs behind more than one instance.
const uploads = new Map()
const LIMIT = 20
const WINDOW = 10 * 60 * 1000

function limited(ip) {
  const now = Date.now()
  const recent = (uploads.get(ip) ?? []).filter((at) => now - at < WINDOW)
  recent.push(now)
  uploads.set(ip, recent)
  return recent.length > LIMIT
}

function reply(response, status, body, headers = {}) {
  response.writeHead(status, { 'content-type': 'text/plain', ...headers })
  response.end(body)
}

/** The routes beside the socket. Returns false for anything that is not one of them. */
function pictures(request, response) {
  const path = (request.url ?? '/').split('?')[0]

  if (path === '/img') {
    const origin = request.headers.origin
    const allowed = origin && SITES.includes(origin) ? { 'access-control-allow-origin': origin, vary: 'Origin' } : {}
    if (request.method === 'OPTIONS') {
      reply(response, 204, '', {
        ...allowed,
        'access-control-allow-methods': 'POST',
        'access-control-allow-headers': 'Content-Type',
      })
      return true
    }
    if (request.method !== 'POST') return false
    // A page on another site must not be able to fill our disk. Requests with no
    // Origin are not browsers, and CORS is not what stops those.
    if (origin && !allowed['access-control-allow-origin']) {
      reply(response, 403, 'origin not allowed\n')
      return true
    }
    if (limited(request.socket.remoteAddress ?? '')) {
      reply(response, 429, 'too many uploads\n', allowed)
      return true
    }
    // Refuse on the header first, then count what actually arrives: the header
    // is only a claim, and the count is what bounds the buffer.
    const claimed = Number(request.headers['content-length'] ?? 0)
    const refuse = () => {
      response.writeHead(413, { 'content-type': 'text/plain', connection: 'close', ...allowed })
      response.end('too big\n', () => request.destroy())
    }
    if (claimed > MAX_IMAGE_BYTES) {
      refuse()
      return true
    }
    const chunks = []
    let size = 0
    let over = false
    request.on('data', (chunk) => {
      if (over) return
      size += chunk.length
      if (size > MAX_IMAGE_BYTES) {
        over = true
        chunks.length = 0
        refuse()
        return
      }
      chunks.push(chunk)
    })
    request.on('end', async () => {
      if (over) return
      const bytes = Buffer.concat(chunks)
      // The type comes from the bytes, not from the header or a file name, which
      // are whatever the sender typed.
      const type = sniff(bytes)
      if (!type) {
        reply(response, 415, 'not a png, jpeg, webp or gif\n', allowed)
        return
      }
      const key = `${randomUUID()}.${IMAGE_TYPES[type]}`
      try {
        await mkdir(IMAGES, { recursive: true })
        await writeFile(IMAGES + key, bytes)
      } catch (e) {
        console.warn('image write failed', e.message)
        reply(response, 500, 'could not store\n', allowed)
        return
      }
      reply(response, 200, JSON.stringify({ key }), { ...allowed, 'content-type': 'application/json' })
    })
    request.on('error', () => {})
    return true
  }

  if (path.startsWith('/img/') && request.method === 'GET') {
    // Decoded before it is checked, so `%2e%2e` is no way round the pattern.
    let key
    try {
      key = decodeURIComponent(path.slice(5))
    } catch {
      key = ''
    }
    if (!KEY_RE.test(key)) {
      reply(response, 400, 'bad key\n')
      return true
    }
    const file = createReadStream(IMAGES + key)
    file.on('error', () => reply(response, 404, 'not found\n'))
    file.on('open', () => {
      response.writeHead(200, {
        'content-type': EXT_TYPES[key.split('.')[1]],
        'cache-control': 'public, max-age=31536000, immutable',
        'x-content-type-options': 'nosniff',
        'content-security-policy': "default-src 'none'",
        // The export draws these into a canvas, which needs CORS on the image.
        'access-control-allow-origin': '*',
      })
      file.pipe(response)
    })
    return true
  }

  return false
}

const http = createServer((request, response) => {
  if (pictures(request, response)) return
  response.writeHead(200, { 'content-type': 'text/plain' })
  response.end(`whiteboard rooms — ${rooms.size} open\n`)
})

const wss = new WebSocketServer({ server: http })

wss.on('connection', (conn, request) => {
  conn.binaryType = 'arraybuffer'
  // The URL is untrusted: a stray `%E0` makes this throw, and nothing up the
  // stack catches it, so it would take every room down with it.
  let name
  try {
    name = decodeURIComponent((request.url ?? '/').slice(1).split('?')[0]) || 'default'
  } catch {
    conn.close(1008)
    return
  }
  const here = room(name)
  here.conns.set(conn, new Set())

  // Step one of the handshake, from our side: here is what I have, tell me what
  // you have that I do not.
  const hello = encoding.createEncoder()
  encoding.writeVarUint(hello, MESSAGE_SYNC)
  sync.writeSyncStep1(hello, here.doc)
  send(conn, encoding.toUint8Array(hello))

  const states = here.awareness.getStates()
  if (states.size > 0) {
    const message = encoding.createEncoder()
    encoding.writeVarUint(message, MESSAGE_AWARENESS)
    encoding.writeVarUint8Array(
      message,
      awarenessProtocol.encodeAwarenessUpdate(here.awareness, Array.from(states.keys())),
    )
    send(conn, encoding.toUint8Array(message))
  }

  conn.on('message', (data) => {
    // Same reason: garbage bytes make the decoders throw, and one bad client
    // must not stop the process. Drop that socket; `close` below tidies up.
    try {
      const bytes = new Uint8Array(data instanceof ArrayBuffer ? data : data.buffer ?? data)
      const decoder = decoding.createDecoder(bytes)
      const encoder = encoding.createEncoder()

      switch (decoding.readVarUint(decoder)) {
        case MESSAGE_SYNC:
          encoding.writeVarUint(encoder, MESSAGE_SYNC)
          // `conn` as the origin is what stops the update being echoed back in the
          // doc's own update handler above.
          sync.readSyncMessage(decoder, encoder, here.doc, conn)
          if (encoding.length(encoder) > 1) send(conn, encoding.toUint8Array(encoder))
          break

        case MESSAGE_AWARENESS:
          awarenessProtocol.applyAwarenessUpdate(
            here.awareness,
            decoding.readVarUint8Array(decoder),
            conn,
          )
          break
      }
    } catch (e) {
      console.warn('bad message', name, e.message)
      conn.close(1003)
    }
  })

  conn.on('close', () => {
    // Withdraw this socket's presence at once, and tell the room. Without it the
    // person who just refreshed haunts the board as a second cursor until
    // y-protocols times the stale state out thirty seconds later — which is
    // exactly what a refresh looked like: two of you, then one.
    const owned = here.conns.get(conn)
    here.conns.delete(conn)
    if (owned && owned.size > 0) {
      awarenessProtocol.removeAwarenessStates(here.awareness, Array.from(owned), null)
    }
    // An empty room is thrown away: the browsers that were in it still hold the
    // board, so there is nothing here worth keeping warm.
    if (here.conns.size === 0) {
      here.doc.destroy()
      rooms.delete(name)
    }
  })
})

http.listen(port, () => {
  console.log(`rooms listening on ws://localhost:${port}`)
})
