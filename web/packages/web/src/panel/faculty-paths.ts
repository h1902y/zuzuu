// Pure path derivation over the zuzuu home (`.zuzuu/` — the same dir the
// daemon's zuzuu-api resolves) plus small badge/parse helpers for the right
// panel. Kept React-free so the derivations are unit-testable.
import type { FacultyKey } from "@zuzuu-web/protocol";

export const ZUZUU_HOME = ".zuzuu";
/** the session-start grounding brief — written FOR reading, unlike the rest of .live */
export const DIGEST_PATH = `${ZUZUU_HOME}/.live/digest.md`;
export const INSTRUCTIONS_PROJECT = `${ZUZUU_HOME}/instructions/project.md`;
export const GUARDRAILS_RULES = `${ZUZUU_HOME}/guardrails/rules.json`;
export const ACTIONS_DIR = `${ZUZUU_HOME}/actions`;
export const ACTIONS_INBOX_DIR = `${ZUZUU_HOME}/actions/inbox`;

/** Faculty-mode tab strip, in display order (Pulse renders before these). */
export const FACULTY_TABS: { key: FacultyKey; label: string }[] = [
  { key: "knowledge", label: "Knowledge" },
  { key: "memory", label: "Memory" },
  { key: "actions", label: "Actions" },
  { key: "instructions", label: "Instructions" },
  { key: "guardrails", label: "Guardrails" },
];

export const facultyDir = (key: FacultyKey): string => `${ZUZUU_HOME}/${key}`;
export const facultyReadmePath = (key: FacultyKey): string => `${facultyDir(key)}/README.md`;

/** Where a faculty's item FILES live: knowledge/items + memory/entries.
 *  The other three are heterogeneous (runbook dirs, project.md, rules.json). */
export function facultyItemsDir(key: FacultyKey): string | null {
  if (key === "knowledge") return `${ZUZUU_HOME}/knowledge/items`;
  if (key === "memory") return `${ZUZUU_HOME}/memory/entries`;
  return null;
}

/** Item id → its file. Items are one-fact files named `<id>.md`; ids that
 *  already carry an extension (a literal filename) pass through unchanged. */
export function facultyItemPath(key: FacultyKey, id: string): string | null {
  const dir = facultyItemsDir(key);
  if (!dir) return null;
  return `${dir}/${/\.[A-Za-z0-9]+$/.test(id) ? id : `${id}.md`}`;
}

/** An active runbook's definition file (`.zuzuu/actions/<slug>/action.json`). */
export const actionRunbookPath = (slug: string): string => `${ACTIONS_DIR}/${slug}/action.json`;

/** Faculty-tab badge label: the pending count, capped; null hides the badge. */
export function badgeLabel(pending: number | undefined): string | null {
  if (!pending || pending <= 0) return null;
  return pending > 99 ? "99+" : String(pending);
}

export interface GuardrailRule {
  id: string;
  action: string;
  tool: string;
  pattern: string;
  reason: string;
}

/** Parse guardrails/rules.json defensively — corrupt JSON or an unexpected
 *  shape yields [] (the tab then falls back to "edit rules.json" only). */
export function parseGuardrailRules(text: string): GuardrailRule[] {
  try {
    const parsed: unknown = JSON.parse(text);
    const rules = (parsed as { rules?: unknown } | null)?.rules;
    if (!Array.isArray(rules)) return [];
    return rules.flatMap((r): GuardrailRule[] => {
      if (typeof r !== "object" || r === null) return [];
      const o = r as Record<string, unknown>;
      return [{
        id: String(o.id ?? "?"),
        action: String(o.action ?? "?"),
        tool: String(o.tool ?? "*"),
        pattern: String(o.pattern ?? ""),
        reason: String(o.reason ?? ""),
      }];
    });
  } catch {
    return [];
  }
}
