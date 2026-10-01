import type { Item, Swatch } from './types'

/**
 * Starting layouts, as plain data.
 *
 * No React and no Yjs in here: a template is a list of drafts, and `placeTemplate`
 * in `board.ts` is what puts them on a board. That keeps this loadable under Node
 * for `npm run check`, and lets Mr. Worldwide call the layout functions with
 * content the model wrote.
 *
 * A draft is an item without an id or a z. A connector names the drafts it joins
 * by `ref`, as `'@name'`, because the real ids do not exist until it is placed.
 */
export type Draft = Omit<Item, 'id' | 'z' | 'from' | 'to'> & { ref?: string; from?: string; to?: string }
export type TemplateId = 'kanban' | 'timeline' | 'retro' | 'mindmap' | 'flowchart' | 'architecture' | 'storymap' | 'sprint'
/** A flat slice of the dictionary, so this module never touches the i18n hook. */
export type Words = Record<string, string>
type Point = { x: number; y: number }

const GRID = 24
const CARD_W = 200
const CARD_H = 120
const GAP = 24
const PAD = 32

/* ------------------------------- the parts ------------------------------ */

const sticky = (x: number, y: number, text: string, color: Swatch, h = CARD_H): Draft => ({
  kind: 'sticky', x, y, w: CARD_W, h, text, color,
})
const frame = (x: number, y: number, w: number, h: number, text: string, color: Swatch): Draft => ({
  kind: 'frame', x, y, w, h, text, color,
})
const label = (x: number, y: number, w: number, text: string): Draft => ({
  kind: 'text', x, y, w, h: 32, text, color: 'slate',
})
/** A node is a shape that carries its own centred label. */
const node = (
  ref: string, x: number, y: number, w: number, h: number,
  text: string, color: Swatch, shape: 'rect' | 'ellipse' | 'diamond' = 'rect',
): Draft[] => [{ kind: 'shape', shape, ref, x, y, w, h, text, color }]
const link = (from: string, to: string, head: 'end' | 'none' = 'end'): Draft => ({
  kind: 'connector', from: `@${from}`, to: `@${to}`, head, x: 0, y: 0, w: 1, h: 1, text: '', color: 'slate',
})

/**
 * Put the layout's middle on `origin`, on the grid.
 *
 * Laid out around zero, then shifted: the box is measured from everything that
 * has a place of its own, which leaves out a connector bound to other drafts.
 */
function centred(drafts: Draft[], origin: Point): Draft[] {
  const placed = drafts.filter((d) => !(d.kind === 'connector' && (d.from || d.to)))
  if (!placed.length) return drafts
  const minX = Math.min(...placed.map((d) => d.x))
  const minY = Math.min(...placed.map((d) => d.y))
  const maxX = Math.max(...placed.map((d) => d.x + d.w))
  const maxY = Math.max(...placed.map((d) => d.y + d.h))
  const dx = Math.round((origin.x - (minX + maxX) / 2) / GRID) * GRID
  const dy = Math.round((origin.y - (minY + maxY) / 2) / GRID) * GRID
  return drafts.map((d) => ({
    ...d,
    x: d.x + dx,
    y: d.y + dy,
    points: d.points?.map((value, i) => value + (i % 2 ? dy : dx)),
  }))
}

/* ------------------------------- layouts -------------------------------- */

/** A guess at how tall a card has to be for its words: about 18 characters to a line. */
const cardHeight = (text: string) => Math.max(CARD_H, Math.ceil((Math.ceil(text.length / 18) * 22 + 24) / GRID) * GRID)

