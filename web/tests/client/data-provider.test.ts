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
  const zuzuu = {
    module: vi.fn(async (key: string) => ({ key, items: [], staged: [], ...detail } as ModuleDetail)),
    item: vi.fn(async (_key: string, id: string) => item(id)),
    stage,
    approve: vi.fn(async () => ({ ok: true })),
    reject: vi.fn(async () => ({ ok: true })),
  };
  // the provider only touches the subset above; cast to the full api surface
  return { zuzuu: zuzuu as unknown as Parameters<typeof makeDataProvider>[0], stage };
}

describe("DataProvider — list/filter + writes as pending proposals", () => {
  it("getList returns items + staged + total, and applies text/kind filters", async () => {
    const items = [item("a", { title: "Alpha", kind: "knowledge" }), item("b", { title: "Beta", body: "alpha in body", kind: "fact" })];
    const { zuzuu } = mockZuzuu({ items, staged: [{ id: "p1", module: "knowledge", title: "P1" }] });
    const dp = makeDataProvider(zuzuu);
    const all = await dp.getList("knowledge");
    expect(all.total).toBe(2);
    expect(all.staged.length).toBe(1);
    expect((await dp.getList("knowledge", { text: "alpha" })).items.map((i) => i.id)).toEqual(["a", "b"]); // title or body
    expect((await dp.getList("knowledge", { text: "beta" })).items.map((i) => i.id)).toEqual(["b"]);
    expect((await dp.getList("knowledge", { kind: "fact" })).items.map((i) => i.id)).toEqual(["b"]);
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
