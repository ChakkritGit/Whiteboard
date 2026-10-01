/** Everything a board is made of. */

export type ItemKind = 'sticky' | 'frame' | 'text' | 'shape' | 'comment' | 'stroke' | 'connector' | 'image'

/** The one colour name a sticky, shape or frame carries; see `PALETTE`. */
export type Swatch =
  | 'red'
  | 'peach'
  | 'amber'
  | 'yellow'
  | 'green'
  | 'mint'
  | 'sky'
  | 'indigo'
  | 'lavender'
  | 'magenta'
  | 'pink'
  | 'slate'

export type Item = {
  id: string
  kind: ItemKind
  x: number
  y: number
  w: number
  h: number
  /** The heading on a sticky, the label on a frame, the body of a comment. */
  text: string
  /** The smaller second line a sticky can carry. */
  note?: string
  color: Swatch
  /** Ties a comment or a connector to whoever left it. */
  author?: string
  /** A freehand stroke's path, as flat world-space pairs. Flat rather than
   *  `{x, y}` objects because this is the one field that gets long, and it
   *  crosses the wire on every pointer move while somebody is drawing.
   *  A connector uses it as `[x1, y1, x2, y2]`: the stored ends, used when an end
   *  is free or the item it was bound to is gone. */
  points?: number[]
  /** Pen pressure, parallel to `points` (one 0..1 value per pair). Absent for
   *  strokes made before pressure was kept, or with a mouse or finger. */
  pressure?: number[]
  /** What outline a shape has. Missing means a rectangle. */
  shape?: 'rect' | 'ellipse' | 'diamond'
  /** A picture's key in the image store, never a URL: see `IMG_BASE`. */
  src?: string
  /** A picture's width over its height, as uploaded; resizing keeps it. */
  aspect?: number
  /** The item id a connector's start is bound to. */
  from?: string
  /** The item id a connector's end is bound to. */
  to?: string
  /** Whether a connector ends in an arrowhead. Missing means none. */
  head?: 'end' | 'none'
  /** How wide the pen was, and whether it was the translucent one. */
  stroke?: number
  highlight?: boolean
  /** Turned about its own centre, in degrees. */
  angle?: number
  /** How heavy the type is: 300 thin, 400 regular, 600 semi, 800 heavy. */
  weight?: number
  /** What the layer list calls it, when that should not be the text. */
  name?: string
  /** Which group it belongs to, if any; see the `groups` map. */
  group?: string
  /** Pinned down: still selectable, but not draggable or resizable. */
  locked?: boolean
  /** Painting order. Higher is nearer the viewer. */
  z: number
}

export type Camera = { x: number; y: number; zoom: number }

/** What one person's presence looks like to everyone else. */
export type Presence = {
  /** Which browser this is; see `Me`. */
  id: string
  name: string
  initials: string
  color: string
  cursor: { x: number; y: number } | null
  selection: string[]
}

/** The shape of an exported file, and what an import has to look like. */
export type BoardFile = {
  format: 'whiteboard'
  version: 1
  title: string
  savedAt: string
  items: Item[]
  /** Group id to name. Absent in files written before groups existed. */
  groups?: Record<string, string>
}
