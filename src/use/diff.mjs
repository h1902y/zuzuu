// src/use/diff.mjs — the pure note diff (the foundational preview primitive).
//
// what: `diffNote` compares two envelopes (before ↔ after) into added/removed/
//       changed frontmatter + a body flag — the unit the review gate previews
//       ("what would this staged change do?"). Pure; no IO, no write-path import.
// why:  every "preview"/"plan"/"review context" surface needs a note diff; today
//       there is none. One pure primitive powers all of them.
//       (Generation-to-generation diff lives in notes/generation.mjs — it owns the
//       git/commit machinery; keeping it there keeps use/ off the write path.)
// how:  structural compare of the two frontmatter maps + a body equality flag.

const SKIP = new Set(['id', 'body']); // id is the filename; body diffed separately
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * Structured diff of two envelopes. Either side may be null (create / delete).
 * @returns {{ status:'create'|'update'|'delete'|'noop', fields:Array, bodyChanged:boolean }}
 */
export function diffNote(before, after) {
  const status = !before ? 'create' : !after ? 'delete' : 'update';
  const a = before ?? {};
  const b = after ?? {};
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => !SKIP.has(k)).sort();
  const fields = [];
  for (const k of keys) {
    const inA = k in a, inB = k in b;
    if (inA && !inB) fields.push({ key: k, change: 'remove', before: a[k] });
    else if (!inA && inB) fields.push({ key: k, change: 'add', after: b[k] });
    else if (!same(a[k], b[k])) fields.push({ key: k, change: 'modify', before: a[k], after: b[k] });
  }
  const bodyChanged = (a.body ?? '') !== (b.body ?? '');
  const noop = status === 'update' && !fields.length && !bodyChanged;
  return { status: noop ? 'noop' : status, fields, bodyChanged };
}

const v = (x) => (typeof x === 'object' ? JSON.stringify(x) : String(x));

/** Render a diffNote result as terse text lines (for the CLI / review preview). */
export function renderNoteDiff(addr, d) {
  const head = { create: '+', delete: '-', update: '~', noop: '=' }[d.status];
  const lines = [`${head} ${d.status} ${addr}`];
  for (const f of d.fields) {
    if (f.change === 'add') lines.push(`    + ${f.key}: ${v(f.after)}`);
    else if (f.change === 'remove') lines.push(`    - ${f.key}: ${v(f.before)}`);
    else lines.push(`    ~ ${f.key}: ${v(f.before)} → ${v(f.after)}`);
  }
  if (d.bodyChanged) lines.push('    ~ body');
  return lines.join('\n');
}
