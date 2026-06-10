import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runAction } from '../../mns/actions/dispatch.mjs';

function withAction(slug, manifest, runBody, fn) {
  const root = mkdtempSync(join(tmpdir(), 'mns-disp-'));
  const dir = join(root, '.mns', 'actions', slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'action.json'), JSON.stringify({ slug, ...manifest }));
  writeFileSync(join(dir, 'run.mjs'), runBody);
  try {
    return fn(join(root, '.mns'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('happy path: validates, runs main, returns structured value', async () => {
  await withAction(
    'greet',
    { inputs: { type: 'object', properties: { who: { type: 'string' } }, required: ['who'] },
      outputs: { type: 'object', properties: { msg: { type: 'string' } } } },
    `export async function main(args) { console.log('side log'); return { msg: 'hi ' + args.who }; }`,
    async (mns) => {
      const r = await runAction(mns, 'greet', { who: 'sam' });
      assert.equal(r.ok, true);
      assert.deepEqual(r.value, { msg: 'hi sam' });
      assert.match(r.logs, /side log/);
    },
  );
});

test('default_args fill in when caller omits them', async () => {
  await withAction(
    'greet2',
    { default_args: { who: 'world' },
      inputs: { type: 'object', properties: { who: { type: 'string' } }, required: ['who'] },
      outputs: { type: 'object' } },
    `export async function main(args) { return { who: args.who }; }`,
    async (mns) => {
      const r = await runAction(mns, 'greet2', {});
      assert.equal(r.ok, true);
      assert.deepEqual(r.value, { who: 'world' });
    },
  );
});

test('a marker-looking line on stderr does not spoof the result', async () => {
  await withAction('spoof',
    { inputs: { type: 'object' }, outputs: { type: 'object', properties: { real: { type: 'boolean' } } } },
    `export async function main(){ console.error('__MNS_ACT_RESULT__' + JSON.stringify({ ok:true, value:{ real:false } })); return { real: true }; }`,
    async (mns) => {
      const r = await runAction(mns, 'spoof', {});
      assert.equal(r.ok, true);
      assert.deepEqual(r.value, { real: true }); // the real stdout marker, not the stderr fake
    });
});

test('a marker substring mid-log-line is ignored (anchored at line start)', async () => {
  await withAction('embed',
    { inputs: { type: 'object' }, outputs: { type: 'object', properties: { done: { type: 'boolean' } } } },
    `export async function main(){ console.log('note: __MNS_ACT_RESULT__ appears here'); return { done: true }; }`,
    async (mns) => {
      const r = await runAction(mns, 'embed', {});
      assert.equal(r.ok, true);
      assert.deepEqual(r.value, { done: true });
    });
});

test('a hung action times out cleanly (never hangs mns)', async () => {
  await withAction('hang',
    { inputs: { type: 'object' }, outputs: { type: 'object' } },
    `export async function main(){ await new Promise(r => setInterval(r, 1e9)); }`,
    async (mns) => {
      const r = await runAction(mns, 'hang', {}, { timeoutMs: 500 });
      assert.equal(r.ok, false);
      assert.equal(r.error, 'timeout');
    });
});
