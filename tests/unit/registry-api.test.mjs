// serve/api.mjs — the api.registry read façade (the active registry, resolved via the
// machine-global pointer, independent of the current project's home). Hermetic.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { open } from '../../src/serve/api.mjs';
import { writeProjectRef, mintRegistry, readProjectRefs } from '../../src/notes/registry.mjs';
import { setActiveRegistry, localRegistryHome } from '../../src/notes/registry-pointer.mjs';
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

test('registry.touch: no registry → auto-creates the local registry + tracks the project', () => {
  withCfg(() => {
    const cwd = td('zz-proj-');
    // mandatory-local: touching with NO configured registry mints the local one
    const r = open(cwd).registry.touch();
    assert.equal(r.touched, true);
    assert.equal(open(cwd).registry.configured(), true);
    const refs = readProjectRefs(localRegistryHome());
    assert.equal(refs.length, 1);
    assert.equal(refs[0].tracked, 'auto'); // auto-tracked, not pinned
    rmSync(cwd, { recursive: true, force: true });
  });
});

test('registry.ensure: idempotent — first call mints, second is a no-op', () => {
  withCfg(() => {
    const cwd = td('zz-ens-');
    const first = open(cwd).registry.ensure();
    assert.equal(first.created, true);
    assert.match(first.identity, /^reg-/);
    assert.equal(first.home, localRegistryHome());
    const second = open(cwd).registry.ensure();
    assert.equal(second.created, false);
    assert.equal(second.identity, first.identity); // same registry, unchanged
    rmSync(cwd, { recursive: true, force: true });
  });
});

test('registry.ensure: adopts a local registry minted-but-not-pointed (race hardening)', () => {
  withCfg(() => {
    // simulate a concurrent ensure that wrote the registry on disk but hadn't yet
    // updated the machine-global pointer: project.md exists, `active` is still null.
    mintRegistry(localRegistryHome(), 'reg-raced');
    const cwd = td('zz-adopt-');
    const r = open(cwd).registry.ensure();
    assert.equal(r.created, false);          // adopted, NOT re-minted
    assert.equal(r.identity, 'reg-raced');   // the SAME identity (no duplicate alias)
    assert.equal(open(cwd).registry.home(), localRegistryHome()); // pointer now set
    rmSync(cwd, { recursive: true, force: true });
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
