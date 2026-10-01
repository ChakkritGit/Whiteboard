'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Item } from '@/lib/types'
import { PALETTE } from '@/lib/palette'
import { FRAME_DASH, SKETCH, linePaths, seedOf, shapePaths, type SketchKind, type SketchShape } from '@/lib/sketch'
import { inkPath } from '@/lib/ink'
import { useLang } from '@/lib/i18n'
import { isPictureSrc } from '@/lib/image-rules'

/**
 * One thing on the board.
 *
 * Every kind is a positioned div rather than something painted into a canvas,
 * so the text inside a note is real text: selectable, editable in place, and
 * legible to a screen reader without a parallel accessibility tree being
 * invented for it.
 */
export type Corner = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

const GRIPS: { id: Corner; at: string; cursor: string }[] = [
  { id: 'nw', at: '-top-1.5 -left-1.5', cursor: 'nwse-resize' },
  { id: 'n', at: '-top-1.5 left-1/2 -translate-x-1/2', cursor: 'ns-resize' },
  { id: 'ne', at: '-top-1.5 -right-1.5', cursor: 'nesw-resize' },
  { id: 'e', at: 'top-1/2 -right-1.5 -translate-y-1/2', cursor: 'ew-resize' },
  { id: 'se', at: '-bottom-1.5 -right-1.5', cursor: 'nwse-resize' },
  { id: 's', at: '-bottom-1.5 left-1/2 -translate-x-1/2', cursor: 'ns-resize' },
  { id: 'sw', at: '-bottom-1.5 -left-1.5', cursor: 'nesw-resize' },
  { id: 'w', at: 'top-1/2 -left-1.5 -translate-y-1/2', cursor: 'ew-resize' },
]

/**
 * The grips, drawn only when one thing is selected.
 *
 * Eight rather than four, because a note is a box and dragging an edge to make
 * it wider without also making it taller is the commonest thing you want from
 * one. The ninth, above the top edge, turns it.
 */
function Handles({
  onResize,
  onRotate,
}: {
  onResize: (corner: Corner, event: React.PointerEvent) => void
  onRotate?: (event: React.PointerEvent) => void
}) {
  const { t } = useLang()
  return (
    <>
      {onRotate && (
        <span
          role="presentation"
          title={t.rotate}
          onPointerDown={(event) => {
            event.stopPropagation()
            onRotate(event)
          }}
          className="absolute -top-8 left-1/2 grid size-5 -translate-x-1/2 cursor-grab place-items-center rounded-full border border-accent/40 bg-panel text-accent-ink shadow-sm"
        >
          <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v4h-4" />
          </svg>
        </span>
      )}
      {GRIPS.map((grip) => (
        <span
          key={grip.id}
          role="presentation"
          onPointerDown={(event) => {
            // Kept off the note's own handler, or the grip would start a drag of
            // the thing it is meant to be resizing.
            event.stopPropagation()
            onResize(grip.id, event)
          }}
          style={{ cursor: grip.cursor }}
          className={`absolute ${grip.at} size-3 rounded-full border-2 border-accent bg-panel`}
        />
      ))}
    </>
  )
}

