// ── Pure section logic (U2) — unit-testable, React-free ──────────────────
//
// Five fixed section keys per module; default-open policy lives here as pure
// functions so tests can cover them without mounting React.

export type SectionKey = "pending" | "items" | "versions" | "schema" | "readme";

export const SECTION_KEYS: SectionKey[] = ["pending", "items", "versions", "schema", "readme"];

/** Which sections are open by default, given the pending proposal count.
 *  - pending: open when count > 0
 *  - items:   always open
 *  - versions/schema/readme: always closed (defer until requested)
 */
export function defaultOpenSections(pendingCount: number): Record<SectionKey, boolean> {
  return {
    pending: pendingCount > 0,
    items: true,
    versions: false,
    schema: false,
    readme: false,
  };
}

/** Toggle one section's open state, returning a new map (immutable). */
export function toggleSection(
  state: Record<SectionKey, boolean>,
  key: SectionKey,
): Record<SectionKey, boolean> {
  return { ...state, [key]: !state[key] };
}

/** Override one or more sections' open state (e.g. after a pending-count change). */
export function patchSections(
  state: Record<SectionKey, boolean>,
  patch: Partial<Record<SectionKey, boolean>>,
): Record<SectionKey, boolean> {
  return { ...state, ...patch };
}

// ── Zustand store (U1) — persists explicit user toggles across module switches ─

// Shared section-collapse state for ModuleView (U1).
//
// Open/closed state is keyed by `"${moduleId}:${sectionId}"` so each module
// keeps independent state for the same section id.  Persisting across module
// switches is an intentional product choice: ModuleView re-mounts on switch,
// so `useState` would lose user-toggled sections.  The store remembers explicit
// user toggles; callers supply the DEFAULT via `isOpen(…, fallback)` — a section
// that was never toggled simply returns the fallback, honoring the caller's
// default-open policy (U2 will pass: pending>0 → open, Items → open,
// Versions/Schema/README → closed).
import { create } from "zustand";

interface ModuleSectionsState {
  /** keyed `"${moduleId}:${sectionId}"` → explicit open/closed (undefined = never set) */
  openByKey: Record<string, boolean>;

  /**
   * Whether the section is open.
   * Returns the explicit value if the user ever toggled it; otherwise `fallback`.
   */
  isOpen(moduleId: string, sectionId: string, fallback: boolean): boolean;

  /** Flip the open state for (moduleId, sectionId). */
  toggle(moduleId: string, sectionId: string): void;

  /** Explicitly set the open state. */
  setOpen(moduleId: string, sectionId: string, open: boolean): void;
}

const sectionKey = (moduleId: string, sectionId: string): string =>
  `${moduleId}:${sectionId}`;

export const useModuleSections = create<ModuleSectionsState>((set, get) => ({
  openByKey: {},

  isOpen(moduleId, sectionId, fallback) {
    const v = get().openByKey[sectionKey(moduleId, sectionId)];
    return v !== undefined ? v : fallback;
  },

  toggle(moduleId, sectionId) {
    const k = sectionKey(moduleId, sectionId);
    set((s) => {
      // If never explicitly set, treat current state as `true` (open) before
      // flipping — preserves the invariant that "never set" → fallback-controlled,
      // and "toggled once" → explicit.  Callers who need a specific starting
      // state can call setOpen before the first toggle.
      const current = s.openByKey[k] ?? true;
      return { openByKey: { ...s.openByKey, [k]: !current } };
    });
  },

  setOpen(moduleId, sectionId, open) {
    const k = sectionKey(moduleId, sectionId);
    set((s) => ({ openByKey: { ...s.openByKey, [k]: open } }));
  },
}));
