// §J.3/§J.5 — use/secrets.mjs's pure resolver: find → scope → actor → host value.
// Adversarial-review focus: every DENY/refuse path returns an error, never a value.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serialize } from '../../src/notes/note.mjs';
import {
  resolveSecret, findDeclaration, listDeclarations, isAvailable, hostSetCommand, SECRETS_MODULE,
} from '../../src/use/secrets.mjs';

function withHome(setup, fn) {
  const root = mkdtempSync(join(tmpdir(), 'zz-secrets-resolve-'));
  const home = join(root, '.zuzuu');
  setup(home);
  const saved = { ...process.env };
  try { return fn(home); } finally {
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
    rmSync(root, { recursive: true, force: true });
  }
}
const writeDecl = (home, id, note) => {
  mkdirSync(join(home, SECRETS_MODULE, 'items'), { recursive: true });
  writeFileSync(join(home, SECRETS_MODULE, 'items', `${id}.md`), serialize({ id, type: 'secret', ...note }));
};

// ── findDeclaration / listDeclarations ───────────────────────────────────────────

test('findDeclaration: matches by the name: FIELD, not the note id', () => {
  withHome((home) => {
    writeDecl(home, 'openai-key', { title: 'OpenAI key', name: 'OPENAI_API_KEY', scope: ['module:library'] });
  }, (home) => {
    const found = findDeclaration(home, 'OPENAI_API_KEY');
    assert.ok(found);
    assert.equal(found.id, 'openai-key');
    const missing = findDeclaration(home, 'NOPE');
    assert.equal(missing, null);
  });
});

test('listDeclarations: every type:secret note in the secrets module, sorted, non-secret notes excluded', () => {
  withHome((home) => {
    writeDecl(home, 'b-key', { name: 'B_KEY', scope: ['module:x'] });
    writeDecl(home, 'a-key', { name: 'A_KEY', scope: ['module:x'] });
    mkdirSync(join(home, SECRETS_MODULE, 'items'), { recursive: true });
    writeFileSync(join(home, SECRETS_MODULE, 'items', 'not-a-secret.md'), serialize({ id: 'not-a-secret', type: 'knowledge', title: 'huh' }));
  }, (home) => {
    const ids = listDeclarations(home).map((d) => d.id);
    assert.deepEqual(ids, ['a-key', 'b-key']);
  });
});

test('listDeclarations/findDeclaration: an empty/absent secrets module is fail-soft, never throws', () => {
  withHome(() => {}, (home) => {
    assert.deepEqual(listDeclarations(home), []);
    assert.equal(findDeclaration(home, 'X'), null);
  });
});

// ── resolveSecret: the happy path ────────────────────────────────────────────────

test('resolveSecret: env resolution, in-scope caller, operator actor → the real value', () => {
  withHome((home) => {
    writeDecl(home, 'clearbit', { name: 'CLEARBIT_KEY', scope: ['module:library', 'tool:digest-fetch'], actor: 'operator-only' });
  }, (home) => {
    process.env.CLEARBIT_KEY = 'sk-real-value';
    const r = resolveSecret(home, 'CLEARBIT_KEY', { caller: 'library:anything', actor: 'operator' });
    assert.equal(r.ok, true);
    assert.equal(r.value, 'sk-real-value');
    assert.equal(r.declaration, 'secrets:clearbit');
    delete process.env.CLEARBIT_KEY;
  });
});

test('resolveSecret: an agent-allowed secret resolves for an agent actor', () => {
  withHome((home) => {
    writeDecl(home, 'weather', { name: 'WEATHER_KEY', scope: ['tool:weather-lookup'], actor: 'agent-allowed' });
  }, (home) => {
    process.env.WEATHER_KEY = 'wk-123';
    const r = resolveSecret(home, 'WEATHER_KEY', { caller: 'actions:weather-lookup', actor: 'agent' });
    assert.equal(r.ok, true);
    assert.equal(r.value, 'wk-123');
    delete process.env.WEATHER_KEY;
  });
});

test('resolveSecret: default actor (absent field) is operator-only — resolves for operator', () => {
  withHome((home) => {
    writeDecl(home, 'no-actor-field', { name: 'DEFAULT_ACTOR_KEY', scope: ['module:x'] });
  }, (home) => {
    process.env.DEFAULT_ACTOR_KEY = 'v';
    const r = resolveSecret(home, 'DEFAULT_ACTOR_KEY', { caller: 'x', actor: 'operator' });
    assert.equal(r.ok, true);
    delete process.env.DEFAULT_ACTOR_KEY;
  });
});

// ── resolveSecret: DENY paths — every one returns an error, NEVER a value ───────