export function BoardItem({
  item,
  selected,
  editing,
  onPointerDown,
  onContextMenu,
  onDoubleClick,
  onChange,
  onResize,
  onRotate,
  onAutoSize,
  ends,
  onEndDown,
}: {
  item: Item
  selected: boolean
  editing: boolean
  onPointerDown: (event: React.PointerEvent) => void
  onContextMenu: (event: React.MouseEvent) => void
  onDoubleClick: () => void
  /** Fired on every keystroke, not on blur — see the note on the effect. */
  onChange: (text: string) => void
  /** Given the corner being dragged, when this is the only thing selected. */
  onResize?: (corner: Corner, event: React.PointerEvent) => void
  onRotate?: (event: React.PointerEvent) => void
  /** The height the words actually need, once they have been laid out. */
  onAutoSize?: (id: string, height: number) => void
  /** Where a connector's two ends are now, bound ends included; the board works them out. */
  ends?: [number, number, number, number]
  /** A selected connector's end grip was grabbed. */
  onEndDown?: (end: 'start' | 'end', event: React.PointerEvent) => void
}) {
  const editor = useRef<HTMLDivElement>(null)
  /**
   * The padded wrapper round everything the box contains.
   *
   * Measured instead of the editor, because the editor is not the whole of it:
   * a sticky has a second line under it and both of them sit inside padding, and
   * measuring the editor alone reports a box that is a dozen pixels too short.
   * This one is laid out at its natural height, so its `offsetHeight` is exactly
   * how tall the box needs to be.
   */
  const content = useRef<HTMLDivElement>(null)
  const text = item.text

  /**
   * While a note is being edited its text belongs to the DOM, not to React.
   *
   * React renders no children into the editor for as long as it is open, and the
   * text is put there by hand on the way in. Two things go wrong otherwise. A
   * re-render mid-edit replaces the node's contents and throws the caret back to
   * the start; and closing the editor re-rendered the old text over what had just
   * been typed, before `blur` had a chance to save it — so nothing anyone typed
   * ever left their own screen.
   *
   * Every keystroke is written straight to the document instead, which is what
   * makes typing visible to the room as it happens rather than when you click
   * away.
   */
  useEffect(() => {
    if (!editing || !editor.current) return
    const node = editor.current
    // `innerText`, not `textContent`. The two differ over exactly the thing that
    // matters here: pressing Return puts a `<div>` or a `<br>` in the editor, and
    // `textContent` runs the lines together as though it were never pressed.
    node.innerText = text
    node.focus()
    // The caret goes to the end rather than wherever the click landed, so typing
    // continues the note instead of splitting it.
    const range = document.createRange()
    range.selectNodeContents(node)
    range.collapse(false)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    // `text` deliberately absent: this seeds the editor once, and re-running it
    // on every remote keystroke would fight the person typing for the caret.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing])

  /**
   * Let the box follow the words.
   *
   * A text box whose border stays where it was drawn while the text spills out
   * of the bottom is not a box, and that is what a fixed height gives you the
   * moment anything wraps. The editor is laid out at its natural height and the
   * measurement is written back to the document, so the outline, the selection,
   * the minimap and Fit all agree with what is on the screen.
   *
   * A pixel of slack in the comparison, or the write and the measurement chase
   * each other around forever on a fractional zoom.
   */
  const grows = item.kind === 'text' || item.kind === 'sticky'
  useEffect(() => {
    const node = content.current
    if (!grows || !node || !onAutoSize) return
    const measure = () => {
      const needed = Math.round(node.offsetHeight)
      // A sticky keeps the size it was given and only ever grows; a text box has
      // no size of its own to keep, so it hugs its contents both ways.
      const shrink = item.kind === 'text'
      if (needed > item.h + 1 || (shrink && needed < item.h - 1)) onAutoSize(item.id, needed)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [grows, item.id, item.kind, item.h, item.w, item.text, item.weight, onAutoSize])

  const box: React.CSSProperties = {
    left: item.x,
    top: item.y,
    width: item.w,
    height: item.h,
    zIndex: item.z,
    // Turned about the middle so the note stays where it is and only its
    // orientation changes; about a corner it would swing away across the board.
    transform: item.angle ? `rotate(${item.angle}deg)` : undefined,
  }

  const ring = selected ? 'outline-2 outline-accent' : ''
  const hooks = {
    onPointerDown,
    onContextMenu,
    onDoubleClick,
    // What the eraser looks for when it is dragged across the board: the id is
    // read straight off whatever is under the pointer, which is exact where a
    // bounding-box test would rub out a note the stroke merely passes over.
    'data-item': item.id,
  }

  if (item.kind === 'stroke') {
    return <Stroke item={item} selected={selected} onPointerDown={onPointerDown} onContextMenu={onContextMenu} onRotate={onRotate} onResize={onResize} />
  }

  if (item.kind === 'connector') {
    return <Connector item={item} ends={ends} selected={selected} onPointerDown={onPointerDown} onContextMenu={onContextMenu} onEndDown={onEndDown} />
  }

  if (item.kind === 'image') {
    return <Picture item={item} box={box} ring={ring} hooks={hooks} selected={selected} onResize={onResize} onRotate={onRotate} />
  }

  if (item.kind === 'frame') {
    return (
      <div className="absolute" style={box} {...hooks}>
        <span
          onDoubleClick={(event) => {
            event.stopPropagation()
            onDoubleClick()
          }}
          className="absolute -top-7 left-0 max-w-full truncate rounded-md bg-accent px-2 py-1 font-hand text-xs font-semibold text-[#1B1B3A]"
        >
          {editing ? (
            <span
              ref={editor}
              contentEditable
              suppressContentEditableWarning
              onInput={(event) => onChange(event.currentTarget.innerText)}
              className="block min-w-8 outline-none"
            />
          ) : (
            item.text || 'Frame'
          )}
        </span>
        <div className="h-full w-full bg-panel/50">
          <Sketch
            id={item.id}
            w={item.w}
            h={item.h}
            kind="frame"
            line={selected ? 'var(--color-accent)' : 'color-mix(in oklab, var(--color-ink) 70%, transparent)'}
          />
        </div>
        {selected && onResize && <Handles onResize={onResize} onRotate={onRotate} />}
        {item.locked && <Lock />}
      </div>
    )
  }

  const swatch = PALETTE[item.color] ?? PALETTE.yellow

  if (item.kind === 'shape') {
    return (
      <div className={`absolute ${ring}`} style={box} {...hooks}>
        <Sketch id={item.id} w={item.w} h={item.h} kind="shape" line={swatch.line} fill={swatch.tint} shape={item.shape === 'ellipse' || item.shape === 'diamond' ? item.shape : 'rect'} />
        {/* The shape's own words, centred. They do not grow the shape, and what does not fit is clipped. */}
        <div
          className="absolute inset-0 flex items-center justify-center overflow-hidden text-center"
          style={{ padding: item.shape === 'diamond' ? item.w * 0.18 : 12 }}
        >
          <div
            ref={editor}
            contentEditable={editing}
            suppressContentEditableWarning
            onInput={(event) => onChange(event.currentTarget.innerText)}
            className="sticky-text font-hand max-h-full w-full text-center text-[15px] text-[var(--deep)] outline-none dark:text-[var(--night)]"
            style={{ fontWeight: item.weight ?? 600, '--deep': swatch.deep, '--night': swatch.night } as React.CSSProperties}
          >
            {editing ? null : item.text}
          </div>
        </div>
        {selected && onResize && <Handles onResize={onResize} onRotate={onRotate} />}
        {item.locked && <Lock />}
      </div>
    )
  }

  if (item.kind === 'text') {
    return (
      <div className={`absolute rounded ${ring}`} style={box} {...hooks}>
        <div ref={content} className="w-full p-1">
          <div
            ref={editor}
            contentEditable={editing}
            suppressContentEditableWarning
            onInput={(event) => onChange(event.currentTarget.innerText)}
            className="sticky-text font-hand text-[15px] text-[var(--deep)] dark:text-[var(--night)]"
            style={{ fontWeight: item.weight ?? 500, '--deep': swatch.deep, '--night': swatch.night } as React.CSSProperties}
          >
            {editing ? null : item.text}
          </div>
        </div>
        {selected && onResize && <Handles onResize={onResize} onRotate={onRotate} />}
        {item.locked && <Lock />}
      </div>
    )
  }

  return (
    <div className={`absolute ${ring}`} style={box} {...hooks}>
      <Sketch id={item.id} w={item.w} h={item.h} kind="sticky" line={swatch.line} fill={swatch.tint} />
      <div ref={content} className="relative w-full p-3">
        <div
          ref={editor}
          contentEditable={editing}
          suppressContentEditableWarning
          onInput={(event) => onChange(event.currentTarget.innerText)}
          className={`sticky-text font-hand text-[15px] leading-snug ${swatch.ink}`}
          style={{ fontWeight: item.weight ?? 600 }}
        >
          {editing ? null : item.text}
        </div>
        {item.note && (
          <div className={`sticky-text font-hand mt-1.5 text-[13px] leading-snug opacity-75 ${swatch.ink}`}>
            {item.note}
          </div>
        )}
      </div>
      {selected && onResize && <Handles onResize={onResize} onRotate={onRotate} />}
      {item.locked && <Lock />}
    </div>
  )
}

/**
 * The hand-drawn box behind an item, as an SVG under its real text.
 *
 * The wobble is seeded by the id, so every peer draws the same one, and
 * memoised on the size so a pointer move does not redraw it. The fill sits
 * `SKETCH.offset` off the outline, like a second print pass; the item's own box
 * is what takes the clicks, so the offset is only ever visual.
 */
function Sketch({
  id,
  w,
  h,
  kind,
  line,
  fill,
  shape,
  solid,
}: {
  id: string
  w: number
  h: number
  kind: SketchKind
  line: string
  fill?: string
  shape?: SketchShape
  /** A frame outline that is not dashed. */
  solid?: boolean
}) {
  const paths = useMemo(() => shapePaths(w, h, seedOf(id), kind, line, fill, shape), [id, w, h, kind, line, fill, shape])
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 overflow-visible" width={w} height={h}>
      {paths.fill && <path d={paths.fill} fill={fill} transform={`translate(${SKETCH.offset} ${SKETCH.offset})`} />}
      <path d={paths.outline} fill="none" stroke={line} strokeWidth={SKETCH.strokeWidth} strokeLinecap="round" strokeDasharray={kind === 'frame' && !solid ? FRAME_DASH.join(' ') : undefined} />
    </svg>
  )
}

/**
 * A picture: the stored file in a hand-drawn frame.
 *
 * The `<img>` takes no pointer events, so the item's own box is what is grabbed,
 * dragged and erased like any other. A file that will not load (deleted, offline,
 * or a key a peer made up) shows a hatched card instead of the browser's
 * broken-image glyph; the export draws the same card.
 */
function Picture({
  item,
  box,
  ring,
  hooks,
  selected,
  onResize,
  onRotate,
}: {
  item: Item
  box: React.CSSProperties
  ring: string
  hooks: Record<string, unknown>
  selected: boolean
  onResize?: (corner: Corner, event: React.PointerEvent) => void
  onRotate?: (event: React.PointerEvent) => void
}) {
  // Which src failed, not a flag: a different one gets its own chance.
  const [failed, setFailed] = useState<string | null>(null)
  const broken = !isPictureSrc(item.src) || failed === item.src
  return (
    <div className={`absolute ${ring}`} style={box} {...hooks}>
      {broken ? (
        <div
          className="pointer-events-none grid size-full place-items-center text-ink/50"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg, color-mix(in oklab, var(--color-ink) 15%, transparent) 0 2px, transparent 2px 9px)',
          }}
        >
          <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 5h16v14H4V5ZM4 16l5-5 4 4 3-3 4 4M15 9h.01" />
          </svg>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.src}
          alt=""
          draggable={false}
          loading="lazy"
          decoding="async"
          className="pointer-events-none size-full object-cover select-none"
          onError={() => setFailed(item.src ?? null)}
        />
      )}
      <Sketch
        id={item.id}
        w={item.w}
        h={item.h}
        kind="frame"
        solid
        line={selected ? 'var(--color-accent)' : 'color-mix(in oklab, var(--color-ink) 70%, transparent)'}
      />
      {selected && onResize && <Handles onResize={onResize} onRotate={onRotate} />}
      {item.locked && <Lock />}
    </div>
  )
}

