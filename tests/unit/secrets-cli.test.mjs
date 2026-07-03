// §J.3/§J.5 — the `zz secret …` namespace end to end through the real CLI router:
// list/show/check never emit a value and stay agentInvokable read-only; `declare` is
// the ONE write leaf — authoring sugar over `note create` (still no `secret set`/
// `secret create-with-a-value` verb: `declare` has no value flag at all, ever).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from '../../src/cli/index.mjs';
import { COMMANDS } from '../../src/cli/commands.mjs';
import { initHome } from '../../src/cli/init.mjs';
import { resetCapabilities } from '../../src/serve/wire.mjs';

async function withRepo(fn) {
  const cwd = mkdtempSync(join(tmpdir(), 'zz-secret-cli-'));
  resetCapabilities();
  const out = [];
  const io = { cwd, log: (s) => out.push(String(s)) };
  const saved = { ...process.env };
  try { return await fn({ cwd, io, out, text: () => out.join('\n') }); }
  finally {
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
    rmSync(cwd, { recursive: true, force: true }); resetCapabilities();
  }
}

test('the secret namespace is closed: list · show · check stay read + agentInvokable; declare is the one write leaf, operator-only', () => {
  const rows = COMMANDS.filter((c) => !c.alias && c.path[0] === 'secret');
  const subs = rows.map((c) => c.path[1]).sort();
  assert.deepEqual(subs, ['check', 'declare', 'list', 'show']);
  const readOnly = rows.filter((c) => c.path[1] !== 'declare');
  assert.deepEqual(readOnly.map((c) => c.path[1]).sort(), ['check', 'list', 'show']);
  for (const c of readOnly) {
    assert.equal(c.permission, 'read', `'secret ${c.path[1]}' is read-only`);
    assert.equal(c.agentInvokable, true, `'secret ${c.path[1]}' is agent-invokable (a value-safe view)`);
  }
  const declare = rows.find((c) => c.path[1] === 'declare');
  assert.equal(declare.permission, 'write', "'secret declare' mints a note — it's a write");
  assert.equal(declare.agentInvokable, false, "'secret declare' stays on the operator lane, like note create — the agent's channel is still stage→review");
});

test('zz secret list on an empty project: 0 declarations, a helpful next step, never crashes', async () => {
  await withRepo(async ({ io, out }) => {
    initHome(io.cwd);
    const code = await run(['secret', 'list'], io);
    assert.equal(code, 0);
    assert.match(out.join('\n'), /0 declarations/);
  });
});

test('zz secret list/show/check: end to end via note create → never print the value, even under --json', async () => {
  await withRepo(async ({ cwd, io, out }) => {
    initHome(cwd);
    let code = await run(['module', 'new', 'secrets', '--title', 'Secrets'], io);
    assert.equal(code, 0);
    code = await run(['module', 'add-column', 'secrets', 'scope', 'multi'], io);
    assert.equal(code, 0);
    out.length = 0;
    code = await run([
      'note', 'create', 'secrets', 'openai',
      '--change', JSON.stringify({ type: 'secret', name: 'OPENAI_API_KEY', scope: ['module:library'], actor: 'operator-only', rotation_note: 'rotate quarterly' }),
    ], io);
    assert.equal(code, 0, out.join('\n'));

    out.length = 0;
    code = await run(['secret', 'list', '--json'], io);
    assert.equal(code, 0);
    const listed = JSON.parse(out[0]);
    assert.equal(listed.secrets.length, 1);
    assert.equal(listed.secrets[0].name, 'OPENAI_API_KEY');
    assert.equal('value' in listed.secrets[0], false, 'no value key anywhere in the list row');
    assert.doesNotMatch(out.join('\n'), /sk-/, 'no value-shaped string leaks');

    out.length = 0;
    code = await run(['secret', 'show', 'OPENAI_API_KEY', '--json'], io);
    assert.equal(code, 0);
    const shown = JSON.parse(out[0]);
    assert.equal(shown.name, 'OPENAI_API_KEY');
    assert.equal('value' in shown, false);
    assert.equal(shown.available, '✗', 'not set on the host yet');

    out.length = 0;
    code = await run(['secret', 'check', '--json'], io);
    assert.equal(code, 0);
    const checked = JSON.parse(out[0]);
    assert.equal(checked.missing.length, 1);
    assert.match(checked.missing[0].fix, /export OPENAI_API_KEY=/);

    // now set it on the host and re-check
    process.env.OPENAI_API_KEY = 'sk-should-never-print';
    out.length = 0;
    code = await run(['secret', 'check'], io);
    assert.equal(code, 0);
    assert.match(out.join('\n'), /all 1 declared secret/);
    assert.doesNotMatch(out.join('\n'), /sk-should-never-print/);

    out.length = 0;
    code = await run(['secret', 'show', 'OPENAI_API_KEY'], io);
    assert.match(out.join('\n'), /✓/);
    assert.doesNotMatch(out.join('\n'), /sk-should-never-print/, 'show STILL never prints the value, even though it is now set');
    delete process.env.OPENAI_API_KEY;
  });
});

test('zz secret show <unknown> → a clean error, not a crash', async () => {
  await withRepo(async ({ cwd, io, out }) => {
    initHome(cwd);
    const code = await run(['secret', 'show', 'NOPE'], io);
    assert.equal(code, 1);
    assert.match(out.join('\n'), /no secret declared/);
  });
});

