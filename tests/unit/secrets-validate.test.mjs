// §J.3/§J.5 — the write-door invariant: a `type: secret` note is a DECLARATION ONLY.
// THE enforcement: validateNote REFUSES any value-bearing field, unconditionally.
// Adversarial-review focus: every forbidden field individually, case-insensitivity,
// that a clean declaration passes, and that the gate (stage→review→evolve) actually
// refuses a poisoned proposal before it ever becomes a note on disk.
//
// BLOCKER B1 (audit 2026-07-03-secrets-review.md): the refusal used to fire only at
// `approve`/commit time — AFTER a poisoned proposal's plaintext already sat in a
// git-TRACKED `staged/*.json` file. The tests below (── the STAGE door ──) now prove
// the refusal fires at `stageChange` itself, before any file is written — see
// src/grow/stage.mjs's `secretStageRefusal`. S1/S2 widen the match from an exact-key
// Set to the substring-shape SECRET_KEY_RE (also recursing into body/nested maps).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  validateNote, SECRET_FORBIDDEN_FIELDS, SECRET_KEY_RE, secretValueLeaks,
  SECRET_ACTORS, SECRET_RESOLVES_FROM,
  isScopeEntry, scopeMatches, secretActorOf, secretResolvesFromOf, secretSensitiveOf,
} from '../../src/notes/validate.mjs';
import { stageChange, listStaged, readStaged } from '../../src/grow/stage.mjs';
import { approve } from '../../src/grow/review.mjs';
import { open } from '../../src/serve/api.mjs';

const CLEAN = { type: 'secret', title: 'OpenAI key', status: 'active', name: 'OPENAI_API_KEY', scope: ['module:library'] };

// ── the value-refusal invariant — THE enforcement ────────────────────────────────

test('validateNote: a clean secret declaration (no value-bearing field) passes', () => {
  const r = validateNote(CLEAN);
  assert.equal(r.ok, true, r.errors.join('; '));
});

test('validateNote: EVERY forbidden field individually refuses the note', () => {
  for (const field of SECRET_FORBIDDEN_FIELDS) {
    const poisoned = { ...CLEAN, [field]: 'sk-live-should-never-land' };
    const r = validateNote(poisoned);
    assert.equal(r.ok, false, `field '${field}' must refuse validation`);
    assert.match(r.errors.join(';'), /value-bearing field/, `field '${field}': the error names the invariant`);
    assert.match(r.errors.join(';'), new RegExp(field), `field '${field}': the error names the offending field`);
  }
});

test('validateNote: forbidden fields are refused CASE-INSENSITIVELY', () => {
  for (const [field, mixedCase] of [['value', 'Value'], ['token', 'TOKEN'], ['password', 'Password'], ['credential', 'CREDENTIAL'], ['key', 'Key'], ['secret', 'Secret']]) {
    const r = validateNote({ ...CLEAN, [mixedCase]: 'sk-live-x' });
    assert.equal(r.ok, false, `mixed-case '${mixedCase}' (canonically '${field}') must still refuse`);
  }
});

test('validateNote: MULTIPLE forbidden fields at once are all named in the error', () => {
  const r = validateNote({ ...CLEAN, value: 'a', token: 'b', password: 'c' });
  assert.equal(r.ok, false);
  const msg = r.errors.join(';');
  assert.match(msg, /value/);
  assert.match(msg, /token/);
  assert.match(msg, /password/);
});

test('validateNote: the value-refusal fires even on an OTHERWISE malformed declaration (checked first, unconditionally)', () => {
  const r = validateNote({ type: 'secret', title: 't', status: 'active', value: 'sk-x' }); // also missing name/scope
  assert.equal(r.ok, false);
  assert.match(r.errors.join(';'), /value-bearing field/);
});

test('validateNote: a legitimate declaration field never false-positives (resolves_from, rotation_note, etc.)', () => {
  const r = validateNote({
    ...CLEAN, resolves_from: 'env', rotation_note: 'rotate quarterly · owner: hkc', sensitive: true, last_used: '2026-07-03', actor: 'operator-only',
  });
  assert.equal(r.ok, true, r.errors.join('; '));
});

// ── the other per-type invariants ────────────────────────────────────────────────

test('validateNote: name is required and env-var-shaped', () => {
  assert.equal(validateNote({ ...CLEAN, name: undefined }).ok, false);
  assert.equal(validateNote({ ...CLEAN, name: '' }).ok, false);
  assert.equal(validateNote({ ...CLEAN, name: 'lower_case_key' }).ok, false, 'not uppercase');
  assert.equal(validateNote({ ...CLEAN, name: '1STARTS_WITH_DIGIT' }).ok, false, 'starts with a digit');
  assert.equal(validateNote({ ...CLEAN, name: 'has spaces' }).ok, false);
  assert.equal(validateNote({ ...CLEAN, name: 'OPENAI_API_KEY' }).ok, true);
  assert.equal(validateNote({ ...CLEAN, name: '_LEADING_UNDERSCORE_OK' }).ok, true);
});

