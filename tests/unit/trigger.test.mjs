// §I rung 4 — triggers as notes: automation itself is a gated, versioned note.
// Covers BOTH axes: the pre-write shape check (notes/validate.mjs's `type: trigger`
// invariants) and the runtime engine (grow/trigger.mjs's blast-radius + fire path).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateNote, TRIGGER_ON_KINDS, isParseableCronExpr, WHERE_OPS } from '../../src/notes/validate.mjs';
import { createNote } from '../../src/grow/edit.mjs';
import { readNote, listNoteIds, writeNote } from '../../src/notes/repo.mjs';
import { initHome } from '../../src/cli/init.mjs';
import {
  listTriggers, showTrigger, triggerMatches, fireTrigger, setTriggerEnabled, isTriggerEnabled,
  parseClauseString,
} from '../../src/grow/trigger.mjs';
import { startRun } from '../../src/grow/run.mjs';
import { parseWhere } from '../../src/cli/args.mjs';

function withRepo(fn) {
  const cwd = mkdtempSync(join(tmpdir(), 'zz-trigger-'));
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd });
  execFileSync('git', ['config', 'user.email', 't@e.com'], { cwd });
  execFileSync('git', ['config', 'user.name', 't'], { cwd });
  execFileSync('git', ['config', 'commit.gpgsign', 'false'], { cwd });
  try { return fn(cwd); } finally { rmSync(cwd, { recursive: true, force: true }); }
}

const base = { title: 'T', status: 'active' };

// ── validateNote: the trigger axis ──────────────────────────────────────────────

test('TRIGGER_ON_KINDS is the closed set the model brief names', () => {
  assert.deepEqual([...TRIGGER_ON_KINDS].sort(), ['cron', 'ingress', 'manual', 'note-change']);
});

test('validateNote: a manual trigger with a well-formed run target is valid', () => {
  const r = validateNote({ ...base, type: 'trigger', on: { kind: 'manual' }, run: 'actions:flow', enabled: true });
  assert.equal(r.ok, true, r.errors.join('; '));
});

test('validateNote: an ingress trigger (hosted-tier shape, accepted locally) is valid', () => {
  const r = validateNote({ ...base, type: 'trigger', on: { kind: 'ingress' }, run: 'actions:flow' });
  assert.equal(r.ok, true, r.errors.join('; '));
});

test('validateNote: missing `on` entirely is refused', () => {
  const r = validateNote({ ...base, type: 'trigger', run: 'actions:flow' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /needs an on/.test(e)));
});

test('validateNote: an unknown on.kind is refused', () => {
  const r = validateNote({ ...base, type: 'trigger', on: { kind: 'telepathy' }, run: 'actions:flow' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /on\.kind/.test(e)));
});

test('validateNote: a trigger with no run target (or a malformed one) is refused', () => {
  assert.equal(validateNote({ ...base, type: 'trigger', on: { kind: 'manual' } }).ok, false);
  const bad = validateNote({ ...base, type: 'trigger', on: { kind: 'manual' }, run: 'not-an-addr' });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.some((e) => /run target/.test(e)));
});

