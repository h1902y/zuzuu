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

  it("approve/reject send the module the daemon route requires (else it 400s)", async () => {
    const fetchMock = vi.fn(async () => ok({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    await api.zuzuu.approve("prop-1", "knowledge");
    let [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/zuzuu/staged/prop-1/approve");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init!.body as string)).toEqual({ module: "knowledge" });
    await api.zuzuu.reject("prop-2", "actions", "noisy");
    [url, init] = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    expect(url).toBe("/api/zuzuu/staged/prop-2/reject");
    expect(JSON.parse(init!.body as string)).toEqual({ module: "actions", reason: "noisy" });
  });

  it("held/merge/discard hit the right routes (U6 code gate)", async () => {
    const fetchMock = vi.fn(async () => ok({ held: [] }));
    vi.stubGlobal("fetch", fetchMock);
    await api.zuzuu.held();
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe("/api/zuzuu/held");

    await api.mergeHeld("abc123");
    let [url, init] = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    expect(url).toBe("/api/sessions/held/abc123/merge");
    expect(init?.method).toBe("POST");

    await api.discardHeld("abc123");
    [url, init] = fetchMock.mock.calls[2] as unknown as [string, RequestInit];
    expect(url).toBe("/api/sessions/held/abc123/discard");
    expect(init?.method).toBe("POST");
  });

  it("maps 401 to a clear ApiError", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) }) as Response));
    await expect(api.workspace()).rejects.toMatchObject({ status: 401 } satisfies Partial<ApiError>);
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
