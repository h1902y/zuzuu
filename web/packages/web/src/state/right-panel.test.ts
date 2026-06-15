// The center-selection store (WS-C): a module OR a session selection (they
// replace each other), with close affordances. Editor precedence is NOT this
// store's job — it's tested in center-precedence.test.ts.
import { beforeEach, describe, expect, it } from "vitest";
import { useRightPanel } from "./right-panel";

beforeEach(() => {
  useRightPanel.setState({ selection: null, selectedModule: null, selectedSession: null });
});

describe("center selection store", () => {
  it("rests with no selection (the sessions home)", () => {
    const s = useRightPanel.getState();
    expect(s.selection).toBeNull();
    expect(s.selectedModule).toBeNull();
    expect(s.selectedSession).toBeNull();
  });

  it("openModule selects a module for the center", () => {
    useRightPanel.getState().openModule("guardrails");
    const s = useRightPanel.getState();
    expect(s.selection).toEqual({ kind: "module", key: "guardrails" });
    expect(s.selectedModule).toBe("guardrails");
    expect(s.selectedSession).toBeNull();
  });

  it("openSession selects a session for the center", () => {
    useRightPanel.getState().openSession("ses_abc123");
    const s = useRightPanel.getState();
    expect(s.selection).toEqual({ kind: "session", id: "ses_abc123" });
    expect(s.selectedSession).toBe("ses_abc123");
    expect(s.selectedModule).toBeNull();
  });

  it("a module and a session selection replace each other", () => {
    useRightPanel.getState().openModule("knowledge");
    useRightPanel.getState().openSession("s1");
    expect(useRightPanel.getState().selection).toEqual({ kind: "session", id: "s1" });
    expect(useRightPanel.getState().selectedModule).toBeNull();

    useRightPanel.getState().openModule("memory");
    expect(useRightPanel.getState().selection).toEqual({ kind: "module", key: "memory" });
    expect(useRightPanel.getState().selectedSession).toBeNull();
  });

  it("closeModule clears the selection → home", () => {
    useRightPanel.getState().openModule("actions");
    useRightPanel.getState().closeModule();
    expect(useRightPanel.getState().selection).toBeNull();
    expect(useRightPanel.getState().selectedModule).toBeNull();
  });

  it("closeSession clears the selection → home", () => {
    useRightPanel.getState().openSession("s1");
    useRightPanel.getState().closeSession();
    expect(useRightPanel.getState().selection).toBeNull();
    expect(useRightPanel.getState().selectedSession).toBeNull();
  });

  it("closeCenter clears whatever is selected", () => {
    useRightPanel.getState().openModule("knowledge");
    useRightPanel.getState().closeCenter();
    expect(useRightPanel.getState().selection).toBeNull();
  });
});
