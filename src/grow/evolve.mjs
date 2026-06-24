// src/grow/evolve.mjs — the loop's fourth beat: write + mint + log, as one.
//
// what: execute an approved proposal — the mechanical CRUD on the module's notes,
//       the mutation log entry, and the generation mint. The ONLY writer of the
//       Project's notes (called solely by review's gate; never a capability, never
//       agent-invokable — that's the moat).
// why:  the ontology names a four-beat loop — observe → propose → review → evolve.
//       `evolve` is the execution; `review` is the decision. They were tangled in
//       one file; this gives evolve its own home so each beat is one named thing.
// how:  one try around write→log→mint so a partial failure returns {ok:false}
//       (the note may be written, but no proposal is archived, so a retry is safe —
//       the writes are idempotent). Zero-dep, fail-soft.

import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { serialize, parse } from '../notes/note.mjs';
import { itemPath, itemsDir } from '../notes/store.mjs';
import { logMutation } from './log.mjs';
import { mint } from './snapshot.mjs';

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
 * Apply an approved proposal: mutate the notes, log it, mint a generation. Does NOT
 * archive the proposal — that's the gate's bookkeeping (review archives on success).
 * @returns {{ ok, op, note?, error? }}
 */
export function evolve(home, module, proposal, { edit = null } = {}) {
  const { op, id } = proposal;
  const change = edit ?? proposal.change;
  try {
    let note;
    if (op === 'create' || op === 'update') {
      const target = proposal.target ?? change.id ?? id;
      mkdirSync(itemsDir(home, module), { recursive: true });
      let body = change;
      if (op === 'update' && existsSync(itemPath(home, module, target))) {
        const cur = parse(readFileSync(itemPath(home, module, target), 'utf8'), { id: target }).note ?? {};
        body = mergeEdit(cur, change); // merge onto current — object fields merge one level, not replace wholesale
      }
      writeFileSync(itemPath(home, module, target), serialize(body));
      logMutation(home, module, op, target, { proposal: id });
      note = target;
    } else if (op === 'relate') {
      // change = { from, type, to } — add a typed relation to the `from` note
      const { from, type, to } = change;
      const path = itemPath(home, module, from);
      if (!existsSync(path)) return { ok: false, error: `relate: no note '${from}'` };
      const n = parse(readFileSync(path, 'utf8'), { id: from }).note;
      n.relations = n.relations ?? {};
      const cur = n.relations[type];
      n.relations[type] = cur ? [...new Set([].concat(cur, to))] : to;
      writeFileSync(path, serialize(n));
      logMutation(home, module, 'update', from, { proposal: id, relation: type });
      note = from;
    } else if (op === 'delete' || op === 'deprecate') {
      const target = proposal.target;
      const path = itemPath(home, module, target);
      if (!existsSync(path)) return { ok: false, error: `no note '${module}:${target}'` }; // no phantom log/mint
      if (op === 'delete') { rmSync(path); }
      else { // deprecate = flip status, keep the file
        const n = parse(readFileSync(path, 'utf8'), { id: target }).note;
        n.status = 'deprecated';
        writeFileSync(path, serialize(n));
      }
      logMutation(home, module, op, target, { proposal: id });
      note = target;
    } else {
      return { ok: false, error: `unknown op '${op}'` };
    }
    mint(home, module, { mintedFrom: [id] }); // snapshot the new state
    return { ok: true, op, note };
  } catch (e) {
    return { ok: false, error: e?.message ?? String(e) };
  }
}
