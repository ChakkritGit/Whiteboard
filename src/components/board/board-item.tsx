'use client'

import { useEffect, useRef } from 'react'
import type { Item } from '@/lib/types'
import { PALETTE } from '@/lib/palette'

/**
 * One thing on the board.
 *
 * Every kind is a positioned div rather than something painted into a canvas,
 * so the text inside a note is real text: selectable, editable in place, and
 * legible to a screen reader without a parallel accessibility tree being
 * invented for it.
 */
export function BoardItem({
  item,
  selected,
  editing,
  onPointerDown,
  onDoubleClick,
  onChange,
}: {
  item: Item
  selected: boolean
  editing: boolean
  onPointerDown: (event: React.PointerEvent) => void
  onDoubleClick: () => void
  /** Fired on every keystroke, not on blur — see the note on the effect. */
  onChange: (text: string) => void
}) {
  const editor = useRef<HTMLDivElement>(null)
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
    node.textContent = text
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

  const box = {
    left: item.x,
    top: item.y,
    width: item.w,
    height: item.h,
    zIndex: item.z,
  } as const

  if (item.kind === 'stroke') {
    return <Stroke item={item} selected={selected} onPointerDown={onPointerDown} />
  }

  if (item.kind === 'frame') {
    return (
      <div className="absolute" style={box} onPointerDown={onPointerDown}>
        <span className="absolute -top-7 left-0 rounded-md bg-[#1f2430] px-2 py-1 text-xs font-semibold text-white">
          {item.text || 'Frame'}
        </span>
        <div
          className={`h-full w-full rounded-xl border-2 border-dashed ${
            selected ? 'border-[#6366f1] bg-white/70' : 'border-[#c9c6c0] bg-white/50'
          }`}
        />
      </div>
    )
  }

  const swatch = PALETTE[item.color] ?? PALETTE.yellow

  if (item.kind === 'shape') {
    return (
      <div
        className={`absolute rounded-lg ${swatch.fill} ${selected ? 'ring-2 ring-[#6366f1]' : ''}`}
        style={box}
        onPointerDown={onPointerDown}
        onDoubleClick={onDoubleClick}
      />
    )
  }

  if (item.kind === 'text') {
    return (
      <div
        className={`absolute ${selected ? 'ring-2 ring-[#6366f1]' : ''} rounded`}
        style={box}
        onPointerDown={onPointerDown}
        onDoubleClick={onDoubleClick}
      >
        <div
          ref={editor}
          contentEditable={editing}
          suppressContentEditableWarning
          onInput={(event) => onChange(event.currentTarget.textContent ?? '')}
          className="sticky-text h-full w-full p-1 text-[15px] font-medium text-[#1f2430]"
        >
          {editing ? null : item.text}
        </div>
      </div>
    )
  }

  return (
    <div
      className={`absolute rounded-lg p-3 shadow-[0_2px_6px_rgb(16_24_40/0.12)] ${swatch.fill} ${
        selected ? 'ring-2 ring-[#6366f1]' : ''
      }`}
      style={box}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
    >
      <div
        ref={editor}
        contentEditable={editing}
        suppressContentEditableWarning
        onInput={(event) => onChange(event.currentTarget.textContent ?? '')}
        className={`sticky-text text-[15px] leading-snug font-semibold ${swatch.ink}`}
      >
        {editing ? null : item.text}
      </div>
      {item.note && (
        <div className={`sticky-text mt-1.5 text-[13px] leading-snug opacity-75 ${swatch.ink}`}>
          {item.note}
        </div>
      )}
    </div>
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
}: {
  item: Item
  selected: boolean
  onPointerDown: (event: React.PointerEvent) => void
}) {
  const points = item.points ?? []
  if (points.length < 4) return null

  const d = points.reduce(
    (path, value, i) =>
      i % 2 === 0 ? `${path}${i === 0 ? 'M' : 'L'}${value - item.x} ` : `${path}${value - item.y} `,
    '',
  )

  return (
    <svg
      className="pointer-events-none absolute overflow-visible"
      style={{ left: item.x, top: item.y, width: item.w, height: item.h, zIndex: item.z }}
    >
      <path
        d={d}
        fill="none"
        stroke={item.highlight ? PALETTE[item.color].dot : '#1f2430'}
        strokeWidth={item.stroke ?? 3}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity={item.highlight ? 0.45 : 1}
        // Only the line itself takes the pointer, not its bounding box — a
        // stroke's box is mostly empty and would swallow clicks meant for
        // whatever is underneath it.
        className="pointer-events-auto"
        onPointerDown={onPointerDown}
      />
      {selected && (
        <path
          d={d}
          fill="none"
          stroke="#6366f1"
          strokeWidth={(item.stroke ?? 3) + 6}
          strokeOpacity={0.25}
          strokeLinecap="round"
          className="pointer-events-none"
        />
      )}
    </svg>
  )
}
