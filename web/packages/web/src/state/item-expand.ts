// ── Item inline-expand state (U3) — unit-testable, React-free ─────────────
//
// When a user clicks an item row, the item expands *inline* within the Items
// section — no navigation, no side rail, no separate detail page.
// This module exposes pure toggle helpers (tested without DOM) + a Zustand
// store that persists the expanded item id per module across re-renders.
//
// Design: at most ONE item is expanded at a time within a module view.
// Clicking the same item again collapses it; clicking a different item
// collapses the old one and expands the new one.

/** Whether an item should be expanded inline, given the current expanded id. */
export function isItemExpanded(expandedId: string | null, itemId: string): boolean {
  return expandedId === itemId;
}

/**
 * Toggle an item's expanded state.
 *
 * - If `expandedId === itemId` (currently expanded): collapse → return null.
 * - Otherwise: expand this item (collapsing any other) → return `itemId`.
 *
 * Row click = call this. No navigation.
 */
export function toggleItemExpand(
  expandedId: string | null,
  itemId: string,
): string | null {
  return expandedId === itemId ? null : itemId;
}

/** Collapse the expanded item (e.g. the section itself collapses). */
export function collapseItem(_expandedId: string | null): null {
  return null;
}

// ── Pure helpers for compact inline reading block ─────────────────────────

/** Extract a clean body from a raw item body string.
 *  Strips a leading "# Title" line that duplicates the item title. */
export function cleanBody(rawBody: string | undefined): string {
  if (!rawBody) return "";
  const lines = rawBody.split("\n");
  const stripped = lines[0]?.startsWith("# ") ? lines.slice(1) : lines;
  return stripped.join("\n").trim();
}

/** Extract relations array from item payload. Returns [] if none. */
export function extractItemRelations(
  payload: Record<string, unknown> | undefined,
): { id?: string; title?: string; snippet?: string }[] {
  const rel = payload?.relations;
  if (!Array.isArray(rel)) return [];
  return (rel as unknown[])
    .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
    .map((r) => ({
      id: typeof r["id"] === "string" ? r["id"] : undefined,
      title: typeof r["title"] === "string" ? r["title"] : (typeof r["id"] === "string" ? r["id"] : undefined),
      snippet: typeof r["snippet"] === "string" ? r["snippet"] : (typeof r["context"] === "string" ? r["context"] : undefined),
    }))
    .filter((r) => r.id ?? r.title);
}

// ── Zustand store — persists per-module expanded item across re-renders ────

import { create } from "zustand";
import type { ModuleKey } from "@zuzuu-web/protocol";

interface ItemExpandState {
  /** keyed by moduleKey → the currently expanded item id (null = none) */
  expandedByModule: Partial<Record<ModuleKey, string | null>>;

  /** Is this item currently expanded in its module? */
  isExpanded(moduleKey: ModuleKey, itemId: string): boolean;

  /** Toggle this item's expanded state within its module. */
  toggle(moduleKey: ModuleKey, itemId: string): void;

  /** Collapse whatever is expanded in this module. */
  collapse(moduleKey: ModuleKey): void;
}

export const useItemExpand = create<ItemExpandState>((set, get) => ({
  expandedByModule: {},

  isExpanded(moduleKey, itemId) {
    return isItemExpanded(get().expandedByModule[moduleKey] ?? null, itemId);
  },

  toggle(moduleKey, itemId) {
    set((s) => ({
      expandedByModule: {
        ...s.expandedByModule,
        [moduleKey]: toggleItemExpand(s.expandedByModule[moduleKey] ?? null, itemId),
      },
    }));
  },

  collapse(moduleKey) {
    set((s) => ({
      expandedByModule: { ...s.expandedByModule, [moduleKey]: null },
    }));
  },
}));
