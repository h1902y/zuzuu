// src/server/static.ts — serve the built SPA (dist/web) with an index.html
// fallback. Self-contained: the only daemon concern here is "hand back static
// assets"; pulled out of server.ts so buildApp() reads as a table of mounts.

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import type { MiddlewareHandler } from "hono";
import { safeJoin } from "./safe-path.js";

const STATIC_MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
};

/** A catch-all handler that streams files from `webDist`, falling back to
 *  index.html for client-side routes. `/assets/*` are cached immutably. */
export function serveStatic(webDist: string): MiddlewareHandler {
  return async (c) => {
    const rel = decodeURIComponent(new URL(c.req.url).pathname);
    let abs: string;
    try {
      abs = safeJoin(webDist, rel);
    } catch {
      return c.text("not found", 404);
    }
    let st = await fsp.stat(abs).catch(() => null);
    if (!st?.isFile()) {
      abs = path.join(webDist, "index.html");
      st = await fsp.stat(abs).catch(() => null);
      if (!st) return c.text("web UI not built — run: cd web && npm run build (or `npm run build:web` from the repo root)", 404);
    }
    const ext = path.extname(abs).toLowerCase();
    const immutable = rel.startsWith("/assets/");
    return new Response(Readable.toWeb(fs.createReadStream(abs)) as ReadableStream, {
      headers: {
        "Content-Type": STATIC_MIME[ext] ?? "application/octet-stream",
        "Cache-Control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
      },
    });
  };
}
