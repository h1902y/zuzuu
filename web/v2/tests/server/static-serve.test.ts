// The daemon serves the built client SPA from webDist (dist/web): index.html at
// /, asset files directly, an index.html fallback for client routes, and a
// path-escape that 404s rather than leaking outside webDist. This is the serve
// half of Rung 3 — the e2e test covers the terminal socket; this covers the SPA.
import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { WebcodeServer } from "../../src/server/server.js";

const PORT = 7799;
const HOST = { host: `127.0.0.1:${PORT}` }; // in the gate's allowlist (cfg.port == PORT)
let dirs: string[] = [];

afterEach(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); dirs = []; });

function serverWithClient(): WebcodeServer {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), "zw-root-")));
  const webDist = realpathSync(mkdtempSync(path.join(tmpdir(), "zw-web-")));
  dirs.push(root, webDist);
  writeFileSync(path.join(webDist, "index.html"), "<!doctype html><title>zz</title><div id=app>OK</div>");
  writeFileSync(path.join(webDist, "app.js"), "console.log('client')");
  return new WebcodeServer({ root, port: PORT, host: "127.0.0.1", token: "t", webDist, version: "0" });
}

describe("static SPA serving", () => {
  it("serves index.html at /", async () => {
    const res = await serverWithClient().app.request("/", { headers: HOST });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("id=app");
  });
  it("serves an asset file directly", async () => {
    const res = await serverWithClient().app.request("/app.js", { headers: HOST });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("console.log");
  });
  it("falls back to index.html for an unknown client route (SPA routing)", async () => {
    const res = await serverWithClient().app.request("/modules/knowledge", { headers: HOST });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("id=app");
  });
  it("404s a path-escape attempt instead of leaking outside webDist", async () => {
    const res = await serverWithClient().app.request("/..%2f..%2f..%2fetc%2fpasswd", { headers: HOST });
    expect(res.status).toBe(404);
  });
});
