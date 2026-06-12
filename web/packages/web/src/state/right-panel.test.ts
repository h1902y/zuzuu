// The right-panel mode rules, tested through the REAL stores (the subscription
// in right-panel.ts is the wiring under test, not a re-implementation).
// diff:true tabs are used so open() never touches the network in node.
import { beforeEach, describe, expect, it } from "vitest";
import { useEditor, editorTabId } from "./editor";
import { useRightPanel } from "./right-panel";

const open = (path: string) =>
  useEditor.getState().open({ path, name: path.split("/").pop() ?? path, diff: true });
const closeTab = (path: string) => useEditor.getState().close(editorTabId({ path, name: "", diff: true }));

beforeEach(() => {
  useEditor.getState().resetAll();
  useRightPanel.setState({ mode: "faculties", facultyTab: "pulse" });
});

describe("right-panel mode rules", () => {
  it("rests in faculty mode on the pulse tab", () => {
    expect(useRightPanel.getState().mode).toBe("faculties");
    expect(useRightPanel.getState().facultyTab).toBe("pulse");
  });

  it("opening a file forces files mode", () => {
    open("src/a.ts");
    expect(useRightPanel.getState().mode).toBe("files");
  });

  it("‹ faculties switches mode WITHOUT closing editor tabs", () => {
    open("src/a.ts");
    useRightPanel.getState().showFaculties();
    expect(useRightPanel.getState().mode).toBe("faculties");
    expect(useEditor.getState().openFiles).toHaveLength(1);
  });

  it("opening another file from faculty mode flips back to files", () => {
    open("src/a.ts");
    useRightPanel.getState().showFaculties();
    open("src/b.ts");
    expect(useRightPanel.getState().mode).toBe("files");
  });

  it("re-focusing an already-open tab counts as opening (activePath change)", () => {
    open("src/a.ts");
    open("src/b.ts"); // b is now active
    useRightPanel.getState().showFaculties();
    open("src/a.ts"); // same tab set, different active tab
    expect(useRightPanel.getState().mode).toBe("files");
  });

  it("closing a non-last tab stays in files mode", () => {
    open("src/a.ts");
    open("src/b.ts");
    closeTab("src/b.ts");
    expect(useRightPanel.getState().mode).toBe("files");
  });

  it("closing the LAST editor tab forces faculty mode", () => {
    open("src/a.ts");
    closeTab("src/a.ts");
    expect(useRightPanel.getState().mode).toBe("faculties");
  });

  it("the files › chip (showFiles) returns to files mode while tabs exist", () => {
    open("src/a.ts");
    useRightPanel.getState().showFaculties();
    useRightPanel.getState().showFiles();
    expect(useRightPanel.getState().mode).toBe("files");
  });

  it("showFiles is a no-op with zero editor tabs", () => {
    useRightPanel.getState().showFiles();
    expect(useRightPanel.getState().mode).toBe("faculties");
  });

  it("picking a faculty tab pins the tab and faculty mode", () => {
    open("src/a.ts");
    useRightPanel.getState().setFacultyTab("guardrails");
    expect(useRightPanel.getState()).toMatchObject({ mode: "faculties", facultyTab: "guardrails" });
  });

  it("the faculty tab is sticky across a files round-trip", () => {
    useRightPanel.getState().setFacultyTab("knowledge");
    open("src/a.ts");
    closeTab("src/a.ts");
    expect(useRightPanel.getState().facultyTab).toBe("knowledge");
  });
});
