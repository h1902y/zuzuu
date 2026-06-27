// The /api/zuzuu/* routes (zuzuu-routes.ts): CLI-first reads with file-read
// fallbacks, CLI-only mutations (503/502 mapping), and argv-injection gates —
// all through stub binaries (see zuzuu-fixtures.ts).
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, realpathSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createZuzuuApi } from "../../src/server/zuzuu-routes.js";
import { envelope, fixtureHome, jsonStub, failStub, markerStub, argvStub } from "./zuzuu-fixtures.js";

let root: string;
// realpath the temp root: resolveSafe requires an already-realpath'd root (the
// daemon does this at startup); on macOS /var → /private/var would else 403.
beforeEach(() => { root = realpathSync(mkdtempSync(path.join(tmpdir(), "zw-"))); });
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("createZuzuuApi file routes", () => {
  it("GET /module/:key peek degrades to frontmatter fields; rejects unsafe slugs", async () => {
    fixtureHome(root);
    const app = createZuzuuApi(() => root, { binary: "definitely-not-a-real-binary-zzz" });
    const body = await (await app.request("/module/knowledge")).json();
    expect(body.degraded).toBe(true);
    expect(body.items[0]).toMatchObject({ id: "k1", module: "knowledge", kind: "fact", title: "fact one", status: "active" });
    expect(body.items[0].payload).toBeUndefined(); // detail degrades, counts survive
    expect(body.staged[0].title).toMatch(/node:sqlite/);
    // staged enrich from disk: title + preview from the change body, rationale +
    // evidence (the WHY, feeding the reason line), and an honest confidence (null
    // today — never faked from `score`, which is a number).
    expect(body.staged[0]).toMatchObject({
      id: "p1", module: "knowledge", op: "create",
      title: "use node:sqlite",
      preview: "use node:sqlite",
      rationale: "recurring + cross-session",
      evidence: [{ kind: "fact", occurrences: 12, sessions: 3 }],
      confidence: null,
    });
    // Any valid slug is now accepted (N-module: unknown slugs return empty results, not 404).
    // Unsafe slugs (traversal, shell meta) are still rejected.
    expect((await app.request("/module/bogus")).status).toBe(200); // valid slug, empty module
    expect((await app.request("/module/..%2f..%2fetc")).status).toBe(404); // unsafe slug
  });
  it("GET /module/:key passes the CLI's envelopes through whole (payload + body)", async () => {
    fixtureHome(root);
    const item = {
      id: "k1", module: "knowledge", kind: "command", title: "Test command",
      status: "active", created_at: "2026-06-12T00:00:00Z",
      provenance: [{ session: "ses_abc", ref: "occurrences=12" }],
      payload: { type: "command", attributes: { command: "npm test" } },
      body: "Run the suite.",
    };
    const stub = jsonStub(root, JSON.stringify({ module: "knowledge", count: 1, items: [item], errors: [] }));
    const app = createZuzuuApi(() => root, { binary: stub });
    const body = await (await app.request("/module/knowledge")).json();
    expect(body.degraded).toBeUndefined();
    expect(body.items[0]).toEqual(item); // THE ENVELOPE, untouched
    expect(body.errors).toEqual([]);
  });
  it("GET /module/:key/item/:id surfaces the current note body (the update diff's 'before' source)", async () => {
    fixtureHome(root);
    // The update diff (U3) reads the CURRENT note body as its 'before'. The item
    // route shells `zz module item <key> <id>` and passes the envelope through whole,
    // so `body` rides to the client (which diffs it against the staged change).
    const note = {
      id: "fact-node-sqlite", module: "knowledge", kind: "fact", title: "use node:sqlite",
      status: "active", body: "use node:sqlite — it ships in the runtime",
    };
    const app = createZuzuuApi(() => root, { binary: jsonStub(root, JSON.stringify(note)) });
    const res = await app.request("/module/knowledge/item/fact-node-sqlite");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(note); // body surfaced for the before/after diff
    // an unsafe id never reaches the CLI
    expect((await app.request("/module/knowledge/item/..%2fevil")).status).toBe(400);
  });
  it("GET /module/:key/schema: CLI → builtin/home schema; absent CLI → seeded file; else null", async () => {
    const agent = fixtureHome(root);
    const schema = { type: "object", required: ["type"] };
    const viaCli = createZuzuuApi(() => root, { binary: jsonStub(root, JSON.stringify(schema)) });
    expect(await (await viaCli.request("/module/knowledge/schema")).json())
      .toEqual({ key: "knowledge", schema, source: "cli" });

    const absent = createZuzuuApi(() => root, { binary: "definitely-not-a-real-binary-zzz" });
    expect(await (await absent.request("/module/knowledge/schema")).json())
      .toEqual({ key: "knowledge", schema: null, source: "absent" });

    writeFileSync(path.join(agent, "knowledge", "schema.json"), JSON.stringify(schema));
    expect(await (await absent.request("/module/knowledge/schema")).json())
      .toEqual({ key: "knowledge", schema, source: "home" });
    // N-module: any valid slug is accepted; "bogus" returns absent (no schema file), not 404.
    expect(await (await absent.request("/module/bogus/schema")).json())
      .toEqual({ key: "bogus", schema: null, source: "absent" });
  });
  it("GET /module/:key/generations reads .generations/<module>/ (<n>.json + active)", async () => {
    const agent = fixtureHome(root);
    mkdirSync(path.join(agent, ".generations", "knowledge"), { recursive: true });
    writeFileSync(path.join(agent, ".generations", "knowledge", "1.json"), JSON.stringify({ n: 1, mintedAt: "2026-06-12", mintedFrom: ["p1"] }));
    writeFileSync(path.join(agent, ".generations", "knowledge", "active"), "1");
    const app = createZuzuuApi(() => root, { binary: "x" });
    const body = await (await app.request("/module/knowledge/generations")).json();
    expect(body.module).toBe("knowledge");
    expect(body.active).toBe("1");
    expect(body.generations[0].id).toBe("1");
    expect(body.generations[0].mintedFrom).toEqual(["p1"]);
  });
  it("path escape is rejected (no traversal)", async () => {
    fixtureHome(root);
    const app = createZuzuuApi(() => root, { binary: "x" });
    expect((await app.request("/module/..%2f..%2fetc")).status).toBe(404);
  });

  it("GET /held shells `zz session status --json` → the id-enriched held[] (U6)", async () => {
    fixtureHome(root);
    const status = JSON.stringify({
      enabled: true, main: "main", active: null, onSessionBranch: false,
      held: [{ branch: "zz/session-abc", checkpoints: 2, files: 3, added: 9, removed: 2, mergeability: "ready" }],
    });
    const app = createZuzuuApi(() => root, { binary: jsonStub(root, status) });
    const body = await (await app.request("/held")).json();
    expect(body.held).toEqual([
      { id: "abc", branch: "zz/session-abc", kind: "worktree", checkpoints: 2, files: 3, added: 9, removed: 2, mergeability: "ready" },
    ]);
  });

  it("GET /held degrades to { held: [] } when the CLI is absent", async () => {
    fixtureHome(root);
    const app = createZuzuuApi(() => root, { binary: "definitely-not-a-real-binary-zzz" });
    expect(await (await app.request("/held")).json()).toEqual({ held: [] });
  });
});

