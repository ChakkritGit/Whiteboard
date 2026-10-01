# Whiteboard D: templates for software and planning (2026-10-01)

Depends on A and B (connectors, ellipse, diamond). E reuses its layout functions.

## Intent
**What the owner asked for:** tools for different kinds of work, software and planning.
Templates give an empty board a starting structure in one click.

**Success:**
- A Templates button opens a gallery.
- Picking one places a ready layout at the centre of the view.
- It is one undo step.
- Everything placed is ordinary items, so they can be edited, moved and deleted.

## Templates (first set: eight, in two groups)
| Group | Template | Layout |
|---|---|---|
| Planning | Kanban | 3 frames, To do / Doing / Done, with 2 example stickies in To do |
| Planning | Timeline | A horizontal arrow plus 5 milestone diamonds with labels underneath |
| Planning | Retro | 3 frames, Went well / To improve / Actions, in green, amber and pink |
| Planning | Mind map | A centre ellipse, plus 4 branch stickies each joined by a connector |
| Software | Flowchart | Start ellipse, process rect, decision diamond, two outcomes, connected |
| Software | Architecture | Client / API / DB / Queue / Worker boxes, connected, inside a "System" frame |
| Software | User story map | A row of activity stickies, with a column of story stickies under each |
| Software | Sprint board | Backlog / Sprint / In review / Done frames, plus a sticky for the sprint goal |

All labels come from `dictionary.ts`, so a template drops in the reader's language (th or en).

## Design
- **`src/lib/templates.ts`, pure.** It exports
  `TEMPLATES: { id, group, title: (t) => string, build: (t, origin: {x, y}) => Draft[] }`.
  - `Draft` is `Omit<Item, 'id' | 'z'>`, plus a local `ref` string so connectors can name items
    in the same template (`from: '@start'`).
  - `build` returns world-space items laid out from `origin`, on a 24-unit grid, in Riso swatches.
- **`placeTemplate(handle, drafts)` in `board.ts`.**
  1. One `doc.transact`.
  2. Give every draft an id and a `z` above `nextZ`.
  3. Resolve `@ref` in `from` and `to` to the new ids.
  4. Group everything (`groupItems`) under the template's title, so it moves as one until ungrouped.
- **UI:** a Templates button on the dock (grid-plus icon) opens a Riso card panel with two tabs,
  Planning and Software. Each template shows a small preview: its drafts drawn through the existing
  minimap renderer, scaled to 160x100. Clicking places it at the viewport centre and selects the
  group.
- **Exported for E:** `layoutKanban(t, origin, columns: { title, cards: string[] }[])` and
  `layoutTimeline(t, origin, milestones: { title, note? }[])`. The fixed templates use them with
  example content. Mr. Worldwide uses them with the model's content.

## Testing
- **`npm run check`:**
  - every template builds with no NaN coordinates
  - no two drafts overlap within a frame
  - every `@ref` resolves
  - `layoutKanban` with 0 columns, and with 12 cards in one column, still returns finite boxes
- **Playwright:**
  - place each template once and screenshot it
  - one undo removes the whole template
  - a second context sees it
- `tsc`, `eslint` and `build` pass.
