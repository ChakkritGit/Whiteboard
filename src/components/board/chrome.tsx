'use client'

import { useEffect, useRef, useState } from 'react'
import type { Camera, Item, Presence, Swatch } from '@/lib/types'
import { PALETTE, SWATCHES } from '@/lib/palette'
import type { Me } from '@/lib/identity'

/* --------------------------------- top --------------------------------- */

export function TopBar({
  title,
  onTitle,
  live,
  me,
  peers,
  zoom,
  onZoom,
  onFit,
  onExport,
  onImport,
  onShare,
  shared,
  mounted,
}: {
  title: string
  onTitle: (next: string) => void
  live: boolean
  me: Me
  peers: Presence[]
  zoom: number
  onZoom: (next: number) => void
  onFit: () => void
  onExport: () => void
  onImport: (file: File) => void
  onShare: () => void
  shared: boolean
  /** False during the server render; see the avatar row. */
  mounted: boolean
}) {
  const file = useRef<HTMLInputElement>(null)
  const everyone = [{ initials: me.initials, color: me.color, name: me.name }, ...peers]
  const shown = everyone.slice(0, 4)

  return (
    <header className="pointer-events-auto absolute inset-x-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-[#e5e3df] bg-white/85 px-3 backdrop-blur-md">
      <div className="size-8 shrink-0 rounded-lg bg-[#6366f1]" aria-hidden />

      <input
        value={title}
        onChange={(event) => onTitle(event.target.value)}
        aria-label="Board title"
        className="min-w-0 max-w-[18rem] flex-1 rounded-md px-2 py-1 text-[15px] font-semibold outline-none hover:bg-[#f4f2ee] focus:bg-[#f4f2ee] sm:flex-none"
      />

      <div className="ml-auto flex items-center gap-2">
        <span
          className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium sm:inline-flex ${
            live ? 'bg-[#ecfdf5] text-[#047857]' : 'bg-[#f4f2ee] text-[#6b7280]'
          }`}
        >
          <span className={`size-1.5 rounded-full ${live ? 'bg-[#10b981]' : 'bg-[#9ca3af]'}`} />
          {live ? 'Live' : 'Offline'}
        </span>

        {/* Everyone in the room, and only once there is a browser to ask: the
            name and colour come from local storage, so drawing them on the
            server would be a hydration mismatch by construction. */}
        <div className="hidden items-center -space-x-2 sm:flex">
          {mounted &&
            shown.map((person, i) => (
              <span
                key={`${person.initials}-${i}`}
                title={person.name}
                className="grid size-7 place-items-center rounded-full border-2 border-white text-[11px] font-bold text-white"
                style={{ background: person.color }}
              >
                {person.initials}
              </span>
            ))}
          {mounted && everyone.length > shown.length && (
            <span className="grid size-7 place-items-center rounded-full border-2 border-white bg-[#e5e3df] text-[11px] font-bold text-[#4b5563]">
              +{everyone.length - shown.length}
            </span>
          )}
        </div>

        <div className="hidden items-center rounded-lg border border-[#e5e3df] sm:flex">
          <button
            type="button"
            onClick={() => onZoom(zoom / 1.2)}
            aria-label="Zoom out"
            className="px-2 py-1 text-sm text-[#6b7280] hover:text-[#1f2430]"
          >
            −
          </button>
          <span className="w-12 text-center text-xs font-semibold tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => onZoom(zoom * 1.2)}
            aria-label="Zoom in"
            className="px-2 py-1 text-sm text-[#6b7280] hover:text-[#1f2430]"
          >
            +
          </button>
        </div>

        <IconButton label="Fit to content" onClick={onFit}>
          <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
        </IconButton>

        <IconButton label="Export board" onClick={onExport}>
          <path d="M12 4v11M8 11l4 4 4-4M5 20h14" />
        </IconButton>

        <IconButton label="Import board" onClick={() => file.current?.click()}>
          <path d="M12 20V9M8 13l4-4 4 4M5 4h14" />
        </IconButton>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            const chosen = event.target.files?.[0]
            if (chosen) onImport(chosen)
            // Cleared so choosing the same file twice fires again.
            event.target.value = ''
          }}
        />

        <button
          type="button"
          onClick={onShare}
          className="rounded-lg bg-[#6366f1] px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-[#4f46e5]"
        >
          {shared ? 'Link copied' : 'Share'}
        </button>
      </div>
    </header>
  )
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid size-8 place-items-center rounded-lg border border-[#e5e3df] text-[#4b5563] hover:bg-[#f4f2ee]"
    >
      <svg
        viewBox="0 0 24 24"
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </svg>
    </button>
  )
}

/* -------------------------------- tools -------------------------------- */

export type Tool =
  | 'select'
  | 'pen'
  | 'highlighter'
  | 'eraser'
  | 'shape'
  | 'sticky'
  | 'text'
  | 'frame'

const TOOLS: { id: Tool; label: string; path: React.ReactNode }[] = [
  { id: 'select', label: 'Select', path: <path d="M6 3l13 8-6 1.5L10 19 6 3Z" /> },
  { id: 'pen', label: 'Pen', path: <path d="M4 20l4-1 10-10-3-3L5 16l-1 4ZM14 6l3 3" /> },
  {
    id: 'highlighter',
    label: 'Highlighter',
    path: <path d="M5 19h5l9-9-4-4-9 9v4ZM3 21h8" />,
  },
  { id: 'eraser', label: 'Eraser', path: <path d="M6 18h13M8 18l-4-4 8-8 6 6-6 6" /> },
  { id: 'shape', label: 'Rectangle', path: <rect x="4" y="6" width="16" height="12" rx="2" /> },
  {
    id: 'sticky',
    label: 'Sticky note',
    path: <path d="M5 4h14v10l-5 6H5V4ZM19 14h-5v6" />,
  },
  { id: 'text', label: 'Text', path: <path d="M5 6h14M12 6v13M9 19h6" /> },
  { id: 'frame', label: 'Frame', path: <path d="M8 3v18M16 3v18M3 8h18M3 16h18" /> },
]

export function ToolDock({
  tool,
  onTool,
  color,
  onColor,
}: {
  tool: Tool
  onTool: (next: Tool) => void
  color: Swatch
  onColor: (next: Swatch) => void
}) {
  const [palette, setPalette] = useState(false)

  return (
    <div className="pointer-events-auto absolute bottom-5 left-1/2 z-30 -translate-x-1/2">
      {palette && (
        <div className="panel mb-2 grid grid-cols-5 gap-1.5 rounded-xl p-2">
          {SWATCHES.map((swatch) => (
            <button
              key={swatch}
              type="button"
              aria-label={swatch}
              onClick={() => {
                onColor(swatch)
                setPalette(false)
              }}
              className={`size-7 rounded-full border-2 ${
                color === swatch ? 'border-[#1f2430]' : 'border-transparent'
              }`}
              style={{ background: PALETTE[swatch].dot }}
            />
          ))}
        </div>
      )}

      <div className="panel flex items-center gap-0.5 rounded-2xl px-2 py-1.5">
        {TOOLS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            title={entry.label}
            aria-label={entry.label}
            aria-pressed={tool === entry.id}
            onClick={() => onTool(entry.id)}
            className={`grid size-10 place-items-center rounded-xl transition-colors ${
              tool === entry.id ? 'bg-[#eef2ff] text-[#4f46e5]' : 'text-[#4b5563] hover:bg-[#f4f2ee]'
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {entry.path}
            </svg>
          </button>
        ))}

        <span className="mx-1 h-6 w-px bg-[#e5e3df]" />

        <button
          type="button"
          title="Colour"
          aria-label="Colour"
          aria-expanded={palette}
          onClick={() => setPalette((open) => !open)}
          className="grid size-10 place-items-center rounded-xl hover:bg-[#f4f2ee]"
        >
          <span
            className="size-5 rounded-full border border-black/10"
            style={{ background: PALETTE[color].dot }}
          />
        </button>
      </div>
    </div>
  )
}