test('validateNote: a note-change trigger needs a valid event; where clauses must be well-formed', () => {
  const noEvent = validateNote({ ...base, type: 'trigger', on: { kind: 'note-change' }, run: 'actions:flow' });
  assert.equal(noEvent.ok, false);
  assert.ok(noEvent.errors.some((e) => /on\.event/.test(e)));

  const badEvent = validateNote({ ...base, type: 'trigger', on: { kind: 'note-change', event: 'delete' }, run: 'actions:flow' });
  assert.equal(badEvent.ok, false);

  const goodStringClause = validateNote({
    ...base, type: 'trigger', run: 'actions:flow',
    on: { kind: 'note-change', event: 'update', module: 'crm', type: 'lead', where: ['tier>=2'] },
  });
  assert.equal(goodStringClause.ok, true, goodStringClause.errors.join('; '));

  const goodObjectClause = validateNote({
    ...base, type: 'trigger', run: 'actions:flow',
    on: { kind: 'note-change', event: 'create', where: [{ key: 'stage', op: '=', value: 'new' }] },
  });
  assert.equal(goodObjectClause.ok, true, goodObjectClause.errors.join('; '));

  const malformedClause = validateNote({
    ...base, type: 'trigger', run: 'actions:flow',
    on: { kind: 'note-change', event: 'update', where: ['not-a-clause-at-all'] },
  });
  assert.equal(malformedClause.ok, false);
  assert.ok(malformedClause.errors.some((e) => /malformed clause/.test(e)));

  const malformedObject = validateNote({
    ...base, type: 'trigger', run: 'actions:flow',
    on: { kind: 'note-change', event: 'update', where: [{ op: '=', value: 'x' }] }, // no key
  });
  assert.equal(malformedObject.ok, false);

  const whereNotAList = validateNote({
    ...base, type: 'trigger', run: 'actions:flow',
    on: { kind: 'note-change', event: 'update', where: 'tier>=2' },
  });
  assert.equal(whereNotAList.ok, false);
});

// NIT 2 (docs/audits/2026-07-03-triggers-review.md): an operator with NO value after it
// ('tier>=' — a forgotten right-hand side, not an intentional empty-string match) used to
// validate as {op:'>=', value:''}. Also regression-guards the fix's OWN failure mode: a
// naive per-op independent check lets a two-char operator's one-char PREFIX ('>=' -> '>')
// "rescue" the empty-value match by re-scanning the same string with a shorter op.
test('validateNote: a note-change where-clause operator with NO value is refused, for every op', () => {
  for (const op of ['>=', '<=', '!=', '=', '>', '<']) {
    const emptyValue = validateNote({
      ...base, type: 'trigger', run: 'actions:flow',
      on: { kind: 'note-change', event: 'update', where: [`tier${op}`] },
    });
    assert.equal(emptyValue.ok, false, `'tier${op}' (no value) should be refused`);
    assert.ok(emptyValue.errors.some((e) => /malformed clause/.test(e)), `op '${op}': ${emptyValue.errors.join('; ')}`);
  }
  // an OBJECT clause with an explicit empty-string value is a DIFFERENT, deliberate case
  // (matching notes whose field IS an empty string) and stays accepted — unaffected.
  const explicitEmptyObjectValue = validateNote({
    ...base, type: 'trigger', run: 'actions:flow',
    on: { kind: 'note-change', event: 'update', where: [{ key: 'stage', op: '=', value: '' }] },
  });
  assert.equal(explicitEmptyObjectValue.ok, true, explicitEmptyObjectValue.errors.join('; '));
});

test('isParseableCronExpr: the permissive 5-field shape check', () => {
  assert.equal(isParseableCronExpr('0 9 * * 1-5'), true, 'weekday 9am');
  assert.equal(isParseableCronExpr('*/15 * * * *'), true, 'every 15 minutes');
  assert.equal(isParseableCronExpr('0 0 1,15 * *'), true, 'comma list');
  assert.equal(isParseableCronExpr('not a cron'), false);
  assert.equal(isParseableCronExpr('* * * *'), false, 'only 4 fields');
  assert.equal(isParseableCronExpr(''), false);
  assert.equal(isParseableCronExpr(null), false);
});

test('validateNote: a cron trigger needs a parseable on.expr', () => {
  const bad = validateNote({ ...base, type: 'trigger', run: 'actions:flow', on: { kind: 'cron', expr: 'whenever' } });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.some((e) => /on\.expr/.test(e)));
  const good = validateNote({ ...base, type: 'trigger', run: 'actions:flow', on: { kind: 'cron', expr: '0 9 * * *' } });
  assert.equal(good.ok, true, good.errors.join('; '));
});

