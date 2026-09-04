/** Everything a board is made of. */

export type ItemKind = 'sticky' | 'frame' | 'text' | 'shape' | 'comment' | 'stroke'

/** The one colour name a sticky, shape or frame carries; see `PALETTE`. */
export type Swatch =
  | 'yellow'
  | 'amber'
  | 'mint'
  | 'green'
  | 'pink'
  | 'magenta'
  | 'sky'
  | 'indigo'
  | 'lavender'
  | 'peach'

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
   *  crosses the wire on every pointer move while somebody is drawing. */
  points?: number[]
  /** How wide the pen was, and whether it was the translucent one. */
  stroke?: number
  highlight?: boolean
  /** Painting order. Higher is nearer the viewer. */
  z: number
}

export type Camera = { x: number; y: number; zoom: number }

/** What one person's presence looks like to everyone else. */
export type Presence = {
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
}
