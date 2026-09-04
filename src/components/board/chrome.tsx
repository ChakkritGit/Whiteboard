'use client'

import { useEffect, useRef, useState } from 'react'
import type { Camera, Item, Presence, Swatch } from '@/lib/types'
import { PALETTE, SWATCHES } from '@/lib/palette'
import type { Me } from '@/lib/identity'
import { Logo } from './logo'

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
  onReset,
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
  onReset: () => void
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
    <header className="glass glass-flat pointer-events-auto absolute inset-x-0 top-0 z-30 flex h-14 items-center gap-3 border-x-0 border-t-0 px-3">
      <Logo size={30} />

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
          <button
            type="button"
            onClick={onReset}
            title="Back to 100%"
            className="w-12 text-center text-xs font-semibold tabular-nums hover:text-[#4f46e5]"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={() => onZoom(zoom * 1.2)}
            aria-label="Zoom in"
            className="px-2 py-1 text-sm text-[#6b7280] hover:text-[#1f2430]"
          >
            +
          </button>
        </div>

        {/* Named rather than an icon on its own: getting lost on an infinite
            canvas is the one thing you need a way out of, and a glyph is a poor
            place to hide it. */}
        <button
          type="button"
          onClick={onFit}
          className="flex items-center gap-1.5 rounded-lg border border-[#e5e3df] px-2.5 py-1.5 text-xs font-semibold text-[#4b5563] hover:bg-white/70"
        >
          <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
          </svg>
          Fit
        </button>

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
        <div className="glass mb-2 grid grid-cols-5 gap-1.5 rounded-xl p-2">
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

      <div className="glass flex items-center gap-0.5 rounded-2xl px-2 py-1.5">
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
    <div className="glass pointer-events-none absolute right-4 bottom-5 z-30 rounded-xl p-1.5">
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

/**
 * The rail, and the panel it opens.
 *
 * Two things you cannot otherwise get at on an infinite canvas: who else is here,
 * and what is on the board when it has scrolled out of sight. The layer list
 * doubles as a way back to something — clicking a row brings it into view, which
 * is the only reliable way to find a note you have lost.
 */
export function LeftRail({
  items,
  people,
  me,
  onRename,
  onFocus,
  onSelect,
  selection,
  mounted,
}: {
  items: Item[]
  people: Presence[]
  me: Me
  onRename: (name: string) => void
  onFocus: (id: string) => void
  onSelect: (id: string) => void
  selection: string[]
  mounted: boolean
}) {
  const [open, setOpen] = useState<'people' | 'layers' | null>(null)

  return (
    <>
      <aside className="glass glass-flat pointer-events-auto absolute top-14 bottom-0 left-0 z-20 flex w-12 flex-col items-center gap-1 border-y-0 border-l-0 py-3">
        <RailButton
          label="People"
          count={people.length + 1}
          active={open === 'people'}
          onClick={() => setOpen((v) => (v === 'people' ? null : 'people'))}
        >
          <path d="M16 19v-1a4 4 0 0 0-8 0v1M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
        </RailButton>
        <RailButton
          label="Layers"
          count={items.length}
          active={open === 'layers'}
          onClick={() => setOpen((v) => (v === 'layers' ? null : 'layers'))}
        >
          <path d="M12 3l9 5-9 5-9-5 9-5ZM3 13l9 5 9-5" />
        </RailButton>
      </aside>

      {open && (
        <div className="glass pointer-events-auto absolute top-16 bottom-4 left-14 z-20 flex w-60 flex-col rounded-xl">
          <p className="px-3 pt-2.5 pb-1.5 text-[11px] font-bold tracking-wide text-[#6b7280] uppercase">
            {open === 'people' ? 'In this room' : 'On the board'}
          </p>

          <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
            {open === 'people' ? (
              <ul className="space-y-0.5">
                {/* Your own row is the one you can type in. There is no account
                    behind the name — it is kept on this machine and sent to the
                    room, and that is the whole of it. */}
                <li className="flex items-center gap-2 rounded-lg px-1.5 py-1.5">
                  <Dot color={me.color} initials={me.initials} />
                  <input
                    value={mounted ? me.name : ''}
                    onChange={(event) => onRename(event.target.value)}
                    aria-label="Your name"
                    className="min-w-0 flex-1 rounded-md bg-transparent px-1 py-0.5 text-sm font-semibold outline-none hover:bg-white/70 focus:bg-white"
                  />
                  <span className="text-[10px] font-semibold text-[#9ca3af]">you</span>
                </li>
                {mounted &&
                  people.map((peer, i) => (
                    <li key={`${peer.name}-${i}`} className="flex items-center gap-2 px-1.5 py-1.5">
                      <Dot color={peer.color} initials={peer.initials} />
                      <span className="min-w-0 flex-1 truncate px-1 text-sm">{peer.name}</span>
                      {peer.cursor && <span className="size-1.5 rounded-full bg-[#10b981]" title="On the board" />}
                    </li>
                  ))}
              </ul>
            ) : items.length === 0 ? (
              <p className="px-2 py-3 text-sm text-[#6b7280]">Nothing on the board yet.</p>
            ) : (
              <ul className="space-y-0.5">
                {[...items].reverse().map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(item.id)
                        onFocus(item.id)
                      }}
                      className={`flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-left text-sm ${
                        selection.includes(item.id) ? 'bg-[#eef2ff]' : 'hover:bg-white/70'
                      }`}
                    >
                      <span
                        className="size-3.5 shrink-0 rounded-[3px] border border-black/10"
                        style={{
                          background: item.kind === 'frame' ? 'transparent' : PALETTE[item.color]?.dot,
                          borderStyle: item.kind === 'frame' ? 'dashed' : 'solid',
                        }}
                      />
                      <span className="min-w-0 flex-1 truncate">{item.text || kindName(item.kind)}</span>
                      <span className="text-[10px] text-[#9ca3af]">{kindName(item.kind)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function kindName(kind: Item['kind']) {
  return kind === 'sticky' ? 'note' : kind === 'shape' ? 'box' : kind
}

function Dot({ color, initials }: { color: string; initials: string }) {
  return (
    <span
      className="grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white"
      style={{ background: color }}
    >
      {initials}
    </span>
  )
}

function RailButton({
  label,
  count,
  active,
  onClick,
  children,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`grid w-10 place-items-center rounded-lg py-1.5 ${
        active ? 'bg-[#eef2ff] text-[#4f46e5]' : 'text-[#6b7280] hover:bg-white/70'
      }`}
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
      <span className="mt-0.5 text-[10px] font-semibold tabular-nums">{count}</span>
    </button>
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
    <div className="glass absolute bottom-24 left-1/2 z-40 -translate-x-1/2 rounded-lg px-3.5 py-2 text-sm">
      {message}
    </div>
  )
}
