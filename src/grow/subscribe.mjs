// src/grow/subscribe.mjs — vendor a registry library module into a project, GATED.
//
// what: `zz subscribe <module>` reads a shared module from the active registry and
//       stages a `create` proposal for each of its item notes into the current
//       project, plus writes the module manifest carrying the `source:` vendor pin.
// why:  pull-first sharing — your personal house-style modules, pulled into any
//       project THROUGH the review gate. The items land only on `zz review` approve;
//       the merge IS the gate, even for your own module. Never a direct overwrite.
// how:  the pin records `{ registry, module, generation, sha, digest, mode }` — the
//       digest is a content hash of the vendored items (the drift signal, `zz check`).
//       The manifest write is structural (like a module mint); the ITEMS are gated.

import { join } from 'node:path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { parse, serialize } from '../notes/note.mjs';
import { stageChange } from './stage.mjs';
import { moduleContent } from '../notes/registry.mjs';

const manifestOf = (home, module) => join(home, module, 'module.md');

/** Write the consuming project's module manifest carrying the `source:` pin
 *  (structural). Seeds from the library manifest so title/fields carry over. */
function writePinnedManifest(currentHome, registryHome, module, source) {
  let manifest = { type: 'module', id: module, title: module };
  const libPath = manifestOf(registryHome, module);
  if (existsSync(libPath)) {
    const { ok, note } = parse(readFileSync(libPath, 'utf8'), { id: module });
    if (ok) manifest = note;
  }
  manifest.id = module;
  manifest.source = source;
  mkdirSync(join(currentHome, module), { recursive: true });
  writeFileSync(manifestOf(currentHome, module), serialize(manifest));
}

/**
 * Subscribe a library module into `currentHome`. Writes the source-pinned manifest,
 * then stages a `create` per library item. Returns `{ ok, module, staged, pin }`.
 * `mode: 'required'` is normalized to 'suggested' (required is Enterprise-gated).
 */
export function subscribeModule(currentHome, { registryHome, registryIdentity, module, generation = 0, sha = null, mode = 'suggested' }) {
  const { items, digest } = moduleContent(registryHome, module);
  if (!items.length) return { ok: false, error: `library module '${module}' has no items` };

  const pin = {
    registry: registryIdentity ?? null, module, generation, sha: sha ?? null, digest,
    mode: mode === 'required' ? 'suggested' : (mode || 'suggested'),
  };
  writePinnedManifest(currentHome, registryHome, module, pin); // structural — before staging, so the template mint won't clobber

  let staged = 0;
  for (const it of items) {
    const rec = stageChange(currentHome, module, {
      op: 'create', target: it.id, change: { ...it.note },
      rationale: `subscribed from registry ${registryIdentity}/${module}`,
    });
    if (rec) staged++;
  }
  return { ok: true, module, staged, pin };
}

// readSourcePin + moduleContent live in notes/registry.mjs (shared with use/check).
export { readSourcePin } from '../notes/registry.mjs';
