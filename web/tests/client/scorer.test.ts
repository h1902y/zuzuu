// U4 — the scorer (shell/review/score.ts + ConfidenceMeter.tsx): confidence ×
// blast-radius → an attention score that SORTS the queue (review-model.ts's
// scoreQueue/sortByScore, consumed by use-review-queue.ts) and CLASSIFIES safe-tail
// vs needs-scrutiny. Framework-free: pure model tests, no DOM (the project's
// convention — see ds-kit.test.ts / proposal-state.test.ts).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { StagedSummary } from "#shared/index.js";
import {
  attentionScore, blastRadius, isSafeTail, needsScrutiny, SAFE_TAIL_THRESHOLD,
} from "../../src/client/shell/review/score.js";
import { scoreQueue, sortByScore } from "../../src/client/shell/review/review-model.js";
import { confidenceMeterVariant } from "../../src/client/shell/review/ConfidenceMeter.js";

const s = (over: Partial<StagedSummary> & { id: string; module: string }): StagedSummary => ({
  title: over.id.toUpperCase(),
  ...over,
});

describe("blastRadius — op + target module, nothing else", () => {
  it("delete is critical regardless of module", () => {
    expect(blastRadius({ op: "delete", module: "knowledge" })).toBe("critical");
    expect(blastRadius({ op: "delete", module: "instructions" })).toBe("critical");
  });

  it("a schema-change op is critical (defensive — no current producer emits it via the queue)", () => {
    expect(blastRadius({ op: "schema-change", module: "knowledge" })).toBe("critical");
  });

  it("a write to a protected/high-value module (guardrails, instructions) is elevated", () => {
    expect(blastRadius({ op: "create", module: "guardrails" })).toBe("elevated");
    expect(blastRadius({ op: "update", module: "instructions" })).toBe("elevated");
  });

  it("an ordinary note-body create/update (knowledge/actions/memory) is low", () => {
    expect(blastRadius({ op: "create", module: "knowledge" })).toBe("low");
    expect(blastRadius({ op: "update", module: "actions" })).toBe("low");
    expect(blastRadius({ op: "update", module: "memory" })).toBe("low");
  });

  it("missing op defaults to create (mirrors table-model.ts's `s.op ?? \"create\"`)", () => {
    expect(blastRadius({ module: "knowledge" })).toBe("low");
    expect(blastRadius({ module: "guardrails" })).toBe("elevated");
  });
});

describe("attentionScore — blast dominates confidence (KTD4)", () => {
  it("a destructive op ranks HIGH-attention even marked high confidence, above a plain update marked LOW confidence", () => {
    const destructiveHighConfidence = attentionScore({ op: "delete", module: "knowledge", confidence: "high" });
    const plainUpdateLowConfidence = attentionScore({ op: "update", module: "knowledge", confidence: "low" });
    expect(destructiveHighConfidence).toBeGreaterThan(plainUpdateLowConfidence);
  });

  it("a protected-module write outranks an ordinary-module write of the same op, regardless of confidence", () => {
    const protectedWrite = attentionScore({ op: "update", module: "guardrails", confidence: "high" });
    const ordinaryWrite = attentionScore({ op: "update", module: "knowledge", confidence: "low" });
    expect(protectedWrite).toBeGreaterThan(ordinaryWrite);
  });

  it("within the SAME blast tier, lower/unset confidence scores higher (needs more scrutiny)", () => {
    const high = attentionScore({ op: "update", module: "knowledge", confidence: "high" });
    const low = attentionScore({ op: "update", module: "knowledge", confidence: "low" });
    const unset = attentionScore({ op: "update", module: "knowledge", confidence: null });
    expect(low).toBeGreaterThan(high);
    expect(unset).toBeGreaterThanOrEqual(low);
    expect(unset).toBeGreaterThan(high);
  });

  it("confidence can never cross a tier boundary — the worst-case low-tier score stays below the best-case elevated-tier score", () => {
    const worstLowTier = attentionScore({ op: "create", module: "knowledge", confidence: null }); // low tier, least confident
    const bestElevatedTier = attentionScore({ op: "create", module: "instructions", confidence: "high" }); // elevated tier, most confident
    expect(worstLowTier).toBeLessThan(bestElevatedTier);
  });
});