describe("createZuzuuApi overview", () => {
  it("GET /overview passes the CLI's batched payload through whole", async () => {
    fixtureHome(root);
    const payload = {
      modules: [{
        id: "knowledge", title: "Knowledge", tagline: "what is TRUE",
        ui: { icon: "book", accent: "info", teaching: "Facts land here." },
        kinds: ["fact"], declarative: false,
        counts: { items: 1, pending: 3, errors: 0 }, top: ["Hot file"],
      }],
    };
    const app = createZuzuuApi(() => root, { binary: jsonStub(root, JSON.stringify(payload)) });
    const res = await app.request("/overview");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(payload);
  });
  it("GET /overview degrades to a peek (counts survive, no ui) when the CLI is absent", async () => {
    fixtureHome(root);
    const app = createZuzuuApi(() => root, { binary: "definitely-not-a-real-binary-zzz" });
    const body = await (await app.request("/overview")).json();
    expect(body.degraded).toBe(true);
    expect(body.modules).toHaveLength(5);
    const k = body.modules.find((f: { id: string }) => f.id === "knowledge");
    expect(k).toMatchObject({ title: "Knowledge", counts: { items: 1, pending: 1, errors: 0 } });
    expect(k.top).toEqual(["fact one"]);
    expect(k.ui).toBeUndefined();
    // F6: peek entries carry `enabled` for shape parity with the CLI producer
    expect(k.enabled).toBe(true);
    for (const m of body.modules) expect(m.enabled).toBe(true);
  });

  it("GET /overview on an empty brain (no module dirs) degrades to zero modules", async () => {
    // No prebuilt modules: a fresh repo with no module.md-bearing dirs → empty dashboard.
    mkdirSync(path.join(root, ".zuzuu"), { recursive: true });
    const app = createZuzuuApi(() => root, { binary: "definitely-not-a-real-binary-zzz" });
    const body = await (await app.request("/overview")).json();
    expect(body.degraded).toBe(true);
    expect(body.modules).toHaveLength(0);
  });

  it("GET /overview ignores a dir without a module.md (mirrors listModules)", async () => {
    fixtureHome(root);
    // a stray dir with no manifest is not a module
    mkdirSync(path.join(root, ".zuzuu", "scratch", "items"), { recursive: true });
    const app = createZuzuuApi(() => root, { binary: "definitely-not-a-real-binary-zzz" });
    const body = await (await app.request("/overview")).json();
    expect(body.modules.map((m: { id: string }) => m.id)).not.toContain("scratch");
    expect(body.modules).toHaveLength(5);
  });
});