test('validateNote: enabled must be boolean-ish (tolerates the un-coerced "true"/"false" strings zz stage can land)', () => {
  assert.equal(validateNote({ ...base, type: 'trigger', on: { kind: 'manual' }, run: 'actions:flow', enabled: 'true' }).ok, true);
  assert.equal(validateNote({ ...base, type: 'trigger', on: { kind: 'manual' }, run: 'actions:flow', enabled: 'false' }).ok, true);
  const bad = validateNote({ ...base, type: 'trigger', on: { kind: 'manual' }, run: 'actions:flow', enabled: 'maybe' });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.some((e) => /enabled.*boolean/.test(e)));
});

// ── WHERE_OPS — the trigger filter parser and the query --where parser must accept the
// IDENTICAL op set (NIT 1, docs/audits/2026-07-03-triggers-review.md): before this, the
// same 6 ops were hand-mirrored in five places with nothing pinning them equal — an op
// added to one copy and forgotten in another would silently under-count the blast-radius
// preview (or reject a clause `zz query --where` accepts). Now both parsers import the
// SAME notes/validate.mjs WHERE_OPS constant; this pins their observable BEHAVIOR equal
// too, not just that they happen to reference the same array. ──────────────────────────

test('WHERE_OPS: parseClauseString (trigger blast-radius) and parseWhere (zz query --where) parse every clause IDENTICALLY', () => {
  const clauses = [
    'tier>=2', 'tier<=2', 'tier!=2', 'tier=2', 'tier>2', 'tier<2', // one per op
    'a>=b>=c', // ambiguous but both parsers must resolve it the SAME way
    'not-a-clause-at-all', '', 'tier>=', // malformed/edge inputs
  ];
  for (const c of clauses) {
    assert.deepEqual(parseClauseString(c), parseWhere(c), `identical parse for '${JSON.stringify(c)}'`);
  }
});

test('WHERE_OPS: the canonical op set is exactly the documented 6, longest-first', () => {
  assert.deepEqual(WHERE_OPS, ['>=', '<=', '!=', '=', '>', '<']);
});

// ── isTriggerEnabled — the second-gate coercion (SHOULD-FIX 2, docs/audits/
// 2026-07-03-triggers-review.md): correct by reading, but previously untested on the
// exact STRING path a `zz stage --field enabled=false` proposal lands un-coerced. ──

test('isTriggerEnabled: absent/blank reads as NOT enabled (safe default off)', () => {
  assert.equal(isTriggerEnabled({}), false);
  assert.equal(isTriggerEnabled({ enabled: undefined }), false);
  assert.equal(isTriggerEnabled({ enabled: null }), false);
  assert.equal(isTriggerEnabled({ enabled: '' }), false);
  assert.equal(isTriggerEnabled(null), false, 'a null trigger note never reads enabled');
});

test('isTriggerEnabled: the STRING "false"/"no"/"0" reads as NOT enabled (the exact coercion edge)', () => {
  assert.equal(isTriggerEnabled({ enabled: 'false' }), false);
  assert.equal(isTriggerEnabled({ enabled: 'no' }), false);
  assert.equal(isTriggerEnabled({ enabled: '0' }), false);
  // case-insensitive, matching validate.mjs's COERCIBLE.bool tolerance
  assert.equal(isTriggerEnabled({ enabled: 'FALSE' }), false);
  assert.equal(isTriggerEnabled({ enabled: 'maybe' }), false, 'an unrecognized string is NOT truthy — safe default');
});

test('isTriggerEnabled: the STRING "true"/"yes"/"1" reads as enabled', () => {
  assert.equal(isTriggerEnabled({ enabled: 'true' }), true);
  assert.equal(isTriggerEnabled({ enabled: 'yes' }), true);
  assert.equal(isTriggerEnabled({ enabled: '1' }), true);
  assert.equal(isTriggerEnabled({ enabled: 'TRUE' }), true, 'case-insensitive');
});

