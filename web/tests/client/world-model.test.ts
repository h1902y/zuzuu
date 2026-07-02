// client/world/model.ts — the world's pure model (palette · affinity · ghosts · radius).
import { describe, expect, it } from "vitest";
import { cardPicks, deriveAffinity, moduleHue, modulePalette, nodeRadius, reconcileGhosts } from "../../src/client/world/model.js";
import type { WorldGraphLink } from "../../src/shared/zuzuu.js";

describe("modulePalette", () => {
  it("is stable and data-derived (no hardcoded module names)", () => {
    const a = modulePalette(["knowledge", "journal"]);
    const b = modulePalette(["journal", "knowledge", "knowledge"]);
    expect(a.knowledge).toBe(b.knowledge);
    expect(a.journal).toBe(b.journal);
    expect(a.knowledge).toMatch(/^hsl\(\d+ 58% 60%\)$/);
    expect(a.knowledge).not.toBe(a.journal);
  });
  it("hue is deterministic", () => {
    expect(moduleHue("social")).toBe(moduleHue("social"));
    expect(moduleHue("social")).toBeGreaterThanOrEqual(0);
    expect(moduleHue("social")).toBeLessThan(360);
  });
});

describe("deriveAffinity", () => {
  const moduleOf = new Map([
    ["k:a", "k"], ["k:b", "k"], ["j:x", "j"], ["s:p", "s"],
  ]);
  const link = (source: string, target: string): WorldGraphLink => ({ source, target, type: "informs" });

  it("counts cross-module pairs; intra-module edges don't count", () => {
    const out = deriveAffinity([link("k:a", "k:b"), link("j:x", "k:a"), link("j:x", "k:b"), link("s:p", "k:a")], moduleOf);
    const jk = out.find((l) => (l.source === "j" && l.target === "k") || (l.source === "k" && l.target === "j"));
    expect(jk?.n).toBe(2);
    expect(out).toHaveLength(2); // j↔k and k↔s
  });
  it("ignores links whose endpoints aren't known nodes", () => {
    expect(deriveAffinity([link("k:a", "gone:z")], moduleOf)).toHaveLength(0);
  });
});

describe("reconcileGhosts", () => {
  const staged = [
    { id: "s1", module: "k", op: "create", target: "new-idea", title: "New idea" },
    { id: "s2", module: "k", op: "update", target: "hub" },        // update → real node exists, no ghost
    { id: "s3", module: "j", op: "create", target: "landed" },     // landed → dropped
    { id: "s4", module: "j", op: "create", target: null },         // target-less → no addr, no ghost
    { id: "s5", module: "k", op: "create", target: "new-idea" },   // duplicate addr → deduped
  ];
  it("ghosts pending creates, drops landed + non-creates, dedupes", () => {
    const out = reconcileGhosts(staged, new Set(["k:hub", "j:landed"]));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ addr: "k:new-idea", module: "k", stagedId: "s1", title: "New idea" });
  });
  it("a ghost solidifies away once its addr appears among real nodes", () => {
    const before = reconcileGhosts(staged, new Set());
    const after = reconcileGhosts(staged, new Set(["k:new-idea"]));
    expect(before.some((g) => g.addr === "k:new-idea")).toBe(true);
    expect(after.some((g) => g.addr === "k:new-idea")).toBe(false);
  });
});

describe("nodeRadius", () => {
  it("grows subtly with degree and caps", () => {
    const leaf = nodeRadius({ degree: 0, bytes: 200 });
    const hub = nodeRadius({ degree: 40, bytes: 20000 });
    expect(leaf).toBeGreaterThanOrEqual(5);
    expect(hub).toBeLessThanOrEqual(14);
    expect(hub).toBeGreaterThan(leaf);
  });
});

describe("cardPicks — the in-map mini-card rung (C2)", () => {
  const t = { k: 3, x: 0, y: 0 };
  const view = { w: 600, h: 400 };
  it("empty below card zoom", () => {
    expect(cardPicks([{ addr: "k:a", x: 100, y: 66 }], { ...t, k: 2.9 }, view)).toEqual([]);
  });
  it("picks on-screen nodes nearest the viewport center, capped", () => {
    const nodes = [
      { addr: "k:center", x: 100, y: 66 },   // screen (300,198) ≈ center
      { addr: "k:edge", x: 190, y: 120 },    // screen (570,360) — on-screen, far
      { addr: "k:off", x: 900, y: 900 },     // far off-screen
    ];
    expect(cardPicks(nodes, t, view)).toEqual(["k:center", "k:edge"]);
    expect(cardPicks(nodes, t, view, 1)).toEqual(["k:center"]);
  });
});
