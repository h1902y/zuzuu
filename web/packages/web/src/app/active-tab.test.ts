// U2: resolving the active tab id (PTY id OR trace id) to a row + pty tab.
import { describe, expect, it } from "vitest";
import { openTabItems, resolveActiveTab, type ResolveTab } from "./active-tab";
import type { PickerRow } from "./session-picker";

const row = (id: string, opts: Partial<PickerRow["session"]> & { live?: boolean } = {}): PickerRow => ({
  session: { id, host: "claude", state: "completed", ...opts },
  live: opts.live ?? false,
  band: "recent",
});

describe("resolveActiveTab", () => {
  it("null activeId → nothing viewed", () => {
    expect(resolveActiveTab(null, [], [])).toEqual({ row: null, ptyTabId: null });
  });

  it("matches a trace row by session id", () => {
    const r = row("s1");
    const out = resolveActiveTab("s1", [r], []);
    expect(out.row).toBe(r);
    expect(out.ptyTabId).toBeNull(); // view-only (not live)
  });

  it("matches a live trace row by ptyId and returns its pty tab id", () => {
    const r = row("trace-1", { ptyId: "pty-1", state: "active", live: true });
    const out = resolveActiveTab("pty-1", [r], [{ id: "pty-1", alive: true }]);
    expect(out.row).toBe(r);
    expect(out.ptyTabId).toBe("pty-1");
  });

  it("synthesizes a live 'opening' row for a just-started tab with no trace row yet", () => {
    const tabs: ResolveTab[] = [{ id: "pty-9", host: "claude", alive: true }];
    const out = resolveActiveTab("pty-9", [], tabs);
    expect(out.row).not.toBeNull();
    expect(out.row?.live).toBe(true);
    expect(out.row?.band).toBe("now");
    expect(out.row?.session.id).toBe("pty-9");
    expect(out.row?.session.state).toBe("opening");
    expect(out.row?.session.ptyId).toBe("pty-9");
    expect(out.ptyTabId).toBe("pty-9");
  });

  it("a dead pty with no trace row → nothing (no synthetic row)", () => {
    const out = resolveActiveTab("pty-x", [], [{ id: "pty-x", alive: false }]);
    expect(out).toEqual({ row: null, ptyTabId: null });
  });

  it("a trace row wins over the synthetic fallback once it appears", () => {
    const r = row("trace-2", { ptyId: "pty-2", state: "active", live: true });
    const out = resolveActiveTab("pty-2", [r], [{ id: "pty-2", alive: true }]);
    expect(out.row).toBe(r); // the real row, not a synthesized one
    expect(out.row?.session.state).toBe("active");
  });
});

describe("openTabItems — strip descriptors", () => {
  it("builds a live item with a friendly host label", () => {
    const r = row("trace-1", { host: "claude", ptyId: "pty-1", state: "active", live: true });
    const [item] = openTabItems(["pty-1"], [r], [{ id: "pty-1", alive: true }]);
    expect(item).toEqual({ id: "pty-1", label: "Claude Code", live: true, outside: false });
  });

  it("marks an external-live session as outside (not live here)", () => {
    const r = row("trace-2", { host: "claude", state: "active", live: false });
    const [item] = openTabItems(["trace-2"], [r], []);
    expect(item?.live).toBe(false);
    expect(item?.outside).toBe(true);
  });

  it("a past session is neither live nor outside", () => {
    const r = row("trace-3", { host: "gemini", state: "completed", live: false });
    const [item] = openTabItems(["trace-3"], [r], []);
    expect(item).toEqual({ id: "trace-3", label: "Gemini CLI", live: false, outside: false });
  });

  it("an unresolved id degrades to a plain label", () => {
    const [item] = openTabItems(["ghost"], [], []);
    expect(item).toEqual({ id: "ghost", label: "agent", live: false, outside: false });
  });
});
