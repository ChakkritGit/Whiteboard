import assert from 'node:assert/strict'
import { PALETTE } from '../src/lib/palette.ts'

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
for (const [name, s] of Object.entries(PALETTE)) {
  assert.ok(s.fill.includes(s.tint) && s.ink.includes(s.deep), `${name}: class and hex differ`)
  const r = ratio(s.deep, s.tint)
  console.log(name.padEnd(9), r.toFixed(2))
  assert.ok(r >= 4.5, `${name}: deep on fill is ${r.toFixed(2)}:1`)
  const n = ratio(s.night, '#141A33')
  console.log(''.padEnd(9), 'night', n.toFixed(2))
  assert.ok(n >= 4.5, `${name}: night on the dark canvas is ${n.toFixed(2)}:1`)
}

const sketch = await import('../src/lib/sketch.ts')
const { seedOf, rectPaths, shapePaths, linePaths } = sketch
assert.equal(seedOf('a1'), seedOf('a1'))
assert.notEqual(seedOf('a1'), seedOf('a2'))
assert.ok(seedOf('') >= 1)
const z = rectPaths(0, -5, 7, 'sticky', '#000', '#fff')
assert.ok(z.outline.length > 0 && z.fill && z.fill.length > 0 && !/NaN/.test(z.outline + z.fill))
assert.equal(rectPaths(100, 80, 7, 'frame', '#000', '#fff').fill, undefined)
assert.equal(rectPaths(100, 80, 7, 'shape', '#000').outline, rectPaths(100, 80, 7, 'shape', '#000').outline)
assert.ok(rectPaths(100, 80, 7, 'shape', '#000', '#fff').fill)
for (const shape of ['ellipse', 'diamond'] as const) {
  const q = shapePaths(100, 80, 7, 'shape', '#000', '#fff', shape)
  assert.ok(q.outline.length > 0 && q.fill && !/NaN/.test(q.outline + q.fill), shape)
}
assert.notEqual(shapePaths(100, 80, 7, 'shape', '#000', undefined, 'ellipse').outline, rectPaths(100, 80, 7, 'shape', '#000').outline)
assert.ok(!/NaN/.test(linePaths([0, 0, 0, 0], 7, '#000', 'end')))
assert.ok(linePaths([0, 0, 90, 40], 7, '#000', 'end').length > linePaths([0, 0, 90, 40], 7, '#000', 'none').length)
console.log('sketch ok')

const { edgePoint, connectorEnds } = await import('../src/lib/geometry.ts')
const r2 = (p: { x: number; y: number }) => [Math.round(p.x * 100) / 100, Math.round(p.y * 100) / 100]
assert.deepEqual(r2(edgePoint({ x: 0, y: 0, w: 100, h: 50 }, { x: 500, y: 25 })), [100, 25])
assert.deepEqual(r2(edgePoint({ x: 0, y: 0, w: 100, h: 100, shape: 'ellipse' }, { x: 1000, y: 1000 })), [85.36, 85.36])
assert.deepEqual(r2(edgePoint({ x: 0, y: 0, w: 100, h: 100, shape: 'diamond' }, { x: 50, y: -500 })), [50, 0])
assert.deepEqual(r2(edgePoint({ x: 0, y: 0, w: 100, h: 50, angle: 90 }, { x: 50, y: 1000 })), [50, 75])
assert.deepEqual(r2(edgePoint({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5 })), [5, 5])
assert.deepEqual(connectorEnds({ from: 'gone', points: [1, 2, 3, 4] }, new Map()), [1, 2, 3, 4])
console.log('geometry ok')

const { inkPath } = await import('../src/lib/ink.ts')
const dot = inkPath([0, 0], undefined, 4, false)
assert.ok(dot.length > 0 && !/NaN/.test(dot), 'one point is a dot')
const zig = Array.from({ length: 200 }, (_, i) => [i * 2, (i % 2) * 20]).flat()
const zd = inkPath(zig, undefined, 4, false)
assert.ok(zd.startsWith('M') && zd.endsWith('Z') && !/NaN/.test(zd))
assert.equal(inkPath(zig, undefined, 4, false), zd)
console.log('ink ok')

const { isPictureSrc, budgetLeft, MAX_SRC, BOARD_BUDGET } = await import('../src/lib/image-rules.ts')
const tiny = 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA=='
assert.ok(isPictureSrc(tiny))
assert.ok(isPictureSrc('data:image/png;base64,iVBORw0KGgo='))
const uuid = '0b9f3c1e-5a6d-4e7f-8a1b-2c3d4e5f6a7b'
for (const bad of [
  'javascript:alert(1)',
  'data:image/svg+xml;base64,PHN2Zz4=',
  'https://example.com/a.png',
  `${uuid}.png`,
  'data:image/webp;base64,UklG RhoA',
  `data:image/webp;base64,${'A'.repeat(MAX_SRC)}`,
  undefined,
  42,
]) {
  assert.ok(!isPictureSrc(bad), String(bad).slice(0, 40))
}
assert.equal(`data:image/webp;base64,${'A'.repeat(MAX_SRC - 23)}`.length, MAX_SRC)
assert.ok(isPictureSrc(`data:image/webp;base64,${'A'.repeat(MAX_SRC - 23)}`), 'exactly MAX_SRC is allowed')
assert.equal(budgetLeft([]), BOARD_BUDGET)
assert.equal(
  budgetLeft([{ kind: 'image', src: tiny }, { kind: 'sticky', src: 'x'.repeat(1000) }, { kind: 'image' }]),
  BOARD_BUDGET - tiny.length,
  'only pictures count',
)
console.log('image rules ok')

