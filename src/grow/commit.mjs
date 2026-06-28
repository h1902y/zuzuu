// src/grow/commit.mjs — the ONE write boundary: the sole writer + sole minter.
//
// what: `commit(home, {actor}, batch, {label, mintedFrom})` — the single primitive
//       through which EVERY durable note mutation flows. A `batch` is a list of
//       normalized ops (a single change is a batch of one); commit writes them as ONE
//       transaction and mints ONE generation per touched module. `rollback` rides the
//       same primitive (restore-as-forward-motion is just a batch).
// why:  before this there were TWO note-writers with divergent invariants — `evolve`
//       (validated, logged, minted) and `refactor` (RAW writes, no validate) — and
//       minting was reimplemented four times. That split is exactly what a knowledge-
//       poisoning attacker would exploit: a writer that skips the schema gate. Collapsing
//       to ONE writer makes the moat STRUCTURAL, not a comment: there is one door, it
//       validates, it logs, it mints, and it is the only thing that touches the notes.
//       (The agent reaches the door only through `review` — the human gate — never here.)
// how:  per op, `projectChange` (the pure op→note projection, lifted verbatim from the
//       old evolve) → `repo.writeNote` (which VALIDATES) / `repo.removeNote` → log the
//       mutation. ALL-OR-NOTHING: on any mid-batch failure, the items tree of every
//       touched module is reverted to HEAD via git (notes are pure data, so `git
//       restore` IS the compensation), then we bail — no partial writes. Only after
//       every write succeeds do we mint: one transaction = one generation per module.
//       Zero-dep. The expanders (grow/refactor, notes/generation's expandRollback)
//       DECIDE what changes — pure functions emitting ops; commit decides HOW it lands.

import { dirname } from 'node:path';
import { readNote, writeNote, removeNote } from '../notes/repo.mjs';
import { logMutation } from '../notes/log.mjs';
import { mint, expandRollback } from '../notes/generation.mjs';
import { manifestPath } from '../notes/store.mjs';
import { writeText, mkdirp } from '../metal/fs.mjs';
import { git } from '../metal/git.mjs';

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

// the note a change reads/edits: relate/unrelate edit the `from` note; the rest, the target.
const lookupId = (staged, change) => (staged.op === 'relate' || staged.op === 'unrelate') ? change?.from : (staged.target ?? change?.id ?? staged.id);

/**
 * PURE: project a staged change onto the current note. `after === null` means the
 * note is removed (delete). `error` set = the change can't apply (missing note, etc.).
 * Lifted verbatim from the old grow/evolve.mjs — the single op→note projection both
 * the live write path and the dry-run preview (grow/plan.planFor) share.
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
    case 'unrelate': {
      // the inverse of relate: prune `to` from relations[type]. Drop the key when it
      // empties, and drop `relations` entirely when its last edge goes — so a relate
      // then unrelate round-trips to the original bytes (no orphaned empty block).
      const { from, type, to } = change;
      if (!current) return { target: from, error: `unrelate: no note '${from}'` };
      const rel = current.relations?.[type];
      const remaining = rel == null ? [] : [].concat(rel).filter((x) => x !== to);
      const relations = { ...(current.relations ?? {}) };
      if (remaining.length) relations[type] = remaining.length === 1 ? remaining[0] : remaining; // collapse a singleton back to a scalar (mirror relate's shape)
      else delete relations[type];
      const after = { ...current };
      if (Object.keys(relations).length) after.relations = relations; else delete after.relations;
      return { target: from, after };
    }
    case 'delete':
      return current ? { target: staged.target, after: null } : { target: staged.target, error: `no note '${staged.target}'` };
    case 'deprecate':
      return current ? { target: staged.target, after: { ...current, status: 'deprecated' } } : { target: staged.target, error: `no note '${staged.target}'` };
    default: return { target: staged.target, error: `unknown op '${staged.op}'` };
  }
}

/**
 * Apply ONE normalized op: write/delete the note + log the mutation. The mint-less
 * inner phase of `commit` (so a batch mints once). NOT exported — there is no public
 * write that skips the transaction. An op is `{ module, op, target, change?, id?,
 * source?, log? }`; the `move` kind also carries `from`. `op.log` overrides the
 * mutation-log extra (the expanders stamp `{repoint|rename|merge|refactor|rollback}`);
 * the default carries the staged proposal id. @returns {{ ok, op?, note?, error? }}
 */
function applyOp(home, op) {
  // ONE try around read→project→write so any failure (incl. an unsafe-segment throw
  // from itemPath) returns {ok:false} rather than escaping — the moat stays closed.
  try {
    if (op.op === 'move') {
      // move = rename: write-new (VALIDATED) + remove-old, carrying the note's bytes.
      const note = readNote(home, op.module, op.from);
      if (!note) return { ok: false, error: `no note '${op.module}:${op.from}'` };
      const w = writeNote(home, op.module, op.target, note);
      if (!w.ok) return { ok: false, error: w.error };
      removeNote(home, op.module, op.from);
      logMutation(home, op.module, 'create', op.target, op.log ?? { rename: `from ${op.from}` });
      logMutation(home, op.module, 'delete', op.from, { rename: `to ${op.target}` });
      return { ok: true, op: 'move', note: op.target };
    }
    const current = readNote(home, op.module, lookupId(op, op.change));
    const { target, after, error } = projectChange(op, current);
    if (error) return { ok: false, error };
    // repo.writeNote validates BEFORE the write (the moat's schema gate) and returns
    // {ok:false} for a malformed note — refactor now lands through here too, so a
    // field-rewrite can no longer write a note validateNote would reject (Rung 5).
    if (after === null) removeNote(home, op.module, target);
    else { const w = writeNote(home, op.module, target, after); if (!w.ok) return { ok: false, error: w.error }; }
    const isRel = op.op === 'relate' || op.op === 'unrelate';
    const kind = isRel ? 'update' : op.op; // an (un)relate edits the `from` note → logged as an update
    logMutation(home, op.module, kind, target, op.log ?? { proposal: op.id, ...(isRel ? { relation: op.change?.type } : {}) });
    return { ok: true, op: op.op, note: target };
  } catch (e) {
    return { ok: false, error: e?.message ?? String(e) };
  }
}

