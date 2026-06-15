// tests/unit/module-cli.test.mjs — `zuzuu module items|schema` (W24).
// The read surface over the Module Standard: --json document shape, --jsonl
// line-per-item streaming, human view, and the schema source resolution.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { moduleItemsData, moduleSchemaData, setModuleEnabled, moduleOverviewData, createModuleFiles, module as moduleCmd } from '../../zuzuu/commands/module.mjs';
import { serializeEnvelope, PAYLOAD_SCHEMAS } from '../../zuzuu/module/envelope.mjs';
import { normalizeManifest } from '../../zuzuu/module/module.mjs';

const RULE = (id, action, pattern) => serializeEnvelope({
  id, module: 'guardrails', kind: 'rule', title: `${action} ${pattern}`,
  status: 'active', created_at: '2026-06-12T00:00:00Z',
  payload: { action, tool: '*', pattern, reason: `${action} it` }, body: '',
});

function withHome(fn) {
  const root = mkdtempSync(join(tmpdir(), 'zfac-'));
  const dir = join(root, '.zuzuu');
  mkdirSync(dir, { recursive: true });
  try { return fn(dir); } finally { rmSync(root, { recursive: true, force: true }); }
}

test('moduleItemsData: envelope items listed with count; parse errors sit alongside, never thrown', () => {
  withHome((dir) => {
    const items = join(dir, 'guardrails', 'items');
    mkdirSync(items, { recursive: true });
    writeFileSync(join(items, 'a-rule.md'), RULE('a-rule', 'deny', 'rm -rf'));
    writeFileSync(join(items, 'b-rule.md'), RULE('b-rule', 'ask', 'git push'));
    writeFileSync(join(items, 'broken.md'), 'no frontmatter here\n');

    const data = moduleItemsData(dir, 'guardrails');
    assert.equal(data.module, 'guardrails');
    assert.equal(data.count, 2);
    assert.deepEqual(data.items.map((i) => i.id), ['a-rule', 'b-rule']);
    assert.equal(data.items[0].payload.action, 'deny');
    assert.equal(data.errors.length, 1);
    assert.equal(data.errors[0].file, 'broken.md');
  });
});

test('moduleItemsData: actions are dir-shaped (ACTION.md); inbox/proposals excluded', () => {
  withHome((dir) => {
    mkdirSync(join(dir, 'actions', 'greet'), { recursive: true });
    writeFileSync(join(dir, 'actions', 'greet', 'ACTION.md'), serializeEnvelope({
      id: 'greet', module: 'actions', kind: 'script', title: 'Greet',
      status: 'active', created_at: '2026-06-12T00:00:00Z',
      payload: { exec: 'run.mjs' }, body: 'say hello',
    }));
    mkdirSync(join(dir, 'actions', 'inbox', 'pending'), { recursive: true });
    writeFileSync(join(dir, 'actions', 'inbox', 'pending', 'ACTION.md'), serializeEnvelope({
      id: 'pending', module: 'actions', kind: 'runbook', title: 'P',
      status: 'active', created_at: '2026-06-12T00:00:00Z', payload: {}, body: 'x',
    }));

    const data = moduleItemsData(dir, 'actions');
    assert.deepEqual(data.items.map((i) => i.id), ['greet']);
    assert.equal(data.items[0].payload.exec, 'run.mjs');
  });
});

test('moduleItemsData: empty module → count 0, no errors (a bare home is fine)', () => {
  withHome((dir) => {
    const data = moduleItemsData(dir, 'memory');
    assert.deepEqual(data, { module: 'memory', count: 0, items: [], errors: [] });
  });
});

test('--json and --jsonl shapes: document round-trips; jsonl = one parseable line per item', () => {
  withHome((dir) => {
    const items = join(dir, 'knowledge', 'items');
    mkdirSync(items, { recursive: true });
    for (const id of ['k-one', 'k-two', 'k-three']) {
      writeFileSync(join(items, `${id}.md`), serializeEnvelope({
        id, module: 'knowledge', kind: 'fact', title: id,
        status: 'active', created_at: '2026-06-12T00:00:00Z',
        payload: { type: 'fact' }, body: `${id} body`,
      }));
    }
    const data = moduleItemsData(dir, 'knowledge');

    // --json: one document
    const doc = JSON.parse(JSON.stringify(data, null, 2));
    assert.equal(doc.count, 3);
    assert.equal(doc.items[0].payload.type, 'fact');

    // --jsonl: each item serializes to exactly one line, each line parses back
    const lines = data.items.map((i) => JSON.stringify(i));
    assert.equal(lines.length, 3);
    for (const line of lines) {
      assert.ok(!line.includes('\n'));
      const back = JSON.parse(line);
      assert.equal(back.module, 'knowledge');
      assert.ok(back.id.startsWith('k-'));
    }
  });
});

