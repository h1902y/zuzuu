// state/module-view — the per-module Table⇄Map projection store.
import { describe, expect, it, beforeEach } from "vitest";
import { useModuleView, viewOf } from "../../src/client/state/module-view.js";

describe("module-view", () => {
  beforeEach(() => useModuleView.setState({ byModule: {} }));

  it("defaults every module to the table projection", () => {
    expect(viewOf(useModuleView.getState().byModule, "crm")).toBe("table");
  });

  it("set + toggle flip one module's projection", () => {
    useModuleView.getState().set("crm", "graph");
    expect(viewOf(useModuleView.getState().byModule, "crm")).toBe("graph");
    expect(useModuleView.getState().toggle("crm")).toBe("table");
    expect(useModuleView.getState().toggle("crm")).toBe("graph");
  });

  it("a choice never leaks to the NEXT module (the C1 rule, per-module)", () => {
    useModuleView.getState().set("crm", "graph");
    expect(viewOf(useModuleView.getState().byModule, "knowledge")).toBe("table");
  });
});
