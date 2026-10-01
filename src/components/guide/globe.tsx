'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import type { BoardHandle } from '@/lib/board'
import type { Camera, Item } from '@/lib/types'
import { useLang } from '@/lib/i18n'
import type { useHistory } from '@/lib/board'

export type GlobeState = 'idle' | 'thinking' | 'done'

/**
 * Mr. Worldwide, redrawn for the board: a Riso globe, pink over a blue that did
 * not quite register, with ink lines for the latitudes and longitudes.
 *
 * A static SVG with CSS-only states; the keyframes live in `globals.css`.
 */
export function Globe({ state }: { state: GlobeState }) {
  // Printed ink, the same in both themes: the theme's ink is cream in dark mode,
  // and cream pupils on white eyes disappear.
  const ink = '#1B1B3A'
  return (
    <span className="gl block" data-state={state}>
      <svg viewBox="0 0 56 56" width="56" height="56" aria-hidden="true">
        <path d="M16 45 q0-4 4-4 h9 q4 0 4 4 v3 h-17z M16 47 h17" fill="#fff" stroke={ink} strokeWidth="1.2" strokeLinejoin="round" />
        <circle cx="29.5" cy="26.5" r="20" fill="#0078BF" />
        <circle cx="28" cy="25" r="20" fill="#FF48B0" stroke={ink} strokeWidth="1.3" />
        <g className="gl-lat" fill="none" stroke={ink} strokeWidth="1" opacity="0.75">
          <ellipse cx="28" cy="14" rx="17" ry="3" />
          <ellipse cx="28" cy="25" rx="20" ry="4" />
          <ellipse cx="28" cy="36" rx="17" ry="3" />
        </g>
        <g fill="none" stroke={ink} strokeWidth="1" opacity="0.75">
          <ellipse cx="28" cy="25" rx="9" ry="20" />
          <ellipse cx="28" cy="25" rx="16" ry="20" />
        </g>
        <g className="gl-eyes">
          <ellipse cx="22" cy="24" rx="4.5" ry="5.5" fill="#fff" stroke={ink} strokeWidth="1" />
          <ellipse cx="34" cy="24" rx="4.5" ry="5.5" fill="#fff" stroke={ink} strokeWidth="1" />
          <circle cx="23" cy="25" r="2" fill={ink} />
          <circle cx="35" cy="25" r="2" fill={ink} />
        </g>
        <path d="M17 15.5 l9 1.5 M39 15.5 l-9 1.5" stroke={ink} strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </span>
  )
}

// Nothing of the chat is loaded until the globe is first clicked.
const GuidePanel = dynamic(() => import('./guide-panel'), { ssr: false })

/**
 * The globe and, once it has been opened, the chat card.
 *
 * Sits 12px above the minimap's corner. The card stays mounted after it is
 * closed, only hidden, so what was said is still there when it comes back.
 */
export function Guide({
  board,
  items,
  camera,
  viewport,
  history,
  select,
  open,
  onOpen,
}: {
  board: BoardHandle
  items: Item[]
  camera: Camera
  viewport: { w: number; h: number }
  history: ReturnType<typeof useHistory>
  select: (ids: string[]) => void
  /** Owned by the board so the welcome can open the guide too. */
  open: boolean
  onOpen: (open: boolean) => void
}) {
  const { t } = useLang()
  const [loaded, setLoaded] = useState(false)
  if (open && !loaded) setLoaded(true)
  const [state, setState] = useState<GlobeState>('idle')

  return (
    <>
      {loaded && (
        <GuidePanel
          open={open}
          onClose={() => onOpen(false)}
          onState={setState}
          board={board}
          items={items}
          camera={camera}
          viewport={viewport}
          history={history}
          select={select}
        />
      )}
      <button
        type="button"
        aria-label={`${t.guideName} (${open ? t.guideCloseWord : t.guideOpenWord})`}
        aria-expanded={open}
        onClick={() => onOpen(!open)}
        className="absolute right-4 bottom-[188px] z-30 h-14 w-14 cursor-pointer rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <Globe state={state} />
      </button>
    </>
  )
}
