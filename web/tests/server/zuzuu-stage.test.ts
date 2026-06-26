// U4 — the workbench data contract: the write entry-door (POST /module/:key/stage,
// returning a PENDING StagedChange, not a landed row), the getOne route
// (GET /module/:key/item/:id), and the reconciled rollback argv. All through stub
// binaries (see zuzuu-fixtures.ts) — no real zz CLI.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createZuzuuApi } from "../../src/server/zuzuu-routes.js";
import { fixtureHome, jsonStub, failStub, argvStub } from "./zuzuu-fixtures.js";

let root: string;
beforeEach(() => { root = realpathSync(mkdtempSync(path.join(tmpdir(), "zw-"))); });
afterEach(() => rmSync(root, { recursive: true, force: true }));

const post = (app: ReturnType<typeof createZuzuuApi>, p: string, body: unknown) =>
  app.request(p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("POST /module/:key/stage — a write resolves to a PENDING proposal", () => {
  it("returns the StagedChange handle from the CLI (status: pending, not a landed row)", async () => {
    fixtureHome(root);
    const handle = { id: "stg-abc", op: "create", module: "knowledge", target: "demo", status: "pending", score: 0, duplicate: false };
    const app = createZuzuuApi(() => root, { binary: jsonStub(root, JSON.stringify(handle)) });
    const res = await post(app, "/module/knowledge/stage", { op: "create", target: "demo", change: { type: "knowledge", title: "Demo" } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(handle);
  });

  it("validates: bad op → 400, create without target → 400, non-object change → 400", async () => {
    fixtureHome(root);
    const app = createZuzuuApi(() => root, { binary: jsonStub(root, "{}") });
    expect((await post(app, "/module/knowledge/stage", { op: "bogus", target: "x" })).status).toBe(400);
    expect((await post(app, "/module/knowledge/stage", { op: "create" })).status).toBe(400);
    expect((await post(app, "/module/knowledge/stage", { op: "create", target: "x", change: [] })).status).toBe(400);
  });

  it("maps CLI failure modes: absent → 503, failed → 502", async () => {
    fixtureHome(root);
    const absent = createZuzuuApi(() => root, { binary: "definitely-not-a-real-binary-zzz" });
    expect((await post(absent, "/module/knowledge/stage", { op: "create", target: "x", change: {} })).status).toBe(503);
    const failed = createZuzuuApi(() => root, { binary: failStub(root) });
    expect((await post(failed, "/module/knowledge/stage", { op: "create", target: "x", change: {} })).status).toBe(502);
  });
});

describe("GET /module/:key/item/:id — getOne", () => {
  it("returns the record from the CLI; an unknown id → 404", async () => {
    fixtureHome(root);
    const item = { id: "k1", module: "knowledge", kind: "knowledge", title: "K1", status: "active", body: "hi" };
    const found = createZuzuuApi(() => root, { binary: jsonStub(root, JSON.stringify(item)) });
    expect(await (await found.request("/module/knowledge/item/k1")).json()).toEqual(item);
    // the CLI exits non-zero for an unknown id → runZuzuu null → 404
    const missing = createZuzuuApi(() => root, { binary: failStub(root) });
    expect((await missing.request("/module/knowledge/item/zzz")).status).toBe(404);
  });
});

describe("POST /module/:key/generation/:id/rollback — the reconciled argv", () => {
  it("shells `module <key> rollback <n>` (no stale `generation` subword)", async () => {
    fixtureHome(root);
    const app = createZuzuuApi(() => root, { binary: argvStub(root) });
    const res = await post(app, "/module/knowledge/generation/2/rollback", {});
    const argv = (await res.json() as { argv: string }).argv;
    expect(argv).toContain("module|knowledge|rollback|2|");
    expect(argv).not.toContain("generation");
  });
});
