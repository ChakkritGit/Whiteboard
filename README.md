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
is a process that has to stay alive holding open websockets, which serverless
functions cannot do. Put it somewhere that runs a container or a long-lived
process (Railway, Render, Fly, a VPS), then point the site at it:

```
NEXT_PUBLIC_WS_URL=wss://rooms.example.com
```

`wss://`, not `ws://`: a page served over HTTPS is not allowed to open an
unencrypted socket, so the board will simply never connect if this is wrong.

Until that is set the site still works — the board is kept in IndexedDB and
everything but other people is there — but a shared link opens an empty board,
because nothing is relaying between browsers.

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
| Drag on empty board | pan · `⌘`/`Ctrl` + wheel zooms |
| Double-click a note | edit it |
| `Delete` | remove what is selected |
| `⌘`/`Ctrl` + `A` | select everything |
