// tests/client/api — the REST client's request wrapper (fetch mocked).

import { describe, it, expect, vi, afterEach } from "vitest";
import { api, ApiError, wsUrl } from "../../src/client/lib/api.js";

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;

afterEach(() => vi.unstubAllGlobals());

describe("api client", () => {
  it("GETs and parses JSON", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ok([{ id: "a", title: "shell" }])));
    const sessions = await api.listSessions();
    expect(sessions).toEqual([{ id: "a", title: "shell" }]);
  });

  it("POSTs a create with a JSON body", async () => {
    const fetchMock = vi.fn(async () => ok({ id: "x" }));
    vi.stubGlobal("fetch", fetchMock);
    await api.createSession({ type: "shell" });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init!.body as string)).toEqual({ type: "shell" });
  });

  it("maps 401 to a clear ApiError", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) }) as Response));
    await expect(api.health()).rejects.toMatchObject({ status: 401 } satisfies Partial<ApiError>);
  });

  it("encodes path query params", async () => {
    const fetchMock = vi.fn(async () => ok({ path: "a b", entries: [] }));
    vi.stubGlobal("fetch", fetchMock);
    await api.listDir("a b/c");
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe("/api/fs/list?path=a%20b%2Fc");
  });
});

describe("wsUrl", () => {
  it("derives ws/wss from the page origin", () => {
    vi.stubGlobal("location", { protocol: "http:", host: "localhost:7770" });
    expect(wsUrl("/ws/term/abc")).toBe("ws://localhost:7770/ws/term/abc");
    vi.stubGlobal("location", { protocol: "https:", host: "app.example" });
    expect(wsUrl("/ws/fs")).toBe("wss://app.example/ws/fs");
  });
});
