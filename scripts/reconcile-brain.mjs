#!/usr/bin/env node
// scripts/reconcile-brain.mjs — upgrade an existing Project to the current brain
// write-protection and reconcile its provenance, then report what still needs review.
//
// what: for each project path (default: cwd) — (1) re-run init (idempotent + additive)
//       so the protect-brain rules + the propose-never-write instruction land and every
//       seed gets back-filled provenance; (2) run check and report the `ungated` notes
//       (added outside the gate) so you can re-gate them.
// why:  Projects created before the .zuzuu/ write-protection (and before seed-provenance
//       logging) need a one-shot upgrade; this makes it ONE command and shows exactly
//       which notes bypassed review.
// how:  calls the real initHome + check directly (no spawning, zero-dep). NEVER clobbers
//       (init writes only what's missing) and NEVER auto-deletes or auto-approves — it
//       reports; you decide.
//
// usage: node scripts/reconcile-brain.mjs [project-path …]   (default: current dir)

import { initHome } from '../src/cli/init.mjs';
import { check } from '../src/use/check.mjs';
import { repoRoot } from '../src/notes/store.mjs';

const PROTECT = ['protect-brain-writes', 'protect-brain-shell', 'propose-never-write'];
const tail = (label) => String(label).split('/').pop();

function reconcile(cwd) {
  const root = repoRoot(cwd);
  console.log(`\n# ${root}`);

  const { home, created, skipped } = initHome(cwd);
  const addedProtect = PROTECT.filter((id) => created.some((c) => tail(c) === id));
  console.log(`  init: +${created.length} created, ${skipped.length} already present`);
  console.log(addedProtect.length
    ? `  protection added: ${addedProtect.join(', ')}`
    : `  protection already in place`);

  const ungated = (check({ home }).ungated) || [];
  if (!ungated.length) {
    console.log(`  ✓ provenance clean — every note has a review record`);
    return;
  }
  console.log(`  ⚠ ${ungated.length} note(s) added OUTSIDE review — re-gate or accept each:`);
  for (const u of ungated) console.log(`      ${u.addr}`);
  console.log(`    → re-gate: zz stage <module> --op create --target <id> --field title="…" --field body="…"  (then zz review approve)`);
  console.log(`    → or, if a note is legitimate as-is, leave it — this is a report, nothing was changed but the additive upgrade.`);
}

const paths = process.argv.slice(2);
if (!paths.length) paths.push(process.cwd());
for (const p of paths) {
  try { reconcile(p); } catch (e) { console.error(`  ✗ ${p}: ${e.message}`); }
}
console.log('');
