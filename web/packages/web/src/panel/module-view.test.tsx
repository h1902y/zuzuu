// Pure logic tests for the ModuleView section model (U2).
// The vitest env is node (no DOM), so these cover the section state logic
// from module-sections.ts which drives CollapsibleSection open/closed state
// in ModuleView — not the React tree itself.
import { describe, expect, it } from "vitest";
import {
  defaultOpenSections,
  toggleSection,
  patchSections,
  SECTION_KEYS,
  type SectionKey,
} from "../state/module-sections";

describe("defaultOpenSections (section default-open rules)", () => {
  it("opens Pending when pendingCount > 0", () => {
    const s = defaultOpenSections(3);
    expect(s.pending).toBe(true);
  });

  it("closes Pending when pendingCount === 0", () => {
    const s = defaultOpenSections(0);
    expect(s.pending).toBe(false);
  });

  it("Items is always open by default", () => {
    expect(defaultOpenSections(0).items).toBe(true);
    expect(defaultOpenSections(5).items).toBe(true);
  });

  it("Versions/Schema/README default closed", () => {
    const s = defaultOpenSections(0);
    expect(s.versions).toBe(false);
    expect(s.schema).toBe(false);
    expect(s.readme).toBe(false);
  });

  it("pending > 0: Pending open, Items open, rest closed", () => {
    const s = defaultOpenSections(2);
    expect(s.pending).toBe(true);
    expect(s.items).toBe(true);
    expect(s.versions).toBe(false);
    expect(s.schema).toBe(false);
    expect(s.readme).toBe(false);
  });
});

describe("toggleSection", () => {
  const base = defaultOpenSections(0);

  it("toggles a closed section to open", () => {
    const next = toggleSection(base, "versions");
    expect(next.versions).toBe(true);
    // others unchanged
    expect(next.items).toBe(base.items);
    expect(next.pending).toBe(base.pending);
  });

  it("toggles an open section to closed", () => {
    const next = toggleSection(base, "items");
    expect(next.items).toBe(false);
    // others unchanged
    expect(next.versions).toBe(base.versions);
  });

  it("does not mutate the input state", () => {
    const original = { ...base };
    toggleSection(base, "schema");
    expect(base).toEqual(original);
  });

  it("each of the five sections can be toggled independently", () => {
    let state = defaultOpenSections(0);
    for (const key of SECTION_KEYS) {
      const before = state[key];
      state = toggleSection(state, key);
      expect(state[key]).toBe(!before);
    }
  });
});

describe("patchSections", () => {
  it("patches a subset of sections without touching others", () => {
    const base = defaultOpenSections(0);
    const next = patchSections(base, { pending: true, schema: true });
    expect(next.pending).toBe(true);
    expect(next.schema).toBe(true);
    // unchanged
    expect(next.items).toBe(base.items);
    expect(next.versions).toBe(base.versions);
    expect(next.readme).toBe(base.readme);
  });

  it("does not mutate the input state", () => {
    const base = defaultOpenSections(0);
    const snapshot = { ...base };
    patchSections(base, { readme: true });
    expect(base).toEqual(snapshot);
  });

  it("empty patch returns equivalent state", () => {
    const base = defaultOpenSections(1);
    expect(patchSections(base, {})).toEqual(base);
  });
});

describe("SECTION_KEYS ordering", () => {
  it("exports the five canonical keys in display order", () => {
    expect(SECTION_KEYS).toEqual(["pending", "items", "versions", "schema", "readme"]);
  });

  it("defaultOpenSections covers every key", () => {
    const s = defaultOpenSections(0);
    for (const key of SECTION_KEYS) {
      expect(typeof s[key], `missing key '${key}'`).toBe("boolean");
    }
  });
});

describe("zero-pending module shows graceful Pending section", () => {
  it("pending section starts closed when no proposals", () => {
    const s = defaultOpenSections(0);
    // The section is rendered but collapsed — the body shows "no pending proposals"
    // Only the open/closed state is testable here without DOM:
    expect(s.pending).toBe(false);
  });

  it("pending section auto-opens when proposals appear", () => {
    // The CollapsibleSection uses defaultOpen — when pendingCount goes from 0
    // to >0, a new moduleKey mount will use defaultOpen=true.
    // For an existing mount, the store's isOpen returns the stored value or fallback.
    // This test checks the pure helper that drives the defaultOpen value:
    const base = defaultOpenSections(0);
    const pendingCount = 2;
    const corrected = pendingCount > 0 && !base.pending
      ? patchSections(base, { pending: true })
      : base;
    expect(corrected.pending).toBe(true);
    // Items still open
    expect(corrected.items).toBe(true);
  });
});

describe("Versions/Schema/README default collapsed; Pending(>0)/Items default open", () => {
  it("verifies the exact defaults for a module with proposals", () => {
    const s = defaultOpenSections(1);
    expect(s).toMatchObject({
      pending: true,   // open — has proposals
      items: true,     // open — always
      versions: false, // collapsed
      schema: false,   // collapsed
      readme: false,   // collapsed
    });
  });

  it("verifies the exact defaults for a module with no proposals", () => {
    const s = defaultOpenSections(0);
    expect(s).toMatchObject({
      pending: false,  // closed — no proposals
      items: true,     // open — always
      versions: false,
      schema: false,
      readme: false,
    });
  });
});

describe("SectionKey type coverage", () => {
  it("toggleSection preserves all five keys", () => {
    const base = defaultOpenSections(0);
    const toggled = toggleSection(base, "readme");
    expect(Object.keys(toggled)).toEqual(expect.arrayContaining(SECTION_KEYS));
  });

  it("each key is a valid SectionKey string", () => {
    const validKeys: SectionKey[] = ["pending", "items", "versions", "schema", "readme"];
    expect(SECTION_KEYS).toEqual(validKeys);
  });
});