describe("isSafeTail / needsScrutiny — the threshold predicate, at the boundary", () => {
  it("the low blast tier (even at its least-confident) is safe-tail — batchable", () => {
    const item = { op: "create", module: "knowledge", confidence: null } as const;
    expect(attentionScore(item)).toBeLessThan(SAFE_TAIL_THRESHOLD);
    expect(isSafeTail(item)).toBe(true);
    expect(needsScrutiny(item)).toBe(false);
  });

  it("the elevated blast tier (even at its most-confident) needs scrutiny — never safe-tail", () => {
    const item = { op: "create", module: "instructions", confidence: "high" } as const;
    expect(attentionScore(item)).toBeGreaterThanOrEqual(SAFE_TAIL_THRESHOLD);
    expect(isSafeTail(item)).toBe(false);
    expect(needsScrutiny(item)).toBe(true);
  });

  it("the critical blast tier always needs scrutiny", () => {
    expect(isSafeTail({ op: "delete", module: "knowledge", confidence: "high" })).toBe(false);
  });

  it("isSafeTail and needsScrutiny are exact complements", () => {
    for (const item of [
      { op: "create", module: "knowledge", confidence: "high" },
      { op: "update", module: "actions", confidence: null },
      { op: "delete", module: "memory", confidence: "low" },
      { op: "update", module: "guardrails", confidence: "medium" },
    ] as const) {
      expect(isSafeTail(item)).toBe(!needsScrutiny(item));
    }
  });
});

describe("scoreQueue / sortByScore — the queue now sorts by attention (was flat first-seen)", () => {
  it("scoreQueue attaches attentionScore(item) to every item, order preserved", () => {
    const q = [s({ id: "a", module: "knowledge", op: "create" }), s({ id: "b", module: "guardrails", op: "update" })];
    const scored = scoreQueue(q);
    expect(scored.map((x) => x.id)).toEqual(["a", "b"]);
    expect(scored[0]!.score).toBe(attentionScore(q[0]!));
    expect(scored[1]!.score).toBe(attentionScore(q[1]!));
  });

  it("sortByScore orders needs-scrutiny FIRST — a low-blast item filed before a critical one is reordered after it", () => {
    const q = [
      s({ id: "safe-first", module: "knowledge", op: "create", confidence: "high" }), // filed first, but low blast
      s({ id: "destructive-second", module: "knowledge", op: "delete", confidence: "high" }), // filed second, but critical blast
    ];
    const sorted = sortByScore(scoreQueue(q));
    expect(sorted.map((x) => x.id)).toEqual(["destructive-second", "safe-first"]);
  });

  it("a whole mixed queue sorts high-attention → low-attention (destructive/protected/low-confidence first, batchable tail last)", () => {
    const q = [
      s({ id: "tail-1", module: "knowledge", op: "create", confidence: "high" }),
      s({ id: "critical-1", module: "actions", op: "delete", confidence: "high" }),
      s({ id: "elevated-1", module: "guardrails", op: "create", confidence: "medium" }),
      s({ id: "tail-2", module: "memory", op: "update", confidence: "high" }),
    ];
    const sorted = sortByScore(scoreQueue(q));
    expect(sorted.map((x) => x.id)).toEqual(["critical-1", "elevated-1", "tail-1", "tail-2"]);
  });

  it("stable: equal-score items keep first-seen relative order", () => {
    const q = [
      s({ id: "first", module: "knowledge", op: "create", confidence: "high" }),
      s({ id: "second", module: "actions", op: "create", confidence: "high" }),
    ];
    // both low-tier + high confidence → identical score
    expect(attentionScore(q[0]!)).toBe(attentionScore(q[1]!));
    expect(sortByScore(scoreQueue(q)).map((x) => x.id)).toEqual(["first", "second"]);
  });

  it("sortByScore does not mutate its input array", () => {
    const q = [s({ id: "a", module: "knowledge", op: "create" }), s({ id: "b", module: "guardrails", op: "delete" })];
    const scored = scoreQueue(q);
    const before = scored.map((x) => x.id);
    sortByScore(scored);
    expect(scored.map((x) => x.id)).toEqual(before);
  });
});

