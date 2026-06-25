// src/notes/module.mjs — a module: a goal-shaped collection of notes.
//
// what: read a module's manifest (`module.md` — the same envelope as a note) and
//       list the modules in a Project. A module is generic; it differs from
//       another only by its manifest (note_type · goal · policy · which
//       capabilities are on).
// why:  ONE declaration surface. A module declares everything about itself in
//       its manifest frontmatter — no per-module code, no parallel registries.
// how:  parse module.md with notes/note; derive the capability set from the
//       manifest (+ sensible defaults). Zero-dep, fail-soft.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { parse } from './note.mjs';
import { homeDir, manifestPath } from './store.mjs';

// Capabilities every module has (reading + integrity are universal).
const UNIVERSAL = ['query', 'check'];

/**
 * Read a module's manifest. Fail-soft: a missing/broken manifest yields a
 * minimal default (id only), never throws.
 * @returns {{ id, title, note_type, goal, policy, capabilities, fields }}
 */
export function readManifest(home, module) {
  const path = manifestPath(home, module);
  const fallback = { id: module, title: module, note_type: null, goal: null, policy: null, capabilities: UNIVERSAL.slice(), fields: [] };
  if (!existsSync(path)) return fallback;
  const { ok, note } = parse(readFileSync(path, 'utf8'), { id: module });
  if (!ok || !note) return { ...fallback, manifestError: 'unparseable module.md' };
  return {
    id: note.id ?? module,
    title: note.title ?? module,
    note_type: note.note_type ?? null,
    // the module's goal (was nested under the cut `enhance` verb — read both forms)
    goal: note.goal ?? note.enhance?.goal ?? null,
    policy: note.policy ?? null,
    capabilities: capabilitiesOf(note),
    // the optional typed-column schema (KTD5): absent ⇒ [] (schemaless cards);
    // present ⇒ a typed table. Tolerant — the parser holds it round-trip-exact.
    fields: Array.isArray(note.fields) ? note.fields : [],
  };
}

/**
 * The capability set a module exposes. Explicit `capabilities` in the manifest
 * wins; otherwise derive from the module's nature (a policy → `act`), always
 * including the universal read/check.
 */
export function capabilitiesOf(manifest) {
  if (Array.isArray(manifest.capabilities) && manifest.capabilities.length) {
    return [...new Set([...UNIVERSAL, ...manifest.capabilities])];
  }
  const caps = new Set(UNIVERSAL);
  if (manifest.policy) caps.add('act');
  return [...caps];
}

/** List the modules in a project (dirs holding a `module.md`), with manifests. */
export function listModules(home = homeDir()) {
  if (!existsSync(home)) return [];
  return readdirSync(home, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.') && existsSync(manifestPath(home, e.name)))
    .map((e) => readManifest(home, e.name));
}

/** Does this module expose `capability`? */
export function moduleHas(home, module, capability) {
  return readManifest(home, module).capabilities.includes(capability);
}
