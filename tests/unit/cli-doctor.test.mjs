// rung 8d — doctor · status · explain · code (launcher via its deps seam).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { doctorReport, explain } from '../../zuzuu/cli/doctor.mjs';
import { code } from '../../zuzuu/cli/code.mjs';
import { initHome } from '../../zuzuu/cli/init.mjs';
import { run } from '../../zuzuu/cli/index.mjs';
import { resetCapabilities } from '../../zuzuu/capabilities/index.mjs';

function withDir(fn) {
  const cwd = mkdtempSync(join(tmpdir(), 'zuzuu-dr-'));
  resetCapabilities();
  try { return fn(cwd); } finally { rmSync(cwd, { recursive: true, force: true }); resetCapabilities(); }
}

test('doctor: a fresh init reports healthy with the home + hosts', () => {
  withDir((cwd) => {
    initHome(cwd);
    const r = doctorReport(cwd);
    assert.equal(r.ok, true);
    assert.ok(r.info.some((i) => i.includes('5 modules')));
    assert.ok(r.info.some((i) => i.startsWith('hooks:')));
  });
});

test('doctor: no home → a problem, not healthy', () => {
  withDir((cwd) => {
    const r = doctorReport(cwd);
    assert.equal(r.ok, false);
    assert.ok(r.problems.some((p) => p.includes('zz init')));
  });
});

test('doctor: a broken link surfaces as a warning', async () => {
  const { serialize } = await import('../../zuzuu/kernel/item.mjs');
  const { writeFileSync } = await import('node:fs');
  withDir((cwd) => {
    initHome(cwd);
    writeFileSync(join(cwd, '.zuzuu', 'knowledge', 'items', 'dangling.md'),
      serialize({ id: 'dangling', type: 'knowledge', title: 'x', relations: { 'related-to': 'knowledge:ghost' } }));
    const r = doctorReport(cwd);
    assert.ok(r.warnings.some((w) => w.includes('broken link')), 'broken link warned');
  });
});

test('explain: a known topic prints it; no topic lists all', () => {
  const out = [];
  explain('modules', (s) => out.push(s));
  assert.match(out.join('\n'), /guardrails/);
  out.length = 0;
  explain(undefined, (s) => out.push(s));
  assert.match(out.join('\n'), /## loop/);
});

test('code: ensures home, installs on consent, launches (all via injected deps)', () => {
  withDir((cwd) => {
    const calls = [];
    let detected = false;
    const exit = code({ _: [cwd], yes: true }, {
      detect: () => detected,
      install: () => { calls.push('install'); detected = true; return true; },
      launch: ({ cwd: c }) => { calls.push(`launch:${c}`); return 0; },
      runInit: (dir) => { calls.push('init'); initHome(dir); },
      runEnable: () => { calls.push('enable'); },
      log: () => {},
    });
    assert.equal(exit, 0);
    assert.deepEqual(calls, ['init', 'install', 'enable', `launch:${cwd}`]);
  });
});

test('code: a missing directory fails fast', () => {
  assert.equal(code({ _: ['/no/such/dir/xyz'] }, { log: () => {} }), 1);
});

test('run: doctor/status/explain dispatch through the router', async () => {
  await withDir(async (cwd) => {
    initHome(cwd);
    const out = [];
    const io = { cwd, log: (s) => out.push(String(s)) };
    assert.equal(await run(['doctor'], io), 0);
    assert.equal(await run(['status'], io), 0);
    assert.equal(await run(['explain', 'verbs'], io), 0);
    assert.match(out.join('\n'), /healthy/);
    assert.match(out.join('\n'), /hosts\[/);
  });
});
