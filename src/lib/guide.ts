import type { Item, Swatch } from './types'
import type { Draft, FlowEdge, FlowNode } from './templates'

/**
 * Mr. Worldwide's side of the wire, as plain functions.
 *
 * Only types and `fetch` in here, no React and no Yjs, so `npm run check` can
 * load it under Node. The server half lives in the portfolio's worker; the
 * contract is: a digest goes up, and a plan, a list of groups or a stream of
 * words comes back.
 */
export type Mode = 'plan' | 'summary' | 'tidy'
export type DigestItem = { id: string; kind: string; text: string; x: number; y: number; frame?: string }
export type Plan =
  | { type: 'kanban'; title: string; columns: { title: string; cards: string[] }[] }
  | { type: 'timeline'; title: string; milestones: { title: string; note?: string }[] }
  | { type: 'flowchart'; title: string; nodes: FlowNode[]; edges: FlowEdge[] }
  /** A question rather than something to draw: said in the chat only. */
  | { type: 'answer'; text: string }
export type Group = { title: string; ids: string[] }
type Body = { mode: Mode; lang: 'th' | 'en'; request: string; board: { items: DigestItem[] } }
export type ErrorCode = 'quota' | 'rate_limited' | 'unparseable' | 'upstream' | 'bad_request' | 'forbidden' | 'offline'

export const ASSISTANT_URL = process.env.NEXT_PUBLIC_ASSISTANT_URL ?? 'https://chakkritton.com/api/assistant/board'

const MAX_ITEMS = 120
const MAX_TEXT = 120

/* ------------------------------- the digest ------------------------------ */

const inside = (item: Item, box: Item) => {
  const cx = item.x + item.w / 2
  const cy = item.y + item.h / 2
  return cx >= box.x && cx <= box.x + box.w && cy >= box.y && cy <= box.y + box.h
}

/**
 * What the model gets to see of the board.
 *
 * Capped at 120 items, the nearest to `centre` first, because that is what the
 * worker accepts and the part of the board somebody is looking at is the part
 * they are asking about. Tidy only offers notes it is allowed to move: not
 * locked, and not already inside a frame somebody built.
 */
export function buildDigest(items: Item[], centre: { x: number; y: number }, mode: Mode): DigestItem[] {
  const frames = items.filter((i) => i.kind === 'frame')
  const kinds = mode === 'tidy' ? ['sticky', 'text'] : ['sticky', 'text', 'shape', 'frame']
  const picked: { item: Item; frame?: Item; d: number }[] = []
  for (const item of items) {
    if (!kinds.includes(item.kind) || !item.text.trim()) continue
    const home = frames.find((f) => f !== item && inside(item, f))
    if (mode === 'tidy' && (item.locked || home)) continue
    const d = Math.hypot(item.x + item.w / 2 - centre.x, item.y + item.h / 2 - centre.y)
    picked.push({ item, frame: home, d })
  }
  return picked
    .sort((a, b) => a.d - b.d)
    .slice(0, MAX_ITEMS)
    .map(({ item, frame }) => {
      const row: DigestItem = {
        id: item.id,
        kind: item.kind,
        text: item.text.slice(0, MAX_TEXT).trim(),
        x: Math.round(item.x),
        y: Math.round(item.y),
      }
      if (mode !== 'tidy' && frame?.text.trim()) row.frame = frame.text.slice(0, MAX_TEXT).trim()
      return row
    })
}

/* -------------------------------- the calls ------------------------------ */

const BY_STATUS: Record<number, ErrorCode> = {
  400: 'bad_request',
  403: 'forbidden',
  422: 'unparseable',
  429: 'rate_limited',
  502: 'upstream',
  503: 'quota',
}

/** The worker says what went wrong in `code`; the status is the fallback. */
async function failure(res: Response): Promise<ErrorCode> {
  try {
    const code = ((await res.json()) as { code?: ErrorCode }).code
    if (code && Object.values(BY_STATUS).includes(code)) return code
  } catch {
    // not JSON; the status will do
  }
  return BY_STATUS[res.status] ?? 'upstream'
}

/** The site's own chat, beside the board endpoint: it knows every article and sends cards. */
export const CHAT_URL = ASSISTANT_URL.replace(/\/board$/, '')

/** An article or project the chat pointed at. Only links back to the site are kept. */
export type Card = { id: string; kind: 'post' | 'project'; title: string; url: string }

export function toCards(items: unknown): Card[] {
  if (!Array.isArray(items)) return []
  const site = new URL(CHAT_URL).origin + '/'
  return items
    .filter(
      (c): c is Card =>
        !!c &&
        typeof c.id === 'string' &&
        (c.kind === 'post' || c.kind === 'project') &&
        typeof c.title === 'string' &&
        typeof c.url === 'string' &&
        c.url.startsWith(site),
    )
    .slice(0, 3)
}

const post = (body: unknown, signal: AbortSignal, url = ASSISTANT_URL) =>
  fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })

export async function askGuide(
  body: Body,
  signal: AbortSignal,
): Promise<{ kind: 'plan'; plan: Plan } | { kind: 'tidy'; groups: Group[] } | { kind: 'error'; code: ErrorCode }> {
  try {
    const res = await post(body, signal)
    if (!res.ok) return { kind: 'error', code: await failure(res) }
    const json = (await res.json()) as { plan?: Plan; groups?: Group[] }
    if (body.mode === 'plan' && json.plan && typeof json.plan === 'object') return { kind: 'plan', plan: json.plan }
    if (body.mode === 'tidy' && Array.isArray(json.groups)) return { kind: 'tidy', groups: json.groups }
    return { kind: 'error', code: 'unparseable' }
  } catch (error) {
    if (signal.aborted) throw error
    return { kind: 'error', code: 'offline' }
  }
}

