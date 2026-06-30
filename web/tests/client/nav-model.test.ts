// U1 — the unified NavTree row model. Proves one row shape produces every group
// (top · sessions · tables · project), the active row tracks the selection, session
// liveness resolves owner/live/idle, table badges appear only when pending > 0, and the
// project group honors the Graph/Search presence flags (Graph leaves in U2, Search in U4).
import { describe, it, expect } from "vitest";
import { navModel, type NavInput } from "../../src/client/shell/nav-model.js";

const base: NavInput = {
  selected: null,
  sessions: [],
  modules: [],
  owner: null,
  showSetup: false,
};

describe("navModel — the unified sidebar rows", () => {
  it("top: Overview is the home row, active on null or overview selection", () => {
    expect(navModel(base).top[0]).toMatchObject({ key: "overview", glyph: "overview", active: true });
    expect(navModel({ ...base, selected: { kind: "overview" } }).top[0]!.active).toBe(true);
    expect(navModel({ ...base, selected: { kind: "settings" } }).top[0]!.active).toBe(false);
  });

  it("top: the Setup row appears only when showSetup, and jumps to home (node null)", () => {
    expect(navModel(base).top.find((r) => r.key === "setup")).toBeUndefined();
    const setup = navModel({ ...base, showSetup: true }).top.find((r) => r.key === "setup");
    expect(setup).toMatchObject({ glyph: "setup", node: null, active: false });
  });

  it("sessions: liveness resolves owner > live > idle, and active tracks the selection", () => {
    const sessions = [
      { id: "a", title: "Agent A", alive: true },
      { id: "b", title: "Agent B", alive: true },
      { id: "c", alive: false },
    ];
    const rows = navModel({ ...base, sessions, owner: "a", selected: { kind: "session", id: "b" } }).sessions;
    expect(rows.map((r) => r.liveness)).toEqual(["owner", "live", "idle"]);
    expect(rows.find((r) => r.key === "session:b")!.active).toBe(true);
    expect(rows.find((r) => r.key === "session:a")!.active).toBe(false);
    expect(rows.find((r) => r.key === "session:c")!.label).toBe("c"); // falls back to id
    expect(rows[0]!.node).toEqual({ kind: "session", id: "a" });
  });

  it("tables: badge present only when pending > 0; active tracks the module selection", () => {
    const modules = [
      { id: "knowledge", title: "Knowledge", counts: { pending: 3 } },
      { id: "memory", title: "Memory", counts: { pending: 0 } },
      { id: "actions", title: "Actions" },
    ];
    const rows = navModel({ ...base, modules, selected: { kind: "module", id: "memory" } }).tables;
    expect(rows.find((r) => r.key === "module:knowledge")!.badge).toBe(3);
    expect(rows.find((r) => r.key === "module:memory")!.badge).toBeUndefined();
    expect(rows.find((r) => r.key === "module:actions")!.badge).toBeUndefined();
    expect(rows.find((r) => r.key === "module:memory")!.active).toBe(true);
  });

  it("project: Graph/Search honor the presence flags; Settings is always present", () => {
    const all = navModel(base).project.map((r) => r.key);
    expect(all).toEqual(["graph", "search", "settings"]);
    const trimmed = navModel({ ...base, showGraph: false, showSearch: false }).project.map((r) => r.key);
    expect(trimmed).toEqual(["settings"]); // post-U2/U4: PROJECT collapses to Settings only
    expect(navModel({ ...base, selected: { kind: "graph" } }).project.find((r) => r.key === "graph")!.active).toBe(true);
  });
});
