// U5 — the close-card detection + derivations (R5). Pure logic, no DOM: when does the
// "what this session taught" card fire, and how does it summarize the staged proposals.
import { describe, it, expect } from "vitest";
import type { StagedSummary } from "#shared/index.js";
import {
  shouldFireCloseCard,
  closeCardFired,
  markCloseCardFired,
  countByType,
  topPatterns,
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

describe("shouldFireCloseCard — fire once, only with pending", () => {
  it("ended with pending > 0 and not fired → fire", () => {
    expect(shouldFireCloseCard("s1", 2, false)).toBe(true);
  });

  it("pending = 0 → never fire", () => {
    expect(shouldFireCloseCard("s1", 0, false)).toBe(false);
  });

  it("already fired (e.g. dismissed earlier) → no re-fire even with pending", () => {
    expect(shouldFireCloseCard("s1", 5, true)).toBe(false);
  });

  it("empty session id → no fire", () => {
    expect(shouldFireCloseCard("", 5, false)).toBe(false);
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
    expect(shouldFireCloseCard("s1", 4, closeCardFired("s1", store))).toBe(false);
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
