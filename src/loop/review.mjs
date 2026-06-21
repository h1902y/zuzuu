// src/loop/review.mjs — the human gate.
//
// what: apply or reject a proposal. Approving performs the mechanical CRUD on
//       the module's notes, logs the mutation, and mints a generation. Rejecting
//       archives it. This is the ONLY door to the brain.
// why:  the moat — the one defense against knowledge-poisoning that every
//       automated competitor lacks. No write happens without passing here.
// how:  approve = write/update/delete the note (notes/note) + log + snapshot;
//       reject = archive. The interactive ceremony is a thin CLI wrapper over
//       these pure data operations. Zero-dep, fail-soft.

import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { serialize, parse } from '../notes/note.mjs';
import { itemPath, itemsDir } from '../notes/store.mjs';
import { logMutation } from './log.mjs';
import { mint } from './snapshot.mjs';
import { readProposal, archiveProposal } from './propose.mjs';

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

/**
 * Apply an approved proposal: mutate the notes, log it, mint a generation.
 * @returns {{ ok, op, item?, error? }}
 */
export function approve(home, module, id, { edit = null } = {}) {
  const p = readProposal(home, module, id);
  if (!p) return { ok: false, error: `no proposal '${id}'` };
  const change = edit ?? p.change;

  try {
    if (p.op === 'create' || p.op === 'update') {
      const target = p.target ?? change.id ?? id;
      mkdirSync(itemsDir(home, module), { recursive: true });
      let item = change;
      if (p.op === 'update' && existsSync(itemPath(home, module, target))) {
        const cur = parse(readFileSync(itemPath(home, module, target), 'utf8'), { id: target }).item ?? {};
        item = mergeEdit(cur, change); // merge onto current — object fields merge one level, not replace wholesale
      }
      writeFileSync(itemPath(home, module, target), serialize(item));
      logMutation(home, module, p.op, target, { proposal: id });
    } else if (p.op === 'relate') {
      // change = { from, type, to } — add a typed relation to the `from` note
      const { from, type, to } = change;
      const path = itemPath(home, module, from);
      if (!existsSync(path)) return { ok: false, error: `relate: no note '${from}'` };
      const item = parse(readFileSync(path, 'utf8'), { id: from }).item;
      item.relations = item.relations ?? {};
      const cur = item.relations[type];
      item.relations[type] = cur ? [...new Set([].concat(cur, to))] : to;
      writeFileSync(path, serialize(item));
      logMutation(home, module, 'update', from, { proposal: id, relation: type });
    } else if (p.op === 'delete' || p.op === 'deprecate') {
      const target = p.target;
      const path = itemPath(home, module, target);
      if (!existsSync(path)) return { ok: false, error: `no note '${module}:${target}'` }; // no phantom log/mint
      if (p.op === 'delete') { rmSync(path); }
      else { // deprecate = flip status, keep the file
        const item = parse(readFileSync(path, 'utf8'), { id: target }).item;
        item.status = 'deprecated';
        writeFileSync(path, serialize(item));
      }
      logMutation(home, module, p.op === 'delete' ? 'delete' : 'deprecate', target, { proposal: id });
    } else {
      return { ok: false, error: `unknown op '${p.op}'` };
    }
  } catch (e) {
    return { ok: false, error: e?.message ?? String(e) };
  }

  mint(home, module, { mintedFrom: [id] }); // snapshot the new state
  archiveProposal(home, module, id, 'approved');
  return { ok: true, op: p.op, item: p.target ?? p.change?.id ?? id };
}

/** Reject a proposal — archive it, write nothing. */
export function reject(home, module, id, reason = '') {
  if (!readProposal(home, module, id)) return { ok: false, error: `no proposal '${id}'` };
  archiveProposal(home, module, id, 'rejected');
  return { ok: true, rejected: id, reason };
}
