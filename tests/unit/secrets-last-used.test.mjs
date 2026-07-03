// §J.3's `last_used` audit column — serve/api.mjs's `act` wrapper touches a resolved
// secret's declaration AFTER a successful resolution, since use/act.mjs itself never
// writes (architecture rule 6). Best-effort: never masks the run's own result, and
// naturally no-ops for an agent actor (the write moat refuses a non-operator commit).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serialize } from '../../src/notes/note.mjs';
import { open } from '../../src/serve/api.mjs';
import { resetCapabilities } from '../../src/serve/wire.mjs';
import { SECRETS_MODULE } from '../../src/use/secrets.mjs';

function withApi(setup, fn) {
  const root = mkdtempSync(join(tmpdir(), 'zz-secrets-lastused-'));
  const home = join(root, '.zuzuu');
  setup(home);
  resetCapabilities();
  const saved = { ...process.env };
  try { return fn(root, home); } finally {
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
    resetCapabilities();
    rmSync(root, { recursive: true, force: true });
  }
}
const writeZu = (home, module, id, note) => {
  mkdirSync(join(home, module, 'items'), { recursive: true });
  writeFileSync(join(home, module, 'items', `${id}.md`), serialize({ id, ...note }));
};
const writeManifest = (home, module, note) => {
  mkdirSync(join(home, module), { recursive: true });
  writeFileSync(join(home, module, 'module.md'), serialize({ type: 'module', id: module, ...note }));
};
const setupOne = (home) => {
  writeManifest(home, 'actions', { note_type: 'action', capabilities: ['query', 'check', 'act'] });
  writeManifest(home, SECRETS_MODULE, { note_type: 'secret', capabilities: ['query', 'check'] });
  writeZu(home, SECRETS_MODULE, 'weather', { type: 'secret', title: 'weather', name: 'WEATHER_KEY', scope: ['module:actions'], actor: 'agent-allowed' });
  writeZu(home, 'actions', 'lookup', { type: 'action', title: 'lookup', run: 'printenv ZZ_WEATHER_KEY', secrets: ['WEATHER_KEY'] });
};

test('api.act: an OPERATOR run that resolves a secret touches its declaration\'s last_used', () => {
  withApi(setupOne, (root, home) => {
    process.env.WEATHER_KEY = 'wk-123';
    const zz = open(root, { actor: 'operator' });
    const r = zz.act('actions', 'lookup');
    assert.equal(r.ok, true);
    assert.equal(r.value.ok, true);
    const raw = readFileSync(join(home, SECRETS_MODULE, 'items', 'weather.md'), 'utf8');
    assert.match(raw, /last_used:/, 'last_used landed on the declaration');
    assert.doesNotMatch(raw, /wk-123/, 'the VALUE never lands on the declaration, even via the audit touch');
    delete process.env.WEATHER_KEY;
  });
});

test('api.act: an AGENT run that resolves an agent-allowed secret does NOT record last_used (write moat: agent commits refuse)', () => {
  withApi(setupOne, (root, home) => {
    process.env.WEATHER_KEY = 'wk-456';
    const zz = open(root, { actor: 'agent' });
    const r = zz.act('actions', 'lookup');
    assert.equal(r.ok, true);
    assert.equal(r.value.ok, true, 'the run itself still succeeds — the touch failing never masks it');
    const raw = readFileSync(join(home, SECRETS_MODULE, 'items', 'weather.md'), 'utf8');
    assert.doesNotMatch(raw, /last_used:/, 'an agent-actor run cannot write — no audit entry, and no crash either');
    delete process.env.WEATHER_KEY;
  });
});

test('api.act: a run with NO secrets: list never touches anything in the secrets module', () => {
  withApi((home) => {
    writeManifest(home, 'actions', { note_type: 'action', capabilities: ['query', 'check', 'act'] });
    writeZu(home, 'actions', 'plain', { type: 'action', title: 'plain', run: 'echo hi' });
  }, (root) => {
    const zz = open(root, { actor: 'operator' });
    const r = zz.act('actions', 'plain');
    assert.equal(r.ok, true);
    assert.equal(r.value.ok, true);
    // no throw, no secrets module touched — nothing to assert on disk beyond "it ran clean"
  });
});

test('api.act: a FAILED secret resolution still returns the denial cleanly — no last_used touch, no crash', () => {
  withApi((home) => {
    writeManifest(home, 'actions', { note_type: 'action', capabilities: ['query', 'check', 'act'] });
    writeManifest(home, SECRETS_MODULE, { note_type: 'secret' });
    writeZu(home, SECRETS_MODULE, 'money', { type: 'secret', title: 'money', name: 'MONEY_KEY', scope: ['module:actions'], actor: 'operator-only' });
    writeZu(home, 'actions', 'spend', { type: 'action', title: 'spend', run: 'echo no', secrets: ['MONEY_KEY'] });
  }, (root, home) => {
    process.env.MONEY_KEY = 'sk-live-money';
    const zz = open(root, { actor: 'agent' });
    const r = zz.act('actions', 'spend');
    assert.equal(r.value.ok, false);
    assert.equal(r.value.ran, false);
    const raw = readFileSync(join(home, SECRETS_MODULE, 'items', 'money.md'), 'utf8');
    assert.doesNotMatch(raw, /last_used:/);
    delete process.env.MONEY_KEY;
  });
});
