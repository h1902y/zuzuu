# Capability Registry & Resolver — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** Formalize zuzuu's capability blocks as a registry + resolver so a module can be composed from a `module.json` manifest with **zero bespoke code** — proven by a `playbooks` module that runs mine→propose→approve→version→recall→run.

**Architecture:** A platform-owned `capability-registry.mjs` (descriptor catalogue). The manifest gains `capabilities:{}`; legacy `hooks:{}` desugars in. A resolver `capabilities.mjs` synthesizes a module-shaped hook set (adapter/miner/digestSection/recall/run) from declared capabilities + the module's schema. The registry attaches the synthesized object to declarative modules; agentDir-aware seams (`adapterFor`, `minersFor`) let the spine reach composed modules. The 5 built-ins keep byte-identical behavior (they desugar to the same hooks).

**Tech Stack:** Node ≥22, `node:test`, zero deps. All under `zuzuu/module/`.

**Verification:** `npm test` green (existing + new); the `playbooks` acceptance test passes; `node bin/zuzuu.mjs` lists + exercises a composed module. Branch `feat/capability-registry`.

---

## Key facts established by exploration (reuse these — do NOT reinvent)
- Module-shaped hook surface (consumed by `registry.invoke`): `{ manifest, adapter:{name,ingest,validate,apply,render}, miner:{module,aggregate,propose}, digestSection(agentDir,ctx), validate, applyProposal, propose, sessionSignals }` — see `zuzuu/modules/knowledge/index.mjs`.
- `normalizeManifest(raw, dirName)` in `zuzuu/module/module.mjs:32` fills `hooks:{miner,digest,eval,gate}`.
- `modulesOf(agentDir)` in `zuzuu/module/registry.mjs:107` returns entries; declarative modules currently get `module: null`. `get/all/miners/minerOf` are agentDir-agnostic (built-ins + overrides).
- Generic proposal plumbing is module-agnostic and complete: `makeProposal/writeProposal/readProposal/listProposals/archiveProposal/isArchivedResolved` in `zuzuu/module/proposal.mjs`.
- `gate.approve(agentDir, module, id)` (`zuzuu/module/gate.mjs:30`) is adapter-driven: `registry.get(module)` → `validate` → `apply` → `archiveProposal`. Generic already — just needs `get` to find composed adapters.
- Generic item I/O: `writeModuleItem(agentDir,item)` / `listModuleItems(agentDir,module,{itemsDir})` in `zuzuu/module/items.mjs`; `itemsDirFor` already defaults unknown modules to `<module>/<itemsDir||items>`.
- `mintModuleGeneration(agentDir, module)` in `zuzuu/module/generation/write.mjs` snapshots `moduleItemFiles(agentDir, module)` (`generation/read.mjs:106`) — uses a fixed `ENUMERATORS` map of the 5; unknown module → `[]` (the one gap for version-mint).
- Mining libs: `mineTranscript` + `aggregate` in `zuzuu/knowledge/distill.mjs`; `distill` command (`zuzuu/commands/distill.mjs:25`) iterates `registry.miners()`.
- `query.structured`/`query.semantic` live in `zuzuu/knowledge/index.mjs` (`search()`/`neighbors()`/vectors); `exec.script` in `zuzuu/actions/runner.mjs`.

---

## Task 1: Capability registry (descriptor catalogue)

**Files:** Create `zuzuu/module/capability-registry.mjs`; Test `tests/unit/capability-registry.test.mjs`

A platform-owned `Map` of capability descriptors. A descriptor = `{ name, category?, hostBinding?, grant?, configSchema?, build? }` where `build({agentDir, manifest, config})` returns hook fragments (used by the resolver in Task 5). This task ships ONLY the registry mechanics (no built-ins yet).

- [ ] **Step 1: Failing test** — assert register/get/has/list/clear round-trip; `get` of unknown → `null`; `register` returns the stored descriptor with `name` set; double-register overwrites.

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerCapability, getCapability, hasCapability, listCapabilities, clearCapabilities } from '../../zuzuu/module/capability-registry.mjs';

