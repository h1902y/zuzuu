# mns Actions Crystallization Gate (Plan 2b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the Actions evolution loop — an agent proposes a reusable action into `.mns/actions/inbox/`, a human approves it via the same `mns review` gate, and it becomes an active action. Plus the A7 observability side-channel: every `mns act` run appends an outcome record to the trace.

**Architecture:** A parallel-to-knowledge inbox→gate→activate flow, kept OUT of the knowledge ER/registry machinery. `mns/actions/inbox.mjs` lists/activates/rejects proposed actions (a proposed action is a real dir under `actions/inbox/<slug>/`). `mns act propose` scaffolds into the inbox; `mns review` gains an actions pass (interactive); `mns act approve|reject|inbox` are the non-interactive surface (mirroring `mns proposals`). `mns act` writes a fail-soft outcome record to `.mns/live/actions.jsonl`. This realizes DESIGN's "Actions crystallization = the same governed pipeline as Knowledge promotion."

**Tech Stack:** Node ≥ 22, ES modules, zero runtime deps. Tests: `node:test`; piped-stdin pattern for the interactive review (as in the existing knowledge review test). Temp-dir fixtures.

**Scope:** Plan 2b of Spec 2 (`docs/superpowers/specs/2026-06-10-mns-actions-engine-design.md`, sections A6 + A7). Plan 2a (the engine core) is already merged. This builds on it.

---

## Conventions for every task

- **Zero deps.** Only `node:*` builtins.
- **Run a single test file:** `node --test tests/unit/<file>.test.mjs`. Run all: `npm test`.
- **Commit trailer** (exact, every commit):
  ```
  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
  ```
- **Human gate is sacred:** an inbox action NEVER auto-activates. Activation requires explicit approval (interactive `y` or `mns act approve`).
- **Never break the host:** the A7 side-channel write is fail-soft (a logging error must never fail the action).
- **Containment:** all slugs pass `isSafeSlug` (already in `mns/actions/manifest.mjs`) before any filesystem op.

---

## Current state (from Plan 2a, merged)

- `mns/actions/manifest.mjs` exports `actionsDir(mnsDir)`, `loadManifest(mnsDir, slug)`, `allActions(mnsDir)`, `SAFE_SLUG`, `isSafeSlug(slug)`. `allActions` walks `actionsDir` and classifies each dir: `script` (has run.mjs) or `runbook` (has SKILL.md), pulling title/promptSnippet from manifest or SKILL.md frontmatter.
- `mns/actions/dispatch.mjs` exports `runAction(mnsDir, slug, callerArgs, {timeoutMs})` → `{ok, value|error, detail?, logs}`.
- `mns/commands/act.mjs` routes `list|show|new|schema|<slug>` (RESERVED set + requireSlug). `mns/commands/act-author.mjs` exports `scaffoldAction(mnsDir, slug)` (no-clobber, slug-guarded), `newAction`, `schema`.
- `mns/commands/review.mjs` — interactive knowledge gate: `processInbox` (knowledge), then walks knowledge proposals with a line-queue `ask()`; `q`/EOF quits. Also `proposals(args)` non-interactive.
- `mns/scaffold.mjs` `LAYOUT.dirs` includes `.mns/actions` (no inbox subdir yet); `ACTIONS_README` describes the faculty.
- `mns/digest.mjs` renders an `## Actions` section from `allActions`.

---

## File structure

| File | Responsibility | Action |
|---|---|---|
| `mns/scaffold.mjs` | Add `.mns/actions/inbox` to LAYOUT.dirs; update ACTIONS_README | **Modify** |
| `mns/actions/manifest.mjs` | Extract `listActions(baseDir)`; add `inboxDir(mnsDir)`; `allActions` delegates | **Modify** |
| `mns/actions/inbox.mjs` | `listProposedActions`, `activateAction`, `rejectAction` | **Create** |
| `mns/commands/act-author.mjs` | `proposeAction` (scaffold into inbox) | **Modify** |
| `mns/commands/act.mjs` | Route `propose\|inbox\|approve\|reject`; A7 outcome record on run | **Modify** |
| `mns/actions/trail.mjs` | Fail-soft `recordOutcome` → `.mns/live/actions.jsonl` | **Create** |
| `mns/commands/review.mjs` | Actions pass in the interactive gate | **Modify** |
| `mns/inject.mjs` | Faculty block v5 (propose-an-action clause) | **Modify** |
| `bin/mns.mjs` | Help text for new subcommands | **Modify** |
| `tests/unit/actions-inbox.test.mjs` | list/activate/reject + conflict + validation | **Create** |
| `tests/unit/actions-propose.test.mjs` | `proposeAction` scaffolds into inbox | **Create** |
| `tests/unit/actions-trail.test.mjs` | outcome record append + fail-soft | **Create** |
| `tests/unit/review-actions.test.mjs` | piped review activates/rejects an inbox action | **Create** |
| `tests/unit/inject.test.mjs` | v5 block assertions | **Modify** |

---

## Task 1: Scaffold the `actions/inbox/` directory

**Files:**
- Modify: `mns/scaffold.mjs`
- Test: `tests/unit/scaffold.test.mjs`

