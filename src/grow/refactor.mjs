// src/grow/refactor.mjs — graph-safe refactors (rename · merge · field-rewrite).
//
// what: multi-note edits that keep the link graph consistent — rename/move a note
//       and rewrite every inbound reference, merge two notes (re-pointing referrers),
//       or rewrite a frontmatter field across a module. The #1 note-graph gap: a
//       reorganizing edit must not leave broken-link debt.
// why:  single-note CRUD (evolve) can't do this — a rename touches the note AND all
//       its referrers (possibly across modules). Human-initiated (the operator runs
//       the command — that IS the gate, like editing a file directly).
// how:  each public refactor is split in two — a PURE expander (`expandRename`/
//       `expandMerge`/`expandRefactor`) that gathers backlinks and DECIDES the op batch
//       (write nothing), and a thin wrapper that feeds that batch to `commit` (grow/
//       commit) — the one write boundary. So refactor now lands through the VALIDATING
//       writer (it can no longer write a note validateNote would reject) and mints the
//       uniform one-generation-per-touched-module, like every other mutation. The
//       repoint logic stays here; only the writing left. Zero-dep, fail-soft.

import { existsSync } from 'node:fs';
import { itemPath, itemsDir } from '../notes/store.mjs';
import { readNote } from '../notes/repo.mjs';
import { backlinks } from '../notes/index.mjs';
import { list } from '../metal/fs.mjs';
import { commit } from './commit.mjs';

// rewrite every relation value pointing at `from` → `to` (both the full-addr and,
// for a same-module referrer, the bare-id form). Mutates `note` in place; returns true
// iff anything changed. (The note is a fresh parse from readNote, so mutating is safe.)
function repointRelations(note, fromFull, toFull, fromBare, toBare, sameModule) {
  const rels = note.relations;
  if (!rels || typeof rels !== 'object') return false;
  let changed = false;
  for (const [type, v] of Object.entries(rels)) {
    const arr = [].concat(v);
    const mapped = arr.map((x) => {
      if (x === fromFull) { changed = true; return toFull; }
      if (sameModule && x === fromBare) { changed = true; return toBare; }
      return x;
    });
    rels[type] = Array.isArray(v) ? mapped : mapped[0];
  }
  return changed;
}

// PURE: emit a cross-module `update` op for every inbound referrer of module:oldId
// whose relations need re-pointing to newId. The repointed (full) note rides as the op's
// `change`; commit's projectChange merges it onto the live note (same one-level merge —
// the rewritten relation values win). @returns {{ ops, refs }} — ops + count repointed.
function expandReferrers(home, module, oldId, newId) {
  const refs = backlinks(home, `${module}:${oldId}`);
  const ops = [];
  let count = 0;
  for (const { addr } of refs) {
    const [rm, rid] = addr.split(':');
    if (rm === module && rid === newId) continue; // don't rewrite the moved note pointing at itself
    const note = readNote(home, rm, rid);
    if (repointRelations(note, `${module}:${oldId}`, `${module}:${newId}`, oldId, newId, rm === module)) {
      ops.push({ module: rm, op: 'update', target: rid, change: note, log: { repoint: `${module}:${oldId}→${newId}` } });
      count++;
    }
  }
  return { ops, refs: count };
}

/** PURE: the op batch that renames/moves a note + repoints every inbound reference.
 *  @returns {{ ok, batch?, refs?, label?, error? }} */
export function expandRename(home, module, oldId, newId) {
  if (oldId === newId) return { ok: false, error: 'old and new id are the same' };
  if (!existsSync(itemPath(home, module, oldId))) return { ok: false, error: `no note '${module}:${oldId}'` };
  if (existsSync(itemPath(home, module, newId))) return { ok: false, error: `'${module}:${newId}' already exists` };
  // referrer repoints FIRST (in backlinks order), THEN the move — so the touched-module
  // order is [referrer modules…, moved module], matching the old mint-set order exactly.
  const { ops, refs } = expandReferrers(home, module, oldId, newId);
  ops.push({ module, op: 'move', from: oldId, target: newId });
  return { ok: true, batch: ops, refs, label: `rename ${module}:${oldId}→${newId}` };
}

/** PURE: the op batch that merges `src` into `dst` (append body, union relations,
 *  delete src) and re-points every inbound reference of src → dst.
 *  @returns {{ ok, batch?, refs?, label?, error? }} */
