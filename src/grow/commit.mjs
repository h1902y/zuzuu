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
import { existsSync } from 'node:fs';
import { readNote, writeNote, removeNote } from '../notes/repo.mjs';
import { logMutation } from '../notes/log.mjs';
import { mint, expandRollback } from '../notes/generation.mjs';
import { itemPath, manifestPath } from '../notes/store.mjs';
import { readText, writeText, remove, mkdirp } from '../metal/fs.mjs';

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
// Exported so the dry-run preview (grow/plan) reads through the SAME resolver — one source
// of truth (a drifted copy once forgot `unrelate` and previewed the wrong note).
export const lookupId = (staged, change) => (staged.op === 'relate' || staged.op === 'unrelate') ? change?.from : (staged.target ?? change?.id ?? staged.id);

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
      // move = rename: write-new + remove-old, carrying the note's EXISTING bytes unchanged.
      // Skip validation — a move re-files bytes that were already valid when written; re-
      // validating against a since-stricter schema would refuse to RENAME a legacy note (a
      // pure relocation isn't a content change). merge/edit, which produce NEW content, ride
      // the normal `update` path below and DO validate.
      const note = readNote(home, op.module, op.from);
      if (!note) return { ok: false, error: `no note '${op.module}:${op.from}'` };
      const w = writeNote(home, op.module, op.target, note, { validate: false });
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

// ── surgical compensation: restore EXACTLY the files this transaction touched ──────
// (Was a blanket `git checkout HEAD` + `git clean -fdq` over the whole items dir — which
//  DELETED every UNTRACKED sibling note on any failure. Right after `zz init` the seeded
//  brain rules are on disk but NOT git-committed, so one rejected approve nuked them all,
//  losing the .zuzuu/ write-protection. Now revert is a per-file pre-image restore: a
//  validation failure that wrote nothing reverts nothing, and a real mid-batch failure
//  rolls back only the writes that happened — untracked siblings are never swept.)

// the note id(s) an op's WRITE touches — a `move` touches two (from + target); every
// other op touches the single note it reads/edits (the same resolver applyOp uses).
function touchedIds(op) {
  if (op.op === 'move') return [op.from, op.target];
  return [lookupId(op, op.change)];
}

// snapshot an op's target file(s) BEFORE it applies: { path, existed, bytes }. An unsafe
// id (itemPath throws) is skipped — applyOp refuses it, so there's nothing to restore.
function snapshot(home, op) {
  const snaps = [];
  for (const id of touchedIds(op)) {
    if (!id) continue;
    let path;
    try { path = itemPath(home, op.module, id); } catch { continue; }
    snaps.push({ path, existed: existsSync(path), bytes: existsSync(path) ? readText(path) : null });
  }
  return snaps;
}

// restore captured pre-images to their pre-transaction state, in REVERSE capture order
// (so a create-then-update of the same file unwinds cleanly back to "absent"): a file the
// transaction CREATED (existed:false) is removed; one it overwrote/deleted is rewritten.
function restore(snaps) {
  for (let i = snaps.length - 1; i >= 0; i--) {
    const { path, existed, bytes } = snaps[i];
    if (existed) writeText(path, bytes);
    else if (existsSync(path)) remove(path);
  }
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
  const captured = []; // pre-images of every file touched, in apply order (the surgical revert)
  const mark = (m) => { if (!dirty.includes(m)) dirty.push(m); };
  for (const op of batch) {
    mark(op.module);
    captured.push(...snapshot(home, op)); // capture the file's PRE-transaction bytes BEFORE applying
    const r = applyOp(home, op);
    if (!r.ok) {
      restore(captured); // all-or-nothing: undo ONLY the files this transaction wrote (no blanket clean)
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
  // ATOMICITY: capture the live manifest's pre-image and, if the batch FAILS, restore it
  // — otherwise a failed rollback would leave the gen-n schema on disk over the un-rolled
  // rows (a schema/rows mismatch). The manifest and the rows roll back together, or not at all.
  const p = manifestPath(home, module);
  const priorManifest = existsSync(p) ? readText(p) : null;
  if (ex.manifest != null) { mkdirp(dirname(p)); writeText(p, ex.manifest); }
  const res = commit(home, { actor }, ex.batch, { label: `rollback ${module} to gen ${n}`, mintedFrom: [`rollback:${n}`] });
  if (!res.ok) {
    if (ex.manifest != null) { if (priorManifest != null) writeText(p, priorManifest); else if (existsSync(p)) remove(p); }
    return { ok: false, error: res.error };
  }
  return { ok: true, module, n, newGeneration: res.generations.find((g) => g.module === module)?.n, restored: ex.restored, pruned: ex.pruned };
}
