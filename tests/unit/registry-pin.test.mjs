// grow/subscribe.mjs — `zz subscribe` vendors a library module as a GATED proposal
// carrying the source: pin (the items land only on review approve). Hermetic.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { open } from '../../src/serve/api.mjs';
import { mintRegistry } from '../../src/notes/registry.mjs';
import { setActiveRegistry } from '../../src/notes/registry-pointer.mjs';
import { readSourcePin } from '../../src/grow/subscribe.mjs';
import { check } from '../../src/use/check.mjs';
import { homeDir } from '../../src/notes/store.mjs';
import { resetCapabilities } from '../../src/serve/wire.mjs';

/** subscribe + approve every staged item → the vendored module is landed. */
function subscribeAndApprove(api, module) {
  api.registry.subscribe(module);
  for (const s of api.staged(module)) api.approve(module, s.id);
}
const drift = (home) => check({ home }).drifted;

const td = (p) => mkdtempSync(join(tmpdir(), p));

/** A registry home with a `house-style` library module (manifest + two rule items). */
function libraryRegistry() {
  const regHome = td('zz-reg-');
  mintRegistry(regHome, 'reg-lib');
  const mod = join(regHome, 'house-style');
  mkdirSync(join(mod, 'items'), { recursive: true });
  writeFileSync(join(mod, 'module.md'), '---\ntype: module\nid: house-style\ntitle: House Style\n---\nShared conventions.');
  writeFileSync(join(mod, 'items', 'rule-a.md'), '---\ntype: instruction\ntitle: Use tabs\n---\nAlways tabs.');
  writeFileSync(join(mod, 'items', 'rule-b.md'), '---\ntype: instruction\ntitle: No trailing whitespace\n---\nTrim it.');
  return regHome;
}

function withCfg(fn) {
  const cfg = td('zz-cfg-');
  const prev = process['env'].ZUZUU_HOME;
  process['env'].ZUZUU_HOME = cfg;
  resetCapabilities();
  try { return fn(); }
  finally {
    if (prev === undefined) delete process['env'].ZUZUU_HOME; else process['env'].ZUZUU_HOME = prev;
    resetCapabilities();
    rmSync(cfg, { recursive: true, force: true });
  }
}

test('subscribe stages create proposals (pending, NOT landed) + writes the source pin', () => {
  withCfg(() => {
    const regHome = libraryRegistry();
    setActiveRegistry('reg-lib', regHome);
    const proj = td('zz-proj-');
    const api = open(proj);

    const r = api.registry.subscribe('house-style');
    assert.equal(r.ok, true);
    assert.equal(r.staged, 2);
    assert.equal(r.pin.registry, 'reg-lib');
    assert.equal(r.pin.mode, 'suggested');
    assert.match(r.pin.digest, /^sha256:/);

    // the items are STAGED, not landed (the gate)
    const staged = api.staged('house-style');
    assert.equal(staged.length, 2);
    assert.ok(staged.every((s) => s.op === 'create'));

    // the manifest carries the source pin
    const pin = readSourcePin(homeDir(proj), 'house-style');
    assert.equal(pin.registry, 'reg-lib');
    assert.equal(pin.module, 'house-style');
    assert.equal(pin.mode, 'suggested');

    rmSync(regHome, { recursive: true, force: true });
    rmSync(proj, { recursive: true, force: true });
  });
});

test('approving a subscribed proposal lands the vendored note', () => {
  withCfg(() => {
    const regHome = libraryRegistry();
    setActiveRegistry('reg-lib', regHome);
    const proj = td('zz-proj2-');
    const api = open(proj);
    api.registry.subscribe('house-style');

    const staged = api.staged('house-style');
    const res = api.approve('house-style', staged[0].id);
    assert.equal(res.ok, true);
    // the note now exists as a real item
    const items = api.query('house-style', { text: '', full: true, limit: 100 });
    assert.equal((items.value?.rows ?? []).length, 1); // one landed, one still pending

    rmSync(regHome, { recursive: true, force: true });
    rmSync(proj, { recursive: true, force: true });
  });
});

test('subscribe with no active registry → throws a clear error', () => {
  withCfg(() => {
    const proj = td('zz-proj3-');
    assert.throws(() => open(proj).registry.subscribe('house-style'), /no active registry/);
    rmSync(proj, { recursive: true, force: true });
  });
});

// ── U7: zz check drift ────────────────────────────────────────────────────────

test('check drift: clean subscription (approved) → no drift; pending → no drift', () => {
  withCfg(() => {
    const regHome = libraryRegistry();
    setActiveRegistry('reg-lib', regHome);

    // pending (subscribed, not approved) → not drift (items not landed)
    const pending = td('zz-pend-');
    open(pending).registry.subscribe('house-style');
    assert.deepEqual(drift(homeDir(pending)), []);

    // approved + untouched → no drift
    const clean = td('zz-clean-');
    subscribeAndApprove(open(clean), 'house-style');
    assert.deepEqual(drift(homeDir(clean)), []);

    rmSync(regHome, { recursive: true, force: true });
    rmSync(pending, { recursive: true, force: true });
    rmSync(clean, { recursive: true, force: true });
  });
});

test('check drift: a locally-edited vendored copy → local-edit drift', () => {
  withCfg(() => {
    const regHome = libraryRegistry();
    setActiveRegistry('reg-lib', regHome);
    const proj = td('zz-edit-');
    subscribeAndApprove(open(proj), 'house-style');

    // tamper with a landed vendored note
    writeFileSync(join(homeDir(proj), 'house-style', 'items', 'rule-a.md'), '---\ntype: instruction\ntitle: Use tabs\n---\nEDITED locally.');
    const d = drift(homeDir(proj));
    assert.equal(d.length, 1);
    assert.match(d[0].why, /local edit/);

    rmSync(regHome, { recursive: true, force: true });
    rmSync(proj, { recursive: true, force: true });
  });
});

test('check drift: registry advanced upstream → upstream-advanced drift', () => {
  withCfg(() => {
    const regHome = libraryRegistry();
    setActiveRegistry('reg-lib', regHome);
    const proj = td('zz-up-');
    subscribeAndApprove(open(proj), 'house-style');

    // advance the upstream library module
    writeFileSync(join(regHome, 'house-style', 'items', 'rule-a.md'), '---\ntype: instruction\ntitle: Use tabs\n---\nUPSTREAM changed.');
    const d = drift(homeDir(proj));
    assert.equal(d.length, 1);
    assert.match(d[0].why, /upstream advanced/);

    rmSync(regHome, { recursive: true, force: true });
    rmSync(proj, { recursive: true, force: true });
  });
});

test('check drift: a module with no source pin is ignored', () => {
  withCfg(() => {
    const proj = td('zz-nopin-');
    mkdirSync(join(homeDir(proj), 'knowledge', 'items'), { recursive: true });
    writeFileSync(join(homeDir(proj), 'knowledge', 'module.md'), '---\ntype: module\nid: knowledge\ntitle: Knowledge\n---\n');
    writeFileSync(join(homeDir(proj), 'knowledge', 'items', 'fact.md'), '---\ntype: fact\ntitle: A fact\n---\nx');
    assert.deepEqual(drift(homeDir(proj)), []); // no pin → not checked
    rmSync(proj, { recursive: true, force: true });
  });
});
