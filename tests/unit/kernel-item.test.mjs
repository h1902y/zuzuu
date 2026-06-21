// kernel/item.mjs — the one envelope: parse · serialize · validate · id.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, serialize, validate, idFromPath, slugify, deriveTitle } from '../../src/notes/note.mjs';

// ── parse: scalars, the required `type`, fail-soft ──────────────────────────

test('parse: minimal note — only type required', () => {
  const r = parse('---\ntype: knowledge\n---\nA fact.');
  assert.equal(r.ok, true);
  assert.equal(r.item.type, 'knowledge');
  assert.equal(r.item.body, 'A fact.');
});

test('parse: missing type → not ok, but never throws', () => {
  const r = parse('---\ntitle: no type here\n---\nbody');
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('type')));
  assert.equal(r.item.title, 'no type here'); // still parsed, just invalid
});

test('parse: no frontmatter block → fail-soft', () => {
  const r = parse('just a body, no fences');
  assert.equal(r.ok, false);
  assert.equal(r.item, null);
  assert.deepEqual(r.errors, ['no frontmatter block']);
});

test('parse: unknown keys are preserved (OKF — tolerate unknown)', () => {
  const r = parse('---\ntype: knowledge\nzz_custom: hello\nanother_one: 42\n---\nx');
  assert.equal(r.ok, true);
  assert.equal(r.item.zz_custom, 'hello');
  assert.equal(r.item.another_one, '42'); // scalars are strings unless inline-JSON
});

// ── parse: collections — block lists, block maps, inline JSON ──────────────

test('parse: block list of scalars (tags)', () => {
  const r = parse('---\ntype: knowledge\ntags:\n  - client-acme\n  - design\n---\nx');
  assert.deepEqual(r.item.tags, ['client-acme', 'design']);
});

test('parse: block one-level map (relations)', () => {
  const r = parse('---\ntype: knowledge\nrelations:\n  about: client-acme\n  supersedes: v1\n---\nx');
  assert.deepEqual(r.item.relations, { about: 'client-acme', supersedes: 'v1' });
});

test('parse: block list of flat maps (provenance)', () => {
  const r = parse('---\ntype: knowledge\nprovenance:\n  - session: ses_a\n    ref: turn-1\n---\nx');
  assert.deepEqual(r.item.provenance, [{ session: 'ses_a', ref: 'turn-1' }]);
});

test('parse: inline JSON for nested values (policy)', () => {
  const r = parse('---\ntype: action\npolicy: {"tier":"contained","filesystem":{"allowWrite":["./"]}}\n---\nx');
  assert.deepEqual(r.item.policy, { tier: 'contained', filesystem: { allowWrite: ['./'] } });
});

test('parse: inline JSON array (tags one line)', () => {
  const r = parse('---\ntype: knowledge\ntags: ["a","b"]\n---\nx');
  assert.deepEqual(r.item.tags, ['a', 'b']);
});

// ── round-trip: serialize ∘ parse is stable ────────────────────────────────

const rt = (item) => parse(serialize({ ...item, type: item.type ?? 'knowledge' })).item;

test('round-trip: a rich note survives parse∘serialize', () => {
  const src = {
    type: 'action', title: 'Build the report', status: 'active',
    tags: ['reporting', 'decks'],
    relations: { uses: 'client-acme-style' },
    inputs: [{ name: 'client', required: true }],
    policy: { tier: 'contained', filesystem: { allowWrite: ['./'] }, run: { allow: ['pandoc'] } },
    body: 'Generates the weekly deck.',
  };
  const back = rt(src);
  for (const k of Object.keys(src)) assert.deepEqual(back[k], src[k], `key ${k} round-trips`);
});

test('round-trip: serialize is idempotent (parse→serialize→parse stable)', () => {
  const text = serialize({ type: 'knowledge', title: 'x', tags: ['a', 'b'], body: 'hi' });
  const once = parse(text).item;
  const twice = parse(serialize(once)).item;
  assert.deepEqual(twice, once);
});

test('round-trip: scalar quoting — colons, brackets, backslashes (guardrail regex)', () => {
  // the exact no-root-wipe pattern must survive
  const pat = 'rm\\s+-[a-z]*r[a-z]*\\s+/(?![\\w/])';
  const back = rt({ type: 'rule', pattern: pat, note: 'a: b # c', empty: '' });
  assert.equal(back.pattern, pat);
  assert.equal(back.note, 'a: b # c');
  assert.equal(back.empty, '');
});

test('serialize: id is never written to frontmatter (it is the filename)', () => {
  const text = serialize({ id: 'should-not-appear', type: 'knowledge', body: 'x' });
  assert.ok(!text.includes('should-not-appear'));
  assert.ok(text.includes('type: knowledge'));
});

// ── validate: OKF + optional module schema ─────────────────────────────────

test('validate: only type required; unknown keys tolerated', () => {
  assert.equal(validate({ type: 'knowledge', whatever: 1 }).ok, true);
  assert.equal(validate({ title: 'no type' }).ok, false);
});

test('validate: optional schema adds required fields + kind enum', () => {
  const schema = { required: ['title'], kinds: ['action'] };
  assert.equal(validate({ type: 'action', title: 't' }, schema).ok, true);
  assert.equal(validate({ type: 'action' }, schema).ok, false); // missing title
  assert.equal(validate({ type: 'knowledge', title: 't' }, schema).ok, false); // wrong kind
});

// ── id + helpers ────────────────────────────────────────────────────────────

test('idFromPath: id = filename stem', () => {
  assert.equal(idFromPath('/a/b/client-acme-style.md'), 'client-acme-style');
  assert.equal(idFromPath('build-report.md'), 'build-report');
});

test('parse: id is injected by the caller, not read from frontmatter', () => {
  const r = parse('---\ntype: knowledge\n---\nx', { id: 'from-filename' });
  assert.equal(r.item.id, 'from-filename');
});

test('slugify + deriveTitle', () => {
  assert.equal(slugify('Acme Prefers Blue!'), 'acme-prefers-blue');
  assert.equal(deriveTitle('# A Heading\nmore'), 'A Heading');
  assert.equal(deriveTitle('', 'fallback-id'), 'fallback-id');
});