// revert the module's items to the last committed generation (HEAD) — git IS the
// compensation for note CRUD (pure data, no external side effects). Best-effort: the
// metal git() result is ignored (a fresh, never-committed module has nothing at HEAD;
// `clean` then sweeps the uncommitted attempt).
function revert(home, module) {
  const root = dirname(home);
  git(['checkout', 'HEAD', '--', `.zuzuu/${module}/items`], root);
  git(['clean', '-fdq', '--', `.zuzuu/${module}/items`], root);
}

/**
 * THE write boundary. Apply `batch` as one all-or-nothing transaction, then mint one
 * generation per touched module (in first-touch order). On any mid-batch failure every
 * touched module is reverted and we return `{ok:false, reverted:true}` — no partial
 * writes, no mint.
 *
 * @param {string} home
 * @param {{actor?: string}} ctx
 * @param {Array} batch  normalized ops `{ module, op, target, change?, from?, id?, source?, log? }`
 * @param {{label?: string|null, mintedFrom?: string[]|null}} opts
 * @returns {{ ok, results?, generations?, error?, reverted? }}
 */
export function commit(home, { actor = 'operator' } = {}, batch = [], { label = null, mintedFrom = null } = {}) {
  // THE MOAT (Rung 8): writing is operator-only. `actor` is stamped at the entry boundary
  // (CLI = operator, host hook = agent) and threaded here UNCHANGED — never read from
  // agent-controllable input. A non-operator commit is REFUSED before any write or mint:
  // the agent's sanctioned channel is observe → stage → review, where a human operator
  // approves. This is the IN-PROCESS guarantee — it closes every code path where agent
  // context reaches the sole writer. It does NOT by itself stop the agent shelling
  // `zz <writeverb>` via Bash (that fresh process is stamped operator); the Bash path is
  // closed by the guardrails execution gate (Rung 9, protect-brain-writes-shell). The
  // default stays 'operator' (fail-open compat — every existing caller is an operator).
  if (actor !== 'operator') {
    return { ok: false, error: 'write requires an operator (the agent proposes via stage→review)', refused: true };
  }
  const results = [];
  const dirty = []; // modules written this transaction, first-touch order (= the mint set)
  const mark = (m) => { if (!dirty.includes(m)) dirty.push(m); };
  for (const op of batch) {
    mark(op.module);
    const r = applyOp(home, op);
    if (!r.ok) {
      for (const m of dirty) revert(home, m); // all-or-nothing: undo every touched module
      return { ok: false, error: `commit failed on ${op.id ?? op.op}: ${r.error}`, reverted: true };
    }
    results.push(r);
  }
  // sole minter: one transaction = one generation per touched module, AFTER all writes.
  const from = mintedFrom ?? batch.map((o) => o.id).filter(Boolean);
  const generations = dirty.map((m) => ({ module: m, n: mint(home, m, { mintedFrom: from, label: label ?? `evolve ${m}` }).n }));
  return { ok: true, results, generations };
}

/**
 * Roll a module back to generation `n`: restore its items to that generation's pinned
 * state and prune anything added since — as FORWARD motion (a new generation, never a
 * `git revert`). The expander (`expandRollback`, in notes/generation) reads the gen-N
 * tree and RETURNS an op batch; commit writes it atomically + mints the new generation.
 * Lives here (not in notes/generation) so the Data layer never imports the write
 * boundary — the import graph stays acyclic. @returns {{ ok, module?, n?, newGeneration?, restored?, pruned?, error? }}
 */
export function rollback(home, module, n, actor = 'operator') {
  // a rollback IS a write — refuse a non-operator up front (before the manifest restore),
  // so the moat holds for this path too, not only the note batch commit below.
  if (actor !== 'operator') {
    return { ok: false, error: 'write requires an operator (the agent proposes via stage→review)', refused: true };
  }
  const ex = expandRollback(home, module, n);
  if (!ex.ok) return ex;
  // restore the manifest (its `fields` schema) to the gen-n bytes BEFORE the commit, so
  // the new generation pins it too — a schema alter is rollback-able like any row change.
  // The manifest is NOT a note, so it doesn't ride the note batch; it's a plain write
  // (the same door init/propose/schema use), gated by the operator-initiated rollback.
  if (ex.manifest != null) { const p = manifestPath(home, module); mkdirp(dirname(p)); writeText(p, ex.manifest); }
  const res = commit(home, { actor }, ex.batch, { label: `rollback ${module} to gen ${n}`, mintedFrom: [`rollback:${n}`] });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, module, n, newGeneration: res.generations.find((g) => g.module === module)?.n, restored: ex.restored, pruned: ex.pruned };
}