test('validateNote: scope, when present, must be a non-empty list of well-formed entries; absent is OK (fail-closed at resolve time, not a write-door error)', () => {
  assert.equal(validateNote({ ...CLEAN, scope: undefined }).ok, true, 'absent scope is a valid (inert) declaration');
  assert.equal(validateNote({ ...CLEAN, scope: [] }).ok, false, 'present-but-empty is malformed, not just inert');
  assert.equal(validateNote({ ...CLEAN, scope: 'module:library' }).ok, false, 'a bare string, not a list');
  assert.equal(validateNote({ ...CLEAN, scope: ['not a valid entry'] }).ok, false);
  assert.equal(validateNote({ ...CLEAN, scope: ['module:library', 'tool:digest-fetch'] }).ok, true);
});

test('validateNote: actor is one of operator-only|agent-allowed when present', () => {
  assert.equal(validateNote({ ...CLEAN, actor: 'operator-only' }).ok, true);
  assert.equal(validateNote({ ...CLEAN, actor: 'agent-allowed' }).ok, true);
  assert.equal(validateNote({ ...CLEAN, actor: undefined }).ok, true, 'absent is fine (defaults operator-only at read time)');
  const r = validateNote({ ...CLEAN, actor: 'god-mode' });
  assert.equal(r.ok, false);
  assert.match(r.errors.join(';'), /operator-only\|agent-allowed/);
});

test('validateNote: resolves_from is one of env|secrets-file|fly|oidc when present', () => {
  for (const rf of SECRET_RESOLVES_FROM) assert.equal(validateNote({ ...CLEAN, resolves_from: rf }).ok, true, rf);
  assert.equal(validateNote({ ...CLEAN, resolves_from: 'vault' }).ok, false);
});

test('validateNote: sensitive is boolean-ish when present', () => {
  assert.equal(validateNote({ ...CLEAN, sensitive: true }).ok, true);
  assert.equal(validateNote({ ...CLEAN, sensitive: 'false' }).ok, true, 'boolean-ish string tolerated');
  assert.equal(validateNote({ ...CLEAN, sensitive: 'maybe' }).ok, false);
});

// ── the default-resolution helpers (fail-closed defaults) ──────────────────────

test('secretActorOf: absent/garbage defaults to operator-only (fail-closed)', () => {
  assert.equal(secretActorOf({}), 'operator-only');
  assert.equal(secretActorOf({ actor: 'nonsense' }), 'operator-only');
  assert.equal(secretActorOf({ actor: 'agent-allowed' }), 'agent-allowed');
  assert.equal(secretActorOf(null), 'operator-only');
});

test('secretResolvesFromOf: absent/garbage defaults to env', () => {
  assert.equal(secretResolvesFromOf({}), 'env');
  assert.equal(secretResolvesFromOf({ resolves_from: 'nonsense' }), 'env');
  assert.equal(secretResolvesFromOf({ resolves_from: 'oidc' }), 'oidc');
});

test('secretSensitiveOf: absent defaults TRUE (opt-in-fails lesson) — only an explicit false/no/0 flips it', () => {
  assert.equal(secretSensitiveOf({}), true);
  assert.equal(secretSensitiveOf({ sensitive: true }), true);
  assert.equal(secretSensitiveOf({ sensitive: false }), false);
  assert.equal(secretSensitiveOf({ sensitive: 'false' }), false);
  assert.equal(secretSensitiveOf({ sensitive: 'no' }), false);
  assert.equal(secretSensitiveOf({ sensitive: 'garbage' }), true, 'unrecognized string is NOT treated as false');
});

// ── scope shape + matching (validate.mjs's exported pure helpers) ──────────────

test('isScopeEntry: well-formed word:word shapes only', () => {
  assert.equal(isScopeEntry('module:library'), true);
  assert.equal(isScopeEntry('tool:digest-fetch'), true);
  assert.equal(isScopeEntry('library:digest-fetch'), true);
  assert.equal(isScopeEntry('nocol on'), false);
  assert.equal(isScopeEntry(''), false);
  assert.equal(isScopeEntry(null), false);
  assert.equal(isScopeEntry(42), false);
});

