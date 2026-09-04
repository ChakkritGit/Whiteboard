# Whiteboard

A shared board with nothing to sign in to. Open it, send the link, and whoever
follows it is already in the room with you.

## Running it

Two processes: the site, and the server that relays a room between the people in
it.

```bash
npm install
npm run dev:all          # the board on :3000, rooms on :1234
```

Or separately, which is easier to read the logs of:

```bash
npm run server           # ws://localhost:1234
npm run dev              # http://localhost:3000
```

Point the browser at `/` and it sends you to a fresh board. `NEXT_PUBLIC_WS_URL`
moves the room server somewhere else.

## Deploying it

Two things ship, and they cannot both go to the same place.

The site is an ordinary Next.js app — Vercel, Netlify, anywhere. The room server
is different: it has to stay alive holding websockets open, which an ordinary
serverless function cannot do.

### On Cloudflare, with no server of your own

A Worker on its own cannot hold a socket open either — but a **Durable Object**
can, and one object per room is the shape this problem already has. Cloudflare
routes every connection for a given room name to the same object wherever in the
world it is, so the object *is* the room and there is nothing to coordinate
between instances.

```bash
cd worker
npm install
npx wrangler login
npx wrangler deploy      # prints https://whiteboard-rooms.<subdomain>.workers.dev
```

Then point the site at it and rebuild:

```
NEXT_PUBLIC_WS_URL=wss://whiteboard-rooms.<subdomain>.workers.dev
```

Durable Objects need to be enabled on the account. The class is declared as
`new_sqlite_classes` in `worker/wrangler.toml`, which is the flavour the free
plan allows; `new_classes` is the paid one.

`npx wrangler dev` runs the whole thing locally, Durable Object and all, if you
would rather see it work before deploying.

### Or anywhere that runs a process

`scripts/server.mjs` is the same relay as a plain Node process — Railway, Render,
Fly, a VPS:

```
NEXT_PUBLIC_WS_URL=wss://rooms.example.com
```

`wss://`, not `ws://`: a page served over HTTPS is not allowed to open an
unencrypted socket, so the board will simply never connect if this is wrong.

Until one of these is set the site still works — the board is kept in IndexedDB
and everything but other people is there — but a shared link opens an empty
board, because nothing is relaying between browsers.

## How it holds together

- **The room is the URL.** There is no account, no session and no database of
  boards. A room id in the path is the whole of the access control, which is what
  makes "just share the link" true rather than a feature on top of a login.
- **The board is a CRDT** (Yjs). Items live in a map of maps rather than an array
  of objects, so two people dragging the same note write to different keys and
  both edits survive — an array of whole objects would have one overwrite the
  other.
- **Two providers, two jobs.** IndexedDB keeps the board on your machine, so it
  opens instantly and survives going offline. The websocket carries it to
  everyone else. The server holds a room in memory only while somebody is in it;
  what outlives everyone leaving is the copy in each browser and any file you
  exported.
- **Text is text.** Notes are positioned DOM elements rather than shapes painted
  into a canvas, so what is written on them is selectable, editable in place, and
  readable by a screen reader without a parallel accessibility tree.

## Files

Export writes plain JSON — readable and diffable, at the cost of carrying the
board's contents but not its history. Import validates every field before
accepting it, since it is the one place the board takes in something it did not
write: a missing `x` would put a note at `NaN`, where nobody could ever find or
select it again.

## Keys

| | |
|---|---|
| `V` `P` `H` `E` `R` `N` `T` `F` | select, pen, highlighter, eraser, rectangle, note, text, frame |
| Drag on empty board | sweep a selection round things |
| Hold `Space` and drag | move the view · `⌘`/`Ctrl` + wheel zooms |
| `Alt` + drag a note | pull a copy out of it |
| Right-click | cut, copy, order, lock, group |
| Double-click a note | edit it · `Return` starts a new line |
| `⌘`/`Ctrl` + `C` `X` `V` `D` | copy, cut, paste, duplicate |
| `⌘`/`Ctrl` + `G` | group · add `⇧` to ungroup |
| `]` and `[` | bring to front, send to back |
| `Delete` | remove what is selected |
| `⌘`/`Ctrl` + `A` | select everything |
| `⌘`/`Ctrl` + `Z` | undo · add `⇧` to redo |