const { TEMPLATES, layoutKanban, layoutTimeline, resolveRefs } = await import('../src/lib/templates.ts')
const { DICT } = await import('../src/lib/dictionary.ts')
const finite = (n: unknown) => typeof n === 'number' && Number.isFinite(n)
for (const lang of ['en', 'th'] as const) {
  const words = Object.fromEntries(Object.entries(DICT[lang]).filter(([, v]) => typeof v === 'string')) as Record<string, string>
  for (const tpl of TEMPLATES) {
    const drafts = tpl.build(words, { x: 0, y: 0 })
    assert.ok(drafts.length > 0, tpl.id)
    let n = 0
    const rows = resolveRefs(drafts, () => `${tpl.id}${n++}`)
    for (const r of rows) {
      for (const v of [r.x, r.y, r.w, r.h, ...(r.points ?? [])]) assert.ok(finite(v), `${lang} ${tpl.id}: ${v}`)
      assert.ok(r.text !== undefined && (r.kind === 'connector' || r.w > 0), tpl.id)
    }
    const ids = new Set(rows.map((r) => r.id))
    assert.equal(ids.size, rows.length, `${tpl.id}: ids repeat`)
    for (const r of rows.filter((r) => r.kind === 'connector')) {
      assert.ok(!r.from === !r.to && (!r.from || (ids.has(r.from) && ids.has(r.to as string))), `${tpl.id}: connector dangles`)
    }
    // the words are real: nothing was left as a missing key
    for (const r of rows) assert.ok(!/undefined/.test(r.text), `${lang} ${tpl.id}: missing word`)
  }
}
const en = Object.fromEntries(Object.entries(DICT.en).filter(([, v]) => typeof v === 'string')) as Record<string, string>
const cards = (k: ReturnType<typeof layoutKanban>, f: (typeof k)[number]) =>
  k.filter((d) => d.kind === 'sticky' && d.x >= f.x && d.x < f.x + f.w && d.y >= f.y && d.y < f.y + f.h)
const kan = TEMPLATES[0].build(en, { x: 0, y: 0 })
for (const f of kan.filter((d) => d.kind === 'frame')) {
  const inside = cards(kan, f)
  for (const a of inside) {
    assert.ok(a.y + a.h <= f.y + f.h && a.x + a.w <= f.x + f.w, 'a card sticks out of its frame')
    for (const b of inside) if (a !== b) assert.ok(!(a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y), 'cards overlap')
  }
}
assert.deepEqual(layoutKanban(en, { x: 0, y: 0 }, 'k', []), [])
const twelve = layoutKanban(en, { x: 0, y: 0 }, 'k', [{ title: 'c', cards: Array.from({ length: 12 }, (_, i) => `c${i}`) }])
assert.ok(twelve[0].h >= 12 * 144, 'frame too short for 12 cards')
const long = layoutKanban(en, { x: 0, y: 0 }, 'k', [{ title: 'c', cards: ['x'.repeat(200), 'ก'.repeat(200)] }])
for (const d of long) for (const v of [d.x, d.y, d.w, d.h]) assert.ok(finite(v))
for (const c of cards(long, long[0])) assert.ok(c.y + c.h <= long[0].y + long[0].h, 'long card sticks out')
assert.deepEqual(layoutTimeline(en, { x: 0, y: 0 }, 't', []), [])
let k = 0
const gone = resolveRefs(
  [
    { kind: 'sticky', ref: 'a', x: 0, y: 0, w: 10, h: 10, text: '', color: 'sky' },
    { kind: 'connector', from: '@a', to: '@nope', x: 0, y: 0, w: 1, h: 1, text: '', color: 'slate' },
  ],
  () => `i${k++}`,
)
assert.equal(gone.length, 1, 'a connector naming @nope is dropped')
const ra = resolveRefs(TEMPLATES[4].build(en, { x: 0, y: 0 }), () => Math.random().toString(36))
const rb = resolveRefs(TEMPLATES[4].build(en, { x: 0, y: 0 }), () => Math.random().toString(36))
assert.ok(ra.every((a) => rb.every((b) => a.id !== b.id)), 'two placements share an id')
console.log('templates ok')

const { buildDigest, parseSse } = await import('../src/lib/guide.ts')
type It = import('../src/lib/types.ts').Item
const note = (id: string, x: number, y: number, text = 'n', extra: Partial<It> = {}): It =>
  ({ id, kind: 'sticky', x, y, w: 100, h: 100, text, color: 'sky', z: 0, ...extra })