/* ------------------------------- cursors ------------------------------- */

export function Cursors({ peers, camera }: { peers: Presence[]; camera: Camera }) {
  return (
    <>
      {peers.map((peer, i) =>
        peer.cursor ? (
          <div
            key={`${peer.name}-${i}`}
            className="pointer-events-none absolute z-40 transition-transform duration-75"
            style={{
              transform: `translate(${peer.cursor.x * camera.zoom + camera.x}px, ${
                peer.cursor.y * camera.zoom + camera.y
              }px)`,
            }}
          >
            <svg viewBox="0 0 24 24" className="size-5" style={{ color: peer.color }}>
              <path d="M5 2l14 8.5-6.2 1.4L9.8 19 5 2Z" fill="currentColor" />
            </svg>
            <span
              className="ml-3 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-white"
              style={{ background: peer.color }}
            >
              {peer.name}
            </span>
          </div>
        ) : null,
      )}
    </>
  )
}

/* ------------------------------- mini map ------------------------------- */

export function MiniMap({
  items,
  camera,
  viewport,
}: {
  items: Item[]
  camera: Camera
  viewport: { w: number; h: number }
}) {
  const W = 190
  const H = 120

  if (items.length === 0) return null

  const bounds = items.reduce(
    (box, item) => ({
      minX: Math.min(box.minX, item.x),
      minY: Math.min(box.minY, item.y),
      maxX: Math.max(box.maxX, item.x + item.w),
      maxY: Math.max(box.maxY, item.y + item.h),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  )

  // The window on screen counts as part of what has to fit, so the viewport
  // rectangle can never leave the map.
  const view = {
    x: -camera.x / camera.zoom,
    y: -camera.y / camera.zoom,
    w: viewport.w / camera.zoom,
    h: viewport.h / camera.zoom,
  }
  const minX = Math.min(bounds.minX, view.x)
  const minY = Math.min(bounds.minY, view.y)
  const maxX = Math.max(bounds.maxX, view.x + view.w)
  const maxY = Math.max(bounds.maxY, view.y + view.h)

  const scale = Math.min(W / Math.max(1, maxX - minX), H / Math.max(1, maxY - minY)) * 0.9
  const at = (x: number, y: number) => ({ left: (x - minX) * scale + 6, top: (y - minY) * scale + 6 })

  return (
    <div className="panel pointer-events-none absolute right-4 bottom-5 z-30 rounded-xl p-1.5">
      <p className="px-1 pb-1 text-[10px] font-semibold tracking-wide text-[#6b7280] uppercase">Map</p>
      <div className="relative overflow-hidden rounded-lg bg-[#f4f2ee]" style={{ width: W, height: H }}>
        {items.map((item) => (
          <span
            key={item.id}
            className="absolute rounded-[2px]"
            style={{
              ...at(item.x, item.y),
              width: Math.max(2, item.w * scale),
              height: Math.max(2, item.h * scale),
              background: item.kind === 'frame' ? 'transparent' : PALETTE[item.color]?.dot,
              border: item.kind === 'frame' ? '1px dashed #b9b6b0' : undefined,
            }}
          />
        ))}
        <span
          className="absolute rounded-sm border-2 border-[#6366f1]/70"
          style={{ ...at(view.x, view.y), width: view.w * scale, height: view.h * scale }}
        />
      </div>
    </div>
  )
}

/* ------------------------------- left rail ------------------------------ */

export function LeftRail({ count, people }: { count: number; people: number }) {
  return (
    <aside className="pointer-events-auto absolute top-14 bottom-0 left-0 z-20 flex w-12 flex-col items-center gap-1 border-r border-[#e5e3df] bg-white/70 py-3 backdrop-blur-md">
      <RailStat label="Items on the board" value={count}>
        <path d="M12 3l9 5-9 5-9-5 9-5ZM3 13l9 5 9-5" />
      </RailStat>
      <RailStat label="People here" value={people}>
        <path d="M16 19v-1a4 4 0 0 0-8 0v1M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      </RailStat>
    </aside>
  )
}

function RailStat({
  label,
  value,
  children,
}: {
  label: string
  value: number
  children: React.ReactNode
}) {
  return (
    <div title={`${label}: ${value}`} className="grid w-full place-items-center py-1.5 text-[#6b7280]">
      <svg
        viewBox="0 0 24 24"
        className="size-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </svg>
      <span className="mt-0.5 text-[10px] font-semibold tabular-nums">{value}</span>
    </div>
  )
}

/* -------------------------------- toast -------------------------------- */

export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!message) return
    const timer = setTimeout(onDone, 3200)
    return () => clearTimeout(timer)
  }, [message, onDone])

  if (!message) return null
  return (
    <div className="panel absolute bottom-24 left-1/2 z-40 -translate-x-1/2 rounded-lg px-3.5 py-2 text-sm">
      {message}
    </div>
  )
}
