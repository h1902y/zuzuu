// src/cli/code.mjs — launch OpenCode as the bundled default host.
//
// what: `zz code [dir]` — ensure the module home + the zuzuu hooks, then launch
//       the real `opencode` binary (configure + launch, never fork, never drive
//       headlessly — the observe model, interactive-first).
// why:  stage 2 of the product sequence: a one-command, module-equipped host for
//       newcomers. OpenCode is a runtime PEER (detected, installed on demand),
//       never an npm dependency (the zero-dep guarantee).
// how:  re-pointed from v1 onto the substrate + the v2 init/enable. The `deps` seam
//       keeps it hermetically testable (no real binary in tests). Zero-dep.

import { existsSync, readSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { repoRoot, homeDir } from '../notes/store.mjs';
import { initHome } from './init.mjs';
import { enable } from './enable.mjs';

const realDetect = () => { try { return spawnSync('opencode', ['--version'], { stdio: 'ignore' }).status === 0; } catch { return false; } };
const realInstall = () => { try { return spawnSync('npm', ['install', '-g', 'opencode-ai'], { stdio: 'inherit' }).status === 0; } catch { return false; } };
const realLaunch = ({ cwd, model, passthrough }) => {
  const a = [...(model ? ['-m', model] : []), ...(passthrough || [])];
  return spawnSync('opencode', a, { cwd, stdio: 'inherit' }).status ?? 0;
};
function realPrompt(q) {
  process.stdout.write(`${q} `);
  try { const b = Buffer.alloc(8); const n = readSync(0, b, 0, 8, null); return b.toString('utf8', 0, n).trim().toLowerCase().startsWith('n') ? 'n' : 'y'; }
  catch { return 'y'; }
}

/** `zz code [dir] [--model M] [--yes] [-- …opencode args]` → exit code. */
export function code(args = {}, deps = {}) {
  const d = {
    detect: realDetect, install: realInstall, launch: realLaunch, prompt: realPrompt,
    runInit: (dir) => initHome(dir),
    runEnable: (dir) => enable(dir),
    log: (...m) => console.log(...m),
    ...deps,
  };

  const dir = args._?.[0] ? resolve(String(args._[0])) : process.cwd();
  if (!existsSync(dir)) { d.log(`zz code: no such directory: ${dir}`); return 1; }

  if (!existsSync(homeDir(repoRoot(dir)))) d.runInit(dir); // idempotent

  if (!d.detect()) {
    d.log("OpenCode isn't installed.");
    const consent = args.yes || args.y || d.prompt('Install it now? (npm i -g opencode-ai) [Y/n]') !== 'n';
    if (!consent || !d.install() || !d.detect()) { d.log('Install it with:  npm i -g opencode-ai'); return 1; }
  }

  let wired = true;
  try { d.runEnable(dir); } catch (e) { wired = false; d.log(`zz code: could not wire the zuzuu hooks (${e?.message || e}) — launching unwired.`); }

  d.log('zz code → OpenCode, module-equipped');
  d.log(`  ✓ module home (.zuzuu/)   ${wired ? '✓ guardrails gate   ✓ session grounding' : '⚠ hooks not wired (degraded)'}`);
  d.log(`  → launching OpenCode in ${dir} …`);

  return d.launch({ cwd: dir, model: args.model || null, passthrough: args['--'] || [] });
}
