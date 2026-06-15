// Pure logic for the modules master list (WS-C), React-free and unit-tested.
import type { ModuleOverviewEntry, ModuleOverviewResponse } from "@zuzuu-web/protocol";
import { MODULE_ORDER } from "./kit";

/** The display order: the built-in spine first (only the ones present, or all
 *  when the overview is empty), then any extra modules the overview reports
 *  (declarative / user-composed) appended in overview order. */
export function orderedIds(entries: ModuleOverviewEntry[]): string[] {
  return [
    ...MODULE_ORDER.filter((k) => entries.length === 0 || entries.some((e) => e.id === k)),
    ...entries.map((e) => e.id).filter((id) => !(MODULE_ORDER as string[]).includes(id)),
  ];
}

/** A module's primary kind for the meta line — the first declared kind, else
 *  a neutral "module" label. */
export function kindLabel(entry: ModuleOverviewEntry | undefined): string {
  return entry?.kinds?.[0] ?? "module";
}

/** The optimistic-toggle cache reducer: flip ONE module's `enabled` in the
 *  cached overview response, leaving every other field intact. Returns the old
 *  value unchanged when the shape is unexpected (defensive — matches the
 *  React Query setQueryData updater). */
export function toggleEnabledInOverview(
  old: ModuleOverviewResponse | undefined,
  id: string,
  next: boolean,
): ModuleOverviewResponse | undefined {
  if (!old?.modules) return old;
  return {
    ...old,
    modules: old.modules.map((m) => (m.id === id ? { ...m, enabled: next } : m)),
  };
}
