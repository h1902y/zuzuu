// tests/client/panel — the right-panel/palette state machine.

import { describe, it, expect, beforeEach } from "vitest";
import { usePanel } from "../../src/client/state/panel.js";

beforeEach(() => usePanel.setState({ mode: "modules", openPath: null, module: null, paletteOpen: false }));

describe("usePanel", () => {
  it("opening a file switches to files mode", () => {
    usePanel.getState().openFile("src/a.ts");
    expect(usePanel.getState()).toMatchObject({ mode: "files", openPath: "src/a.ts" });
  });
  it("closing the file returns to the modules dashboard", () => {
    usePanel.getState().openFile("src/a.ts");
    usePanel.getState().closeFile();
    expect(usePanel.getState()).toMatchObject({ mode: "modules", openPath: null });
  });
  it("drilling into a module sets modules mode + the key", () => {
    usePanel.getState().openModule("knowledge");
    expect(usePanel.getState()).toMatchObject({ mode: "modules", module: "knowledge" });
    usePanel.getState().openModule(null);
    expect(usePanel.getState().module).toBeNull();
  });
  it("toggles the palette flag", () => {
    usePanel.getState().setPalette(true);
    expect(usePanel.getState().paletteOpen).toBe(true);
  });
});
