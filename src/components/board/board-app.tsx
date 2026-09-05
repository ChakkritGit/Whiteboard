'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Camera, Item, Presence, Swatch } from '@/lib/types'
import { PALETTE } from '@/lib/palette'
import { bounds, overlaps, turn } from '@/lib/geometry'
import {
  addItem,
  bringToFront,
  groupItems,
  removeItems,
  renameGroup,
  replaceAll,
  sendToBack,
  ungroup,
  updateItem,
  useBoard,
  useConnected,
  useGroups,
  useHistory,
  useItems,
  useMe,
  useMounted,
  usePeers,
  useTitle,
} from '@/lib/board'
import { saveMe, type Me } from '@/lib/identity'
import { useLang } from '@/lib/i18n'
import { BadFile, EmptyBoard, download, downloadPicture, readFile } from '@/lib/io'
import { BoardItem, type Corner } from './board-item'
import { ContextMenu, type MenuEntry } from './menu'
import {
  Cursors,
  LeftRail,
  MiniMap,
  Toast,
  ToolDock,
  TopBar,
  type ExportFormat,
  type Tool,
} from './chrome'

const MIN_ZOOM = 0.15
const MAX_ZOOM = 4
const MIN_W = 40
const MIN_H = 24

/**
 * What a new thing of each kind starts out as.
 *
 * The placeholder text is in the language of whoever made it, not of whoever
 * reads it — once typed it is board content, and content does not get
 * retranslated under the person who wrote it.
 */
const SIZES: Record<string, { w: number; h: number }> = {
  sticky: { w: 168, h: 132 },
  text: { w: 220, h: 40 },
  shape: { w: 180, h: 120 },
  frame: { w: 520, h: 380 },
}

