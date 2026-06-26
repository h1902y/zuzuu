// P2.5 — the grouped command-palette model.
import { describe, it, expect } from "vitest";
import { buildPaletteGroups } from "../../src/client/palette/palette-commands.js";

const base = {
  sessions: [{ id: "s1", title: "build" }],
  modules: [{ id: "knowledge", title: "Knowledge" }],
  recents: [
    { path: "/a/zuzuu", name: "zuzuu", current: true },
    { path: "/a/cards", name: "cards", current: false },
  ],
  hosts: [{ id: "claude", label: "Claude" }],
};

describe("buildPaletteGroups", () => {
  it("orders the groups Navigate · Actions · Switch project · Sessions · Tables", () => {
    expect(buildPaletteGroups(base).map((g) => g.heading)).toEqual([
      "Navigate", "Actions", "Switch project", "Sessions", "Tables",
    ]);
  });
  it("Navigate carries Overview + All projects", () => {
    const nav = buildPaletteGroups(base)[0]!;
    expect(nav.commands.map((c) => c.action.kind)).toEqual(["overview", "projects-home"]);
  });
  it("Actions includes one New-agent per host", () => {
    const actions = buildPaletteGroups(base).find((g) => g.heading === "Actions")!;
    expect(actions.commands.map((c) => c.label)).toEqual(["Review proposals", "New shell", "New Claude"]);
  });
  it("Switch project lists only NON-current recents", () => {
    const grp = buildPaletteGroups(base).find((g) => g.heading === "Switch project")!;
    expect(grp.commands.map((c) => c.label)).toEqual(["cards"]);
    expect(grp.commands[0]!.action).toEqual({ kind: "switch-project", path: "/a/cards" });
  });
  it("drops empty groups (no sessions / modules / switchable recents)", () => {
    const headings = buildPaletteGroups({ sessions: [], modules: [], recents: [{ path: "/x", name: "x", current: true }], hosts: [] }).map((g) => g.heading);
    expect(headings).toEqual(["Navigate", "Actions"]);
  });
});