test('register/get/has/list/clear', () => {
  clearCapabilities();
  assert.equal(getCapability('x.y'), null);
  const d = registerCapability('x.y', { category: 'test', grant: { scope: 'self' } });
  assert.equal(d.name, 'x.y');
  assert.equal(hasCapability('x.y'), true);
  assert.deepEqual(getCapability('x.y').grant, { scope: 'self' });
  assert.equal(listCapabilities().length, 1);
  registerCapability('x.y', { category: 'changed' });
  assert.equal(getCapability('x.y').category, 'changed');
  clearCapabilities();
  assert.equal(listCapabilities().length, 0);
});
```

- [ ] **Step 2: Implement** `capability-registry.mjs`:

```js
// zuzuu/module/capability-registry.mjs — the platform-owned catalogue of
// capability descriptors (the "lego blocks"). Pure registry mechanics; the
// resolver (capabilities.mjs) consumes descriptors' build() to synthesize a
// module's hook set. A descriptor:
//   { name, category?, hostBinding?, grant?, configSchema?, build? }
// grant = the scoped-authority descriptor (decision 5): { scope, audited }.
const CAPABILITIES = new Map();

/** Register/overwrite a capability descriptor; returns the stored record. */
export function registerCapability(name, descriptor = {}) {
  const record = { name, ...descriptor };
  CAPABILITIES.set(name, record);
  return record;
}
export function getCapability(name) { return CAPABILITIES.get(name) ?? null; }
export function hasCapability(name) { return CAPABILITIES.has(name); }
export function listCapabilities() { return [...CAPABILITIES.values()]; }
/** Tests only. */
export function clearCapabilities() { CAPABILITIES.clear(); }
```

- [ ] **Step 3:** `node --test tests/unit/capability-registry.test.mjs` → PASS. Commit.

---

## Task 2: Manifest `capabilities:{}` + hooks↔capabilities desugar

**Files:** Modify `zuzuu/module/module.mjs` (`normalizeManifest`); Test `tests/unit/module-manifest.test.mjs` (extend if exists, else create)

A manifest may declare `capabilities: { "items.collection": {...}, "query.structured": {...}, "mine": {signal:"sequences"}, ... }`. Normalization must (a) keep `hooks:{}` working, (b) DESUGAR: if `capabilities` present, derive `hooks` from it (presence of `mine`→miner, `digest`/digestSection cap→digest, `eval`→eval, `harness.gate`/`gate`→gate) AND keep the raw `capabilities` map; if only `hooks` present (the 5 built-ins), SUGAR an equivalent minimal `capabilities` view so downstream is uniform. Behavior of the 5 built-ins must be unchanged.

- [ ] **Step 1: Failing tests** — (a) legacy `hooks:{miner:true}` still normalizes to `hooks.miner===true`; (b) `capabilities:{mine:{}}` desugars to `hooks.miner===true`; (c) `capabilities` is preserved on the normalized manifest; (d) a manifest with neither has `capabilities:{}` and all hooks false.

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeManifest } from '../../zuzuu/module/module.mjs';

test('legacy hooks still work', () => {
  const m = normalizeManifest({ hooks: { miner: true, digest: true } }, 'k');
  assert.equal(m.hooks.miner, true);
  assert.equal(m.hooks.digest, true);
});
test('capabilities desugar to hooks', () => {
  const m = normalizeManifest({ capabilities: { mine: { signal: 'sequences' }, 'harness.gate': {} } }, 'p');
  assert.equal(m.hooks.miner, true);
  assert.equal(m.hooks.gate, true);
  assert.deepEqual(m.capabilities.mine, { signal: 'sequences' });
});
test('neither → empty caps, hooks false', () => {
  const m = normalizeManifest({}, 'x');
  assert.deepEqual(m.capabilities, {});
  assert.equal(m.hooks.miner, false);
});
```

- [ ] **Step 2: Implement** — in `normalizeManifest`, after computing `hooks`, add capabilities handling:

