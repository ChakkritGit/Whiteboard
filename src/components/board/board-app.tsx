'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Camera, Item, Swatch } from '@/lib/types'
import {
  addItem,
  bringToFront,
  removeItems,
  replaceAll,
  updateItem,
  useBoard,
  useConnected,
  useItems,
  useMe,
  useMounted,
  usePeers,
  useTitle,
} from '@/lib/board'
import { download, readFile } from '@/lib/io'
import { BoardItem } from './board-item'
import { Cursors, LeftRail, MiniMap, Toast, ToolDock, TopBar, type Tool } from './chrome'

const MIN_ZOOM = 0.15
const MAX_ZOOM = 4

/** What a new thing of each kind starts out as. */
const DEFAULTS: Record<string, { w: number; h: number; text: string }> = {
  sticky: { w: 168, h: 132, text: 'New note' },
  text: { w: 220, h: 40, text: 'Text' },
  shape: { w: 180, h: 120, text: '' },
  frame: { w: 520, h: 380, text: 'Frame' },
}

export function BoardApp({ room }: { room: string }) {
  const board = useBoard(room)
  const items = useItems(board)
  const peers = usePeers(board)
  const live = useConnected(board)
  const me = useMe()
  const mounted = useMounted()
  const [title, setTitle] = useTitle(board)

  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, zoom: 1 })
  const [tool, setTool] = useState<Tool>('select')
  const [color, setColor] = useState<Swatch>('yellow')
  const [selection, setSelection] = useState<string[]>([])
  const [editing, setEditing] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [shared, setShared] = useState(false)
  const [viewport, setViewport] = useState({ w: 1280, h: 800 })

  const surface = useRef<HTMLDivElement>(null)
  const drag = useRef<{ ids: string[]; from: { x: number; y: number }; start: Map<string, { x: number; y: number }> } | null>(null)
  const pan = useRef<{ x: number; y: number; camera: Camera } | null>(null)
  const drawing = useRef<{ id: string; points: number[] } | null>(null)
  /**
   * A note made by this press, waiting for the press to finish before it is put
   * into edit mode. Setting it straight away focuses the note mid-click, and the
   * pointerup that follows lands on the board and takes the focus away again —
   * which fires the editor's blur and closes it before a key can be pressed.
   */
  const pendingEdit = useRef<string | null>(null)

  /* ------------------------------ geometry ------------------------------ */

  const toWorld = useCallback(
    (clientX: number, clientY: number) => {
      const rect = surface.current?.getBoundingClientRect()
      const left = rect?.left ?? 0
      const top = rect?.top ?? 0
      return {
        x: (clientX - left - camera.x) / camera.zoom,
        y: (clientY - top - camera.y) / camera.zoom,
      }
    },
    [camera],
  )

  useEffect(() => {
    const measure = () => {
      const rect = surface.current?.getBoundingClientRect()
      if (rect) setViewport({ w: rect.width, h: rect.height })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  /** Zoom about a point on screen, so whatever is under the pointer stays put. */
  const zoomAt = useCallback((next: number, screenX: number, screenY: number) => {
    setCamera((current) => {
      const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next))
      const rect = surface.current?.getBoundingClientRect()
      const px = screenX - (rect?.left ?? 0)
      const py = screenY - (rect?.top ?? 0)
      const worldX = (px - current.x) / current.zoom
      const worldY = (py - current.y) / current.zoom
      return { zoom, x: px - worldX * zoom, y: py - worldY * zoom }
    })
  }, [])

  const fit = useCallback(() => {
    if (items.length === 0) {
      setCamera({ x: 0, y: 0, zoom: 1 })
      return
    }
    const box = items.reduce(
      (acc, item) => ({
        minX: Math.min(acc.minX, item.x),
        minY: Math.min(acc.minY, item.y),
        maxX: Math.max(acc.maxX, item.x + item.w),
        maxY: Math.max(acc.maxY, item.y + item.h),
      }),
      { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
    )
    const pad = 80
    const zoom = Math.min(
      MAX_ZOOM,
      Math.max(
        MIN_ZOOM,
        Math.min(
          viewport.w / Math.max(1, box.maxX - box.minX + pad * 2),
          viewport.h / Math.max(1, box.maxY - box.minY + pad * 2),
        ),
      ),
    )
    setCamera({
      zoom,
      x: viewport.w / 2 - ((box.minX + box.maxX) / 2) * zoom,
      y: viewport.h / 2 - ((box.minY + box.maxY) / 2) * zoom,
    })
  }, [items, viewport])

  /* ------------------------------ pointers ------------------------------ */

  const onSurfaceDown = (event: React.PointerEvent) => {
    if (event.button === 1 || event.altKey || tool === 'select') {
      // Middle button, alt, or an empty patch of board with the select tool:
      // this is a pan, and it also clears whatever was selected.
      if (event.target === event.currentTarget || event.button === 1) {
        pan.current = { x: event.clientX, y: event.clientY, camera }
        surface.current?.setPointerCapture(event.pointerId)
        if (event.button !== 1) {
          setSelection([])
          setEditing(null)
        }
      }
      return
    }

    const at = toWorld(event.clientX, event.clientY)

    if (tool === 'pen' || tool === 'highlighter') {
      const id = addItem(board, {
        kind: 'stroke',
        x: at.x,
        y: at.y,
        w: 1,
        h: 1,
        text: '',
        color,
        points: [at.x, at.y],
        stroke: tool === 'highlighter' ? 14 : 3,
        highlight: tool === 'highlighter',
      })
      drawing.current = { id, points: [at.x, at.y] }
      surface.current?.setPointerCapture(event.pointerId)
      return
    }

    if (tool === 'eraser') return

    const spec = DEFAULTS[tool] ?? DEFAULTS.sticky
    const id = addItem(board, {
      kind: tool as Item['kind'],
      x: at.x - spec.w / 2,
      y: at.y - spec.h / 2,
      w: spec.w,
      h: spec.h,
      text: spec.text,
      color,
    })
    setTool('select')
    setSelection([id])
    if (tool === 'sticky' || tool === 'text') pendingEdit.current = id
  }

  const onSurfaceMove = (event: React.PointerEvent) => {
    const at = toWorld(event.clientX, event.clientY)
    board.awareness()?.setLocalStateField('user', {
      name: me.name,
      initials: me.initials,
      color: me.color,
      cursor: at,
      selection,
    })

    if (pan.current) {
      const base = pan.current
      setCamera({
        zoom: base.camera.zoom,
        x: base.camera.x + (event.clientX - base.x),
        y: base.camera.y + (event.clientY - base.y),
      })
      return
    }

    if (drawing.current) {
      const stroke = drawing.current
      stroke.points.push(at.x, at.y)
      const xs = stroke.points.filter((_, i) => i % 2 === 0)
      const ys = stroke.points.filter((_, i) => i % 2 === 1)
      updateItem(board, stroke.id, {
        points: stroke.points,
        x: Math.min(...xs),
        y: Math.min(...ys),
        w: Math.max(1, Math.max(...xs) - Math.min(...xs)),
        h: Math.max(1, Math.max(...ys) - Math.min(...ys)),
      })
      return
    }

    if (drag.current) {
      const move = drag.current
      const dx = at.x - move.from.x
      const dy = at.y - move.from.y
      move.ids.forEach((id) => {
        const origin = move.start.get(id)
        if (origin) updateItem(board, id, { x: origin.x + dx, y: origin.y + dy })
      })
    }
  }

  const onSurfaceUp = (event: React.PointerEvent) => {
    if (surface.current?.hasPointerCapture?.(event.pointerId)) {
      surface.current.releasePointerCapture(event.pointerId)
    }
    pan.current = null
    drag.current = null
    drawing.current = null

    if (pendingEdit.current) {
      setEditing(pendingEdit.current)
      pendingEdit.current = null
    }
  }

  const onItemDown = (item: Item) => (event: React.PointerEvent) => {
    if (tool === 'eraser') {
      event.stopPropagation()
      removeItems(board, [item.id])
      return
    }
    if (tool !== 'select') return

    event.stopPropagation()
    const ids = event.shiftKey
      ? selection.includes(item.id)
        ? selection.filter((id) => id !== item.id)
        : [...selection, item.id]
      : selection.includes(item.id)
        ? selection
        : [item.id]

    setSelection(ids)
    if (editing && editing !== item.id) setEditing(null)
    bringToFront(board, ids)

    const start = new Map<string, { x: number; y: number }>()
    ids.forEach((id) => {
      const found = items.find((entry) => entry.id === id)
      if (found) start.set(id, { x: found.x, y: found.y })
    })
    drag.current = { ids, from: toWorld(event.clientX, event.clientY), start }
    // Captured on the note rather than the board. Capturing on the board
    // retargets the click and double-click that follow to it as well, so a
    // double-click on a note never reached the note and it could not be opened
    // for editing. Moves still reach the board's handler by bubbling.
    ;(event.currentTarget as Element).setPointerCapture(event.pointerId)
  }

  /* ------------------------------ keyboard ------------------------------ */

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing =
        event.target instanceof HTMLElement &&
        (event.target.isContentEditable || event.target.tagName === 'INPUT')
      if (typing) {
        if (event.key === 'Escape') (event.target as HTMLElement).blur()
        return
      }

      if (event.key === 'Escape') {
        setSelection([])
        setEditing(null)
        setTool('select')
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && selection.length) {
        event.preventDefault()
        removeItems(board, selection)
        setSelection([])
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') {
        event.preventDefault()
        setSelection(items.map((item) => item.id))
      }
      const shortcuts: Record<string, Tool> = {
        v: 'select',
        p: 'pen',
        h: 'highlighter',
        e: 'eraser',
        r: 'shape',
        n: 'sticky',
        t: 'text',
        f: 'frame',
      }
      const next = shortcuts[event.key.toLowerCase()]
      if (next && !event.metaKey && !event.ctrlKey) setTool(next)
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [board, items, selection])

  /* -------------------------------- wheel -------------------------------- */

  useEffect(() => {
    const node = surface.current
    if (!node) return
    // Registered here rather than as a React prop so it can be non-passive:
    // a passive listener cannot stop the browser zooming the whole page.
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      if (event.ctrlKey || event.metaKey) {
        zoomAt(camera.zoom * (1 - event.deltaY * 0.01), event.clientX, event.clientY)
      } else {
        setCamera((current) => ({ ...current, x: current.x - event.deltaX, y: current.y - event.deltaY }))
      }
    }
    node.addEventListener('wheel', onWheel, { passive: false })
    return () => node.removeEventListener('wheel', onWheel)
  }, [camera.zoom, zoomAt])

  /* ------------------------------ the file ------------------------------ */

  const onImport = async (file: File) => {
    try {
      const { items: incoming, title: name } = await readFile(file)
      replaceAll(board, incoming, name)
      setSelection([])
      setToast(`Loaded ${incoming.length} items from ${file.name}`)
      // Fitting after the state has come back round, so it measures the new board.
      setTimeout(fit, 60)
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'That file could not be read.')
    }
  }

  const onShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setShared(true)
      setTimeout(() => setShared(false), 2000)
    } catch {
      setToast(window.location.href)
    }
  }

  /* ------------------------------- render ------------------------------- */

  const cursor =
    tool === 'select' ? 'default' : tool === 'eraser' ? 'not-allowed' : 'crosshair'

  return (
    <main className="relative h-screen w-screen overflow-hidden">
      <TopBar
        title={title}
        onTitle={setTitle}
        live={live}
        me={me}
        peers={peers}
        zoom={camera.zoom}
        onZoom={(next) => zoomAt(next, viewport.w / 2, viewport.h / 2)}
        onFit={fit}
        onExport={() => download(items, title)}
        onImport={onImport}
        onShare={onShare}
        shared={shared}
        mounted={mounted}
      />

      <LeftRail count={items.length} people={peers.length + 1} />

      <div
        ref={surface}
        onPointerDown={onSurfaceDown}
        onPointerMove={onSurfaceMove}
        onPointerUp={onSurfaceUp}
        onPointerCancel={onSurfaceUp}
        className="board-paper absolute inset-0 touch-none"
        style={{
          cursor,
          backgroundSize: `${24 * camera.zoom}px ${24 * camera.zoom}px, ${120 * camera.zoom}px ${120 * camera.zoom}px`,
          backgroundPosition: `${camera.x}px ${camera.y}px, ${camera.x}px ${camera.y}px`,
        }}
      >
        <div
          className="absolute top-0 left-0 origin-top-left"
          style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})` }}
        >
          {items.map((item) => (
            <BoardItem
              key={item.id}
              item={item}
              selected={selection.includes(item.id)}
              editing={editing === item.id}
              onPointerDown={onItemDown(item)}
              onDoubleClick={() => setEditing(item.id)}
              onChange={(text) => updateItem(board, item.id, { text })}
            />
          ))}
        </div>

        <Cursors peers={peers} camera={camera} />
      </div>

      <ToolDock tool={tool} onTool={setTool} color={color} onColor={setColor} />
      <MiniMap items={items} camera={camera} viewport={viewport} />
      <Toast message={toast} onDone={() => setToast(null)} />
    </main>
  )
}