describe("ConfidenceMeter — the meter's pure variant (display only)", () => {
  it("labels carry the blast tier + the raw confidence bucket", () => {
    const v = confidenceMeterVariant({ op: "delete", module: "knowledge", confidence: "high" });
    expect(v.label).toBe("critical · high");
    expect(v.tier).toBe("critical");
  });

  it("an unscored (no confidence) item still renders — never blank/throws", () => {
    const v = confidenceMeterVariant({ op: "create", module: "knowledge", confidence: null });
    expect(v.label).toBe("routine · unscored");
  });

  it("className carries a STATUS hue (danger/warning/success) per tier, never the proposal or module hues", () => {
    expect(confidenceMeterVariant({ op: "delete", module: "knowledge" }).className).toContain("text-danger");
    expect(confidenceMeterVariant({ op: "create", module: "guardrails" }).className).toContain("text-warning");
    expect(confidenceMeterVariant({ op: "create", module: "knowledge" }).className).toContain("text-success");
    for (const forbidden of ["text-proposal", "text-mod-knowledge", "text-mod-guardrails"]) {
      expect(confidenceMeterVariant({ op: "delete", module: "knowledge" }).className).not.toContain(forbidden);
    }
  });

  it("safeTail mirrors score.ts's isSafeTail for the same item", () => {
    const routine = { op: "create", module: "knowledge", confidence: "high" } as const;
    const critical = { op: "delete", module: "knowledge", confidence: "high" } as const;
    expect(confidenceMeterVariant(routine).safeTail).toBe(isSafeTail(routine));
    expect(confidenceMeterVariant(critical).safeTail).toBe(isSafeTail(critical));
  });
});

describe("THE MOAT (KTD4) — the scorer never approves; display + sort only", () => {
  const scorePath = fileURLToPath(new URL("../../src/client/shell/review/score.ts", import.meta.url));
  const meterPath = fileURLToPath(new URL("../../src/client/shell/review/ConfidenceMeter.tsx", import.meta.url));
  const scoreSrcRaw = readFileSync(scorePath, "utf8");
  const meterSrcRaw = readFileSync(meterPath, "utf8");

  // Strip comments before the structural checks below — both files' DOCS legitimately
  // narrate the moat in prose ("it never calls approve/reject or touches
  // dataProvider"), which would otherwise false-positive a naive substring/import
  // scan. Stripping isolates what the CODE actually does from what the comments say
  // about it.
  const stripComments = (src: string): string =>
    src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
  const scoreCode = stripComments(scoreSrcRaw);
  const meterCode = stripComments(meterSrcRaw);

  it("score.ts's actual CODE (comments stripped) imports NOTHING at all — no data/provider, no api, no review-flow", () => {
    const importLines = [...scoreCode.matchAll(/^\s*import\s.*$/gm)].map((m) => m[0]);
    expect(importLines).toEqual([]); // the scorer is pure math over its own ScorableProposal shape
  });

  it("ConfidenceMeter.tsx's CODE imports ONLY from score.js — nothing from the data/gate layer", () => {
    const importLines = [...meterCode.matchAll(/^\s*import\s.*$/gm)].map((m) => m[0]);
    expect(importLines.length).toBeGreaterThan(0);
    for (const line of importLines) expect(line).toMatch(/from\s+["']\.\/score\.js["']/);
    expect(meterCode).not.toMatch(/data\/provider/);
    expect(meterCode).not.toMatch(/lib\/api/);
    expect(meterCode).not.toMatch(/review-flow/);
  });

  it("neither file's CODE contains an approve/reject CALL SITE or a dataProvider reference", () => {
    for (const code of [scoreCode, meterCode]) {
      expect(code).not.toMatch(/\.approve\s*\(/);
      expect(code).not.toMatch(/\.reject\s*\(/);
      expect(code).not.toMatch(/dataProvider/);
    }
  });

  it("score.ts's public surface is compute/classify only — no function named/shaped like an action", () => {
    const exportedNames = [...scoreCode.matchAll(/export\s+(?:function|const)\s+(\w+)/g)].map((m) => m[1]);
    expect(exportedNames.length).toBeGreaterThan(0);
    for (const name of exportedNames) {
      expect(name).not.toMatch(/^(approve|reject|land|apply|mutate|write|save|stage)/i);
    }
  });
});
