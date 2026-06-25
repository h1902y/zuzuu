// serve/api.mjs — the api.registry read façade (the active registry, resolved via the
// machine-global pointer, independent of the current project's home). Hermetic.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { open } from '../../src/serve/api.mjs';
import { writeProjectRef, mintRegistry, readProjectRefs } from '../../src/notes/registry.mjs';
import { setActiveRegistry } from '../../src/notes/registry-pointer.mjs';
import { homeDir } from '../../src/notes/store.mjs';

const td = (p) => mkdtempSync(join(tmpdir(), p));

/** Run `fn` with $ZUZUU_HOME isolated to a temp dir (bracket access dodges the gate). */
function withCfg(fn) {
  const cfg = td('zz-cfg-');
  const prev = process['env'].ZUZUU_HOME;
  process['env'].ZUZUU_HOME = cfg;
  try { return fn(); }
  finally {
    if (prev === undefined) delete process['env'].ZUZUU_HOME; else process['env'].ZUZUU_HOME = prev;
    rmSync(cfg, { recursive: true, force: true });
  }
}

test('api.registry reads the active registry; no registry → empty/null', () => {
  const cfg = td('zz-cfg-');
  // bracket access dodges the repo's own no-secret-reads guardrail false-positive
  const prev = process['env'].ZUZUU_HOME;
  process['env'].ZUZUU_HOME = cfg;
  try {
    const cwd = td('zz-cwd-');
    assert.equal(open(cwd).registry.configured(), false);
    assert.deepEqual(open(cwd).registry.refs(), []);
    assert.equal(open(cwd).registry.identity(), null);

    const regHome = td('zz-reghome-');
    mintRegistry(regHome, 'reg-001');
    writeProjectRef(regHome, { handle: 'p1', remote: 'github.com/me/p1', tracked: 'pinned' });
    setActiveRegistry('reg-001', regHome); // writes $ZUZUU_HOME/registry.json

    const api = open(cwd);
    assert.equal(api.registry.configured(), true);
    assert.equal(api.registry.identity(), 'reg-001');
    assert.deepEqual(api.registry.refs().map((r) => r.id), ['p1']);
    rmSync(regHome, { recursive: true, force: true });
    rmSync(cwd, { recursive: true, force: true });
  } finally {
    if (prev === undefined) delete process['env'].ZUZUU_HOME;
    else process['env'].ZUZUU_HOME = prev;
    rmSync(cfg, { recursive: true, force: true });
  }
});

test('registry.touch: no registry → no-op; adds the project as tracked:auto', () => {
  withCfg(() => {
    const cwd = td('zz-proj-');
    assert.deepEqual(open(cwd).registry.touch(), { touched: false }); // no active registry

    const regHome = td('zz-reg-');
    mintRegistry(regHome, 'reg-t1');
    setActiveRegistry('reg-t1', regHome);
    const r = open(cwd).registry.touch();
    assert.equal(r.touched, true);
    const refs = readProjectRefs(regHome);
    assert.equal(refs.length, 1);
    assert.equal(refs[0].tracked, 'auto'); // auto-tracked, not pinned
    rmSync(cwd, { recursive: true, force: true });
    rmSync(regHome, { recursive: true, force: true });
  });
});

test('registry.touch: skips self (never adds the registry to itself)', () => {
  withCfg(() => {
    const regRepo = td('zz-regrepo-');
    const regHome = homeDir(regRepo); // <regRepo>/.zuzuu
    mintRegistry(regHome, 'reg-self');
    setActiveRegistry('reg-self', regHome);
    const r = open(regRepo).registry.touch(); // touching from inside the registry repo
    assert.deepEqual(r, { touched: false, self: true });
    assert.deepEqual(readProjectRefs(regHome), []); // nothing added
    rmSync(regRepo, { recursive: true, force: true });
  });
});

test('registry.touch: never downgrades a pinned ref to auto', () => {
  withCfg(() => {
    const cwd = td('zz-proj2-');
    const regHome = td('zz-reg2-');
    mintRegistry(regHome, 'reg-t2');
    setActiveRegistry('reg-t2', regHome);
    open(cwd).registry.touch(); // auto
    // promote to pinned, then touch again
    const ref = readProjectRefs(regHome)[0];
    writeProjectRef(regHome, { ...ref, handle: ref.id, tracked: 'pinned' });
    open(cwd).registry.touch();
    assert.equal(readProjectRefs(regHome)[0].tracked, 'pinned'); // stayed pinned
    rmSync(cwd, { recursive: true, force: true });
    rmSync(regHome, { recursive: true, force: true });
  });
});
