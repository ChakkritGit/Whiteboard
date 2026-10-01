'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Camera, Item, Presence, Swatch } from '@/lib/types'
import { PALETTE } from '@/lib/palette'
import { bounds, connectorEnds, overlaps, turn, type Box } from '@/lib/geometry'
import {
  addItem,
  bringToFront,
  groupItems,
  placeTemplate,
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
import { inkPath } from '@/lib/ink'
import { TEMPLATES, type TemplateId } from '@/lib/templates'
import { ACCEPT, budgetLeft } from '@/lib/image-rules'
import { UploadError, pictureFromFile } from '@/lib/upload'
import { BoardItem, type Corner } from './board-item'
import { Guide } from '../guide/globe'
import { Welcome } from './welcome'
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

/** The box a connector's two ends fit in. */
const span = ([x1, y1, x2, y2]: [number, number, number, number]) => ({
  x: Math.min(x1, x2),
  y: Math.min(y1, y2),
  w: Math.max(1, Math.abs(x2 - x1)),
  h: Math.max(1, Math.abs(y2 - y1)),
})

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
  ellipse: { w: 180, h: 120 },
  diamond: { w: 180, h: 120 },
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
  /** Pictures on their way up. Local only: the document gets the item once the file is stored. */
  const [uploading, setUploading] = useState<{ id: string; x: number; y: number; name: string }[]>([])

  const surface = useRef<HTMLDivElement>(null)
  const picker = useRef<HTMLInputElement>(null)
  const importer = useRef<HTMLInputElement>(null)
  const [templates, setTemplates] = useState(false)
  const [guide, setGuide] = useState(false)
  const drag = useRef<{ ids: string[]; from: { x: number; y: number }; start: Map<string, { x: number; y: number }> } | null>(null)
  const pan = useRef<{ x: number; y: number; camera: Camera } | null>(null)
  const drawing = useRef<{ id: string; points: number[]; pressure: number[]; real: boolean; sent: number } | null>(null)
  const band = useRef<{ x: number; y: number; add: string[] } | null>(null)
  const erasing = useRef(false)
  /** A line or arrow being dragged out: where it started, and what it started on. */
  const linking = useRef<{ x: number; y: number; from?: string } | null>(null)
  /** A connector's end grip being dragged, and whether it has actually moved yet. */
  const regrip = useRef<{ id: string; end: 'start' | 'end'; moved: boolean } | null>(null)
  const rotating = useRef<{ id: string; cx: number; cy: number; from: number; start: number } | null>(null)
  const resize = useRef<{
    id: string
    corner: Corner
    from: { x: number; y: number }
    box: { x: number; y: number; w: number; h: number }
    angle: number
    points?: number[]
    /** A picture's width over its height, which the grips must not change. */
    aspect?: number
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
  /** The line being dragged out, and the item it would bind to if let go now. */
  const [link, setLink] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const [draft, setDraft] = useState<{ points: number[]; pressure?: number[]; width: number; highlight: boolean; color: Swatch } | null>(null)
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
  /** What a connector can bind to: anything that is not itself a connector. */
  const solid = useMemo(
    () => new Map(items.filter((i) => i.kind !== 'connector').map((i) => [i.id, i as Box])),
    [items],
  )
  // Read by gesture code that must not change identity every time the items do.
  const latest = useRef({ items, solid })
  useEffect(() => {
    latest.current = { items, solid }
  })

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
    // Screen pixels kept clear on every side (the box is centred), so the
    // floating cards at the top and left and the dock at the bottom never cover it.
    const marginX = 96
    const marginY = 110
    const zoom = Math.min(
      MAX_ZOOM,
      Math.max(
        MIN_ZOOM,
        Math.min(
          (viewport.w - marginX * 2) / Math.max(1, box.maxX - box.minX),
          (viewport.h - marginY * 2) / Math.max(1, box.maxY - box.minY),
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
    (id: string, points: number[], pressure?: number[]) => {
      const xs = points.filter((_, i) => i % 2 === 0)
      const ys = points.filter((_, i) => i % 2 === 1)
      updateItem(board, id, {
        points,
        ...(pressure && { pressure }),
        x: Math.min(...xs),
        y: Math.min(...ys),
        w: Math.max(1, Math.max(...xs) - Math.min(...xs)),
        h: Math.max(1, Math.max(...ys) - Math.min(...ys)),
      })
    },
    [board],
  )

  /** Write a connector's ends, and the box they fit in. */
  const commitEnds = useCallback(
    (id: string, ends: [number, number, number, number], clear: (keyof Item)[] = []) =>
      updateItem(board, id, { points: ends, ...span(ends) }, clear),
    [board],
  )

  /**
   * Move every connector bound to one of these items to match, in the same
   * gesture as the move, so one undo takes back both. The moved boxes are passed
   * in rather than read back, because the document has not caught up with them
   * yet.
   */
  const follow = useCallback(
    (moved: Map<string, Box>) => {
      const { items: all, solid: boxes } = latest.current
      for (const c of all) {
        if (c.kind !== 'connector') continue
        if (!(c.from && moved.has(c.from)) && !(c.to && moved.has(c.to))) continue
        const pair = new Map<string, Box>()
        for (const id of [c.from, c.to]) {
          const box = id ? (moved.get(id) ?? boxes.get(id)) : undefined
          if (id && box) pair.set(id, box)
        }
        commitEnds(c.id, connectorEnds(c, pair))
      }
    },
    [commitEnds],
  )

  const autoSize = useCallback(
    (id: string, height: number) => {
      updateItem(board, id, { h: height })
      const box = latest.current.solid.get(id)
      if (box) follow(new Map([[id, { ...box, h: height }]]))
    },
    [board, follow],
  )

  /**
   * The item a line would bind to at this point on screen, if any. Found the way
   * the eraser finds things. Frames and strokes are left out: starting an arrow
   * on empty ground inside a frame would otherwise pin it to the frame.
   */
  const bindTarget = (clientX: number, clientY: number) => {
    for (const node of document.elementsFromPoint(clientX, clientY)) {
      const id = (node as HTMLElement).closest?.<HTMLElement>('[data-item]')?.dataset.item
      const kind = id ? byId.get(id)?.kind : undefined
      if (id && kind && kind !== 'connector' && kind !== 'frame' && kind !== 'stroke') return id
    }
    return undefined
  }

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
            // A copy of a connector is not bound to the originals it was drawn between.
            from: undefined,
            to: undefined,
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
        from: undefined,
        to: undefined,
      }),
    )
    history.seal()
    setSelection(made)
  }, [board, clipboard, history])

  /** The middle of what is on screen, in board units, nudged so a batch does not stack. */
  const centre = useCallback(
    (nudge = 0) => ({
      x: (viewport.w / 2 - camera.x) / camera.zoom + nudge * 24,
      y: (viewport.h / 2 - camera.y) / camera.zoom + nudge * 24,
    }),
    [camera, viewport],
  )

  /**
   * Shrink a picture and put it on the board, centred on a point.
   *
   * Nothing goes into the document until the picture is ready and fits the
   * board's budget. A card stands in meanwhile, in this tab only, since
   * shrinking can take a moment on a phone.
   */
  const place = useCallback(
    async (file: File, at: { x: number; y: number }) => {
      const token = crypto.randomUUID()
      setUploading((now) => [...now, { id: token, x: at.x, y: at.y, name: file.name }])
      try {
        const { src, aspect, width } = await pictureFromFile(file)
        // Read at this moment, after the shrink: a drop of several files must not
        // each see the same budget. The whole doc reaches a joining client in one
        // message of at most 1MB, so the pictures on a board share it.
        if (budgetLeft(latest.current.items) < src.length) throw new UploadError('boardFull')
        const w = Math.min(480, Math.max(MIN_W, width))
        const h = w / aspect
        const id = addItem(board, { kind: 'image', src, aspect, x: at.x - w / 2, y: at.y - h / 2, w, h, text: '', color: 'slate' })
        history.seal()
        setSelection([id])
      } catch (error) {
        const said = {
          tooBig: t.imgTooBig,
          wrongType: t.imgWrongType,
          boardFull: t.imgBoardFull,
        }
        setToast(error instanceof UploadError ? said[error.code] : t.imgWrongType)
      } finally {
        setUploading((now) => now.filter((entry) => entry.id !== token))
      }
    },
    [board, history, t],
  )

  /** A tool button or its key. The picture tool is a file picker, not a mode. */
  /** Drop a template at the middle of the view, as one undo step, and select it. */
  const addTemplate = (id: TemplateId, name: string) => {
    const tpl = TEMPLATES.find((entry) => entry.id === id)
    if (!tpl) return
    const words = Object.fromEntries(Object.entries(t).filter(([, v]) => typeof v === 'string')) as Record<string, string>
    const made = placeTemplate(board, tpl.build(words, centre()), name)
    history.seal()
    setSelection(made)
  }

  const choose = (next: Tool) => {
    if (next === 'image') picker.current?.click()
    else setTool(next)
  }

  const applyColor = useCallback(
    (swatch: Swatch) => {
      setColor(swatch)
      setTinted(true)
      // A frame is a boundary, not an object with a fill — it has no colour to
      // change, and pretending otherwise just makes the picker lie. Nor has a picture.
      const targets = selection.filter((id) => byId.get(id)?.kind !== 'frame' && byId.get(id)?.kind !== 'image')
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
      // A palm resting on the glass while the pencil writes must not start a
      // second stroke.
      if (drawing.current && event.pointerType === 'touch') return
      // Pressure is only kept from a pen: a mouse reports a constant, and a
      // stroke without any is drawn with simulated pressure instead.
      const real = event.pointerType === 'pen'
      const first = real ? [event.pressure] : []
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
      drawing.current = { id, points: [at.x, at.y], pressure: first, real, sent: 2 }
      setDraft({
        points: [at.x, at.y],
        pressure: real ? first : undefined,
        width: stroke,
        highlight: tool === 'highlighter',
        color: tool === 'highlighter' ? color : ink,
      })
      surface.current?.setPointerCapture(event.pointerId)
      return
    }

    if (tool === 'line' || tool === 'arrow') {
      const from = bindTarget(event.clientX, event.clientY)
      linking.current = { x: at.x, y: at.y, from }
      setLink({ x1: at.x, y1: at.y, x2: at.x, y2: at.y })
      setOver(from ?? null)
      surface.current?.setPointerCapture(event.pointerId)
      return
    }

    const spec = SIZES[tool] ?? SIZES.sticky
    const placeholder =
      tool === 'sticky' ? t.newNote : tool === 'text' ? t.newText : tool === 'frame' ? t.newFrame : ''
    const round = tool === 'ellipse' || tool === 'diamond'
    const id = addItem(board, {
      kind: round ? 'shape' : (tool as Item['kind']),
      shape: round ? tool : undefined,
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

    if (linking.current) {
      setLink((current) => current && { ...current, x2: at.x, y2: at.y })
      setOver(bindTarget(event.clientX, event.clientY) ?? null)
      return
    }

    if (regrip.current) {
      const grip = regrip.current
      const conn = byId.get(grip.id)
      if (conn?.points) {
        grip.moved = true
        // The end being dragged is free for as long as it is in the hand; it is
        // bound again on release, if it was let go over something.
        const start = grip.end === 'start'
        const points = conn.points.slice()
        points[start ? 0 : 2] = at.x
        points[start ? 1 : 3] = at.y
        const ends = connectorEnds(
          { from: start ? undefined : conn.from, to: start ? conn.to : undefined, points },
          solid,
        )
        commitEnds(grip.id, ends, [start ? 'from' : 'to'])
      }
      setOver(bindTarget(event.clientX, event.clientY) ?? null)
      return
    }

    if (drawing.current) {
      const stroke = drawing.current
      // Every sample the pencil took since the last move, not just the one the
      // browser chose to deliver: it reports about 240Hz against 60Hz of moves.
      const coalesced = event.nativeEvent.getCoalescedEvents?.()
      for (const sample of coalesced?.length ? coalesced : [event.nativeEvent]) {
        const p = toWorld(sample.clientX, sample.clientY)
        stroke.points.push(p.x, p.y)
        if (stroke.real) stroke.pressure.push(sample.pressure)
      }
      setDraft((current) =>
        current
          ? { ...current, points: stroke.points.slice(), pressure: stroke.real ? stroke.pressure.slice() : undefined }
          : current,
      )

      // Caught up every twelfth point rather than on every move: the whole path
      // goes into the document each time, so at pointer rate a long stroke is
      // resent hundreds of times and the board stutters for everyone in it.
      // Counted in points rather than milliseconds because a clock is not
      // something a component may read, and the count is the thing that actually
      // decides how much there is to send.
      if (stroke.points.length - stroke.sent >= 24) {
        stroke.sent = stroke.points.length
        commitStroke(stroke.id, stroke.points, stroke.real ? stroke.pressure : undefined)
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
      const turned = ((angle % 360) + 360) % 360
      updateItem(board, spin.id, { angle: turned })
      const box = solid.get(spin.id)
      if (box) follow(new Map([[spin.id, { ...box, angle: turned }]]))
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
      let w = Math.max(MIN_W, box.w + (east ? local.x : west ? -local.x : 0))
      let h = Math.max(MIN_H, box.h + (south ? local.y : north ? -local.y : 0))
      if (grip.aspect) {
        // A picture keeps its shape. The width leads, except on the top and
        // bottom grips where the height does; both floors still hold.
        if (grip.corner === 'n' || grip.corner === 's') w = Math.max(MIN_W, h * grip.aspect)
        w = Math.max(w, MIN_H * grip.aspect)
        h = w / grip.aspect
      }

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
      const sized = solid.get(grip.id)
      if (sized) follow(new Map([[grip.id, { ...sized, x, y, w, h }]]))
      return
    }

    if (drag.current) {
      const move = drag.current
      const dx = at.x - move.from.x
      const dy = at.y - move.from.y
      const moved = new Map<string, Box>()
      move.ids.forEach((id) => {
        const origin = move.start.get(id)
        if (!origin) return
        const item = byId.get(id)
        const box = solid.get(id)
        if (box) moved.set(id, { ...box, x: origin.x + dx, y: origin.y + dy })
        updateItem(board, id, {
          x: origin.x + dx,
          y: origin.y + dy,
          points: item?.points?.map((value, i) =>
            i % 2 === 0 ? value + (origin.x + dx - item.x) : value + (origin.y + dy - item.y),
          ),
        })
      })
      follow(moved)
    }
  }

  const onSurfaceUp = (event: React.PointerEvent) => {
    if (surface.current?.hasPointerCapture?.(event.pointerId)) {
      surface.current.releasePointerCapture(event.pointerId)
    }
    const changed =
      drag.current || resize.current || drawing.current || rotating.current || erasing.current || linking.current || regrip.current

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

    const line = linking.current
    linking.current = null
    if (line) {
      const at = toWorld(event.clientX, event.clientY)
      const to = bindTarget(event.clientX, event.clientY)
      setLink(null)
      setOver(null)
      // A click, or a line that starts and ends on the one item, makes nothing.
      const looped = Boolean(line.from) && line.from === to
      if (!looped && (Math.hypot(at.x - line.x, at.y - line.y) >= 6 || line.from || to)) {
        const ends = connectorEnds({ from: line.from, to, points: [line.x, line.y, at.x, at.y] }, solid)
        const id = addItem(board, {
          kind: 'connector',
          points: ends,
          from: line.from,
          to,
          head: tool === 'arrow' ? 'end' : 'none',
          color: ink,
          text: '',
          ...span(ends),
        })
        setTool('select')
        setSelection([id])
      }
    }

    const grip = regrip.current
    regrip.current = null
    const conn = grip && byId.get(grip.id)
    if (grip?.moved && conn) {
      const target = bindTarget(event.clientX, event.clientY)
      const start = grip.end === 'start'
      const other = start ? conn.to : conn.from
      const bound = target && target !== other ? target : undefined
      const from = start ? bound : conn.from
      const to = start ? conn.to : bound
      const clear: (keyof Item)[] = []
      if (!from) clear.push('from')
      if (!to) clear.push('to')
      updateItem(board, conn.id, { from, to }, clear)
      commitEnds(conn.id, connectorEnds({ from, to, points: conn.points }, solid), clear)
      setOver(null)
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
      commitStroke(finished.id, finished.points, finished.real ? finished.pressure : undefined)
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
      aspect: item.kind === 'image' && item.aspect && item.aspect > 0 ? item.aspect : undefined,
    }
    ;(event.currentTarget as Element).setPointerCapture(event.pointerId)
  }

  const onEndGrip = (item: Item) => (end: 'start' | 'end', event: React.PointerEvent) => {
    if (item.locked) return
    regrip.current = { id: item.id, end, moved: false }
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
      // A connector tied to something is moved by what it is tied to, not by hand.
      const tied = found?.kind === 'connector' && Boolean((found.from && solid.has(found.from)) || (found.to && solid.has(found.to)))
      if (found && !found.locked && !tied) start.set(id, { x: found.x, y: found.y })
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
      // Cmd+V is not handled here: the `paste` event below sees what is on the
      // system clipboard, and a picture there must not also paste our own copy.
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
        o: 'ellipse',
        d: 'diamond',
        l: 'line',
        a: 'arrow',
        i: 'image',
      }
      const next = shortcuts[key]
      if (next && !mod) {
        if (next === 'image') picker.current?.click()
        else setTool(next)
      }
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
  }, [board, byId, copy, duplicate, groups, history, items, selection, t])

  // A picture on the system clipboard is uploaded; otherwise this is the board's
  // own paste. Never both: the picture wins and the event is stopped.
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const typing =
        event.target instanceof HTMLElement &&
        (event.target.isContentEditable || event.target.tagName === 'INPUT')
      if (typing) return
      const pictures = Array.from(event.clipboardData?.files ?? []).filter((file) => file.type.startsWith('image/'))
      if (pictures.length) {
        event.preventDefault()
        pictures.forEach((file, i) => void place(file, centre(i)))
        return
      }
      paste()
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [centre, paste, place])

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
      // A local board is fine at any size; the warning is about sharing it.
      setToast(budgetLeft(incoming) < 0 ? t.bigBoard : t.loaded(incoming.length, file.name))
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
        onImport={() => importer.current?.click()}
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
        // Cancelled for any file, or the browser opens a dropped file in place of the board.
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes('Files')) event.preventDefault()
        }}
        onDrop={(event) => {
          if (!event.dataTransfer.files.length) return
          event.preventDefault()
          const at = toWorld(event.clientX, event.clientY)
          Array.from(event.dataTransfer.files).forEach((file, i) => void place(file, { x: at.x + i * 24, y: at.y + i * 24 }))
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
              ends={item.kind === 'connector' ? connectorEnds(item, solid) : undefined}
              onEndDown={
                selection.length === 1 && selection[0] === item.id && !item.locked
                  ? onEndGrip(item)
                  : undefined
              }
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

          {uploading.map((entry) => (
            <div
              key={entry.id}
              className="upload-card pointer-events-none absolute grid place-items-center rounded-sm"
              style={{ left: entry.x - 100, top: entry.y - 60, width: 200, height: 120, zIndex: 99996 }}
            >
              <span className="max-w-[90%] truncate rounded-sm bg-panel px-2 py-0.5 text-xs font-semibold">
                {t.uploading} {entry.name}
              </span>
            </div>
          ))}

          {marquee && (marquee.w > 2 || marquee.h > 2) && (
            <div
              className="pointer-events-none absolute border border-accent bg-accent/10"
              style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h, zIndex: 99998 }}
            />
          )}

          {over && byId.get(over) && (
            <div
              className="pointer-events-none absolute rounded outline-2 outline-offset-2 outline-accent"
              style={{ ...bounds(byId.get(over) as Item), zIndex: 99997 }}
            />
          )}

          {link && (
            <svg className="pointer-events-none absolute overflow-visible" style={{ left: 0, top: 0, zIndex: 9999 }}>
              <line
                x1={link.x1}
                y1={link.y1}
                x2={link.x2}
                y2={link.y2}
                stroke="var(--color-accent)"
                strokeWidth={2}
                strokeDasharray="6 5"
                strokeLinecap="round"
              />
            </svg>
          )}

          {draft && draft.points.length >= 2 && (
            <svg className="pointer-events-none absolute overflow-visible" style={{ left: 0, top: 0, zIndex: 9999 }}>
              <path
                d={inkPath(draft.points, draft.pressure, draft.width, draft.highlight)}
                fill={draft.highlight ? PALETTE[draft.color].dot : PALETTE[draft.color].deep}
                fillOpacity={draft.highlight ? 0.45 : 1}
              />
            </svg>
          )}
        </div>

        <Cursors peers={peers} camera={camera} />
      </div>

      <ToolDock
        tool={tool}
        onTool={choose}
        color={color}
        onColor={applyColor}
        width={width}
        onWidth={applyWidth}
        weight={weight}
        onWeight={applyWeight}
        showType={showType}
        onTemplate={addTemplate}
        templates={templates}
        onTemplates={setTemplates}
      />
      <input
        ref={importer}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => {
          const chosen = event.target.files?.[0]
          if (chosen) void onImport(chosen)
          // Cleared so choosing the same file twice fires again.
          event.target.value = ''
        }}
      />
      <Welcome
        empty={items.length === 0}
        onTemplates={() => setTemplates(true)}
        onGuide={() => setGuide(true)}
        onFile={() => importer.current?.click()}
      />
      <input
        ref={picker}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(event) => {
          Array.from(event.target.files ?? []).forEach((file, i) => void place(file, centre(i)))
          // Cleared so choosing the same file twice fires again.
          event.target.value = ''
        }}
      />
      <MiniMap items={items} camera={camera} viewport={viewport} />
      <Guide board={board} items={items} camera={camera} viewport={viewport} history={history} select={setSelection} open={guide} onOpen={setGuide} />
      {menu && <ContextMenu at={menu} entries={entries} onClose={() => setMenu(null)} />}
      <Toast message={toast} onDone={() => setToast(null)} />
    </main>
  )
}
