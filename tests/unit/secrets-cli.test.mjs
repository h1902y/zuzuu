// §J.3/§J.5 — the `zz secret …` namespace end to end through the real CLI router:
// list/show/check never emit a value, `secret list` is agentInvokable read-only, and
// `note create` is the ONLY creation path (no `secret create`/`secret set` verb exists).
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

test('the secret namespace is closed: list · show · check, all read + agentInvokable — no create/set/write verb', () => {
  const rows = COMMANDS.filter((c) => !c.alias && c.path[0] === 'secret');
  const subs = rows.map((c) => c.path[1]).sort();
  assert.deepEqual(subs, ['check', 'list', 'show']);
  for (const c of rows) {
    assert.equal(c.permission, 'read', `'secret ${c.path[1]}' is read-only`);
    assert.equal(c.agentInvokable, true, `'secret ${c.path[1]}' is agent-invokable (a value-safe view)`);
  }
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
