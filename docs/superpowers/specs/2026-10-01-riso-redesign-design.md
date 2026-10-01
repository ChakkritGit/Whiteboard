# Whiteboard redesign A: hand-drawn Riso look (2026-10-01)

Sub-project A of five. The others follow in their own specs: B diagram tools (arrow, connector,
ellipse, diamond), C image attachments (R2), D planning and software templates, and E Mr.
Worldwide on the board. E draws a plan, summarises the board and tidies notes, using a static
hand-drawn globe with no walking and almost no animation.

## Intent

**What the owner asked for:** a more colourful board, designed like drawdy.io (sketchy,
hand-drawn) but not in drawdy's colours. They chose a hand-drawn feel, the **Riso print** family
(fluorescent pink, blue, yellow, teal on paper cream), roughjs for the sketch lines, and the Mali
font.

**What is assumed:**
- The board stays sign-in free.
- Every existing board and exported file must still open and look right after the change.
- Nothing about sync, undo or editing behaviour changes.

**Success:**
- Shapes, frames and notes render with sketchy outlines that are identical for every peer, and
  stable across re-renders.
- The board uses the Riso palette in both light and dark themes.
- Every note's text still meets 4.5:1 contrast on its fill.
- PNG, JPEG and PDF exports look the same as the screen.
- `tsc`, `eslint` and `next build` pass.

## Non-goals

- New tools, connectors, images, templates and the AI guide (sub-projects B to E).
- Changing the Yjs data model. **Swatch names stay exactly as they are** (`red` ... `slate`), because
  live docs and exported files store the name. Only the colour each name maps to changes.
- Re-drawing freehand pen strokes. They are already hand-drawn.

## Design

### 1. Tokens: `src/app/globals.css`
The same six token names, new values. Everything downstream reads them.

| Token | Light | Dark |
|---|---|---|
| `--color-canvas` | `#F7F1E3` paper cream | `#141A33` deep navy |
| `--color-panel` | `#FFFDF7` | `#1C2347` |
| `--color-ink` | `#1B1B3A` | `#F7F1E3` |
| `--color-muted` | `#6E6A80` | `#A9A6C2` |
| `--color-line` | `#E6DCC8` | `#2E3763` |
| `--color-accent` | `#FF48B0` fluorescent pink | `#FF6BC1` |

There is one new token, `--color-accent-ink`: `#B0005F` in light and `#FF8FD0` in dark. Pink at
`#FF48B0` is about 2.9:1 on white, so it can be a fill but not text. Every place that uses
`text-accent` on a light surface moves to `text-accent-ink`, and `bg-accent` buttons keep white text.
Check the button's contrast; if it is below 4.5:1, use ink-coloured text on the pink.

The paper dots stay, recoloured with the ink token.

### 2. Panels: from glass to printed card
`.glass` and `.glass-flat` keep their class names, so `chrome.tsx` markup barely changes. Their
bodies change to the Riso card:
- flat `--color-panel` fill
- a 1.5px `--color-ink` border
- a hard offset shadow, `3px 3px 0` in `--color-ink` at 85% (light) or `--color-accent` at 60% (dark)
- no blur, no sheen, no rim

The `::before` and `::after` layers are deleted. Edge-anchored bars (`glass-flat`) keep only the
border on their inner edge and no shadow.

This deletes the backdrop-filter traps listed in MEMORY.md, which no longer apply. Update that note
in MEMORY.md.

### 3. Palette: `src/lib/palette.ts`
Each swatch keeps `fill`, `ink`, `dot` and `deep`, and gains `line`:
- `line` is the full Riso ink. It is used for rough outlines, the highlighter, the picker dot and
  the minimap.
- `fill` is a tint of that ink, like a 30-40% screen.
- `deep` is the text colour on `fill`, and must reach at least 4.5:1 on it.
- `dot` becomes the same value as `line`, so the picker shows the vivid inks.