test('zz note create secrets <id> --type secret --field value=… is refused by the router the same as any other write door', async () => {
  await withRepo(async ({ cwd, io, out }) => {
    initHome(cwd);
    const code = await run([
      'note', 'create', 'secrets', 'leaky', '--type', 'secret',
      '--field', 'name=LEAKY_KEY', '--field', 'scope=module:x', '--field', 'value=sk-should-be-refused',
    ], io);
    assert.equal(code, 1);
    assert.match(out.join('\n'), /value-bearing field/);
  });
});

// ── zz secret declare — the AUTHORING-ergonomics fix ─────────────────────────────
// THE GAP: `zz note create secrets <id> --type secret --field 'scope=[tool:x]'` lands
// `scope` as the raw STRING "[tool:x]" (not a list) unless the module already has a
// `multi`-typed `scope` column (`zz module add-column secrets scope multi`) — so a
// scoped secret couldn't be authored ergonomically without that extra ceremony.
// `secret declare` closes it: no `--field`, no module/column minting required first.

test('zz secret declare: scope lands as a real LIST — no module/column ceremony first — and passes validation', async () => {
  await withRepo(async ({ cwd, io, out }) => {
    initHome(cwd);
    // deliberately NOT running `module new secrets` / `module add-column … scope multi`
    // first — that's exactly the ceremony this verb makes unnecessary.
    let code = await run([
      'secret', 'declare', 'OPENAI_API_KEY',
      '--scope', 'tool:enrich,module:library', '--scope', 'library:digest-fetch',
      '--actor', 'agent-allowed', '--resolves-from', 'fly', '--rotation', 'rotate quarterly',
    ], io);
    assert.equal(code, 0, out.join('\n'));

    // the note ON DISK: scope is an ARRAY (module item surfaces the raw envelope)
    out.length = 0;
    code = await run(['module', 'item', 'secrets', 'openai-api-key', '--json'], io);
    assert.equal(code, 0, out.join('\n'));
    const item = JSON.parse(out[0]);
    assert.deepEqual(item.scope, ['tool:enrich', 'module:library', 'library:digest-fetch'], 'comma AND repeated --scope both accumulate into one list');
    assert.equal(item.actor, 'agent-allowed');
    assert.equal(item.resolves_from, 'fly');
    assert.equal(item.rotation_note, 'rotate quarterly');
    assert.equal(item.sensitive, true, 'sensitive defaults true');

    // schema validation actually passes (the whole point — a string scope would fail it)
    out.length = 0;
    code = await run(['validate', 'secrets'], io);
    assert.equal(code, 0, out.join('\n'));
    assert.match(out.join('\n'), /all notes valid/);

    // round-trips through the existing read surface
    out.length = 0;
    code = await run(['secret', 'show', 'OPENAI_API_KEY', '--json'], io);
    assert.equal(code, 0);
    const shown = JSON.parse(out[0]);
    assert.equal(shown.scope, 'tool:enrich|module:library|library:digest-fetch');
    assert.equal('value' in shown, false);
  });
});

test('zz secret declare: defaults (id ← slugified name, actor operator-only, resolves-from env, sensitive true), --id/--force overrides', async () => {
  await withRepo(async ({ cwd, io, out }) => {
    initHome(cwd);
    let code = await run(['secret', 'declare', 'CLEARBIT_KEY'], io);
    assert.equal(code, 0, out.join('\n'));

    out.length = 0;
    code = await run(['module', 'item', 'secrets', 'clearbit-key', '--json'], io);
    assert.equal(code, 0, out.join('\n'));
    let item = JSON.parse(out[0]);
    assert.equal(item.actor, 'operator-only');
    assert.equal(item.resolves_from, 'env');
    assert.equal(item.sensitive, true);
    assert.equal(item.scope, undefined, 'no --scope given → absent, not an empty list (fail-closed by omission)');

    // --id overrides the derived slug; --sensitive false; --force upserts
    out.length = 0;
    code = await run(['secret', 'declare', 'CLEARBIT_KEY', '--id', 'clearbit', '--sensitive', 'false', '--force'], io);
    assert.equal(code, 0, out.join('\n'));
    out.length = 0;
    code = await run(['module', 'item', 'secrets', 'clearbit', '--json'], io);
    assert.equal(code, 0, out.join('\n'));
    item = JSON.parse(out[0]);
    assert.equal(item.sensitive, false);
  });
});

test('zz secret declare has no value-bearing flag at all — a stray --value is silently ignored, never lands on the note', async () => {
  await withRepo(async ({ cwd, io, out }) => {
    initHome(cwd);
    const code = await run(['secret', 'declare', 'LEAKY_KEY', '--scope', 'module:x', '--value', 'sk-should-never-land'], io);
    assert.equal(code, 0, out.join('\n'));
    out.length = 0;
    const code2 = await run(['module', 'item', 'secrets', 'leaky-key', '--json'], io);
    assert.equal(code2, 0);
    const item = JSON.parse(out[0]);
    assert.equal('value' in item, false, 'no value key ever reached the note — the verb has no code path that reads --value');
    assert.doesNotMatch(JSON.stringify(item), /sk-should-never-land/);
  });
});

test('zz secret declare refuses a malformed --actor/--resolves-from the same as note create (passed through, not silently coerced)', async () => {
  await withRepo(async ({ cwd, io, out }) => {
    initHome(cwd);
    const code = await run(['secret', 'declare', 'BAD_ACTOR_KEY', '--scope', 'module:x', '--actor', 'bogus'], io);
    assert.equal(code, 1);
    assert.match(out.join('\n'), /actor must be one of operator-only\|agent-allowed/);
  });
});