Add `.mns/actions/inbox` to the scaffolded layout so a fresh home has the inbox, and mention the propose→review flow in the actions README.

- [ ] **Step 1: Write the failing test** (append to `tests/unit/scaffold.test.mjs`)

```javascript
test('scaffold includes the actions/inbox dir', () => {
  withTemp((cwd) => {
    applyScaffold(cwd, { now: 0 });
    assert.ok(existsSync(join(cwd, '.mns', 'actions', 'inbox')), 'actions/inbox exists');
  });
});
```

(The file already imports `existsSync`, `join`, `applyScaffold`, and has a `withTemp` helper — reuse them.)

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/unit/scaffold.test.mjs`
Expected: FAIL — `actions/inbox` not created.

- [ ] **Step 3: Implement** (edit `mns/scaffold.mjs`)

In `LAYOUT.dirs`, add `'.mns/actions/inbox'` right after `'.mns/actions'`. The array currently is:
```javascript
  dirs: ['.mns', '.mns/knowledge', '.mns/knowledge/registry', '.mns/knowledge/items', '.mns/knowledge/inbox', '.mns/knowledge/proposals', '.mns/memory', '.mns/actions', '.mns/instructions', '.mns/guardrails'],
```
Change the `'.mns/actions'` entry to `'.mns/actions', '.mns/actions/inbox'`.

Then update `ACTIONS_README` — append a short line about the propose flow. Find the end of the `ACTIONS_README` template string and add before its closing backtick:
```
\n- **Propose a reusable action**: \`mns act propose <slug>\` scaffolds into \`actions/inbox/\` for review. A human approves via \`mns review\` (or \`mns act approve <slug>\`). Never write active actions directly from an agent.\n
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/unit/scaffold.test.mjs`
Expected: PASS. Then `npm test 2>&1 | tail -5` → fail 0 (the re-apply-idempotent and no-clobber tests still pass with the new dir).

- [ ] **Step 5: Commit**

```bash
git add mns/scaffold.mjs tests/unit/scaffold.test.mjs
git commit -m "feat(actions): scaffold actions/inbox + README propose flow

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 2: Refactor manifest — `listActions(baseDir)` + `inboxDir`

**Files:**
- Modify: `mns/actions/manifest.mjs`
- Test: `tests/unit/actions-manifest.test.mjs`

Extract the directory-walk in `allActions` into `listActions(baseDir)` so the inbox can reuse the exact same classification. `allActions(mnsDir)` becomes `listActions(actionsDir(mnsDir))` but must STILL skip the `inbox` subdir (it's a dir, but not an action). Add `inboxDir(mnsDir)` = `<actionsDir>/inbox`.

- [ ] **Step 1: Write the failing test** (append to `tests/unit/actions-manifest.test.mjs`)

```javascript
import { listActions, inboxDir } from '../../mns/actions/manifest.mjs';

test('allActions skips the inbox subdir', () => {
  withActions((mns) => {
    // create an inbox with a proposed action — must NOT appear in allActions
    const inb = join(mns, 'actions', 'inbox', 'proposed');
    mkdirSync(inb, { recursive: true });
    writeFileSync(join(inb, 'action.json'), JSON.stringify({ slug: 'proposed' }));
    writeFileSync(join(inb, 'run.mjs'), 'export async function main(){ return {}; }');
    const slugs = allActions(mns).map((a) => a.slug);
    assert.ok(!slugs.includes('inbox'), 'inbox not listed as an action');
    assert.ok(!slugs.includes('proposed'), 'inbox contents not listed as active actions');
  });
});

test('listActions on the inbox dir lists proposed actions', () => {
  withActions((mns) => {
    const inb = join(mns, 'actions', 'inbox', 'proposed');
    mkdirSync(inb, { recursive: true });
    writeFileSync(join(inb, 'action.json'), JSON.stringify({ slug: 'proposed', promptSnippet: 'do a thing' }));
    writeFileSync(join(inb, 'run.mjs'), 'export async function main(){ return {}; }');
    const list = listActions(inboxDir(mns));
    assert.equal(list.length, 1);
    assert.equal(list[0].slug, 'proposed');
    assert.equal(list[0].kind, 'script');
    assert.equal(list[0].promptSnippet, 'do a thing');
  });
});
```

(`withActions` and the fs imports already exist in this file.)

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/unit/actions-manifest.test.mjs`
Expected: FAIL — `listActions`/`inboxDir` not exported; `allActions` currently WOULD list `inbox` as a runbook? No — `inbox` has no run.mjs/SKILL.md directly, so it's already skipped. But `listActions` import fails. Confirm fail.

- [ ] **Step 3: Implement** (edit `mns/actions/manifest.mjs`)

Add the inbox path helper near `actionsDir`:
```javascript
export const inboxDir = (mnsDir) => join(actionsDir(mnsDir), 'inbox');
```

Extract the walk. The current `allActions(mnsDir)` body loops over `readdirSync(actionsDir(mnsDir))`. Replace the whole `allActions` function with a generic `listActions(baseDir)` plus a thin `allActions`:

