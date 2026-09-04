'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { IndexeddbPersistence } from 'y-indexeddb'
import { nanoid } from 'nanoid'
import type { Item, Presence } from './types'
import { loadMe } from './identity'

/**
 * One board, held as a CRDT.
 *
 * Items live in a `Y.Map` of `Y.Map`s rather than an array of objects: two
 * people dragging the same note write to different keys of the same inner map
 * and both edits survive, where an array of whole objects would have one of them
 * overwrite the other wholesale.
 *
 * Two providers, doing different jobs. IndexedDB keeps the board on this machine,
 * so it opens instantly and survives going offline. The websocket carries it to
 * everyone else in the room. Neither knows who you are: the room id in the URL
 * is the whole of the access control, which is what "just share the link" means.
 */
export type BoardHandle = {
  doc: Y.Doc
  items: Y.Map<Y.Map<unknown>>
  meta: Y.Map<unknown>
  /** Whatever the providers are up to, for anything that needs to re-render on it. */
  subscribe: (notify: () => void) => () => void
  provider: () => WebsocketProvider | null
  awareness: () => WebsocketProvider['awareness'] | null
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:1234'

/**
 * The document is made during render and the connections in an effect.
 *
 * That split matters. A `Y.Doc` is just memory, so making one while rendering is
 * free and lets the rest of the component read the board on the very first pass
 * without a null check anywhere. Sockets are not free, and opening one during
 * render would open two under StrictMode — so they are attached on mount, and
 * anything that depends on them subscribes rather than holding them in state.
 */
export function useBoard(room: string): BoardHandle {
  const [doc] = useState(() => new Y.Doc())
  const live = useRef<{ ws: WebsocketProvider; local: IndexeddbPersistence } | null>(null)
  const listeners = useRef(new Set<() => void>())

  useEffect(() => {
    const notify = () => listeners.current.forEach((fn) => fn())
    const local = new IndexeddbPersistence(`whiteboard:${room}`, doc)
    const ws = new WebsocketProvider(WS_URL, room, doc, { connect: true })

    const me = loadMe()
    ws.awareness.setLocalStateField('user', {
      name: me.name,
      initials: me.initials,
      color: me.color,
      cursor: null,
      selection: [],
    } satisfies Presence)

    live.current = { ws, local }
    ws.on('status', notify)
    ws.awareness.on('change', notify)
    notify()

    return () => {
      ws.off('status', notify)
      ws.awareness.off('change', notify)
      ws.destroy()
      void local.destroy()
      live.current = null
      notify()
    }
  }, [doc, room])

  const subscribe = useCallback((notify: () => void) => {
    listeners.current.add(notify)
    return () => {
      listeners.current.delete(notify)
    }
  }, [])

  return useMemo(
    () => ({
      doc,
      items: doc.getMap<Y.Map<unknown>>('items'),
      meta: doc.getMap('meta'),
      subscribe,
      provider: () => live.current?.ws ?? null,
      awareness: () => live.current?.ws.awareness ?? null,
    }),
    [doc, subscribe],
  )
}

/* ------------------------------ reading it ------------------------------ */

/** Everything on the board, in painting order, re-read whenever it changes. */
export function useItems(handle: BoardHandle): Item[] {
  const cache = useRef<Item[]>([])

  const read = () => {
    const next: Item[] = []
    handle.items.forEach((entry) => next.push(entry.toJSON() as Item))
    next.sort((a, b) => a.z - b.z)
    // A fresh array every read would make `useSyncExternalStore` believe the
    // board had changed on every render and loop; only replace it when the
    // contents actually differ.
    const same =
      cache.current.length === next.length &&
      cache.current.every((item, i) => shallowSame(item, next[i]))
    if (!same) cache.current = next
    return cache.current
  }

  return useSyncExternalStore(
    (notify) => {
      handle.items.observeDeep(notify)
      return () => handle.items.unobserveDeep(notify)
    },
    read,
    () => cache.current,
  )
}

function shallowSame(a: Item, b: Item) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof Item>
  for (const key of keys) if (a[key] !== b[key]) return false
  return true
}

