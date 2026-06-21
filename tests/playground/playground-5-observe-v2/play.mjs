// Playground 5 — v2 observe, demonstrated on real transcripts.
//
// Mines the host sessions Claude/OpenCode/… ACTUALLY wrote on this machine
// through the v2 observe stack (hosts/capture → pipelines/observe) and checks it
// produces evidence-backed, module-routed proposals — the loop's cold-start.
// Skips if no host has data here (not a failure).

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { captureSignals } from '../../../src/hosts/capture.mjs';
import { observe } from '../../../src/loop/observe.mjs';
import { run, check, note, skip } from '../_harness.mjs';

await run('observe real sessions → review-queued proposals', async () => {
  const cwd = process.cwd();
  const sessions = captureSignals({ cwd, scope: 'all' });
  if (!sessions.length) skip('no host transcripts on this machine');
  note(`captured ${sessions.length} real sessions`);

  const root = mkdtempSync(join(tmpdir(), 'zuzuu-pg5-'));
  const home = join(root, '.zuzuu');
  try {
    const r = observe(home, { cwd, scope: 'all' });
    note(`${r.sessionsMined} mined → ${r.candidates} candidates → ${r.proposed} proposals`);
    for (const p of r.proposals) note(`  [${p.module}] ${p.target} (score ${p.score})`);

    check(r.sessionsMined === sessions.length, 'every captured session was mined');
    // proposals are corroboration-gated, so a sparse machine may yield none — but
    // each one that IS produced must be routed to a real module with evidence.
    for (const p of r.proposals) {
      check(['knowledge', 'memory', 'actions', 'instructions', 'guardrails'].includes(p.module), `${p.target} → a real module (${p.module})`);
      check(p.change && p.change.type, `${p.target} carries a typed note`);
    }
    // idempotency: re-observing the same evidence proposes nothing new (dedup).
    check(observe(home, { cwd, scope: 'all' }).proposed === 0, 'a second observe is idempotent (deduped)');
    note('proposals are staged only — the human gate (review) is the one door to the brain');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