Starting values follow. Tune them only to pass contrast.

| name | line | fill | deep |
|---|---|---|---|
| red | `#F15060` | `#FBC4C9` | `#7A1626` |
| peach | `#FF6C2F` | `#FFD3BF` | `#7A2A08` |
| amber | `#FFB511` | `#FFE6A6` | `#6B4500` |
| yellow | `#FFE800` | `#FFF59E` | `#5C5200` |
| green | `#00A95C` | `#A8E6C6` | `#00512B` |
| mint | `#82D8D5` | `#CFF1EF` | `#0E5654` |
| sky | `#5EC8E5` | `#CDEFF8` | `#0B4F63` |
| indigo | `#0078BF` | `#B3D7EE` | `#003C61` |
| lavender | `#9D7AD2` | `#E0D5F2` | `#44267A` |
| magenta | `#FF48B0` | `#FFC7E6` | `#8A0F55` |
| pink | `#F984CA` | `#FDDDEF` | `#7E1F57` |
| slate | `#3A3F5C` | `#DCDDE3` | `#22253A` |

`PEOPLE_COLORS` becomes eight Riso inks: pink, blue, teal-green, orange, violet, aqua, red and
sunflower.

### 4. Sketch rendering: new `src/lib/sketch.ts`, plus `roughjs`
New dependency: `roughjs` (4.6.x, about 9KB gzip). Pure helpers, no React:
- `seedOf(id: string): number` hashes the item id to a positive 31-bit int. The same id gives the
  same wobble on every peer and every render.
- `rectPaths(w, h, seed, opts)` returns `{ fill?: string; outline: string }` SVG path strings, from
  roughjs's generator (`rough.generator()`, `toPaths`):
  - `roughness: 1.2`, `bowing: 1.5`, `strokeWidth: 1.75`
  - fill style `solid` for notes and shapes, and no fill for frames
  - frames use `strokeLineDash: [8, 6]`
- **Riso misregistration:** the fill path is drawn offset by `(2, 2)` from the outline. That is the
  single signature detail of the look. It is a translate on the fill only, and hit-testing still uses
  the item's box.
- Results are memoised per `(seed, w, h, kind, colour)` in a small `Map`, capped at 500 entries and
  cleared when full.

### 5. Items: `src/components/board/board-item.tsx`
Notes keep real DOM text, which the editing decisions in MEMORY.md depend on. Only the
background changes:
- **sticky:** the `bg-*` class and rounded corners go. An absolutely positioned
  `<svg aria-hidden class="pointer-events-none absolute inset-0 overflow-visible">` behind the
  content draws `fill` (tint, offset) plus `outline` (in the swatch `line`). The text inside switches
  to the hand font. The drop shadow is replaced by the offset fill.
- **shape:** the same SVG. The fill is the tint and the outline is the full ink.
- **frame:** a dashed rough outline in `--color-ink` at 70%, and a translucent panel fill with no
  offset. The label chip becomes a small Riso tag: pink fill, ink text, hand font.
- **text:** no box. Only the hand font is applied.
- **Selection ring and grips:** unchanged in shape, recoloured through the accent token.
- Sizes and hit areas are unchanged, so drag, resize, rotate and eraser hit-testing behave exactly
  as before.

### 6. Font: Mali
Load it with `next/font/google`, which self-hosts at build time so there is no runtime Google
request:
- `Mali({ subsets: ['thai', 'latin'], weight: ['400', '600', '700'], variable: '--font-hand', display: 'swap' })`
- Set the variable on `<html>` in both locale layouts (or in `shell.tsx` if that is the shared
  root).

It applies to:
- note, shape, frame and text item text, through a `.font-hand` utility in `@layer components`
- the board title
- the landing page headline

UI chrome (menus, buttons, labels) stays on the system stack for legibility.

Item `weight` values of 300 and 900 map to the nearest loaded weight. The weight control keeps its
four steps.

