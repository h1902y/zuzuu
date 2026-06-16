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
// Singleton-per-workspace (2026-06-12): the daemon records itself in
// ~/.webcode/instances/<sha256(realpath-root).slice(0,16)>.json after listen
// and removes it on clean shutdown (daemon src/instance-file.ts — the path
// scheme here MUST stay in sync with it). Before spawning we check that file:
// a live instance (pid alive + HTTP listener answering) is REUSED — same port,
// same token, old browser tabs keep working; a stale file is deleted and we
// spawn fresh. `--stop` / `--status` manage the running instance.
// (The file carries the auth token: 0600, user's own machine, and the token
// already appears in the daemon's stdout — acceptable.)
//
// Resolution order:
//   1. the bundled web-app/dist next to this package (installed OR repo after build:web)
//   2. the nested dev project's built daemon (web/packages/daemon, repo checkout)
//   3. a standalone `zuzuu-web` on PATH (legacy/manual installs)
//   4. none → repair hint (reinstall, or `npm run build:web` in a checkout)

import { existsSync, readFileSync, realpathSync, unlinkSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';
import http from 'node:http';
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
  // Tell the daemon to shell out to THIS package's CLI (the one shipping the
  // workbench), not a stale `zuzuu` on PATH — so e.g. `session diff` works the
  // moment the workbench ships it. The daemon also self-resolves, but this is
  // authoritative across odd install layouts.
  const cliBin = join(PKG_ROOT, 'bin', 'zuzuu.mjs');
  const binArgs = existsSync(cliBin) ? ['--zuzuu-bin', cliBin] : [];
  // bundled entry → run through node (not on PATH); PATH binary → run directly
  if (entryScript) spawn(process.execPath, [entryScript, cwd, ...binArgs], { detached: true, stdio: 'ignore' }).unref();
  else spawn('zuzuu-web', [cwd, ...binArgs], { detached: true, stdio: 'ignore' }).unref();
};
// Same scheme as the daemon's instance-file.ts: sha256 of the realpath'd root.
const realInstancePathFor = (dir) => {
  let real = dir;
  try { real = realpathSync(dir); } catch { /* missing dir → daemon will refuse anyway */ }
  const id = createHash('sha256').update(real).digest('hex').slice(0, 16);
  return join(homedir(), '.webcode', 'instances', `${id}.json`);
};
const realReadInstance = (file) => {
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; }
};
const realRemoveFile = (file) => { try { unlinkSync(file); } catch { /* gone already */ } };
const realPidAlive = (pid) => {
  try { process.kill(pid, 0); return true; }
  catch (err) { return err?.code === 'EPERM'; } // EPERM = alive, just not ours
};
const realKillPid = (pid, signal) => { try { process.kill(pid, signal); } catch { /* gone */ } };
// Connectivity probe only — ANY HTTP answer (even 401) means a listener is there.
const realProbe = (port) => new Promise((done) => {
  const req = http.get({ host: '127.0.0.1', port, path: '/api/health', timeout: 1000 }, (res) => {
    res.resume();
    done(true);
  });
  req.on('timeout', () => { req.destroy(); done(false); });
  req.on('error', () => done(false));
});
const realOpenBrowser = (url) => { // fail-soft: a missing opener never breaks the command
  try {
    const cmd = process.platform === 'darwin' ? 'open'
      : process.platform === 'win32' ? 'start' : 'xdg-open';
    spawn(cmd, [url], { stdio: 'ignore', detached: true, shell: process.platform === 'win32' }).unref();
  } catch { /* ignore */ }
};
const realSleep = (ms) => new Promise((r) => setTimeout(r, ms));

const urlOf = (inst) => `http://127.0.0.1:${inst.port}/?token=${inst.token}`;

/**
 * `zuzuu web [dir] [--stop|--status]`
 * Launch the visual workbench for the given directory (default: cwd) —
 * reusing an already-running daemon for that workspace when there is one.
 * Bundled-first; never installs anything — the workbench ships in this package.
 */
