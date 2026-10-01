# Whiteboard E: Mr. Worldwide on the board (2026-10-01)

Depends on A (the look) and D (`layoutKanban`, `layoutTimeline`). Touches two repos: `whiteboard`
and `portfolio/worker` (the `mr-worldwide` Worker).

## Intent
**What the owner asked for:** bring Mr. Worldwide into the whiteboard.

He does three things:
1. **Plan:** "วางแผนงาน X" draws a plan on the open board.
2. **Summarise:** he reads the board and says what is on it and what is missing.
3. **Tidy:** he sorts scattered notes into labelled frames.

He does **not** walk around. His look is redrawn to suit the board, still a globe, with very little
animation. MCP for outside agents is a later, separate step.

**Success:**
- From a board, open the guide, type a request in Thai or English, and get a plan drawn, a
  summary, or the notes tidied.
- Every change appears live for everyone in the room and is a single undo step.
- The portfolio's existing guide keeps working unchanged.

## Non-goals
- The three.js character on the board.
- An MCP server.
- Persistence on the room server. Writes happen on the client, into the open doc.
- Editing items other than tidy's moves and new frames.

## Character (whiteboard)
- `src/components/guide/globe.tsx` is a static SVG globe in the Riso style:
  - a pink-to-blue misregistered circle
  - latitude and longitude lines in ink
  - two oval eyes and brows
  - a small sneaker peeking at the bottom, as a nod to the original
- **States:**
  - idle: a blink every 6 to 10 seconds
  - thinking: the latitude lines slide slowly (CSS transform)
  - done: one small hop
- Nothing else moves. Animations are off under `prefers-reduced-motion`.
- **Placement:** a 56px button at the bottom-right above the minimap. Clicking it opens a chat card
  (Riso panel, 360x480, hand font for his words). The board stays usable underneath.

## API (`portfolio/worker`)
**Endpoint:** `POST /api/assistant/board` (the existing route pattern `chakkritton.com/api/assistant*`
already covers it). Add `https://whiteboard.chakkritton.com` and `http://localhost:3000` to
`ALLOWED_ORIGINS`. Uses the same rate limiter and quota handling.

**Body:** `{ mode: 'plan' | 'summary' | 'tidy', lang, request: string (max 500), board: BoardDigest }`.
- `BoardDigest` is built by the client: up to 120 items as `{ id, kind, text (cut to 120 chars), x, y, frame? }`.
  It carries no colours and no strokes.
- The worker re-validates the digest: shape, counts and lengths. A bad digest gets a 400.

**Modes:**
| Mode | Model output | Worker returns |
|---|---|---|
| plan | JSON only: `{ type: 'kanban' \| 'timeline', title, columns?: [{ title, cards: string[] }], milestones?: [{ title, note? }] }`, capped at 6 columns or 10 milestones and 8 cards each | the parsed and clamped plan |
| summary | plain text, at most 120 words, in the reader's language | streamed text, like today's chat |
| tidy | JSON only: `{ groups: [{ title, ids: string[] }] }`. Every id must exist in the digest, and each id appears once | the parsed groups, with unknown ids dropped |

- Separate prompts live in `worker/src/board-prompt.ts`. They use the persona of today's prompt,
  plus the strict JSON instruction for plan and tidy.
- Temperature 0.2, `max_tokens` 700.
- **JSON parsing:** take the first `{...}` block. Accept it only if it matches the schema. On
  failure, retry once with "return only JSON", then answer `{ code: 'unparseable' }`.
- Qwen 3 thinking tags (`<think>...</think>`) are stripped before parsing, as `stream.ts` already
  handles.

## Client actions (whiteboard)
- **plan:** run `layoutKanban` or `layoutTimeline` from D at the viewport centre, then
  `placeTemplate`. That is one transact, grouped under the plan title. He replies with one line:
  "วางแผน X ให้แล้ว 4 คอลัมน์".
- **summary:** stream the text into the chat card. The board is not changed.
- **tidy:** for each group, in one transact:
  1. Create a frame sized to fit its notes, laid out left to right with a 48-unit gap.
  2. Move the notes into a grid inside the frame.

  Locked items are never moved. One undo puts everything back. Before applying, show a preview line
  ("จัด 23 โน้ตเป็น 4 กลุ่ม") with Apply and Cancel buttons, because tidy moves other people's notes.
- **Errors:** spoken in his voice, in the reader's language.
  - quota: "วันนี้ผมเหนื่อยแล้ว พรุ่งนี้มาใหม่นะ", the same as the portfolio
  - rate limit
  - unparseable: "ผมคิดไม่ออก ลองพูดใหม่อีกที"
  - offline

## Testing
- **Worker:**
  - vitest for the digest validator, plan clamping and the tidy id filter (fixtures; no model call)
  - `wrangler dev` with one real call per mode, with the output recorded
- **Whiteboard:**
  - `npm run check` covers the digest builder: it caps at 120 and cuts text
  - Playwright against a mocked endpoint (`page.route`) for all three modes: the plan appears as
    one group and one undo removes it; tidy moves notes into frames, leaves locked items alone, and
    one undo restores; the summary streams into the card
- The portfolio's existing worker tests stay green.

## Owner steps
1. Deploy `portfolio/worker` with `npx wrangler deploy`.
2. Push the whiteboard.

This uses the same free Workers AI allowance (about 400 messages a day), shared with the portfolio
guide.