/** The board's title, which anybody can rename. */
export function useTitle(handle: BoardHandle): [string, (next: string) => void] {
  const title = useSyncExternalStore(
    (notify) => {
      handle.meta.observe(notify)
      return () => handle.meta.unobserve(notify)
    },
    () => (handle.meta.get('title') as string) ?? 'Untitled board',
    () => 'Untitled board',
  )
  return [title, (next: string) => handle.meta.set('title', next)]
}

/* ------------------------------ writing it ------------------------------ */

export function addItem(handle: BoardHandle, item: Omit<Item, 'id' | 'z'> & Partial<Pick<Item, 'id' | 'z'>>) {
  const id = item.id ?? nanoid(10)
  const entry = new Y.Map<unknown>()
  const z = item.z ?? nextZ(handle)
  handle.doc.transact(() => {
    Object.entries({ ...item, id, z }).forEach(([key, value]) => {
      if (value !== undefined) entry.set(key, value)
    })
    handle.items.set(id, entry)
  })
  return id
}

export function updateItem(handle: BoardHandle, id: string, patch: Partial<Item>) {
  const entry = handle.items.get(id)
  if (!entry) return
  handle.doc.transact(() => {
    Object.entries(patch).forEach(([key, value]) => {
      if (value !== undefined) entry.set(key, value)
    })
  })
}

export function removeItems(handle: BoardHandle, ids: string[]) {
  handle.doc.transact(() => ids.forEach((id) => handle.items.delete(id)))
}

export function bringToFront(handle: BoardHandle, ids: string[]) {
  let z = nextZ(handle)
  handle.doc.transact(() => {
    ids.forEach((id) => handle.items.get(id)?.set('z', z++))
  })
}

export function nextZ(handle: BoardHandle) {
  let top = 0
  handle.items.forEach((entry) => {
    top = Math.max(top, (entry.get('z') as number) ?? 0)
  })
  return top + 1
}

/** Replace the whole board — what an import does. */
export function replaceAll(handle: BoardHandle, items: Item[], title?: string) {
  handle.doc.transact(() => {
    handle.items.clear()
    items.forEach((item) => {
      const entry = new Y.Map<unknown>()
      Object.entries(item).forEach(([key, value]) => {
        if (value !== undefined) entry.set(key, value)
      })
      handle.items.set(item.id, entry)
    })
    if (title) handle.meta.set('title', title)
  })
}

/* ------------------------------- presence ------------------------------- */

/** Everyone else in the room, and where their pointer is. */
export function usePeers(handle: BoardHandle): Presence[] {
  const cache = useRef<Presence[]>([])

  const read = () => {
    const awareness = handle.awareness()
    const next: Presence[] = []
    awareness?.getStates().forEach((state, clientId) => {
      if (clientId === awareness.clientID) return
      const user = (state as { user?: Presence }).user
      if (user) next.push(user)
    })
    // Same reason as `useItems`: a fresh array every read would look like a
    // change on every render.
    const same =
      cache.current.length === next.length &&
      cache.current.every((peer, i) => samePresence(peer, next[i]))
    if (!same) cache.current = next
    return cache.current
  }

  return useSyncExternalStore(handle.subscribe, read, () => cache.current)
}

function samePresence(a: Presence, b: Presence) {
  return (
    a.name === b.name &&
    a.color === b.color &&
    a.cursor?.x === b.cursor?.x &&
    a.cursor?.y === b.cursor?.y
  )
}

/** Whether the room is actually joined, for the "Live" light. */
export function useConnected(handle: BoardHandle): boolean {
  return useSyncExternalStore(
    handle.subscribe,
    () => handle.provider()?.wsconnected ?? false,
    () => false,
  )
}

/** A stable identity for this tab, read once. */
export function useMe() {
  return useMemo(() => loadMe(), [])
}

/**
 * True only after hydration.
 *
 * Anything drawn from local storage — a name, a colour — is different on the
 * server than in the browser by definition, and rendering it on both sides is a
 * hydration mismatch. This gates the parts that are only true of this machine.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
}
