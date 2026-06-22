import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { AuthGate } from "../../src/server/auth.js";

const TOKEN = "token-AAA";
const TOKEN2 = "token-BBB";

/** The cookie value the gate hands out is sha256(token), base64url. */
const cookieFor = (token: string) =>
  crypto.createHash("sha256").update(token).digest("base64url");

/** A tiny app behind the gate + requireAuth, exposing one /api route. */
function app(token: string) {
  const gate = new AuthGate({ port: 7770, token });
  const a = new Hono();
  a.use("*", gate.gate());
  a.use("/api/*", gate.requireAuth());
  a.get("/api/ping", (c) => c.json({ ok: true }));
  a.get("/", (c) => c.text("root"));
  return { gate, a };
}

const LOCAL = { host: "127.0.0.1:7770", origin: "http://127.0.0.1:7770" };
const headers = (extra: Record<string, string> = {}) => ({ ...LOCAL, ...extra });

describe("AuthGate — token exchange → cookie", () => {
  it("sets the token-derived cookie on a valid ?token= and rejects an invalid one", async () => {
    const { a } = app(TOKEN);

    const ok = await a.request("/?token=" + TOKEN, { headers: headers() });
    expect(ok.status).toBe(302); // redirect, stripping the token
    const setCookie = ok.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`webcode_auth=${cookieFor(TOKEN)}`);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie.toLowerCase()).toContain("samesite=strict");

    const bad = await a.request("/?token=wrong", { headers: headers() });
    expect(bad.status).toBe(403);
    expect(bad.headers.get("set-cookie")).toBeNull();
  });

  it("requireAuth accepts the right cookie, rejects wrong/missing", async () => {
    const { a } = app(TOKEN);

    const good = await a.request("/api/ping", {
      headers: headers({ cookie: `webcode_auth=${cookieFor(TOKEN)}` }),
    });
    expect(good.status).toBe(200);

    const missing = await a.request("/api/ping", { headers: headers() });
    expect(missing.status).toBe(401);

    const wrong = await a.request("/api/ping", {
      headers: headers({ cookie: `webcode_auth=${cookieFor(TOKEN2)}` }),
    });
    expect(wrong.status).toBe(401);
  });
});

describe("AuthGate — cookieAuthed (WS upgrade path)", () => {
  it("accepts the token-derived cookie and rejects wrong/missing", () => {
    const gate = new AuthGate({ port: 7770, token: TOKEN });
    expect(gate.cookieAuthed(`webcode_auth=${cookieFor(TOKEN)}`)).toBe(true);
    expect(gate.cookieAuthed(`x=1; webcode_auth=${cookieFor(TOKEN)}; y=2`)).toBe(true);
    expect(gate.cookieAuthed(`webcode_auth=${cookieFor(TOKEN2)}`)).toBe(false);
    expect(gate.cookieAuthed("webcode_auth=garbage")).toBe(false);
    expect(gate.cookieAuthed(undefined)).toBe(false);
    expect(gate.cookieAuthed("")).toBe(false);
  });
});

describe("AuthGate — restart simulation (stateless, token-derived cookie)", () => {
  it("a cookie minted under one daemon is accepted by a SEPARATE daemon with the same token", async () => {
    // daemon #1 mints the cookie via token exchange
    const first = app(TOKEN);
    const minted = await first.a.request("/?token=" + TOKEN, { headers: headers() });
    const setCookie = minted.headers.get("set-cookie") ?? "";
    const value = /webcode_auth=([^;]+)/.exec(setCookie)![1]!;

    // daemon #2 — a fresh process, same token — accepts that cookie (no shared state)
    const second = app(TOKEN);
    const reuse = await second.a.request("/api/ping", {
      headers: headers({ cookie: `webcode_auth=${value}` }),
    });
    expect(reuse.status).toBe(200);
    expect(second.gate.cookieAuthed(`webcode_auth=${value}`)).toBe(true);

    // a daemon with a DIFFERENT token rejects it
    const other = app(TOKEN2);
    const rejected = await other.a.request("/api/ping", {
      headers: headers({ cookie: `webcode_auth=${value}` }),
    });
    expect(rejected.status).toBe(401);
    expect(other.gate.cookieAuthed(`webcode_auth=${value}`)).toBe(false);
  });
});

describe("AuthGate — Host/Origin gates unchanged", () => {
  it("rejects a forbidden Host (DNS rebinding) and a forbidden Origin (CSRF/WS hijack)", async () => {
    const { a } = app(TOKEN);

    const badHost = await a.request("/", { headers: { host: "evil.example", origin: LOCAL.origin } });
    expect(badHost.status).toBe(403);
    expect(await badHost.text()).toBe("forbidden host");

    const badOrigin = await a.request("/", {
      headers: { host: LOCAL.host, origin: "http://evil.example" },
    });
    expect(badOrigin.status).toBe(403);
    expect(await badOrigin.text()).toBe("forbidden origin");

    // loopback host + no Origin (a top-level nav) still passes the gates
    const okHost = new AuthGate({ port: 7770, token: TOKEN });
    expect(okHost.hostAllowed("127.0.0.1:7770")).toBe(true);
    expect(okHost.hostAllowed("localhost:7770")).toBe(true);
    expect(okHost.hostAllowed("evil.example")).toBe(false);
    expect(okHost.originAllowed(undefined)).toBe(true);
    expect(okHost.originAllowed("http://127.0.0.1:7770")).toBe(true);
    expect(okHost.originAllowed("http://evil.example")).toBe(false);
  });
});
