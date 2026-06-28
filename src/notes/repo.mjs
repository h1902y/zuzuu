// src/notes/repo.mjs — the note repository: read/write/remove/list one note.
//
// what: the persistence ring for a single note. `readNote` (parse a note off disk +
//       inject its id), `writeNote` (validate → serialize → write, mkdir-ing the items
//       dir), `removeNote`, and `listNoteIds`. The one place a note becomes bytes and
//       bytes become a note.
// why:  three writers (evolve, refactor, plan) and four readers (check, index, gate,
//       evolve/refactor/plan) each open-coded the same `parse(readFileSync(itemPath…))`
//       and `writeFileSync(itemPath…, serialize…)`. Centralizing them gives one
//       persistence seam over the pure transform ring (note.mjs) — three clean rings
//       for a note: transform → persistence → (later) transaction/trust.
// how:  `note.mjs` stays PURE (no I/O); repo composes it with `store.mjs` (addressing)
//       and `metal/fs.mjs` (bytes). `itemPath`/`itemsDir` enforce the safe-segment
//       moat — an unsafe id THROWS here, so the caller (under its own try) refuses it.
//       Zero-dep, never `git init`s.

import { existsSync } from 'node:fs';
import { parse, serialize } from './note.mjs';
import { itemPath, itemsDir } from './store.mjs';
import { validateNote } from './validate.mjs';
import { readText, writeText, remove, list, mkdirp } from '../metal/fs.mjs';

/**
 * Read one note off disk, parsed and with its `id` injected. `null` when the id is
 * falsy or the file does not exist. An unsafe/`../` id makes `itemPath` THROW (the
 * moat) — that propagates so the caller decides (evolve lets it surface as a refusal;
 * plan catches it for a dry-run). The note is returned even if `parse` flagged
 * non-fatal issues — readers that need the strict `{ok}` verdict parse themselves.
 * @returns {object|null}
 */
export function readNote(home, module, id) {
  if (!id) return null;
  const path = itemPath(home, module, id);
  if (!existsSync(path)) return null;
  return parse(readText(path), { id }).note;
}

/**
 * Write one note: validate (by default), serialize, and write — creating the module's
 * items dir first. `{validate:false}` writes the bytes WITHOUT the schema check (the
 * raw path refactor uses; see grow/refactor.mjs). An unsafe id throws via `itemPath`.
 * @param {{validate?: boolean}} [opts]
 * @returns {{ok: boolean, error?: string}}
 */
export function writeNote(home, module, id, note, { validate = true } = {}) {
  if (validate) {
    const v = validateNote(note);
    if (!v.ok) return { ok: false, error: `invalid note '${module}:${id}': ${v.errors.join('; ')}` };
  }
  const path = itemPath(home, module, id);
  mkdirp(itemsDir(home, module));
  writeText(path, serialize(note));
  return { ok: true };
}

/** Remove one note's file. Throws on an unsafe id (itemPath) or a missing file (the
 *  caller guarantees existence — e.g. evolve's delete only fires for a present note). */
export function removeNote(home, module, id) {
  remove(itemPath(home, module, id));
}

/** The ids of every note in a module (the `.md` stems), or `[]` if the dir is absent. */
export function listNoteIds(home, module) {
  const dir = itemsDir(home, module);
  if (!existsSync(dir)) return [];
  return list(dir).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3));
}
