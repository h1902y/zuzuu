// `zuzuu web` — launch the visual workbench (bundled with this package).
// The workbench opens a browser-based UI and prints its own URL; zuzuu just starts it.
//
// Deliberate difference from code.mjs: NO init/enable here. The workbench home
// owns its own onboarding — this command's only job is: resolve and launch.
//
// Packaging (single-package decision, 2026-06-12, DESIGN §13): the workbench
// ships INSIDE @zuzuucodes/cli as `web-app/` (built from `web/`); its runtime
// deps are this package's optionalDependencies. `dependencies` stays empty and
// the CLI core never imports them, so a failed native build (node-pty) degrades
// the workbench, never the CLI. `--omit=optional` installs skip the deps; this
// command then explains how to repair.
//
// Resolution order:
//   1. the bundled web-app/dist next to this package (installed OR repo after build:web)
//   2. the nested dev project's built daemon (web/packages/daemon, repo checkout)
//   3. a standalone `zuzuu-web` on PATH (legacy/manual installs)
//   4. none → repair hint (reinstall, or `npm run build:web` in a checkout)

import { existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { spawn } from 'node:child_process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// --- default (real) deps; tests inject fakes for everything external ---
const realResolveBundled = () => {
  // dev build first: in a repo checkout its deps live in web/node_modules; the
  // staged web-app/ resolves deps from the INSTALLED package's node_modules
  // (optionalDependencies), which a checkout doesn't have unless npm-installed.
  for (const p of [
    join(PKG_ROOT, 'web', 'packages', 'daemon', 'dist', 'index.js'), // repo dev build
    join(PKG_ROOT, 'web-app', 'dist', 'index.js'),                  // staged (published install)
  ]) if (existsSync(p)) return p;
  return null;
};
const realDetectPath = () => {
  try { return spawnSync('zuzuu-web', ['--version'], { stdio: 'ignore' }).status === 0; }
  catch { return false; }
};
const realLaunch = ({ cwd, entryScript }) => {
  // bundled entry → run through node (not on PATH); PATH binary → run directly
  if (entryScript) spawn(process.execPath, [entryScript, cwd], { detached: true, stdio: 'ignore' }).unref();
  else spawn('zuzuu-web', [cwd], { detached: true, stdio: 'ignore' }).unref();
};

/**
 * `zuzuu web [dir]`
 * Launch the visual workbench for the given directory (default: cwd).
 * Bundled-first; never installs anything — the workbench ships in this package.
 */
export function web(args = {}, deps = {}) {
  const d = {
    resolveBundled: realResolveBundled,
    detectPath: realDetectPath,
    launch: realLaunch,
    log: (...m) => console.log(...m),
    ...deps,
  };

  // 1. resolve the target directory
  const dir = args._?.[0] ? resolve(String(args._[0])) : process.cwd();

  // 2. find the workbench: bundled → PATH → repair hint
  const entryScript = d.resolveBundled();
  if (!entryScript && !d.detectPath()) {
    d.log('the workbench is not available in this install.');
    d.log('  installed package → reinstall: npm i -g @zuzuucodes/cli  (without --omit=optional)');
    d.log('  repo checkout     → build it:  npm run build:web');
    return;
  }

  // 3. launch — the workbench opens the browser and prints its URL
  d.log(`zuzuu web → launching visual workbench in ${dir} …`);
  d.log('  it will open your browser and print its URL.');
  d.launch({ cwd: dir, entryScript });
}
