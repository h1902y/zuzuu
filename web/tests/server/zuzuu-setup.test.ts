// U2 — the onboarding setup routes (/api/zuzuu/setup/*): init/enable/observe shell
// the zz CLI through stub binaries (see zuzuu-fixtures.ts); git-init is the one
// non-zz action (a real `git init`, confirm-gated). No real zz CLI.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, realpathSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createZuzuuApi } from "../../src/server/zuzuu-routes.js";
import { jsonStub, failStub } from "./zuzuu-fixtures.js";

let root: string;
beforeEach(() => { root = realpathSync(mkdtempSync(path.join(tmpdir(), "zw-"))); });
afterEach(() => rmSync(root, { recursive: true, force: true }));

const post = (app: ReturnType<typeof createZuzuuApi>, p: string, body: unknown = {}) =>
  app.request(p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("POST /setup/{init,enable,observe} — shell the zz verb", () => {
  it("returns the CLI JSON on success", async () => {
    const payload = { ok: true, home: `${root}/.zuzuu`, created: ["project.md"], skipped: [] };
    const app = createZuzuuApi(() => root, { binary: jsonStub(root, JSON.stringify(payload)) });
    const res = await post(app, "/setup/init");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(payload);
  });

  it("maps CLI failure modes: absent → 503, failed → 502", async () => {
    const absent = createZuzuuApi(() => root, { binary: "definitely-not-a-real-binary-zzz" });
    expect((await post(absent, "/setup/enable")).status).toBe(503);
    const failed = createZuzuuApi(() => root, { binary: failStub(root) });
    expect((await post(failed, "/setup/observe")).status).toBe(502);
  });
});

describe("POST /setup/git-init — the confirmed non-zz action", () => {
  it("requires { confirm: true }", async () => {
    const app = createZuzuuApi(() => root, { binary: jsonStub(root, "{}") });
    expect((await post(app, "/setup/git-init", {})).status).toBe(400);
    expect((await post(app, "/setup/git-init", { confirm: false })).status).toBe(400);
  });

  it("initializes a non-repo folder, then no-ops on an existing repo", async () => {
    const app = createZuzuuApi(() => root, { binary: jsonStub(root, "{}") });
    expect(existsSync(path.join(root, ".git"))).toBe(false);
    const first = await post(app, "/setup/git-init", { confirm: true });
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ ok: true, alreadyRepo: false });
    expect(existsSync(path.join(root, ".git"))).toBe(true);
    const second = await post(app, "/setup/git-init", { confirm: true });
    expect(await second.json()).toEqual({ ok: true, alreadyRepo: true });
  });
});
