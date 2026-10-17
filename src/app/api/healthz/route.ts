import { Elysia } from "elysia";
import { WebStandardAdapter } from "elysia/adapter/web-standard";

// Liveness stays independent of the separate Bun + Elysia Yjs relay and users' boards.
const app = new Elysia({ prefix: "/api", adapter: WebStandardAdapter })
  .get("/healthz", () => Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } }));

export const GET = app.fetch;
