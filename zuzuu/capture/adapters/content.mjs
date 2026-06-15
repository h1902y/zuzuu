// Shared helpers for the on-demand session-content read path (U1).
//
// Each adapter exposes an OPTIONAL `extractContent(ref)` capability that reuses
// its existing transcript resolution + raw-field knowledge to return ordered
// content nodes for DISPLAY (never stored). The shape:
//
//   { kind: 'agent_text' | 'user_text' | 'tool',
//     label, ts,                              // ts = ISO 8601 string ('' if unknown)
//     text?,                                  // agent_text / user_text bodies
//     toolInput?, toolOutput?, status? }      // tool nodes
//
// This module holds only the cross-host plumbing the content path needs:
//   - a tiny content-node constructor
//   - an ISO timestamp helper (matches the spans.mjs ns→ISO convention)
// Redaction + size-cap live one layer up (commands/sessions.mjs) because they
// depend on the project's guardrail rule file — a runtime, per-home concern.

/** ISO 8601 from epoch-ms (or an already-ISO/parseable string); '' when unknown. */
export function isoTs(t) {
  if (t == null) return '';
  const ms = typeof t === 'number' ? t : Date.parse(t);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : '';
}

/** Build a content node, omitting empty optional fields (keeps the wire lean). */
export function contentNode({ kind, label, ts, text, toolInput, toolOutput, status }) {
  const node = { kind, label: label || kind, ts: ts || '' };
  if (text != null && text !== '') node.text = text;
  if (toolInput != null && toolInput !== '') node.toolInput = toolInput;
  if (toolOutput != null && toolOutput !== '') node.toolOutput = toolOutput;
  if (status) node.status = status;
  return node;
}

/** Join an array of {type:'text',text} parts (or a plain string) into one string. */
export function joinText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text)
      .join('\n')
      .trim();
  }
  return '';
}
