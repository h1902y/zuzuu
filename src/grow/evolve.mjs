// src/grow/evolve.mjs — the loop's fourth beat: write + log (+ mint), the CRUD.
//
// what: execute an approved staged change — the mechanical CRUD on a module's
//       notes + the mutation-log entry. The ONLY writer of the Project's notes
//       (called by review's gate or the plan apply; never agent-invokable — the moat).
// why:  split into three so a plan can apply a BATCH as one generation:
//       `projectChange` (pure — what the change becomes, for diff/preview),
//       `applyChange` (write+log, NO mint), and `evolve` (applyChange + one mint,
//       the single-change path). Keeping write separable from mint is what lets
//       N approved changes commit as ONE generation.
// how:  one try around the write so a partial failure returns {ok:false} (no
//       proposal archived → a retry is safe; writes are idempotent). Zero-dep.

import { readNote, writeNote, removeNote } from '../notes/repo.mjs';
import { logMutation } from '../notes/log.mjs';
import { mint } from '../notes/generation.mjs';

const isPlainObject = (x) => x != null && typeof x === 'object' && !Array.isArray(x);

// Merge an update's `change` onto the current note. An object-valued field merges
// ONE level (so `change:{relations:{about:'z'}}` keeps `relations.uses`), instead
// of a shallow `{...cur,...change}` that would silently drop the field's siblings.
function mergeEdit(cur, change) {
  const out = { ...cur };
  for (const [k, v] of Object.entries(change)) {
    out[k] = isPlainObject(cur[k]) && isPlainObject(v) ? { ...cur[k], ...v } : v;
  }
  return out;
}

// `repo.readNote` reads the current note (id-guarded, missing→null) and deliberately
// lets itemPath's segment guard THROW on an unsafe/`../` id — that propagates to
// applyChange's try → {ok:false, error:'unsafe id …'} (the moat's explicit refusal),
// rather than masking it as a generic "no note".

// the note a change reads/edits: relate edits the `from` note; the rest, the target.
const lookupId = (staged, change) => staged.op === 'relate' ? change?.from : (staged.target ?? change?.id ?? staged.id);

/**
 * PURE: project a staged change onto the current note. `after === null` means the
 * note is removed (delete). `error` set = the change can't apply (missing note, etc.).
 * @returns {{ target, after?, error? }}
 */
export function projectChange(staged, current, edit = null) {
  const change = edit ?? staged.change ?? {};
  // Provenance (U6 / R6): a staged change carries a `source` pointer (where it was
  // born — the session ids observe mined it from). Carry it onto the LANDED note's
  // frontmatter so a note links back to its origin ("born here"). Only on a create/
  // update from the original proposal (not a hand-supplied `edit`, which is a human
  // re-write with its own provenance); the note parser round-trips the nested object
  // and validateNote tolerates it (unknown keys preserved).
  const withSource = (after) => (!edit && staged.source && after && after.source === undefined ? { ...after, source: staged.source } : after);
  switch (staged.op) {
    case 'create': return { target: staged.target ?? change.id ?? staged.id, after: withSource({ ...change }) };
    case 'update': {
      const target = staged.target ?? change.id ?? staged.id;
      return { target, after: withSource(current ? mergeEdit(current, change) : { ...change }) };
    }
    case 'relate': {
      const { from, type, to } = change;
      if (!current) return { target: from, error: `relate: no note '${from}'` };
      const rel = current.relations?.[type];
      return { target: from, after: { ...current, relations: { ...(current.relations ?? {}), [type]: rel ? [...new Set([].concat(rel, to))] : to } } };
    }
    case 'delete':
      return current ? { target: staged.target, after: null } : { target: staged.target, error: `no note '${staged.target}'` };
    case 'deprecate':
      return current ? { target: staged.target, after: { ...current, status: 'deprecated' } } : { target: staged.target, error: `no note '${staged.target}'` };
    default: return { target: staged.target, error: `unknown op '${staged.op}'` };
  }
}

/**
 * Apply ONE staged change: write/delete the note + log the mutation. Does NOT mint
 * (so a batch can mint once). @returns {{ ok, op, note?, error? }}
 */
export function applyChange(home, module, staged, { edit = null } = {}) {
  const change = edit ?? staged.change;
  // ONE try around read→project→write so any failure (incl. an unsafe-segment throw
  // from itemPath) returns {ok:false} rather than escaping — the moat stays closed.
  try {
    const current = readNote(home, module, lookupId(staged, change));
    const { target, after, error } = projectChange(staged, current, edit);
    if (error) return { ok: false, error };
    // repo.writeNote validates BEFORE the write (the moat's schema gate) and returns
    // {ok:false} for a malformed note — same refusal evolve made inline before.
    if (after === null) removeNote(home, module, target);
    else { const w = writeNote(home, module, target, after); if (!w.ok) return { ok: false, error: w.error }; }
    const logOp = staged.op === 'relate' ? 'update' : staged.op;
    logMutation(home, module, logOp, target, { proposal: staged.id, ...(staged.op === 'relate' ? { relation: change.type } : {}) });
    return { ok: true, op: staged.op, note: target };
  } catch (e) {
    return { ok: false, error: e?.message ?? String(e) };
  }
}

/**
 * Apply an approved staged change AND mint a generation — the single-change path
 * (review.approve). A batch uses applyChange + one mint via grow/plan.
 * @returns {{ ok, op, note?, error? }}
 */
export function evolve(home, module, staged, opts = {}) {
  const r = applyChange(home, module, staged, opts);
  if (!r.ok) return r;
  mint(home, module, { mintedFrom: [staged.id], label: `${r.op} ${module}:${r.note}` });
  return r;
}
