// U5 — the close-card detection + derivations (R5). Pure logic, no DOM: when does the
// "what this session taught" card fire, and how does it summarize the staged proposals.
import { describe, it, expect } from "vitest";
import type { StagedSummary } from "#shared/index.js";
import type { HeldSession } from "#shared/index.js";
import {
  shouldFireCloseCard,
  closeCardFired,
  markCloseCardFired,
  markCloseCardDeferred,
  countByType,
  topPatterns,
  heldChangesOf,
  codeFromHeld,
  pickHeld,
  cardWithoutCode,
  mergeReducer,
  initialMergeState,
  type CloseCardData,
  type CloseCardCode,
} from "../../src/client/shell/review/session-close-card.js";

/** A tiny in-memory Storage stub (the dedup is sessionStorage-backed). */
function memStore(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
    key: (i) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  };
}

const staged = (id: string, module: string, type?: string, kind?: string, sessions = 3): StagedSummary => ({
  id,
  module,
  title: id,
  ...(type ? { change: { type } } : {}),
  ...(kind ? { evidence: [{ kind, sessions }] } : {}),
});

describe("shouldFireCloseCard — fire once, on held code OR pending brain (U6/P1)", () => {
  it("ended with pending > 0 and not fired → fire", () => {
    expect(shouldFireCloseCard("s1", 2, 0, false)).toBe(true);
  });

  it("code-only session: pending = 0 but held changes > 0 → fire (the U6 gap)", () => {
    expect(shouldFireCloseCard("s1", 0, 3, false)).toBe(true);
  });

  it("nothing to review (pending = 0, no held changes) → never fire", () => {
    expect(shouldFireCloseCard("s1", 0, 0, false)).toBe(false);
  });

  it("already fired (e.g. dismissed / kept earlier) → no re-fire even with code or pending", () => {
    expect(shouldFireCloseCard("s1", 5, 5, true)).toBe(false);
  });

  it("empty session id → no fire", () => {
    expect(shouldFireCloseCard("", 5, 5, false)).toBe(false);
  });
});

describe("close-card dedup (sessionStorage-backed)", () => {
  it("a marked session reads back as fired; an unmarked one does not", () => {
    const store = memStore();
    expect(closeCardFired("s1", store)).toBe(false);
    markCloseCardFired("s1", store);
    expect(closeCardFired("s1", store)).toBe(true);
    expect(closeCardFired("s2", store)).toBe(false); // dedup is per-session id
  });

  it("dismiss-without-review does not re-fire: once marked, shouldFire is false", () => {
    const store = memStore();
    markCloseCardFired("s1", store); // the card fired (and the user dismissed)
    expect(shouldFireCloseCard("s1", 4, 2, closeCardFired("s1", store))).toBe(false);
  });

  it("Keep on branch uses the SAME dedup key (an acknowledged defer, not a re-nag)", () => {
    const store = memStore();
    markCloseCardDeferred("s1", store);
    expect(closeCardFired("s1", store)).toBe(true); // won't re-surface this tab
    expect(shouldFireCloseCard("s1", 0, 5, closeCardFired("s1", store))).toBe(false);
  });

  it("no storage available → never fired, never throws", () => {
    expect(closeCardFired("s1", undefined)).toBe(false);
    expect(() => markCloseCardFired("s1", undefined)).not.toThrow();
  });
});

describe("countByType — the headline (count by note-kind chip)", () => {
  it("groups by chip label, descending count then label", () => {
    const list = [
      staged("a", "knowledge", "knowledge"),
      staged("b", "knowledge", "knowledge"),
      staged("c", "instructions", "rule"), // a rule note → Guardrail chip, not its module
    ];
    expect(countByType(list)).toEqual([
      { label: "Knowledge", count: 2 },
      { label: "Guardrail", count: 1 },
    ]);
  });

  it("empty → empty", () => {
    expect(countByType([])).toEqual([]);
  });
});

describe("topPatterns — the top-N mined reason lines", () => {
  it("renders each proposal's reason line, capped at N", () => {
    const list = [
      staged("a", "actions", "action", "command", 4),
      staged("b", "knowledge", "knowledge", "entity", 2),
      staged("c", "knowledge", "knowledge", "fact", 5),
      staged("d", "knowledge", "knowledge", "fact", 6),
    ];
    const top = topPatterns(list, 3);
    expect(top).toHaveLength(3);
    expect(top[0]).toEqual({
      id: "a",
      module: "actions",
      reason: "Because you ran this command in 4 sessions, I want to save it as a reusable action.",
    });
    // an unknown/absent kind still degrades to the neutral fallback, never throws
    expect(topPatterns([staged("x", "knowledge")], 3)[0]?.reason).toMatch(/Recurring signal/);
  });
});

// ── U6: the CODE section derivations + the merge-state machine ─────────────────

const held = (over: Partial<HeldSession> = {}): HeldSession => ({
  id: "abc", branch: "zz/session-abc", kind: "worktree",
  checkpoints: 2, files: 3, added: 10, removed: 4, mergeability: "ready", ...over,
});
const codeOf = (over: Partial<CloseCardCode> = {}): CloseCardCode => ({
  id: "abc", branch: "zz/session-abc", files: 3, added: 10, removed: 4, checkpoints: 2, mergeability: "ready", ...over,
});

describe("heldChangesOf — the fire condition's code magnitude", () => {
  it("counts files + checkpoints; null code → 0", () => {
    expect(heldChangesOf(null)).toBe(0);
    expect(heldChangesOf(codeOf({ files: 3, checkpoints: 2 }))).toBe(5);
    // a held session with only checkpoints (no net file change) still counts (decide it)
    expect(heldChangesOf(codeOf({ files: 0, checkpoints: 1 }))).toBe(1);
  });
});

describe("codeFromHeld / pickHeld — mapping the held DTO onto the card", () => {
  it("codeFromHeld carries the id + summary + mergeability", () => {
    expect(codeFromHeld(held())).toEqual(codeOf());
  });
  it("pickHeld matches by branch first, then by id", () => {
    const list = [held({ id: "a", branch: "zz/session-a" }), held({ id: "b", branch: "zz/held-b", kind: "inplace" })];
    expect(pickHeld(list, "zz/held-b", "x")?.id).toBe("b");
    expect(pickHeld(list, undefined, "a")?.id).toBe("a"); // no branch → id fallback
    expect(pickHeld(list, "zz/session-nope", "nope")).toBeUndefined();
  });
});

describe("cardWithoutCode — the post-merge/discard/keep collapse", () => {
  const base: CloseCardData = { sessionId: "s1", pending: 0, staged: [], code: codeOf() };
  it("with brain proposals remaining → collapses to a brain-only card (code null)", () => {
    const card: CloseCardData = { ...base, pending: 2 };
    expect(cardWithoutCode(card)).toEqual({ ...card, code: null });
  });
  it("with no brain proposals → the card clears (null)", () => {
    expect(cardWithoutCode(base)).toBeNull();
  });
});

describe("mergeReducer — idle → merging → merged | error (never silent)", () => {
  it("start → merging; ok → merged; fail → error with the message; reset → idle", () => {
    let s = initialMergeState;
    expect(s).toEqual({ phase: "idle" });
    s = mergeReducer(s, { type: "start" });
    expect(s).toEqual({ phase: "merging" });
    expect(mergeReducer(s, { type: "ok" })).toEqual({ phase: "merged" });
    const errored = mergeReducer(s, { type: "fail", error: "conflict" });
    expect(errored).toEqual({ phase: "error", error: "conflict" });
    expect(mergeReducer(errored, { type: "reset" })).toEqual({ phase: "idle" });
  });
});