test('resolveSecret: no declaration → error, not a value', () => {
  withHome(() => {}, (home) => {
    const r = resolveSecret(home, 'GHOST_KEY', { caller: 'x', actor: 'operator' });
    assert.equal(r.ok, false);
    assert.equal(r.value, undefined);
    assert.match(r.error, /no secret declared/);
  });
});

test('resolveSecret: caller NOT in scope → deniedBy scope, no value, even though the real env value exists', () => {
  withHome((home) => {
    writeDecl(home, 'scoped', { name: 'SCOPED_KEY', scope: ['module:library'] });
  }, (home) => {
    process.env.SCOPED_KEY = 'this-must-never-leak';
    const r = resolveSecret(home, 'SCOPED_KEY', { caller: 'marketing:blast', actor: 'operator' });
    assert.equal(r.ok, false);
    assert.equal(r.deniedBy, 'scope');
    assert.equal(r.value, undefined);
    assert.doesNotMatch(JSON.stringify(r), /this-must-never-leak/, 'the value never rides in the denial object');
    delete process.env.SCOPED_KEY;
  });
});

test('resolveSecret: an absent/empty scope matches NOTHING — fail-closed, not fail-open', () => {
  withHome((home) => {
    writeDecl(home, 'noscope', { name: 'NOSCOPE_KEY' }); // no scope field at all
  }, (home) => {
    process.env.NOSCOPE_KEY = 'v';
    const r = resolveSecret(home, 'NOSCOPE_KEY', { caller: 'anything:at-all', actor: 'operator' });
    assert.equal(r.ok, false);
    assert.equal(r.deniedBy, 'scope');
    delete process.env.NOSCOPE_KEY;
  });
});

test('resolveSecret: no caller at all → scope-denied, never resolves by default', () => {
  withHome((home) => {
    writeDecl(home, 'x', { name: 'X_KEY', scope: ['module:library'] });
  }, (home) => {
    process.env.X_KEY = 'v';
    const r = resolveSecret(home, 'X_KEY', { actor: 'operator' }); // no caller
    assert.equal(r.ok, false);
    assert.equal(r.deniedBy, 'scope');
    delete process.env.X_KEY;
  });
});

test('resolveSecret: operator-only REFUSES under an agent actor — fail-closed, mirrors the guardrails gate', () => {
  withHome((home) => {
    writeDecl(home, 'money', { name: 'STRIPE_SECRET_KEY', scope: ['tool:billing'], actor: 'operator-only' });
  }, (home) => {
    process.env.STRIPE_SECRET_KEY = 'sk-live-money';
    const r = resolveSecret(home, 'STRIPE_SECRET_KEY', { caller: 'actions:billing', actor: 'agent' });
    assert.equal(r.ok, false);
    assert.equal(r.deniedBy, 'actor');
    assert.equal(r.value, undefined);
    assert.doesNotMatch(JSON.stringify(r), /sk-live-money/);
    // the SAME caller, as an operator, DOES resolve — proves the gate is the actor, not the caller
    const asOperator = resolveSecret(home, 'STRIPE_SECRET_KEY', { caller: 'actions:billing', actor: 'operator' });
    assert.equal(asOperator.ok, true);
    delete process.env.STRIPE_SECRET_KEY;
  });
});

test('resolveSecret: resolves_from=oidc is never resolvable locally, for either actor', () => {
  withHome((home) => {
    writeDecl(home, 'oidcy', { name: 'OIDC_TOKEN', scope: ['module:x'], resolves_from: 'oidc' });
  }, (home) => {
    const r = resolveSecret(home, 'OIDC_TOKEN', { caller: 'x', actor: 'operator' });
    assert.equal(r.ok, false);
    assert.equal(r.deniedBy, 'unresolvable-locally');
    assert.match(r.error, /OIDC/);
  });
});

test('resolveSecret: resolves_from=env, value not set on host → missing, names the export command', () => {
  withHome((home) => {
    writeDecl(home, 'unset', { name: 'TOTALLY_UNSET_KEY', scope: ['module:x'] });
  }, (home) => {
    delete process.env.TOTALLY_UNSET_KEY;
    const r = resolveSecret(home, 'TOTALLY_UNSET_KEY', { caller: 'x', actor: 'operator' });
    assert.equal(r.ok, false);
    assert.equal(r.deniedBy, 'missing');
    assert.match(r.error, /export TOTALLY_UNSET_KEY/);
  });
});

test('resolveSecret: resolves_from=fly reads process.env too (fly injects at boot — no separate get call)', () => {
  withHome((home) => {
    writeDecl(home, 'flykey', { name: 'FLY_INJECTED_KEY', scope: ['module:x'], resolves_from: 'fly' });
  }, (home) => {
    process.env.FLY_INJECTED_KEY = 'fly-value';
    const r = resolveSecret(home, 'FLY_INJECTED_KEY', { caller: 'x', actor: 'operator' });
    assert.equal(r.ok, true);
    assert.equal(r.value, 'fly-value');
    delete process.env.FLY_INJECTED_KEY;
  });
});