test('isTriggerEnabled: a real boolean short-circuits the string table (both directions)', () => {
  assert.equal(isTriggerEnabled({ enabled: true }), true);
  assert.equal(isTriggerEnabled({ enabled: false }), false);
});

test('fireTrigger: refuses when `enabled` is the UN-COERCED STRING "false" (not just the boolean)', () => {
  withRepo((cwd) => {
    initHome(cwd);
    const home = join(cwd, '.zuzuu');
    createNote(home, 'actions', 'flow', { type: 'workflow', title: 'f', steps: [{ id: 'a', run: 'true' }] });
    // {validate:false}: plant the exact shape `zz stage --field enabled=false` lands
    // un-coerced — a string, not a real boolean — bypassing the write-door coercion to
    // exercise fireTrigger's OWN read of it directly.
    writeNote(home, 'actions', 't1', {
      type: 'trigger', title: 'T', status: 'active', on: { kind: 'manual' }, run: 'actions:flow', enabled: 'false',
    }, { validate: false });
    const r = fireTrigger(home, 'actions', 't1');
    assert.equal(r.ok, false);
    assert.equal(r.refused, true);
    assert.match(r.error, /disabled/);
  });
});

// ── the write door: a malformed trigger is refused BEFORE it lands (mirrors validate.test.mjs) ──

test('the gate refuses a malformed trigger note before it is written', () => {
  withRepo((cwd) => {
    initHome(cwd);
    const home = join(cwd, '.zuzuu');
    const r = createNote(home, 'actions', 'bad-trigger', { type: 'trigger', title: 'Bad', on: { kind: 'nonsense' } });
    assert.equal(r.ok, false);
    assert.match(r.error, /on\.kind/);
    assert.equal(readNote(home, 'actions', 'bad-trigger'), null, 'nothing landed');
  });
});

// ── grow/trigger.mjs: blast-radius (triggerMatches) ─────────────────────────────

test('triggerMatches: non-note-change kinds are NOT applicable (n/a, not a misleading 0)', () => {
  withRepo((cwd) => {
    initHome(cwd);
    const home = join(cwd, '.zuzuu');
    const m = triggerMatches(home, { on: { kind: 'manual' } });
    assert.deepEqual(m, { applicable: false, count: 0, sample: [] });
  });
});

test('triggerMatches: counts + samples current notes a note-change filter matches', () => {
  withRepo((cwd) => {
    initHome(cwd);
    const home = join(cwd, '.zuzuu');
    createNote(home, 'actions', 'flow', { type: 'workflow', title: 'f', steps: [{ id: 'a', run: 'true' }] });
    for (const [id, tier] of [['lead-1', 3], ['lead-2', 5], ['lead-3', 1]]) {
      createNote(home, 'actions', id, { type: 'lead', title: id, tier });
    }
    const trigger = { on: { kind: 'note-change', module: 'actions', type: 'lead', event: 'update', where: ['tier>=2'] } };
    const m = triggerMatches(home, trigger, { sampleSize: 5 });
    assert.equal(m.applicable, true);
    assert.equal(m.count, 2, 'lead-1 (tier 3) and lead-2 (tier 5) match tier>=2');
    assert.deepEqual([...m.sample].sort(), ['actions:lead-1', 'actions:lead-2']);
  });
});

test('triggerMatches: an object where-clause works exactly like the string form', () => {
  withRepo((cwd) => {
    initHome(cwd);
    const home = join(cwd, '.zuzuu');
    createNote(home, 'actions', 'lead-a', { type: 'lead', title: 'a', stage: 'new' });
    createNote(home, 'actions', 'lead-b', { type: 'lead', title: 'b', stage: 'won' });
    const trigger = { on: { kind: 'note-change', module: 'actions', event: 'update', where: [{ key: 'stage', op: '=', value: 'new' }] } };
    const m = triggerMatches(home, trigger);
    assert.equal(m.count, 1);
    assert.deepEqual(m.sample, ['actions:lead-a']);
  });
});

