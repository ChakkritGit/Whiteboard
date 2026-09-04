'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Camera, Item, Presence, Swatch } from '@/lib/types'
import { PALETTE, SWATCHES } from '@/lib/palette'
import { WS_URL } from '@/lib/board'
import type { Me } from '@/lib/identity'
import { useTheme, type ThemeMode } from '@/lib/theme'
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
  history,
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
  history: { canUndo: boolean; canRedo: boolean; undo: () => void; redo: () => void }
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
        className="min-w-0 max-w-[18rem] flex-1 rounded-md px-2 py-1 text-[15px] font-semibold outline-none hover:bg-canvas focus:bg-canvas sm:flex-none"
      />

      <div className="ml-auto flex items-center gap-2">
        <span
          title={live ? `Connected to ${WS_URL}` : `Not connected to ${WS_URL}`}
          className={`hidden cursor-help items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium sm:inline-flex ${
            live
              ? 'bg-[#ecfdf5] text-[#047857] dark:bg-[#064e3b]/50 dark:text-[#6ee7b7]'
              : 'bg-canvas text-muted'
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
                className="grid size-7 place-items-center rounded-full border-2 border-panel text-[11px] font-bold text-white"
                style={{ background: person.color }}
              >
                {person.initials}
              </span>
            ))}
          {mounted && everyone.length > shown.length && (
            <span className="grid size-7 place-items-center rounded-full border-2 border-panel bg-line text-[11px] font-bold text-muted">
              +{everyone.length - shown.length}
            </span>
          )}
        </div>

        <ThemeSwitch mounted={mounted} />

        <div className="hidden items-center rounded-lg border border-line sm:flex">
          <button
            type="button"
            onClick={() => onZoom(zoom / 1.2)}
            aria-label="Zoom out"
            className="px-2 py-1 text-sm text-muted hover:text-ink"
          >
            −
          </button>
          <button
            type="button"
            onClick={onReset}
            title="Back to 100%"
            className="w-12 text-center text-xs font-semibold tabular-nums hover:text-accent"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={() => onZoom(zoom * 1.2)}
            aria-label="Zoom in"
            className="px-2 py-1 text-sm text-muted hover:text-ink"
          >
            +
          </button>
        </div>

        <div className="hidden items-center rounded-lg border border-line sm:flex">
          <HistoryButton label="Undo" disabled={!history.canUndo} onClick={history.undo}>
            <path d="M9 14 4 9l5-5M4 9h9a7 7 0 0 1 0 14h-3" />
          </HistoryButton>
          <span className="h-5 w-px bg-line" />
          <HistoryButton label="Redo" disabled={!history.canRedo} onClick={history.redo}>
            <path d="m15 14 5-5-5-5m5 5h-9a7 7 0 0 0 0 14h3" />
          </HistoryButton>
        </div>

        {/* Named rather than an icon on its own: getting lost on an infinite
            canvas is the one thing you need a way out of, and a glyph is a poor
            place to hide it. */}
        <button
          type="button"
          onClick={onFit}
          className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-muted hover:bg-panel/70"
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
          className="rounded-lg bg-accent px-3.5 py-1.5 text-sm font-semibold text-white hover:brightness-110"
        >
          {shared ? 'Link copied' : 'Share'}
        </button>
      </div>
    </header>
  )
}

/**
 * Light, dark, or follow the machine.
 *
 * Three buttons rather than a toggle, because "system" is a real choice and not
 * the absence of one — and a two-state toggle has nowhere to put it. Rendered
 * blank until mounted: the current mode comes from local storage, so drawing
 * which one is pressed during the server render is a mismatch by construction.
 */
// Named "Light theme" rather than "Light": the type controls in the dock have a
// weight by that name, and two buttons on one screen answering to the same name
// is ambiguous to anyone driving this by voice or by screen reader.
const MODES: { id: ThemeMode; label: string; icon: React.ReactNode }[] = [
  {
    id: 'light',
    label: 'Light theme',
    icon: <path d="M12 4V2m0 20v-2m8-8h2M2 12h2m13.7-5.7 1.4-1.4M4.9 19.1l1.4-1.4m0-11.4L4.9 4.9m14.2 14.2-1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />,
  },
  { id: 'dark', label: 'Dark theme', icon: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" /> },
  {
    id: 'system',
    label: 'Match the system',
    icon: <path d="M4 5h16v10H4zM9 19h6M12 15v4" />,
  },
]

function ThemeSwitch({ mounted }: { mounted: boolean }) {
  const { mode, setMode } = useTheme()

  return (
    <div className="hidden items-center rounded-lg border border-line p-0.5 sm:flex" role="group" aria-label="Theme">
      {MODES.map((entry) => (
        <button
          key={entry.id}
          type="button"
          title={entry.label}
          aria-label={entry.label}
          aria-pressed={mounted && mode === entry.id}
          onClick={() => setMode(entry.id)}
          className={`grid size-7 place-items-center rounded-md transition-colors ${
            mounted && mode === entry.id
              ? 'bg-accent/12 text-accent'
              : 'text-muted hover:text-ink'
          }`}
        >
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            {entry.icon}
          </svg>
        </button>
      ))}
    </div>
  )
}

function HistoryButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="grid size-8 place-items-center text-muted disabled:opacity-30 enabled:hover:text-ink"
    >
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </button>
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
      className="grid size-8 place-items-center rounded-lg border border-line text-muted hover:bg-canvas"
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

const TOOLS: { id: Tool; label: string; key: string; path: React.ReactNode }[] = [
  { id: 'select', label: 'Select', key: 'V', path: <path d="M6 3l13 8-6 1.5L10 19 6 3Z" /> },
  { id: 'pen', label: 'Pen', key: 'P', path: <path d="M4 20l4-1 10-10-3-3L5 16l-1 4ZM14 6l3 3" /> },
  {
    id: 'highlighter',
    label: 'Highlighter',
    key: 'H',
    path: <path d="M5 19h5l9-9-4-4-9 9v4ZM3 21h8" />,
  },
  { id: 'eraser', label: 'Eraser', key: 'E', path: <path d="M6 18h13M8 18l-4-4 8-8 6 6-6 6" /> },
  { id: 'shape', label: 'Rectangle', key: 'R', path: <rect x="4" y="6" width="16" height="12" rx="2" /> },
  {
    id: 'sticky',
    label: 'Sticky note',
    key: 'N',
    path: <path d="M5 4h14v10l-5 6H5V4ZM19 14h-5v6" />,
  },
  { id: 'text', label: 'Text', key: 'T', path: <path d="M5 6h14M12 6v13M9 19h6" /> },
  { id: 'frame', label: 'Frame', key: 'F', path: <path d="M8 3v18M16 3v18M3 8h18M3 16h18" /> },
]

/** Pen widths, in board units. */
const WIDTHS = [2, 4, 8, 14]
const WEIGHTS: { value: number; label: string }[] = [
  { value: 300, label: 'Light' },
  { value: 500, label: 'Regular' },
  { value: 700, label: 'Bold' },
  { value: 900, label: 'Black' },
]

export function ToolDock({
  tool,
  onTool,
  color,
  onColor,
  width,
  onWidth,
  weight,
  onWeight,
  showType,
}: {
  tool: Tool
  onTool: (next: Tool) => void
  color: Swatch
  onColor: (next: Swatch) => void
  width: number
  onWidth: (next: number) => void
  weight: number
  onWeight: (next: number) => void
  /** Whether anything the type controls apply to is in play. */
  showType: boolean
}) {
  const [palette, setPalette] = useState(false)
  const inking = tool === 'pen' || tool === 'highlighter'

  return (
    <div className="pointer-events-auto absolute bottom-5 left-1/2 z-30 -translate-x-1/2">
      {palette && (
        <div className="glass mb-2 grid grid-cols-6 gap-1.5 rounded-xl p-2">
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
                color === swatch ? 'border-ink' : 'border-transparent'
              }`}
              style={{ background: PALETTE[swatch].dot }}
            />
          ))}
        </div>
      )}

      {/* Only what the current tool or selection can actually use. A row of
          controls that do nothing is worse than no row at all. */}
      {(inking || showType) && (
        <div className="glass mb-2 flex items-center gap-1 rounded-xl px-2 py-1.5">
          {inking &&
            WIDTHS.map((value) => (
              <button
                key={value}
                type="button"
                title={`${value}px`}
                aria-label={`Pen width ${value}`}
                aria-pressed={width === value}
                onClick={() => onWidth(value)}
                className={`grid size-8 place-items-center rounded-lg ${
                  width === value ? 'bg-accent/12' : 'hover:bg-canvas'
                }`}
              >
                <span
                  className="rounded-full bg-ink"
                  style={{ width: value + 2, height: value + 2 }}
                />
              </button>
            ))}
          {showType &&
            WEIGHTS.map((entry) => (
              <button
                key={entry.value}
                type="button"
                title={entry.label}
                aria-label={entry.label}
                aria-pressed={weight === entry.value}
                onClick={() => onWeight(entry.value)}
                className={`grid h-8 min-w-9 place-items-center rounded-lg px-1.5 text-[15px] ${
                  weight === entry.value ? 'bg-accent/12 text-accent' : 'text-ink hover:bg-canvas'
                }`}
                style={{ fontWeight: entry.value }}
              >
                Aa
              </button>
            ))}
        </div>
      )}

      <div className="glass flex items-center gap-0.5 rounded-2xl px-2 py-1.5">
        {TOOLS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            title={`${entry.label} (${entry.key})`}
            aria-label={entry.label}
            aria-pressed={tool === entry.id}
            onClick={() => onTool(entry.id)}
            className={`grid size-10 place-items-center rounded-xl transition-colors ${
              tool === entry.id ? 'bg-accent/12 text-accent' : 'text-muted hover:bg-canvas'
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

        <span className="mx-1 h-6 w-px bg-line" />

        <button
          type="button"
          title="Colour"
          aria-label="Colour"
          aria-expanded={palette}
          onClick={() => setPalette((open) => !open)}
          className="grid size-10 place-items-center rounded-xl hover:bg-canvas"
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
      <p className="px-1 pb-1 text-[10px] font-semibold tracking-wide text-muted uppercase">Map</p>
      <div className="relative overflow-hidden rounded-lg bg-canvas" style={{ width: W, height: H }}>
        {items.map((item) => (
          <span
            key={item.id}
            className="absolute rounded-[2px]"
            style={{
              ...at(item.x, item.y),
              width: Math.max(2, item.w * scale),
              height: Math.max(2, item.h * scale),
              background: item.kind === 'frame' ? 'transparent' : PALETTE[item.color]?.dot,
              border: item.kind === 'frame' ? '1px dashed var(--color-line)' : undefined,
            }}
          />
        ))}
        <span
          className="absolute rounded-sm border-2 border-accent/70"
          style={{ ...at(view.x, view.y), width: view.w * scale, height: view.h * scale }}
        />
      </div>
    </div>
  )
}

/* ------------------------------- left rail ------------------------------ */

type LayerRow =
  | { kind: 'group'; id: string; name: string; members: Item[] }
  | { kind: 'item'; item: Item }

/**
 * Fold the flat item list into folders, without losing the stacking order.
 *
 * Walked from the top of the stack down; the first member of a group that turns
 * up is where that group's folder goes, and the rest of its members are drawn
 * inside rather than again further down. So a group sits where its topmost
 * member sat, which is where you would look for it.
 */
function toRows(items: Item[], groups: Record<string, string>): LayerRow[] {
  const rows: LayerRow[] = []
  const done = new Set<string>()

  for (const item of items) {
    const group = item.group
    if (!group || !(group in groups)) {
      rows.push({ kind: 'item', item })
      continue
    }
    if (done.has(group)) continue
    done.add(group)
    rows.push({
      kind: 'group',
      id: group,
      name: groups[group],
      members: items.filter((entry) => entry.group === group),
    })
  }
  return rows
}

/**
 * The rail, and the panel it opens.
 *
 * Two things you cannot otherwise get at on an infinite canvas: who else is here,
 * and what is on the board when it has scrolled out of sight. The layer list
 * doubles as a way back to something — clicking a row brings it into view, which
 * is the only reliable way to find a note you have lost. Clicking a person does
 * the same for them.
 */
export function LeftRail({
  items,
  groups,
  people,
  me,
  onRename,
  onFocus,
  onSelect,
  onJumpTo,
  onRenameItem,
  onRenameGroup,
  onToggleLock,
  onFront,
  onBack,
  selection,
  mounted,
}: {
  items: Item[]
  groups: Record<string, string>
  people: Presence[]
  me: Me
  onRename: (name: string) => void
  onFocus: (id: string) => void
  onSelect: (ids: string[]) => void
  onJumpTo: (peer: Presence) => void
  onRenameItem: (id: string, name: string) => void
  onRenameGroup: (id: string, name: string) => void
  onToggleLock: (id: string) => void
  onFront: (ids: string[]) => void
  onBack: (ids: string[]) => void
  selection: string[]
  mounted: boolean
}) {
  const [open, setOpen] = useState<'people' | 'layers' | null>(null)
  const [closed, setClosed] = useState<Set<string>>(new Set())
  const [renaming, setRenaming] = useState<string | null>(null)

  // Top of the stack first: the layer list reads the way the board is painted,
  // from what is in front down to what is behind it.
  const rows = useMemo(() => toRows([...items].reverse(), groups), [items, groups])

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
        <div className="glass pointer-events-auto absolute top-16 bottom-4 left-14 z-20 flex w-64 flex-col rounded-xl">
          <p className="px-3 pt-2.5 pb-1.5 text-[11px] font-bold tracking-wide text-muted uppercase">
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
                    className="min-w-0 flex-1 rounded-md bg-transparent px-1 py-0.5 text-sm font-semibold outline-none hover:bg-panel/70 focus:bg-panel"
                  />
                  <span className="text-[10px] font-semibold text-muted">you</span>
                </li>
                {mounted &&
                  people.map((peer, i) => (
                    <li key={`${peer.name}-${i}`}>
                      {/* Clicking somebody takes you to them. On a canvas this
                          big, "where are you looking?" is otherwise a question
                          that can only be answered out loud. */}
                      <button
                        type="button"
                        onClick={() => onJumpTo(peer)}
                        disabled={!peer.cursor}
                        title={peer.cursor ? `Jump to ${peer.name}` : `${peer.name} is not on the board`}
                        className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-left enabled:hover:bg-panel/70 disabled:opacity-60"
                      >
                        <Dot color={peer.color} initials={peer.initials} />
                        <span className="min-w-0 flex-1 truncate px-1 text-sm">{peer.name}</span>
                        {peer.cursor && (
                          <svg viewBox="0 0 24 24" className="size-3.5 text-muted" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12h13M13 6l6 6-6 6" />
                          </svg>
                        )}
                      </button>
                    </li>
                  ))}
              </ul>
            ) : rows.length === 0 ? (
              <p className="px-2 py-3 text-sm text-muted">Nothing on the board yet.</p>
            ) : (
              <ul className="space-y-0.5">
                {rows.map((row) =>
                  row.kind === 'group' ? (
                    <li key={row.id}>
                      <Row
                        icon={
                          <svg viewBox="0 0 24 24" className="size-3.5 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 7h6l2 2h10v10H3V7Z" />
                          </svg>
                        }
                        label={row.name}
                        note={`${row.members.length}`}
                        selected={row.members.every((entry) => selection.includes(entry.id))}
                        renaming={renaming === row.id}
                        onRename={(name) => onRenameGroup(row.id, name)}
                        onStartRename={() => setRenaming(row.id)}
                        onDoneRename={() => setRenaming(null)}
                        onClick={() => {
                          const ids = row.members.map((entry) => entry.id)
                          onSelect(ids)
                          onFocus(ids[0])
                        }}
                        onFront={() => onFront(row.members.map((entry) => entry.id))}
                        onBack={() => onBack(row.members.map((entry) => entry.id))}
                        twisty={
                          <button
                            type="button"
                            aria-label={closed.has(row.id) ? 'Expand' : 'Collapse'}
                            onClick={(event) => {
                              event.stopPropagation()
                              setClosed((current) => {
                                const next = new Set(current)
                                if (next.has(row.id)) next.delete(row.id)
                                else next.add(row.id)
                                return next
                              })
                            }}
                            className="grid size-4 shrink-0 place-items-center text-muted"
                          >
                            <svg viewBox="0 0 24 24" className={`size-3 transition-transform ${closed.has(row.id) ? '' : 'rotate-90'}`} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                              <path d="m9 6 6 6-6 6" />
                            </svg>
                          </button>
                        }
                      />
                      {!closed.has(row.id) && (
                        <ul className="ml-4 space-y-0.5 border-l border-line pl-1">
                          {row.members.map((item) => (
                            <li key={item.id}>
                              <ItemRow
                                item={item}
                                selected={selection.includes(item.id)}
                                renaming={renaming === item.id}
                                setRenaming={setRenaming}
                                onSelect={onSelect}
                                onFocus={onFocus}
                                onRenameItem={onRenameItem}
                                onToggleLock={onToggleLock}
                                onFront={onFront}
                                onBack={onBack}
                              />
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ) : (
                    <li key={row.item.id}>
                      <ItemRow
                        item={row.item}
                        selected={selection.includes(row.item.id)}
                        renaming={renaming === row.item.id}
                        setRenaming={setRenaming}
                        onSelect={onSelect}
                        onFocus={onFocus}
                        onRenameItem={onRenameItem}
                        onToggleLock={onToggleLock}
                        onFront={onFront}
                        onBack={onBack}
                      />
                    </li>
                  ),
                )}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function ItemRow({
  item,
  selected,
  renaming,
  setRenaming,
  onSelect,
  onFocus,
  onRenameItem,
  onToggleLock,
  onFront,
  onBack,
}: {
  item: Item
  selected: boolean
  renaming: boolean
  setRenaming: (id: string | null) => void
  onSelect: (ids: string[]) => void
  onFocus: (id: string) => void
  onRenameItem: (id: string, name: string) => void
  onToggleLock: (id: string) => void
  onFront: (ids: string[]) => void
  onBack: (ids: string[]) => void
}) {
  return (
    <Row
      icon={
        <span
          className="size-3.5 shrink-0 rounded-[3px] border border-black/10"
          style={{
            background: item.kind === 'frame' ? 'transparent' : PALETTE[item.color]?.dot,
            borderStyle: item.kind === 'frame' ? 'dashed' : 'solid',
          }}
        />
      }
      label={item.name || item.text || kindName(item.kind)}
      note={kindName(item.kind)}
      locked={item.locked}
      selected={selected}
      renaming={renaming}
      onRename={(name) => onRenameItem(item.id, name)}
      onStartRename={() => setRenaming(item.id)}
      onDoneRename={() => setRenaming(null)}
      onClick={() => {
        onSelect([item.id])
        onFocus(item.id)
      }}
      onLock={() => onToggleLock(item.id)}
      onFront={() => onFront([item.id])}
      onBack={() => onBack([item.id])}
    />
  )
}

/**
 * One line of the layer list.
 *
 * Double-click to rename, in place, rather than a dialog: the name is the only
 * thing on the row worth changing, and a modal for one text field is a modal too
 * many. The order buttons only appear on hover so the list stays readable.
 */
function Row({
  icon,
  label,
  note,
  locked,
  selected,
  renaming,
  twisty,
  onRename,
  onStartRename,
  onDoneRename,
  onClick,
  onLock,
  onFront,
  onBack,
}: {
  icon: React.ReactNode
  label: string
  note?: string
  locked?: boolean
  selected: boolean
  renaming: boolean
  twisty?: React.ReactNode
  onRename: (name: string) => void
  onStartRename: () => void
  onDoneRename: () => void
  onClick: () => void
  onLock?: () => void
  onFront: () => void
  onBack: () => void
}) {
  return (
    <div
      className={`group flex items-center gap-1.5 rounded-lg px-1.5 py-1.5 text-sm ${
        selected ? 'bg-accent/12' : 'hover:bg-panel/70'
      }`}
    >
      {twisty}
      {icon}

      {renaming ? (
        <input
          autoFocus
          defaultValue={label}
          onBlur={(event) => {
            onRename(event.target.value.trim() || label)
            onDoneRename()
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
            if (event.key === 'Escape') onDoneRename()
          }}
          className="min-w-0 flex-1 rounded-md bg-panel px-1 py-0.5 text-sm outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={onClick}
          onDoubleClick={onStartRename}
          className="min-w-0 flex-1 truncate text-left"
        >
          {label}
        </button>
      )}

      <span className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <Tiny label="Bring to front" onClick={onFront}>
          <path d="M12 4v12M7 9l5-5 5 5M5 20h14" />
        </Tiny>
        <Tiny label="Send to back" onClick={onBack}>
          <path d="M12 20V8M7 15l5 5 5-5M5 4h14" />
        </Tiny>
        {onLock && (
          <Tiny label={locked ? 'Unlock' : 'Lock'} onClick={onLock} on={locked}>
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d={locked ? 'M8 11V8a4 4 0 0 1 8 0v3' : 'M8 11V8a4 4 0 0 1 7.7-1.5'} />
          </Tiny>
        )}
      </span>

      {!renaming && note && (
        <span className="shrink-0 text-[10px] text-muted group-hover:hidden">{note}</span>
      )}
      {locked && <span className="sr-only">locked</span>}
    </div>
  )
}

function Tiny({
  label,
  onClick,
  on,
  children,
}: {
  label: string
  onClick: () => void
  on?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      className={`grid size-5 place-items-center rounded ${on ? 'text-accent' : 'text-muted'} hover:bg-canvas hover:text-ink`}
    >
      <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </button>
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
        active ? 'bg-accent/12 text-accent' : 'text-muted hover:bg-panel/70'
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
