// Safety floor (§I rung 3), feature 3 — secrets never land in runs.jsonl.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serialize } from '../../src/notes/note.mjs';
import { readManifest } from '../../src/notes/module.mjs';
import { redactInputs, readSecretValues, readDeclaredSecretEnvValues, REDACTED, logRun, read, redactText } from '../../src/notes/log.mjs';
import { act } from '../../src/use/act.mjs';
import { SECRETS_MODULE } from '../../src/use/secrets.mjs';

function withHome(setup, fn) {
  const root = mkdtempSync(join(tmpdir(), 'zz-redact-'));
  const home = join(root, '.zuzuu');
  setup(home);
  try { return fn(home); } finally { rmSync(root, { recursive: true, force: true }); }
}

// a root-mode home: the repo root itself, marked by a root project.md (see
// tests/unit/root-mode.test.mjs) — home === root, so secrets must resolve via the
// ephemera dir helper (`<root>/.zuzuu/secrets.env`), never a bare `<root>/secrets.env`.
const ROOT_MARKER = serialize({ type: 'project', title: 't', format: 'zuzuu/v2', body: 'root-mode' });
function withRootModeHome(setup, fn) {
  const root = mkdtempSync(join(tmpdir(), 'zz-redact-root-'));
  writeFileSync(join(root, 'project.md'), ROOT_MARKER);
  setup(root);
  try { return fn(root); } finally { rmSync(root, { recursive: true, force: true }); }
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

// ── redactText (pure) — S3's free-text redactor (stdout/stderr, not a k/v map) ──

test('redactText: masks every occurrence of a known secret value inside free text', () => {
  const out = redactText('the key is sk-live-x and again sk-live-x at the end', ['sk-live-x']);
  assert.equal(out, `the key is ${REDACTED} and again ${REDACTED} at the end`);
});

test('redactText: masks MULTIPLE distinct values in one pass', () => {
  const out = redactText('first=aaa second=bbb', ['aaa', 'bbb']);
  assert.equal(out, `first=${REDACTED} second=${REDACTED}`);
});

test('redactText: fail-soft — non-string text, empty text, or no values pass through unchanged', () => {
  assert.equal(redactText(null, ['x']), null);
  assert.equal(redactText(undefined, ['x']), undefined);
  assert.equal(redactText('', ['x']), '');
  assert.equal(redactText('hello', []), 'hello');
  assert.equal(redactText('hello', ['']), 'hello', 'an empty-string value is never a mask target (would redact everything)');
});

test('redactText: a value that never appears leaves the text untouched', () => {
  assert.equal(redactText('nothing secret here', ['sk-not-present']), 'nothing secret here');
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

// SF1 (audit 2026-07-03): root-mode's home IS the repo root, so secrets must resolve
// via the ephemera dir (`<root>/.zuzuu/secrets.env`, gitignored), never a bare
// `<home>/secrets.env` (== `<root>/secrets.env`, un-gitignored, and not where the
// doctrine puts them) — this is the test whose absence hid the bug.
test('readSecretValues: root-mode home resolves via the ephemera dir, not a bare <root>/secrets.env', () => {
  withRootModeHome((root) => {
    // the doctrine-correct location: <root>/.zuzuu/secrets.env (gitignored ephemera)
    mkdirSync(join(root, '.zuzuu'), { recursive: true });
    writeFileSync(join(root, '.zuzuu', 'secrets.env'), 'STRIPE_KEY=sk-test-rootmode\n');
    // a decoy at the OLD, buggy location — must NOT be read
    writeFileSync(join(root, 'secrets.env'), 'DECOY_KEY=sk-test-decoy\n');
  }, (root) => {
    const values = readSecretValues(root); // home === root in root-mode
    assert.deepEqual(values, ['sk-test-rootmode'], 'reads the ephemera-dir secrets file, ignores the un-gitignored decoy at the root');
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

// SF1 (audit 2026-07-03): the same value-under-an-innocuous-key trigger, but on a
// ROOT-MODE home (home === repo root) — this is the test whose absence hid the bug.
// Before the fix, readSecretValues(root) read a nonexistent `<root>/secrets.env`
// (the doctrine-correct file lives at `<root>/.zuzuu/secrets.env`), silently got [],
// and trigger (2) of redactInputs redacted nothing on the real root-mode deployment.
test('logRun: root-mode — a secret value under an innocuous key IS redacted (regression for SF1)', () => {
  withRootModeHome((root) => {
    mkdirSync(join(root, '.zuzuu'), { recursive: true });
    writeFileSync(join(root, '.zuzuu', 'secrets.env'), 'STRIPE_KEY=sk-test-rootmode\n');
  }, (root) => {
    const home = root; // root-mode: home IS the repo root
    mkdirSync(join(home, 'actions'), { recursive: true });
    logRun(home, 'actions', 'x', { inputs: { comment: 'sk-test-rootmode', other: 'fine' }, exitCode: 0, success: true });
    const logged = read(home, 'actions', 'runs')[0];
    assert.equal(logged.inputs.comment, REDACTED, 'root-mode: the secret value leaked under an innocuous key — still caught');
    assert.equal(logged.inputs.other, 'fine');
  });
});

// ── §J.3/§J.5: DECLARED secrets extend the redaction set (readDeclaredSecretEnvValues,
//    logRun's `secretNames` option) — "redact at the injection site": whatever a note's
//    OWN `secrets: [name]` list just resolved to in process.env is masked in ITS log
//    entry, even under an unrelated, innocuous input key. ────────────────────────────

test('readDeclaredSecretEnvValues: reads process.env for the given NAMES only — fail-soft on absent/non-string', () => {
  process.env.ZZ_TEST_DECLARED_KEY = 'declared-value-1';
  try {
    assert.deepEqual(readDeclaredSecretEnvValues(['ZZ_TEST_DECLARED_KEY']), ['declared-value-1']);
    assert.deepEqual(readDeclaredSecretEnvValues(['ZZ_TEST_NOT_SET_ANYWHERE']), [], 'unset name contributes nothing');
    assert.deepEqual(readDeclaredSecretEnvValues([]), []);
    assert.deepEqual(readDeclaredSecretEnvValues(), []);
    assert.deepEqual(readDeclaredSecretEnvValues(null), []);
    assert.deepEqual(readDeclaredSecretEnvValues([42, null]), [], 'non-string names are skipped, never thrown on');
  } finally {
    delete process.env.ZZ_TEST_DECLARED_KEY;
  }
});

test('logRun: secretNames extends the redaction set — a declared secret\'s env value is masked even under an innocuous input key', () => {
  process.env.ZZ_TEST_LOGRUN_SECRET = 'sk-declared-via-secrets-list';
  try {
    withHome(() => {}, (home) => {
      mkdirSync(join(home, 'actions'), { recursive: true });
      logRun(home, 'actions', 'x', {
        inputs: { comment: 'sk-declared-via-secrets-list', other: 'fine' },
        exitCode: 0, success: true, secretNames: ['ZZ_TEST_LOGRUN_SECRET'],
      });
      const logged = read(home, 'actions', 'runs')[0];
      assert.equal(logged.inputs.comment, REDACTED, 'the declared secret\'s value is redacted under an unrelated key');
      assert.equal(logged.inputs.other, 'fine');
    });
  } finally {
    delete process.env.ZZ_TEST_LOGRUN_SECRET;
  }
});

test('logRun: secretNames omitted/empty is a no-op — behavior unchanged from before §J', () => {
  withHome(() => {}, (home) => {
    mkdirSync(join(home, 'actions'), { recursive: true });
    logRun(home, 'actions', 'x', { inputs: { apiKey: 'sk-x' }, exitCode: 0, success: true });
    const logged = read(home, 'actions', 'runs')[0];
    assert.equal(logged.inputs.apiKey, REDACTED, 'the pre-existing key-shape redaction still fires with no secretNames supplied');
  });
});

// ── act(): end to end — the env passed to the CHILD stays real; the log AND (S3) the
//    RETURN both redact a DECLARED secret's resolved value ──────────────────────────

test('act: a RAW (undeclared) input still flows to the child + back through stdout unredacted — S3 only touches DECLARED `secrets:` resolutions, not arbitrary inputs', () => {
  withHome((home) => {
    writeManifest(home, 'actions', { note_type: 'action' });
    // the child echoes its own env var back on stdout — proves the real value reached it
    writeZu(home, 'actions', 'echo-secret', { type: 'action', title: 'echo', run: 'printenv ZZ_apiKey' });
  }, (home) => {
    const ctx = { home, module: 'actions', manifest: readManifest(home, 'actions') };
    const r = act(ctx, 'echo-secret', { apiKey: 'sk-live-realvalue' });
    assert.equal(r.ok, true);
    assert.match(r.stdout, /sk-live-realvalue/, 'a plain input is not a DECLARED secret — S3 does not touch it (documented boundary, not a gap: nothing was ever declared secret here)');
    const logged = read(home, 'actions', 'runs')[0];
    assert.equal(logged.inputs.apiKey, REDACTED, 'the LOGGED copy is still redacted by the pre-existing key-shape heuristic');
  });
});

// S3 (audit 2026-07-03-secrets-review.md): the test this REPLACES used to assert the
// real value survives into `act()`'s RETURN (r.stdout) for a run that resolved a
// DECLARED secret — i.e. it codified the leak as expected behavior. Inverted: the
// return must now be masked; only the child's own env gets the real value.
test('act: S3 — a DECLARED secret\'s value is redacted in the RETURNED stdout, not only runs.jsonl; the return is the caller\'s (agent) context', () => {
  withHome((home) => {
    writeManifest(home, 'actions', { note_type: 'action' });
    writeZu(home, SECRETS_MODULE, 'run-redact-key', { type: 'secret', title: 'run redact key', name: 'RUN_REDACT_KEY', scope: ['module:actions'] });
    // the child echoes its own env var back on stdout — the same shape a leaky tool takes
    writeZu(home, 'actions', 'echo-secret', { type: 'action', title: 'echo', run: 'printenv ZZ_RUN_REDACT_KEY', secrets: ['RUN_REDACT_KEY'] });
  }, (home) => {
    process.env.RUN_REDACT_KEY = 'sk-live-realvalue';
    try {
      const ctx = { home, module: 'actions', manifest: readManifest(home, 'actions') };
      const r = act(ctx, 'echo-secret', {});
      assert.equal(r.ok, true, JSON.stringify(r));
      // the masked marker appearing in stdout is itself the proof the substitution
      // fired (redactText only replaces a substring it actually found) — a run whose
      // child never saw the real value would leave stdout empty, not carrying the mark.
      assert.doesNotMatch(r.stdout, /sk-live-realvalue/, 'S3: the RETURN must not carry the real value');
      assert.match(r.stdout, /‹redacted›/, 'the masked marker takes its place');
      const logged = read(home, 'actions', 'runs')[0];
      assert.doesNotMatch(JSON.stringify(logged), /sk-live-realvalue/, 'runs.jsonl stays clean too (unchanged, pre-existing behavior)');
    } finally {
      delete process.env.RUN_REDACT_KEY;
    }
  });
});

// SF1 (audit 2026-07-03): the same end-to-end proof, on a ROOT-MODE home, with the
// secret riding under an INNOCUOUS key (value-match trigger, not the key-shape
// heuristic) — the exact combination the audit found untested and broken.
test('act: root-mode end to end — a secret under an innocuous key is redacted in the log; the child still gets the real value', () => {
  withRootModeHome((root) => {
    mkdirSync(join(root, '.zuzuu'), { recursive: true });
    writeFileSync(join(root, '.zuzuu', 'secrets.env'), 'STRIPE_KEY=sk-test-rootmode\n');
    writeManifest(root, 'actions', { note_type: 'action' });
    writeZu(root, 'actions', 'echo-secret', { type: 'action', title: 'echo', run: 'printenv ZZ_comment' });
  }, (root) => {
    const home = root; // root-mode: home IS the repo root
    const ctx = { home, module: 'actions', manifest: readManifest(home, 'actions') };
    const r = act(ctx, 'echo-secret', { comment: 'sk-test-rootmode' });
    assert.equal(r.ok, true);
    assert.match(r.stdout, /sk-test-rootmode/, 'the CHILD got the real, unredacted value');
    const logged = read(home, 'actions', 'runs')[0];
    assert.equal(logged.inputs.comment, REDACTED, 'root-mode: LOGGED copy is redacted even though "comment" is not a secret-shaped key');
  });
});