/** Says why it will not move. */
function Lock() {
  return (
    <span className="pointer-events-none absolute -top-2 -right-2 grid size-5 place-items-center rounded-full bg-ink text-canvas">
      <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </svg>
    </span>
  )
}

/**
 * A freehand stroke.
 *
 * Its own SVG sized to its own bounding box, rather than one shared canvas over
 * the whole board: a stroke can then sit in the same z-order as the notes and be
 * picked up and moved like anything else.
 */
function Stroke({
  item,
  selected,
  onPointerDown,
  onContextMenu,
  onResize,
  onRotate,
}: {
  item: Item
  selected: boolean
  onPointerDown: (event: React.PointerEvent) => void
  onContextMenu: (event: React.MouseEvent) => void
  onResize?: (corner: Corner, event: React.PointerEvent) => void
  onRotate?: (event: React.PointerEvent) => void
}) {
  const points = item.points
  const width = item.stroke ?? 3

  // The centreline, for hit-testing and the selection halo.
  const d = useMemo(
    () =>
      (points ?? []).reduce(
        (path, value, i) =>
          i % 2 === 0 ? `${path}${i === 0 ? 'M' : 'L'}${value - item.x} ` : `${path}${value - item.y} `,
        '',
      ),
    [points, item.x, item.y],
  )
  // The visible ink: the filled outline. Memoised so a long stroke is not
  // rebuilt every time something else on the board changes.
  const ink = useMemo(
    () =>
      inkPath(
        (points ?? []).map((value, i) => value - (i % 2 === 0 ? item.x : item.y)),
        item.pressure,
        width,
        !!item.highlight,
      ),
    [points, item.pressure, item.x, item.y, width, item.highlight],
  )
  if (!points || points.length < 2) return null

  return (
    <div
      className="pointer-events-none absolute"
      style={{
        left: item.x,
        top: item.y,
        width: item.w,
        height: item.h,
        zIndex: item.z,
        transform: item.angle ? `rotate(${item.angle}deg)` : undefined,
      }}
    >
      <svg className="absolute inset-0 overflow-visible" style={{ width: item.w, height: item.h }} data-item={item.id}>
        {/* An invisible fat copy of the line, purely to be hit. A 3px stroke is
            about four pixels of target at arm's length, which is not enough to
            rub out reliably; this widens the target without widening the ink. */}
        <path
          d={d}
          fill="none"
          stroke="transparent"
          strokeWidth={width + 18}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="pointer-events-auto"
          onPointerDown={onPointerDown}
          onContextMenu={onContextMenu}
        />
        {selected && (
          <path
            d={d}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth={width + 6}
            strokeOpacity={0.25}
            strokeLinecap="round"
            className="pointer-events-none"
          />
        )}
        <path
          d={ink}
          fill={item.highlight ? (PALETTE[item.color] ?? PALETTE.yellow).dot : 'var(--color-ink)'}
          fillOpacity={item.highlight ? 0.45 : 1}
          className="pointer-events-none"
        />
      </svg>
      {selected && onResize && (
        <span className="pointer-events-auto">
          <Handles onResize={onResize} onRotate={onRotate} />
        </span>
      )}
      {item.locked && <Lock />}
    </div>
  )
}

