// zuzuu/commands/module.mjs — `zuzuu module` (W24 Module Standard + the
// 2026-06-13 Module contract).
//
// The read surface over the one envelope format + the module contract:
//   zuzuu module items <f> [--json|--jsonl]   list a module's envelope items
//   zuzuu module schema <f> [--json]          print its payload schema
//   zuzuu module manifest <f> [--json]        print its module.json manifest
//   zuzuu module overview [--json]            ALL modules in ONE process:
//                                              manifest.ui + counts + top-3 item
//                                              titles + pending counts (the
//                                              daemon's batching endpoint)
//
// `--json` = one document; `--jsonl` = one item per line (streaming consumers).
// Declarative modules (manifest-only folders) are first-class here: items
// list from manifest.itemsDir, schemas serve from the home, the overview and
// digest include them. Fail-soft like everything on the serve path.

import { paths } from '../core/store.mjs';
import { MODULE_KINDS } from '../module/envelope.mjs';
import { modulesOf, moduleOf } from '../module/registry.mjs';
import { MODULES } from '../module/contract.mjs';
import {
  moduleItemsData, moduleSchemaData, moduleManifestData, moduleOverviewData,
} from './module/read.mjs';
import { setModuleEnabled, createModuleFiles, commaList } from './module/authoring.mjs';
import {
  moduleGenerationsData, moduleGenerationShowData, moduleGenerationCmd,
} from './module/generations.mjs';

// Re-export the data/authoring surface so existing importers (daemon, tests)
// keep importing it from here unchanged.
export {
  moduleItemsData, moduleSchemaData, moduleManifestData, moduleOverviewData,
} from './module/read.mjs';
export { setModuleEnabled, createModuleFiles } from './module/authoring.mjs';
export { moduleGenerationsData, moduleGenerationShowData } from './module/generations.mjs';

/** `zuzuu module <sub> [<f>]` — items | schema | manifest | overview;
 *  also `zuzuu module <m> generations | generation show|rollback <id>`. */
export function module(args = {}, log = console.log) {
  const [sub, f] = args._ ?? [];

  // guided creation: `module new <id> --title … --capabilities a,b --kinds x --required body`
  if (sub === 'new') {
    if (!f) { console.error('usage: zuzuu module new <id> [--title T] [--tagline T] [--capabilities a,b] [--kinds x,y] [--required body]'); process.exitCode = 1; return; }
    const r = createModuleFiles(paths().dir, {
      id: f,
      title: typeof args.title === 'string' ? args.title : undefined,
      tagline: typeof args.tagline === 'string' ? args.tagline : undefined,
      capabilities: commaList(args.capabilities),
      kinds: commaList(args.kinds),
      required: commaList(args.required),
    });
    if (!r.ok) {
      if (args.json) { log(JSON.stringify({ ok: false, error: r.error })); }
      else console.error(`module new: ${r.error}`);
      process.exitCode = 1;
      return;
    }
    if (args.json) { log(JSON.stringify({ ok: true, id: r.id, path: r.path })); return; }
    log(`✓ created module '${r.id}' — ${r.path}`);
    return;
  }

  // per-module generations: `module <m> generations|generation …`
  if (MODULES.includes(sub) && (f === 'generations' || f === 'generation')) {
    return moduleGenerationCmd(paths().dir, sub, (args._ ?? []).slice(1), args, log);
  }
  if (!sub || !['items', 'schema', 'manifest', 'overview', 'enable', 'disable'].includes(sub)) {
    console.error('usage: zuzuu module items <module> [--json|--jsonl] · module schema <module> [--json] · module manifest <module> [--json] · module overview [--json] · module enable <id> · module disable <id> · module <module> generations · module <module> generation show|rollback <id>');
    process.exitCode = 1;
    return;
  }
  const agentDir = paths().dir;

  if (sub === 'enable' || sub === 'disable') {
    const enabled = sub === 'enable';
    if (!f) {
      console.error(`usage: zuzuu module ${sub} <module-id>`);
      process.exitCode = 1;
      return;
    }
    const r = setModuleEnabled(agentDir, f, enabled);
    if (!r.ok) {
      if (args.json) { log(JSON.stringify({ ok: false, error: r.error })); process.exitCode = 1; return; }
      console.error(`module ${sub}: ${r.error}`); process.exitCode = 1; return;
    }
    if (args.json) { log(JSON.stringify({ ok: true, id: r.id, enabled: r.enabled })); return; }
    log(`${enabled ? '✓ enabled' : '✓ disabled'} module '${f}'`);
    return;
  }

  if (sub === 'overview') {
    const d = moduleOverviewData(agentDir);
    if (args.json) { log(JSON.stringify(d, null, 2)); return; }
    for (const fac of d.modules) {
      const pending = fac.counts.pending ? ` · ${fac.counts.pending} pending` : '';
      const flag = fac.declarative ? ' [declarative]' : '';
      log(`${fac.id.padEnd(13)} ${String(fac.counts.items).padStart(3)} item(s)${pending}${flag}${fac.manifestError ? `  ✗ ${fac.manifestError}` : ''}`);
    }
    return;
  }

  const entry = moduleOf(agentDir, f);
  if (!entry) {
    const known = modulesOf(agentDir).map((x) => x.id);
    console.error(`unknown module: ${f ?? '(none)'} — one of ${known.join(' · ')}`);
    process.exitCode = 1;
    return;
  }

  if (sub === 'manifest') {
    const d = moduleManifestData(agentDir, entry.id);
    log(JSON.stringify(args.json ? d : d.manifest, null, 2));
    return;
  }

  if (sub === 'schema') {
    const { schema } = moduleSchemaData(agentDir, entry.id);
    log(JSON.stringify(schema, null, 2));
    return;
  }

  const data = moduleItemsData(agentDir, entry.id, entry.manifest);
  if (args.jsonl) {
    for (const item of data.items) log(JSON.stringify(item));
    return;
  }
  if (args.json) {
    log(JSON.stringify(data, null, 2));
    return;
  }
  const kinds = MODULE_KINDS[entry.id] ?? (entry.declarative && entry.manifest?.kinds?.length ? entry.manifest.kinds : null);
  log(`${entry.id} — ${data.count} item(s)${kinds ? ` [${kinds.join('|')}]` : ''}`);
  for (const it of data.items) {
    log(`  ${it.id}  ${it.kind} · ${it.status ?? 'active'} — ${it.title}`);
  }
  for (const e of data.errors) log(`  ✗ ${e.file}: ${e.error}`);
  if (!data.count && !data.errors.length) log('  (none yet)');
}
