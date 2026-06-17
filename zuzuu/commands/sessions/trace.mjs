// zuzuu/commands/sessions/trace.mjs — OTLP trace-blob walking + span mapping.
//
// The captured trace is OTLP/JSON NDJSON (one export request per line). These
// helpers read that blob into flat/ordered spans and map each span into the
// DISPLAY records the session surface renders (per-action records + tree nodes).
// Pure and fail-soft by construction: callers wrap reads in try/catch.

import { readFileSync } from 'node:fs';

/** Count spans across an OTLP/JSON NDJSON blob (one export request per line). */
export function countTraceSpans(file) {
  let spans = 0;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const req = JSON.parse(line);
    for (const rs of req.resourceSpans ?? []) {
      for (const ss of rs.scopeSpans ?? []) spans += (ss.spans ?? []).length;
    }
  }
  return spans;
}

/** Walk all spans from an OTLP/JSON NDJSON blob into a flat array, ordered by
 *  startTimeUnixNano. Returns [] on any read/parse error (fail-soft).
 *  Each span: { name, startNs, endNs, statusCode, attributes: [{key,value}] } */
export function readTraceSpans(file) {
  const all = [];
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const req = JSON.parse(line);
    for (const rs of req.resourceSpans ?? []) {
      for (const ss of rs.scopeSpans ?? []) {
        for (const sp of ss.spans ?? []) all.push(sp);
      }
    }
  }
  // Sort by start time (numeric; OTLP stores nanoseconds as strings)
  all.sort((a, b) => {
    const na = Number(BigInt(a.startTimeUnixNano || '0'));
    const nb = Number(BigInt(b.startTimeUnixNano || '0'));
    return na - nb;
  });
  return all;
}

/** Map an OTLP span into a SessionTraceAction record.
 *  - SESSION root span → skipped (returns null)
 *  - TURN spans (name starts with "turn:") → kind "turn"
 *  - TOOL_CALL spans (have gen_ai.tool.name attribute) → kind "tool"
 *  - anything else → kind "other"
 * @param {object} sp  raw OTLP span object
 * @returns {{ kind: string, label: string, ts: string, status?: string }|null}
 */
export function spanToAction(sp) {
  const name = sp.name ?? '';
  // Skip the SESSION root (no parentSpanId)
  if (!sp.parentSpanId) return null;

  const attrs = {};
  for (const a of sp.attributes ?? []) {
    const v = a.value;
    attrs[a.key] = v?.stringValue ?? v?.intValue ?? v?.doubleValue ?? v?.boolValue ?? null;
  }

  // ts = ISO timestamp from startTimeUnixNano (ns → ms → ISO)
  const ns = sp.startTimeUnixNano ? BigInt(sp.startTimeUnixNano) : 0n;
  const ts = new Date(Number(ns / 1_000_000n)).toISOString();

  // status: OTLP code 0=UNSET, 1=OK, 2=ERROR
  const code = sp.status?.code ?? 0;
  const status = code === 2 ? 'error' : code === 1 ? 'ok' : undefined;

  // kind + label
  if (name.startsWith('turn:') || name.startsWith('turn ')) {
    return { kind: 'turn', label: name.replace(/^turn:\s*/, '').trim() || name, ts, ...(status ? { status } : {}) };
  }
  const toolName = attrs['gen_ai.tool.name'] ?? attrs['host.tool.name'];
  if (toolName) {
    return { kind: 'tool', label: String(toolName), ts, ...(status ? { status } : {}) };
  }
  // Check if name looks like a tool call (e.g. "Bash", "Write", etc.)
  if (attrs['gen_ai.operation.name'] === 'execute_tool') {
    return { kind: 'tool', label: name, ts, ...(status ? { status } : {}) };
  }
  return { kind: 'other', label: name, ts, ...(status ? { status } : {}) };
}

/**
 * Map an OTLP span to a SessionTreeNode record (without children — caller threads the tree).
 * Keeps spanId and parentSpanId for tree construction; maps kind/label/status same as spanToAction.
 * SESSION root span (no parentSpanId) → kind 'session', parentSpanId absent.
 * @param {object} sp  raw OTLP span object
 * @returns {{ spanId: string, parentSpanId?: string, kind: string, label: string, ts: string, status?: string }}
 */
export function spanToNode(sp) {
  const name = sp.name ?? '';
  const attrs = {};
  for (const a of sp.attributes ?? []) {
    const v = a.value;
    attrs[a.key] = v?.stringValue ?? v?.intValue ?? v?.doubleValue ?? v?.boolValue ?? null;
  }
  const ns = sp.startTimeUnixNano ? BigInt(sp.startTimeUnixNano) : 0n;
  const ts = new Date(Number(ns / 1_000_000n)).toISOString();
  const code = sp.status?.code ?? 0;
  const status = code === 2 ? 'error' : code === 1 ? 'ok' : undefined;

  let kind;
  let label;
  if (!sp.parentSpanId) {
    kind = 'session';
    label = name;
  } else if (name.startsWith('turn:') || name.startsWith('turn ')) {
    kind = 'turn';
    label = name.replace(/^turn:\s*/, '').trim() || name;
  } else {
    const toolName = attrs['gen_ai.tool.name'] ?? attrs['host.tool.name'];
    if (toolName) {
      kind = 'tool';
      label = String(toolName);
    } else if (attrs['gen_ai.operation.name'] === 'execute_tool') {
      kind = 'tool';
      label = name;
    } else {
      kind = 'other';
      label = name;
    }
  }

  const node = { spanId: sp.spanId ?? '', kind, label, ts, ...(status ? { status } : {}) };
  if (sp.parentSpanId) node.parentSpanId = sp.parentSpanId;
  return node;
}
