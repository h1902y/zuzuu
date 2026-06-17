// zuzuu/commands/sessions/redact.mjs — display-time redaction + size caps.
//
// Two protections applied when session content is rendered (NOT in the adapters):
//   - redaction: the no-secret-reads guardrail rule's `pattern:` is read at
//     runtime from .zuzuu/guardrails/items/no-secret-reads.md (the project's own
//     regex, never hardcoded) and run over every text/input/output.
//   - size cap: each tool output is capped at MAX_TOOL_OUTPUT chars (the cut
//     node carries truncated:true — applied by the caller).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const REDACTION_MARKER = '[redacted]';
export const MAX_TOOL_OUTPUT = 4000;

/** Read the no-secret-reads guardrail rule's `pattern:` field at runtime (the
 *  redaction regex is the project's, never hardcoded). Returns a RegExp (global)
 *  or null when the rule file is absent/unparseable/empty. Fail-soft. */
export function redactionRegex(agentDir) {
  try {
    const file = join(agentDir, 'guardrails', 'items', 'no-secret-reads.md');
    const text = readFileSync(file, 'utf8');
    // The pattern lives as an indented `pattern: "<regex>"` line in frontmatter.
    const m = text.match(/^\s*pattern:\s*(.+)$/m);
    if (!m) return null;
    let raw = m[1].trim();
    // Strip surrounding quotes (double or single), un-escaping a double-quoted scalar.
    if (raw.startsWith('"') && raw.endsWith('"') && raw.length >= 2) {
      try { raw = JSON.parse(raw); } catch { raw = raw.slice(1, -1); }
    } else if (raw.startsWith("'") && raw.endsWith("'") && raw.length >= 2) {
      raw = raw.slice(1, -1);
    }
    if (!raw) return null;
    return new RegExp(raw, 'g');
  } catch {
    return null;
  }
}

/** Apply the redaction regex to a string (fail-soft: no regex → unchanged). */
export function redact(s, re) {
  if (typeof s !== 'string' || !s || !re) return s;
  re.lastIndex = 0;
  return s.replace(re, REDACTION_MARKER);
}