test('moduleSchemaData: home-seeded schema.json wins; absent/broken → built-in default', () => {
  withHome((dir) => {
    // absent → builtin
    let r = moduleSchemaData(dir, 'guardrails');
    assert.equal(r.source, 'builtin');
    assert.deepEqual(r.schema, PAYLOAD_SCHEMAS.guardrails);

    // seeded → home
    mkdirSync(join(dir, 'guardrails'), { recursive: true });
    writeFileSync(join(dir, 'guardrails', 'schema.json'), JSON.stringify({ type: 'object', required: ['action'] }));
    r = moduleSchemaData(dir, 'guardrails');
    assert.equal(r.source, 'home');
    assert.deepEqual(r.schema.required, ['action']);

    // broken seed → builtin, never a throw
    writeFileSync(join(dir, 'guardrails', 'schema.json'), '{nope');
    r = moduleSchemaData(dir, 'guardrails');
    assert.equal(r.source, 'builtin');
  });
});

// ---------------------------------------------------------------------------
// setModuleEnabled — round-trip
// ---------------------------------------------------------------------------
test('setModuleEnabled: disable then enable round-trips manifest correctly', () => {
  withHome((dir) => {
    // Create a declarative module with a module.json
    mkdirSync(join(dir, 'my-mod'), { recursive: true });
    writeFileSync(join(dir, 'my-mod', 'module.json'), JSON.stringify({ id: 'my-mod', title: 'My Mod', enabled: true }, null, 2) + '\n');

    // Disable it
    const r1 = setModuleEnabled(dir, 'my-mod', false);
    assert.equal(r1.ok, true);
    assert.equal(r1.id, 'my-mod');
    assert.equal(r1.enabled, false);

    // Re-read: normalizeManifest should see enabled:false
    const raw1 = JSON.parse(readFileSync(join(dir, 'my-mod', 'module.json'), 'utf8'));
    assert.equal(raw1.enabled, false);
    assert.equal(normalizeManifest(raw1, 'my-mod').enabled, false);

    // Re-enable it
    const r2 = setModuleEnabled(dir, 'my-mod', true);
    assert.equal(r2.ok, true);
    assert.equal(r2.enabled, true);

    const raw2 = JSON.parse(readFileSync(join(dir, 'my-mod', 'module.json'), 'utf8'));
    assert.equal(raw2.enabled, true);
    assert.equal(normalizeManifest(raw2, 'my-mod').enabled, true);
  });
});

test('setModuleEnabled: returns ok:false when module.json is absent', () => {
  withHome((dir) => {
    const r = setModuleEnabled(dir, 'nonexistent-mod', false);
    assert.equal(r.ok, false);
    assert.ok(r.error, 'has error message');
  });
});

// ---------------------------------------------------------------------------
// moduleOverviewData — enabled field
// ---------------------------------------------------------------------------
test('moduleOverviewData: enabled:true for built-in modules (no manifest override)', () => {
  withHome((dir) => {
    const { modules } = moduleOverviewData(dir);
    for (const m of modules) {
      assert.equal(m.enabled, true, `built-in module '${m.id}' should be enabled by default`);
    }
  });
});

test('moduleOverviewData: declarative module with enabled:false reports enabled:false', () => {
  withHome((dir) => {
    mkdirSync(join(dir, 'tasks'), { recursive: true });
    writeFileSync(join(dir, 'tasks', 'module.json'), JSON.stringify({ id: 'tasks', title: 'Tasks', enabled: false }, null, 2) + '\n');
    const { modules } = moduleOverviewData(dir);
    const tasks = modules.find((m) => m.id === 'tasks');
    assert.ok(tasks, 'tasks module is listed');
    assert.equal(tasks.enabled, false);
  });
});

// ---------------------------------------------------------------------------
// createModuleFiles — guided creation (WS-D)
// ---------------------------------------------------------------------------
test('createModuleFiles: writes module.json + schema.json with the right shape', () => {
  withHome((dir) => {
    const r = createModuleFiles(dir, {
      id: 'recipes', title: 'Recipes', tagline: 'cook things',
      capabilities: ['items.collection', 'query.structured', 'mine'],
      kinds: ['note', 'tip'], required: ['body'],
    });
    assert.equal(r.ok, true);
    assert.equal(r.id, 'recipes');
    assert.equal(r.path, join(dir, 'recipes'));

    // module.json: parseable, id/title/tagline/itemsDir + capabilities map
    const manifest = JSON.parse(readFileSync(join(dir, 'recipes', 'module.json'), 'utf8'));
    assert.equal(manifest.id, 'recipes');
    assert.equal(manifest.title, 'Recipes');
    assert.equal(manifest.tagline, 'cook things');
    assert.equal(manifest.itemsDir, 'items');
    // each capability is a key; non-mine → {}, mine → carries the first kind
    assert.deepEqual(manifest.capabilities['items.collection'], {});
    assert.deepEqual(manifest.capabilities['query.structured'], {});
    assert.deepEqual(manifest.capabilities.mine, { kind: 'note' });

    // schema.json: parseable, {kinds, required}
    const schema = JSON.parse(readFileSync(join(dir, 'recipes', 'schema.json'), 'utf8'));
    assert.deepEqual(schema.kinds, ['note', 'tip']);
    assert.deepEqual(schema.required, ['body']);
  });
});