/**
 * Split an event stream into whole events.
 *
 * A chunk can end in the middle of one, so what is left over comes back as
 * `carry` to be put in front of the next chunk.
 */
export function parseSse(chunk: string, carry: string): { events: { event: string; data: string }[]; carry: string } {
  const parts = (carry + chunk).replace(/\r\n/g, '\n').split('\n\n')
  const rest = parts.pop() ?? ''
  const events = parts.map((part) => {
    let event = 'message'
    const data: string[] = []
    for (const line of part.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim()
      else if (line.startsWith('data:')) data.push(line.slice(5).trim())
    }
    return { event, data: data.join('\n') }
  })
  return { events, carry: rest }
}

/** Feed `onText` as the words arrive. Never leaves the caller waiting: every way out returns. */
export async function streamGuide(
  body: unknown,
  onText: (t: string) => void,
  signal: AbortSignal,
  /** The site's chat instead of the board, for a question; its cards come to `onCards`. */
  chat?: { onCards: (cards: Card[]) => void },
): Promise<'done' | { code: ErrorCode }> {
  try {
    const res = await post(body, signal, chat ? CHAT_URL : ASSISTANT_URL)
    if (!res.ok) return { code: await failure(res) }
    if (!res.body) return { code: 'upstream' }
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let carry = ''
    for (;;) {
      const { value, done } = await reader.read()
      const parsed = parseSse(value ? decoder.decode(value, { stream: true }) : '\n\n', carry)
      carry = parsed.carry
      for (const { event, data } of parsed.events) {
        if (event === 'done') return 'done'
        if (event === 'error') {
          let code: ErrorCode = 'upstream'
          try {
            const sent = (JSON.parse(data) as { code?: ErrorCode }).code
            if (sent && Object.values(BY_STATUS).includes(sent)) code = sent
          } catch {
            // keep upstream
          }
          return { code }
        }
        if (event === 'text') {
          try {
            const t = (JSON.parse(data) as { t?: unknown }).t
            if (typeof t === 'string') onText(t)
          } catch {
            // a torn event carries nothing worth showing
          }
        }
        if (event === 'cards' && chat) {
          try {
            const cards = toCards((JSON.parse(data) as { items?: unknown }).items)
            if (cards.length) chat.onCards(cards)
          } catch {
            // no cards, the words still stand
          }
        }
      }
      // The stream closed without saying done: what arrived stands, plus an error.
      if (done) return { code: 'upstream' }
    }
  } catch (error) {
    if (signal.aborted) throw error
    return { code: 'offline' }
  }
}

/* -------------------------------- tidying -------------------------------- */

const SWATCHES: Swatch[] = ['sky', 'amber', 'green', 'pink', 'lavender', 'mint']
const GAP = 24
const PAD = 32
/** Room along the top of a frame for its title. */
const HEAD = 48
const GROUP_GAP = 48

/**
 * Turn the model's groups into frames and moves.
 *
 * Trusts nothing in the answer: an id that is missing, locked, not a note, or
 * already inside a frame is dropped silently, a note named twice stays with the
 * first group, and a group left with fewer than two notes is not worth a frame.
 * `origin` defaults to the top-left of everything that is moving, so the tidy
 * lands where the mess was.
 */
export function tidyLayout(
  groups: Group[],
  byId: Map<string, Item>,
  origin?: { x: number; y: number },
): { frames: Draft[]; moves: { id: string; x: number; y: number }[] } {
  const frames = [...byId.values()].filter((i) => i.kind === 'frame')
  const seen = new Set<string>()
  const kept: { title: string; notes: Item[] }[] = []
  for (const group of groups) {
    const notes: Item[] = []
    for (const id of Array.isArray(group.ids) ? group.ids : []) {
      const item = byId.get(id)
      if (!item || seen.has(id) || item.locked || (item.kind !== 'sticky' && item.kind !== 'text')) continue
      if (frames.some((f) => inside(item, f))) continue
      seen.add(id)
      notes.push(item)
    }
    if (notes.length >= 2) kept.push({ title: String(group.title ?? '').slice(0, 60), notes })
  }
  if (!kept.length) return { frames: [], moves: [] }

  const all = kept.flatMap((g) => g.notes)
  let left = origin?.x ?? Math.min(...all.map((i) => i.x))
  const top = origin?.y ?? Math.min(...all.map((i) => i.y))
  const out: Draft[] = []
  const moves: { id: string; x: number; y: number }[] = []
  kept.forEach((group, g) => {
    const cols = Math.ceil(Math.sqrt(group.notes.length))
    const rows = Math.ceil(group.notes.length / cols)
    const colW = Array.from({ length: cols }, (_, c) => Math.max(...group.notes.filter((_n, i) => i % cols === c).map((n) => n.w)))
    const rowH = Array.from({ length: rows }, (_, r) => Math.max(...group.notes.slice(r * cols, r * cols + cols).map((n) => n.h)))
    const sum = (a: number[], to: number) => a.slice(0, to).reduce((x, y) => x + y, 0) + to * GAP
    group.notes.forEach((note, i) => {
      const c = i % cols
      const r = Math.floor(i / cols)
      moves.push({ id: note.id, x: Math.round(left + PAD + sum(colW, c)), y: Math.round(top + HEAD + sum(rowH, r)) })
    })
    const w = PAD * 2 + sum(colW, cols) - GAP
    const h = HEAD + PAD + sum(rowH, rows) - GAP
    out.push({ kind: 'frame', x: Math.round(left), y: Math.round(top), w, h, text: group.title, color: SWATCHES[g % SWATCHES.length] })
    left += w + GROUP_GAP
  })
  return { frames: out, moves }
}
