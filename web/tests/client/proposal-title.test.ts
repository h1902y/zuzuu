// shell/review/proposal-title — a proposal's DISPLAY TITLE, derived from op+target,
// never the raw stg-… id (the live bug: a critical delete/deprecate/update rendered
// its opaque staged id as its title, with no indication of what it affects).
// Framework-free: pure model tests, no DOM (this suite's convention).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { StagedSummary } from "#shared/index.js";
import { prettifyId, proposalTargetLabel, proposalTitle, targetPreview } from "../../src/client/shell/review/proposal-title.js";

const s = (over: Partial<StagedSummary> & { id: string; module: string }): StagedSummary => ({
  title: over.id, // mirrors the server's worst-case fallback (stagedTitle → the id) — the exact bug shape
  ...over,
});

describe("prettifyId — a kebab/snake-case id, prettified", () => {
  it("hyphens become spaces, capitalized", () => {
    expect(prettifyId("kickoff-call-with-acme")).toBe("Kickoff call with acme");
  });
  it("underscores too", () => {
    expect(prettifyId("q3_roadmap_review")).toBe("Q3 roadmap review");
  });
  it("empty id → itself (never blank)", () => {
    expect(prettifyId("")).toBe("");
  });
});

describe("proposalTargetLabel", () => {
  it("no target (a create) → null", () => {
    expect(proposalTargetLabel({ target: null })).toBeNull();
    expect(proposalTargetLabel({ target: undefined })).toBeNull();
  });
  it("a target with no resolved note → the id, prettified — never the stg id", () => {
    expect(proposalTargetLabel({ target: "kickoff-call-with-acme" })).toBe("Kickoff call with acme");
  });
  it("a target whose note IS resolved (in the store) → the note's own title", () => {
    expect(proposalTargetLabel({ target: "kickoff-call-with-acme" }, { title: "Kickoff Call with Acme" }))
      .toBe("Kickoff Call with Acme");
  });
  it("a dangling target (note absent from the store) → still the id, prettified, not the stg id", () => {
    expect(proposalTargetLabel({ target: "ghost-note" }, undefined)).toBe("Ghost note");
    expect(proposalTargetLabel({ target: "ghost-note" }, null)).toBe("Ghost note");
  });
});

describe("proposalTitle — the heading ProposalCard + NoteDocument both render", () => {
  it("create (no target) → the note's own name, unchanged (this case already worked)", () => {
    const item = s({ id: "stg-1111aaaa", module: "knowledge", op: "create", target: null, title: "Kickoff call with Acme" });
    expect(proposalTitle(item)).toBe("Kickoff call with Acme");
  });

  it("delete → 'Delete <target>', never the bare stg-… id", () => {
    const item = s({ id: "stg-53ea6bc7", module: "actions", op: "delete", target: "q3-roadmap-review", title: "stg-53ea6bc7" });
    const title = proposalTitle(item);
    expect(title).toBe("Delete Q3 roadmap review");
    expect(title).not.toBe(item.id);
    expect(title).not.toContain("stg-");
  });

  it("deprecate → 'Deprecate <target>'", () => {
    const item = s({ id: "stg-9f9f9f9f", module: "knowledge", op: "deprecate", target: "old-approach", title: "stg-9f9f9f9f" });
    expect(proposalTitle(item)).toBe("Deprecate Old approach");
  });

  it("update → the heading NAMES THE TARGET, not the stg-id (no verb prefix — the field diff already says what changed)", () => {
    const item = s({ id: "stg-6507f837", module: "crm", op: "update", target: "acme-deal", title: "stg-6507f837" });
    const title = proposalTitle(item);
    expect(title).toBe("Acme deal");
    expect(title).not.toBe(item.id);
  });

  it("delete/deprecate/update all upgrade to the note's real name when it resolves in the store", () => {
    const del = s({ id: "stg-1", module: "actions", op: "delete", target: "q3-roadmap-review" });
    const dep = s({ id: "stg-2", module: "knowledge", op: "deprecate", target: "old-approach" });
    const upd = s({ id: "stg-3", module: "crm", op: "update", target: "acme-deal" });
    expect(proposalTitle(del, { title: "Q3 Roadmap Review" })).toBe("Delete Q3 Roadmap Review");
    expect(proposalTitle(dep, { title: "Old Approach" })).toBe("Deprecate Old Approach");
    expect(proposalTitle(upd, { title: "Kickoff call with Acme" })).toBe("Kickoff call with Acme");
  });

  it("a dangling target (the note doesn't exist in the store) still shows the target id — never the stg-… id", () => {
    const item = s({ id: "stg-dangling", module: "knowledge", op: "delete", target: "vanished-note", title: "stg-dangling" });
    const title = proposalTitle(item, undefined);
    expect(title).toBe("Delete Vanished note");
    expect(title).not.toContain("stg-");
  });

  it("a target present but no op (legacy/unset) → still names the target, no verb", () => {
    const item = s({ id: "stg-4", module: "knowledge", op: undefined, target: "some-note" });
    expect(proposalTitle(item)).toBe("Some note");
  });
});

describe("targetPreview — a short glimpse of the target note's body (delete/deprecate)", () => {
  it("the first non-blank line, truncated", () => {
    expect(targetPreview({ body: "\n\nActual first line here\nsecond line" })).toBe("Actual first line here");
  });
  it("truncates long lines with an ellipsis", () => {
    const longLine = "x".repeat(200);
    const out = targetPreview({ body: longLine }, 20);
    expect(out).toHaveLength(20);
    expect(out?.endsWith("…")).toBe(true);
  });
  it("no note resolved / empty body → undefined, never invented", () => {
    expect(targetPreview(undefined)).toBeUndefined();
    expect(targetPreview(null)).toBeUndefined();
    expect(targetPreview({ body: "" })).toBeUndefined();
    expect(targetPreview({ body: "   \n  \n" })).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Wiring — both surfaces actually USE the shared helper, not their own dialect
// (source-string assertions, mirroring proposal-surfaces.test.ts's convention:
// no DOM in this suite, so wiring is checked at the source-text level).
// ─────────────────────────────────────────────────────────────────────────────

describe("ProposalCard.tsx wires the identity heading through proposalTitle, not item.title", () => {
  const cardSrc = readFileSync(fileURLToPath(new URL("../../src/client/shell/review/ProposalCard.tsx", import.meta.url)), "utf8");

  it("imports proposalTitle from proposal-title.ts", () => {
    expect(cardSrc).toMatch(/import\s*\{[^}]*proposalTitle[^}]*\}\s*from\s*"\.\/proposal-title\.js"/);
  });

  it("the identity Text renders the derived title, not item.title directly", () => {
    expect(cardSrc).toMatch(/<Text size="ui" weight="medium" truncate>\{title\}<\/Text>/);
    expect(cardSrc).not.toMatch(/<Text size="ui" weight="medium" truncate>\{item\.title\}<\/Text>/);
  });
});

describe("NoteDocument.tsx's inline U8 card wires the SAME proposalTitle helper (one source of truth)", () => {
  const noteSrc = readFileSync(fileURLToPath(new URL("../../src/client/note/NoteDocument.tsx", import.meta.url)), "utf8");

  it("imports proposalTitle from the review module's proposal-title.ts (not a re-implementation)", () => {
    expect(noteSrc).toMatch(/import\s*\{\s*proposalTitle\s*\}\s*from\s*"\.\.\/shell\/review\/proposal-title\.js"/);
  });

  it("renders it against `item` (this note IS the proposal's target here)", () => {
    expect(noteSrc).toMatch(/\{proposalTitle\(s,\s*item\)\}/);
  });
});