const many = Array.from({ length: 200 }, (_, i) => note(`s${i}`, i * 150, 0))
const dig = buildDigest(many, { x: 0, y: 0 }, 'plan')
assert.equal(dig.length, 120, 'the digest caps at 120')
assert.equal(dig[0].id, 's0', 'nearest first')
assert.ok(dig.every((d, i) => i === 0 || Number(d.id.slice(1)) > Number(dig[i - 1].id.slice(1))), 'ordered by distance')
assert.ok(!dig.some((d) => Number(d.id.slice(1)) >= 120), 'the far ones are the ones cut')
assert.equal(buildDigest([note('a', 0, 0, `${'x'.repeat(119)} ${'y'.repeat(50)}`)], { x: 0, y: 0 }, 'plan')[0].text.length, 119, 'text is cut to 120, then trimmed')
assert.equal(buildDigest([note('a', 0, 0, 'x'.repeat(500))], { x: 0, y: 0 }, 'plan')[0].text.length, 120)
assert.equal(buildDigest([note('a', 0, 0, '  ')], { x: 0, y: 0 }, 'plan').length, 0, 'empty text is left out')
const box = note('box', -50, -50, 'Doing', { kind: 'frame', w: 400, h: 400 })
const mixed = [box, note('in', 0, 0, 'inside'), note('lock', 600, 0, 'locked', { locked: true }), note('free', 900, 0, 'free'), note('line', 0, 0, 'x', { kind: 'connector' })]
assert.deepEqual(buildDigest(mixed, { x: 0, y: 0 }, 'tidy').map((d) => d.id), ['free'], 'tidy leaves locked and framed notes')
const plain = buildDigest(mixed, { x: 0, y: 0 }, 'summary')
assert.equal(plain.find((d) => d.id === 'in')?.frame, 'Doing')
assert.ok(!plain.some((d) => d.id === 'line'), 'a connector is never in the digest')
const first = parseSse('event: text\ndata: {"t":"a"}\n\nevent: te', '')
assert.equal(first.events.length, 1)
const second = parseSse('xt\ndata: {"t":"b"}\n\nevent: done\ndata: {}\n\n', first.carry)
const all = [...first.events, ...second.events]
assert.equal(all.filter((e) => e.event === 'text').map((e) => JSON.parse(e.data).t).join(''), 'ab')
assert.equal(all.at(-1)?.event, 'done')
assert.equal(second.carry, '')
console.log('guide ok')

const { tidyLayout } = await import('../src/lib/guide.ts')
const byId = (list: It[]) => new Map(list.map((i) => [i.id, i]))
const loose = [
  note('a', 10, 10), note('b', 400, 30, 'b', { w: 150, h: 220 }), note('c', 5, 500), note('d', 700, 700),
  note('e', 900, 20), note('lk', 30, 30, 'x', { locked: true }), note('f', 1200, 50, 'f', { kind: 'text', w: 160, h: 40 }),
]
const lay = tidyLayout(
  [
    { title: 'One', ids: ['a', 'b', 'gone', 'lk', 'c'] },
    { title: 'Solo', ids: ['d'] },
    { title: 'Two', ids: ['e', 'a', 'f'] },
  ],
  byId(loose),
)
const moved = lay.moves.map((m) => m.id).sort()
assert.deepEqual(moved, ['a', 'b', 'c', 'e', 'f'], 'a missing id, a locked id, a solo group and a repeated id are all dropped')
assert.equal(lay.frames.length, 2)
const rect = (m: { id: string; x: number; y: number }) => ({ ...m, w: loose.find((i) => i.id === m.id)!.w, h: loose.find((i) => i.id === m.id)!.h })
const rs = lay.moves.map(rect)
for (const a of rs) for (const b of rs) if (a !== b) assert.ok(!(a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y), 'two notes overlap')
const fit = (f: (typeof lay.frames)[number], ids: string[]) =>
  rs.filter((r) => ids.includes(r.id)).every((r) => r.x >= f.x && r.y >= f.y && r.x + r.w <= f.x + f.w && r.y + r.h <= f.y + f.h)
assert.ok(fit(lay.frames[0], ['a', 'b', 'c']), 'a note sticks out of the first frame')
assert.ok(fit(lay.frames[1], ['e', 'f']), 'a note sticks out of the second frame')
const [f0, f1] = lay.frames
assert.ok(f0.x + f0.w <= f1.x || f1.x + f1.w <= f0.x || f0.y + f0.h <= f1.y || f1.y + f1.h <= f0.y, 'frames overlap')
assert.equal(lay.frames[0].text, 'One')
const framed = [box, note('in', 0, 0, 'inside'), note('in2', 10, 10, 'inside too'), note('out', 900, 0), note('out2', 1100, 0)]
assert.deepEqual(
  tidyLayout([{ title: 'x', ids: ['in', 'in2', 'out', 'out2'] }], byId(framed)).moves.map((m) => m.id).sort(),
  ['out', 'out2'],
  'a note inside a frame is never moved',
)
assert.deepEqual(tidyLayout([{ title: 'x', ids: ['in', 'gone'] }], byId(framed)), { frames: [], moves: [] })
console.log('tidy ok')
