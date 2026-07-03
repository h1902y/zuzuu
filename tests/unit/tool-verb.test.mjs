// tests/unit/tool-verb.test.mjs — the `tool list`/`tool show` toolkit/tool VIEW
// (§I.6 MCP-native model): module=toolkit, `type: action` note=tool, a module's
// typed-column schema=the tool's inputSchema. Read-only — never runs anything
// (binding DISPATCH is covered by act-gate.test.mjs / workflow-composition.test.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from '../../src/cli/index.mjs';
import { initHome } from '../../src/cli/init.mjs';
import { serialize } from '../../src/notes/note.mjs';
import { ensureModuleManifest } from '../../src/notes/module-templates.mjs';
import { resetCapabilities } from '../../src/serve/wire.mjs';

async function withRepo(fn) {
  const cwd = mkdtempSync(join(tmpdir(), 'zz-toolverb-'));
  resetCapabilities();
  const out = [];
  const io = { cwd, log: (s) => out.push(String(s)) };
  try { return await fn({ cwd, home: join(cwd, '.zuzuu'), io, out }); }
  finally { rmSync(cwd, { recursive: true, force: true }); resetCapabilities(); }
}
const writeNote = (home, module, id, n) => {
  ensureModuleManifest(home, module);
  mkdirSync(join(home, module, 'items'), { recursive: true });
  writeFileSync(join(home, module, 'items', `${id}.md`), serialize({ id, ...n }));
};
const writeManifest = (home, module, n) => {
  mkdirSync(join(home, module), { recursive: true });
  writeFileSync(join(home, module, 'module.md'), serialize({ id: module, type: 'module', ...n }));
};

test('tool list: every action note across every module, grouped by toolkit', async () => {
  await withRepo(async ({ home, io, out }) => {
    initHome(io.cwd);
    writeNote(home, 'actions', 'rebuild', { type: 'action', title: 'Rebuild', run: 'echo hi' });
    writeNote(home, 'crm', 'enrich', { type: 'action', title: 'Enrich lead', binding: 'agent', prompt: 'go find the lead' });
    writeNote(home, 'knowledge', 'fact', { type: 'knowledge', title: 'a fact' }); // NOT a tool — excluded
    out.length = 0;
    assert.equal(await run(['tool', 'list'], io), 0);
    const text = out.join('\n');
    assert.match(text, /tools\[2\]/);
    assert.match(text, /actions,actions:rebuild,shell,Rebuild/);
    assert.match(text, /crm,crm:enrich,agent,Enrich lead/);
    assert.ok(!text.includes('knowledge:fact'), 'a non-action note is not a tool');
  });
});

test('tool list --json: toolkits[] nests each module\'s tools + carries inputSchema/secrets', async () => {
  await withRepo(async ({ home, io, out }) => {
    initHome(io.cwd);
    writeManifest(home, 'crm', {
      title: 'CRM', note_type: 'action', capabilities: ['query', 'check', 'act'],
      fields: [{ name: 'lead_url', type: 'link', required: true }, { name: 'notes', type: 'longtext' }],
    });
    writeNote(home, 'crm', 'enrich', { type: 'action', title: 'Enrich lead', run: 'python3 enrich.py', secrets: ['CLEARBIT_KEY'] });
    out.length = 0;
    assert.equal(await run(['tool', 'list', '--json'], io), 0);
    const doc = JSON.parse(out[0]);
    assert.equal(doc.toolkits.length, 1);
    const crm = doc.toolkits[0];
    assert.equal(crm.module, 'crm');
    assert.equal(crm.tools.length, 1);
    const tool = crm.tools[0];
    assert.equal(tool.addr, 'crm:enrich');
    assert.equal(tool.binding, 'shell');
    assert.equal(tool.target, 'python3 enrich.py');
    assert.deepEqual(tool.secrets, ['CLEARBIT_KEY']);
    assert.equal(tool.inputSchema.length, 2);
    assert.equal(tool.inputSchema[0].name, 'lead_url');
    assert.equal(tool.inputSchema[0].required, true);
  });
});