test('scopeMatches: an unlisted/absent caller matches nothing — fail-closed', () => {
  assert.equal(scopeMatches(['module:library'], null), false);
  assert.equal(scopeMatches(['module:library'], undefined), false);
  assert.equal(scopeMatches([], 'library:tool'), false);
  assert.equal(scopeMatches(null, 'library:tool'), false);
});

// ── the gate: a poisoned staged proposal is refused BEFORE it becomes a note ────

test('gate: a CLEAN staged secret proposal lands normally (the invariant is precise, not a blanket refusal of type:secret)', () => {
  const root = mkdtempSync(join(tmpdir(), 'zz-secret-gate-clean-'));
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 't@e.com'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 't'], { cwd: root });
  const home = join(root, '.zuzuu');
  const p = stageChange(home, 'secrets', {
    op: 'create', target: 'clean-key',
    change: { type: 'secret', title: 'clean key', name: 'CLEAN_KEY', scope: ['module:x'] },
  });
  const r = approve(home, 'secrets', p.id);
  assert.equal(r.ok, true, r.error);
  rmSync(root, { recursive: true, force: true });
});

// ── BLOCKER B1(a): the STAGE door refuses BEFORE anything touches disk ──────────
// `staged/*.json` is git-TRACKED, not transient (the audit's central finding) — the
// refusal must fire at `stageChange` itself, not three steps later at `approve`.

test('B1(a): stageChange REFUSES a poisoned secret-with-value proposal — an error, not a record', () => {
  const root = mkdtempSync(join(tmpdir(), 'zz-secret-stage-refuse-'));
  const home = join(root, '.zuzuu');
  const p = stageChange(home, 'secrets', {
    op: 'create', target: 'leaky',
    change: { type: 'secret', title: 'leaky', name: 'LEAKY_KEY', scope: ['module:x'], value: 'sk-live-should-be-refused' },
  });
  assert.equal(p.id, undefined, 'a refusal is never a real staged record');
  assert.match(p.error, /value-bearing field/);
  assert.match(p.error, /value/);
  rmSync(root, { recursive: true, force: true });
});

test('B1(a): the refused proposal writes NO staged file — the plaintext never touches disk, not even transiently', () => {
  const root = mkdtempSync(join(tmpdir(), 'zz-secret-stage-nowrite-'));
  const home = join(root, '.zuzuu');
  stageChange(home, 'secrets', {
    op: 'create', target: 'leaky2',
    change: { type: 'secret', title: 'leaky2', name: 'LEAKY_KEY2', scope: ['module:x'], value: 'sk-live-should-never-touch-disk' },
  });
  assert.equal(listStaged(home, 'secrets').length, 0, 'nothing pending');
  const stagedDir = join(home, 'secrets', 'staged');
  const onDisk = existsSync(stagedDir) ? readdirSync(stagedDir, { recursive: true }) : [];
  for (const f of onDisk) assert.ok(!/\.json(\.applied)?$/.test(String(f)), `no proposal/archive file was written (found ${f})`);
  rmSync(root, { recursive: true, force: true });
});

test('B1(a) / B1(c): a refused proposal can never reach staged/archive/ either — there is nothing FOR approve/reject to archive', () => {
  const root = mkdtempSync(join(tmpdir(), 'zz-secret-stage-noarchive-'));
  const home = join(root, '.zuzuu');
  const p = stageChange(home, 'secrets', {
    op: 'create', target: 'leaky3',
    change: { type: 'secret', title: 'leaky3', name: 'LEAKY_KEY3', scope: ['module:x'], value: 'sk-should-never-archive' },
  });
  assert.equal(p.id, undefined);
  // there is no id to approve/reject BY — the caller never gets a handle into the
  // gate at all (confirmed: readStaged finds nothing under any id this content could
  // have hashed to, and archive/ was never created).
  assert.equal(readStaged(home, 'secrets', 'leaky3'), null);
  assert.equal(existsSync(join(home, 'secrets', 'staged', 'archive')), false, 'archive/ was never even created — nothing to archive a value into');
  rmSync(root, { recursive: true, force: true });
});

test('B1(a): an AGENT-actor stage of a poisoned secret is refused identically (stage has no actor branch — human and agent share the one door)', () => {
  const root = mkdtempSync(join(tmpdir(), 'zz-secret-stage-agent-'));
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 't@e.com'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 't'], { cwd: root });
  const zz = open(root, { actor: 'agent' }); // the daemon's / CLI's agent-actor stage route
  const r = zz.stage('secrets', {
    op: 'create', target: 'agent-leaky',
    change: { type: 'secret', title: 'agent leaky', name: 'AGENT_LEAKY_KEY', scope: ['module:x'], value: 'sk-live-agent-should-be-refused' },
  });
  assert.equal(r.id, undefined);
  assert.match(r.error, /value-bearing field/);
  assert.equal(listStaged(zz.home, 'secrets').length, 0);
  rmSync(root, { recursive: true, force: true });
});

