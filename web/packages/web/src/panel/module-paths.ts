// Pure path derivation over the zuzuu home (`.zuzuu/` — the same dir the
// daemon's zuzuu-api resolves), following the Module Standard: envelope
// items are one .md per item. Kept React-free so the derivations are
// unit-testable.
import type { ModuleKey } from "@zuzuu-web/protocol";

export const ZUZUU_HOME = ".zuzuu";
/** the session-start grounding brief — written FOR reading, unlike the rest of .live */
export const DIGEST_PATH = `${ZUZUU_HOME}/.live/digest.md`;

export const moduleDir = (key: ModuleKey): string => `${ZUZUU_HOME}/${key}`;
export const moduleReadmePath = (key: ModuleKey): string => `${moduleDir(key)}/README.md`;
/** the module's payload schema (seeded by `zuzuu init`, human-extendable) */
export const moduleSchemaPath = (key: ModuleKey): string => `${moduleDir(key)}/schema.json`;

/** Where a module's flat envelope items live. Actions are dir-shaped
 *  (actions/<slug>/ACTION.md — scripts stay siblings) → null here. */
export function moduleItemsDir(key: ModuleKey): string | null {
  if (key === "actions") return null;
  if (key === "memory") return `${ZUZUU_HOME}/memory/entries`;
  return `${moduleDir(key)}/items`;
}

/** An envelope item's file: `<items dir>/<id>.md` — for actions, the
 *  runbook dir's `ACTION.md`. */
export function moduleItemPath(key: ModuleKey, id: string): string {
  if (key === "actions") return `${ZUZUU_HOME}/actions/${id}/ACTION.md`;
  return `${moduleItemsDir(key)}/${id}.md`;
}