export function layoutKanban(
  w: Words,
  origin: Point,
  title: string,
  columns: { title: string; cards: string[] }[],
): Draft[] {
  if (!columns.length) return []
  const colors: Swatch[] = ['sky', 'amber', 'green']
  const heights = columns.map((c) => c.cards.reduce((sum, card) => sum + cardHeight(card) + GAP, 0) + 80)
  // One height for all of them, so the board reads as a row rather than a skyline.
  const tall = Math.max(300, ...heights)
  const out: Draft[] = []
  columns.forEach((col, i) => {
    const x = i * (CARD_W + PAD * 2 + 48)
    const color = colors[i % colors.length]
    out.push(frame(x, 0, CARD_W + PAD * 2, tall, col.title || title || w.tplKanban, color))
    let y = 48
    for (const card of col.cards) {
      const h = cardHeight(card)
      out.push(sticky(x + PAD, y, card, color, h))
      y += h + GAP
    }
  })
  return centred(out, origin)
}

export function layoutTimeline(
  w: Words,
  origin: Point,
  title: string,
  milestones: { title: string; note?: string }[],
): Draft[] {
  void w
  void title
  if (!milestones.length) return []
  const step = 260
  const out: Draft[] = [
    {
      kind: 'connector', head: 'end', x: -48, y: 0, w: (milestones.length - 1) * step + 96 + 80 + 48, h: 1, text: '', color: 'slate',
      points: [-48, 0, (milestones.length - 1) * step + 96 + 80, 0],
    },
  ]
  milestones.forEach((m, i) => {
    out.push({ kind: 'shape', shape: 'diamond', x: i * step, y: -48, w: 96, h: 96, text: '', color: 'indigo' })
    out.push(label(i * step - 50, 72, 196, m.note ? `${m.title}\n${m.note}` : m.title))
  })
  return centred(out, origin)
}

function retro(w: Words, origin: Point) {
  const cols: [string, Swatch][] = [[w.tplWentWell, 'green'], [w.tplImprove, 'amber'], [w.tplActions, 'pink']]
  const out: Draft[] = []
  cols.forEach(([name, color], i) => {
    out.push(frame(i * 368, 0, 320, 480, name, color))
    out.push(sticky(i * 368 + 60, 48, w.tplRetroNote, color))
  })
  return centred(out, origin)
}

function mindmap(w: Words, origin: Point) {
  const out: Draft[] = [...node('centre', -120, -60, 240, 120, w.tplTopic, 'magenta', 'ellipse')]
  const spots: [number, number, Swatch][] = [[0, -320, 'sky'], [320, 0, 'amber'], [0, 320, 'green'], [-320, 0, 'pink']]
  spots.forEach(([cx, cy, color], i) => {
    out.push({ ...sticky(cx - CARD_W / 2, cy - CARD_H / 2, `${w.tplBranch} ${i + 1}`, color), ref: `b${i + 1}` })
    out.push(link('centre', `b${i + 1}`, 'none'))
  })
  return centred(out, origin)
}

function flowchart(w: Words, origin: Point) {
  const out: Draft[] = [
    ...node('start', -96, 0, 192, 72, w.tplStart, 'green', 'ellipse'),
    ...node('work', -120, 144, 240, 96, w.tplProcess, 'sky'),
    ...node('check', -120, 312, 240, 144, w.tplDecision, 'amber', 'diamond'),
    ...node('yes', -336, 528, 192, 96, w.tplYes, 'mint'),
    ...node('no', 144, 528, 192, 96, w.tplNo, 'pink'),
    ...node('end', 144, 696, 192, 72, w.tplEnd, 'slate', 'ellipse'),
    link('start', 'work'), link('work', 'check'), link('check', 'yes'), link('check', 'no'), link('no', 'end'),
  ]
  return centred(out, origin)
}

function architecture(w: Words, origin: Point) {
  const out: Draft[] = [
    frame(0, 0, 888, 360, w.tplSystem, 'slate'),
    ...node('client', 48, 144, 144, 72, w.tplClient, 'sky'),
    ...node('api', 264, 144, 144, 72, w.tplApi, 'indigo'),
    ...node('db', 480, 48, 144, 72, w.tplDb, 'green'),
    ...node('queue', 480, 240, 144, 72, w.tplQueue, 'amber'),
    ...node('worker', 696, 240, 144, 72, w.tplWorker, 'pink'),
    link('client', 'api'), link('api', 'db'), link('api', 'queue'), link('queue', 'worker'),
  ]
  return centred(out, origin)
}

