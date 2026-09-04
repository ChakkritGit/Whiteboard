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
import { WebSocketServer } from 'ws'
import * as Y from 'yjs'
import * as sync from 'y-protocols/sync'
import * as awarenessProtocol from 'y-protocols/awareness'
import * as encoding from 'lib0/encoding'
import * as decoding from 'lib0/decoding'

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

const http = createServer((_, response) => {
  response.writeHead(200, { 'content-type': 'text/plain' })
  response.end(`whiteboard rooms — ${rooms.size} open\n`)
})

const wss = new WebSocketServer({ server: http })

wss.on('connection', (conn, request) => {
  conn.binaryType = 'arraybuffer'
  const name = decodeURIComponent((request.url ?? '/').slice(1).split('?')[0]) || 'default'
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
