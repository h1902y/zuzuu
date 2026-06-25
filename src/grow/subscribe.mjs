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
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parse, serialize } from '../notes/note.mjs';
import { stageChange } from './stage.mjs';

const itemsDirOf = (home, module) => join(home, module, 'items');
const manifestOf = (home, module) => join(home, module, 'module.md');

/** A deterministic content digest of a module's item notes (order-independent). */
export function contentDigest(items) {
  const h = createHash('sha256');
  for (const it of [...items].sort((a, b) => a.id.localeCompare(b.id))) h.update(it.id + '\0' + serialize(it.note));
  return 'sha256:' + h.digest('hex').slice(0, 16);
}

/** Read a module's item notes (parsed) from a home + their content digest. */
export function moduleContent(home, module) {
  const dir = itemsDirOf(home, module);
  const items = [];
  if (existsSync(dir)) {
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.md')).sort()) {
      const id = f.replace(/\.md$/, '');
      const { ok, note } = parse(readFileSync(join(dir, f), 'utf8'), { id });
      if (ok) items.push({ id, note });
    }
  }
  return { items, digest: contentDigest(items) };
}

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

/** Read a consuming project's `source:` pin for a module (null when not subscribed). */
export function readSourcePin(home, module) {
  const path = manifestOf(home, module);
  if (!existsSync(path)) return null;
  const { ok, note } = parse(readFileSync(path, 'utf8'), { id: module });
  return ok && note.source && typeof note.source === 'object' ? note.source : null;
}