function storymap(w: Words, origin: Point) {
  const out: Draft[] = [label(-168, 144, 160, w.tplRelease)]
  for (let i = 0; i < 4; i++) {
    out.push(sticky(i * (CARD_W + GAP), 0, `${w.tplActivity} ${i + 1}`, 'sky'))
    for (let j = 0; j < 2; j++) {
      out.push(sticky(i * (CARD_W + GAP), 144 + j * 144, `${w.tplStory} ${i + 1}.${j + 1}`, 'yellow'))
    }
  }
  return centred(out, origin)
}

function sprint(w: Words, origin: Point) {
  const names = [w.tplBacklog, w.tplSprintCol, w.tplReview, w.tplDone]
  const out: Draft[] = [{ ...sticky(480, 0, w.tplGoal, 'magenta'), w: 240 }]
  names.forEach((name, i) => out.push(frame(i * 312, 192, 264, 480, name, 'slate')))
  return centred(out, origin)
}

export const TEMPLATES: {
  id: TemplateId
  group: 'planning' | 'software'
  build: (w: Words, origin: Point) => Draft[]
}[] = [
  {
    id: 'kanban',
    group: 'planning',
    build: (w, origin) =>
      layoutKanban(w, origin, w.tplKanban, [
        { title: w.tplTodo, cards: [w.tplCard1, w.tplCard2] },
        { title: w.tplDoing, cards: [] },
        { title: w.tplDone, cards: [] },
      ]),
  },
  {
    id: 'timeline',
    group: 'planning',
    build: (w, origin) =>
      layoutTimeline(w, origin, w.tplTimeline, [1, 2, 3, 4, 5].map((n) => ({ title: `${w.tplMilestone} ${n}` }))),
  },
  { id: 'retro', group: 'planning', build: retro },
  { id: 'mindmap', group: 'planning', build: mindmap },
  { id: 'flowchart', group: 'software', build: flowchart },
  { id: 'architecture', group: 'software', build: architecture },
  { id: 'storymap', group: 'software', build: storymap },
  { id: 'sprint', group: 'software', build: sprint },
]

/* ------------------------------ placing them ---------------------------- */

/**
 * Give drafts their ids and point connectors at them.
 *
 * A connector that names a ref this template does not have is dropped: a
 * dangling `from` is a connector bound to nothing, which the board would draw
 * from its stale stored point forever. `z` is left to the caller.
 */
export function resolveRefs(drafts: Draft[], newId: () => string): Omit<Item, 'z'>[] {
  const ids = new Map<string, string>()
  const withIds = drafts.map((d) => {
    const id = newId()
    if (d.ref) ids.set(d.ref, id)
    return { d, id }
  })
  const rows: Omit<Item, 'z'>[] = []
  const placed = new Map<string, Omit<Item, 'z'>>()
  for (const { d, id } of withIds) {
    const { ref, from, to, ...rest } = d
    void ref
    const row: Omit<Item, 'z'> = { ...rest, id }
    if (d.kind === 'connector') {
      const end = (name?: string) => (name?.startsWith('@') ? ids.get(name.slice(1)) : name)
      const a = end(from)
      const b = end(to)
      if ((from && !a) || (to && !b)) continue
      if (a) row.from = a
      if (b) row.to = b
    }
    rows.push(row)
    placed.set(id, row)
  }
  // Stored ends from the centres of what they join; the live view recomputes the edges.
  for (const row of rows) {
    if (row.kind !== 'connector' || !row.from || !row.to) continue
    const a = placed.get(row.from)
    const b = placed.get(row.to)
    if (!a || !b) continue
    const ends = [a.x + a.w / 2, a.y + a.h / 2, b.x + b.w / 2, b.y + b.h / 2]
    row.points = ends
    row.x = Math.min(ends[0], ends[2])
    row.y = Math.min(ends[1], ends[3])
    row.w = Math.max(1, Math.abs(ends[2] - ends[0]))
    row.h = Math.max(1, Math.abs(ends[3] - ends[1]))
  }
  return rows
}