export function expandMerge(home, module, srcId, dstId) {
  if (srcId === dstId) return { ok: false, error: 'source and destination are the same' };
  if (!existsSync(itemPath(home, module, srcId))) return { ok: false, error: `no note '${module}:${srcId}'` };
  if (!existsSync(itemPath(home, module, dstId))) return { ok: false, error: `no note '${module}:${dstId}'` };
  const src = readNote(home, module, srcId);
  const dst = readNote(home, module, dstId);
  dst.body = [dst.body, src.body].filter((s) => s && s.trim()).join('\n\n');
  for (const [type, v] of Object.entries(src.relations ?? {})) { // union src's edges into dst
    dst.relations = dst.relations ?? {};
    dst.relations[type] = [...new Set([].concat(dst.relations[type] ?? [], v))].filter(Boolean);
    if (dst.relations[type].length === 1) dst.relations[type] = dst.relations[type][0];
  }
  const { ops, refs } = expandReferrers(home, module, srcId, dstId);
  ops.push({ module, op: 'update', target: dstId, change: dst, log: { merge: `from ${srcId}` } });
  ops.push({ module, op: 'delete', target: srcId, log: { merge: `into ${dstId}` } });
  return { ok: true, batch: ops, refs, label: `merge ${module}:${srcId}→${dstId}` };
}

/** PURE: the op batch that rewrites a frontmatter field value across a module's notes.
 *  @returns {{ ok, batch?, changed?, label?, error? }} */
export function expandRefactor(home, module, key, fromVal, toVal) {
  const dir = itemsDir(home, module);
  if (!existsSync(dir)) return { ok: false, error: `no module '${module}'` };
  const ops = [];
  for (const f of list(dir)) {
    if (!f.endsWith('.md')) continue;
    const id = f.slice(0, -3);
    const note = readNote(home, module, id);
    if (String(note[key]) !== String(fromVal)) continue;
    ops.push({ module, op: 'update', target: id, change: { [key]: toVal }, log: { refactor: `${key}: ${fromVal}→${toVal}` } });
  }
  return { ok: true, batch: ops, changed: ops.length, label: `refactor ${module}.${key} ${fromVal}→${toVal}` };
}

/**
 * Rename/move a note and rewrite every inbound reference. @returns {{ok, renamed?, refs?, generations?, error?}}
 */
export function renameNote(home, module, oldId, newId, actor = 'operator') {
  const ex = expandRename(home, module, oldId, newId);
  if (!ex.ok) return ex;
  const res = commit(home, { actor }, ex.batch, { label: ex.label, mintedFrom: [ex.label] });
  if (!res.ok) return { ok: false, error: res.error, refused: res.refused };
  return { ok: true, renamed: `${module}:${oldId}→${newId}`, refs: ex.refs, generations: res.generations };
}

/**
 * Merge `src` into `dst`: append src's body, union its relations, delete src, and
 * re-point every inbound reference of src → dst. @returns {{ok, merged?, refs?, generations?, error?}}
 */
export function mergeNotes(home, module, srcId, dstId, actor = 'operator') {
  const ex = expandMerge(home, module, srcId, dstId);
  if (!ex.ok) return ex;
  const res = commit(home, { actor }, ex.batch, { label: ex.label, mintedFrom: [ex.label] });
  if (!res.ok) return { ok: false, error: res.error, refused: res.refused };
  return { ok: true, merged: `${module}:${srcId}→${dstId}`, refs: ex.refs, generations: res.generations };
}

/**
 * Rewrite a frontmatter field value across a module's notes (e.g. type rule→guardrail).
 * Routes through commit now, so a rewrite that would produce an INVALID note is refused
 * (all-or-nothing) rather than landed — the one intentional behavior change of Rung 5.
 * @returns {{ok, field?, changed?, generations?, error?}}
 */
export function refactorField(home, module, key, fromVal, toVal, actor = 'operator') {
  const ex = expandRefactor(home, module, key, fromVal, toVal);
  if (!ex.ok) return ex;
  if (!ex.batch.length) return { ok: true, field: key, changed: 0, generations: [] };
  const res = commit(home, { actor }, ex.batch, { label: ex.label, mintedFrom: [ex.label] });
  if (!res.ok) return { ok: false, error: res.error, refused: res.refused };
  return { ok: true, field: key, changed: ex.changed, generations: res.generations };
}