test('createModuleFiles: required defaults to ["body"]; title/tagline fall back', () => {
  withHome((dir) => {
    const r = createModuleFiles(dir, { id: 'notes', capabilities: ['items.collection'], kinds: ['note'] });
    assert.equal(r.ok, true);
    const manifest = JSON.parse(readFileSync(join(dir, 'notes', 'module.json'), 'utf8'));
    assert.equal(manifest.title, 'notes');
    assert.equal(manifest.tagline, '');
    const schema = JSON.parse(readFileSync(join(dir, 'notes', 'schema.json'), 'utf8'));
    assert.deepEqual(schema.required, ['body']);
  });
});

test('createModuleFiles: refuses an existing dir and a bad slug', () => {
  withHome((dir) => {
    mkdirSync(join(dir, 'taken'), { recursive: true });
    const dup = createModuleFiles(dir, { id: 'taken', capabilities: [], kinds: [] });
    assert.equal(dup.ok, false);
    assert.match(dup.error, /already exists/);

    for (const bad of ['Bad', '-leading', 'has space', '../escape', '']) {
      const r = createModuleFiles(dir, { id: bad, capabilities: [], kinds: [] });
      assert.equal(r.ok, false, `'${bad}' should be refused`);
      assert.ok(r.error, 'has an error message');
    }
  });
});

test('createModuleFiles: refuses a reserved built-in slug (even when its dir is unseeded)', () => {
  withHome((dir) => {
    for (const builtin of ['knowledge', 'memory', 'actions', 'instructions', 'guardrails']) {
      const r = createModuleFiles(dir, { id: builtin, capabilities: [], kinds: [] });
      assert.equal(r.ok, false, `'${builtin}' should be refused`);
      assert.match(r.error, /reserved built-in/);
    }
  });
});

// ---------------------------------------------------------------------------
// module enable/disable --json output shapes (F2)
// ---------------------------------------------------------------------------
function inHome(fn) {
  const root = mkdtempSync(join(tmpdir(), 'zfac-cwd-'));
  mkdirSync(join(root, '.zuzuu'), { recursive: true });
  const prev = process.cwd();
  process.chdir(root);
  try { return fn(join(root, '.zuzuu')); } finally { process.chdir(prev); rmSync(root, { recursive: true, force: true }); }
}

test('module disable --json: emits {ok:true,id,enabled} on success', () => {
  inHome((dir) => {
    mkdirSync(join(dir, 'my-mod'), { recursive: true });
    writeFileSync(join(dir, 'my-mod', 'module.json'), JSON.stringify({ id: 'my-mod', enabled: true }, null, 2) + '\n');
    const lines = [];
    moduleCmd({ _: ['disable', 'my-mod'], json: true }, (s) => lines.push(s));
    assert.equal(lines.length, 1);
    assert.deepEqual(JSON.parse(lines[0]), { ok: true, id: 'my-mod', enabled: false });
    assert.equal(process.exitCode ?? 0, 0);
  });
});

test('module enable --json: emits {ok:true,id,enabled:true} on success', () => {
  inHome((dir) => {
    mkdirSync(join(dir, 'my-mod'), { recursive: true });
    writeFileSync(join(dir, 'my-mod', 'module.json'), JSON.stringify({ id: 'my-mod', enabled: false }, null, 2) + '\n');
    const lines = [];
    moduleCmd({ _: ['enable', 'my-mod'], json: true }, (s) => lines.push(s));
    assert.deepEqual(JSON.parse(lines[0]), { ok: true, id: 'my-mod', enabled: true });
  });
});

test('module enable --json: emits {ok:false,error} when module.json is absent (and exits non-zero)', () => {
  inHome(() => {
    process.exitCode = 0;
    const lines = [];
    moduleCmd({ _: ['enable', 'ghost'], json: true }, (s) => lines.push(s));
    assert.equal(lines.length, 1);
    const out = JSON.parse(lines[0]);
    assert.equal(out.ok, false);
    assert.ok(out.error, 'carries an error');
    assert.equal(process.exitCode, 1);
    process.exitCode = 0;
  });
});
