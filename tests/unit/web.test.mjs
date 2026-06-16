import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { web } from '../../zuzuu/commands/web.mjs';

// A deps recorder: every external effect is captured; nothing real runs.
// Defaults model the "no instance recorded" world; override per scenario.
function fakeDeps(over = {}) {
  const calls = [];
  const deps = {
    resolveBundled: () => over.bundled ?? null,
    detectPath: () => over.path ?? false,
    launch: ({ cwd, entryScript }) => { calls.push(['launch', cwd, entryScript ?? null]); },
    instancePathFor: () => over.instanceFile ?? '/fake/.webcode/instances/abc.json',
    readInstance: () => over.instance ?? null,
    removeFile: (f) => { calls.push(['removeFile', f]); },
    pidAlive: () => over.alive ?? false,
    killPid: (pid, sig) => { calls.push(['kill', pid, sig]); },
    probe: async () => over.probe ?? false,
    openBrowser: (url) => { calls.push(['open', url]); },
    sleep: async () => {}, // hermetic: no real waiting
    log: (...m) => { calls.push(['log', m.join(' ')]); },
  };
  return { calls, deps };
}

const logsOf = (calls) => calls.filter((c) => c[0] === 'log').map((c) => c[1]).join('\n');
const INST = { root: '/w', port: 7771, pid: 4242, token: 'tok123', startedAt: 'x', version: '0.1.0' };

// ── launch resolution (pre-existing behavior) ────────────────────────────

test('bundled web-app wins: launches its entry script via node, PATH never probed', async () => {
  const { calls, deps } = fakeDeps({ bundled: '/pkg/web-app/dist/index.js' });
  let probed = false;
  deps.detectPath = () => { probed = true; return false; };
  await web({}, deps);
  const launch = calls.find((c) => c[0] === 'launch');
  assert.ok(launch, 'launch called');
  assert.equal(launch[1], process.cwd(), 'launch dir = process.cwd()');
  assert.equal(launch[2], '/pkg/web-app/dist/index.js', 'bundled entry passed to launch');
  assert.equal(probed, false, 'PATH detect skipped when bundled copy exists');
});

test('no bundled copy + PATH binary → launches in PATH mode (no entry script)', async () => {
  const { calls, deps } = fakeDeps({ bundled: null, path: true });
  await web({}, deps);
  const launch = calls.find((c) => c[0] === 'launch');
  assert.ok(launch, 'launch called');
  assert.equal(launch[2], null, 'no entry script → realLaunch falls back to the PATH binary');
});

test('neither bundled nor PATH → repair hint, no launch', async () => {
  const { calls, deps } = fakeDeps({ bundled: null, path: false });
  await web({}, deps);
  assert.ok(!calls.some((c) => c[0] === 'launch'), 'no launch');
  const logs = logsOf(calls);
  assert.match(logs, /not available/, 'explains unavailability');
  assert.match(logs, /npm i -g @zuzuucodes\/cli/, 'reinstall hint');
  assert.match(logs, /build:web/, 'repo-checkout hint');
});

