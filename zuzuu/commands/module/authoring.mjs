// zuzuu/commands/module/authoring.mjs — module enable/disable + guided creation.
//
// Enable: flip `enabled` on a module's home module.json. Creation (WS-D): compose
// a DECLARATIVE module's home from a few choices — ZERO bespoke code, just the
// manifest + schema the spine already understands (the human gate for a new
// faculty surface). Both pure-ish and never-throw.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { MODULES } from '../../module/contract.mjs';

/**
 * Pure-ish: set `enabled` on a module's home module.json.
 * Reads the current JSON, sets the field, writes it back.
 * Returns {ok:true, id, enabled} or {ok:false, error} if no manifest.
 */
export function setModuleEnabled(agentDir, id, enabled) {
  const p = join(agentDir, id, 'module.json');
  if (!existsSync(p)) return { ok: false, error: `no module.json for '${id}'` };
  try {
    const raw = JSON.parse(readFileSync(p, 'utf8'));
    raw.enabled = enabled;
    writeFileSync(p, JSON.stringify(raw, null, 2) + '\n', 'utf8');
    return { ok: true, id, enabled };
  } catch (e) {
    return { ok: false, error: e.message ?? String(e) };
  }
}

/** A safe module slug: lowercase alphanumeric start, then alnum/underscore/hyphen. */
const SLUG = /^[a-z0-9][a-z0-9_-]*$/;

/**
 * Pure-ish: compose a declarative module's home from a few choices — ZERO
 * bespoke code, just the manifest + schema the spine already understands.
 * Writes `<id>/module.json` (id/title/tagline/itemsDir + a capabilities map:
 * each named capability → {} except `mine`, which carries its first kind) and
 * `<id>/schema.json` ({kinds, required}). Refuses a bad slug or an existing dir.
 * Returns {ok:true, id, path} or {ok:false, error}.
 */
export function createModuleFiles(agentDir, { id, title, tagline, capabilities, kinds, required } = {}) {
  if (typeof id !== 'string' || !SLUG.test(id)) {
    return { ok: false, error: `invalid module id '${id ?? ''}' — must be a slug (lowercase, [a-z0-9_-])` };
  }
  // Refuse a built-in slug even when its dir isn't seeded yet — creating
  // `<home>/knowledge/` here would shadow the real built-in module.
  if (MODULES.includes(id)) {
    return { ok: false, error: `'${id}' is a reserved built-in module` };
  }
  const dir = join(agentDir, id);
  if (existsSync(dir)) return { ok: false, error: `module '${id}' already exists` };

  const caps = Array.isArray(capabilities) ? capabilities : [];
  const kindList = Array.isArray(kinds) ? kinds : [];
  const reqList = Array.isArray(required) && required.length ? required : ['body'];

  const capabilityMap = {};
  for (const name of caps) {
    capabilityMap[name] = name === 'mine' ? { kind: kindList[0] } : {};
  }

  const manifest = {
    id,
    title: title || id,
    tagline: tagline || '',
    itemsDir: 'items',
    capabilities: capabilityMap,
  };
  const schema = { kinds: kindList, required: reqList };

  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'module.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    writeFileSync(join(dir, 'schema.json'), JSON.stringify(schema, null, 2) + '\n', 'utf8');
  } catch (e) {
    return { ok: false, error: e.message ?? String(e) };
  }
  return { ok: true, id, path: dir };
}

/** Split a comma-list flag (string|true|array) into trimmed, non-empty names. */
export function commaList(v) {
  if (v == null || v === true) return [];
  return [].concat(v).flatMap((s) => String(s).split(',')).map((s) => s.trim()).filter(Boolean);
}
