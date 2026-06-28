// src/notes/module-templates.mjs — the standard module manifest templates.
//
// what: one source of truth for the module TYPES' manifest definitions, plus a
//       mint helper. `zz init` seeds only the instructions module from here (the
//       safety floor + best-practice guidance); the growth loop MINTS a module's
//       `module.md` on first use from here.
// why:  no prebuilt content modules — they ship empty and materialize
//       as the Project grows. A grown module needs a manifest to be enumerable
//       (notes/module.mjs `listModules` requires `module.md`), so the loop mints
//       one. The five module TYPES still exist as the standard kinds; we just stop
//       SHIPPING them prebuilt.
// how:  pure data + a fail-soft, idempotent mint. Zero-dep.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { serialize } from './note.mjs';
import { manifestPath } from './store.mjs';

// The rule gate-verb options — the closed set a `select` column validates against (the
// same deny>ask>allow severity the guardrails gate enforces).
const RULE_ACTIONS = ['deny', 'ask', 'allow'];

// Typed-column SCHEMAS for the standard kinds (a module is a TABLE; these are its
// columns). Derived from the SHAPE `zz init` actually seeds (src/cli/init.mjs) + what
// `observe` routes, so every seeded/grown note COMPLIES — `required:true` only where a
// field is genuinely always present. knowledge/memory/actions ship SCHEMALESS (no
// `fields`): their notes are free-form, so an enforced schema would only get in the way.
//
//   instructions — holds BOTH `rule` notes (the safety floor) and `instruction` notes
//     (guidance). Only `title` is universal; `action` (the gate verb) is a select that
//     instructions simply omit, so it's optional. The rest are the rule's columns.
//   guardrails — holds ONLY rules; its schema mirrors the rule invariant exactly
//     (action ∈ deny|ask|allow + a pattern, both required), so it adds typed columns
//     without rejecting anything the per-type check already accepts.
const SCHEMAS = {
  instructions: [
    { name: 'title', type: 'text', required: true },
    { name: 'body', type: 'longtext' },
    { name: 'action', type: 'select', options: RULE_ACTIONS },
    { name: 'tool', type: 'text' },
    { name: 'pattern', type: 'text' },
    { name: 'reason', type: 'text' },
  ],
  guardrails: [
    { name: 'title', type: 'text' },
    { name: 'action', type: 'select', required: true, options: RULE_ACTIONS },
    { name: 'pattern', type: 'text', required: true },
    { name: 'tool', type: 'text' },
    { name: 'reason', type: 'text' },
    { name: 'body', type: 'longtext' },
  ],
};

/** The five us-owned module TYPES (the standard kinds). id → manifest fields. */
export const STANDARD_MODULES = {
  knowledge:    { title: 'Knowledge',    note_type: 'knowledge',   capabilities: ['query', 'check'],        goal: 'Capture durable, reusable facts about this project and its domain.' },
  memory:       { title: 'Memory',       note_type: 'episode',     capabilities: ['query', 'check'],        goal: 'Remember what happened — episodes, decisions, and their outcomes.' },
  actions:      { title: 'Actions',      note_type: 'action',      capabilities: ['query', 'check', 'act'], goal: 'Capture every repeated multi-step procedure as a runnable note.' },
  instructions: { title: 'Instructions', note_type: 'instruction', capabilities: ['query', 'check'],        goal: "Keep the agent's standing guidance current and minimal.", fields: SCHEMAS.instructions },
  guardrails:   { title: 'Guardrails',   note_type: 'rule',        capabilities: ['check'],                 goal: 'Protect against repeated mistakes — as enforced tool gates.', fields: SCHEMAS.guardrails },
};

/** The template (a standard type, or a generic fallback) for a module id. */
export function templateFor(id) {
  if (STANDARD_MODULES[id]) return { id, ...STANDARD_MODULES[id] };
  const title = id.charAt(0).toUpperCase() + id.slice(1);
  return { id, title, note_type: 'note', capabilities: ['query', 'check'], goal: `Notes for the ${id} module.` };
}

/** The serialized `module.md` manifest content for a module id. A standard kind that
 *  declares a typed-column schema carries its `fields` block; the rest stay schemaless. */
export function manifestFor(id) {
  const t = templateFor(id);
  const env = {
    id: t.id, type: 'module', title: t.title, note_type: t.note_type,
    capabilities: t.capabilities, goal: t.goal,
  };
  if (Array.isArray(t.fields) && t.fields.length) env.fields = t.fields;
  return serialize(env);
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