/**
 * A straight line or arrow between two points.
 *
 * Its own SVG over the box of its two ends plus padding, like `Stroke`, and not
 * rotated: a connector has no angle, its ends are the geometry. The ends come in
 * as a prop because a bound end depends on the item it is bound to, which this
 * component knows nothing about.
 */
function Connector({
  item,
  ends,
  selected,
  onPointerDown,
  onContextMenu,
  onEndDown,
}: {
  item: Item
  ends?: [number, number, number, number]
  selected: boolean
  onPointerDown: (event: React.PointerEvent) => void
  onContextMenu: (event: React.MouseEvent) => void
  onEndDown?: (end: 'start' | 'end', event: React.PointerEvent) => void
}) {
  const [x1, y1, x2, y2] = ends ?? [0, 1, 2, 3].map((i) => item.points?.[i] ?? 0)
  const pad = 16
  const left = Math.min(x1, x2) - pad
  const top = Math.min(y1, y2) - pad
  const w = Math.abs(x2 - x1) + pad * 2
  const h = Math.abs(y2 - y1) + pad * 2
  const swatch = PALETTE[item.color] ?? PALETTE.slate
  const line = selected ? 'var(--color-accent)' : swatch.line
  const head = item.head === 'end' ? 'end' : 'none'
  const local: [number, number, number, number] = [x1 - left, y1 - top, x2 - left, y2 - top]
  // `linePaths` keeps its own cache, so there is nothing to memoise here.
  const d = linePaths(local, seedOf(item.id), line, head)

  return (
    <div className="pointer-events-none absolute" style={{ left, top, width: w, height: h, zIndex: item.z }}>
      <svg className="absolute inset-0 overflow-visible" style={{ width: w, height: h }} data-item={item.id}>
        {/* A fat invisible copy of the line to be hit; see Stroke. */}
        <path
          d={`M${local[0]} ${local[1]}L${local[2]} ${local[3]}`}
          fill="none"
          stroke="transparent"
          strokeWidth={14}
          strokeLinecap="round"
          className="pointer-events-auto"
          onPointerDown={onPointerDown}
          onContextMenu={onContextMenu}
        />
        <path
          d={d}
          fill="none"
          stroke={selected ? line : 'var(--conn)'}
          strokeWidth={SKETCH.strokeWidth}
          strokeLinecap="round"
          // Slate is near the dark canvas's own colour, so it takes `night` there, as text does.
          className="pointer-events-none [--conn:var(--conn-day)] dark:[--conn:var(--conn-night)]"
          style={{ '--conn-day': swatch.line, '--conn-night': swatch.night } as React.CSSProperties}
        />
        {selected &&
          (['start', 'end'] as const).map((end, i) => (
            <circle
              key={end}
              data-end={end}
              cx={local[i * 2]}
              cy={local[i * 2 + 1]}
              r={6}
              className="pointer-events-auto cursor-move fill-panel stroke-accent"
              strokeWidth={2}
              onPointerDown={(event) => {
                event.stopPropagation()
                onEndDown?.(end, event)
              }}
            />
          ))}
      </svg>
      {item.locked && <Lock />}
    </div>
  )
}
