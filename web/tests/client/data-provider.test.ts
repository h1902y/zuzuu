// U9 — the DataProvider over the zuzuu api. The crux: create/update resolve to a
// PENDING StagedChange (the review gate as data-provider semantics), not a landed row.
import { describe, it, expect, vi } from "vitest";
import { makeDataProvider } from "../../src/client/data/provider.js";
import type { ModuleItem, ModuleDetail, StagedChange } from "#shared/index.js";

const item = (id: string, over: Partial<ModuleItem> = {}): ModuleItem =>
  ({ id, module: "knowledge", kind: "knowledge", title: id.toUpperCase(), status: "active", body: "", ...over });

function mockZuzuu(detail: Partial<ModuleDetail> = {}) {
  const stage = vi.fn(async (key: string, body: { op: string; target: string }) =>
    ({ id: "stg-x", op: body.op, module: key, target: body.target, status: "pending", score: 0 } as StagedChange));
  const calls: unknown[] = [];
  const zuzuu = {
    module: vi.fn(async (key: string, query?: unknown) => { calls.push(query); return { key, items: [], staged: [], ...detail } as ModuleDetail; }),
    item: vi.fn(async (_key: string, id: string) => item(id)),
    stage,
    approve: vi.fn(async () => ({ ok: true })),
    reject: vi.fn(async () => ({ ok: true })),
  };
  // the provider only touches the subset above; cast to the full api surface
  return { zuzuu: zuzuu as unknown as Parameters<typeof makeDataProvider>[0], stage, calls };
}

const ALL: import("../../src/client/data/list-state.js").ListQuery = { text: "", kind: "", sort: null, page: 0, pageSize: 50 };

describe("DataProvider — server-side list + writes as pending proposals", () => {
  it("getList pushes filter·sort·page to the SERVER (the index SELECT) and paginates off total", async () => {
    const page = [item("a"), item("b")]; // the server already filtered·sorted·sliced
    const { zuzuu, calls } = mockZuzuu({ items: page, total: 7, staged: [{ id: "p1", module: "knowledge", title: "P1" }] });
    const dp = makeDataProvider(zuzuu);

    const res = await dp.getList("knowledge", { text: "blue", kind: "fact", sort: { key: "title", dir: "desc" }, page: 2, pageSize: 25 });
    // the items ARE the server page — no client-side matches() over a limit:10000 fetch
    expect(res.items.map((i) => i.id)).toEqual(["a", "b"]);
    expect(res.total).toBe(7);          // the pre-paginate total the grid paginates off
    expect(res.staged.length).toBe(1);
    // the control state reached the daemon as index query params: kind → type,
    // sort → `col:desc`, the page window → limit/offset
    expect(calls[0]).toEqual({ text: "blue", type: "fact", sort: "title:desc", limit: 25, offset: 50 });

    // an empty filter sends only the page window (no stray filter axes)
    await dp.getList("knowledge", ALL);
    expect(calls[1]).toEqual({ limit: 50, offset: 0 });
  });

  it("create/update resolve to a PENDING StagedChange (never a landed row)", async () => {
    const { zuzuu, stage } = mockZuzuu();
    const dp = makeDataProvider(zuzuu);
    const c = await dp.create("knowledge", "demo", { type: "knowledge", title: "Demo" });
    expect(c.status).toBe("pending");
    expect(c.op).toBe("create");
    expect(stage).toHaveBeenCalledWith("knowledge", { op: "create", target: "demo", change: { type: "knowledge", title: "Demo" } });
    expect((await dp.update("knowledge", "demo", { title: "New" })).op).toBe("update");
  });

  it("getOne reads a record; getMany filters by ids (no N+1)", async () => {
    const items = [item("a"), item("b"), item("c")];
    const { zuzuu } = mockZuzuu({ items });
    const dp = makeDataProvider(zuzuu);
    expect((await dp.getOne("knowledge", "a")).id).toBe("a");
    expect((await dp.getMany("knowledge", ["a", "c"])).map((i) => i.id)).toEqual(["a", "c"]);
  });
});
