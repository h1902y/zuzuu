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
//
// B1(b) (audit 2026-07-03-secrets-review.md) — belt-and-suspenders atop the write
// door (grow/stage.mjs's secretStageRefusal + notes/validate.mjs's secretValueLeaks,
// both type:secret-scoped): `renderNoteDiff` masks any secret-SHAPED field's value
// regardless of the note's `type` — a value could ride a NON-secret change too (a
// stray `--field api_key=sk-…` on a `type: action` proposal, say), which the write
// door never inspects (it only refuses type:secret). Pure constant imports only
// (a regex + a string sentinel) — this file's "no IO, no write-path import" stays
// true; nothing here reads/writes/spawns.

import { SECRET_KEY_RE } from '../notes/validate.mjs';
import { REDACTED } from '../notes/log.mjs';

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
// B1(b): a secret-shaped KEY's value is never rendered, add/remove/modify alike —
// reuses log.mjs's own REDACTED sentinel, so a reviewer sees the SAME masked shape
// here as in runs.jsonl, not a second one to learn.
const displayValue = (key, val) => (SECRET_KEY_RE.test(key) ? REDACTED : v(val));

/** Render a diffNote result as terse text lines (for the CLI / review preview). */
export function renderNoteDiff(addr, d) {
  const head = { create: '+', delete: '-', update: '~', noop: '=' }[d.status];
  const lines = [`${head} ${d.status} ${addr}`];
  for (const f of d.fields) {
    if (f.change === 'add') lines.push(`    + ${f.key}: ${displayValue(f.key, f.after)}`);
    else if (f.change === 'remove') lines.push(`    - ${f.key}: ${displayValue(f.key, f.before)}`);
    else lines.push(`    ~ ${f.key}: ${displayValue(f.key, f.before)} → ${displayValue(f.key, f.after)}`);
  }
  if (d.bodyChanged) lines.push('    ~ body');
  return lines.join('\n');
}