```javascript
/**
 * List actions in a base dir as {slug, kind, title, promptSnippet}.
 * `script` = dir has run.mjs; `runbook` = dir has SKILL.md; other entries skipped.
 * NOTE: a `loadManifest`-by-slug only resolves under actionsDir, so for arbitrary
 * baseDirs we read the manifest directly from the entry dir.
 */
export function listActions(baseDir) {
  if (!existsSync(baseDir)) return [];
  const out = [];
  for (const name of readdirSync(baseDir)) {
    const d = join(baseDir, name);
    let isDir = false;
    try { isDir = statSync(d).isDirectory(); } catch { /* skip */ }
    if (!isDir) continue; // ignores README.md and any stray files
    if (existsSync(join(d, 'run.mjs'))) {
      let man = {};
      try { man = JSON.parse(readFileSync(join(d, 'action.json'), 'utf8')); } catch { /* slug fallback */ }
      out.push({ slug: name, kind: 'script', title: man.title ?? name, promptSnippet: man.promptSnippet ?? man.description ?? name });
    } else if (existsSync(join(d, 'SKILL.md'))) {
      let fm = {};
      try { fm = skillFrontmatter(readFileSync(join(d, 'SKILL.md'), 'utf8')); } catch { /* slug fallback */ }
      out.push({ slug: name, kind: 'runbook', title: fm.name ?? name, promptSnippet: fm.description ?? name });
    }
  }
  return out;
}

/** Active actions under .mns/actions/ (the inbox subdir is excluded). */
export function allActions(mnsDir) {
  return listActions(actionsDir(mnsDir)).filter((a) => a.slug !== 'inbox');
}
```

