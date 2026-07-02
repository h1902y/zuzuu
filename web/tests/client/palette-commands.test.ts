// P2.5 — the grouped command-palette model.
import { describe, it, expect } from "vitest";
import { buildPaletteGroups, omniGroup } from "../../src/client/palette/palette-commands.js";

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
  it("Navigate carries Everything + All projects + Settings (Overview retired — §D)", () => {
    const nav = buildPaletteGroups(base)[0]!;
    expect(nav.commands.map((c) => c.action.kind)).toEqual(["open-everything", "projects-home", "settings-dialog"]);
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
  it("carries synonyms in the fuzzy haystack (U3): review≈merge/approve, table≈module", () => {
    const groups = buildPaletteGroups(base);
    const review = groups.find((g) => g.heading === "Actions")!.commands.find((c) => c.action.kind === "review")!;
    expect(review.value).toMatch(/merge/);
    expect(review.value).toMatch(/approve/);
    const table = groups.find((g) => g.heading === "Tables")!.commands[0]!;
    expect(table.value).toMatch(/module/);
  });
});

describe("omniGroup — the omnibar's prefix modes (C3)", () => {
  const modules = [{ id: "knowledge", title: "Knowledge" }, { id: "social", title: "Social" }];
  it("null outside the prefix modes", () => {
    expect(omniGroup("", modules)).toBeNull();
    expect(omniGroup("plain search", modules)).toBeNull();
  });
  it("/prompt → one converse command carrying the prompt", () => {
    const g = omniGroup("/summarize my week", modules)!;
    expect(g.heading).toBe("Converse");
    expect(g.commands[0]!.action).toEqual({ kind: "converse", prompt: "summarize my week" });
  });
  it("/ alone → a non-selecting placeholder", () => {
    expect(omniGroup("/", modules)!.commands[0]!.action).toEqual({ kind: "noop" });
  });
  it("> alone lists everything; >fi filters to fit; module names focus islands", () => {
    const all = omniGroup(">", modules)!;
    expect(all.commands.map((c) => c.action.kind)).toEqual(["world-fit", "module-view", "module-view", "review", "open-everything", "open-flow", "world-module", "world-module"]);
    const fit = omniGroup(">fi", modules)!;
    expect(fit.commands.some((c) => c.action.kind === "world-fit")).toBe(true);
    const mod = omniGroup(">module social", modules)!;
    expect(mod.commands.some((c) => c.action.kind === "world-module" && (c.action as { id: string }).id === "social")).toBe(true);
  });
  it(">table / >map flip the module projection (the Table⇄Map toggle)", () => {
    const table = omniGroup(">table", modules)!;
    expect(table.commands.some((c) => c.action.kind === "module-view" && (c.action as { view: string }).view === "table")).toBe(true);
    const map = omniGroup(">map", modules)!;
    expect(map.commands.some((c) => c.action.kind === "module-view" && (c.action as { view: string }).view === "graph")).toBe(true);
  });
  it(">flow (§I rung 5) — no workflow in context opens Flow home", () => {
    const g = omniGroup(">flow", modules)!;
    expect(g.commands[0]!.action).toEqual({ kind: "open-flow", module: undefined, id: undefined });
    expect(g.commands[0]!.label).toMatch(/pick a workflow/);
  });
  it(">flow — a workflow in context carries it as the target", () => {
    const g = omniGroup(">flow", modules, { target: { module: "actions", id: "onboard-lead" } })!;
    expect(g.commands[0]!.action).toEqual({ kind: "open-flow", module: "actions", id: "onboard-lead" });
    expect(g.commands[0]!.label).toContain("actions:onboard-lead");
  });
});