test('tool list: an empty project (no action notes) is an explicit zero-state, not a crash', async () => {
  await withRepo(async ({ io, out }) => {
    initHome(io.cwd);
    out.length = 0;
    assert.equal(await run(['tool', 'list'], io), 0);
    assert.match(out.join('\n'), /tools\[0\]/);
  });
});

test('tool show <m:id>: the full contract — binding · inputSchema · secrets · target · hitl', async () => {
  await withRepo(async ({ home, io, out }) => {
    initHome(io.cwd);
    writeManifest(home, 'crm', {
      title: 'CRM', note_type: 'action', capabilities: ['query', 'check', 'act'],
      fields: [{ name: 'lead_url', type: 'link', required: true, label: 'Lead URL' }],
      policy: { run: { allow: ['python3', 'curl'] } },
    });
    writeNote(home, 'crm', 'enrich', { type: 'action', title: 'Enrich lead', run: 'python3 enrich.py', secrets: ['CLEARBIT_KEY'] });
    out.length = 0;
    assert.equal(await run(['tool', 'show', 'crm:enrich'], io), 0);
    const text = out.join('\n');
    assert.match(text, /crm:enrich,shell,Enrich lead,CLEARBIT_KEY/);
    assert.match(text, /lead_url/);
    assert.match(text, /target \(shell\): python3 enrich\.py/);
    assert.match(text, /protected.*run\.allow policy.*python3, curl/);
  });
});

test('tool show --json carries the same contract as a structured document', async () => {
  await withRepo(async ({ home, io, out }) => {
    initHome(io.cwd);
    writeNote(home, 'crm', 'ping', { type: 'action', title: 'Ping', binding: 'mcp', mcp: { server: 'zapier', tool: 'ping' } });
    out.length = 0;
    assert.equal(await run(['tool', 'show', 'crm:ping', '--json'], io), 0);
    const doc = JSON.parse(out[0]);
    assert.equal(doc.addr, 'crm:ping');
    assert.equal(doc.binding, 'mcp');
    assert.deepEqual(doc.target, { server: 'zapier', tool: 'ping' });
    assert.match(doc.hitl, /open — no run\.allow policy/);
  });
});

test('tool show: a module with NO run.allow policy is reported "open", not "protected"', async () => {
  await withRepo(async ({ home, io, out }) => {
    initHome(io.cwd);
    writeNote(home, 'actions', 'rebuild', { type: 'action', title: 'Rebuild', run: 'echo hi' });
    out.length = 0;
    assert.equal(await run(['tool', 'show', 'actions:rebuild'], io), 0);
    assert.match(out.join('\n'), /open — no run\.allow policy/);
  });
});

test('tool show: a non-action note is refused with a clear error (not a tool)', async () => {
  await withRepo(async ({ home, io, out }) => {
    initHome(io.cwd);
    writeNote(home, 'knowledge', 'fact', { type: 'knowledge', title: 'a fact' });
    out.length = 0;
    assert.equal(await run(['tool', 'show', 'knowledge:fact'], io), 1);
    assert.match(out.join('\n'), /not a tool \(type: action\)/);
  });
});

test('tool show: a missing note is refused cleanly', async () => {
  await withRepo(async ({ io, out }) => {
    initHome(io.cwd);
    out.length = 0;
    assert.equal(await run(['tool', 'show', 'actions:ghost'], io), 1);
    assert.match(out.join('\n'), /no note 'actions:ghost'/);
  });
});

test('tool show: a malformed address (no module:id) is a usage error', async () => {
  await withRepo(async ({ io, out }) => {
    initHome(io.cwd);
    out.length = 0;
    assert.equal(await run(['tool', 'show', 'not-an-address'], io), 1);
    assert.match(out.join('\n'), /usage: zz tool show/);
  });
});
