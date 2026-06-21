// src/cli/migrate.mjs — upgrade a v1 home to the v2 envelope model.
//
// what: `zz migrate` converts an existing `.zuzuu/` from the v1 layout
//       (per-module `module.json` + items whose frontmatter carries kind/module/
//       id) to v2 (a `module.md` envelope per module; items typed by `type`, id =
//       filename). Idempotent — a home already on v2 is left alone.
// why:  so installed homes survive the cull (the v1 substrate that read them is
//       gone). One-time, local, reversible via git.
// how:  read module.json (tolerant JSON), emit module.md with the note
//       serializer; for each item, fold kind→type and drop the now-redundant
//       id/module frontmatter keys. Zero-dep, fail-soft per file.

import { existsSync, readFileSync, writeFileSync, readdirSync, rmSync, statSync, mkdirSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { serialize, parse } from '../notes/note.mjs';

const RUNNERS = { mjs: 'node', js: 'node', sh: 'sh', py: 'python3' };
/** Migrate a v1 per-slug Action dir (ACTION.md + run.mjs) → one v2 runnable note.
 *  Returns true if it migrated one. Preserves the script (copied into items/). */
function migrateActionDir(subPath, slug, itemsDir, fallbackType) {
  const mdName = existsSync(join(subPath, 'ACTION.md')) ? 'ACTION.md' : readdirSync(subPath).find((f) => f.endsWith('.md'));
  if (!mdName) return false;
  const { item } = parse(readFileSync(join(subPath, mdName), 'utf8'), { id: slug });
  if (!item) return false;
  mkdirSync(itemsDir, { recursive: true });
  const next = { ...item, type: item.type ?? item.kind ?? fallbackType };
  // fold v1 payload.exec/args into a v2 `run`, copying the script alongside
  if (!next.run) {
    const exec = item.payload?.exec || readdirSync(subPath).find((f) => /\.(mjs|js|sh|py)$/.test(f));
    if (exec && existsSync(join(subPath, exec))) {
      const ext = exec.split('.').pop();
      copyFileSync(join(subPath, exec), join(itemsDir, `${slug}.${ext}`));
      const args = item.payload?.args ? ' ' + [].concat(item.payload.args).join(' ') : '';
      next.run = `${RUNNERS[ext] ?? 'sh'} items/${slug}.${ext}${args}`;
    }
  }
  delete next.kind; delete next.module; delete next.id; delete next.payload;
  writeFileSync(join(itemsDir, `${slug}.md`), serialize(next));
  rmSync(subPath, { recursive: true, force: true });
  return true;
}
import { homeDir, repoRoot } from '../notes/store.mjs';

// default capability set + goal per known module (mirrors `init`)
const DEFAULTS = {
  knowledge: { caps: ['query', 'check', 'enhance'], note: 'knowledge', goal: 'Capture durable, reusable facts about this project and its domain.' },
  memory: { caps: ['query', 'check', 'enhance'], note: 'episode', goal: 'Remember what happened — episodes, decisions, and their outcomes.' },
  actions: { caps: ['query', 'check', 'act', 'enhance'], note: 'action', goal: 'Capture every repeated multi-step procedure as a runnable note.' },
  instructions: { caps: ['query', 'check'], note: 'instruction', goal: "Keep the agent's standing guidance current and minimal." },
  guardrails: { caps: ['gate', 'check'], note: 'rule', goal: 'Protect against repeated mistakes — as enforced tool gates.' },
};

const readJson = (p) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; } };

/** Convert one item file in place: kind→type, drop id/module. Returns true if changed. */
function migrateItem(file, id, fallbackType) {
  // NB: a v1 item validates ok:false (no `type`) — that's the very thing we fix,
  // so use the parsed item regardless of validation.
  const { item } = parse(readFileSync(file, 'utf8'), { id });
  if (!item) return false;
  if (item.type && !item.kind && !item.module) return false; // already v2
  const next = { ...item };
  next.type = next.type ?? next.kind ?? fallbackType;
  delete next.kind; delete next.module; delete next.id;
  writeFileSync(file, serialize(next));
  return true;
}

/**
 * Migrate the home at `cwd`. @returns {{ migrated, modules, items, alreadyV2 }}
 */
export function migrateHome(cwd = process.cwd()) {
  const home = homeDir(repoRoot(cwd));
  if (!existsSync(home)) return { migrated: false, reason: 'no .zuzuu/ home', modules: 0, items: 0 };
  let modules = 0, items = 0, sawV1 = false;

  for (const entry of readdirSync(home)) {
    const moduleDir = join(home, entry);
    if (entry.startsWith('.') || !statSync(moduleDir).isDirectory()) continue;
    const def = DEFAULTS[entry] ?? { caps: ['query', 'check'], note: null, goal: `Curate ${entry}.` };

    // 1. module.json → module.md
    const jsonPath = join(moduleDir, 'module.json');
    if (existsSync(jsonPath)) {
      sawV1 = true;
      const j = readJson(jsonPath) ?? {};
      writeFileSync(join(moduleDir, 'module.md'), serialize({
        id: entry, type: 'module', title: j.title ?? entry,
        // v1 had no note_type; the kind family lived in `kinds: [...]` — read it.
        note_type: j.note_type ?? (Array.isArray(j.kinds) ? j.kinds[0] : undefined) ?? def.note,
        capabilities: Array.isArray(j.capabilities) && j.capabilities.length ? j.capabilities : def.caps,
        enhance: { goal: j.enhance?.goal ?? def.goal },
      }));
      rmSync(jsonPath);
      modules++;
    }

    // 2. items (v1 used items/ or entries/) → typed, id-stripped
    for (const sub of ['items', 'entries']) {
      const dir = join(moduleDir, sub);
      if (!existsSync(dir)) continue;
      for (const f of readdirSync(dir)) {
        if (!f.endsWith('.md')) continue;
        if (migrateItem(join(dir, f), f.slice(0, -3), def.note ?? 'knowledge')) items++;
      }
    }

    // 3. v1 Actions: a per-slug subdir (actions/<slug>/ACTION.md [+ run.mjs]) —
    //    NOT under items/. Without this they were silently dropped on upgrade.
    const itemsDir = join(moduleDir, 'items');
    for (const sub of readdirSync(moduleDir)) {
      if (['items', 'entries', 'proposals'].includes(sub) || sub.startsWith('.')) continue;
      const subPath = join(moduleDir, sub);
      if (!statSync(subPath).isDirectory()) continue;
      if (migrateActionDir(subPath, sub, itemsDir, def.note ?? 'action')) { sawV1 = true; items++; }
    }
  }

  return { migrated: sawV1, alreadyV2: !sawV1, modules, items };
}
