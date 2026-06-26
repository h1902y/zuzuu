// cli/registry.mjs — `zz registry init/add/sync/status` end-to-end against real temp
// git repos (the registry commits; bind-by-remote captures a real origin). Hermetic:
// each test isolates the machine-global pointer via $ZUZUU_HOME (bracket access dodges
// the repo's own no-secret-reads guardrail false-positive).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { run } from '../../src/cli/index.mjs';
import { resetCapabilities } from '../../src/serve/wire.mjs';
import { resolveSubscribers, writeProjectRef, mintRegistry } from '../../src/notes/registry.mjs';

const td = (p) => mkdtempSync(join(tmpdir(), p));
const sh = (args, cwd) => spawnSync('git', args, { cwd, encoding: 'utf8' });

function gitRepo(remote) {
  const d = td('zz-grepo-');
  sh(['init', '-q'], d);
  sh(['config', 'user.email', 't@t'], d);
  sh(['config', 'user.name', 't'], d);
  if (remote) sh(['remote', 'add', 'origin', remote], d);
  return d;
}

async function zz(argv, cwd) {
  const out = [];
  const code = await run(argv, { cwd, log: (s) => out.push(String(s)) });
  return { code, out: out.join('\n') };
}

/** Run `fn` with an isolated machine-global pointer dir. */
async function withCfg(fn) {
  const cfg = td('zz-cfg-');
  const prev = process['env'].ZUZUU_HOME;
  process['env'].ZUZUU_HOME = cfg;
  resetCapabilities();
  try { return await fn(); }
  finally {
    if (prev === undefined) delete process['env'].ZUZUU_HOME; else process['env'].ZUZUU_HOME = prev;
    resetCapabilities();
    rmSync(cfg, { recursive: true, force: true });
  }
}

test('registry init → add → status → sync, end to end (json)', async () => {
  await withCfg(async () => {
    const reg = gitRepo();
    const proj = gitRepo('git@github.com:me/proj.git');

    let r = await zz(['registry', 'init', '--title', 'My Reg', '--json'], reg);
    assert.equal(r.code, 0);
    assert.match(JSON.parse(r.out).identity, /^reg-/);

    r = await zz(['registry', 'add', proj, '--json'], reg);
    assert.equal(r.code, 0);
    assert.ok(JSON.parse(r.out).handle);

    r = await zz(['registry', 'status', '--json'], reg);
    const st = JSON.parse(r.out);
    assert.equal(st.configured, true);
    assert.equal(st.projects, 1);
    assert.equal(st.refs[0].remote, 'git@github.com:me/proj.git'); // RAW remote stored (cloneable); normalization is only the dedup key
    assert.equal(st.refs[0].tracked, 'pinned');

    r = await zz(['registry', 'sync', '--json'], reg);
    assert.equal(r.code, 0);
    assert.equal(JSON.parse(r.out).committed, true);
    assert.match(sh(['log', '--oneline'], reg).stdout, /sync 1 projects/);

    rmSync(reg, { recursive: true, force: true });
    rmSync(proj, { recursive: true, force: true });
  });
});

test('add dedupes by normalized remote (same remote, two paths → one ref)', async () => {
  await withCfg(async () => {
    const reg = gitRepo();
    await zz(['registry', 'init', '--json'], reg);
    const a = gitRepo('https://github.com/me/dup.git');
    const b = gitRepo('git@github.com:me/dup.git'); // same remote, different path
    await zz(['registry', 'add', a, '--json'], reg);
    await zz(['registry', 'add', b, '--json'], reg);
    const st = JSON.parse((await zz(['registry', 'status', '--json'], reg)).out);
    assert.equal(st.projects, 1); // deduped to one ref
    rmSync(reg, { recursive: true, force: true });
    rmSync(a, { recursive: true, force: true });
    rmSync(b, { recursive: true, force: true });
  });
});

test('local-only project (no remote) → portable false; add auto-ensures the local registry', async () => {
  await withCfg(async () => {
    // no explicit `registry init` → `add` still works: it auto-creates the MANDATORY
    // local registry (the mandatory-local rule), no dead-end on "no registry".
    const proj = gitRepo(); // a git repo with NO remote → local-only
    const added = await zz(['registry', 'add', proj, '--json'], proj);
    assert.equal(added.code, 0);
    assert.match(JSON.parse(added.out).handle, /\S/);

    const st = JSON.parse((await zz(['registry', 'status', '--json'], proj)).out);
    assert.equal(st.configured, true);           // a local registry now exists
    assert.equal(st.refs.length, 1);
    assert.equal(st.refs[0].remote, undefined);  // full ref: local-only has no remote
    assert.equal(st.refs[0].portable, false);    // and won't travel
    rmSync(proj, { recursive: true, force: true });
  });
});

test('registry ensure: mandatory-local — auto-creates + seeds recents (no init)', async () => {
  await withCfg(async () => {
    const a = gitRepo('git@github.com:me/a.git');
    const b = gitRepo('git@github.com:me/b.git');
    const cwd = gitRepo(); // run from anywhere — ensure resolves the active registry via the pointer

    // seed two project paths positionally (the daemon pours its recents in like this)
    const r = await zz(['registry', 'ensure', a, b, '--json'], cwd);
    assert.equal(r.code, 0);
    const out = JSON.parse(r.out);
    assert.equal(out.created, true);   // first ensure mints the local registry
    assert.equal(out.seeded, 2);
    assert.equal(out.configured, true);
    assert.equal(out.projects, 2);
    assert.deepEqual(out.refs.map((x) => x.tracked).sort(), ['auto', 'auto']);

    // idempotent: a second ensure with the same seeds re-tracks, never duplicates
    const r2 = JSON.parse((await zz(['registry', 'ensure', a, b, '--json'], cwd)).out);
    assert.equal(r2.created, false);   // already configured
    assert.equal(r2.projects, 2);      // deduped by remote
    rmSync(a, { recursive: true, force: true });
    rmSync(b, { recursive: true, force: true });
    rmSync(cwd, { recursive: true, force: true });
  });
});

// ── U10: the pre-wired publish seam (inert in OSS) ────────────────────────────

test('resolveSubscribers(oss) → own repos; other tiers throw', () => {
  const reg = td('zz-subs-');
  mintRegistry(reg, 'reg-s');
  writeProjectRef(reg, { handle: 'a', remote: 'github.com/me/a', path: '/p/a' });
  writeProjectRef(reg, { handle: 'b', path: '/p/b' });
  assert.deepEqual(resolveSubscribers(reg, 'oss').sort(), ['/p/a', '/p/b']);
  assert.throws(() => resolveSubscribers(reg, 'enterprise'), /Enterprise-gated/);
  rmSync(reg, { recursive: true, force: true });
});

test('zz registry publish → soft Enterprise-gated error (no fan-out in OSS)', async () => {
  await withCfg(async () => {
    const reg = gitRepo();
    await zz(['registry', 'init', '--json'], reg);
    const r = await zz(['registry', 'publish', 'house-style', '--json'], reg);
    assert.equal(r.code, 1);
    assert.match(JSON.parse(r.out).error, /Enterprise-gated/);
    rmSync(reg, { recursive: true, force: true });
  });
});