```js
// inside normalizeManifest, replace the `hooks:` block with capability-aware logic:
const rawCaps = (raw.capabilities && typeof raw.capabilities === 'object') ? raw.capabilities : null;
const hooks = {
  miner: !!(raw.hooks?.miner || rawCaps?.mine),
  digest: !!(raw.hooks?.digest || rawCaps?.digest),
  eval: !!(raw.hooks?.eval || rawCaps?.eval),
  gate: !!(raw.hooks?.gate || rawCaps?.['harness.gate'] || rawCaps?.gate),
};
const capabilities = rawCaps ? { ...rawCaps } : {};
return { id, title, /* …existing… */, hooks, capabilities, ui: { /* … */ } };
```

(Place `capabilities` on the returned object; keep all existing fields.)

- [ ] **Step 3:** `node --test tests/unit/module-manifest.test.mjs` PASS; `npm test` still green (5 built-ins unaffected — they use `hooks`). Commit.

---

## Task 3: Generic schema validator

**Files:** Create `zuzuu/module/schema.mjs`; Test `tests/unit/module-schema.test.mjs`

Composed modules ship a light `schema.json` (`{ kinds:[...], required:[...] }`). A generic validator (the `items.collection` adapter's `validate`) checks an item payload against it. Fail-soft, never throws.

- [ ] **Step 1: Failing test** — payload missing a `required` field → `{ok:false, errors:[…]}`; payload with `type` not in `kinds` → error (when kinds non-empty); empty schema → ok; warnings array always present.

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateAgainstSchema } from '../../zuzuu/module/schema.mjs';

