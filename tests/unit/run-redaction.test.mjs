// Safety floor (§I rung 3), feature 3 — secrets never land in runs.jsonl.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serialize } from '../../src/notes/note.mjs';
import { readManifest } from '../../src/notes/module.mjs';
import { redactInputs, readSecretValues, REDACTED, logRun, read } from '../../src/notes/log.mjs';
import { act } from '../../src/use/act.mjs';

function withHome(setup, fn) {
  const root = mkdtempSync(join(tmpdir(), 'zz-redact-'));
  const home = join(root, '.zuzuu');
  setup(home);
  try { return fn(home); } finally { rmSync(root, { recursive: true, force: true }); }
}
const writeZu = (home, module, id, note) => {
  mkdirSync(join(home, module, 'items'), { recursive: true });
  writeFileSync(join(home, module, 'items', `${id}.md`), serialize({ id, ...note }));
};
const writeManifest = (home, module, note) => {
  mkdirSync(join(home, module), { recursive: true });
  writeFileSync(join(home, module, 'module.md'), serialize({ type: 'module', id: module, ...note }));
};

// ── redactInputs (pure) ──────────────────────────────────────────────────────

test('redactInputs: a secret-shaped KEY is redacted regardless of value', () => {
  const out = redactInputs({
    apiKey: 'sk-live-abc123',
    AUTH_TOKEN: 'xyz',
    db_password: 'hunter2',
    credential: 'c',
    plain: 'harmless',
  });
  assert.equal(out.apiKey, REDACTED);
  assert.equal(out.AUTH_TOKEN, REDACTED);
  assert.equal(out.db_password, REDACTED);
  assert.equal(out.credential, REDACTED);
  assert.equal(out.plain, 'harmless', 'a non-secret-shaped key survives untouched');
});

test('redactInputs: a VALUE exactly matching a known secret is redacted regardless of key', () => {
  const out = redactInputs({ note_body: 'sk-live-abc123', unrelated: 'sk-live-abc123-longer' }, ['sk-live-abc123']);
  assert.equal(out.note_body, REDACTED, 'exact match on an innocuous key still redacts');
  assert.equal(out.unrelated, 'sk-live-abc123-longer', 'a near-miss (substring, not exact) is NOT redacted');
});

test('redactInputs: never mutates the original object; empty/non-object inputs pass through', () => {
  const original = { apiKey: 'x' };
  const out = redactInputs(original);
  assert.notEqual(out, original);
  assert.equal(original.apiKey, 'x', 'the source object is untouched');
  assert.deepEqual(redactInputs({}), {});
  assert.equal(redactInputs(null), null);
});

// ── readSecretValues ──────────────────────────────────────────────────────────

test('readSecretValues: parses KEY=value lines, skips comments/blank, returns VALUES only', () => {
  withHome((home) => {
    mkdirSync(home, { recursive: true });
    writeFileSync(join(home, 'secrets.env'), '# comment\nCLEARBIT_KEY=sk-abc\n\nDB_PASSWORD=hunter2\nMALFORMED\n');
  }, (home) => {
    const values = readSecretValues(home);
    assert.deepEqual(values.sort(), ['hunter2', 'sk-abc'].sort());
  });
});

test('readSecretValues: fail-soft — missing file returns []', () => {
  withHome(() => {}, (home) => {
    assert.deepEqual(readSecretValues(home), []);
  });
});

// ── logRun: redacts the LOGGED copy only ─────────────────────────────────────

test('logRun: redacts a secret-shaped key before writing to runs.jsonl', () => {
  withHome(() => {}, (home) => {
    mkdirSync(join(home, 'actions'), { recursive: true });
    logRun(home, 'actions', 'x', { inputs: { apiKey: 'sk-live-secret', note: 'hi' }, exitCode: 0, success: true });
    const logged = read(home, 'actions', 'runs')[0];
    assert.equal(logged.inputs.apiKey, REDACTED);
    assert.equal(logged.inputs.note, 'hi');
  });
});

test('logRun: redacts an input VALUE that matches a secrets.env value, by value not key', () => {
  withHome((home) => {
    mkdirSync(home, { recursive: true });
    writeFileSync(join(home, 'secrets.env'), 'STRIPE_KEY=sk-test-999\n');
  }, (home) => {
    mkdirSync(join(home, 'actions'), { recursive: true });
    logRun(home, 'actions', 'x', { inputs: { comment: 'sk-test-999', other: 'fine' }, exitCode: 0, success: true });
    const logged = read(home, 'actions', 'runs')[0];
    assert.equal(logged.inputs.comment, REDACTED, 'the secrets.env VALUE leaked under an innocuous key — still caught');
    assert.equal(logged.inputs.other, 'fine');
  });
});

// ── act(): end to end — the env passed to the CHILD stays real; only the log redacts ──

test('act: the child process sees the REAL secret value; only runs.jsonl is redacted', () => {
  withHome((home) => {
    writeManifest(home, 'actions', { note_type: 'action' });
    // the child echoes its own env var back on stdout — proves the real value reached it
    writeZu(home, 'actions', 'echo-secret', { type: 'action', title: 'echo', run: 'printenv ZZ_apiKey' });
  }, (home) => {
    const ctx = { home, module: 'actions', manifest: readManifest(home, 'actions') };
    const r = act(ctx, 'echo-secret', { apiKey: 'sk-live-realvalue' });
    assert.equal(r.ok, true);
    assert.match(r.stdout, /sk-live-realvalue/, 'the CHILD got the real, unredacted value');
    const logged = read(home, 'actions', 'runs')[0];
    assert.equal(logged.inputs.apiKey, REDACTED, 'the LOGGED copy is redacted');
  });
});
