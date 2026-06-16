// Tests for the module-sections collapse store (U1).
//
// The store is pure/side-effect-free outside of zustand's internal state
// machine. Each test resets to a fresh store instance via the internal
// getState/setState API so tests stay isolated without module reloads.
import { describe, it, expect, beforeEach } from "vitest";
import { useModuleSections } from "./module-sections";

/** Reset the store to its initial state before each test. */
function resetStore() {
  useModuleSections.setState({ openByKey: {} });
}

describe("module-sections store", () => {
  beforeEach(resetStore);

  // ── isOpen: fallback when never toggled ───────────────────────────────────

  it("returns fallback=true for a section never set", () => {
    const { isOpen } = useModuleSections.getState();
    expect(isOpen("knowledge", "items", true)).toBe(true);
  });

  it("returns fallback=false for a section never set", () => {
    const { isOpen } = useModuleSections.getState();
    expect(isOpen("knowledge", "versions", false)).toBe(false);
  });

  it("ignores the fallback once an explicit value is set", () => {
    const store = useModuleSections.getState();
    store.setOpen("knowledge", "items", false);
    // fallback=true is ignored — explicit false wins
    expect(useModuleSections.getState().isOpen("knowledge", "items", true)).toBe(false);
  });

  // ── toggle: flips state ───────────────────────────────────────────────────

  it("toggle flips a never-set section from default (true) to false", () => {
    const store = useModuleSections.getState();
    store.toggle("knowledge", "pending");
    expect(useModuleSections.getState().isOpen("knowledge", "pending", true)).toBe(false);
  });

  it("toggle flips an explicitly-set open=false to true", () => {
    const store = useModuleSections.getState();
    store.setOpen("knowledge", "readme", false);
    store.toggle("knowledge", "readme");
    expect(useModuleSections.getState().isOpen("knowledge", "readme", true)).toBe(true);
  });

  it("toggle is its own inverse (two toggles restores state)", () => {
    const store = useModuleSections.getState();
    store.setOpen("actions", "items", true);
    store.toggle("actions", "items");
    store.toggle("actions", "items");
    expect(useModuleSections.getState().isOpen("actions", "items", false)).toBe(true);
  });

  // ── setOpen: explicit control ─────────────────────────────────────────────

  it("setOpen sets a section to open", () => {
    const store = useModuleSections.getState();
    store.setOpen("memory", "versions", true);
    expect(useModuleSections.getState().isOpen("memory", "versions", false)).toBe(true);
  });

  it("setOpen sets a section to closed", () => {
    const store = useModuleSections.getState();
    store.setOpen("memory", "schema", false);
    expect(useModuleSections.getState().isOpen("memory", "schema", true)).toBe(false);
  });

  // ── module isolation ──────────────────────────────────────────────────────

  it("two different modules keep independent state for the same sectionId", () => {
    const store = useModuleSections.getState();
    store.setOpen("knowledge", "items", true);
    store.setOpen("memory", "items", false);

    const s = useModuleSections.getState();
    expect(s.isOpen("knowledge", "items", false)).toBe(true);
    expect(s.isOpen("memory", "items", true)).toBe(false);
  });

  it("setting state for one module does not affect another module's section", () => {
    const store = useModuleSections.getState();
    store.setOpen("guardrails", "pending", true);
    // instructions "pending" is untouched → fallback applies
    expect(useModuleSections.getState().isOpen("instructions", "pending", false)).toBe(false);
  });

  it("toggling one module's section does not disturb another module", () => {
    const store = useModuleSections.getState();
    store.setOpen("actions", "items", true);
    store.setOpen("knowledge", "items", true);
    store.toggle("actions", "items"); // close actions/items

    const s = useModuleSections.getState();
    expect(s.isOpen("actions", "items", true)).toBe(false);
    expect(s.isOpen("knowledge", "items", false)).toBe(true); // unaffected
  });

  // ── key format ────────────────────────────────────────────────────────────

  it("keys are namespaced: same sectionId under different modules stays independent", () => {
    const store = useModuleSections.getState();
    // Same sectionId "items" under two different non-colon module ids
    store.setOpen("alpha", "items", true);
    store.setOpen("beta", "items", false);

    const s = useModuleSections.getState();
    expect(s.isOpen("alpha", "items", false)).toBe(true);
    expect(s.isOpen("beta", "items", true)).toBe(false);
    // "gamma/items" was never set — returns fallback
    expect(s.isOpen("gamma", "items", true)).toBe(true);
  });
});