test('required + kinds', () => {
  const schema = { kinds: ['note', 'decision'], required: ['body'] };
  assert.equal(validateAgainstSchema(schema, { type: 'note', body: 'x' }).ok, true);
  assert.equal(validateAgainstSchema(schema, { type: 'note' }).ok, false); // missing body
  assert.equal(validateAgainstSchema(schema, { type: 'bogus', body: 'x' }).ok, false); // bad kind
  assert.equal(validateAgainstSchema({}, { body: 'x' }).ok, true); // empty schema
});
```

- [ ] **Step 2: Implement** `schema.mjs`:

```js
// zuzuu/module/schema.mjs — light, generic item validation for composed modules.
// schema = { kinds?: string[], required?: string[] }. Pure, fail-soft.
export function validateAgainstSchema(schema = {}, payload = {}) {
  const errors = [];
  const warnings = [];
  const kinds = Array.isArray(schema.kinds) ? schema.kinds : [];
  const required = Array.isArray(schema.required) ? schema.required : [];
  for (const k of required) {
    if (payload[k] === undefined || payload[k] === null || payload[k] === '') errors.push(`missing required field '${k}'`);
  }
  if (kinds.length && payload.type && !kinds.includes(payload.type)) {
    errors.push(`type '${payload.type}' not in kinds [${kinds.join(', ')}]`);
  }
  return { ok: errors.length === 0, errors, warnings };
}
```

- [ ] **Step 3:** test PASS. Commit.

---

## Task 4: Generic item-enumerator fallback for generations

**Files:** Modify `zuzuu/module/generation/read.mjs` (`moduleItemFiles`); Test `tests/unit/generation-generic-items.test.mjs`

So `mintModuleGeneration` snapshots a composed module's items. When `ENUMERATORS[module]` is absent, fall back to enumerating `<agentDir>/<module>/items/*.md` (the `itemsDirFor` default). Must NOT change the 5 built-ins.

- [ ] **Step 1: Failing test** — write `<tmp>/playbooks/items/foo.md` (any bytes), then `moduleItemFiles(tmp, 'playbooks')` returns one `{id:'foo', module:'playbooks', hash}` entry; an unknown module with no dir → `[]`.

- [ ] **Step 2: Implement** — in `moduleItemFiles`, replace the body:

```js
export function moduleItemFiles(agentDir, module) {
  const fn = ENUMERATORS[module];
  if (fn) return fn(agentDir);
  // generic fallback: composed modules keep flat envelopes under <module>/items/
  return mdItemFiles(agentDir, module, module, 'items');
}
```

- [ ] **Step 3:** test PASS; `npm test` green (built-ins still use their enumerators). Commit.

---

## Task 5: The resolver — synthesize a module from capabilities + register built-ins

**Files:** Create `zuzuu/module/capabilities.mjs`; Create `zuzuu/module/capability-builtins.mjs` (descriptor registrations); Test `tests/unit/capabilities-resolver.test.mjs`

`capability-builtins.mjs` registers the host-internal §A descriptors with `build()` fragments that wrap existing libs. v1 must support the acceptance set: `items.collection`, `query.structured`, `query.semantic`, `exec.script`, `mine`. Each `build({agentDir, manifest, config, schema})` returns a fragment merged by the resolver.

`capabilities.mjs` exports `synthesizeModule(agentDir, manifest, { loadSchema })` → a module-shaped object:
- `adapter = { name: manifest.id, ingest, validate, apply, render }`
  - `ingest(agentDir, raw)`: `payload = {...raw.candidate}; payload.id ||= slugify(payload.body); payload.module = manifest.id;` return `{payload, analysis:{}, dedupeKey: payload.id}` (slugify from `zuzuu/knowledge/items.mjs`).
  - `validate(agentDir, payload)`: `validateAgainstSchema(schema, payload)` (Task 3).
  - `apply(agentDir, proposal)`: build envelope item from `proposal.payload` (ensure `module:manifest.id`, `id`, `type`, `body`, timestamps), `writeModuleItem(agentDir, item)`; return `{ok:true, action:'created', itemIds:[item.id], warnings:[]}`.
  - `render(proposal)`: generic `{line, card}` from payload id/type/body.
- `miner = { module: manifest.id, aggregate, propose }` (only when `capabilities.mine`)
  - `aggregate` = `zuzuu/knowledge/distill.mjs` `aggregate` (config thresholds passthrough).
  - `propose(agentDir, aggregated)`: for each candidate → `payload = toPayload(candidate)` (default: `{id, type: config.kind||'note', body: candidate.candidate?.body ?? candidate.body, attributes, ...}`), `makeProposal({module, kind:'item', source:'distill', payload, evidence})`, skip if `isArchivedResolved`, else `writeProposal`; return filed count.
- `digestSection(agentDir, ctx)`: default count line over `listModuleItems(agentDir, manifest.id, {itemsDir:manifest.itemsDir})` (mirror the knowledge default-section shape).
- `recall(agentDir, query)`: when `query.structured`/`query.semantic` declared → use `zuzuu/knowledge/index.mjs` over the module's items (build/refresh an index scoped to the module); v1 minimum = lexical filter over `listModuleItems` if the sqlite index is keyed to knowledge only. Return ranked items.
- `run(agentDir, slug, input)`: when `exec.script` declared → delegate to `zuzuu/actions/runner.mjs`.

**Resolver mechanics:** read declared `capabilities` keys; for each, `getCapability(name)`; call `build(...)`; merge fragments (later keys do not clobber earlier unless same hook — define precedence: items.collection provides adapter base; mine provides miner; query.* provides recall; exec.* provides run). Cache per `(agentDir, manifest.id, manifest.version)`. Fail-soft: an unknown/none-building capability is skipped with a recorded note (surfaced by doctor later).

- [ ] **Step 1: Failing test** — register builtins; `synthesizeModule(tmp, normalizeManifest({id:'playbooks', capabilities:{'items.collection':{}, mine:{signal:'sequences', kind:'play'}, 'exec.script':{}}}, 'playbooks'), {loadSchema:()=>({kinds:['play'],required:['body']})})` returns an object with `.adapter.validate`, `.adapter.apply`, `.miner.propose`, `.run` functions; `.adapter.validate(tmp,{type:'play',body:'x'}).ok===true`; `.adapter.apply` writes `playbooks/items/<id>.md` and the file parses as an envelope.
- [ ] **Step 2: Implement** `capability-builtins.mjs` + `capabilities.mjs` per the contract above (import the existing libs; no logic changes to them).
- [ ] **Step 3:** test PASS. Commit.

---

## Task 6: Wire the resolver into the registry + agentDir-aware seams

**Files:** Modify `zuzuu/module/registry.mjs`, `zuzuu/module/gate.mjs`, `zuzuu/commands/distill.mjs`, `zuzuu/commands/proposals.mjs`, `zuzuu/commands/inbox.mjs`; Test `tests/unit/registry-composed.test.mjs`

- In `registry.mjs`: import `capability-builtins.mjs` for its registration side effect; in `modulesOf`, for declarative entries with a manifest declaring `capabilities`, set `module = synthesizeModule(agentDir, manifest, {loadSchema})` instead of `null` (fail-soft → `null` on throw, recorded). Add:
  - `adapterFor(agentDir, module)`: prefer `get(module)` (built-in/override), else the synthesized adapter from `moduleOf(agentDir, module)?.module?.adapter`.
  - `minersFor(agentDir)`: built-in `miners()` + every composed `moduleOf` entry's `module.miner`.
- In `gate.mjs`: `approve`/`reject` use `registry.adapterFor(agentDir, module)` (falls back to `get`).
- In `distill.mjs`: iterate `registry.minersFor(agentDir)` instead of `registry.miners()`.
- In `proposals.mjs`/`inbox.mjs`: replace `registry.get(module)` with `registry.adapterFor(agentDir, module)`.
- [ ] **Step 1: Failing test** — a tmp home with a `playbooks/module.json` (capabilities set) + a `schema.json`: `modulesOf(tmp).find(e=>e.id==='playbooks').module` is non-null and has `.adapter`; `adapterFor(tmp,'playbooks')` returns it; `minersFor(tmp)` includes a miner with `module:'playbooks'`; the 5 built-ins still resolve unchanged.
- [ ] **Step 2: Implement.**
- [ ] **Step 3:** test PASS; `npm test` green (the 5 built-ins: `adapterFor`/`minersFor` return identical surfaces). Commit.

---

## Task 7: Acceptance — the `playbooks` composed module, end-to-end, zero code

**Files:** Test `tests/playbooks-acceptance.test.mjs` (hermetic, node:test)

Build a tmp home containing ONLY `playbooks/module.json` + `playbooks/schema.json` (NO `.mjs`). Drive the full loop through the spine APIs and assert each stage:

```
manifest capabilities: { "items.collection":{}, "query.structured":{}, "query.semantic":{}, "exec.script":{}, "mine": {"signal":"sequences","kind":"play"} }
schema: { "kinds":["play"], "required":["body"] }
```

- [ ] **mine**: run `distill` over a synthetic captured session (reuse a tiny fixture transcript like existing distill tests) → ≥1 pending proposal under `playbooks/proposals/`.
- [ ] **propose→approve**: `gate.approve(home,'playbooks', id)` → item written to `playbooks/items/<id>.md`, parses as an envelope, proposal archived `approved`.
- [ ] **version**: `mintModuleGeneration(home,'playbooks')` → a generation lockfile lists the new item ({id,hash}).
- [ ] **recall**: the synthesized `recall(home, query)` returns the item.
- [ ] **run**: with an `exec.script` payload (a tiny echo script item), the synthesized `run` executes it and captures output. (If `exec.script` needs a sibling script file, this stage may assert the runner is wired + dispatch shape; keep within "no MODULE code" — the script is item content/data, not engine code.)
- [ ] Assert: **zero `.mjs` files** exist under `playbooks/` at any point (grep the tmp dir). Commit.

---

## Task 8: Full verification + smoke

- [ ] `npm test` fully green (existing 510+ CLI tests + new). Run `npm run playground` (skips ok).
- [ ] `node bin/zuzuu.mjs` (NOT the PATH `zuzuu`): `init` a tmp home, drop a `playbooks` manifest, `zuzuu module list` shows it; `zuzuu distill`/`review`/`recall` touch it without crashing.
- [ ] Final code review (dispatch reviewer). Open PR `feat/capability-registry` → main. NO version bump / publish (await release decision).