(The `inbox` dir has neither run.mjs nor SKILL.md at its top level, so it is already skipped by `listActions` — the `.filter` is belt-and-suspenders and self-documents intent.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/unit/actions-manifest.test.mjs`
Expected: PASS (existing manifest tests + 2 new). Then `npm test 2>&1 | tail -5` → fail 0 (digest Actions section + act list still work via allActions).

- [ ] **Step 5: Commit**

```bash
git add mns/actions/manifest.mjs tests/unit/actions-manifest.test.mjs
git commit -m "refactor(actions): extract listActions(baseDir) + inboxDir; allActions excludes inbox

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 3: The inbox module — list / activate / reject

**Files:**
- Create: `mns/actions/inbox.mjs`
- Test: `tests/unit/actions-inbox.test.mjs`

`listProposedActions(mnsDir)` → proposed actions in the inbox. `activateAction(mnsDir, slug)` → validate + move `actions/inbox/<slug>/` to `actions/<slug>/`; refuse if the target already exists or the manifest is malformed. `rejectAction(mnsDir, slug)` → remove the inbox entry. All slug-guarded.

- [ ] **Step 1: Write the failing test**

```javascript
// tests/unit/actions-inbox.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listProposedActions, activateAction, rejectAction } from '../../mns/actions/inbox.mjs';

function withInbox(slug, fn, { manifest, run } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'mns-inbox-'));
  const mns = join(root, '.mns');
  const dir = join(mns, 'actions', 'inbox', slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'action.json'), manifest ?? JSON.stringify({ slug, promptSnippet: 'proposed thing' }));
  writeFileSync(join(dir, 'run.mjs'), run ?? 'export async function main(){ return { ok: true }; }');
  try { return fn(mns); } finally { rmSync(root, { recursive: true, force: true }); }
}

test('listProposedActions returns inbox entries', () => {
  withInbox('deploy', (mns) => {
    const list = listProposedActions(mns);
    assert.equal(list.length, 1);
    assert.equal(list[0].slug, 'deploy');
    assert.equal(list[0].promptSnippet, 'proposed thing');
  });
});

test('activateAction moves inbox → active and clears the inbox entry', () => {
  withInbox('deploy', (mns) => {
    const r = activateAction(mns, 'deploy');
    assert.equal(r.ok, true);
    assert.ok(existsSync(join(mns, 'actions', 'deploy', 'run.mjs')), 'now active');
    assert.ok(!existsSync(join(mns, 'actions', 'inbox', 'deploy')), 'inbox entry gone');
    assert.equal(listProposedActions(mns).length, 0);
  });
});

test('activateAction refuses when an active action of that slug already exists', () => {
  withInbox('dup', (mns) => {
    mkdirSync(join(mns, 'actions', 'dup'), { recursive: true });
    writeFileSync(join(mns, 'actions', 'dup', 'run.mjs'), 'export async function main(){ return { mine: true }; }');
    const r = activateAction(mns, 'dup');
    assert.equal(r.ok, false);
    assert.match(r.error, /exists/i);
    assert.ok(existsSync(join(mns, 'actions', 'inbox', 'dup')), 'inbox entry preserved on conflict');
  });
});

test('activateAction refuses a malformed manifest', () => {
  withInbox('bad', (mns) => {
    const r = activateAction(mns, 'bad');
    assert.equal(r.ok, false);
    assert.match(r.error, /manifest/i);
    assert.ok(!existsSync(join(mns, 'actions', 'bad')), 'not activated');
  }, { manifest: '{ not json' });
});

test('rejectAction removes the inbox entry', () => {
  withInbox('nope', (mns) => {
    const r = rejectAction(mns, 'nope');
    assert.equal(r.ok, true);
    assert.ok(!existsSync(join(mns, 'actions', 'inbox', 'nope')));
  });
});

test('activate/reject reject unsafe slugs', () => {
  withInbox('ok', (mns) => {
    assert.equal(activateAction(mns, '../../escape').ok, false);
    assert.equal(rejectAction(mns, '../../escape').ok, false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/unit/actions-inbox.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```javascript
// mns/actions/inbox.mjs
// The Actions crystallization gate (the same governed pipeline as Knowledge
// promotion, kept out of the knowledge ER/registry machinery). A proposed action
// is a real dir under .mns/actions/inbox/<slug>/. A human activates it (move to
// .mns/actions/<slug>/) or rejects it (remove). Never auto-activates.

import { join } from 'node:path';
import { existsSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { actionsDir, inboxDir, listActions, isSafeSlug } from './manifest.mjs';

/** Proposed actions awaiting review (in .mns/actions/inbox/). */
export function listProposedActions(mnsDir) {
  return listActions(inboxDir(mnsDir));
}

/**
 * Activate a proposed action: validate, then move inbox/<slug> → actions/<slug>.
 * @returns {{ok:true} | {ok:false, error:string}}
 */
export function activateAction(mnsDir, slug) {
  if (!isSafeSlug(slug)) return { ok: false, error: `invalid slug '${slug}'` };
  const from = join(inboxDir(mnsDir), slug);
  const to = join(actionsDir(mnsDir), slug);
  if (!existsSync(from)) return { ok: false, error: `no proposed action '${slug}'` };
  if (existsSync(to)) return { ok: false, error: `an active action '${slug}' already exists — reject or rename first` };
  // if it's a script proposal, the manifest must parse and match the slug
  const manPath = join(from, 'action.json');
  if (existsSync(manPath)) {
    let man;
    try { man = JSON.parse(readFileSync(manPath, 'utf8')); }
    catch { return { ok: false, error: `manifest is not valid JSON` }; }
    if (man.slug && man.slug !== slug) return { ok: false, error: `manifest slug '${man.slug}' ≠ dir '${slug}'` };
  }
  renameSync(from, to);
  return { ok: true };
}

/** Reject a proposed action: remove its inbox entry. */
export function rejectAction(mnsDir, slug) {
  if (!isSafeSlug(slug)) return { ok: false, error: `invalid slug '${slug}'` };
  const from = join(inboxDir(mnsDir), slug);
  if (!existsSync(from)) return { ok: false, error: `no proposed action '${slug}'` };
  rmSync(from, { recursive: true, force: true });
  return { ok: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/unit/actions-inbox.test.mjs`
Expected: PASS (6 tests). Then `npm test 2>&1 | tail -5` → fail 0.

- [ ] **Step 5: Commit**

```bash
git add mns/actions/inbox.mjs tests/unit/actions-inbox.test.mjs
git commit -m "feat(actions): inbox gate — listProposedActions/activateAction/rejectAction

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 4: `mns act propose` + `inbox` + `approve` + `reject`

**Files:**
- Modify: `mns/commands/act-author.mjs` (add `proposeAction`)
- Modify: `mns/commands/act.mjs` (routing + non-interactive gate surface)
- Modify: `bin/mns.mjs` (help)
- Test: `tests/unit/actions-propose.test.mjs`

`proposeAction(mnsDir, slug)` scaffolds the same files as `scaffoldAction` but into `actions/inbox/<slug>/`. The CLI gains: `mns act propose <slug>`, `mns act inbox` (list pending), `mns act approve <slug>`, `mns act reject <slug>`.

- [ ] **Step 1: Write the failing test**

```javascript
// tests/unit/actions-propose.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { proposeAction } from '../../mns/commands/act-author.mjs';

function withHome(fn) {
  const root = mkdtempSync(join(tmpdir(), 'mns-prop-'));
  mkdirSync(join(root, '.mns', 'actions', 'inbox'), { recursive: true });
  try { return fn(join(root, '.mns')); } finally { rmSync(root, { recursive: true, force: true }); }
}

test('proposeAction scaffolds into actions/inbox/<slug>/, not the active dir', () => {
  withHome((mns) => {
    const r = proposeAction(mns, 'shipit');
    assert.equal(r.created.length, 2);
    assert.ok(existsSync(join(mns, 'actions', 'inbox', 'shipit', 'action.json')));
    assert.ok(existsSync(join(mns, 'actions', 'inbox', 'shipit', 'run.mjs')));
    assert.ok(!existsSync(join(mns, 'actions', 'shipit')), 'not active until reviewed');
    const man = JSON.parse(readFileSync(join(mns, 'actions', 'inbox', 'shipit', 'action.json'), 'utf8'));
    assert.equal(man.slug, 'shipit');
  });
});

test('proposeAction rejects an unsafe slug', () => {
  withHome((mns) => {
    assert.throws(() => proposeAction(mns, '../../escape'), /invalid slug/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/unit/actions-propose.test.mjs`
Expected: FAIL — `proposeAction` not exported.

- [ ] **Step 3: Add `proposeAction` to `mns/commands/act-author.mjs`**

Refactor `scaffoldAction` to take a base dir, then add `proposeAction`. Replace the existing `scaffoldAction` with a base-aware core + a back-compatible wrapper:

```javascript
import { actionsDir, inboxDir, loadManifest, isSafeSlug } from '../actions/manifest.mjs';
```

```javascript
/** Scaffold an action dir under `baseDir/<slug>/`. No-clobber. */
function scaffoldInto(baseDir, slug) {
  if (!isSafeSlug(slug)) throw new Error(`invalid slug '${slug}' — letters, digits, - and _ only`);
  const dir = join(baseDir, slug);
  mkdirSync(dir, { recursive: true });
  const created = [];
  const write = (name, body) => {
    const p = join(dir, name);
    if (!existsSync(p)) { writeFileSync(p, body); created.push(name); }
  };
  write('action.json', manifestStub(slug));
  write('run.mjs', RUN_TEMPLATE);
  return { created };
}

/** Scaffold a live action (.mns/actions/<slug>/). Humans author here directly. */
export function scaffoldAction(mnsDir, slug) {
  return scaffoldInto(actionsDir(mnsDir), slug);
}

/** Scaffold a PROPOSED action (.mns/actions/inbox/<slug>/) — agents propose here. */
export function proposeAction(mnsDir, slug) {
  return scaffoldInto(inboxDir(mnsDir), slug);
}
```

(Keep `newAction`/`schema` as-is.)

- [ ] **Step 4: Wire the CLI in `mns/commands/act.mjs`**

Update imports:
```javascript
import { newAction, schema as schemaCmd, proposeAction } from './act-author.mjs';
import { listProposedActions, activateAction, rejectAction } from '../actions/inbox.mjs';
```
Add to RESERVED:
```javascript
const RESERVED = new Set(['list', 'show', 'new', 'schema', 'propose', 'inbox', 'approve', 'reject']);
```
Add these handler functions (before `act`):
```javascript
function propose(mnsDir, slug) {
  const { created } = proposeAction(mnsDir, slug);
  if (created.length) console.log(`proposed action '${slug}' → ${created.join(', ')} in .mns/actions/inbox/${slug}/ (review with \`mns review\`)`);
  else console.log(`proposed action '${slug}' already complete — nothing to do`);
}

function inbox(mnsDir) {
  const pending = listProposedActions(mnsDir);
  if (!pending.length) return console.log('no proposed actions — inbox empty');
  for (const a of pending.sort((x, y) => x.slug.localeCompare(y.slug))) {
    console.log(`  ${a.slug}  [${a.kind}]  ${a.promptSnippet}`);
  }
}

function approve(mnsDir, slug) {
  const r = activateAction(mnsDir, slug);
  console.log(r.ok ? `✓ activated '${slug}'` : `✗ ${r.error}`);
  process.exit(r.ok ? 0 : 1);
}

function reject(mnsDir, slug) {
  const r = rejectAction(mnsDir, slug);
  console.log(r.ok ? `✓ rejected '${slug}'` : `✗ ${r.error}`);
  process.exit(r.ok ? 0 : 1);
}
```
Add the routes in `act()` (before the future-reserved guard):
```javascript
  if (sub === 'propose') return propose(mnsDir, requireSlug(args._[1], 'usage: mns act propose <slug>'));
  if (sub === 'inbox') return inbox(mnsDir);
  if (sub === 'approve') return approve(mnsDir, requireSlug(args._[1], 'usage: mns act approve <slug>'));
  if (sub === 'reject') return reject(mnsDir, requireSlug(args._[1], 'usage: mns act reject <slug>'));
```

- [ ] **Step 5: Update help in `bin/mns.mjs`**

Replace the two `act` help lines with:
```
  act [list|show <slug>|run|new <slug>|schema <slug>]
                            the Actions faculty — runbooks + runnable scripts
  act <slug> [--args JSON]  run a script action
  act propose <slug>        scaffold a proposed action → actions/inbox/ (for review)
  act inbox|approve <slug>|reject <slug>
                            the actions gate (or use `mns review`)
```

- [ ] **Step 6: Run + verify**

Run: `node --test tests/unit/actions-propose.test.mjs` → 2 pass.
Manual:
```bash
D=$(mktemp -d) && cd "$D" && git init -q && node /Users/hkc/Documents/motorsandsensors/bin/mns.mjs init >/dev/null
node /Users/hkc/Documents/motorsandsensors/bin/mns.mjs act propose shipit
node /Users/hkc/Documents/motorsandsensors/bin/mns.mjs act inbox
node /Users/hkc/Documents/motorsandsensors/bin/mns.mjs act approve shipit
node /Users/hkc/Documents/motorsandsensors/bin/mns.mjs act list   # shipit now active
```
Expected: propose → inbox lists shipit → approve activates → list shows shipit. Then full suite: `cd /Users/hkc/Documents/motorsandsensors && npm test 2>&1 | tail -5` → fail 0.

- [ ] **Step 7: Commit**

```bash
git add mns/commands/act-author.mjs mns/commands/act.mjs bin/mns.mjs tests/unit/actions-propose.test.mjs
git commit -m "feat(actions): mns act propose/inbox/approve/reject (the non-interactive gate)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 5: Actions pass in the interactive `mns review`

**Files:**
- Modify: `mns/commands/review.mjs`
- Test: `tests/unit/review-actions.test.mjs`

`mns review` should gate proposed ACTIONS too — in the same interactive session, before the knowledge proposals. Each proposed action gets a card; `y` activates, `n` rejects, `s` skips, `q` quits. Reuse the existing line-queue `ask()` plumbing.

- [ ] **Step 1: Write the failing test**

```javascript
// tests/unit/review-actions.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const BIN = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'bin', 'mns.mjs');

function withProposed(slug, fn) {
  const root = mkdtempSync(join(tmpdir(), 'mns-rev-'));
  const mns = join(root, '.mns');
  // minimal faculty home so review() doesn't choke
  for (const d of ['knowledge/items', 'knowledge/inbox', 'knowledge/proposals', 'knowledge/registry', 'actions/inbox/' + slug]) {
    mkdirSync(join(mns, d), { recursive: true });
  }
  writeFileSync(join(mns, 'actions', 'inbox', slug, 'action.json'), JSON.stringify({ slug, promptSnippet: 'do it' }));
  writeFileSync(join(mns, 'actions', 'inbox', slug, 'run.mjs'), 'export async function main(){ return {}; }');
  try { return fn(root, mns); } finally { rmSync(root, { recursive: true, force: true }); }
}

test('piped review: y activates a proposed action', () => {
  withProposed('deploy', (root, mns) => {
    const r = spawnSync(process.execPath, [BIN, 'review'], { cwd: root, input: 'y\n', encoding: 'utf8' });
    assert.match(r.stdout, /deploy/);
    assert.ok(existsSync(join(mns, 'actions', 'deploy', 'run.mjs')), 'activated');
    assert.ok(!existsSync(join(mns, 'actions', 'inbox', 'deploy')), 'inbox cleared');
  });
});

test('piped review: n rejects a proposed action', () => {
  withProposed('scratch', (root, mns) => {
    const r = spawnSync(process.execPath, [BIN, 'review'], { cwd: root, input: 'n\n', encoding: 'utf8' });
    assert.ok(!existsSync(join(mns, 'actions', 'scratch')), 'not activated');
    assert.ok(!existsSync(join(mns, 'actions', 'inbox', 'scratch')), 'inbox entry removed');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/unit/review-actions.test.mjs`
Expected: FAIL — review currently ignores proposed actions (deploy stays in inbox).

- [ ] **Step 3: Implement** (edit `mns/commands/review.mjs`)

Add imports:
```javascript
import { listProposedActions, activateAction, rejectAction } from '../actions/inbox.mjs';
```
In `review()`, AFTER the `rl`/`ask` plumbing is set up (after the `ask` arrow function is defined) and BEFORE the knowledge `pending` loop, insert an actions pass. Note: `processInbox` + the `pending` knowledge list are computed near the top; the actions pass needs the `ask`/`rl` machinery, so it must go after `ask` is defined. Restructure so the actions pass runs first within the interactive section:

```javascript
  // --- Actions gate: walk proposed actions first ---
  const proposed = listProposedActions(mnsDir);
  for (let i = 0; i < proposed.length; i++) {
    const a = proposed[i];
    console.log(`\n━━ action ${i + 1}/${proposed.length} ── ${a.slug} ── ${a.kind} ━━`);
    console.log(`  ${a.promptSnippet}`);
    let acted = false;
    while (!acted) {
      const ans = (await ask('  [y]activate [n]reject [s]kip [q]uit > ')).trim().toLowerCase();
      if (ans === 'y') { const r = activateAction(mnsDir, a.slug); console.log(r.ok ? `  ✓ activated` : `  ✗ ${r.error}`); acted = true; }
      else if (ans === 'n') { rejectAction(mnsDir, a.slug); console.log('  ✗ rejected'); acted = true; }
      else if (ans === 's') { acted = true; }
      else if (ans === 'q' || ans === '') { rl.close(); console.log('\nreview: quit'); return; }
    }
  }
```

IMPORTANT placement: this block must come after the `const ask = async (q) => {...}` definition. The existing knowledge code (`if (!pending.length) { ... return; }`) currently sits BEFORE the rl setup — that early-return path means "no knowledge proposals" would skip the actions gate. Move the knowledge `if (!pending.length)` early-return: only return early when BOTH `proposed.length === 0` AND `pending.length === 0`. Change:

```javascript
  const pending = listProposals(mnsDir);
  if (!pending.length) {
    console.log('no pending proposals — inbox empty, knowledge is current');
    return;
  }
```
to:
```javascript
  const pending = listProposals(mnsDir);
  const proposedCount = listProposedActions(mnsDir).length;
  if (!pending.length && !proposedCount) {
    console.log('nothing to review — knowledge and actions are current');
    return;
  }
```
Then the `rl`/`ask` setup runs, then the actions pass (above), then the existing knowledge loop unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/unit/review-actions.test.mjs` → 2 pass. Then `node --test tests/unit/` (or `npm test`) and confirm the EXISTING knowledge review test still passes (the piped-stdin knowledge flow must be unbroken). `npm test 2>&1 | tail -5` → fail 0.

- [ ] **Step 5: Commit**

```bash
git add mns/commands/review.mjs tests/unit/review-actions.test.mjs
git commit -m "feat(review): gate proposed actions in the interactive mns review

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 6: Faculty block v5 — propose-an-action clause

**Files:**
- Modify: `mns/inject.mjs`
- Test: `tests/unit/inject.test.mjs`

Add one clause to the harvest ritual so agents know to propose reusable procedures into the gate (not write active actions directly). Bump `BLOCK_VERSION` to 5.

- [ ] **Step 1: Write the failing test** (append to `tests/unit/inject.test.mjs`)

```javascript
test('v5 block tells agents to propose actions via the gate', () => {
  const out = injectBlock('# proj\n');
  assert.ok(out.includes('mns:faculties:v5'), 'is v5');
  assert.match(out, /mns act propose/);
});

test('a v4 block upgrades to v5 in place', () => {
  const v4 = injectBlock('# proj\n', facultiesBlock(4)) + '\n## after\n';
  const v5 = injectBlock(v4);
  assert.ok(v5.includes('mns:faculties:v5'));
  assert.ok(!v5.includes('mns:faculties:v4'));
  assert.ok(v5.includes('## after'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/unit/inject.test.mjs`
Expected: FAIL — block is v4; `mns act propose` absent.

- [ ] **Step 3: Implement** (edit `mns/inject.mjs`)

Change `export const BLOCK_VERSION = 4;` → `export const BLOCK_VERSION = 5;`.

In `facultiesBlock`, change the Harvest bullet to add the action-proposal clause. Replace the existing harvest line:
```javascript
- **Harvest at close.** Before ending, propose durable learnings as one-fact files in \`.mns/knowledge/inbox/\` (plain text is fine) — a human reviews via \`mns review\`. Never write \`items/\` directly.
```
with:
```javascript
- **Harvest at close.** Before ending, propose durable learnings as one-fact files in \`.mns/knowledge/inbox/\` (plain text is fine), and propose any reusable procedure with \`mns act propose <slug>\` (it lands in \`actions/inbox/\`). A human reviews both via \`mns review\`. Never write \`knowledge/items/\` or active \`actions/\` directly.
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/unit/inject.test.mjs`
Expected: PASS (existing v3→v4 upgrade test still passes — `BLOCK_RE` is version-agnostic — plus the 2 new). Then `npm test 2>&1 | tail -5` → fail 0.

- [ ] **Step 5: Commit**

```bash
git add mns/inject.mjs tests/unit/inject.test.mjs
git commit -m "feat(inject): faculty block v5 — propose reusable actions via the gate

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 7: A7 — the actions outcome trace side-channel

**Files:**
- Create: `mns/actions/trail.mjs`
- Modify: `mns/commands/act.mjs` (record on run)
- Test: `tests/unit/actions-trail.test.mjs`

Every `mns act <slug>` run appends a fail-soft outcome record to `.mns/live/actions.jsonl` — the observability trail (the "details" side of pi's result-as-patch split; the agent sees the marker result, the trace keeps the metadata). `.mns/live/` is git-ignored. A logging error must NEVER fail the action.

- [ ] **Step 1: Write the failing test**

```javascript
// tests/unit/actions-trail.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { recordOutcome } from '../../mns/actions/trail.mjs';

function withHome(fn) {
  const root = mkdtempSync(join(tmpdir(), 'mns-trail-'));
  mkdirSync(join(root, '.mns'), { recursive: true });
  try { return fn(join(root, '.mns')); } finally { rmSync(root, { recursive: true, force: true }); }
}

test('recordOutcome appends a JSONL line with slug + ok + error', () => {
  withHome((mns) => {
    recordOutcome(mns, { slug: 'deploy', ok: true });
    recordOutcome(mns, { slug: 'deploy', ok: false, error: 'invalid_input' });
    const path = join(mns, 'live', 'actions.jsonl');
    assert.ok(existsSync(path));
    const lines = readFileSync(path, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    assert.equal(lines.length, 2);
    assert.equal(lines[0].slug, 'deploy');
    assert.equal(lines[0].ok, true);
    assert.ok(lines[0].at, 'has a timestamp');
    assert.equal(lines[1].ok, false);
    assert.equal(lines[1].error, 'invalid_input');
  });
});

test('recordOutcome is fail-soft: a bad mnsDir never throws', () => {
  assert.doesNotThrow(() => recordOutcome('/nonexistent/ /bad', { slug: 'x', ok: true }));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/unit/actions-trail.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```javascript
// mns/actions/trail.mjs
// The actions observability trail (A7): every `mns act` run appends an outcome
// record to .mns/live/actions.jsonl. This is the "details" side of the result —
// the agent sees the marker value; the trace keeps the metadata. Fail-soft: a
// logging failure must never affect the action (mirrors the guardrails decision log).

import { join } from 'node:path';
import { mkdirSync, appendFileSync } from 'node:fs';

/** Append a fail-soft outcome record. Never throws. */
export function recordOutcome(mnsDir, { slug, ok, error } = {}) {
  try {
    const dir = join(mnsDir, 'live');
    mkdirSync(dir, { recursive: true });
    const rec = { at: new Date().toISOString(), slug, ok: !!ok };
    if (error) rec.error = error;
    appendFileSync(join(dir, 'actions.jsonl'), JSON.stringify(rec) + '\n');
  } catch {
    /* logging must never affect the action */
  }
}
```

- [ ] **Step 4: Wire into `mns/commands/act.mjs`**

Add the import:
```javascript
import { recordOutcome } from '../actions/trail.mjs';
```
In `run()`, after computing `r` and before/around the output, record the outcome (fail-soft already):
```javascript
  const r = runAction(mnsDir, slug, callerArgs);
  recordOutcome(mnsDir, { slug, ok: r.ok, error: r.ok ? undefined : r.error });
  if (r.logs) process.stdout.write(r.logs + '\n');
  ...
```

- [ ] **Step 5: Run + verify**

Run: `node --test tests/unit/actions-trail.test.mjs` → 2 pass.
Manual (confirm a real run writes the trail):
```bash
D=$(mktemp -d) && cd "$D" && git init -q && node /Users/hkc/Documents/motorsandsensors/bin/mns.mjs init >/dev/null
node /Users/hkc/Documents/motorsandsensors/bin/mns.mjs act new echo >/dev/null
node /Users/hkc/Documents/motorsandsensors/bin/mns.mjs act echo >/dev/null 2>&1
cat .mns/live/actions.jsonl
```
Expected: one JSONL line with `"slug":"echo"`, `"ok":true`, an `at` timestamp. Then full suite: `cd /Users/hkc/Documents/motorsandsensors && npm test 2>&1 | tail -5` → fail 0.

- [ ] **Step 6: Commit**

```bash
git add mns/actions/trail.mjs mns/commands/act.mjs tests/unit/actions-trail.test.mjs
git commit -m "feat(actions): A7 outcome trail — fail-soft .mns/live/actions.jsonl on each run

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 8: Dogfood the full loop + verification

**Files:** none (verification only)

Exercise propose → review → activate → run end-to-end through the real binary, then the full suite + playground.

- [ ] **Step 1: Propose → approve → run, in a scratch project**

```bash
cd /tmp && D=$(mktemp -d) && cd "$D" && git init -q && node /Users/hkc/Documents/motorsandsensors/bin/mns.mjs init >/dev/null
node /Users/hkc/Documents/motorsandsensors/bin/mns.mjs act propose hello
# fill in the proposed action so it returns something:
printf 'export async function main(){ return { greeting: "hi" }; }\n' > .mns/actions/inbox/hello/run.mjs
node /Users/hkc/Documents/motorsandsensors/bin/mns.mjs act inbox          # hello listed
printf 'y\n' | node /Users/hkc/Documents/motorsandsensors/bin/mns.mjs review   # interactive activate
node /Users/hkc/Documents/motorsandsensors/bin/mns.mjs act list           # hello now active
node /Users/hkc/Documents/motorsandsensors/bin/mns.mjs act hello          # runs → marker result
cat .mns/live/actions.jsonl                                                # trail recorded
node /Users/hkc/Documents/motorsandsensors/bin/mns.mjs digest | grep -A2 '## Actions'  # in the digest
```
Expected: propose creates inbox/hello; inbox lists it; `review` with `y` activates it; list shows it; running it returns the marker result; the trail has a record; the digest lists it. Paste what you observe.

- [ ] **Step 2: Full suite**

Run: `cd /Users/hkc/Documents/motorsandsensors && npm test 2>&1 | tail -6`
Expected: `fail 0`, pass count up by the new tests.

- [ ] **Step 3: Playground**

Run: `npm run playground 2>&1 | tail -6`
Expected: pass/skip only, no fail.

- [ ] **Step 4: Final commit if any verification fixups were needed** (else skip)

```bash
git add -A && git commit -m "test: actions crystallization loop green end-to-end

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Self-review notes (coverage of Spec 2b)

- **A6 (crystallization gate)** → Task 1 (inbox dir), Task 2 (listActions refactor), Task 3 (inbox module: list/activate/reject + conflict + validation), Task 4 (propose/inbox/approve/reject CLI), Task 5 (interactive `mns review` actions pass), Task 6 (faculty block v5 steering agents to propose).
- **A7 (trace side-channel)** → Task 7 (fail-soft `.mns/live/actions.jsonl` outcome trail).
- **Dogfood** → Task 8 (propose → review → activate → run → trail → digest).
- **Human-gate-sacred:** activation only via explicit `y` / `mns act approve` — no auto-activation anywhere (verified by Task 3 + Task 5 tests).
- **Containment:** every slug path (`activateAction`, `rejectAction`, `proposeAction`, CLI) guarded by `isSafeSlug`.
- **Never-break-the-host:** the A7 write is fail-soft (Task 7 test asserts no-throw on a bad dir).
- **Not in scope:** trace-driven active-subset selection (forward hook from A4), LLM-judge on proposals, runbook authoring helpers — all later rungs.
