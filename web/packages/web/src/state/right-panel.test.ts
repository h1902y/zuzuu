// The right-panel mode + drill-in rules, tested through the REAL stores (the
// subscription in right-panel.ts is the wiring under test, not a
// re-implementation). diff:true tabs are used so open() never touches the
// network in node.
import { beforeEach, describe, expect, it } from "vitest";
import { useEditor, editorTabId } from "./editor";
import { useRightPanel } from "./right-panel";

const open = (path: string) =>
  useEditor.getState().open({ path, name: path.split("/").pop() ?? path, diff: true });
const closeTab = (path: string) => useEditor.getState().close(editorTabId({ path, name: "", diff: true }));

beforeEach(() => {
  useEditor.getState().resetAll();
  useRightPanel.setState({ mode: "modules", drill: null });
});

describe("right-panel mode rules", () => {
  it("rests in module mode on the dashboard root", () => {
    expect(useRightPanel.getState().mode).toBe("modules");
    expect(useRightPanel.getState().drill).toBeNull();
  });

  it("opening a file forces files mode", () => {
    open("src/a.ts");
    expect(useRightPanel.getState().mode).toBe("files");
  });

  it("‹ modules switches mode WITHOUT closing editor tabs", () => {
    open("src/a.ts");
    useRightPanel.getState().showModules();
    expect(useRightPanel.getState().mode).toBe("modules");
    expect(useEditor.getState().openFiles).toHaveLength(1);
  });

  it("opening another file from module mode flips back to files", () => {
    open("src/a.ts");
    useRightPanel.getState().showModules();
    open("src/b.ts");
    expect(useRightPanel.getState().mode).toBe("files");
  });

  it("re-focusing an already-open tab counts as opening (activePath change)", () => {
    open("src/a.ts");
    open("src/b.ts"); // b is now active
    useRightPanel.getState().showModules();
    open("src/a.ts"); // same tab set, different active tab
    expect(useRightPanel.getState().mode).toBe("files");
  });

  it("closing a non-last tab stays in files mode", () => {
    open("src/a.ts");
    open("src/b.ts");
    closeTab("src/b.ts");
    expect(useRightPanel.getState().mode).toBe("files");
  });

  it("closing the LAST editor tab forces module mode", () => {
    open("src/a.ts");
    closeTab("src/a.ts");
    expect(useRightPanel.getState().mode).toBe("modules");
  });

  it("the files › chip (showFiles) returns to files mode while tabs exist", () => {
    open("src/a.ts");
    useRightPanel.getState().showModules();
    useRightPanel.getState().showFiles();
    expect(useRightPanel.getState().mode).toBe("files");
  });

  it("showFiles is a no-op with zero editor tabs", () => {
    useRightPanel.getState().showFiles();
    expect(useRightPanel.getState().mode).toBe("modules");
  });
});

describe("module drill-in rules", () => {
  it("a card click opens the drill-in (and pins module mode)", () => {
    open("src/a.ts"); // files mode
    useRightPanel.getState().openModule("guardrails");
    expect(useRightPanel.getState()).toMatchObject({ mode: "modules", drill: { kind: "module", key: "guardrails" } });
  });

  it("‹ All modules returns to the dashboard root", () => {
    useRightPanel.getState().openModule("knowledge");
    useRightPanel.getState().closeDrill();
    expect(useRightPanel.getState()).toMatchObject({ mode: "modules", drill: null });
  });

  it("‹ modules from files mode lands on the dashboard ROOT (drill-in cleared)", () => {
    useRightPanel.getState().openModule("knowledge");
    open("src/a.ts"); // e.g. clicked an item file
    useRightPanel.getState().showModules();
    expect(useRightPanel.getState()).toMatchObject({ mode: "modules", drill: null });
  });

  it("closing the LAST editor tab also lands on the dashboard root", () => {
    useRightPanel.getState().openModule("memory");
    open("src/a.ts");
    closeTab("src/a.ts");
    expect(useRightPanel.getState()).toMatchObject({ mode: "modules", drill: null });
  });

  it("opening an item file from a drill-in flips to files mode", () => {
    useRightPanel.getState().openModule("actions");
    open(".zuzuu/actions/run-tests/ACTION.md");
    expect(useRightPanel.getState().mode).toBe("files");
  });
});

describe("session drill-in rules", () => {
  it("a session row click opens the session detail (and pins module mode)", () => {
    open("src/a.ts"); // files mode
    useRightPanel.getState().openSession("ses_abc123");
    expect(useRightPanel.getState()).toMatchObject({
      mode: "modules",
      drill: { kind: "session", id: "ses_abc123" },
    });
  });

  it("the back chevron returns to the panel root", () => {
    useRightPanel.getState().openSession("ses_abc123");
    useRightPanel.getState().closeDrill();
    expect(useRightPanel.getState()).toMatchObject({ mode: "modules", drill: null });
  });

  it("closing the LAST editor tab clears a session drill-in too", () => {
    useRightPanel.getState().openSession("ses_abc123");
    open("src/a.ts");
    closeTab("src/a.ts");
    expect(useRightPanel.getState()).toMatchObject({ mode: "modules", drill: null });
  });

  it("drill-ins replace each other (module → session → module)", () => {
    useRightPanel.getState().openModule("knowledge");
    useRightPanel.getState().openSession("s1");
    expect(useRightPanel.getState().drill).toEqual({ kind: "session", id: "s1" });
    useRightPanel.getState().openModule("memory");
    expect(useRightPanel.getState().drill).toEqual({ kind: "module", key: "memory" });
  });
});
