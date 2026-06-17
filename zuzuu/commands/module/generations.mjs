// zuzuu/commands/module/generations.mjs — per-module generations (W2.5 Phase 2).
//
// The read documents (list + diff) the daemon serves, plus the
// `module <m> generations | generation show|rollback|mint <id>` subcommand
// handler. Rollback flips the active pointer + restores content; mint freezes
// the current items into the next generation (the explicit/web surface — the
// review ceremony does this automatically on approval).

import {
  moduleGenerations, readModuleGeneration, diffModuleGenerations,
} from '../../module/generation/read.mjs';
import { rollbackModule, mintModuleGeneration } from '../../module/generation/write.mjs';

/** Pure: one module's generation list + active — the daemon /module/:key/generations source. */
export function moduleGenerationsData(agentDir, module) {
  return moduleGenerations(agentDir, module);
}

/** Pure: one module's generation diff, or null for an unknown id. */
export function moduleGenerationShowData(agentDir, module, id) {
  return diffModuleGenerations(agentDir, module, id);
}

/** The text lines for `module <m> generation show <id>`. */
function showLines(agentDir, module, id) {
  const d = diffModuleGenerations(agentDir, module, id);
  if (!d) return null;
  const parts = [];
  if (d.added.length) parts.push(`+${d.added.length} added`);
  if (d.changed.length) parts.push(`~${d.changed.length} changed`);
  if (d.removed.length) parts.push(`-${d.removed.length} removed`);
  return [
    `${module} ${id}  ${d.mintedAt ?? '?'}`,
    `  forkedFrom: ${d.forkedFrom ?? '(none — first generation)'}`,
    `  mintedFrom: ${d.mintedFrom.length} proposal(s)`,
    `  changes vs parent: ${parts.length ? parts.join(' · ') : 'no change'}`,
  ].join('\n');
}

/** `zuzuu module <m> generations | generation show <id> | generation rollback <id>`. */
export function moduleGenerationCmd(agentDir, module, rest, args, log) {
  const verb = rest[0];
  if (verb === 'generations') {
    const d = moduleGenerationsData(agentDir, module);
    if (args.json) { log(JSON.stringify(d)); return; }
    if (!d.generations.length) { log(`no ${module} generations yet — approve a ${module} proposal in \`zuzuu review\``); return; }
    for (const g of d.generations) {
      const mark = g.id === d.active ? '●' : ' ';
      log(`${mark} ${g.id}  ${g.mintedAt ?? '?'}  mintedFrom:${g.mintedFrom.length}`);
    }
    return;
  }
  // verb === 'generation'
  const op = rest[1];
  const id = rest[2];
  if (op === 'show') {
    if (!id) { console.error(`usage: zuzuu module ${module} generation show <id>`); process.exitCode = 1; return; }
    if (args.json) {
      const d = moduleGenerationShowData(agentDir, module, id);
      if (!d) { console.error(`no ${module} generation '${id}'`); process.exitCode = 1; return; }
      log(JSON.stringify(d)); return;
    }
    const out = showLines(agentDir, module, id);
    if (out == null) { console.error(`no ${module} generation '${id}'`); process.exitCode = 1; return; }
    log(out);
    return;
  }
  if (op === 'rollback') {
    if (!id) { console.error(`usage: zuzuu module ${module} generation rollback <id>`); process.exitCode = 1; return; }
    if (!readModuleGeneration(agentDir, module, id)) { console.error(`no ${module} generation '${id}'`); process.exitCode = 1; return; }
    const r = rollbackModule(agentDir, module, id);
    if (args.json) { log(JSON.stringify({ ok: r.ok, module, restored: r.restored, active: id })); return; }
    log(`✓ rolled back ${module} to ${id} — restored ${r.restored} item(s); active=${id}`);
    return;
  }
  if (op === 'mint') {
    // freeze this module's current items into its next generation (the ceremony
    // does this automatically on review; this is the explicit/web surface).
    const mintedFrom = args.from ? String(args.from).split(',').map((s) => s.trim()).filter(Boolean) : [];
    const lf = mintModuleGeneration(agentDir, module, { mintedFrom });
    if (args.json) { log(JSON.stringify({ id: lf.id, module, mintedFrom: lf.mintedFrom, forkedFrom: lf.forkedFrom })); return; }
    log(`✓ minted ${module} ${lf.id}${lf.forkedFrom ? ` (forkedFrom ${lf.forkedFrom})` : ''} — now active`);
    return;
  }
  console.error(`usage: zuzuu module ${module} generation [show <id>|rollback <id>|mint]`);
  process.exitCode = 1;
}
