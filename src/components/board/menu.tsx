'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * The right-click menu.
 *
 * Its own rather than the browser's, because none of what it offers — send to
 * back, group, lock — is something the browser could know about. Once you take
 * over the right button you owe the person everything the native menu would have
 * given them, so it closes on Escape, on a click anywhere else, and on scroll,
 * and it never opens off the edge of the screen.
 */
export type MenuEntry =
  | { kind: 'divider' }
  | {
      kind?: 'item'
      label: string
      shortcut?: string
      disabled?: boolean
      danger?: boolean
      onSelect: () => void
    }

export function ContextMenu({
  at,
  entries,
  onClose,
}: {
  at: { x: number; y: number }
  entries: MenuEntry[]
  onClose: () => void
}) {
  const panel = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })

  useEffect(() => {
    const node = panel.current
    if (node) setBox({ w: node.offsetWidth, h: node.offsetHeight })
  }, [entries])

  useEffect(() => {
    /**
     * Listened for on the way *down*, not on the way up.
     *
     * Half the board stops pointer events from propagating — a note does it so
     * that pressing on it starts a drag rather than a pan, and a resize grip
     * does it so that it resizes rather than drags. A listener on `window` in
     * the bubble phase therefore never hears about a click on any of them, and
     * the menu stayed open until you happened to click bare canvas. In the
     * capture phase the event reaches here first, before anything downstream
     * gets the chance to swallow it.
     *
     * Which makes the containment check load-bearing: without it, pressing a
     * menu item would close the menu before the click that chose it landed.
     */
    const outside = (event: Event) => {
      if (panel.current?.contains(event.target as Node)) return
      onClose()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    // `pointerdown` rather than `click`: a click that lands on the board would
    // otherwise start a drag underneath the menu on its way to closing it.
    window.addEventListener('pointerdown', outside, true)
    window.addEventListener('wheel', outside, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', outside, true)
      window.removeEventListener('wheel', outside, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  // Flipped rather than clamped: a menu pushed back onto the screen sits under
  // the pointer and swallows the click that opens it.
  const left = box.w && at.x + box.w > window.innerWidth ? at.x - box.w : at.x
  const top = box.h && at.y + box.h > window.innerHeight ? at.y - box.h : at.y

  return (
    <div
      ref={panel}
      // Kept off the board underneath: without this, pressing a menu item also
      // starts a drag on whatever the menu is covering.
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
      className="glass pointer-events-auto fixed z-50 min-w-52 rounded-xl p-1 text-sm"
      style={{ left, top, visibility: box.w ? 'visible' : 'hidden' }}
      role="menu"
    >
      {entries.map((entry, i) =>
        entry.kind === 'divider' ? (
          <span key={`divider-${i}`} className="my-1 block h-px bg-line" />
        ) : (
          <button
            key={entry.label}
            type="button"
            role="menuitem"
            disabled={entry.disabled}
            onClick={() => {
              entry.onSelect()
              onClose()
            }}
            className={`flex w-full items-center gap-6 rounded-lg px-2.5 py-1.5 text-left disabled:opacity-35 ${
              entry.danger
                ? 'text-[#b91c1c] enabled:hover:bg-[#fee2e2] dark:text-[#fca5a5] dark:enabled:hover:bg-[#7f1d1d]/40'
                : 'enabled:hover:bg-accent/10'
            }`}
          >
            <span className="flex-1">{entry.label}</span>
            {entry.shortcut && (
              <span className="text-[11px] tracking-wide text-muted tabular-nums">{entry.shortcut}</span>
            )}
          </button>
        ),
      )}
    </div>
  )
}
