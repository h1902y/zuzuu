// shell/review/diff.ts — the before/after diff a proposal card previews (U3).
//
// A PURE line-level diff: `lineDiff(before, after)` → rows tagged added/removed/
// unchanged, computed by an LCS so unchanged anchors stay aligned and only the real
// edits flip. The diff is current-note-vs-staged-change (NOT the generation store — a
// pending change isn't a generation):
//   • op:'create' (nearly all mined proposals) → before === "" → every row is `added`.
//   • op:'update'  → before = the current note body (read via the daemon item route),
//                    after = the staged change's body.
// Logic lives here (tested); the .tsx only renders the rows.
import type { StagedSummary } from "#shared/index.js";

export type DiffTag = "added" | "removed" | "unchanged";
export interface DiffRow { tag: DiffTag; text: string }

/** Split a body into diffable lines. An empty body → no lines (so a create's before
 *  is the empty side → all-added; identical bodies → all-unchanged → empty net diff). */
function lines(s: string): string[] {
  if (s === "") return [];
  return s.replace(/\r\n/g, "\n").split("\n");
}

/** Line-level LCS → an edit script. Unchanged lines are the common subsequence;
 *  everything in `before` not on the path is `removed`, in `after` is `added`. */
export function lineDiff(before: string, after: string): DiffRow[] {
  const a = lines(before);
  const b = lines(after);
  const n = a.length;
  const m = b.length;

  // LCS length table (n+1)×(m+1).
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i]![j] = a[i] === b[j]
        ? lcs[i + 1]![j + 1]! + 1
        : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }

  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      rows.push({ tag: "unchanged", text: a[i]! });
      i++; j++;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      rows.push({ tag: "removed", text: a[i]! });
      i++;
    } else {
      rows.push({ tag: "added", text: b[j]! });
      j++;
    }
  }
  while (i < n) { rows.push({ tag: "removed", text: a[i]! }); i++; }
  while (j < m) { rows.push({ tag: "added", text: b[j]! }); j++; }
  return rows;
}

/** The displayable "after" text for a staged change — the note body that lands.
 *  knowledge/memory/instruction → `body`; an action → its `run`/`exec` line; a
 *  guardrail rule → `pattern → action`. Mirrors the server's stagedPreview, but the
 *  FULL text (not the truncated preview) so the diff shows what actually lands. */
export function changeText(change: Record<string, unknown> | undefined): string {
  if (!change) return "";
  const attrs = change.attributes as Record<string, unknown> | undefined;
  const body = change.body;
  if (typeof body === "string" && body) return body;
  const pattern = change.pattern ?? attrs?.pattern;
  const action = change.action ?? attrs?.action;
  if (typeof pattern === "string" && pattern) {
    return typeof action === "string" && action ? `${pattern} → ${action}` : String(pattern);
  }
  const run = change.run ?? change.exec ?? attrs?.exec;
  if (typeof run === "string" && run) return String(run);
  const title = change.title;
  return typeof title === "string" ? title : "";
}

/** True when a proposal is a content update (has a `before`); a create (the default
 *  for mined proposals) has no before → after-only. */
export function isUpdate(item: Pick<StagedSummary, "op">): boolean {
  return item.op === "update";
}
