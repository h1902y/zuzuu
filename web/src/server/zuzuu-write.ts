// src/server/zuzuu-write.ts — one job: the WRITE side of /api/zuzuu/* (POST
// mutations). staged approve/reject (via `zz review`) · module enable/disable · module new ·
// per-module generation mint/rollback · session label. EVERY mutation shells out
// to the zz CLI (runZuzuuMut) — the daemon never reimplements module writes; CLI
// absent → 503. Inputs are validated BEFORE the spawn; strings ride as single argv
// elements, so shell-metacharacters are inert.

import { Hono } from "hono";
import type { Context } from "hono";
import { runCommandMut, type CommandId } from "./zuzuu-catalog.js";
import { SAFE_ID, SAFE_SLUG, MAX_REASON_LEN } from "./zuzuu-peek.js";

export function createZuzuuWriteApi(getRoot: () => string, binary?: string): Hono {
  const app = new Hono();

  const readBody = async (c: Context): Promise<Record<string, unknown>> => {
    try { const b = await c.req.json(); return b && typeof b === "object" ? b as Record<string, unknown> : {}; }
    catch { return {}; }
  };
  /** Run a catalog mutation (commandId + named params → argv, built + validated by the
   *  catalog, never hand-typed) and map the result: absent → 503, failed → 502 (incl. an
   *  unknown commandId — refused before any spawn), success → 200 + CLI JSON. */
  const mutate = async (c: Context, commandId: CommandId, params?: Record<string, string | undefined>) => {
    const r = await runCommandMut(getRoot(), commandId, params, { binary });
    if (!r.ok) {
      return r.code === "absent"
        ? c.json({ error: "zuzuu CLI required" }, 503)
        : c.json({ error: "zuzuu command failed", stderr: r.stderr ?? "", data: r.data ?? null }, 502);
    }
    return c.json(r.data as Record<string, unknown>);
  };
  /** A valid module arg: any safe slug (the CLI reports not-found for unknown ones). */
  const isModule = (f: unknown): f is string => typeof f === "string" && SAFE_SLUG.test(f);

  // ── the operator lane (P1): direct row create/delete — the human's instant CRUD.
  //    Distinct from the staged-proposal lane below: this lands NOW (validated +
  //    minted by the CLI); the agent can never reach it (execution-gate denied).
  app.post("/module/:key/row", async (c) => {
    const key = c.req.param("key");
    if (!SAFE_SLUG.test(key)) return c.json({ error: "unknown module" }, 404);
    const body = await readBody(c);
    const { id, change, force } = body;
    if (typeof id !== "string" || !SAFE_ID.test(id)) return c.json({ error: "bad id" }, 400);
    if (change !== undefined && (typeof change !== "object" || change === null || Array.isArray(change))) {
      return c.json({ error: "change must be an object" }, 400);
    }
    return mutate(c, "note.create", {
      module: key, id,
      change: change ? JSON.stringify(change) : undefined,
      force: force === true ? "true" : undefined,
    });
  });
  app.delete("/module/:key/row/:id", async (c) => {
    const key = c.req.param("key");
    const id = c.req.param("id");
    if (!SAFE_SLUG.test(key)) return c.json({ error: "unknown module" }, 404);
    if (!SAFE_ID.test(id)) return c.json({ error: "bad id" }, 400);
    return mutate(c, "note.delete", { module: key, id });
  });

  // Set/clear a session's user label. A blank label clears it.
  app.post("/session-label/:id", async (c) => {
    const id = c.req.param("id");
    if (!SAFE_ID.test(id)) return c.json({ error: "bad id" }, 400);
    const body = await readBody(c);
    const label = typeof body.label === "string" ? body.label : "";
    if (label.length > 200) return c.json({ error: "label too long" }, 400);
    // a blank label rides as `--text ""` (clears it) — the empty string is supplied, not omitted
    return mutate(c, "session.label", { id, text: label });
  });

  // Toggle a module's enabled flag. Body: { enabled: boolean }.
  app.post("/module/:key/enabled", async (c) => {
    const key = c.req.param("key");
    if (!SAFE_SLUG.test(key)) return c.json({ error: "unknown module" }, 404);
    const { enabled } = await readBody(c);
    if (typeof enabled !== "boolean") return c.json({ error: "body must be {enabled: boolean}" }, 400);
    return mutate(c, enabled ? "module.enable" : "module.disable", { key });
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
    // named params → the catalog builds `module new <id> [--title …]` (flags omitted when
    // absent/empty, exactly as the old conditional pushes did — argv byte-identical)
    return mutate(c, "module.new", {
      id,
      title: okStr(title) && title ? title : undefined,
      tagline: okStr(tagline) && tagline ? tagline : undefined,
      capabilities: Array.isArray(capabilities) && capabilities.length ? capabilities.join(",") : undefined,
      kinds: Array.isArray(kinds) && kinds.length ? kinds.join(",") : undefined,
      required: Array.isArray(required) && required.length ? required.join(",") : undefined,
    });
  });

  app.post("/staged/:id/approve", async (c) => {
    const id = c.req.param("id");
    if (!SAFE_ID.test(id)) return c.json({ error: "bad id" }, 400);
    const { module } = await readBody(c);
    if (!isModule(module)) return c.json({ error: "bad module" }, 400);
    // the real CLI verb: `zz review approve <module> <id>` (positional, no flags)
    return mutate(c, "review.approve", { module, id });
  });

  app.post("/staged/:id/reject", async (c) => {
    const id = c.req.param("id");
    if (!SAFE_ID.test(id)) return c.json({ error: "bad id" }, 400);
    const { module, reason } = await readBody(c);
    if (!isModule(module)) return c.json({ error: "bad module" }, 400);
    if (reason !== undefined && (typeof reason !== "string" || reason.length > MAX_REASON_LEN))
      return c.json({ error: "bad reason" }, 400);
    // reason rides as ONE argv element — spawn arrays make shell-meta inert; an empty/absent
    // reason omits the flag (the catalog drops an undefined value)
    return mutate(c, "review.reject", { module, id, reason: typeof reason === "string" && reason ? reason : undefined });
  });

  // The write entry-door: stage a create/update as a PENDING proposal (the review
  // gate governs it; it lands only on approve). Body: { op, target, change }.
  // Returns the StagedChange handle. The `change` rides as ONE --change <json> argv.
  app.post("/module/:key/stage", async (c) => {
    const key = c.req.param("key");
    if (!isModule(key)) return c.json({ error: "bad module" }, 400);
    const body = await readBody(c);
    const op = body.op;
    if (op !== "create" && op !== "update" && op !== "delete" && op !== "relate" && op !== "unrelate" && op !== "deprecate")
      return c.json({ error: "op must be create|update|delete|relate|unrelate|deprecate" }, 400);
    const { target, change } = body;
    if ((op === "create" || op === "update") && (typeof target !== "string" || !SAFE_ID.test(target)))
      return c.json({ error: "create/update need a valid target id" }, 400);
    if (change !== undefined && (typeof change !== "object" || change === null || Array.isArray(change)))
      return c.json({ error: "change must be an object" }, 400);
    // the catalog builds `stage <key> --op <op> [--target <id>] --change <json>` (--target
    // omitted when absent; --change always rides as ONE json argv element)
    return mutate(c, "stage", {
      module: key, op,
      target: typeof target === "string" ? target : undefined,
      change: JSON.stringify(change ?? {}),
    });
  });

  for (const verb of ["approve", "reject"] as const) {
    app.post(`/actions/:slug/${verb}`, async (c) => {
      const slug = c.req.param("slug");
      if (!SAFE_ID.test(slug)) return c.json({ error: "bad slug" }, 400);
      return mutate(c, "act", { module: verb, id: slug });
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
    // generation mint` shape never existed — that was the live daemon bug Rung 9 fixed; the
    // catalog now makes shelling such a nonexistent verb impossible).
    return mutate(c, "gen.mint", { module: key, from: fromIds.length ? fromIds.join(",") : undefined });
  });

  // Per-module rollback (restore ONE module's bytes + active to a past gen).
  app.post("/module/:key/generation/:id/rollback", async (c) => {
    const key = c.req.param("key");
    if (!isModule(key)) return c.json({ error: "bad module" }, 400);
    const id = c.req.param("id");
    if (!SAFE_ID.test(id)) return c.json({ error: "bad id" }, 400);
    // reconcile the drift: the real CLI verb is `zz module <key> rollback <n>`
    // (no `generation` subword; <n> is the generation number)
    return mutate(c, "module.rollback", { key, id });
  });

  // ── §H.5 the field-config panel: ALTER TABLE on a module's typed-column schema.
  //    POST adds a column, PATCH alters one — both land instantly (operator-gated,
  //    like `module new`), each minting a generation (rollback-able). Validated
  //    before the spawn, same as every other write here.
  const KNOWN_FIELD_TYPES = new Set(["text", "longtext", "select", "multi", "link", "date", "number", "bool"]);
  const okColumnName = (v: unknown): v is string => typeof v === "string" && SAFE_SLUG.test(v) && v.length <= 64;
  const okShortStr = (v: unknown, max: number): v is string => typeof v === "string" && v.length <= max;
  const okOptions = (v: unknown): v is string[] =>
    Array.isArray(v) && v.length <= 50 && v.every((o) => typeof o === "string" && o.length <= 100 && !o.includes(","));

  /** Field-def params shared by add (type required) and alter (type optional —
   *  the panel sends it anyway, a full-snapshot save, but a caller MAY omit it to
   *  leave the type untouched). Returns catalog params on success, an error string
   *  on the first invalid key. `required` rides as an explicit 'true'/'false'
   *  string — never bare — so the CLI's flag() coercion can turn it OFF too. */
  function columnFieldParams(body: Record<string, unknown>, { requireType }: { requireType: boolean }): { params: Record<string, string | undefined> } | { error: string } {
    const params: Record<string, string | undefined> = {};
    if (requireType || body.type !== undefined) {
      if (!okShortStr(body.type, 20) || !KNOWN_FIELD_TYPES.has(body.type))
        return { error: `type must be one of ${[...KNOWN_FIELD_TYPES].join("|")}` };
      params.type = body.type;
    }
    if (body.required !== undefined) {
      if (typeof body.required !== "boolean") return { error: "required must be a boolean" };
      params.required = body.required ? "true" : "false";
    }
    if (body.options !== undefined) {
      if (!okOptions(body.options)) return { error: "options must be a list of short strings (no commas)" };
      params.options = (body.options as string[]).join(",");
    }
    if (body.default !== undefined) {
      if (!okShortStr(body.default, 500)) return { error: "bad default" };
      params.default = body.default;
    }
    if (body.label !== undefined) {
      if (!okShortStr(body.label, 200)) return { error: "bad label" };
      params.label = body.label;
    }
    if (body.description !== undefined) {
      if (!okShortStr(body.description, 1000)) return { error: "bad description" };
      params.description = body.description;
    }
    if (body.computed !== undefined) {
      if (!okShortStr(body.computed, 200)) return { error: "bad computed formula" };
      params.computed = body.computed;
    }
    return { params };
  }

  // Add a column (the toolbar's "+ column", single-module scope only).
  app.post("/module/:key/column", async (c) => {
    const key = c.req.param("key");
    if (!isModule(key)) return c.json({ error: "bad module" }, 400);
    const body = await readBody(c);
    if (!okColumnName(body.name)) return c.json({ error: "bad column name" }, 400);
    const r = columnFieldParams(body, { requireType: true });
    if ("error" in r) return c.json({ error: r.error }, 400);
    return mutate(c, "module.add-column", { module: key, name: body.name as string, ...r.params });
  });

  // Alter an existing column (the header caret's "Edit column"). `name` is
  // immutable (rename is a refactor, offered separately — never here).
  app.patch("/module/:key/column/:name", async (c) => {
    const key = c.req.param("key");
    if (!isModule(key)) return c.json({ error: "bad module" }, 400);
    const name = c.req.param("name");
    if (!okColumnName(name)) return c.json({ error: "bad column name" }, 400);
    const body = await readBody(c);
    const r = columnFieldParams(body, { requireType: false });
    if ("error" in r) return c.json({ error: r.error }, 400);
    return mutate(c, "module.alter-column", { module: key, name, ...r.params });
  });

  return app;
}
