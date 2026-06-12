import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { web } from '../../zuzuu/commands/web.mjs';

// A deps recorder: every external effect is captured; nothing real runs.
function fakeDeps(over = {}) {
  const calls = [];
  const deps = {
    resolveBundled: () => over.bundled ?? null,
    detectPath: () => over.path ?? false,
    launch: ({ cwd, entryScript }) => { calls.push(['launch', cwd, entryScript ?? null]); },
    log: (...m) => { calls.push(['log', m.join(' ')]); },
  };
  return { calls, deps };
}

test('bundled web-app wins: launches its entry script via node, PATH never probed', () => {
  const { calls, deps } = fakeDeps({ bundled: '/pkg/web-app/dist/index.js' });
  let probed = false;
  deps.detectPath = () => { probed = true; return false; };
  web({}, deps);
  const launch = calls.find((c) => c[0] === 'launch');
  assert.ok(launch, 'launch called');
  assert.equal(launch[1], process.cwd(), 'launch dir = process.cwd()');
  assert.equal(launch[2], '/pkg/web-app/dist/index.js', 'bundled entry passed to launch');
  assert.equal(probed, false, 'PATH detect skipped when bundled copy exists');
});

test('no bundled copy + PATH binary → launches in PATH mode (no entry script)', () => {
  const { calls, deps } = fakeDeps({ bundled: null, path: true });
  web({}, deps);
  const launch = calls.find((c) => c[0] === 'launch');
  assert.ok(launch, 'launch called');
  assert.equal(launch[2], null, 'no entry script → realLaunch falls back to the PATH binary');
});

test('neither bundled nor PATH → repair hint, no launch', () => {
  const { calls, deps } = fakeDeps({ bundled: null, path: false });
  web({}, deps);
  assert.ok(!calls.some((c) => c[0] === 'launch'), 'no launch');
  const logs = calls.filter((c) => c[0] === 'log').map((c) => c[1]).join('\n');
  assert.match(logs, /not available/, 'explains unavailability');
  assert.match(logs, /npm i -g @zuzuucodes\/cli/, 'reinstall hint');
  assert.match(logs, /build:web/, 'repo-checkout hint');
});

test('args._[0] dir is resolved absolute and passed to launch', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'zuzuu-web-'));
  try {
    const { calls, deps } = fakeDeps({ bundled: '/pkg/web-app/dist/index.js' });
    web({ _: [tmp] }, deps);
    const launch = calls.find((c) => c[0] === 'launch');
    assert.equal(launch[1], resolve(tmp), 'launch dir = resolved absolute path');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
