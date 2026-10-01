# Whiteboard B: diagram tools (2026-10-01)

Depends on A (the sketch renderer in `src/lib/sketch.ts`). Followed by C (images), D (templates)
and E (Mr. Worldwide).

## Intent
**What the owner asked for:** tools for software and planning work. Flowcharts and architecture
diagrams need more than boxes and notes: ellipses, decision diamonds, and arrows that stay
attached when a box moves.

**Success:**
- Draw an ellipse, a diamond, a straight line and an arrow.
- Drag from one item to another to make a connector. It stays attached when either end moves, is
  hand-drawn like everything else, and syncs and undoes like any item.
- Old boards open unchanged.

## Non-goals
- Elbow or curved routing.
- Connector labels.
- Ports on specific sides.
- Auto-layout.
- Arrowheads other than one plain head.

The connector draws straight from edge to edge.

## Data model (`src/lib/types.ts`)
- **Shapes:** add `shape?: 'rect' | 'ellipse' | 'diamond'` to `Item`, and keep `kind: 'shape'`.
  Missing means `'rect'`. A peer still running the old code draws an ellipse as a rectangle
  instead of breaking.
- **New `ItemKind` `'connector'`.** Its fields are `from?: string` and `to?: string` (bound item
  ids), `points: [x1, y1, x2, y2]` (the free ends, world space), and `head?: 'end' | 'none'`.
  - A straight **line** is a connector with `head: 'none'`, drawn by the line tool.
  - An **arrow** is a connector with `head: 'end'`.
- **Endpoint rule:** if `from` is set and that item exists, the start point is computed (below)
  and `points[0..1]` is only the fallback. If the bound item is deleted, the connector keeps its
  last stored points. On every move of a bound item, the moving client writes the recomputed points
  back, so a peer on the old code and the export both see a sensible line.
- Add `'connector'` to `KINDS` in `io.ts`, and accept `shape` / `from` / `to` / `head` in import
  validation (optional, typed).

## Geometry (`src/lib/geometry.ts`, pure, with checks in `scripts/check-design.ts`)
- `edgePoint(box, angle, toward: {x, y}): {x, y}` gives where the line from the box centre toward a
  point leaves the box. It is exact for rect, ellipse and diamond, and accounts for `angle`.
- `connectorEnds(conn, itemsById)` returns the two ends: each bound end is the `edgePoint` aimed at
  the other end's centre (or at its free point), and each free end is its stored point.
- **Checks:**
  - a rect's right-edge exit point
  - an ellipse at 45 degrees
  - a diamond's vertex
  - a 90-degree rotated rect
  - a missing bound id falls back to the stored point

## Rendering
- **`board-item.tsx`:** `shape` is `ellipse` or `diamond`. `sketch.ts` gains `ellipsePaths` and
  `diamondPaths`, through `gen.ellipse` and `gen.polygon`, with the same seed, options and offset
  fill.
- **Connector:** an SVG over its own bounding box plus padding, like `Stroke`. The rough line uses
  `gen.line` with the seed from the id. The arrowhead is two short rough lines at plus and minus 28
  degrees from the end direction, 14 units long. It carries a wide transparent hit path, like
  strokes do, so it is easy to select and erase.
- **Colour:** the swatch `line`, default `slate`. It takes the existing colour picker.
- **Export:** `picture.ts` draws ellipse, diamond and connector the same way (Path2D from the same `d`).

## Tools (`chrome.tsx` `TOOLS` and `board-app.tsx`)
| Tool | Key | Behaviour |
|---|---|---|
| ellipse | O | drag a box, like `shape`, and writes `shape: 'ellipse'` |
| diamond | D | the same, with `shape: 'diamond'` |
| line | L | drag from point to point |
| arrow | A | drag from point to point. **Snaps:** starting or ending over an item (`elementsFromPoint` + `[data-item]`, as the eraser does) binds `from` or `to` to it, and the hovered item gets an accent outline |

- The shape tool keeps R for rect.
- The dock groups shapes under one button with a small flyout (rect / ellipse / diamond), so the
  dock does not grow by three. Line and arrow get their own buttons.
- Each new tool gets a `TOOL_INK` entry: ellipse and diamond `green`, like shape; line `slate`;
  arrow `indigo`.
- **Moving and resizing:** when items move or resize (the existing drag code path), recompute and
  write the points of every connector bound to them, in the same `transact`, so one undo step takes
  back both.
- Selecting a connector shows two end grips. Dragging an end re-binds it (snap) or frees it.
- Dictionary entries go in en and th.

## Error handling
- **A connector bound to itself** (`from === to`): it is not created. Releasing on the same item
  makes a free arrow.
- **Zero-length drag:** no item is created, matching how a click with the shape tool behaves today.
- **Unknown `shape` value from a peer:** draw it as a rect.

## Testing
- Geometry checks in `npm run check`.
- **Playwright:**
  - draw an ellipse and a diamond
  - draw an arrow from one sticky to another, then drag the second sticky 150px and check the
    arrow's end moved with it
  - undo once and check both the move and the arrow update revert
  - with two contexts, the arrow appears in the other one
  - erase the arrow
  - export a PNG and look at it
- `tsc`, `eslint` and `build` pass.
