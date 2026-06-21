# CLI Core Revamp — Filesystem-Native Item / Module / Capability

- **Status:** requirements (brainstorm output) — not yet planned
- **Date:** 2026-06-17
- **Scope:** Deep / architectural. The CLI core (`zuzuu/`), not the workbench (`web/`).
- **Next:** `/ce-plan` against this doc → the staged migration.
- **Inputs:** grounding dossier `/tmp/compound-engineering/ce-brainstorm/cli-revamp/grounding.md`; prior-art research brief (6-angle workflow, run `wf_19c67263-4c2`).

---

## 1. Problem

The CLI core grew substrate-first, then a module spine was layered over it. The result carries four structural debts:

1. **Three vocabularies for "what can a module do."** A built-in module declares its abilities in the manifest `capabilities` map, *and* a `hooks: {miner:true,…}` boolean object, *and* the named function exports — while declarative modules get their hook set *synthesized* from a separate capability catalogue (`zuzuu/module/capabilities.mjs` + `capability-registry.mjs`). Two construction paths, three declaration surfaces, one runtime shape.
2. **Adapter glue.** `zuzuu/modules/<f>/index.mjs` exists largely to rename substrate functions into the spine's hook vocabulary — a translation tax from growing the substrate before the spine.
3. **Two snapshot systems.** Per-module generations (`zuzuu/module/generation/{read,write}.mjs`) and whole-home checkpoints (`generation/checkpoint.mjs`) are two mechanisms for one idea at two scopes.
4. **No explicit core API.** `web/`'s daemon shells out to `zz <cmd> --json` and parses stdout (`web/packages/daemon/src/zuzuu-cli.ts`). The `--json` outputs are a de-facto API with no contract.

**Cost:** adding a module or a capability touches many files across `module/`, `modules/<f>/`, and a substrate dir; the daemon couples to CLI output formatting; the differentiating capability (query-on-demand over the corpus) does not exist yet.

## 2. The model — three primitives

Reduce the system to three primitives and two processes. The 5 faculties (knowledge/memory/actions/instructions/guardrails) become **instances of Module**, not subsystems.

- **Item** — one file: markdown + YAML frontmatter (a fact/episode/rule/steering note) *or* a script (an action). The atom. The frontmatter **is** the item's registration — no sidecar.
- **Module** — a typed, named collection of items + the capabilities defined over them. Built-in or user-authored; identical contract.
- **Capability** — a named verb over a module's items: `mine · recall · run · gate · validate · render · propose`. The bridge between "do something" and "code that does it." One registry; one dispatch.

Two cross-cutting processes, both **generic over modules** (no module names hardcoded):

- **observe → evolve** — capture → trace → mine → inbox → proposal → review → snapshot. Human-gated.
- **serve** — digest · gate · recall · run, parameterized by capabilities.

## 3. Goals / Non-goals

**Goals**
- One capability registry; one declaration surface (item/module frontmatter); one dispatch path.
- Context-frugal retrieval: the agent runs graph + relational queries as CLI verbs instead of ingesting the corpus.
- Host-agnostic exposure: capabilities are CLI verbs, emitted to per-host command/skill files; no host coupling in the core.
- One snapshot mechanism covering per-module and whole-home rollback.
- An explicit `zuzuu/api.mjs` the workbench calls instead of scraping `--json`.
- Zero regressions: every stage keeps the suite green (96 hermetic/regression test files today).

**Non-goals (this doc)**
- An MCP server (kept as a cheap later projection of the same verbs; not built now).
- Embeddings / vector / DuckDB / graph-DB in the core (→ `optionalDependencies`, workbench tier).
- A Cypher/GQL query language *surface* before the SQL/relational surface ships and is benchmarked.
- Rewriting `web/` (it re-points at `api.mjs`; its internals are out of scope).
- The pi-based opinionated default host (separate, later; this revamp must not block it — it is the eventual no-preference default).

## 4. Resolved decisions

Each was an open question at brainstorm start; each is resolved with prior-art backing.

