// src/server/zuzuu-write.ts — one job: the WRITE side of /api/zuzuu/* (POST
// mutations). staged approve/reject (via `zz review`) · module enable/disable · module new ·
// per-module generation mint/rollback · session label. EVERY mutation shells out
// to the zz CLI (runZuzuuMut) — the daemon never reimplements module writes; CLI
// absent → 503. Inputs are validated BEFORE the spawn; strings ride as single argv
// elements, so shell-metacharacters are inert.

import { Hono } from "hono";
import type { Context } from "hono";
import { runZuzuuMut } from "./zuzuu-cli.js";
import { SAFE_ID, SAFE_SLUG, MAX_REASON_LEN } from "./zuzuu-peek.js";

export function createZuzuuWriteApi(getRoot: () => string, binary?: string): Hono {
  const app = new Hono();

  const readBody = async (c: Context): Promise<Record<string, unknown>> => {
    try { const b = await c.req.json(); return b && typeof b === "object" ? b as Record<string, unknown> : {}; }
    catch { return {}; }
  };
  /** Run a mutation and map the result: absent → 503, failed → 502, success → 200 + CLI JSON. */
  const mutate = async (c: Context, args: string[]) => {
    const r = await runZuzuuMut(getRoot(), args, { binary });
    if (!r.ok) {
      return r.code === "absent"
        ? c.json({ error: "zuzuu CLI required" }, 503)
        : c.json({ error: "zuzuu command failed", stderr: r.stderr ?? "", data: r.data ?? null }, 502);
    }
    return c.json(r.data as Record<string, unknown>);
  };
  /** A valid module arg: any safe slug (the CLI reports not-found for unknown ones). */
  const isModule = (f: unknown): f is string => typeof f === "string" && SAFE_SLUG.test(f);

  // Set/clear a session's user label. A blank label clears it.
  app.post("/session-label/:id", async (c) => {
    const id = c.req.param("id");
    if (!SAFE_ID.test(id)) return c.json({ error: "bad id" }, 400);
    const body = await readBody(c);
    const label = typeof body.label === "string" ? body.label : "";
    if (label.length > 200) return c.json({ error: "label too long" }, 400);
    return mutate(c, ["session", "label", id, "--text", label]);
  });

  // Toggle a module's enabled flag. Body: { enabled: boolean }.
  app.post("/module/:key/enabled", async (c) => {
    const key = c.req.param("key");
    if (!SAFE_SLUG.test(key)) return c.json({ error: "unknown module" }, 404);
    const { enabled } = await readBody(c);
    if (typeof enabled !== "boolean") return c.json({ error: "body must be {enabled: boolean}" }, 400);
    return mutate(c, ["module", enabled ? "enable" : "disable", key]);
  });

  // Guided module creation (WS-D). Strings ride as single argv elements.
  app.post("/module/new", async (c) => {
    const body = await readBody(c);
    const { id, title, tagline, capabilities, kinds, required } = body;
    if (!isModule(id)) return c.json({ error: "bad module id" }, 400);
    const okStr = (v: unknown, max = 200): v is string => typeof v === "string" && v.length <= max;
    const okList = (v: unknown): v is string[] =>
      v === undefined ||
      (Array.isArray(v) && v.length <= 50 && v.every((s) => typeof s === "string" && s.length <= 100 && !s.includes(",")));
    if (title !== undefined && !okStr(title)) return c.json({ error: "bad title" }, 400);
    if (tagline !== undefined && !okStr(tagline)) return c.json({ error: "bad tagline" }, 400);
    if (!okList(capabilities)) return c.json({ error: "bad capabilities" }, 400);
    if (!okList(kinds)) return c.json({ error: "bad kinds" }, 400);
    if (!okList(required)) return c.json({ error: "bad required" }, 400);
    const args = ["module", "new", id];
    if (okStr(title) && title) args.push("--title", title);
    if (okStr(tagline) && tagline) args.push("--tagline", tagline);
    if (Array.isArray(capabilities) && capabilities.length) args.push("--capabilities", capabilities.join(","));
    if (Array.isArray(kinds) && kinds.length) args.push("--kinds", kinds.join(","));
    if (Array.isArray(required) && required.length) args.push("--required", required.join(","));
    return mutate(c, args);
  });

  app.post("/staged/:id/approve", async (c) => {
    const id = c.req.param("id");
    if (!SAFE_ID.test(id)) return c.json({ error: "bad id" }, 400);
    const { module } = await readBody(c);
    if (!isModule(module)) return c.json({ error: "bad module" }, 400);
    // the real CLI verb: `zz review approve <module> <id>` (positional, no flags)
    return mutate(c, ["review", "approve", module, id]);
  });

  app.post("/staged/:id/reject", async (c) => {
    const id = c.req.param("id");
    if (!SAFE_ID.test(id)) return c.json({ error: "bad id" }, 400);
    const { module, reason } = await readBody(c);
    if (!isModule(module)) return c.json({ error: "bad module" }, 400);
    if (reason !== undefined && (typeof reason !== "string" || reason.length > MAX_REASON_LEN))
      return c.json({ error: "bad reason" }, 400);
    // reason rides as ONE argv element — spawn arrays make shell-meta inert
    return mutate(c, ["review", "reject", module, id, ...(reason ? ["--reason", reason] : [])]);
  });

  // The write entry-door: stage a create/update as a PENDING proposal (the review
  // gate governs it; it lands only on approve). Body: { op, target, change }.
  // Returns the StagedChange handle. The `change` rides as ONE --change <json> argv.
  app.post("/module/:key/stage", async (c) => {
    const key = c.req.param("key");
    if (!isModule(key)) return c.json({ error: "bad module" }, 400);
    const body = await readBody(c);
    const op = body.op;
    if (op !== "create" && op !== "update" && op !== "delete" && op !== "relate" && op !== "deprecate")
      return c.json({ error: "op must be create|update|delete|relate|deprecate" }, 400);
    const { target, change } = body;
    if ((op === "create" || op === "update") && (typeof target !== "string" || !SAFE_ID.test(target)))
      return c.json({ error: "create/update need a valid target id" }, 400);
    if (change !== undefined && (typeof change !== "object" || change === null || Array.isArray(change)))
      return c.json({ error: "change must be an object" }, 400);
    const args = ["stage", key, "--op", op];
    if (typeof target === "string") args.push("--target", target);
    args.push("--change", JSON.stringify(change ?? {}));
    return mutate(c, args);
  });

  for (const verb of ["approve", "reject"] as const) {
    app.post(`/actions/:slug/${verb}`, async (c) => {
      const slug = c.req.param("slug");
      if (!SAFE_ID.test(slug)) return c.json({ error: "bad slug" }, 400);
      return mutate(c, ["act", verb, slug]);
    });
  }

  // Per-module mint (freeze ONE module's current items into its next gen).
  app.post("/module/:key/generation/mint", async (c) => {
    const key = c.req.param("key");
    if (!isModule(key)) return c.json({ error: "bad module" }, 400);
    const { from } = await readBody(c);
    if (from !== undefined &&
        (!Array.isArray(from) || from.length > 200 || !from.every((f) => typeof f === "string" && SAFE_ID.test(f))))
      return c.json({ error: "bad from ids" }, 400);
    const fromIds = (from as string[] | undefined) ?? [];
    // the real CLI verb is `zz gen mint <key> [--from a,b]` (the old `module <key>
    // generation mint` shape never existed — that was the live daemon bug Rung 9 fixes).
    return mutate(c, ["gen", "mint", key, ...(fromIds.length ? ["--from", fromIds.join(",")] : [])]);
  });

  // Per-module rollback (restore ONE module's bytes + active to a past gen).
  app.post("/module/:key/generation/:id/rollback", async (c) => {
    const key = c.req.param("key");
    if (!isModule(key)) return c.json({ error: "bad module" }, 400);
    const id = c.req.param("id");
    if (!SAFE_ID.test(id)) return c.json({ error: "bad id" }, 400);
    // reconcile the drift: the real CLI verb is `zz module <key> rollback <n>`
    // (no `generation` subword; <n> is the generation number)
    return mutate(c, ["module", key, "rollback", id]);
  });

  return app;
}