test('args._[0] dir is resolved absolute and passed to launch', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'zuzuu-web-'));
  try {
    const { calls, deps } = fakeDeps({ bundled: '/pkg/web-app/dist/index.js' });
    await web({ _: [tmp] }, deps);
    const launch = calls.find((c) => c[0] === 'launch');
    assert.equal(launch[1], resolve(tmp), 'launch dir = resolved absolute path');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ── singleton reuse ──────────────────────────────────────────────────────

test('live instance (pid alive + probe answers) → reuse: no spawn, browser opened, url + workspace printed', async () => {
  const { calls, deps } = fakeDeps({ instance: INST, alive: true, probe: true, bundled: '/pkg/x.js' });
  await web({}, deps);
  assert.ok(!calls.some((c) => c[0] === 'launch'), 'no second daemon spawned');
  const open = calls.find((c) => c[0] === 'open');
  assert.ok(open, 'browser opened to the existing instance');
  assert.equal(open[1], 'http://127.0.0.1:7771/?token=tok123', 'same port + token → old tabs stay valid');
  const logs = logsOf(calls);
  assert.match(logs, /already running/, 'reuse stated');
  assert.match(logs, new RegExp(process.cwd().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'workspace path shown (multi-project clarity)');
  assert.match(logs, /7771\/\?token=tok123/, 'url printed');
});

test('stale instance (dead pid) → file removed, fresh spawn, no browser open from the CLI', async () => {
  const { calls, deps } = fakeDeps({
    instance: INST, alive: false, bundled: '/pkg/x.js', instanceFile: '/fake/inst.json',
  });
  await web({}, deps);
  const order = calls.map((c) => c[0]);
  assert.ok(order.indexOf('removeFile') !== -1 && order.indexOf('removeFile') < order.indexOf('launch'),
    'stale file removed before spawning');
  assert.equal(calls.find((c) => c[0] === 'removeFile')[1], '/fake/inst.json');
  assert.ok(!calls.some((c) => c[0] === 'open'), 'fresh daemon self-opens; CLI must not double-open');
});

test('stale instance (pid alive but nothing listening) → treated stale, spawns', async () => {
  const { calls, deps } = fakeDeps({ instance: INST, alive: true, probe: false, bundled: '/pkg/x.js' });
  await web({}, deps);
  assert.ok(calls.some((c) => c[0] === 'removeFile'), 'no-listener file removed');
  assert.ok(calls.some((c) => c[0] === 'launch'), 'spawned fresh');
});

test('fresh spawn: polls the instance file and prints the url WITHOUT opening the browser', async () => {
  const { calls, deps } = fakeDeps({ bundled: '/pkg/x.js' });
  let reads = 0;
  deps.readInstance = () => (++reads >= 3 ? INST : null); // appears on the 3rd poll
  deps.pidAlive = () => true;
  await web({}, deps);
  const logs = logsOf(calls);
  assert.match(logs, /7771\/\?token=tok123/, 'url surfaced from the instance file');
  assert.ok(!calls.some((c) => c[0] === 'open'), 'daemon self-opens on fresh boot');
});

test('fresh spawn: instance file never appears → fallback line', async () => {
  const { calls, deps } = fakeDeps({ bundled: '/pkg/x.js' });
  await web({}, deps);
  assert.match(logsOf(calls), /print its URL/, 'fallback hint kept');
});

// ── --stop ───────────────────────────────────────────────────────────────

test('--stop: SIGTERMs the recorded pid, removes the file, confirms', async () => {
  const { calls, deps } = fakeDeps({ instance: INST, instanceFile: '/fake/inst.json' });
  let killed = false;
  deps.pidAlive = () => !killed; // alive until we TERM it
  deps.killPid = (pid, sig) => { calls.push(['kill', pid, sig]); killed = true; };
  await web({ stop: true }, deps);
  assert.deepEqual(calls.find((c) => c[0] === 'kill').slice(1), [4242, 'SIGTERM']);
  assert.ok(calls.some((c) => c[0] === 'removeFile' && c[1] === '/fake/inst.json'), 'state file removed');
  assert.match(logsOf(calls), /stopped workbench/, 'confirmation printed');
  assert.ok(!calls.some((c) => c[0] === 'launch'), 'no spawn on --stop');
});

test('--stop with no recorded instance → says so, touches nothing', async () => {
  const { calls, deps } = fakeDeps({});
  await web({ stop: true }, deps);
  assert.match(logsOf(calls), /no workbench running/);
  assert.ok(!calls.some((c) => ['kill', 'removeFile', 'launch'].includes(c[0])));
});

test('--stop with a stale (dead) instance → cleans the file, no kill needed', async () => {
  const { calls, deps } = fakeDeps({ instance: INST, alive: false, instanceFile: '/fake/inst.json' });
  await web({ stop: true }, deps);
  assert.ok(!calls.some((c) => c[0] === 'kill'), 'nothing to signal');
  assert.ok(calls.some((c) => c[0] === 'removeFile'), 'stale file cleaned');
  assert.match(logsOf(calls), /stale/, 'explains the cleanup');
});

// ── --status ─────────────────────────────────────────────────────────────

test('--status: running → pid + url, no side effects', async () => {
  const { calls, deps } = fakeDeps({ instance: INST, alive: true, probe: true });
  await web({ status: true }, deps);
  const logs = logsOf(calls);
  assert.match(logs, /workbench running/, 'running state');
  assert.match(logs, /4242/, 'pid shown');
  assert.match(logs, /7771\/\?token=tok123/, 'url shown');
  assert.ok(!calls.some((c) => ['launch', 'open', 'kill', 'removeFile'].includes(c[0])), 'read-only');
});

test('--status: not running → says so, no side effects', async () => {
  const { calls, deps } = fakeDeps({ instance: INST, alive: false });
  await web({ status: true }, deps);
  assert.match(logsOf(calls), /no workbench running/);
  assert.ok(!calls.some((c) => ['launch', 'open', 'kill', 'removeFile'].includes(c[0])), 'read-only');
});

// ── --print-url ────────────────────────────────────────────────────────────

test('--print-url: running → emits ONLY the authed url, no browser, no spawn', async () => {
  const { calls, deps } = fakeDeps({ instance: INST, alive: true, probe: true });
  await web({ 'print-url': true }, deps);
  const logLines = calls.filter((c) => c[0] === 'log').map((c) => c[1]);
  assert.deepEqual(logLines, ['http://127.0.0.1:7771/?token=tok123'], 'sole output is the URL (scriptable)');
  assert.ok(!calls.some((c) => ['launch', 'open', 'kill', 'removeFile'].includes(c[0])), 'read-only');
});

test('--print-url: not running → reports it, no spawn', async () => {
  const { calls, deps } = fakeDeps({ instance: INST, alive: false });
  await web({ 'print-url': true }, deps);
  assert.match(logsOf(calls), /no workbench running/);
  assert.ok(!calls.some((c) => ['launch', 'open'].includes(c[0])), 'no side effects');
});