**(a) Host-facing invocation — per-host command/skill files + a discovery surface.** Capabilities are CLI verbs; `zz enable` emits native per-host command/skill files via **emit adapters with semantic translation** (tool renames, namespace flattening, frontmatter rewrites differ per host — the AGENTS.md/AAIF + Compound-Engineering-plugin pattern). The "discovery/notes surface" = self-documenting `--help` + a `zz capability schema <name>` introspection verb — **not** a separate registry file. MCP is deferred; if added, it is a lazy-discovery projection of these verbs (structurally identical), not a rewrite. *Rationale:* CLI-first is empirically validated (Perplexity's 72% MCP context waste; YC building CLI-over-MCP); one-source→per-host-emit proven across 60k+ AAIF repos.

**(b) One capability registry — the item file is its registration.** A single frontmatter block per item/module, typed sub-keys per capability (`capabilities.mine/.recall/.run/.gate`) routing to exactly one handler (no conditional dispatch). Backed by a **machine-generated flat index** rebuilt on `init`/`distill`. Discovery is filesystem-scan with **scope-ordered dedup `repo > user > system`** and an **explicit conflict-resolution priority declared in the spec** before two modules can claim a verb; bound traversal (~6 levels / 2000 dirs). *Rationale:* every cautionary tale — Backstage Provider-vs-Processor, Terraform Resource-vs-DataSource, Codex SKILL.md + sidecar yaml, VS Code `configuration`-vs-`configurationDefaults` — is a one-registration-surface violation. This is the highest-leverage structural decision.

**(c) Markdown-as-query at zero-dep — `node:sqlite`, two-tier.** Files are canonical; SQLite is a regenerable cache (index corruption must never corrupt knowledge). Schema: `files` + `property(file_id, key, value)` (KV → no migration as frontmatter keys appear) + `links(from_id, to_id, text)`. **FTS5** for body recall + BM25; **recursive CTEs** for N-hop traversal (~depth 6). Every retrieval verb ships `brief|full` mode (default brief = frontmatter + connection IDs; body is a separate fetch), `--depth N`, and `--dry-run` (node count before materializing). Parse-on-demand (`yq`/`rg`) is acceptable only below ~50 items and only on the **write** path; the index is mandatory for reads above that. The parser treats YAML failures as logged warnings, and surfaces a **count of nodes excluded for a missing field** (Dataview's most-cited gotcha). *Cypher/GQL syntax is deferred* — a UX skin over the SQL surface, layered only after filesystem benchmarks. Embeddings/DuckDB → `optionalDependencies`.

**(d) One snapshot mechanism — three layers, pointer-flip rollback.** (i) **Content store**: flat SHA256-named blobs at `.zuzuu/generations/.store/<aa>/<rest>`, deduped across modules/generations, `fs.linkSync` for unchanged files. (ii) **Per-module generation chain**: an incrementing *integer counter* (the generation identity, not the hash) + a small JSON entry recording that module's **Merkle root** = SHA256(sorted item hashes) + a lineage UUID + parent + timestamp. (iii) **Whole-home checkpoint**: a top-level entry = SHA256(sorted `(module, active-hash)` pairs). Rollback at either scope = atomic pointer write (`.ref` rename-swap) — **never a new write, never a delete**; blob GC is a separate deferred pass. *Rationale:* Nix two-level indirection × Dolt Merkle composition; avoids OSTree's whole-tree-only and Terraform's non-atomic rollback.

## 5. Target architecture

```
zuzuu/
├── kernel/        the ONLY code that touches .zuzuu/ — the 3 primitives
│   ├── item.mjs        parse/serialize one frontmatter file (the atom)
│   ├── module.mjs      manifest + schema + capability bindings
│   ├── capability.mjs  the ONE registry: name → {schema, handler, permission}
│   ├── store.mjs       layout + global addressing (module:id) + scope dedup
│   ├── index.mjs       the node:sqlite cache (files/property/links, FTS5, CTEs)
│   └── snapshot.mjs    content store + generation chains + checkpoints (scope: module|home)
│
├── capabilities/  each verb a plugin; built-ins ship rich impls, declaratives fall back
│   ├── mine.mjs · recall.mjs · run.mjs · gate.mjs · validate.mjs · render.mjs · propose.mjs
│
├── pipelines/     generic over kernel + capabilities, NO module names hardcoded
│   ├── observe.mjs · evolve.mjs · serve.mjs
│
├── hosts/         the edge: per-host capture parsers + lifecycle hook receiver + emit adapters
│   ├── adapters/{claude-code,codex,gemini-cli,opencode,pi}.mjs
│   └── emit/<host>.mjs    capability → native command/skill file (semantic translation)
│
├── api.mjs        the explicit core API — the SAME surface the CLI and web/ daemon call
└── cli/           a THIN veneer: verb → api call (generic verbs + a few module-specific UX)
```

vs today: `module/` → `kernel/`; `modules/<f>/` + the substrate dirs (`knowledge/`, `actions/`, `guardrails/`) dissolve into `capabilities/`; the 3 declaration vocabularies collapse into `capability.mjs`; `generation/` + `checkpoint` unify into `snapshot.mjs`; `api.mjs` replaces `--json` scraping.

## 6. The two novel bets (everything else is validated prior art)

1. **Portable, zero-dep, CLI-native graph + relational query over markdown.** Every existing query layer is host-coupled (Dataview→Obsidian, Yamlink→VS Code) or carries a runtime dep (mdaifs→Python, kg→sqlite-vec). No one ships `node:*`-only, CLI-first traversal + relational filtering over this substrate.
2. **That query layer wired into a human-gated evolve loop.** markdown→SQLite is not novel; coupling on-demand query to miners (the K8s controller-watch pattern applied to faculty growth) + proposals + generations/rollback, all human-gated, is.

**Guard:** benchmark the query engine on a real filesystem corpus *before* freezing any Cypher-like verb as stable. Ship SQL/relational + CTE traversal first.

## 7. Staged plan (strangler — never big-bang)

Each stage is independently shippable, test-anchored, reversible. Add characterization tests on any untested seam *before* moving it (the `sessions/` discipline).

- **Stage 1 — One capability registry.** Make built-ins declare capabilities the way declaratives do; delete the `hooks` booleans and the synthesize-vs-handwrite fork; the item/module frontmatter becomes the single registration surface + flat index. *Done when:* one declaration path, `invoke()` unchanged externally, suite green. *Highest leverage; unblocks the rest.*
- **Stage 2 — Query engine.** `kernel/index.mjs` (files/property/links, FTS5, CTEs) + `capabilities/recall.mjs` with `brief|full`, `--depth`, `--dry-run`. SQL/relational surface only; no Cypher skin yet. *Done when:* `zz recall` answers relational + N-hop queries from the index; benchmarked.
- **Stage 3 — Unify snapshots.** Collapse `generation/` + `checkpoint` into `kernel/snapshot.mjs` (content store + per-module integer chains + home checkpoint; pointer-flip rollback). *Done when:* per-module and whole-home rollback both flip pointers into one store; existing generation/checkpoint tests pass.
- **Stage 4 — Per-host emit + `api.mjs`.** Extract `api.mjs`; point the `web/` daemon at it (stop scraping `--json`); add `hosts/emit/<host>.mjs` + `zz capability schema`. *Done when:* the daemon imports the API; `zz enable` emits per-host command/skill files.
- **Stage 5 — Substrate → capabilities + CLI veneer.** Move `knowledge/`/`actions/`/`guardrails/` logic to register as capability impls; delete `modules/<f>` glue; thin the CLI to verb→api. *Done when:* `modules/<f>/index.mjs` is gone; commands are a veneer.
- **(Later, out of this doc) — MCP projection** of the same verbs; the Cypher/GQL skin once benchmarked.

## 8. Success criteria

- A new module or capability is declared in **one** place (its frontmatter) and touches no spine code.
- The agent answers a multi-hop knowledge question via a single CLI query **without** the corpus entering its context.
- `web/`'s daemon calls `api.mjs`; zero `--json` stdout scraping remains.
- Per-module and whole-home rollback are both single atomic pointer writes.
- Every stage lands with the full suite green and zero behavior change to existing `--json` shapes (until intentionally superseded by `api.mjs`).
- CLI core `dependencies` stays empty (`node:*` only).

## 9. Risks & open questions

- **Query-engine scale is the unproven bet.** Benchmark before freezing verbs; keep the index a regenerable cache so a bad call is never destructive.
- **Conflict semantics for duplicate verbs across modules** must be specified before two modules claim one verb (don't inherit oclif's implicit first/last-wins).
- **`node:sqlite` maturity / Node ≥ 22** — already a dependency (OpenCode adapter); confirm FTS5 availability in the bundled build.
- **Open:** does `recall` unify across modules (global `module:id` graph) on day one, or per-module first? *(Leaning global addressing from the start — it's what makes it a brain, not 5 silos — but stage it behind the per-module index.)*
- **Open:** exact frontmatter contract — adopt OKF's "only `type` required" minimalism + `spec`/`status` split + bitemporal `valid_from`/`superseded_by`? *(Resolve in `/ce-plan`.)*

## 10. References

- Prior-art brief (6-angle research): validated / borrow / avoid / novel / decision-implications — workflow run `wf_19c67263-4c2`.
- Grounding dossier (current-code claims, file:line): `/tmp/compound-engineering/ce-brainstorm/cli-revamp/grounding.md`.
- Current code touchpoints: `zuzuu/module/registry.mjs`, `zuzuu/module/capabilities.mjs`, `zuzuu/module/capability-registry.mjs`, `zuzuu/modules/<f>/index.mjs`, `zuzuu/module/generation/{read,write,checkpoint}.mjs`, `web/packages/daemon/src/zuzuu-cli.ts`.
- Project canon: `docs/DESIGN.md` (§13 roadmap), `docs/LOG.md`, `CLAUDE.md`.
