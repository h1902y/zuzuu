// shell/review/provenance.ts — the "born from" provenance line (U6 / R6).
//
// A PURE projection of a note/proposal's `source` pointer into the human line the
// card + record view render: "Born from {N} session{s}" + the session ids. The ids
// are host-prefixed transcript session ids (e.g. `claude-code:abc123`) — NOT daemon
// PTY ids — so the cross-reference is a session LINK, not a transcript-offset jump
// (the locator is session-ids-only today; see R-B). Logic lives here (tested); the
// .tsx only renders the strings.
import type { ProvenanceSource } from "#shared/index.js";

export interface Provenance {
  /** the headline, e.g. "Born from 2 sessions". */
  label: string;
  /** the distinct originating session ids (host-prefixed, de-duped, order-stable). */
  sessions: string[];
  /** per-session display labels (the host-prefixed id, shortened for readability). */
  display: string[];
}

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;

/** A session id shortened for display: keep the host prefix, truncate a long opaque
 *  tail (`claude-code:0a1b2c3d-…-ef` → `claude-code:0a1b2c3d`). Best-effort cosmetic. */
export function shortSession(id: string): string {
  const colon = id.indexOf(":");
  const host = colon >= 0 ? id.slice(0, colon) : "";
  const tail = colon >= 0 ? id.slice(colon + 1) : id;
  const shortTail = tail.length > 12 ? tail.slice(0, 12) : tail;
  return host ? `${host}:${shortTail}` : shortTail;
}

/** The distinct originating session ids from a `source` pointer (prefers `sessions`,
 *  falls back to the locator's). De-dupes, drops blanks, preserves first-seen order. */
function sessionIds(source: ProvenanceSource | undefined): string[] {
  const raw = (Array.isArray(source?.sessions) ? source.sessions : source?.locator?.sessions) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of raw) {
    const id = String(s ?? "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** Project a `source` pointer into the provenance line, or null when there is no
 *  resolvable origin (no source, or a source with no session ids → render nothing). */
export function provenanceOf(source: ProvenanceSource | undefined): Provenance | null {
  const sessions = sessionIds(source);
  if (!sessions.length) return null;
  return {
    label: `Born from ${plural(sessions.length, "session")}`,
    sessions,
    display: sessions.map(shortSession),
  };
}