test('B1(a): an UPDATE onto an existing type:secret note is also caught (the SAME projectChange commit() would use, not a create-only special case)', () => {
  const root = mkdtempSync(join(tmpdir(), 'zz-secret-stage-update-'));
  const home = join(root, '.zuzuu');
  // land a clean declaration directly (bypassing the gate — a direct write, as a
  // pre-existing note would be) so an UPDATE has something to merge onto.
  mkdirSync(join(home, 'secrets', 'items'), { recursive: true });
  writeFileSync(join(home, 'secrets', 'items', 'existing.md'), '---\ntype: secret\ntitle: existing\nstatus: active\nname: EXISTING_KEY\n---\n');
  const p = stageChange(home, 'secrets', {
    op: 'update', target: 'existing', change: { rotation_note: 'rotate', value: 'sk-live-smuggled-via-update' },
  });
  assert.equal(p.id, undefined, 'the MERGED projection is still type:secret + a value — refused');
  assert.match(p.error, /value-bearing field/);
  rmSync(root, { recursive: true, force: true });
});

// ── S1: the write-door match widened from exact-key to the substring shape
//    SECRET_KEY_RE (log.mjs's canonical matcher) — real-world key names an
//    exact-match Set missed entirely ─────────────────────────────────────────────

test('S1: SECRET_KEY_RE (the shared canonical matcher) catches every real-world key shape the brief names', () => {
  for (const k of ['api_key', 'access_token', 'client_secret', 'apikey', 'pat', 'bearer', 'passphrase', 'privatekey', 'pw', 'GITHUB_PAT', 'db_pw']) {
    assert.ok(SECRET_KEY_RE.test(k), `'${k}' must match the canonical secret-key shape`);
  }
  // a few plausible non-secret field names must NOT collide (false-positive check)
  for (const k of ['name', 'scope', 'actor', 'resolves_from', 'rotation_note', 'sensitive', 'last_used', 'title', 'status', 'source', 'pattern']) {
    assert.ok(!SECRET_KEY_RE.test(k), `'${k}' is a legitimate field — must NOT match`);
  }
});

test('S1: validateNote refuses EVERY widened key shape on a type:secret note (api_key, access_token, client_secret, apikey, pat, bearer, passphrase, privatekey, pw)', () => {
  for (const field of ['api_key', 'access_token', 'client_secret', 'apikey', 'pat', 'bearer', 'passphrase', 'privatekey', 'pw']) {
    const poisoned = { ...CLEAN, [field]: 'sk-live-should-never-land' };
    const r = validateNote(poisoned);
    assert.equal(r.ok, false, `field '${field}' must refuse validation (was previously an exact-match miss)`);
    assert.match(r.errors.join(';'), /value-bearing field/, `field '${field}': the error names the invariant`);
  }
});

// ── S2: the refusal also scans the BODY and one level of NESTED maps ────────────

test('S2: a non-empty body on a type:secret note is refused — a declaration has no prose', () => {
  const r = validateNote({ ...CLEAN, body: 'the key is sk-live-pasted-into-prose' });
  assert.equal(r.ok, false);
  assert.match(r.errors.join(';'), /value-bearing field/);
  assert.match(r.errors.join(';'), /body/);
});

test('S2: an EMPTY body on a type:secret note is correct, not an omission — never refused for that reason', () => {
  const r = validateNote({ ...CLEAN, body: '' });
  assert.equal(r.ok, true, r.errors.join('; '));
});

test('S2: a secret-shaped key ONE LEVEL DEEP in a nested map is refused (e.g. meta: {token: …})', () => {
  const r = validateNote({ ...CLEAN, meta: { token: 'sk-live-nested' } });
  assert.equal(r.ok, false);
  assert.match(r.errors.join(';'), /value-bearing field/);
  assert.match(r.errors.join(';'), /meta\.token/);
});

test('S2: secretValueLeaks is the ONE shared predicate — validateNote and the stage door both call it (no drift)', () => {
  assert.deepEqual(secretValueLeaks({ ...CLEAN, value: 'x' }), ['value']);
  assert.deepEqual(secretValueLeaks({ ...CLEAN, meta: { token: 'x' } }), ['meta.token']);
  assert.deepEqual(secretValueLeaks({ ...CLEAN, body: 'has a secret' }), ['body']);
  assert.deepEqual(secretValueLeaks(CLEAN), [], 'a clean declaration leaks nothing');
});
