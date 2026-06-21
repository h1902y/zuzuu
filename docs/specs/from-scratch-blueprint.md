# zuzuu — From-Scratch Blueprint

- **Status:** target architecture / build blueprint. Operationalizes `thesis-and-risks.md` (the seed + resolved risks) and `cli-revamp.md` (the staging) under the **R8 decoupled-sequence** decision.
- **Date:** 2026-06-18
- **The number to beat:** the current core is **13,333 lines / 105 files** (+ the `web/` workbench). The genuine primitive hides inside it at ~2,500–3,500 lines. This blueprint targets a **v1 core of ~4,300 lines** (host-neutral kernel + a 2-host observe plugin), with the owned-terminal "drive" product additive later — not a rewrite.
- **Method:** borrow the theses, own only the novel composition. Greenfield the *core*; **harvest** the proven assets; **cull** the strategy-driven and accreted weight.

---

## 1. The one-paragraph target

A host-neutral **kernel** implements the three primitives (Item / Module / Capability) over a directory of OKF-conformant markdown files, with a `node:sqlite` index for relational + bounded-graph queries, contained shell **actions** (srt-backed), and a human-gated **evolve loop** (mine → propose → review → snapshot). Everything else is a *plugin* or *adapter* around that kernel: **observe** (parse 1–2 hosts' sessions to seed the loop) is one ingestion adapter; **drive** (the owned terminal, "the user just chats") is the deferred destination, layered on the same kernel. The kernel knows nothing about any host.

## 2. What we borrow (and therefore don't write)

| Concern | Borrow | Form | Lines we save |
|---|---|---|---|
| Note/item file format | **OKF v0.1** (Apache-2.0) | a *spec* — we conform + a 3-rule lint | the whole bespoke envelope/registry debate |
| Shell containment | **`@anthropic-ai/sandbox-runtime`** (Apache-2.0) | a *dep* (optionalDependency) | a from-scratch Seatbelt/bwrap stack |
| Index / query | **`node:sqlite`** (FTS5 + recursive CTEs) | stdlib | a query engine + a DB dep |
| Snapshots | git object model / Nix two-level indirection | a *pattern* (content-store + pointer) | — |
| Graph (later) | **Apache AGE** thesis (graph-as-SQL-façade) | *parked* — native-extension blocker | premature graph work |

The rule: **a borrowed thesis is conformance or a thin adapter, never a fork.** OKF adds ~0 runtime lines (a lint); srt is a dep behind one call; `node:sqlite` is stdlib.

## 3. Target structure & line budget

```
zuzuu/
├── kernel/                      host-neutral core — the ONLY code touching .zuzuu/
│   ├── item.mjs       ~250   parse/serialize OKF frontmatter (the atom) + 3-rule lint
│   ├── module.mjs     ~150   manifest + schema + capability bindings (no hooks booleans)
│   ├── capability.mjs ~300   the ONE registry: name → {schema, handler, permission}
│   ├── store.mjs      ~250   layout, id-addressing (module:id), scope dedup   [HARVEST core/store.mjs]
│   ├── index.mjs      ~500   node:sqlite cache: files/property/links, FTS5, CTE  [R2: derived, rebuildable]
│   └── snapshot.mjs   ~250   content store + per-module chains + checkpoint (pointer-flip)
│                              ── kernel subtotal ≈ 1,700
├── capabilities/                each verb a plugin; built-ins ship rich impls
│   ├── recall.mjs     ~250   query (brief|full, --depth, --dry-run)  [novel bet #1]
│   ├── run.mjs        ~300   contained action exec (srt) + the novel run.allow command-axis
│   ├── gate.mjs       ~150   Tier-0 advisory rule check (honest)   [HARVEST guardrails/engine.mjs]
│   ├── mine.mjs       ~250   session → proposals
│   ├── validate.mjs   ~120   schema check (opt-in per kind)  [R7]
│   ├── render.mjs     ~100   item → display
│   └── propose.mjs    ~120   proposal record + provenance
│                              ── capabilities subtotal ≈ 1,390
├── pipelines/                   generic over kernel+capabilities, NO host names
│   ├── evolve.mjs     ~300   mine → inbox → propose → review → snapshot (human-gated)
│   ├── serve.mjs      ~200   digest (the map surface, R4) + gate + recall + run at runtime
│   └── observe.mjs    ~150   ingest a session (mode-neutral): adapter → mine
│                              ── pipelines subtotal ≈ 650
├── hosts/                       the EDGE — a plugin, not the foundation (R8)
│   ├── adapters/
│   │   ├── claude-code.mjs ~250   [HARVEST]
│   │   └── opencode.mjs    ~260   [HARVEST]   (gemini/codex/pi CULLED)
│   ├── capture-core.mjs    ~300   Event[] → spans → OTLP  [HARVEST capture/core/*]
│   └── emit/<host>.mjs      ~50/host  capability → native command/skill file (per-host, when needed)
│                              ── observe plugin subtotal ≈ 800
├── api.mjs              ~250   the explicit core API the web/ daemon calls (no --json scraping)
└── cli/                ~500   thin veneer: verb → api call
                                ── glue subtotal ≈ 750

                                ───────────────────────────────
                                TARGET CORE v1 ≈ 4,290 lines
```

Drive (the owned terminal) is **not in this budget** — it's a later `harness/` that consumes `api.mjs`, additive.

## 4. Harvest list (survives the 13,333)

Keep the craft; re-file it under the new structure.

| Asset (current) | Why it survives | New home |
|---|---|---|
| `core/store.mjs` (git-native split, deterministic paths) | proven, load-bearing | `kernel/store.mjs` |
| `tests/` (96 hermetic + regression files, golden ids) | the safety net for the greenfield core | unchanged; re-point imports |
| `capture/adapters/claude-code.mjs`, `opencode.mjs` | the 2 hosts that survive the cull | `hosts/adapters/` |
| `capture/core/{ids,event,spans,otlp}.mjs` | deterministic-id + OTLP discipline | `hosts/capture-core.mjs` |
| `guardrails/engine.mjs` | Tier-0 advisory gate (relabel honest) | `capabilities/gate.mjs` |
| `home/{scaffold,seeds}.mjs` | `init` scaffolding (adapt seeds to OKF) | kept; OKF-conform the seeds |
| `digest/compose.mjs` | the map surface (R4) | `pipelines/serve.mjs` |
| `sessions/session-worktree.mjs` | the **sandbox boundary** for srt actions (R1) | kept |
| `eval/{rank,score}.mjs` | proposal ranking (R9: cheap review) | folded into `evolve` |
| `module/generation/*` | the snapshot mechanic | unified into `kernel/snapshot.mjs` |

## 5. Cull list (the strategy + accretion weight)

| Cut | Why | ~lines |
|---|---|---|
| 3 of 5 capture adapters (gemini, codex, pi) | prove host-agnosticism already proven; brittle reverse-engineered parsers | ~700 |
| The 3 capability vocabularies (manifest map + `hooks` booleans + synthesize-vs-handwrite fork) | one frontmatter surface replaces them (cli-revamp Stage 1) | ~400 |
| `modules/<f>/index.mjs` adapter glue (×5) | translation tax; substrate registers directly as capabilities | ~1,100 |
| Generations *and* checkpoints as two systems | one `snapshot.mjs` | ~300 |
| `sessions/session-manifest.mjs` (Wave C portable manifest), recording markers (Wave D) | infra-tier, defer | ~400 |
| `--json` scraping seam in `web/` daemon | replaced by `api.mjs` import | (web-side) |

The cull is **not** "delete good code" — it's "stop carrying code whose only job was a strategy (5-host observe) or an accretion (3 vocabularies) we've now resolved."

## 6. The two open correctness gates, resolved as kernel rules

R8 surfaced these by making the kernel concrete. Both are *disciplines the kernel encodes*, with a borrowed thesis.

### R2 — write-ownership & integrity (the index is a projection, never a truth)

**Borrow:** git's index model — files are canonical, the index is a derived, rebuildable cache.

**Kernel rules:**
- `kernel/index.mjs` is a **pure projection** of the files. It is never authoritative; a corrupt/missing index is rebuilt, never repaired-in-place.
- **Freshness is a cheap check on read** — mtime/content-hash per file; a stale row triggers a targeted re-index of that file, not a full scan. Full rebuild is idempotent and fast.
- **Links are id-based, resolved through the index** — an item references `module:id`, not a path, so rename/move survives. (OKF stores the path link in the body; the kernel also records the resolved id edge.)
- **Integrity is a first-class capability**, not a hidden assumption: `zz check` → `orphans`, `broken-links`, `cycles`, `stale-index`. The graph is honestly best-effort; *detecting* divergence is trivial and queryable.
- Drive-mode (later) owns more of the write path and tightens this further; the rule is the floor for both modes.

### R3 — the node-vs-artifact boundary (draw the line, with examples)

**Rule:** the data layer holds **knowledge nodes** and **metadata-about-artifacts** — never artifact bytes. Artifacts are ordinary files the actions layer produces/operates on.

**Decision test:** *Is it queried or related across the graph?* → a **node**. *Is it a deliverable blob?* → an **artifact** (a file) + a thin **metadata node** (`type: artifact`) that points at it and carries its tags/relations.

| Thing | Node? | How it lives |
|---|---|---|
| "Acme likes minimal blue decks" | yes | `type: knowledge` item (prose + tags + relations) |
| A weekly report **deck** (`.pdf`) | no | a file in `reports/`; a `type: artifact` node points at it |
| A 500-row metrics **report** | no | a `.csv`/`.parquet` file; metadata node describes it |
| A todo with `due`/`depends-on` | yes | `type: todo` structured item — one node per todo (opt-in schema, R7) |
| A build **action** | yes | `type: action` item (the worked example, Appendix A of thesis doc) |

Tabular/relational project data (todos, client records) is a **structured item kind with opt-in enforced schema** — not free-form prose, not a forced one-file-per-row of a spreadsheet.

## 7. Build order (each rung shippable, test-anchored)

The greenfield core is built **kernel-up**, harvesting as it goes, with the existing test suite as the net.

1. **Kernel substrate** — `item.mjs` (OKF parse + lint) + `store.mjs` (harvest). *Done: a folder of OKF items round-trips; lint passes.*
2. **Index + recall** — `index.mjs` (`node:sqlite`) + `capabilities/recall.mjs`. SQL/CTE only; **benchmark before freezing any verb** (novel bet #1). *Done: multi-hop query answered from the index without the corpus entering context.*
3. **Capability registry** — `capability.mjs` + `module.mjs`, one frontmatter surface. *Done: a module/capability is declared in one place, touches no spine code (cli-revamp Stage 1 endpoint).*
4. **Actions** — `capabilities/run.mjs` (srt, worktree-scoped, `.zuzuu/` carved RO) + the novel `run.allow` command-axis + `gate.mjs` (Tier-0, harvested, relabeled honest). *Done: an action runs contained; policy enforced per Appendix-A table.*
5. **Evolve loop** — `mine`/`propose` + `evolve.mjs` + `snapshot.mjs`. *Done: a session yields proposals; review approves; snapshot pins; rollback is a pointer flip.*
6. **Observe plugin** — `hosts/adapters/{claude-code,opencode}` + `capture-core` + `observe.mjs`. *Done: a real Claude Code session ingests and feeds the loop — the cold-start solution.*
7. **`api.mjs` + CLI veneer** — point `web/` at the API; thin the commands. *Done: zero `--json` scraping remains.*
8. **(Deferred) Drive** — `harness/` (pi) on `api.mjs`, once the loop has demonstrable value.

## 8. Decision: greenfield the core, harvest the assets, don't strangle

A clean rewrite would lose the test corpus and the proven adapters (rewrites die). Pure strangling would carry the observe-strategy weight forever. The blueprint is the middle: **greenfield `kernel/` on the borrows**, **harvest** §4 under the new structure (the tests are the safety net), **cull** §5. The owned-terminal product is additive on top — never a second rewrite, because the faculties don't change between observe and drive.

---

## References

- `docs/specs/thesis-and-risks.md` — the seed + the risk register (R1/R7/R8 resolved; R2/R3 resolved here as kernel rules; R5 deferred).
- `docs/specs/cli-revamp.md` — the architectural staging this operationalizes.
- Research: shell-containment + OKF/AGE (`wf_dee3864d-734`); filesystem-native prior art (`wf_19c67263-4c2`).
- Key adoptables: OKF v0.1 · `@anthropic-ai/sandbox-runtime` · `node:sqlite` (FTS5/CTE) · Apache AGE (deferred).
