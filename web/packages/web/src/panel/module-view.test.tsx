// Pure logic tests for the ModuleView section model (U2) and inline item
// expand (U3). The vitest env is node (no DOM), so these cover the pure state
// logic — no React tree mounting needed.
import { beforeEach, describe, expect, it } from "vitest";
import {
  defaultOpenSections,
  toggleSection,
  patchSections,
  SECTION_KEYS,
  type SectionKey,
} from "../state/module-sections";
import {
  isItemExpanded,
  toggleItemExpand,
  collapseItem,
  cleanBody,
  extractItemRelations,
  useItemExpand,
} from "../state/item-expand";

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

// ── U3: inline item expand — pure helpers ────────────────────────────────

describe("isItemExpanded (U3)", () => {
  it("returns true when expandedId matches itemId", () => {
    expect(isItemExpanded("item-1", "item-1")).toBe(true);
  });

  it("returns false when expandedId is null", () => {
    expect(isItemExpanded(null, "item-1")).toBe(false);
  });

  it("returns false when expandedId is a different item", () => {
    expect(isItemExpanded("item-2", "item-1")).toBe(false);
  });
});

describe("toggleItemExpand (U3) — row click = inline expand, no navigation", () => {
  it("expanding a collapsed item returns its id", () => {
    // null → item-1: the row was clicked, item expands inline
    expect(toggleItemExpand(null, "item-1")).toBe("item-1");
  });

  it("clicking the expanded item again collapses it (returns null)", () => {
    // Clicking the same item twice: expand then collapse
    const afterExpand = toggleItemExpand(null, "item-1");
    const afterCollapse = toggleItemExpand(afterExpand, "item-1");
    expect(afterCollapse).toBeNull();
  });

  it("clicking a different item expands it and collapses the current one", () => {
    // item-1 is expanded; click item-2 → item-2 expands, item-1 collapses
    const afterSwitch = toggleItemExpand("item-1", "item-2");
    expect(afterSwitch).toBe("item-2");
  });

  it("does NOT navigate — the result is a new expandedId, not a route", () => {
    // The return type is string | null — only ever an item id or null, never
    // a navigation command. This test documents the contract.
    const result = toggleItemExpand(null, "fact-abc123");
    expect(typeof result === "string" || result === null).toBe(true);
    // No {kind:"item"} navigation object, no route string
    expect(result).not.toEqual(expect.objectContaining({ kind: "item" }));
  });
});

describe("collapseItem (U3)", () => {
  it("always returns null (collapses any expanded item)", () => {
    expect(collapseItem("item-1")).toBeNull();
    expect(collapseItem(null)).toBeNull();
  });
});

describe("cleanBody (U3) — strips duplicate title heading", () => {
  it("strips a leading # Title line", () => {
    const raw = "# My Fact\nThis is the body.\nSecond line.";
    expect(cleanBody(raw)).toBe("This is the body.\nSecond line.");
  });

  it("leaves body unchanged if no leading # line", () => {
    const raw = "This is the body.\nNo heading here.";
    expect(cleanBody(raw)).toBe("This is the body.\nNo heading here.");
  });

  it("returns empty string for undefined or empty input", () => {
    expect(cleanBody(undefined)).toBe("");
    expect(cleanBody("")).toBe("");
  });

  it("trims leading/trailing whitespace", () => {
    const raw = "# Title\n\n  some body  \n";
    expect(cleanBody(raw)).toBe("some body");
  });
});

