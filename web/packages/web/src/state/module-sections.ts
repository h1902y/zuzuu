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