export function BoardApp({ room }: { room: string }) {
  const board = useBoard(room)
  const items = useItems(board)
  const groups = useGroups(board)
  const peers = usePeers(board)
  const live = useConnected(board)
  const initialMe = useMe()
  const [me, setMe] = useState<Me>(initialMe)
  const mounted = useMounted()
  const [title, setTitle] = useTitle(board)
  const history = useHistory(board)
  const { lang, t } = useLang()

  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, zoom: 1 })
  const [tool, setTool] = useState<Tool>('select')
  const [color, setColor] = useState<Swatch>('yellow')
  /**
   * Whether a colour has been chosen on purpose yet.
   *
   * A sticky wants to be yellow by default and a line of text does not want to
   * be yellow under any circumstances. Until somebody picks a colour, ink-like
   * things take the neutral swatch; after that everything takes what was picked,
   * which is the only rule that does not surprise you in one direction or the
   * other.
   */
  const [tinted, setTinted] = useState(false)
  const [width, setWidth] = useState(4)
  const [weight, setWeight] = useState(600)
  const [selection, setSelection] = useState<string[]>([])
  const [editing, setEditing] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [shared, setShared] = useState(false)
  const [viewport, setViewport] = useState({ w: 1280, h: 800 })
  const [spaceHeld, setSpaceHeld] = useState(false)
  // Kept in state rather than read off the pan ref: a ref is not something
  // render may look at, and the cursor is a render.
  const [panning, setPanning] = useState(false)
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; on: string | null } | null>(null)

  const surface = useRef<HTMLDivElement>(null)
  const drag = useRef<{ ids: string[]; from: { x: number; y: number }; start: Map<string, { x: number; y: number }> } | null>(null)
  const pan = useRef<{ x: number; y: number; camera: Camera } | null>(null)
  const drawing = useRef<{ id: string; points: number[]; sent: number } | null>(null)
  const band = useRef<{ x: number; y: number; add: string[] } | null>(null)
  const erasing = useRef(false)
  const rotating = useRef<{ id: string; cx: number; cy: number; from: number; start: number } | null>(null)
  const resize = useRef<{
    id: string
    corner: Corner
    from: { x: number; y: number }
    box: { x: number; y: number; w: number; h: number }
    angle: number
    points?: number[]
  } | null>(null)
  /**
   * The stroke currently under the pen, drawn straight to the screen.
   *
   * Ink has to keep up with the hand, and it cannot if every pointer move has to
   * go into the document and come back as a re-render of the whole board — the
   * line arrived in visible steps behind the cursor. The person drawing sees this
   * local copy at the full pointer rate; the document is caught up a few times a
   * second so the room can watch the line grow, and settled exactly on release.
   */
  const [draft, setDraft] = useState<{ points: number[]; width: number; highlight: boolean; color: Swatch } | null>(null)
  /**
   * A note made by this press, waiting for the press to finish before it is put
   * into edit mode. Setting it straight away focuses the note mid-click, and the
   * pointerup that follows lands on the board and takes the focus away again —
   * which fires the editor's blur and closes it before a key can be pressed.
   */
  const pendingEdit = useRef<string | null>(null)
  /**
   * Cut and copy, kept here rather than on the system clipboard — see `copy`.
   *
   * State rather than a ref because the menu has to grey Paste out when there is
   * nothing to paste, and that is a render reading the value.
   */
  const [clipboard, setClipboard] = useState<Item[]>([])

  const byId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])
  const ink: Swatch = tinted ? color : 'slate'

  /**
   * Your own pointer, in your own colour.
   *
   * Everyone else on the board is a coloured arrow with a name on it, and you
   * were the one person still driving the operating system's plain black one —
   * so the colour that identifies you to the room was the one colour you never
   * saw. Same arrow, same colour, drawn as the cursor itself.
   *
   * `5 2` is the hotspot: the tip of the arrow in the path below, and where the
   * click actually lands.
   */
  const arrow = useMemo(() => {
    const svg =
      `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'>` +
      `<path d='M5 2l14 8.5-6.2 1.4L9.8 19 5 2Z' fill='${me.color}' stroke='white' stroke-width='1.5' stroke-linejoin='round'/>` +
      `</svg>`
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 5 2, default`
  }, [me.color])

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

  /** Put a world point in the middle of the screen, at the current zoom. */
  const centreOn = useCallback(
    (x: number, y: number) => {
      setCamera((current) => ({
        zoom: current.zoom,
        x: viewport.w / 2 - x * current.zoom,
        y: viewport.h / 2 - y * current.zoom,
      }))
    },
    [viewport],
  )

  const fit = useCallback(() => {
    if (items.length === 0) {
      setCamera({ x: 0, y: 0, zoom: 1 })
      return
    }
    const box = items.reduce(
      (acc, item) => {
        const b = bounds(item)
        return {
          minX: Math.min(acc.minX, b.x),
          minY: Math.min(acc.minY, b.y),
          maxX: Math.max(acc.maxX, b.x + b.w),
          maxY: Math.max(acc.maxY, b.y + b.h),
        }
      },
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

  /** Write a stroke's path and the box it fits in. */
  const commitStroke = useCallback(
    (id: string, points: number[]) => {
      const xs = points.filter((_, i) => i % 2 === 0)
      const ys = points.filter((_, i) => i % 2 === 1)
      updateItem(board, id, {
        points,
        x: Math.min(...xs),
        y: Math.min(...ys),
        w: Math.max(1, Math.max(...xs) - Math.min(...xs)),
        h: Math.max(1, Math.max(...ys) - Math.min(...ys)),
      })
    },
    [board],
  )

  const autoSize = useCallback(
    (id: string, height: number) => updateItem(board, id, { h: height }),
    [board],
  )

  /**
   * Tell the document which language it is actually in.
   *
   * The board is served from the English root layout — it has no locale in its
   * URL on purpose, because that URL gets shared — so the served `<html lang>`
   * is `en` whatever the reader prefers. Nothing on the landing pages does this:
   * there the layout is already right, and overwriting it from a stored
   * preference would make an English page claim to be Thai.
   */
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  // A new name has to reach the room even if the pointer never moves again.
  useEffect(() => {
    board.awareness()?.setLocalStateField('user', {
      id: me.id,
      name: me.name,
      initials: me.initials,
      color: me.color,
      cursor: null,
      selection,
    })
    // `selection` deliberately absent: it rides along on pointer moves, and
    // adding it here would re-broadcast on every click.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, me])

  /** Centre the view on one item, which is how the layer list finds things. */
  const focusOn = useCallback(
    (id: string) => {
      const item = items.find((entry) => entry.id === id)
      if (!item) return
      centreOn(item.x + item.w / 2, item.y + item.h / 2)
    },
    [items, centreOn],
  )

  /* ------------------------------- editing ------------------------------- */

  const duplicate = useCallback(
    (ids: string[], offset = 24) => {
      const copies = ids
        .map((id) => byId.get(id))
        .filter((entry): entry is Item => Boolean(entry))
        // `id` and `z` cleared rather than picked around: `addItem` mints a new
        // one of each when they are absent, which is exactly what a copy wants.
        .map((entry) =>
          addItem(board, {
            ...entry,
            id: undefined,
            z: undefined,
            x: entry.x + offset,
            y: entry.y + offset,
            points: entry.points?.map((value) => value + offset),
          }),
        )
      history.seal()
      return copies
    },
    [board, byId, history],
  )

  /**
   * Copy and cut, into a clipboard of our own.
   *
   * Not the system clipboard: a note is a dozen fields and a z-order, and the
   * moment that goes out as text somebody pastes it into a chat window. Staying
   * in the tab also means paste needs no permission prompt. The cost is that you
   * cannot paste between two boards in two tabs — export is for that.
   */
  const copy = useCallback(
    (ids: string[]) => {
      const taken = ids
        .map((id) => byId.get(id))
        .filter((entry): entry is Item => Boolean(entry))
      setClipboard(taken)
      return taken.length
    },
    [byId],
  )

  const paste = useCallback(() => {
    if (clipboard.length === 0) return
    const made = clipboard.map((entry) =>
      addItem(board, {
        ...entry,
        id: undefined,
        z: undefined,
        x: entry.x + 28,
        y: entry.y + 28,
        points: entry.points?.map((value) => value + 28),
      }),
    )
    history.seal()
    setSelection(made)
  }, [board, clipboard, history])

  const applyColor = useCallback(
    (swatch: Swatch) => {
      setColor(swatch)
      setTinted(true)
      // A frame is a boundary, not an object with a fill — it has no colour to
      // change, and pretending otherwise just makes the picker lie.
      const targets = selection.filter((id) => byId.get(id)?.kind !== 'frame')
      targets.forEach((id) => updateItem(board, id, { color: swatch }))
      if (targets.length) history.seal()
    },
    [board, byId, history, selection],
  )

  const applyWeight = useCallback(
    (next: number) => {
      setWeight(next)
      const targets = selection.filter((id) => {
        const kind = byId.get(id)?.kind
        return kind === 'text' || kind === 'sticky'
      })
      targets.forEach((id) => updateItem(board, id, { weight: next }))
      if (targets.length) history.seal()
    },
    [board, byId, history, selection],
  )

  const applyWidth = useCallback(
    (next: number) => {
      setWidth(next)
      const targets = selection.filter((id) => byId.get(id)?.kind === 'stroke')
      targets.forEach((id) => updateItem(board, id, { stroke: next }))
      if (targets.length) history.seal()
    },
    [board, byId, history, selection],
  )

  const erase = useCallback(
    (clientX: number, clientY: number) => {
      const hit = document
        .elementsFromPoint(clientX, clientY)
        .map((node) => (node as HTMLElement).closest?.('[data-item]'))
        .find(Boolean) as HTMLElement | undefined
      const id = hit?.dataset.item
      if (id && byId.get(id) && !byId.get(id)?.locked) removeItems(board, [id])
    },
    [board, byId],
  )

  /* ------------------------------ pointers ------------------------------ */

  const startPan = (event: React.PointerEvent) => {
    pan.current = { x: event.clientX, y: event.clientY, camera }
    setPanning(true)
    surface.current?.setPointerCapture(event.pointerId)
  }

  const onSurfaceDown = (event: React.PointerEvent) => {
    setMenu(null)
    // Space and the middle button are the only ways to take hold of the board
    // itself. Dragging on bare canvas used to pan, which meant the one gesture
    // everybody tries first — sweep a box round three notes — moved the view
    // instead and left the notes unselected.
    if (spaceHeld || event.button === 1) {
      startPan(event)
      return
    }
    if (event.button === 2) return

    if (tool === 'eraser') {
      erasing.current = true
      surface.current?.setPointerCapture(event.pointerId)
      erase(event.clientX, event.clientY)
      return
    }

    if (tool === 'select') {
      if (event.target !== event.currentTarget) return
      const at = toWorld(event.clientX, event.clientY)
      // Shift keeps what was already selected and adds to it.
      const add = event.shiftKey ? selection : []
      if (!event.shiftKey) {
        setSelection([])
        setEditing(null)
      }
      band.current = { x: at.x, y: at.y, add }
      setMarquee({ x: at.x, y: at.y, w: 0, h: 0 })
      surface.current?.setPointerCapture(event.pointerId)
      return
    }

    const at = toWorld(event.clientX, event.clientY)

    if (tool === 'pen' || tool === 'highlighter') {
      const stroke = tool === 'highlighter' ? Math.max(10, width * 3) : width
      const id = addItem(board, {
        kind: 'stroke',
        x: at.x,
        y: at.y,
        w: 1,
        h: 1,
        text: '',
        color: tool === 'highlighter' ? color : ink,
        points: [at.x, at.y],
        stroke,
        highlight: tool === 'highlighter',
      })
      drawing.current = { id, points: [at.x, at.y], sent: 2 }
      setDraft({
        points: [at.x, at.y],
        width: stroke,
        highlight: tool === 'highlighter',
        color: tool === 'highlighter' ? color : ink,
      })
      surface.current?.setPointerCapture(event.pointerId)
      return
    }

    const spec = SIZES[tool] ?? SIZES.sticky
    const placeholder =
      tool === 'sticky' ? t.newNote : tool === 'text' ? t.newText : tool === 'frame' ? t.newFrame : ''
    const id = addItem(board, {
      kind: tool as Item['kind'],
      x: at.x - spec.w / 2,
      y: at.y - spec.h / 2,
      w: spec.w,
      h: spec.h,
      text: placeholder,
      color: tool === 'text' ? ink : color,
      weight: tool === 'text' || tool === 'sticky' ? weight : undefined,
    })
    history.seal()
    setTool('select')
    setSelection([id])
    if (tool === 'sticky' || tool === 'text' || tool === 'frame') pendingEdit.current = id
  }

  const onSurfaceMove = (event: React.PointerEvent) => {
    const at = toWorld(event.clientX, event.clientY)
    board.awareness()?.setLocalStateField('user', {
      id: me.id,
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

    if (band.current) {
      const from = band.current
      setMarquee({
        x: Math.min(from.x, at.x),
        y: Math.min(from.y, at.y),
        w: Math.abs(at.x - from.x),
        h: Math.abs(at.y - from.y),
      })
      return
    }

    if (erasing.current) {
      erase(event.clientX, event.clientY)
      return
    }

    if (drawing.current) {
      const stroke = drawing.current
      stroke.points.push(at.x, at.y)
      setDraft((current) => (current ? { ...current, points: stroke.points.slice() } : current))

      // Caught up every twelfth point rather than on every move: the whole path
      // goes into the document each time, so at pointer rate a long stroke is
      // resent hundreds of times and the board stutters for everyone in it.
      // Counted in points rather than milliseconds because a clock is not
      // something a component may read, and the count is the thing that actually
      // decides how much there is to send.
      if (stroke.points.length - stroke.sent >= 24) {
        stroke.sent = stroke.points.length
        commitStroke(stroke.id, stroke.points)
      }
      return
    }

    if (rotating.current) {
      const spin = rotating.current
      const now = (Math.atan2(at.y - spin.cy, at.x - spin.cx) * 180) / Math.PI
      let angle = spin.from + (now - spin.start)
      // Shift snaps to the twenty-four points of the compass, which is what you
      // want whenever the answer is "straight" or "exactly forty-five".
      if (event.shiftKey) angle = Math.round(angle / 15) * 15
      updateItem(board, spin.id, { angle: ((angle % 360) + 360) % 360 })
      return
    }

    if (resize.current) {
      const grip = resize.current
      const box = grip.box
      // The pointer moves in screen axes and the note may be turned, so the drag
      // is rotated into the note's own frame before it is read as a width and a
      // height. Without this a turned note grows sideways when you pull down.
      const local = turn(at.x - grip.from.x, at.y - grip.from.y, -grip.angle)
      const west = grip.corner.includes('w')
      const east = grip.corner.includes('e')
      const north = grip.corner.includes('n')
      const south = grip.corner.includes('s')

      // Floored rather than allowed to invert: dragging a corner through the
      // opposite one would otherwise give a negative width, which lays the note
      // out backwards and puts its own grips out of reach.
      const w = Math.max(MIN_W, box.w + (east ? local.x : west ? -local.x : 0))
      const h = Math.max(MIN_H, box.h + (south ? local.y : north ? -local.y : 0))

      // The corner opposite the one being dragged stays exactly where it is, in
      // world space, however the note is turned.
      const anchor = {
        x: east ? -box.w / 2 : west ? box.w / 2 : 0,
        y: south ? -box.h / 2 : north ? box.h / 2 : 0,
      }
      const held = turn(anchor.x, anchor.y, grip.angle)
      const heldWorld = { x: box.x + box.w / 2 + held.x, y: box.y + box.h / 2 + held.y }
      const after = turn(
        east ? -w / 2 : west ? w / 2 : 0,
        south ? -h / 2 : north ? h / 2 : 0,
        grip.angle,
      )
      const x = heldWorld.x - after.x - w / 2
      const y = heldWorld.y - after.y - h / 2

      // A stroke is its path, not its box, so the path has to be stretched with
      // it or the ink stays put while the outline moves.
      const points =
        grip.points &&
        grip.points.map((value, i) =>
          i % 2 === 0
            ? x + ((value - box.x) / box.w) * w
            : y + ((value - box.y) / box.h) * h,
        )

      updateItem(board, grip.id, { w, h, x, y, points })
      return
    }

    if (drag.current) {
      const move = drag.current
      const dx = at.x - move.from.x
      const dy = at.y - move.from.y
      move.ids.forEach((id) => {
        const origin = move.start.get(id)
        if (!origin) return
        const item = byId.get(id)
        updateItem(board, id, {
          x: origin.x + dx,
          y: origin.y + dy,
          points: item?.points?.map((value, i) =>
            i % 2 === 0 ? value + (origin.x + dx - item.x) : value + (origin.y + dy - item.y),
          ),
        })
      })
    }
  }

  const onSurfaceUp = (event: React.PointerEvent) => {
    if (surface.current?.hasPointerCapture?.(event.pointerId)) {
      surface.current.releasePointerCapture(event.pointerId)
    }
    const changed = drag.current || resize.current || drawing.current || rotating.current || erasing.current

    if (band.current) {
      const from = band.current
      const at = toWorld(event.clientX, event.clientY)
      const box = {
        x: Math.min(from.x, at.x),
        y: Math.min(from.y, at.y),
        w: Math.abs(at.x - from.x),
        h: Math.abs(at.y - from.y),
      }
      // Anything the box touches, rather than only what it encloses: on a board
      // where notes are bigger than the screen, "fully contained" selects
      // nothing however carefully you drag.
      if (box.w > 2 || box.h > 2) {
        const caught = items.filter((item) => overlaps(bounds(item), box)).map((item) => item.id)
        setSelection([...new Set([...from.add, ...caught])])
      }
      band.current = null
      setMarquee(null)
    }

    pan.current = null
    setPanning(false)
    drag.current = null
    resize.current = null
    rotating.current = null
    erasing.current = false
    const finished = drawing.current
    drawing.current = null

    if (finished) {
      commitStroke(finished.id, finished.points)
      setDraft(null)
    }

    if (pendingEdit.current) {
      setEditing(pendingEdit.current)
      pendingEdit.current = null
    }
    if (changed) history.seal()
  }

  const onItemResize = (item: Item) => (corner: Corner, event: React.PointerEvent) => {
    if (item.locked) return
    resize.current = {
      id: item.id,
      corner,
      from: toWorld(event.clientX, event.clientY),
      box: { x: item.x, y: item.y, w: item.w, h: item.h },
      angle: item.angle ?? 0,
      points: item.points,
    }
    ;(event.currentTarget as Element).setPointerCapture(event.pointerId)
  }

  const onItemRotate = (item: Item) => (event: React.PointerEvent) => {
    if (item.locked) return
    const cx = item.x + item.w / 2
    const cy = item.y + item.h / 2
    const at = toWorld(event.clientX, event.clientY)
    rotating.current = {
      id: item.id,
      cx,
      cy,
      from: item.angle ?? 0,
      start: (Math.atan2(at.y - cy, at.x - cx) * 180) / Math.PI,
    }
    ;(event.currentTarget as Element).setPointerCapture(event.pointerId)
  }

  const onItemDown = (item: Item) => (event: React.PointerEvent) => {
    // Space beats everything, including whatever is under the pointer. Without
    // this, holding space and pressing on a note dragged the note — so the one
    // gesture that is meant to always mean "move the view" stopped meaning it
    // exactly where the board is busiest.
    if (spaceHeld || event.button === 1) return

    if (tool === 'eraser') {
      event.stopPropagation()
      erasing.current = true
      if (!item.locked) removeItems(board, [item.id])
      return
    }
    if (tool !== 'select' || event.button === 2) return

    event.stopPropagation()

    if (event.altKey) {
      // Copies of everything selected, made where the originals are and dragged
      // off them — so the gesture reads as pulling a duplicate out rather than
      // moving the thing you meant to keep.
      const chosen = selection.includes(item.id) ? selection : [item.id]
      const copies = duplicate(chosen, 0)
      setSelection(copies)
      setEditing(null)

      const start = new Map<string, { x: number; y: number }>()
      chosen.forEach((id, i) => {
        const from = byId.get(id)
        if (from) start.set(copies[i], { x: from.x, y: from.y })
      })
      drag.current = { ids: copies, from: toWorld(event.clientX, event.clientY), start }
      ;(event.currentTarget as Element).setPointerCapture(event.pointerId)
      return
    }

    // Picking up one member of a group picks up the group, which is the whole
    // point of having made one.
    const family = item.group
      ? items.filter((entry) => entry.group === item.group).map((entry) => entry.id)
      : [item.id]

    const ids = event.shiftKey
      ? selection.includes(item.id)
        ? selection.filter((id) => !family.includes(id))
        : [...selection, ...family]
      : family.every((id) => selection.includes(id))
        ? selection
        : family

    setSelection(ids)
    if (editing && editing !== item.id) setEditing(null)

    if (item.locked) return
    bringToFront(board, ids)

    const start = new Map<string, { x: number; y: number }>()
    ids.forEach((id) => {
      const found = byId.get(id)
      if (found && !found.locked) start.set(id, { x: found.x, y: found.y })
    })
    drag.current = { ids: [...start.keys()], from: toWorld(event.clientX, event.clientY), start }
    // Captured on the note rather than the board. Capturing on the board
    // retargets the click and double-click that follow to it as well, so a
    // double-click on a note never reached the note and it could not be opened
    // for editing. Moves still reach the board's handler by bubbling.
    ;(event.currentTarget as Element).setPointerCapture(event.pointerId)
  }

  /* ------------------------------- the menu ------------------------------ */

  const onItemMenu = (item: Item) => (event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if (!selection.includes(item.id)) setSelection([item.id])
    setMenu({ x: event.clientX, y: event.clientY, on: item.id })
  }

  const entries = useMemo((): MenuEntry[] => {
    const mod = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform) ? '⌘' : 'Ctrl '
    const chosen = selection.filter((id) => byId.has(id))
    const some = chosen.length > 0
    const group = chosen.map((id) => byId.get(id)?.group).find(Boolean)
    const allLocked = some && chosen.every((id) => byId.get(id)?.locked)

    if (!some) {
      return [
        { label: t.paste, shortcut: `${mod}V`, disabled: clipboard.length === 0, onSelect: paste },
        { label: t.selectAll, shortcut: `${mod}A`, onSelect: () => setSelection(items.map((i) => i.id)) },
        { kind: 'divider' },
        { label: t.fitToContent, onSelect: fit },
      ]
    }

    return [
      {
        label: t.cut,
        shortcut: `${mod}X`,
        onSelect: () => {
          copy(chosen)
          removeItems(board, chosen)
          history.seal()
          setSelection([])
        },
      },
      { label: t.copy, shortcut: `${mod}C`, onSelect: () => copy(chosen) },
      { label: t.paste, shortcut: `${mod}V`, disabled: clipboard.length === 0, onSelect: paste },
      { label: t.duplicate, shortcut: `${mod}D`, onSelect: () => setSelection(duplicate(chosen)) },
      { kind: 'divider' },
      { label: t.bringToFront, shortcut: ']', onSelect: () => bringToFront(board, chosen) },
      { label: t.sendToBack, shortcut: '[', onSelect: () => sendToBack(board, chosen) },
      { kind: 'divider' },
      {
        label: allLocked ? t.unlock : t.lock,
        onSelect: () => {
          chosen.forEach((id) => updateItem(board, id, { locked: !allLocked }))
          history.seal()
        },
      },
      {
        label: t.group,
        shortcut: `${mod}G`,
        // Grouping one thing is a folder with one thing in it, which is only ever
        // in the way.
        disabled: chosen.length < 2,
        onSelect: () => {
          groupItems(board, chosen, t.groupName(Object.keys(groups).length + 1))
          history.seal()
        },
      },
      {
        label: t.ungroup,
        shortcut: `⇧${mod}G`,
        disabled: !group,
        onSelect: () => {
          if (group) ungroup(board, group)
          history.seal()
        },
      },
      { kind: 'divider' },
      {
        label: t.del,
        shortcut: '⌫',
        danger: true,
        onSelect: () => {
          removeItems(board, chosen)
          history.seal()
          setSelection([])
        },
      },
    ]
  }, [board, byId, clipboard, copy, duplicate, fit, groups, history, items, paste, selection, t])

  /* ------------------------------ keyboard ------------------------------ */

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing =
        event.target instanceof HTMLElement &&
        (event.target.isContentEditable || event.target.tagName === 'INPUT')
      if (typing) {
        // Blurring alone left the note in edit mode as far as React was
        // concerned: still `contenteditable`, still ignoring anything the room
        // typed into it, until some later click happened to clear it.
        if (event.key === 'Escape') {
          ;(event.target as HTMLElement).blur()
          setEditing(null)
        }
        return
      }
      const mod = event.metaKey || event.ctrlKey
      const key = event.key.toLowerCase()

      if (event.key === 'Escape') {
        setSelection([])
        setEditing(null)
        setTool('select')
        setMenu(null)
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && selection.length) {
        event.preventDefault()
        removeItems(board, selection)
        history.seal()
        setSelection([])
      }
      if (mod && key === 'z') {
        event.preventDefault()
        if (event.shiftKey) history.redo()
        else history.undo()
        return
      }
      if (mod && key === 'a') {
        event.preventDefault()
        setSelection(items.map((item) => item.id))
        return
      }
      if (mod && key === 'c' && selection.length) {
        copy(selection)
        return
      }
      if (mod && key === 'x' && selection.length) {
        copy(selection)
        removeItems(board, selection)
        history.seal()
        setSelection([])
        return
      }
      if (mod && key === 'v') {
        paste()
        return
      }
      if (mod && key === 'd' && selection.length) {
        event.preventDefault()
        setSelection(duplicate(selection))
        return
      }
      if (mod && key === 'g' && selection.length) {
        event.preventDefault()
        const group = selection.map((id) => byId.get(id)?.group).find(Boolean)
        if (event.shiftKey) {
          if (group) ungroup(board, group)
        } else if (selection.length > 1) {
          groupItems(board, selection, t.groupName(Object.keys(groups).length + 1))
        }
        history.seal()
        return
      }
      if (!mod && event.key === ']' && selection.length) {
        bringToFront(board, selection)
        history.seal()
        return
      }
      if (!mod && event.key === '[' && selection.length) {
        sendToBack(board, selection)
        history.seal()
        return
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
      const next = shortcuts[key]
      if (next && !mod) setTool(next)
    }

    // Space is the hand. Held down it turns any drag into a pan, over a note as
    // readily as over bare board, and the cursor has to say so before the press
    // rather than after it — a grab cursor that only appears once you are already
    // dragging tells you nothing you did not know.
    const onSpaceDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return
      const typing =
        event.target instanceof HTMLElement &&
        (event.target.isContentEditable || event.target.tagName === 'INPUT')
      if (typing) return
      // Or the page scrolls under the board.
      event.preventDefault()
      setSpaceHeld(true)
    }
    const onSpaceUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') setSpaceHeld(false)
    }
    // Alt-tabbing away with space down would otherwise leave the hand stuck on.
    const onBlur = () => setSpaceHeld(false)

    window.addEventListener('keydown', onKey)
    window.addEventListener('keydown', onSpaceDown)
    window.addEventListener('keyup', onSpaceUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keydown', onSpaceDown)
      window.removeEventListener('keyup', onSpaceUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [board, byId, copy, duplicate, groups, history, items, paste, selection, t])

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

  /**
   * Export, in whichever of the four shapes was asked for.
   *
   * The picture is drawn from the items rather than captured from the screen,
   * so it takes a moment on a large board and can fail on one large enough to
   * exhaust the canvas — hence the await and the message, where the JSON path
   * needs neither.
   */
  const onExport = async (format: ExportFormat) => {
    const name = title || t.untitled
    if (format === 'json') {
      download(items, name, groups)
      return
    }
    try {
      await downloadPicture(items, name, format)
    } catch (error) {
      setToast(error instanceof EmptyBoard ? t.exportEmpty : t.exportFailed)
    }
  }

  const onImport = async (file: File) => {
    try {
      const { items: incoming, title: name, groups: folders } = await readFile(file)
      replaceAll(board, incoming, name, folders)
      setSelection([])
      setToast(t.loaded(incoming.length, file.name))
      // Fitting after the state has come back round, so it measures the new board.
      setTimeout(fit, 60)
    } catch (error) {
      if (error instanceof BadFile) {
        const said = {
          notJson: t.fileNotJson,
          notOurs: t.fileNotOurs,
          newer: t.fileNewer(error.detail ?? '?'),
          noItems: t.fileNoItems,
          damaged: t.fileDamaged,
        }[error.code]
        setToast(said)
      } else {
        setToast(t.unreadable)
      }
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

  const jumpTo = (peer: Presence) => {
    if (!peer.cursor) return
    centreOn(peer.cursor.x, peer.cursor.y)
  }

  /* ------------------------------- render ------------------------------- */

  const cursor = spaceHeld
    ? panning
      ? 'grabbing'
      : 'grab'
    : tool === 'select'
      ? // Gated on `mounted`: the colour comes from local storage, so drawing it
        // into the server's HTML would be a hydration mismatch.
        mounted
        ? arrow
        : 'default'
      : tool === 'eraser'
        ? 'default'
        : 'crosshair'

  const showType =
    tool === 'text' ||
    tool === 'sticky' ||
    selection.some((id) => {
      const kind = byId.get(id)?.kind
      return kind === 'text' || kind === 'sticky'
    })

  return (
    <main className="board-shell relative h-screen w-screen overflow-hidden">
      <TopBar
        title={title}
        onTitle={setTitle}
        live={live}
        me={me}
        peers={peers}
        zoom={camera.zoom}
        onZoom={(next) => zoomAt(next, viewport.w / 2, viewport.h / 2)}
        onFit={fit}
        history={history}
        onReset={() => setCamera({ x: 0, y: 0, zoom: 1 })}
        onExport={onExport}
        onImport={onImport}
        onShare={onShare}
        shared={shared}
        mounted={mounted}
      />

      <LeftRail
        items={items}
        groups={groups}
        people={peers}
        me={me}
        mounted={mounted}
        selection={selection}
        onRename={(name) => {
          const next: Me = {
            ...me,
            name,
            initials: name.trim().split(/\s+/).map((word) => word[0] ?? '').join('').slice(0, 2) || '?',
          }
          setMe(next)
          saveMe(next)
        }}
        onSelect={setSelection}
        onFocus={focusOn}
        onJumpTo={jumpTo}
        onRenameItem={(id, name) => updateItem(board, id, { name })}
        onRenameGroup={(id, name) => renameGroup(board, id, name)}
        onToggleLock={(id) => updateItem(board, id, { locked: !byId.get(id)?.locked })}
        onFront={(ids) => bringToFront(board, ids)}
        onBack={(ids) => sendToBack(board, ids)}
      />

      <div
        ref={surface}
        onPointerDown={onSurfaceDown}
        onPointerMove={onSurfaceMove}
        onPointerUp={onSurfaceUp}
        onPointerCancel={onSurfaceUp}
        onContextMenu={(event) => {
          event.preventDefault()
          setMenu({ x: event.clientX, y: event.clientY, on: null })
        }}
        className={`board-paper absolute inset-0 touch-none ${tool === 'eraser' && !spaceHeld ? 'cursor-eraser' : ''}`}
        style={{
          cursor: tool === 'eraser' && !spaceHeld ? undefined : cursor,
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
              onContextMenu={onItemMenu(item)}
              onDoubleClick={() => setEditing(item.id)}
              onChange={(text) => updateItem(board, item.id, { text })}
              onAutoSize={autoSize}
              onResize={
                selection.length === 1 && selection[0] === item.id && !item.locked
                  ? onItemResize(item)
                  : undefined
              }
              onRotate={
                selection.length === 1 && selection[0] === item.id && !item.locked
                  ? onItemRotate(item)
                  : undefined
              }
            />
          ))}

          {marquee && (marquee.w > 2 || marquee.h > 2) && (
            <div
              className="pointer-events-none absolute border border-accent bg-accent/10"
              style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h, zIndex: 99998 }}
            />
          )}

          {draft && draft.points.length >= 4 && (
            <svg className="pointer-events-none absolute overflow-visible" style={{ left: 0, top: 0, zIndex: 9999 }}>
              <path
                d={draft.points.reduce(
                  (path, value, i) => (i % 2 === 0 ? `${path}${i === 0 ? 'M' : 'L'}${value} ` : `${path}${value} `),
                  '',
                )}
                fill="none"
                stroke={draft.highlight ? PALETTE[draft.color].dot : PALETTE[draft.color].deep}
                strokeWidth={draft.width}
                strokeOpacity={draft.highlight ? 0.45 : 1}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>

        <Cursors peers={peers} camera={camera} />
      </div>

      <ToolDock
        tool={tool}
        onTool={setTool}
        color={color}
        onColor={applyColor}
        width={width}
        onWidth={applyWidth}
        weight={weight}
        onWeight={applyWeight}
        showType={showType}
      />
      <MiniMap items={items} camera={camera} viewport={viewport} />
      {menu && <ContextMenu at={menu} entries={entries} onClose={() => setMenu(null)} />}
      <Toast message={toast} onDone={() => setToast(null)} />
    </main>
  )
}
