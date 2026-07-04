// client/world/model.ts — the world's pure model (palette · affinity · ghosts · radius).
import { describe, expect, it } from "vitest";
import {
  buildNeighborIndex, cardPicks, declutter, deriveAffinity, moduleHue, modulePalette, nodeRadius,
  reconcileGhosts, resolveMentionAddrs, truncLabel,
} from "../../src/client/world/model.js";
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

describe("resolveMentionAddrs (glow targets)", () => {
  const addrs = ["knowledge:brahman", "journal:2026-07-02", "actions:render", "library:render"];
  it("module:id must exist verbatim; unknown full addrs drop", () => {
    expect(resolveMentionAddrs(["knowledge:brahman", "knowledge:ghost"], addrs)).toEqual(["knowledge:brahman"]);
  });
  it("a bare id resolves to its unique owner; ambiguous and unknown drop", () => {
    expect(resolveMentionAddrs(["brahman"], addrs)).toEqual(["knowledge:brahman"]);
    expect(resolveMentionAddrs(["render"], addrs)).toEqual([]); // actions + library both own it
    expect(resolveMentionAddrs(["nowhere"], addrs)).toEqual([]);
  });
  it("dedupes across forms, input order kept", () => {
    expect(resolveMentionAddrs(["brahman", "knowledge:brahman", "2026-07-02"], addrs))
      .toEqual(["knowledge:brahman", "journal:2026-07-02"]);
  });
});

describe("truncLabel (label truncation, B)", () => {
  it("leaves short strings untouched", () => {
    expect(truncLabel("brahman")).toBe("brahman");
    expect(truncLabel("exactly-eighteen!!")).toBe("exactly-eighteen!!"); // 18 chars, at the boundary
  });
  it("truncates past max with an ellipsis — the dense-graph example", () => {
    expect(truncLabel("Scaling Monosemanticity Paper")).toBe("Scaling Monosemant…");
  });
  it("respects a custom max", () => {
    expect(truncLabel("abcdefgh", 4)).toBe("abcd…");
  });
});

describe("declutter (label collision pass, A)", () => {
  it("keeps every label when no boxes overlap", () => {
    const cands = [
      { addr: "a", x: 0, y: 0, w: 40, priority: 5 },
      { addr: "b", x: 200, y: 0, w: 40, priority: 3 },
      { addr: "c", x: 0, y: 200, w: 40, priority: 1 },
    ];
    expect(declutter(cands)).toEqual(new Set(["a", "b", "c"]));
  });
  it("hides the lower-priority label when its box overlaps a higher-priority one already placed", () => {
    const cands = [
      { addr: "hub", x: 0, y: 0, w: 40, priority: 10 },
      { addr: "leaf", x: 5, y: 0, w: 40, priority: 1 }, // overlaps hub's box, loses on priority
    ];
    const shown = declutter(cands);
    expect(shown.has("hub")).toBe(true);
    expect(shown.has("leaf")).toBe(false);
  });
  it("a non-overlapping label survives regardless of priority", () => {
    const cands = [
      { addr: "hub", x: 0, y: 0, w: 40, priority: 10 },
      { addr: "far", x: 500, y: 500, w: 40, priority: 1 },
    ];
    expect(declutter(cands)).toEqual(new Set(["hub", "far"]));
  });
  it("ties are stable — input order breaks it, not re-sorted arbitrarily", () => {
    const cands = [
      { addr: "first", x: 0, y: 0, w: 40, priority: 5 },
      { addr: "second", x: 2, y: 0, w: 40, priority: 5 }, // overlapping box, same priority
    ];
    const shown = declutter(cands);
    expect(shown.has("first")).toBe(true);
    expect(shown.has("second")).toBe(false);
  });
});

describe("buildNeighborIndex (hover-to-trace, C)", () => {
  const links = [
    { source: "k:a", target: "k:b" },
    { source: "k:a", target: "k:c" },
    { source: "k:b", target: "k:c" },
  ];
  it("collects neighbors symmetrically, one hop", () => {
    const { neighbors } = buildNeighborIndex(links);
    expect([...(neighbors.get("k:a") ?? [])].sort()).toEqual(["k:b", "k:c"]);
    expect([...(neighbors.get("k:b") ?? [])].sort()).toEqual(["k:a", "k:c"]);
    expect(neighbors.get("k:z")).toBeUndefined(); // an unknown node has no entry
  });
  it("collects the incident link indices for a node", () => {
    const { incidentLinks } = buildNeighborIndex(links);
    expect([...(incidentLinks.get("k:a") ?? [])].sort()).toEqual([0, 1]);
    expect([...(incidentLinks.get("k:c") ?? [])].sort()).toEqual([1, 2]);
    expect(incidentLinks.get("k:z")).toBeUndefined();
  });
});
