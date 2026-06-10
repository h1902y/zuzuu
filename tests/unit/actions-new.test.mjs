import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scaffoldAction } from '../../mns/commands/act-author.mjs';

function withHome(fn) {
  const root = mkdtempSync(join(tmpdir(), 'mns-new-'));
  mkdirSync(join(root, '.mns', 'actions'), { recursive: true });
  try { return fn(join(root, '.mns')); } finally { rmSync(root, { recursive: true, force: true }); }
}

test('scaffoldAction creates manifest + run.mjs; manifest is valid JSON with the slug', () => {
  withHome((mns) => {
    const r = scaffoldAction(mns, 'deploy-thing');
    assert.equal(r.created.length, 2);
    const dir = join(mns, 'actions', 'deploy-thing');
    assert.ok(existsSync(join(dir, 'action.json')));
    assert.ok(existsSync(join(dir, 'run.mjs')));
    const man = JSON.parse(readFileSync(join(dir, 'action.json'), 'utf8'));
    assert.equal(man.slug, 'deploy-thing');
    assert.ok(readFileSync(join(dir, 'run.mjs'), 'utf8').includes('export async function main'));
  });
});

test('scaffoldAction is no-clobber: existing files survive', () => {
  withHome((mns) => {
    const dir = join(mns, 'actions', 'keep');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'run.mjs'), 'export async function main(){ return { mine: true }; }');
    const r = scaffoldAction(mns, 'keep');
    assert.ok(readFileSync(join(dir, 'run.mjs'), 'utf8').includes('mine: true'), 'user run.mjs untouched');
    assert.ok(r.created.includes('action.json'));
    assert.ok(!r.created.includes('run.mjs'));
  });
});