describe("extractItemRelations (U3) — compact inline list, not side rail", () => {
  it("returns empty array when payload has no relations", () => {
    expect(extractItemRelations({})).toEqual([]);
    expect(extractItemRelations(undefined)).toEqual([]);
  });

  it("returns empty array when relations is not an array", () => {
    expect(extractItemRelations({ relations: "bad" })).toEqual([]);
  });

  it("extracts id and title from valid relation objects", () => {
    const payload = {
      relations: [
        { id: "rel-1", title: "Related Fact" },
        { id: "rel-2" },
      ],
    };
    const result = extractItemRelations(payload);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: "rel-1", title: "Related Fact", snippet: undefined });
    expect(result[1]).toEqual({ id: "rel-2", title: "rel-2", snippet: undefined });
  });

  it("uses id as title fallback when title is absent", () => {
    const payload = { relations: [{ id: "some-id" }] };
    const [rel] = extractItemRelations(payload);
    expect(rel?.title).toBe("some-id");
  });

  it("extracts snippet from snippet field", () => {
    const payload = { relations: [{ id: "r1", snippet: "quoted context" }] };
    const [rel] = extractItemRelations(payload);
    expect(rel?.snippet).toBe("quoted context");
  });

  it("extracts snippet from context field as fallback", () => {
    const payload = { relations: [{ id: "r1", context: "ctx text" }] };
    const [rel] = extractItemRelations(payload);
    expect(rel?.snippet).toBe("ctx text");
  });

  it("filters out objects with neither id nor title", () => {
    const payload = { relations: [{ snippet: "orphan" }, { id: "valid" }] };
    const result = extractItemRelations(payload);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("valid");
  });
});

// ── U3: useItemExpand store ───────────────────────────────────────────────

describe("useItemExpand store (U3)", () => {
  beforeEach(() => {
    useItemExpand.setState({ expandedByModule: {} });
  });

  it("starts with nothing expanded", () => {
    expect(useItemExpand.getState().isExpanded("knowledge", "item-1")).toBe(false);
  });

  it("toggle expands an item inline in its module", () => {
    useItemExpand.getState().toggle("knowledge", "item-1");
    expect(useItemExpand.getState().isExpanded("knowledge", "item-1")).toBe(true);
  });

  it("toggle collapses an already-expanded item (second click)", () => {
    useItemExpand.getState().toggle("knowledge", "item-1");
    useItemExpand.getState().toggle("knowledge", "item-1");
    expect(useItemExpand.getState().isExpanded("knowledge", "item-1")).toBe(false);
  });

  it("toggling item-2 collapses item-1 (single-active-expand invariant)", () => {
    useItemExpand.getState().toggle("knowledge", "item-1");
    useItemExpand.getState().toggle("knowledge", "item-2");
    expect(useItemExpand.getState().isExpanded("knowledge", "item-1")).toBe(false);
    expect(useItemExpand.getState().isExpanded("knowledge", "item-2")).toBe(true);
  });

  it("modules have independent expand state", () => {
    useItemExpand.getState().toggle("knowledge", "item-1");
    useItemExpand.getState().toggle("memory", "item-2");
    expect(useItemExpand.getState().isExpanded("knowledge", "item-1")).toBe(true);
    expect(useItemExpand.getState().isExpanded("memory", "item-2")).toBe(true);
    // knowledge item-1 is not visible in memory
    expect(useItemExpand.getState().isExpanded("memory", "item-1")).toBe(false);
  });

  it("collapse() clears the expanded item in that module", () => {
    useItemExpand.getState().toggle("actions", "runbook-1");
    useItemExpand.getState().collapse("actions");
    expect(useItemExpand.getState().isExpanded("actions", "runbook-1")).toBe(false);
  });
});

// ── U3: guard — no {kind:"item"} in right-panel.ts ──────────────────────

describe("right-panel.ts has no item-detail navigation (U3 guard)", () => {
  it("CenterSelection type has no kind:item variant", async () => {
    // Import the store to inspect its type contract at runtime.
    // The only allowed center selection kind is "module" — never "item", and
    // (since T4) never "session" (a session is viewed in the home surface).
    const { useRightPanel } = await import("../state/right-panel");
    const state = useRightPanel.getState();

    // openModule is the only center-selection navigation primitive
    expect(typeof state.openModule).toBe("function");
    // There must be no openItem function — item details stay inline
    expect((state as unknown as Record<string, unknown>)["openItem"]).toBeUndefined();
    // T4: no session-detail navigation — the picker views sessions in-place
    expect((state as unknown as Record<string, unknown>)["openSession"]).toBeUndefined();
  });

  it("opening a module does not produce a kind:item selection", async () => {
    const { useRightPanel } = await import("../state/right-panel");
    useRightPanel.setState({ selection: null, selectedModule: null });
    useRightPanel.getState().openModule("knowledge");
    const sel = useRightPanel.getState().selection;
    expect(sel?.kind).toBe("module");
    // Confirm: never "item"
    expect(sel?.kind).not.toBe("item");
  });
});
