// §H.3.4 — the table's row selection store: one scope active at a time, keyed by
// full addr so the unified Everything table's cross-module selection is coherent.
import { describe, it, expect, beforeEach } from "vitest";
import { useTableSelection, selectionFor } from "../../src/client/state/table-selection.js";
import type { ModuleItem } from "#shared/index.js";

const item = (id: string): ModuleItem => ({ id, module: "crm", kind: "account", title: id, status: "active", body: "" } as ModuleItem);

describe("table-selection store", () => {
  beforeEach(() => useTableSelection.getState().clear());

  it("toggle adds/removes an addr and keeps its row for later reads", () => {
    useTableSelection.getState().toggle("crm", "crm:acme", item("acme"));
    let s = useTableSelection.getState();
    expect([...s.ids]).toEqual(["crm:acme"]);
    expect(s.items.get("crm:acme")?.id).toBe("acme");

    useTableSelection.getState().toggle("crm", "crm:acme");
    s = useTableSelection.getState();
    expect(s.ids.size).toBe(0);
    expect(s.items.size).toBe(0);
  });

  it("switching scopes drops the previous scope's selection (no cross-table footgun)", () => {
    useTableSelection.getState().toggle("crm", "crm:acme", item("acme"));
    useTableSelection.getState().toggle("knowledge", "knowledge:brahman", item("brahman"));
    const s = useTableSelection.getState();
    expect(s.scope).toBe("knowledge");
    expect([...s.ids]).toEqual(["knowledge:brahman"]);
  });

  it("selectionFor reads empty for a scope that doesn't own the live selection", () => {
    useTableSelection.getState().toggle("crm", "crm:acme", item("acme"));
    const s = useTableSelection.getState();
    expect(selectionFor(s, "crm").has("crm:acme")).toBe(true);
    expect(selectionFor(s, "knowledge").size).toBe(0);
  });

  it("clear empties both ids and items", () => {
    useTableSelection.getState().toggle("crm", "crm:acme", item("acme"));
    useTableSelection.getState().clear();
    const s = useTableSelection.getState();
    expect(s.scope).toBe("");
    expect(s.ids.size).toBe(0);
    expect(s.items.size).toBe(0);
  });

  // S2 — stale-selection regression: a selection made in ONE scope must never be
  // clearable (or, read as live) by a DIFFERENT scope. clearIfScope is the
  // guarded primitive useClearSelectionOnQueryChange calls on every filter/page/
  // sort change AND on unmount (a scope departure) — this pins the guard itself,
  // independent of any React timing.
  it("clearIfScope is a no-op for a scope that doesn't own the live selection (never a cross-scope footgun)", () => {
    useTableSelection.getState().toggle("crm", "crm:acme", item("acme"));
    useTableSelection.getState().clearIfScope("knowledge"); // a DIFFERENT scope — must not touch crm's selection
    let s = useTableSelection.getState();
    expect(s.scope).toBe("crm");
    expect([...s.ids]).toEqual(["crm:acme"]);
    expect(selectionFor(s, "crm").has("crm:acme")).toBe(true);

    useTableSelection.getState().clearIfScope("crm"); // the OWNING scope — clears
    s = useTableSelection.getState();
    expect(s.scope).toBe("");
    expect(s.ids.size).toBe(0);
    expect(s.items.size).toBe(0);
  });

  it("a stale selection surviving a filter/page change (no toggle in between) still reads as empty for the CURRENT scope via selectionFor — the omnibar's count can never target rows that fell out of view", () => {
    // simulates what used to leak: two rows selected, then the table's filter/page
    // changes (e.g. a new `where` clause narrows the rows) WITHOUT clearIfScope
    // having run yet (a mid-flight render). selectionFor is still scope-correct on
    // its own, but the regression this pins is clearIfScope actually zeroing the
    // store once it fires — not just selectionFor's read-side guard.
    useTableSelection.getState().toggle("crm", "crm:acme", item("acme"));
    useTableSelection.getState().toggle("crm", "crm:beta", item("beta"));
    expect(useTableSelection.getState().ids.size).toBe(2);
    // the query-change effect fires (S2): the SAME scope's filter/page moved on
    useTableSelection.getState().clearIfScope("crm");
    const s = useTableSelection.getState();
    expect(selectionFor(s, "crm").size).toBe(0);
    expect(s.items.size).toBe(0); // items are pruned too — no dangling row refs
  });
});
