'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { BoardHandle, useHistory } from '@/lib/board'
import { applyTidy, placeTemplate } from '@/lib/board'
import type { Camera, Item } from '@/lib/types'
import { useLang } from '@/lib/i18n'
import { layoutFlowchart, layoutKanban, layoutTimeline } from '@/lib/templates'
import { askGuide, buildDigest, streamGuide, tidyLayout, type ErrorCode, type Group, type Mode } from '@/lib/guide'
import type { GlobeState } from './globe'

type Message = { id: number; from: 'me' | 'guide'; text: string; tidy?: { groups: Group[]; status: 'pending' | 'applied' | 'cancelled' } }

/** The chat card. Loaded on the first click of the globe and not before. */
export default function GuidePanel({
  open,
  onClose,
  onState,
  board,
  items,
  camera,
  viewport,
  history,
  select,
}: {
  open: boolean
  onClose: () => void
  onState: (state: GlobeState) => void
  board: BoardHandle
  items: Item[]
  camera: Camera
  viewport: { w: number; h: number }
  history: ReturnType<typeof useHistory>
  select: (ids: string[]) => void
}) {
  const { lang, t } = useLang()
  const [mode, setMode] = useState<Mode>('plan')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [messages, setMessages] = useState<Message[]>(() => [{ id: 0, from: 'guide', text: t.guideHello }])
  const lock = useRef(false)
  const abort = useRef<AbortController | null>(null)
  const next = useRef(1)
  const list = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)

  const words = useMemo(
    () => Object.fromEntries(Object.entries(t).filter(([, v]) => typeof v === 'string')) as Record<string, string>,
    [t],
  )

  useEffect(() => () => abort.current?.abort(), [])
  useEffect(() => {
    if (open) input.current?.focus()
  }, [open])
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight })
  }, [messages])

  const say = (from: Message['from'], body: string, tidy?: Message['tidy']) => {
    const id = next.current++
    setMessages((all) => [...all, { id, from, text: body, tidy }])
    return id
  }
  const patch = (id: number, change: (m: Message) => Message) =>
    setMessages((all) => all.map((m) => (m.id === id ? change(m) : m)))
  const error = (code: ErrorCode) =>
    ({ quota: t.guideErrQuota, rate_limited: t.guideErrRate, unparseable: t.guideErrUnparseable })[code as 'quota'] ?? t.guideErrOffline

  const centre = { x: (viewport.w / 2 - camera.x) / camera.zoom, y: (viewport.h / 2 - camera.y) / camera.zoom }

  const send = async () => {
    const request = text.trim()
    // A ref, not the `busy` state: two Enters in one frame both see the old render.
    if (!request || lock.current) return
    lock.current = true
    setBusy(true)
    setText('')
    onState('thinking')
    say('me', request)
    const controller = new AbortController()
    abort.current = controller
    const body = { mode, lang, request: request.slice(0, 500), board: { items: buildDigest(items, centre, mode) } }
    let ok = true
    try {
      if (mode === 'summary') {
        const id = say('guide', '')
        const result = await streamGuide(body, (chunk) => patch(id, (m) => ({ ...m, text: m.text + chunk })), controller.signal)
        // What arrived stays; the error line goes under it.
        if (result !== 'done') {
          ok = false
          patch(id, (m) => ({ ...m, text: m.text ? `${m.text}\n\n${error(result.code)}` : error(result.code) }))
        }
      } else {
        const answer = await askGuide(body, controller.signal)
        if (answer.kind === 'error') {
          ok = false
          say('guide', error(answer.code))
        } else if (answer.kind === 'plan') {
          const plan = answer.plan
          const title = plan.title || t.untitled
          // An unknown type from a newer server has no layout: it falls through to the empty line.
          const drafts =
            plan.type === 'kanban' && Array.isArray(plan.columns)
              ? layoutKanban(words, centre, plan.title, plan.columns)
              : plan.type === 'timeline' && Array.isArray(plan.milestones)
                ? layoutTimeline(words, centre, plan.title, plan.milestones)
                : plan.type === 'flowchart' && Array.isArray(plan.nodes) && Array.isArray(plan.edges)
                  ? layoutFlowchart(words, centre, plan.title, plan.nodes, plan.edges)
                  : []
          history.seal()
          const ids = drafts.length ? placeTemplate(board, drafts, title) : []
          history.seal()
          if (ids.length) {
            select(ids)
            say(
              'guide',
              plan.type === 'kanban'
                ? t.guidePlanKanban(title, plan.columns.length)
                : plan.type === 'timeline'
                  ? t.guidePlanTimeline(title, plan.milestones.length)
                  : t.guidePlanFlow(title, plan.nodes.length),
            )
          } else {
            ok = false
            say('guide', t.guidePlanEmpty)
          }
        } else {
          const byId = new Map(items.map((i) => [i.id, i]))
          const { moves, frames } = tidyLayout(answer.groups, byId)
          if (moves.length) say('guide', t.guideTidyConfirm(moves.length, frames.length), { groups: answer.groups, status: 'pending' })
          else say('guide', t.guideTidyNone)
        }
      }
    } catch {
      // Aborted means the panel is gone and nobody is waiting; anything else is a broken answer.
      ok = false
      if (!controller.signal.aborted) say('guide', t.guideErrUnparseable)
    } finally {
      lock.current = false
      setBusy(false)
      onState(ok ? 'done' : 'idle')
      if (open) input.current?.focus()
    }
  }

  /** Re-run the layout against the board as it is now: a note deleted since is skipped, and a note somebody moved into a frame is left. */
  const apply = (id: number, groups: Group[]) => {
    const { frames, moves } = tidyLayout(groups, new Map(items.map((i) => [i.id, i])))
    history.seal()
    if (moves.length) applyTidy(board, frames, moves)
    history.seal()
    patch(id, (m) => ({ ...m, tidy: { groups, status: 'applied' } }))
    say('guide', moves.length ? t.guideTidyDone : t.guideTidyNone)
  }
  const cancel = (id: number, groups: Group[]) => {
    patch(id, (m) => ({ ...m, tidy: { groups, status: 'cancelled' } }))
    say('guide', t.guideTidyCancelled)
  }

  const hints: Record<Mode, string> = { plan: t.guidePlanHint, summary: t.guideSummaryHint, tidy: t.guideTidyHint }
  const modes: [Mode, string][] = [['plan', t.guideModePlan], ['summary', t.guideModeSummary], ['tidy', t.guideModeTidy]]

  return (
    <section
      hidden={!open}
      aria-label={t.guideName}
      className="glass absolute right-4 bottom-[256px] z-30 flex max-h-[min(480px,calc(100%-20rem))] w-[360px] max-w-[calc(100%-2rem)] flex-col rounded-xl"
      style={{ height: 480 }}
    >
      <header className="flex items-center justify-between border-b border-line px-3 py-2">
        <span className="font-hand text-base font-bold">{t.guideName}</span>
        <button
          type="button"
          aria-label={t.guideCloseChat}
          onClick={onClose}
          className="grid h-7 w-7 cursor-pointer place-items-center rounded-md text-lg leading-none hover:bg-line/60"
        >
          &times;
        </button>
      </header>

      <div ref={list} aria-live="polite" className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-2">
        {messages.map((m) =>
          m.from === 'me' ? (
            <p key={m.id} className="sticky-text ml-8 self-end rounded-lg border border-line bg-accent/15 px-2.5 py-1.5 text-sm">
              {m.text}
            </p>
          ) : (
            <div key={m.id} className="mr-6 self-start">
              <p className="sticky-text font-hand text-base leading-snug">{m.text || (busy ? t.guideThinking : '')}</p>
              {m.tidy?.status === 'pending' && (
                <div className="mt-1.5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => m.tidy && apply(m.id, m.tidy.groups)}
                    className="cursor-pointer rounded-md border-[1.5px] border-ink bg-accent px-2.5 py-1 text-xs font-semibold text-on-accent"
                  >
                    {t.guideApply}
                  </button>
                  <button
                    type="button"
                    onClick={() => m.tidy && cancel(m.id, m.tidy.groups)}
                    className="cursor-pointer rounded-md border-[1.5px] border-ink px-2.5 py-1 text-xs font-semibold"
                  >
                    {t.guideCancel}
                  </button>
                </div>
              )}
            </div>
          ),
        )}
      </div>

      <div role="group" aria-label={t.guideModes} className="flex gap-1.5 px-3 pb-1.5">
        {modes.map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={mode === id}
            onClick={() => setMode(id)}
            className={`cursor-pointer rounded-full border-[1.5px] border-ink px-2.5 py-0.5 text-xs font-semibold ${mode === id ? 'bg-accent text-on-accent' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>
      <form
        className="flex gap-1.5 px-3 pb-3"
        onSubmit={(event) => {
          event.preventDefault()
          void send()
        }}
      >
        <input
          ref={input}
          value={text}
          disabled={busy}
          maxLength={500}
          onChange={(event) => setText(event.target.value)}
          placeholder={hints[mode]}
          className="min-w-0 flex-1 rounded-md border-[1.5px] border-ink bg-canvas px-2 py-1.5 text-sm outline-none focus:border-accent disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="cursor-pointer rounded-md border-[1.5px] border-ink bg-accent px-3 text-sm font-semibold text-on-accent disabled:opacity-50"
        >
          {t.guideSend}
        </button>
      </form>
    </section>
  )
}