### 7. Toolbar and chrome colour: `chrome.tsx`
- The active tool gets its own Riso ink instead of one accent:
  - select: ink
  - pen: blue
  - highlighter: yellow, with ink icon
  - eraser: red
  - shape: teal-green
  - sticky: sunflower
  - text: violet
  - frame: pink
  
  Each shows as a filled rounded square in `line`, with the icon in `deep`. This is a `TOOL_INK`
  map beside `TOOLS`. Hover stays neutral.
- The Share button is pink fill with ink text and the offset shadow.
- The Live pill turns teal-green.

### 8. Logo: `logo.tsx` and `src/app/icon.svg`
The same idea (a board, a stroke, a note), redrawn in Riso:
- a pink square
- a blue stroke over it, with the stroke's yellow underprint offset 1px (misregistration)
- the note in sunflower

It stays flat, so it reads at 16px.

### 9. Export: `src/lib/picture.ts`
- The canvas renderer uses `rough.canvas(canvas)`, with the same `seedOf`, options and fill offset
  as the screen, so the picture matches.
- The constants `INK`, `LINE` and `PANEL` move to the new light-theme values. Export always renders
  the light theme, as it does now.
- `FONT` reads the Mali family from `getComputedStyle(document.documentElement).getPropertyValue('--font-hand')`.
  The export awaits `document.fonts.ready` before drawing, so Thai text never falls back mid-picture.

### 10. Landing page
The tokens carry most of it. The headline also uses `.font-hand`, and the CTA button uses the new
Share-button style.

The OG images (`assets/opengraph-image.{en,th}.svg` and the PNGs) are regenerated in the new
colours, using the same process the README describes. If that process is not scripted, leave the
PNGs, note it, and do not block on it.

## Error handling and compatibility
- **Unknown swatch name** (old peer or bad file): the `PALETTE[...] ?? PALETTE.yellow` fallback
  stays everywhere, including the new `line` reads.
- **Font not loaded yet:** `display: swap` on screen; the export waits for `document.fonts.ready`.
- **roughjs throws** on a zero or negative size (a box mid-resize): `rectPaths` clamps `w` and `h` to
  at least 1.
- **Old boards:** nothing in the data changes, so they open as they are.

## Testing
There is no test runner in the repo. Add one runnable check, `scripts/check-design.ts`. Node 24
strips types natively, so it needs no new tooling:
- It imports `../src/lib/palette.ts` and `../src/lib/sketch.ts` with explicit `.ts` extensions.
  `sketch.ts` must therefore import only `roughjs` and types; type-only imports are erased.
- It asserts `deep` on `fill` is at least 4.5:1 for all 12 swatches, using the WCAG luminance
  formula.
- It asserts `seedOf` is deterministic and differs for two ids.
- It asserts `rectPaths(0, 0, ...)` does not throw.
- Add `"check": "node scripts/check-design.ts"` to `package.json`.

**Browser verification (Playwright, as MEMORY.md does):**
- On `next start`, a board with one of every item kind and every swatch, screenshotted in light
  and dark.
- Two contexts in one room: compare the outline `d` attribute of the same sticky in both. It must
  be identical.
- Drag, resize and erase still work.
- Export PNG and compare it by eye with the screenshot.

Also:
- `tsc`, `eslint` and `next build` pass.
- Lighthouse on `/` should not drop more than 0.02 from today's score. Record both numbers.

## Files touched
- `package.json` / lockfile (roughjs)
- `src/app/globals.css`
- `src/lib/palette.ts`
- new `src/lib/sketch.ts`
- `src/components/board/board-item.tsx`
- `src/components/board/chrome.tsx`
- `src/components/board/logo.tsx`
- `src/app/icon.svg`
- `src/lib/picture.ts`
- locale layouts or `shell.tsx` (font)
- `src/components/landing/*` (headline and CTA)
- new `scripts/check-design.ts`
- `MEMORY.md` (the glass note)
