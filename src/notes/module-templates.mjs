// src/notes/module-templates.mjs — the standard module manifest templates.
//
// what: one source of truth for the module TYPES' manifest definitions, plus a
//       mint helper. `zz init` seeds only the guardrails module from here; the
//       growth loop MINTS a module's `module.md` on first use from here.
// why:  no prebuilt modules — the four content modules ship empty and materialize
//       as the Project grows. A grown module needs a manifest to be enumerable
//       (notes/module.mjs `listModules` requires `module.md`), so the loop mints
//       one. The five module TYPES still exist as the standard kinds; we just stop
//       SHIPPING them prebuilt.
// how:  pure data + a fail-soft, idempotent mint. Zero-dep.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { serialize } from './note.mjs';
import { manifestPath } from './store.mjs';

/** The five us-owned module TYPES (the standard kinds). id → manifest fields. */
export const STANDARD_MODULES = {
  knowledge:    { title: 'Knowledge',    note_type: 'knowledge',   capabilities: ['query', 'check'],        goal: 'Capture durable, reusable facts about this project and its domain.' },
  memory:       { title: 'Memory',       note_type: 'episode',     capabilities: ['query', 'check'],        goal: 'Remember what happened — episodes, decisions, and their outcomes.' },
  actions:      { title: 'Actions',      note_type: 'action',      capabilities: ['query', 'check', 'act'], goal: 'Capture every repeated multi-step procedure as a runnable note.' },
  instructions: { title: 'Instructions', note_type: 'instruction', capabilities: ['query', 'check'],        goal: "Keep the agent's standing guidance current and minimal." },
  guardrails:   { title: 'Guardrails',   note_type: 'rule',        capabilities: ['check'],                 goal: 'Protect against repeated mistakes — as enforced tool gates.' },
};

/** The template (a standard type, or a generic fallback) for a module id. */
export function templateFor(id) {
  if (STANDARD_MODULES[id]) return { id, ...STANDARD_MODULES[id] };
  const title = id.charAt(0).toUpperCase() + id.slice(1);
  return { id, title, note_type: 'note', capabilities: ['query', 'check'], goal: `Notes for the ${id} module.` };
}

/** The serialized `module.md` manifest content for a module id. */
export function manifestFor(id) {
  const t = templateFor(id);
  return serialize({
    id: t.id, type: 'module', title: t.title, note_type: t.note_type,
    capabilities: t.capabilities, goal: t.goal,
  });
}

/**
 * Mint a module's manifest if it doesn't already have one. Idempotent and
 * STRUCTURAL — it creates the module's identity (like creating the folder); the
 * human gate still governs the module's ITEMS. Returns true iff it wrote one.
 */
export function ensureModuleManifest(home, id) {
  const path = manifestPath(home, id);
  if (existsSync(path)) return false;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, manifestFor(id));
  return true;
}