test('resolveSecret: resolves_from=fly, missing → names the fly secrets set command', () => {
  withHome((home) => {
    writeDecl(home, 'flymissing', { name: 'FLY_MISSING_KEY', scope: ['module:x'], resolves_from: 'fly' });
  }, (home) => {
    const r = resolveSecret(home, 'FLY_MISSING_KEY', { caller: 'x', actor: 'operator' });
    assert.equal(r.ok, false);
    assert.match(r.error, /fly secrets set/);
  });
});

test('resolveSecret: resolves_from=secrets-file reads the dev-fallback file, not process.env', () => {
  withHome((home) => {
    mkdirSync(home, { recursive: true });
    writeFileSync(join(home, 'secrets.env'), 'FILE_ONLY_KEY=from-the-file\n');
    writeDecl(home, 'filey', { name: 'FILE_ONLY_KEY', scope: ['module:x'], resolves_from: 'secrets-file' });
  }, (home) => {
    process.env.FILE_ONLY_KEY = 'from-process-env-should-not-be-used';
    const r = resolveSecret(home, 'FILE_ONLY_KEY', { caller: 'x', actor: 'operator' });
    assert.equal(r.ok, true);
    assert.equal(r.value, 'from-the-file');
    delete process.env.FILE_ONLY_KEY;
  });
});

// ── scope shapes ─────────────────────────────────────────────────────────────────

test('resolveSecret: scope shapes — module:x (any caller in that module), tool:x (module-agnostic), a bare module:tool address', () => {
  withHome((home) => {
    writeDecl(home, 'moduley', { name: 'MODULE_SCOPED', scope: ['module:library'] });
    writeDecl(home, 'tooly', { name: 'TOOL_SCOPED', scope: ['tool:digest-fetch'] });
    writeDecl(home, 'addry', { name: 'ADDR_SCOPED', scope: ['library:digest-fetch'] });
  }, (home) => {
    process.env.MODULE_SCOPED = 'a'; process.env.TOOL_SCOPED = 'b'; process.env.ADDR_SCOPED = 'c';
    assert.equal(resolveSecret(home, 'MODULE_SCOPED', { caller: 'library:whatever-tool', actor: 'operator' }).ok, true);
    assert.equal(resolveSecret(home, 'MODULE_SCOPED', { caller: 'other:whatever-tool', actor: 'operator' }).ok, false);
    assert.equal(resolveSecret(home, 'TOOL_SCOPED', { caller: 'anymodule:digest-fetch', actor: 'operator' }).ok, true);
    assert.equal(resolveSecret(home, 'TOOL_SCOPED', { caller: 'anymodule:other-tool', actor: 'operator' }).ok, false);
    assert.equal(resolveSecret(home, 'ADDR_SCOPED', { caller: 'library:digest-fetch', actor: 'operator' }).ok, true);
    assert.equal(resolveSecret(home, 'ADDR_SCOPED', { caller: 'library:other-tool', actor: 'operator' }).ok, false);
    delete process.env.MODULE_SCOPED; delete process.env.TOOL_SCOPED; delete process.env.ADDR_SCOPED;
  });
});

// ── isAvailable / hostSetCommand (the doctor-for-secrets primitives) ────────────

test('isAvailable: true/false for env, respects secrets-file, null (n/a) for oidc — never reveals the value', () => {
  withHome((home) => {
    mkdirSync(home, { recursive: true });
    writeFileSync(join(home, 'secrets.env'), 'ON_DISK=x\n');
  }, (home) => {
    process.env.SET_IN_ENV = 'v';
    assert.equal(isAvailable(home, { name: 'SET_IN_ENV' }), true);
    assert.equal(isAvailable(home, { name: 'NOT_SET_ANYWHERE' }), false);
    assert.equal(isAvailable(home, { name: 'ON_DISK', resolves_from: 'secrets-file' }), true);
    assert.equal(isAvailable(home, { name: 'NOT_ON_DISK', resolves_from: 'secrets-file' }), false);
    assert.equal(isAvailable(home, { name: 'ANYTHING', resolves_from: 'oidc' }), null);
    delete process.env.SET_IN_ENV;
  });
});

test('hostSetCommand: names the right terminal call per resolves_from', () => {
  assert.match(hostSetCommand('env', 'X'), /export X=/);
  assert.match(hostSetCommand('fly', 'X'), /fly secrets set X=/);
  assert.match(hostSetCommand('secrets-file', 'X'), /secrets\.env/);
  assert.match(hostSetCommand('oidc', 'X'), /host/);
});
