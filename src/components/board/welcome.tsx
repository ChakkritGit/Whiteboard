'use client'

import { useState } from 'react'
import rough from 'roughjs'
import { useMounted } from '@/lib/board'
import { useLang } from '@/lib/i18n'
import { Logo } from './logo'
import { TOOLS } from './chrome'

const gen = rough.generator()

/**
 * A hand-drawn arrow through three points, with a two-stroke head turned to
 * match where the curve is going. Seeded, so it is the same on every render.
 */
function arrow(pts: [number, number][], seed: number): string {
  const opts = { seed, roughness: 1, strokeWidth: 1.5 }
  const [[bx, by], [ex, ey]] = [pts[pts.length - 2], pts[pts.length - 1]]
  const a = Math.atan2(ey - by, ex - bx)
  const head = (turn: number) =>
    gen.line(ex, ey, ex - 11 * Math.cos(a + turn), ey - 11 * Math.sin(a + turn), { ...opts, seed: seed + 1 })
  return [gen.curve(pts, opts), head(0.5), head(-0.5)]
    .flatMap((shape) => gen.toPaths(shape).map((p) => p.d))
    .join(' ')
}

const ARROWS = {
  tools: { w: 60, h: 56, d: arrow([[22, 2], [40, 24], [30, 50]], 11) },
  guide: { w: 70, h: 44, d: arrow([[2, 34], [26, 6], [64, 22]], 23) },
  share: { w: 56, h: 60, d: arrow([[10, 58], [40, 36], [34, 6]], 37) },
}

function Arrow({ name }: { name: keyof typeof ARROWS }) {
  const { w, h, d } = ARROWS[name]
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} fill="none" stroke="var(--color-muted)" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

const note = 'font-hand text-[17px] leading-tight text-muted'

/**
 * What an empty board says on first open. Everything is `pointer-events: none`
 * but the three buttons, so it never gets between you and the board. It goes the
 * first time anything exists and stays gone for the session, undo included.
 */
export function Welcome({
  empty,
  onTemplates,
  onGuide,
  onFile,
}: {
  empty: boolean
  onTemplates: () => void
  onGuide: () => void
  onFile: () => void
}) {
  const { t } = useLang()
  const mounted = useMounted()
  const [seen, setSeen] = useState(false)
  if (!empty && !seen) setSeen(true)
  if (!mounted) return null

  const key = (id: string) => TOOLS.find((entry) => entry.id === id)?.key
  const button = 'glass pointer-events-auto rounded-lg px-3 py-1.5 text-sm font-semibold hover:-translate-y-px'

  return (
    <div className="welcome pointer-events-none fixed inset-0 z-10" data-hidden={seen} aria-hidden={seen}>
      <div className="absolute inset-0 grid place-items-center">
        <div className="flex max-w-[min(30rem,calc(100vw-9rem))] flex-col items-center gap-3 text-center">
          <Logo size={64} />
          <p className="font-hand text-xl leading-snug text-ink">{t.welcomeLine}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" onClick={onTemplates} className={button}>
              {t.welcomeTemplates}
            </button>
            <button type="button" onClick={onGuide} className={button}>
              {t.welcomeAsk}
            </button>
            <button type="button" onClick={onFile} className={button}>
              {t.welcomeOpenFile}
            </button>
          </div>
          <p className="font-mono text-xs text-muted">
            {key('sticky')} {t.keyNote} · {key('shape')} {t.keyShape} · {key('arrow')} {t.keyArrow}
          </p>
        </div>
      </div>

      <div className="absolute bottom-[96px] left-1/2 flex -translate-x-1/2 flex-col items-center">
        <p className={`${note} text-center`}>{t.hintTools}</p>
        <Arrow name="tools" />
      </div>

      <div className="absolute right-[84px] bottom-[196px] hidden items-center gap-1 sm:flex">
        <p className={`${note} max-w-[9rem] text-right`}>{t.hintGuide}</p>
        <Arrow name="guide" />
      </div>

      <div className="absolute top-[62px] right-5 hidden flex-col items-end sm:flex">
        <Arrow name="share" />
        <p className={`${note} max-w-[13rem] text-right`}>{t.hintShare}</p>
      </div>
    </div>
  )
}
