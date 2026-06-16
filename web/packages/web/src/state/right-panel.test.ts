// The center-selection store (WS-C): a module selection with close affordances.
// Editor precedence is NOT this store's job — it's tested in
// center-precedence.test.ts. There is no separate session-detail selection (T4):
// a past session is viewed inside the home surface (the slim picker), not as a
// competing center page — so the only center selection is a module.
import { beforeEach, describe, expect, it } from "vitest";
import { useRightPanel } from "./right-panel";

beforeEach(() => {
  useRightPanel.setState({ selection: null, selectedModule: null, togglingIds: new Set() });
});

describe("center selection store", () => {
  it("rests with no selection (the session home)", () => {
    const s = useRightPanel.getState();
    expect(s.selection).toBeNull();
    expect(s.selectedModule).toBeNull();
  });

  it("openModule selects a module for the center", () => {
    useRightPanel.getState().openModule("guardrails");
    const s = useRightPanel.getState();
    expect(s.selection).toEqual({ kind: "module", key: "guardrails" });
    expect(s.selectedModule).toBe("guardrails");
  });

  it("there is no session-detail navigation (T4 guard)", () => {
    const s = useRightPanel.getState() as unknown as Record<string, unknown>;
    // a past session is viewed in the home surface (the picker), never opened
    // as a separate center detail page.
    expect(s["openSession"]).toBeUndefined();
    expect(s["closeSession"]).toBeUndefined();
    expect(s["selectedSession"]).toBeUndefined();
  });

  it("opening another module replaces the selection", () => {
    useRightPanel.getState().openModule("knowledge");
    useRightPanel.getState().openModule("memory");
    expect(useRightPanel.getState().selection).toEqual({ kind: "module", key: "memory" });
  });

  it("closeModule clears the selection → home", () => {
    useRightPanel.getState().openModule("actions");
    useRightPanel.getState().closeModule();
    expect(useRightPanel.getState().selection).toBeNull();
    expect(useRightPanel.getState().selectedModule).toBeNull();
  });

  it("closeCenter clears whatever is selected", () => {
    useRightPanel.getState().openModule("knowledge");
    useRightPanel.getState().closeCenter();
    expect(useRightPanel.getState().selection).toBeNull();
  });
});

describe("togglingIds in-flight guard (F3)", () => {
  it("begin/end add and remove an id; isToggling reflects membership", () => {
    const s = useRightPanel.getState();
    expect(s.isToggling("guardrails")).toBe(false);

    s.beginToggle("guardrails");
    expect(useRightPanel.getState().isToggling("guardrails")).toBe(true);
    expect(useRightPanel.getState().togglingIds.has("guardrails")).toBe(true);

    s.endToggle("guardrails");
    expect(useRightPanel.getState().isToggling("guardrails")).toBe(false);
  });

  it("tracks ids independently", () => {
    const s = useRightPanel.getState();
    s.beginToggle("a");
    s.beginToggle("b");
    expect(useRightPanel.getState().togglingIds.size).toBe(2);
    s.endToggle("a");
    expect(useRightPanel.getState().isToggling("a")).toBe(false);
    expect(useRightPanel.getState().isToggling("b")).toBe(true);
  });

  it("begin is idempotent and end on an absent id is a no-op", () => {
    const s = useRightPanel.getState();
    s.beginToggle("x");
    s.beginToggle("x");
    expect(useRightPanel.getState().togglingIds.size).toBe(1);
    s.endToggle("missing");
    expect(useRightPanel.getState().togglingIds.size).toBe(1);
  });
});