const post = (app: ReturnType<typeof createZuzuuApi>, p: string, body?: unknown) =>
  app.request(p, {
    method: "POST",
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

// Every mutation route: [path, request body, stub success payload]
const MUTATIONS: [string, unknown, Record<string, unknown>][] = [
  ["/staged/p1/approve", { module: "knowledge" }, { ok: true, action: "approve", itemIds: ["k2"], warnings: [] }],
  ["/staged/p1/reject", { module: "knowledge", reason: "dup of k1" }, { ok: true, id: "p1" }],
  ["/actions/my-slug/approve", {}, { ok: true, action: "approve", slug: "my-slug" }],
  ["/actions/my-slug/reject", {}, { ok: true, action: "reject", slug: "my-slug" }],
  ["/module/knowledge/generation/mint", { from: ["p1", "p2"] }, { id: "gen_002", module: "knowledge", mintedFrom: ["p1", "p2"], forkedFrom: "gen_001" }],
  ["/module/knowledge/generation/gen_001/rollback", {}, { ok: true, module: "knowledge", restored: 3, active: "gen_001" }],
];

describe("createZuzuuApi mutation routes", () => {
  for (const [route, body, payload] of MUTATIONS) {
    it(`POST ${route} → 200 with the CLI's JSON on stub success`, async () => {
      fixtureHome(root);
      const app = createZuzuuApi(() => root, { binary: jsonStub(root, JSON.stringify(payload)) });
      const res = await post(app, route, body);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(payload);
    });
    it(`POST ${route} → 502 + stderr tail when the CLI fails`, async () => {
      fixtureHome(root);
      const app = createZuzuuApi(() => root, { binary: failStub(root, "kaboom from zuzuu") });
      const res = await post(app, route, body);
      expect(res.status).toBe(502);
      const j = await res.json();
      expect(j.error).toBe("zuzuu command failed");
      expect(j.stderr).toMatch(/kaboom from zuzuu/);
    });
    it(`POST ${route} → 503 when the binary is absent`, async () => {
      fixtureHome(root);
      const app = createZuzuuApi(() => root, { binary: "definitely-not-a-real-binary-zzz" });
      const res = await post(app, route, body);
      expect(res.status).toBe(503);
      expect((await res.json()).error).toBe("zuzuu CLI required");
    });
  }

  it("traversal id ../x → 400, and the binary is NEVER spawned", async () => {
    fixtureHome(root);
    const { stub, marker } = markerStub(root);
    const app = createZuzuuApi(() => root, { binary: stub });
    for (const route of [
      "/staged/..%2fx/approve",
      "/staged/..%2fx/reject",
      "/actions/..%2fx/approve",
      "/actions/..%2fx/reject",
      "/module/knowledge/generation/..%2fx/rollback",
    ]) {
      const res = await post(app, route, { module: "knowledge" });
      expect(res.status).toBe(400);
    }
    expect(existsSync(marker)).toBe(false);
  });
  it("shell-meta id a;rm → 400 without spawn", async () => {
    fixtureHome(root);
    const { stub, marker } = markerStub(root);
    const app = createZuzuuApi(() => root, { binary: stub });
    expect((await post(app, "/staged/a;rm/approve", { module: "knowledge" })).status).toBe(400);
    expect((await post(app, "/actions/a;rm/reject", {})).status).toBe(400);
    expect(existsSync(marker)).toBe(false);
  });
  it("malformed module → 400 without spawn (N-module: valid slugs are accepted)", async () => {
    fixtureHome(root);
    const { stub, marker } = markerStub(root);
    const app = createZuzuuApi(() => root, { binary: stub });
    // Missing module field → 400
    expect((await post(app, "/staged/p1/approve", {})).status).toBe(400);
    // Unsafe module strings → 400 (traversal, shell meta, uppercase-only slugs starting with -)
    expect((await post(app, "/staged/p1/approve", { module: "../evil" })).status).toBe(400);
    expect((await post(app, "/staged/p1/approve", { module: "-bad" })).status).toBe(400);
    expect((await post(app, "/staged/p1/reject", { module: "" })).status).toBe(400);
    // Valid slug "bogus" IS now accepted (N-module: CLI reports not-found for unknown modules)
    expect(existsSync(marker)).toBe(false); // none of the above should have spawned
  });
  it("over-long reject reason → 400 without spawn", async () => {
    fixtureHome(root);
    const { stub, marker } = markerStub(root);
    const app = createZuzuuApi(() => root, { binary: stub });
    const res = await post(app, "/staged/p1/reject", { module: "knowledge", reason: "x".repeat(501) });
    expect(res.status).toBe(400);
    expect(existsSync(marker)).toBe(false);
  });
  it("200-char id → 400 without spawn (SAFE_ID length cap)", async () => {
    fixtureHome(root);
    const { stub, marker } = markerStub(root);
    const app = createZuzuuApi(() => root, { binary: stub });
    const longId = "a".repeat(200);
    expect((await post(app, `/staged/${longId}/approve`, { module: "knowledge" })).status).toBe(400);
    expect(existsSync(marker)).toBe(false);
  });
  it("mint with 201-element from[] → 400 without spawn", async () => {
    fixtureHome(root);
    const { stub, marker } = markerStub(root);
    const app = createZuzuuApi(() => root, { binary: stub });
    const ids = Array.from({ length: 201 }, (_, i) => `id${i}`);
    expect((await post(app, "/module/knowledge/generation/mint", { from: ids })).status).toBe(400);
    expect(existsSync(marker)).toBe(false);
  });
  it("reject reason rides as one argv element (shell-meta inert)", async () => {
    fixtureHome(root);
    const app = createZuzuuApi(() => root, { binary: argvStub(root) });
    const res = await post(app, "/staged/p1/reject", { module: "knowledge", reason: "dup; $(rm -rf) of k1" });
    expect(res.status).toBe(200);
    expect((await res.json()).argv).toBe("review|reject|knowledge|p1|--reason|dup; $(rm -rf) of k1|--json|");
  });
  it("mint with a bad from-id → 400 without spawn; mint with no body → 200", async () => {
    fixtureHome(root);
    const { stub, marker } = markerStub(root);
    const app = createZuzuuApi(() => root, { binary: stub });
    expect((await post(app, "/module/knowledge/generation/mint", { from: ["ok-id", "../evil"] })).status).toBe(400);
    expect((await post(app, "/module/knowledge/generation/mint", { from: "p1" })).status).toBe(400);
    expect(existsSync(marker)).toBe(false);
    const ok = createZuzuuApi(() => root, { binary: jsonStub(root, '{"id":"gen_002","module":"knowledge","mintedFrom":[],"forkedFrom":null}') });
    expect((await post(ok, "/module/knowledge/generation/mint")).status).toBe(200);
  });
});

describe("createZuzuuApi POST /module/new (WS-D guided creation)", () => {
  it("→ 200 with the CLI's JSON; builds the right argv (strings as single elements)", async () => {
    fixtureHome(root);
    const app = createZuzuuApi(() => root, { binary: argvStub(root, "zuzuu-newmod.sh") });
    const res = await post(app, "/module/new", {
      id: "recipes", title: "Recipes", tagline: "cook things",
      capabilities: ["items.collection", "mine"], kinds: ["note"], required: ["body"],
    });
    expect(res.status).toBe(200);
    expect((await res.json()).argv).toBe(
      "module|new|recipes|--title|Recipes|--tagline|cook things|--capabilities|items.collection,mine|--kinds|note|--required|body|--json|",
    );
  });
  it("omits empty optional flags", async () => {
    fixtureHome(root);
    const app = createZuzuuApi(() => root, { binary: argvStub(root, "zuzuu-newmod2.sh") });
    const res = await post(app, "/module/new", { id: "notes", capabilities: ["items.collection"], kinds: ["note"] });
    expect(res.status).toBe(200);
    expect((await res.json()).argv).toBe("module|new|notes|--capabilities|items.collection|--kinds|note|--json|");
  });
  it("rejects a bad id and bad list/string fields without spawning", async () => {
    fixtureHome(root);
    const { stub, marker } = markerStub(root);
    const app = createZuzuuApi(() => root, { binary: stub });
    expect((await post(app, "/module/new", { id: "../evil" })).status).toBe(400);
    expect((await post(app, "/module/new", { id: "Bad" })).status).toBe(400);
    expect((await post(app, "/module/new", {})).status).toBe(400);
    expect((await post(app, "/module/new", { id: "ok", capabilities: "nope" })).status).toBe(400);
    expect((await post(app, "/module/new", { id: "ok", capabilities: ["a,b"] })).status).toBe(400);
    expect((await post(app, "/module/new", { id: "ok", title: "x".repeat(201) })).status).toBe(400);
    expect(existsSync(marker)).toBe(false);
  });
});

