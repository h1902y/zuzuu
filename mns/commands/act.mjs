// mns/commands/act.mjs
// `mns act` — the Actions faculty CLI. The host's Bash invokes this, so each run
// is an observable span already covered by the guardrails gate. Subcommands:
//   mns act [list]            the index (slug · kind · snippet)
//   mns act show <slug>       full manifest (script) or SKILL.md (runbook)
//   mns act <slug> [--args J] run a script action
//   mns act new <slug>        scaffold (Task 8)
//   mns act schema <slug>     convert to a tool definition (Task 8)

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { paths } from '../store.mjs';
import { allActions, loadManifest, actionsDir } from '../actions/manifest.mjs';
import { runAction } from '../actions/dispatch.mjs';
import { MARKER } from '../actions/marker.mjs';
import { newAction, schema as schemaCmd } from './act-author.mjs';

const RESERVED = new Set(['list', 'show', 'new', 'schema']);

function list(mnsDir) {
  const actions = allActions(mnsDir);
  if (!actions.length) return console.log('no actions yet — scaffold one with `mns act new <slug>`');
  for (const a of actions.sort((x, y) => x.slug.localeCompare(y.slug))) {
    console.log(`  ${a.slug}  [${a.kind}]  ${a.promptSnippet}`);
  }
}

function show(mnsDir, slug) {
  if (!slug) { console.error('usage: mns act show <slug>'); process.exit(1); }
  const man = loadManifest(mnsDir, slug);
  if (man) return console.log(JSON.stringify(man, null, 2));
  const skill = join(actionsDir(mnsDir), slug, 'SKILL.md');
  if (existsSync(skill)) return process.stdout.write(readFileSync(skill, 'utf8'));
  console.error(`no action '${slug}'`);
  process.exit(1);
}

function run(mnsDir, slug, args) {
  let callerArgs = {};
  if (args.args) {
    try { callerArgs = JSON.parse(args.args); }
    catch { console.error('--args must be valid JSON'); process.exit(1); }
  }
  const r = runAction(mnsDir, slug, callerArgs);
  if (r.logs) process.stdout.write(r.logs + '\n');
  console.log(MARKER + JSON.stringify(r.ok ? { ok: true, value: r.value } : { ok: false, error: r.error, detail: r.detail }));
  if (r.ok) console.log(`✓ ${slug} ok`);
  else console.error(`✗ ${slug}: ${r.error}${r.detail ? ` — ${r.detail}` : ''}`);
  process.exit(r.ok ? 0 : 1);
}

export function act(args) {
  const mnsDir = paths().dir;
  const sub = args._[0];
  if (!sub || sub === 'list') return list(mnsDir);
  if (sub === 'show') return show(mnsDir, args._[1]);
  if (sub === 'new') return newAction(mnsDir, args._[1]);
  if (sub === 'schema') return schemaCmd(mnsDir, args._[1], args);
  if (RESERVED.has(sub)) { console.error(`unknown: mns act ${sub}`); process.exit(1); }
  return run(mnsDir, sub, args);
}