export async function web(args = {}, deps = {}) {
  const d = {
    resolveBundled: realResolveBundled,
    detectPath: realDetectPath,
    launch: realLaunch,
    instancePathFor: realInstancePathFor,
    readInstance: realReadInstance,
    removeFile: realRemoveFile,
    pidAlive: realPidAlive,
    killPid: realKillPid,
    probe: realProbe,
    openBrowser: realOpenBrowser,
    sleep: realSleep,
    log: (...m) => console.log(...m),
    ...deps,
  };

  // 1. resolve the target directory + its instance state
  const dir = args._?.[0] ? resolve(String(args._[0])) : process.cwd();
  const instanceFile = d.instancePathFor(dir);
  const inst = d.readInstance(instanceFile);
  const isAlive = async (i) =>
    !!(i && Number.isInteger(i.pid) && d.pidAlive(i.pid) && await d.probe(i.port));

  // --stop: terminate the running daemon for this workspace
  if (args.stop) {
    if (!inst) { d.log(`no workbench running for ${dir}`); return; }
    if (d.pidAlive(inst.pid)) {
      d.killPid(inst.pid, 'SIGTERM');
      for (let i = 0; i < 15 && d.pidAlive(inst.pid); i++) await d.sleep(200); // ~3s grace
      if (d.pidAlive(inst.pid)) d.log(`workbench (pid ${inst.pid}) hasn't exited yet — still shutting down.`);
      else d.log(`stopped workbench for ${dir} (pid ${inst.pid})`);
    } else {
      d.log(`workbench for ${dir} was not running — cleaned up stale state.`);
    }
    d.removeFile(instanceFile); // daemon removes it itself on SIGTERM; this is belt-and-braces
    return;
  }

  // --print-url: emit just the authed URL for a live daemon (one-command
  // recovery of a lost tab — scriptable, no side effects, no browser open).
  // The persisted token means this URL stays valid across daemon restarts.
  if (args['print-url'] || args.printUrl) {
    if (await isAlive(inst)) d.log(urlOf(inst));
    else d.log(`no workbench running for ${dir}`);
    return;
  }

  // --status: report without side effects
  if (args.status) {
    if (await isAlive(inst)) {
      d.log(`workbench running for ${dir}`);
      d.log(`  pid ${inst.pid} → ${urlOf(inst)}`);
    } else {
      d.log(`no workbench running for ${dir}`);
    }
    return;
  }

  // 2. reuse a live instance: same port + token, old tabs stay valid
  if (await isAlive(inst)) {
    d.log(`workbench already running for ${dir}`);
    d.log(`  → ${urlOf(inst)}`);
    d.openBrowser(urlOf(inst));
    return;
  }
  if (inst) d.removeFile(instanceFile); // stale (dead pid / no listener) → spawn fresh

  // 3. find the workbench: bundled → PATH → repair hint
  const entryScript = d.resolveBundled();
  if (!entryScript && !d.detectPath()) {
    d.log('the workbench is not available in this install.');
    d.log('  installed package → reinstall: npm i -g @zuzuucodes/cli  (without --omit=optional)');
    d.log('  repo checkout     → build it:  npm run build:web');
    return;
  }

  // 4. launch — the daemon opens the browser itself on fresh boot, so we only
  // wait for its instance file to surface the URL here (don't double-open).
  d.log(`zuzuu web → launching visual workbench in ${dir} …`);
  d.launch({ cwd: dir, entryScript });
  for (let i = 0; i < 30; i++) { // ~6s
    await d.sleep(200);
    const fresh = d.readInstance(instanceFile);
    if (fresh && d.pidAlive(fresh.pid)) {
      d.log(`  → ${urlOf(fresh)}`);
      return;
    }
  }
  d.log('  it will open your browser and print its URL.');
}