test('triggerMatches: a sampleSize caps the sample but not the count', () => {
  withRepo((cwd) => {
    initHome(cwd);
    const home = join(cwd, '.zuzuu');
    for (let i = 0; i < 8; i++) createNote(home, 'actions', `row-${i}`, { type: 'row', title: `r${i}`, hot: 'yes' });
    const trigger = { on: { kind: 'note-change', module: 'actions', type: 'row', event: 'create', where: ['hot=yes'] } };
    const m = triggerMatches(home, trigger, { sampleSize: 3 });
    assert.equal(m.count, 8);
    assert.equal(m.sample.length, 3);
  });
});

// ── listTriggers / showTrigger ───────────────────────────────────────────────────

test('listTriggers: every type:trigger note in the Project, any module, with enabled + blast-radius', () => {
  withRepo((cwd) => {
    initHome(cwd);
    const home = join(cwd, '.zuzuu');
    createNote(home, 'actions', 'flow', { type: 'workflow', title: 'f', steps: [{ id: 'a', run: 'true' }] });
    createNote(home, 'actions', 'lead-1', { type: 'lead', title: 'l1', tier: 3 });
    createNote(home, 'actions', 'manual-t', { type: 'trigger', title: 'Manual', on: { kind: 'manual' }, run: 'actions:flow', enabled: true });
    createNote(home, 'crm', 'watch-leads', {
      type: 'trigger', title: 'Watch leads', run: 'actions:flow', enabled: false,
      on: { kind: 'note-change', module: 'actions', event: 'update', where: ['tier>=2'] },
    });
    const rows = listTriggers(home).sort((a, b) => a.addr.localeCompare(b.addr));
    assert.equal(rows.length, 2);
    const [manualRow, crmRow] = rows; // 'actions:manual-t' sorts before 'crm:watch-leads'
    assert.equal(crmRow.addr, 'crm:watch-leads');
    assert.equal(crmRow.onKind, 'note-change');
    assert.equal(crmRow.enabled, false);
    assert.equal(crmRow.blastRadius, 1, 'lead-1 (tier 3) matches tier>=2');
    assert.equal(manualRow.addr, 'actions:manual-t');
    assert.equal(manualRow.onKind, 'manual');
    assert.equal(manualRow.enabled, true);
    assert.equal(manualRow.blastRadius, null, 'blast-radius is n/a for a non-note-change trigger');
  });
});

test('showTrigger: the full note + enabled + matches; a clean error for a non-trigger/missing addr', () => {
  withRepo((cwd) => {
    initHome(cwd);
    const home = join(cwd, '.zuzuu');
    createNote(home, 'actions', 't1', { type: 'trigger', title: 'T', on: { kind: 'manual' }, run: 'actions:flow', enabled: true });
    const r = showTrigger(home, 'actions', 't1');
    assert.equal(r.ok, true);
    assert.equal(r.enabled, true);
    assert.equal(r.trigger.on.kind, 'manual');

    createNote(home, 'actions', 'notatrigger', { type: 'knowledge', title: 'K' });
    const notTrigger = showTrigger(home, 'actions', 'notatrigger');
    assert.equal(notTrigger.ok, false);
    assert.match(notTrigger.error, /not a trigger/);

    const missing = showTrigger(home, 'actions', 'ghost');
    assert.equal(missing.ok, false);
    assert.match(missing.error, /no note/);
  });
});

// ── setTriggerEnabled — the second gate, round-trip ──────────────────────────────

