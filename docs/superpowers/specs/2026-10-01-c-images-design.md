# Whiteboard C: image attachments (2026-10-01)

Depends on A. Works with or without B.

## Intent
**What the owner asked for:** attach pictures to a board, such as screenshots, mockups and photos
of a whiteboard. They have to sync to everyone in the room.

**The constraint:** the worker relay carries Yjs updates, and Cloudflare caps a WebSocket message
at 1MB. An image cannot live inside the shared doc. It lives in storage, and the doc holds a
reference.

**Success:**
- Paste, drop, or pick a PNG, JPEG, WebP or GIF up to 5MB. It appears on the board for everyone,
  can be moved, resized (aspect locked), rotated and deleted like any item, and is included in
  exports.

## Non-goals
- SVG uploads. SVG can carry script, and the bucket serves files publicly.
- Image editing or cropping.
- Galleries.
- Deleting the stored file when the item is deleted. Files are kept: a peer's undo can bring the
  item back.

## Storage: Cloudflare R2 behind the rooms worker
- **Bucket:** `whiteboard-images`, bound as `IMAGES` in `worker/wrangler.toml`. The owner creates
  it with `npx wrangler r2 bucket create whiteboard-images` and deploys the worker.
- **`POST /img`** (the worker's default `fetch`, before the WebSocket branch):
  - The body is the raw file and `Content-Type` is the image type.
  - It checks that the type is in `image/png, image/jpeg, image/webp, image/gif`, **and** that the
    first bytes match the type (magic numbers). The browser's claim alone is not trusted.
  - It checks the size is at most 5MB (`Content-Length` and the actual byte count).
  - The key is `crypto.randomUUID()` plus the extension. It stores with `httpMetadata.contentType`
    set from the **checked** type and `cacheControl: public, max-age=31536000, immutable`.
  - It returns `{ key }`.
  - **Rate limit:** the Workers rate-limit binding, 20 uploads per IP per 10 minutes, then 429.
  - **CORS:** `Access-Control-Allow-Origin` for the site origin (env `SITE_ORIGIN`) and
    `http://localhost:3000`.
- **`GET /img/<key>`:** streams the object with its stored type, plus
  `X-Content-Type-Options: nosniff` and `Content-Security-Policy: default-src 'none'`. A key that is
  not `uuid.ext` gets a 400.
- **The local Node server** (`scripts/server.mjs`) gets the same two routes, backed by a folder
  (`.images/`, gitignored), so `npm run dev:all` works offline.
- The image base URL is derived from `WS_URL` (`ws` becomes `http`, `wss` becomes `https`), so no
  new env var is needed.

## Data model
- **New `ItemKind` `'image'`:** fields `src: string` (the key, never a full URL, so a board moves
  between servers), `aspect: number` (w/h at upload), and the usual `x y w h angle z locked`.
- `io.ts` accepts `'image'` and requires `src` to match `^[0-9a-f-]{36}\.(png|jpe?g|webp|gif)$`.
  An exported file keeps the key: it is a reference, and the stored image is not embedded.

## Client
- **Adding an image:** three ways.
  1. The image tool (key I) opens a file picker.
  2. Paste an image on the board (a `paste` listener while not editing text).
  3. Drop a file onto the canvas.
- **Upload flow:**
  1. While uploading, show a placeholder item, local only and not in the doc, with a Riso progress
     stripe.
  2. On `{ key }`, `addItem` an `image` at the drop point. It is at most 480 wide, with `h` from the
     aspect.
  3. On an error, show a toast in the reader's language: too big, wrong type, too many uploads,
     offline.
- **Rendering:** an `<img src={base + '/img/' + src} draggable={false} alt="">` filling the box,
  with a rough outline frame from `sketch.ts`. `loading="lazy"`, `decoding="async"`. A failed load
  shows a hatched placeholder with an image icon, not a broken-image glyph.
- **Resize** keeps the aspect: the resize code uses `aspect` for image items.
- **Export:** `picture.ts` loads each image with `crossOrigin = 'anonymous'` (the worker's GET sends
  `Access-Control-Allow-Origin: *` for images) and draws it. An image that fails to load is drawn
  as the placeholder, so the export never fails.

## Testing
- **Worker:** a `wrangler dev` probe.
  - A PNG upload returns a key, and GET returns the same bytes with `image/png`.
  - A `.png` named file containing HTML is refused (magic bytes).
  - 6MB is refused.
  - SVG is refused.
  - The 21st upload in 10 minutes gets 429.
- **Local server:** the same probes.
- **Playwright** (local server):
  - drop a PNG and see it appear in a second context
  - resize and check the aspect held
  - export a PNG that contains it
- `tsc`, `eslint`, `build` and worker `tsc` pass.

## Owner steps
1. Create the R2 bucket.
2. Run `npm run worker:deploy`.

The site needs no new env var.
