// src/grow/refactor.mjs — graph-safe refactors (rename · merge · field-rewrite).
//
// what: multi-note edits that keep the link graph consistent — rename/move a note
//       and rewrite every inbound reference, merge two notes (re-pointing referrers),
//       or rewrite a frontmatter field across a module. The #1 note-graph gap: a
//       reorganizing edit must not leave broken-link debt.
// why:  single-note CRUD (evolve) can't do this — a rename touches the note AND all
//       its referrers (possibly across modules). Human-initiated (the operator runs
//       the command — that IS the gate, like editing a file directly); each refactor
//       lands as ONE generation per touched module. Uses the inbound backlink index.
// how:  gather referrers BEFORE moving (the index is fresh), rewrite each referrer's
//       relation values, then mint a generation per touched module. Zero-dep, fail-soft.

import { existsSync, readFileSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { parse, serialize } from '../notes/note.mjs';
import { itemPath, itemsDir } from '../notes/store.mjs';
import { backlinks } from '../notes/index.mjs';
import { logMutation } from '../notes/log.mjs';
import { mint } from '../notes/generation.mjs';

const readNote = (home, module, id) => parse(readFileSync(itemPath(home, module, id), 'utf8'), { id }).note;

// rewrite every relation value pointing at `from` → `to` (both the full-addr and,
// for a same-module referrer, the bare-id form). Returns true iff anything changed.
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

// rewrite all inbound referrers of module:oldId → newId/newAddr.
// @returns {{ modules:Set<string>, count:number }} — touched modules + referrers updated.
function repointReferrers(home, module, oldId, newId) {
  const refs = backlinks(home, `${module}:${oldId}`);
  const modules = new Set();
  let count = 0;
  for (const { addr } of refs) {
    const [rm, rid] = addr.split(':');
    if (rm === module && rid === newId) continue; // don't rewrite the moved note pointing at itself
    const note = readNote(home, rm, rid);
    if (repointRelations(note, `${module}:${oldId}`, `${module}:${newId}`, oldId, newId, rm === module)) {
      writeFileSync(itemPath(home, rm, rid), serialize(note));
      logMutation(home, rm, 'update', rid, { repoint: `${module}:${oldId}→${newId}` });
      modules.add(rm);
      count++;
    }
  }
  return { modules, count };
}

const mintAll = (home, modules, label) =>
  [...modules].map((m) => ({ module: m, n: mint(home, m, { mintedFrom: [label], label }).n }));

/**
 * Rename/move a note and rewrite every inbound reference. @returns {{ok, renamed?, refs?, generations?, error?}}
 */
export function renameNote(home, module, oldId, newId) {
  if (oldId === newId) return { ok: false, error: 'old and new id are the same' };
  if (!existsSync(itemPath(home, module, oldId))) return { ok: false, error: `no note '${module}:${oldId}'` };
  if (existsSync(itemPath(home, module, newId))) return { ok: false, error: `'${module}:${newId}' already exists` };
  try {
    const { modules, count } = repointReferrers(home, module, oldId, newId);
    writeFileSync(itemPath(home, module, newId), serialize(readNote(home, module, oldId)));
    rmSync(itemPath(home, module, oldId));
    logMutation(home, module, 'create', newId, { rename: `from ${oldId}` });
    logMutation(home, module, 'delete', oldId, { rename: `to ${newId}` });
    modules.add(module);
    return { ok: true, renamed: `${module}:${oldId}→${newId}`, refs: count, generations: mintAll(home, modules, `rename ${module}:${oldId}→${newId}`) };
  } catch (e) { return { ok: false, error: e?.message ?? String(e) }; }
}

/**
 * Merge `src` into `dst`: append src's body, union its relations, delete src, and
 * re-point every inbound reference of src → dst. @returns {{ok, merged?, refs?, generations?, error?}}
 */
export function mergeNotes(home, module, srcId, dstId) {
  if (srcId === dstId) return { ok: false, error: 'source and destination are the same' };
  if (!existsSync(itemPath(home, module, srcId))) return { ok: false, error: `no note '${module}:${srcId}'` };
  if (!existsSync(itemPath(home, module, dstId))) return { ok: false, error: `no note '${module}:${dstId}'` };
  try {
    const src = readNote(home, module, srcId);
    const dst = readNote(home, module, dstId);
    dst.body = [dst.body, src.body].filter((s) => s && s.trim()).join('\n\n');
    for (const [type, v] of Object.entries(src.relations ?? {})) { // union src's edges into dst
      dst.relations = dst.relations ?? {};
      dst.relations[type] = [...new Set([].concat(dst.relations[type] ?? [], v))].filter(Boolean);
      if (dst.relations[type].length === 1) dst.relations[type] = dst.relations[type][0];
    }
    writeFileSync(itemPath(home, module, dstId), serialize(dst));
    const { modules, count } = repointReferrers(home, module, srcId, dstId);
    rmSync(itemPath(home, module, srcId));
    logMutation(home, module, 'update', dstId, { merge: `from ${srcId}` });
    logMutation(home, module, 'delete', srcId, { merge: `into ${dstId}` });
    modules.add(module);
    return { ok: true, merged: `${module}:${srcId}→${dstId}`, refs: count, generations: mintAll(home, modules, `merge ${module}:${srcId}→${dstId}`) };
  } catch (e) { return { ok: false, error: e?.message ?? String(e) }; }
}

/**
 * Rewrite a frontmatter field value across a module's notes (e.g. type rule→guardrail).
 * @returns {{ok, field?, changed?, generations?, error?}}
 */
export function refactorField(home, module, key, fromVal, toVal) {
  const dir = itemsDir(home, module);
  if (!existsSync(dir)) return { ok: false, error: `no module '${module}'` };
  try {
    let changed = 0;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.md')) continue;
      const id = f.slice(0, -3);
      const note = readNote(home, module, id);
      if (String(note[key]) !== String(fromVal)) continue;
      note[key] = toVal;
      writeFileSync(itemPath(home, module, id), serialize(note));
      logMutation(home, module, 'update', id, { refactor: `${key}: ${fromVal}→${toVal}` });
      changed++;
    }
    const generations = changed ? mintAll(home, new Set([module]), `refactor ${module}.${key} ${fromVal}→${toVal}`) : [];
    return { ok: true, field: key, changed, generations };
  } catch (e) { return { ok: false, error: e?.message ?? String(e) }; }
}