test('setTriggerEnabled: enable/disable round-trips through a real generation', () => {
  withRepo((cwd) => {
    initHome(cwd);
    const home = join(cwd, '.zuzuu');
    createNote(home, 'actions', 't1', { type: 'trigger', title: 'T', on: { kind: 'manual' }, run: 'actions:flow', enabled: false });
    assert.equal(isTriggerEnabled(readNote(home, 'actions', 't1')), false);

    const on = setTriggerEnabled(home, 'actions', 't1', true);
    assert.equal(on.ok, true);
    assert.equal(isTriggerEnabled(readNote(home, 'actions', 't1')), true);

    const off = setTriggerEnabled(home, 'actions', 't1', false);
    assert.equal(off.ok, true);
    assert.equal(isTriggerEnabled(readNote(home, 'actions', 't1')), false);
  });
});

test('setTriggerEnabled: a clean error for a missing note or a non-trigger note', () => {
  withRepo((cwd) => {
    initHome(cwd);
    const home = join(cwd, '.zuzuu');
    assert.equal(setTriggerEnabled(home, 'actions', 'ghost', true).ok, false);
    createNote(home, 'actions', 'k', { type: 'knowledge', title: 'K' });
    const r = setTriggerEnabled(home, 'actions', 'k', true);
    assert.equal(r.ok, false);
    assert.match(r.error, /not a trigger/);
  });
});

// ── fireTrigger — the fire path ──────────────────────────────────────────────────

test('fireTrigger: an enabled manual trigger starts exactly one durable run', () => {
  withRepo((cwd) => {
    initHome(cwd);
    const home = join(cwd, '.zuzuu');
    createNote(home, 'actions', 'flow', { type: 'workflow', title: 'f', steps: [{ id: 'a', run: 'true' }] });
    createNote(home, 'actions', 't1', {
      type: 'trigger', title: 'T', on: { kind: 'manual' }, run: 'actions:flow', enabled: true, inputs: { lead: 'acme' },
    });
    const r = fireTrigger(home, 'actions', 't1');
    assert.equal(r.ok, true);
    assert.match(r.runId, /^flow-/);
    assert.equal(r.run.status, 'running');
    assert.equal(r.run.inputs.lead, 'acme', "the trigger's own inputs ride along");
    assert.equal(r.wouldFire, 'actions:flow');
  });
});

test('fireTrigger: refuses a disabled trigger; --force overrides', () => {
  withRepo((cwd) => {
    initHome(cwd);
    const home = join(cwd, '.zuzuu');
    createNote(home, 'actions', 'flow', { type: 'workflow', title: 'f', steps: [{ id: 'a', run: 'true' }] });
    createNote(home, 'actions', 't1', { type: 'trigger', title: 'T', on: { kind: 'manual' }, run: 'actions:flow', enabled: false });

    const refused = fireTrigger(home, 'actions', 't1');
    assert.equal(refused.ok, false);
    assert.equal(refused.refused, true);
    assert.match(refused.error, /disabled/);

    const forced = fireTrigger(home, 'actions', 't1', { force: true });
    assert.equal(forced.ok, true);
    assert.match(forced.runId, /^flow-/);
  });
});

test('fireTrigger: --dry-run computes the preview (incl. blast-radius for note-change) but starts NOTHING', () => {
  withRepo((cwd) => {
    initHome(cwd);
    const home = join(cwd, '.zuzuu');
    createNote(home, 'actions', 'flow', { type: 'workflow', title: 'f', steps: [{ id: 'a', run: 'true' }] });
    createNote(home, 'actions', 'lead-1', { type: 'lead', title: 'l1', tier: 3 });
    createNote(home, 'crm', 'watch', {
      type: 'trigger', title: 'W', run: 'actions:flow', enabled: true,
      on: { kind: 'note-change', module: 'actions', event: 'update', where: ['tier>=2'] },
    });
    const r = fireTrigger(home, 'crm', 'watch', { dryRun: true });
    assert.equal(r.ok, true);
    assert.equal(r.dryRun, true);
    assert.equal(r.wouldFire, 'actions:flow');
    assert.equal(r.matches.applicable, true);
    assert.equal(r.matches.count, 1);
    assert.equal(r.runId, undefined, 'no run id — nothing started');
    assert.equal(r.inputs.MATCHED_COUNT, '1', 'the matched-note context rides the preview inputs too');
    assert.equal(r.inputs.MATCHED_SAMPLE, 'actions:lead-1');
    assert.deepEqual(listNoteIds(home, 'runs'), [], 'dry-run starts nothing — the runs module is untouched');
  });
});

test('fireTrigger: a note-change trigger fires ONE run carrying the matched-note context (not one per row)', () => {
  withRepo((cwd) => {
    initHome(cwd);
    const home = join(cwd, '.zuzuu');
    createNote(home, 'actions', 'flow', { type: 'workflow', title: 'f', steps: [{ id: 'a', run: 'true' }] });
    createNote(home, 'actions', 'lead-1', { type: 'lead', title: 'l1', tier: 3 });
    createNote(home, 'actions', 'lead-2', { type: 'lead', title: 'l2', tier: 4 });
    createNote(home, 'crm', 'watch', {
      type: 'trigger', title: 'W', run: 'actions:flow', enabled: true,
      on: { kind: 'note-change', module: 'actions', event: 'update', where: ['tier>=2'] },
    });
    const r = fireTrigger(home, 'crm', 'watch');
    assert.equal(r.ok, true);
    assert.match(r.runId, /^flow-/, 'exactly one run, not two');
    assert.equal(r.run.inputs.MATCHED_COUNT, '2');
    assert.deepEqual(r.run.inputs.MATCHED_SAMPLE.split(',').sort(), ['actions:lead-1', 'actions:lead-2']);
  });
});

test('fireTrigger: a malformed run target is a clean error (defense-in-depth — validateNote already refuses this at the write door; this exercises a hand-edited/legacy file that bypassed it)', () => {
  withRepo((cwd) => {
    initHome(cwd);
    const home = join(cwd, '.zuzuu');
    // {validate:false} plants the bytes directly, bypassing the gate — simulates a
    // foreign/legacy file already on disk, since createNote itself would refuse this.
    writeNote(home, 'actions', 't1', { type: 'trigger', title: 'T', status: 'active', on: { kind: 'manual' }, run: 'not-an-addr', enabled: true }, { validate: false });
    const r = fireTrigger(home, 'actions', 't1');
    assert.equal(r.ok, false);
    assert.match(r.error, /malformed run target/);
  });
});

test('fireTrigger: a run target that is NOT a workflow refuses with the SAME error `run start` gives (documented limitation)', () => {
  withRepo((cwd) => {
    initHome(cwd);
    const home = join(cwd, '.zuzuu');
    createNote(home, 'actions', 'bare-action', { type: 'action', title: 'A', run: 'true' });
    createNote(home, 'actions', 't1', { type: 'trigger', title: 'T', on: { kind: 'manual' }, run: 'actions:bare-action', enabled: true });
    const viaTrigger = fireTrigger(home, 'actions', 't1');
    const viaRunStart = startRun(home, 'actions', 'bare-action');
    assert.equal(viaTrigger.ok, false);
    assert.equal(viaTrigger.error, viaRunStart.error, 'triggers add no new execution authority — same refusal, same wording');
  });
});

test('fireTrigger: a cron trigger fired manually just runs its target once — expr is ignored', () => {
  withRepo((cwd) => {
    initHome(cwd);
    const home = join(cwd, '.zuzuu');
    createNote(home, 'actions', 'flow', { type: 'workflow', title: 'f', steps: [{ id: 'a', run: 'true' }] });
    createNote(home, 'actions', 't1', {
      type: 'trigger', title: 'T', on: { kind: 'cron', expr: '0 9 * * *' }, run: 'actions:flow', enabled: true,
    });
    const r = fireTrigger(home, 'actions', 't1');
    assert.equal(r.ok, true);
    assert.match(r.runId, /^flow-/);
  });
});
