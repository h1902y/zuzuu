# Docs audit — the whole surface vs. shipped 2.0.0 (03-07-2026)

> **Scope.** Every doc in the repo: `README.md`, `CHANGELOG.md`, `docs/MODEL.md`, `docs/DESIGN.md`,
> `docs/LOG.md`, `docs/README.md`, all 27 pages in `docs/guide/` (+ `_Sidebar.md`/`Home.md`), and the
> full lab-notebook tree (`docs/specs/`, `docs/audits/`, `docs/design-research/` incl. `workbench/`,
> `docs/brainstorms/`, `docs/ideation/`, `docs/inspiration/` incl. `research/`, `docs/learn/`,
> `docs/plans/`, `docs/assets/`). Claims were checked against the actual shipped code
> (`src/use/act.mjs`, `src/use/secrets.mjs`, `web/src/server/{acp,zuzuu-read,zuzuu-write}.ts`,
> `src/cli/commands.mjs`) and against `CHANGELOG.md`'s `[2.0.0]` entry, not against what the docs
> claim about themselves. **Read-only audit** — no doc or code was modified; this file is the one
> write.

## TL;DR

The docs accreted exactly as expected across a long build: the **newest** pages (`Tools.md`,
`Secrets.md`, `Workflows.md`, `MODEL.md`, `Decision-Log.md`'s 02-07 entries) are honest, precise,
and verified line-for-line against the code — they are the standard the rest should be pulled up
to. The **older** pages that predate the 02–03/07 reframes (two write lanes, the World/Omnibar
single-screen redesign, the tool/secrets/triggers substrate) were never revisited, so they now
actively describe a system that no longer exists: `Workbench.md` tells users every grid edit is a
reviewable proposal (false — the operator lane lands instantly); `Glossary.md` says "every write
passes through review" (false since 02-07); three `docs/learn/` lessons teach features that were
removed or never matched reality. **`README.md` has zero mentions of Tools, Secrets, Triggers,
Workflows, or "durable"** — the entire §I/§J execution substrate, which `CHANGELOG.md` lists first
under `[2.0.0]`, is invisible at the front door. `Secrets.md` — one of the largest, newest,
most safety-relevant pages — is completely unreachable from either navigation entry point
(`_Sidebar.md` or `Home.md`).

None of this is fabrication-grade over-claiming (no page invents a feature from nothing); it's
**staleness that reads as an over-claim** — a page frozen at the moment it was written, now
contradicted by a later, correct page sitting right next to it in the same directory.

---

## 1. Per-doc inventory

Legend — **State**: `current` (accurate as of 2.0.0) · `stale` (accurate once, now outdated) ·
`over-claim` (describes something that doesn't work as written) · `gap` (thin/missing coverage of
a shipped thing) · `orphan` (unreachable via nav) · `historical` (lab-notebook, correctly dated,
no currency expectation).

### Core / canonical docs

| Path | Purpose | State | Verdict |
|---|---|---|---|
| `README.md` | front door: pitch, quickstart, what-you-get, competitive frame | **stale** | Updated for the 02-07 wave (two lanes, the World, modules-as-tables); zero mentions of Tools/Secrets/Triggers/Workflows/Flow — the 03-07 wave is invisible. Biggest single-doc gap in the corpus. |
| `CHANGELOG.md` `[2.0.0]` | release notes | current | Extremely precise, file:line-grade detail; every internal path it references resolves. The best-maintained doc in the repo. |
| `docs/MODEL.md` | canonical term registry, 4 planes | **current** | Fully reflects §I execution substrate, tool/toolkit (§I.6), secrets (§J.3/§J.5), the durable runner, triggers, Flow. This is the doc a rewrite should treat as ground truth. |
| `docs/DESIGN.md` | strategy & rationale (v1-era + v2 additions) | historical, self-disclaiming | Its own banner says the v1 architecture sections are deleted-in-code and points to CLAUDE.md/learn/ for current mechanics — honest about its own staleness. Fine as-is. |
| `docs/LOG.md` | append-only build journal | current (by design) | Append-only, dated; tail entries reach 01-07-2026. No currency expectation — working correctly. |
| `docs/README.md` | the doc-map / MECE index | **gap** | `Tools.md`, `Secrets.md`, `Workflows.md`, `Omnibar.md`, `Observability.md` — 5 of 2.0.0's newest, most substantial guide pages — appear nowhere in its index table or its "wiki source" inventory. Violates its own "maintain it when you add one" rule. |

### `docs/guide/` — the user wiki (27 pages + nav)

| Path | Purpose | State | Verdict |
|---|---|---|---|
| `_Sidebar.md` | wiki nav | current, but incomplete | Lists every page **except `Secrets.md`** — the one orphan. |
| `Home.md` | wiki landing page | **stale** | Its curated "Pages" list predates 8 shipped pages (Workflows, Tools, Flow-View, Omnibar, Observability, Daemon-API, Decision-Log, Inspiration-Log) — none appear in the list, though 3 are mentioned in intro prose. Reads like it was written once at genesis and never revisited as pages were added. |
| `Getting-Started.md` | install → init → first proposals | current | Accurate to the two-tier verb grammar and both host paths. |
| `Modules-as-Tables.md` | schema, computed cols, views, import/export, the grid | **current** | Long, detailed, and correctly reflects the operator lane, Query v2, the field-config panel — a model page. |
| `Two-Lanes.md` | the operator/agent write-lane split | current | The canonical statement of the 02-07 reframe; everything else should agree with this page and several don't (see §2A). |
| `Tools.md` | tool/toolkit model, `binding`, MCP-native reading | **current, best-in-class** | Verified line-for-line against `src/use/act.mjs:168-174` and `src/cli/commands.mjs:220`. Explicitly labels mcp as stubbed and agent as `needsHost` — exactly matches the code. Two mechanical link-convention violations (§2E). |
| `Secrets.md` | secret declarations, resolution, redaction | **current, best-in-class — but orphaned** | Verified against `src/use/secrets.mjs`; honestly marks oidc as unresolvable locally and fly as env-equivalent. Content is exemplary; navigation is broken (§2E). |
| `Workflows.md` | 3 execution tiers + the durable runner + triggers | current | Matches `grow/run.mjs`/`grow/trigger.mjs` per MODEL.md's parallel account. Same link-convention violation as Tools.md (§2E). |
| `Flow-View.md` | the 3rd Table/Map/Flow projection | current | Matches CHANGELOG's Flow entry; honestly scopes itself read-only. |
| `The-World.md` | the map surface, ghosts, the globe | current | Consistent with Two-Lanes.md and Omnibar.md's single-screen model. |
| `Omnibar.md` | ⌘K, the one-screen shell | current | This page (not `Workbench.md`) is the accurate account of the current UI — explicitly states "the Overview and Setup pages are retired" (line 94). |
| `Observability.md` | log.jsonl/generations.json/module.md as UI-explained files | current | Accurate; ties cleanly to Two-Lanes/Modules-as-Tables/The-World/Decision-Log. |
| `Daemon-API.md` | the HTTP/WS surface | **gap** | Missing 4 shipped routes from its table: `GET /items` (Everything view), `GET /module/:key/item/:id/history` (Observability), `GET /module/:key/generation/:from/diff/:to` (gen-diff panel), `POST`/`PATCH .../column[/:name]` (field-config panel) — all present in `web/src/server/zuzuu-read.ts`/`zuzuu-write.ts` but undocumented. |
| `Workbench.md` | `zz host web` walkthrough | **over-claim** | The corpus's worst offender — see §2A #1/#2. Needs a full rewrite, not a patch. |
| `Module-Standard.md` | the envelope, note›module›project, schema | **over-claim (1 line) + stale** | Line 44 conflates the write boundary with "the review gate" (§2A #3). No mention of root-mode, tool/toolkit, or the operator lane anywhere. Overlaps substantially with `Module-Home.md` (§2F). |
| `Module-Home.md` | what `zz init` scaffolds | stale | Accurate for what it describes but describes only the classic (`.zuzuu/`) mode; no root-mode mention. Overlaps `Module-Standard.md` (§2F). |
| `Knowledge.md` | the Knowledge module | **stale** | "How knowledge gets in" table omits the operator lane's direct `note create` path entirely — reads as if observe→review is the *only* door, which stopped being true 02-07. |
| `Guardrails.md` | the enforced `PreToolUse` gate | **gap** | Accurate and honestly scoped (correctly says only Claude Code is wired) but silent on the run-safety-floor's fail-closed-for-agent-actor behavior (§I rung 3, in MODEL.md/CHANGELOG) — a safety-relevant behavior with no user-facing doc. |
| `Glossary.md` | plain-language term list | **over-claim + broken link** | Lines 17 & 28 both restate "every write passes through review" (false since 02-07, §2A #3/#4). Line 10's `[[Module Home\|home]]` mistargets `Home.md` instead of `Module-Home.md` (§2E). |
| `Troubleshooting.md` | `zz doctor` + symptom table | current | Consistent with the per-host pages on guardrails-gate host coverage. |
| `Roadmap.md` | shipped/next tracking | **stale** | "Shipped (verified)" section reads pre-2.0.0 — no mention of the World, Flow, Omnibar, Tools, Secrets, Triggers, the durable runner, computed columns, saved views, cross-module search, Everything, the globe, or the operator lane. Reads like a 17-06-2026 snapshot living in a 03-07-2026 repo. |
| `Decision-Log.md` | the committed-decisions list | **gap** | Has 02-07-2026 entries (two lanes, World-is-a-view, the envelope floor) but **zero** entries for the 03-07-2026 decisions: tool-as-type/MCP-native, the secrets model, the durable runner, triggers, Flow — arguably the release's biggest calls, absent from the "don't relitigate" list. |
| `Inspiration-Log.md` | prior-art index | current | Well-maintained, correctly scoped as "influences, not feature claims." |
| `Claude-Code.md` / `Codex.md` / `Gemini-CLI.md` / `OpenCode.md` / `pi.md` | per-host guides | current | All five internally consistent with each other, with `Guardrails.md`, `Roadmap.md`, and `README.md`'s host-coverage line ("wired for Claude Code" — verified, not contradicted anywhere). |
| `Recipe-Personal-Vault.md` | non-coding flagship walkthrough | current | Strong, concrete, verified-shape recipe; underused as a front-door pointer (§3). |
| `README.md` (guide) | wiki publishing conventions | current | States the "shipped + verified only" rule and the `[[wiki-link]]` convention that `Tools.md`/`Workflows.md`/`Glossary.md` then violate. |

### Lab notebook — `docs/{specs,audits,design-research,brainstorms,ideation,inspiration,learn,plans}`, `docs/assets/`

| Path / group | Purpose | State | Verdict |
|---|---|---|---|
| `docs/specs/2026-06-16-session-management-roadmap-l2-to-l7.md` | L1→L7 session-portability ladder | historical | Matches `Roadmap.md`'s still-unbuilt cloud-tier item. Fine. |
| `docs/specs/2026-06-22-tiered-architecture.md` | OSS/Pro/Enterprise model | historical | `MODEL.md` §Tiers links here correctly. Fine. |
| `docs/specs/2026-06-23-conversational-composer.md` | composer input-chrome spec | historical | Shipped via Omnibar; fine as record. |
| `docs/specs/2026-06-24-collapse-mutation-log-into-git.md` | git-native log/generations | historical | Shipped; matches Decision-Log's "git is the substrate." Fine. |
| `docs/specs/2026-06-24-ontology-aligned-reshape.md` | note/module/project reshape | historical | Shipped (v2 kernel). Fine. |
| `docs/specs/2026-06-24-plane2-operation-vocabulary.md` | use/grow verb naming | historical | Shipped. Fine. |
| `docs/specs/2026-07-02-personal-app-roadmap.md` | 5-phase plan: two lanes, one daemon, map-first, query v2, automations | **gap** | ~95% shipped per CHANGELOG cross-check, zero status markers anywhere in the file; still filed as "unshipped work" in `docs/README.md`'s IA. |
| `docs/specs/2026-07-02-polish-showcase-experience.md` | §A–§J: README rewrite, map-first shell, durable runner, secrets | **gap** | §A–§J are **all shipped** (Flow, triggers, tool/toolkit, secrets, the globe, Omnibar, Observability, the native table) — the single biggest "this spec is now a shipped feature, not a design" gap in the tree, ~1000 lines with no shipped/date annotation. |
| `docs/audits/2026-07-02-*.md` (6 files: backend/experience/frontend-merge/integration-seams/product-thesis/table-review) | point-in-time reviews of the pre-World workbench | historical | All resolved by later work; correctly dated; fine as workshop record. |
| `docs/audits/2026-07-03-{composition,durable-runner,run-safety,secrets,triggers}-review.md` | adversarial pre-merge reviews of §I/§J rungs | historical | `CHANGELOG.md`'s "Fixed" entries cite these by name and finding-id (e.g. "NIT 2," "SHOULD-FIX 1") — a genuinely good, traceable audit→fix linkage. Fine as-is. |
| `docs/design-research/` (00–14 + README + tokens-candidates + `shots/`) | Mobbin-grounded visual/IA research | historical | Dated, self-labeled pre-build research; no user-doc leakage. |
| `docs/design-research/workbench/` (README + 01–11) | 2nd-pass research feeding the World/Omnibar redesign | historical | `09-taste-redesign-direction.md`/`10-experience-rethink.md` are the direct source material for the shipped single-screen shell — good cross-reference for whoever rewrites `Workbench.md`. |
| `docs/brainstorms/` (7 files) | ce-brainstorm requirements docs | historical | Clean provenance chain (each names its ideation origin + downstream plan). Fine. |
| `docs/ideation/` (4 `.md` + 1 `.html`) | ce-ideate exploration | historical | Explicitly "not a plan." Fine. |
| `docs/inspiration/` (11 files) + `research/` (5 files) | prior-art source audits + the 100-project survey | historical | Self-labeled "not canon." Minor: `agent-harness-survey.md` cites two grounding docs (`agentic-platform-concept.md`, `design-system-and-canvas.md`) that don't exist in the repo — likely pre-DESIGN.md-consolidation artifacts, low priority. |
| `docs/learn/00–09` + `glossary.md` + `reading-the-code.md` + `the-terminal-mechanically.md` + `README.md` | the contributor educative walk | **stale, self-contradicting** | See §2A #7/#8 — 3 of 9 lessons now describe removed/never-real mechanics or a retired UI, and lesson 01 contradicts the book's own glossary. |
| `docs/plans/` (12 files, gitignored per `docs/README.md`) | ce-plan execution plans | historical, **claim verified true** | `git check-ignore -v docs/plans/*.md` confirms every file is actually gitignored and untracked — `docs/README.md`'s claim about this directory is accurate. |
| `docs/assets/README.md` | placeholder note for a missing screenshot | current | Honest: `world-vault.png` genuinely doesn't exist yet; matches the TODO in `docs/README.md:21` and the italic placeholder in `The-World.md:5`. |

---

## 2. Ranked findings

### A. Over-claims (mislead a user about what works today) — highest priority

1. **`docs/guide/Workbench.md:25`** — *"Every one of those edits lands the same way an approval does — as a **reviewable proposal** at the gate, never a silent write."* This is false for 2.0.0: `POST /module/:key/row` (`web/src/server/zuzuu-write.ts:38`, documented correctly in `Daemon-API.md:33` as *"the operator lane — direct row create (instant, validated)"*) lands a grid edit **immediately**, no approval step. Directly contradicted by `Modules-as-Tables.md:54`, `The-World.md:16` ("your creates appear as solid nodes immediately"), and `Daemon-API.md`'s own route table. This is the single most misleading line in the corpus — it tells a user the primary workbench interaction works the opposite of how it actually works.

2. **`docs/guide/Workbench.md`, whole-page framing** — describes a "Home" landing page with five module cards, a generations timeline, recent sessions, and a separate "Open workbench — the IDE view" destination. `docs/guide/Omnibar.md:94` states plainly: *"There is one screen — the World. The Overview and Setup pages are retired... the nav rail is gone."* Verified against the actual client tree (`web/src/client/shell/stage/World.tsx` is the shipped stage; no module-cards Home component exists). `Workbench.md` documents a UI that has been retired, not the shipped one.

3. **`docs/guide/Glossary.md:17`** — *"review — approve or reject a proposed change. **This is the gate** — every write to the brain passes through it."* False since the 02-07-2026 two-lanes reframe (`Decision-Log.md`'s own "Two write lanes" entry): operator writes bypass review entirely.

4. **`docs/guide/Glossary.md:28`** — *"The gate — the human-approval step (review)... 'The gate is the moat.'"* Same stale framing — the actual moat per `Two-Lanes.md` is the single write boundary (`grow/commit.mjs`), which gates *agent* writes specifically, not every write.

5. **`docs/guide/Module-Standard.md:44`** — *"a write with the wrong type or a missing required field is **rejected at the review gate**"* — conflates the write boundary (validates both lanes) with "the review gate" (agent-lane only).

6. **`docs/guide/Knowledge.md:34-39`** — the "How knowledge gets in" table presents `observe → review` as the *only* path in, omitting the operator lane's equally-valid direct `zz note create knowledge <id>`. Incomplete rather than flatly false, but reads as if Knowledge is agent-only.

   **Pattern**: findings 3–6 share one root cause — the 02-07 two-lanes reframe correctly rippled through `Two-Lanes.md`, `Modules-as-Tables.md`, `Daemon-API.md`, `The-World.md`, `Omnibar.md`, but never reached `Glossary.md`, `Module-Standard.md`, `Knowledge.md`, or `Workbench.md`. Fix as one sweep, not four isolated edits.

7. **`docs/learn/02-the-seed-in-one-file.md`** (worked example, ~line 48–58) — shows `policy: {"tier":"contained", …}` and states *"filesystem/network are enforced by the sandbox."* Per `docs/guide/Guardrails.md`'s own "Honest scope" section, the `contained`/sandboxed tier **was reserved, never wired, and was removed** — an `act` run is gated + allowlisted, never OS-sandboxed. A contributor-facing worked example teaching a mechanism that doesn't exist.

8. **`docs/learn/01-mental-model.md:32`** — *"Modules are **not** shaped by capability (there is no 'knowledge module' and 'actions module')"* — directly false against shipped reality (Knowledge/Memory/Actions/Instructions/Guardrails are exactly the standard kinds, per `MODEL.md`, `DESIGN.md`, `Module-Home.md`) **and** self-contradicted by `docs/learn/glossary.md:33` in the same book, which states the correct framing. `docs/learn/09-the-workbench.md` carries the same retired-UI problem as guide `Workbench.md` (finding #2). `docs/learn/README.md`'s own discipline — a lesson is marked ✅ only "when its build rung ships" — is now violated by 3 of its 9 ✅-marked lessons (01, 02, 09).

   **Positive control, for contrast**: `docs/guide/Tools.md` and `docs/guide/Secrets.md` — the two newest, most execution-substrate-adjacent pages — are the opposite of over-claiming. Verified line-for-line: `Tools.md`'s mcp-stub and agent-`needsHost` claims match `src/use/act.mjs:168-174` exactly; `Secrets.md`'s oidc-refuses-locally and fly-reads-env claims match `src/use/secrets.mjs:57-125` exactly. Whoever wrote these two pages set the bar the rest of the corpus should be brought up to.

### B. README staleness

`README.md`, full text: **zero** occurrences of "Tool," "Secret," "Trigger," "Workflow," or "durable" (grep-verified). The entire §I/§J execution substrate — which `CHANGELOG.md`'s `[2.0.0]` entry lists **first** under Added (the SECRETS-DECLARATION model, then `secret declare`, then the TOOL+TOOLKIT model) — never reaches the front door. README was revised for the 02-07 wave (two lanes, the World, modules-as-tables, the competitive frame vs. Notion/Airtable/Obsidian) but not touched again for the 03-07 wave that shipped in the same release. The "What you get" table and "Documentation" table don't name Tools/Secrets/Workflows even in passing. `docs/assets/world-vault.png` (the one screenshot the README's "map-first" pitch would benefit from) remains an honest, un-fabricated TODO.

### C. Coverage gaps

- `Daemon-API.md` is missing 4 shipped routes from its table (`GET /items`, `GET .../item/:id/history`, `GET .../generation/:from/diff/:to`, `POST`/`PATCH .../column[/:name]`) — verified present in `web/src/server/zuzuu-read.ts`/`zuzuu-write.ts`.
- `Guardrails.md` doesn't mention the run-safety-floor's fail-closed-for-unattended-agent-actor behavior (§I rung 3) — a safety-relevant change with no user-facing doc at all.
- `Roadmap.md`'s "Shipped" list is missing essentially everything that shipped after ~17-06-2026.
- `Decision-Log.md` has no entries for the five biggest 03-07-2026 decisions (tool-as-type/MCP-native, the secrets model, the durable runner, triggers, Flow).
- `docs/README.md`'s index table and wiki-source inventory omit `Tools.md`, `Secrets.md`, `Workflows.md`, `Omnibar.md`, `Observability.md` entirely.
- Two lab-notebook specs (`polish-showcase-experience.md`, `personal-app-roadmap.md`) are ~fully shipped with zero shipped/date annotation anywhere in either file.

### D. Consistency

- `MODEL.md` is fully current and internally consistent with `Tools.md`/`Secrets.md`/`Workflows.md` — the canonical registry can be trusted as ground truth for a rewrite.
- Terminology hygiene is otherwise good: "faculty"/"faculties" and the old project names (`motorsandsensors`/`mns`/`zuzuagents`) are cleanly quarantined to `DESIGN.md`/`LOG.md` (both self-disclaiming) plus one intentional disambiguation line in `MODEL.md:433` — zero leaks into `docs/guide/` or `README.md`.
- The two-lanes terminology drift (§2A #3–#6) is the corpus's main cross-doc inconsistency.
- `docs/learn/` self-contradicts internally (lesson 01 vs. its own glossary.md) — a book that disagrees with itself.

### E. Navigation + structure

- **`Secrets.md` is fully orphaned** — zero presence in `_Sidebar.md` or `Home.md` (confirmed by direct grep of both). It's 246 lines, one of 2.0.0's headline features, and completely unreachable by a reader clicking through the wiki. The only inbound links anywhere are two non-wiki-link references from `Tools.md`.
- `Home.md`'s curated "Pages" list is stale vs. `_Sidebar.md` — 8 pages (`Workflows`, `Tools`, `Flow-View`, `Omnibar`, `Observability`, `Daemon-API`, `Decision-Log`, `Inspiration-Log`) are sidebar-only, entirely absent from Home's own inventory.
- **Broken link**: `Glossary.md:10` — `[[Module Home|home]]` targets `home` (→ `Home.md`, the landing page) instead of `Module-Home.md` (the intended page about `zz init`). Every other multi-word wiki-link in the corpus correctly targets a full slug; this is the one exception.
- **Convention violations**: `Tools.md` (lines 60, 97, 102 ×2, 133) and `Workflows.md` (line 12) use relative markdown links (`](Secrets.md)`, `](Workflows.md)`, `](Two-Lanes.md)`) instead of the `[[wiki-link]]` convention `docs/guide/README.md` itself mandates ("relative links don't resolve on the rendered wiki"). Isolated to the two newest pages — the convention was forgotten under release pressure, not systematically ignored.
- `docs/learn/glossary.md` has 2 broken links (lines 7, 55) to `../../README.md#the-model` — that section moved to `docs/MODEL.md` on 02-07-2026 and the anchor was never updated.
- Root docs (`README.md`, `docs/README.md`, `MODEL.md`, `DESIGN.md`) have **zero** broken relative links — clean.
- `CHANGELOG.md`'s internal path references all resolve — clean.
- Lab-notebook vs. guide separation is otherwise clean: nothing in specs/audits/design-research/brainstorms/ideation/inspiration reads like a how-to for a shipped feature. The one violation runs the *other* direction — `docs/learn/` (nominally contributor-only) has drifted stale in ways that actively mislead about current architecture.
- `docs/plans/`'s gitignore claim in `docs/README.md` is verified accurate (`git check-ignore -v` confirms every file matches; not tracked).

### F. Redundancy / overlap

- `Module-Standard.md` and `Module-Home.md` overlap substantially — both explain "a module is generic, differs only by its manifest," both touch schema. Worth either merging or sharpening their split (concept/schema vs. init-scaffolding).
- `docs/learn/09-the-workbench.md` and `docs/guide/Workbench.md` carry the *identical* staleness bug (both describe the retired module-cards/IDE-shaped UI) — two independent copies of the same wrong information; fixing one without the other leaves a live contradiction.
- The two ~fully-shipped specs (`polish-showcase-experience.md`, `personal-app-roadmap.md`) now substantially duplicate content that also lives in `MODEL.md`/`CHANGELOG.md`/the guide pages — once retro-marked as implemented, they're candidates to trim into pointers rather than kept as ~1000-line standalone documents.

---

## 3. Recommended target structure for the user wiki

**The front door (`README.md`)** should lead with the full 2.0.0 shape, not just the 02-07 half of
it: envelope → note/module/project → **the two lanes** → **the World as one screen** (Table · Map ·
Flow, reached through Omnibar) → **tools/toolkit + secrets + triggers/workflows** as first-class
capabilities alongside modules-as-tables → host coverage → the safety model. The "What you get"
table needs a row for Tools/Secrets and a row for Workflows/Triggers/Flow; the competitive frame
stays. Point at `Recipe-Personal-Vault.md` explicitly as the flagship non-coding proof, not just
buried in the guide.

**`docs/guide/` (the wiki)**, re-grouped so `_Sidebar.md` and `Home.md`'s "Pages" list are generated
from *the same list* going forward (today they drift independently — that's how `Secrets.md` got
lost):

| Group | Pages |
|---|---|
| **Start here** | Getting-Started, Module-Standard (absorb or clearly re-scope vs. Module-Home) |
| **Your data** | Modules-as-Tables, Two-Lanes, Knowledge (rewritten), Guardrails (+ safety-floor note) |
| **Automation & execution** | Tools, Secrets *(add to nav — this is the fix that matters most here)*, Workflows |
| **The visual surface** | The-World, Flow-View, Omnibar, Observability, Workbench *(full rewrite)*, Daemon-API *(+ missing routes)* |
| **Hosts** | Claude-Code, Codex, Gemini-CLI, OpenCode, pi |
| **Recipes** | Recipe-Personal-Vault |
| **Reference** | Glossary (fixed), Troubleshooting, Roadmap (refreshed) |
| **Project** | Decision-Log (+ 03-07 entries), Inspiration-Log |

**`docs/learn/`** stays contributor-scoped but needs a stale-content pass (01, 02, 09, glossary
links) before its ✅ markers can be trusted again — consider resetting the marks to "needs
re-verification" until each is checked, rather than leaving them silently wrong.

**`docs/specs/`** — retro-annotate `polish-showcase-experience.md` and `personal-app-roadmap.md`
with per-section shipped/date markers (mirroring how `DESIGN.md`'s banner handles its own
staleness), or extract a one-paragraph "what shipped, and where it's documented now" summary at
the top of each and leave the body as historical rationale only.

**`docs/README.md`** — add the 5 missing pages to both the index table and the wiki-source
inventory; the "maintain it when you add one" rule is good, it just needs to actually run each
time a page lands.

---

## 4. Prioritized rewrite plan

1. **Fix the two-lanes over-claims** — `Workbench.md` (full rewrite: retire the module-cards/Home
   description, replace with the World/Omnibar single-screen account, correct the "reviewable
   proposal" line to describe the operator lane), `Glossary.md` (2 lines), `Module-Standard.md`
   (1 line), `Knowledge.md` (add the operator-lane row to its table). Highest impact — this is what
   users hit first when they open the workbench — lowest effort for 3 of the 4.
2. **Rewrite `README.md`** to surface Tools/Secrets/Triggers/Workflows/Flow. The single biggest
   front-door gap.
3. **Fix navigation** — add `Secrets.md` to `_Sidebar.md` and `Home.md`; sync `Home.md`'s Pages
   list to `_Sidebar.md`'s full set; fix `Glossary.md`'s `Module-Home` link; fix `Tools.md`'s and
   `Workflows.md`'s wiki-link convention violations. Mechanical, ~30 minutes, high signal-to-noise.
4. **Refresh `Roadmap.md`** — move everything CHANGELOG's `[2.0.0]` shipped into "Shipped," update
   "Next" to what's actually still open (real containment for `act`, cron/ingress/note-change
   auto-firing, the ACP agent-binding dispatch, cross-project secret sharing).
5. **Close the two flagged gaps**: add the missing routes to `Daemon-API.md`; add a run-safety-floor
   note to `Guardrails.md`.
6. **Add the five 03-07-2026 decisions to `Decision-Log.md`** (tool-as-type/MCP-native, the secrets
   model, the durable runner, triggers, Flow) — they're the release's biggest calls and currently
   undocumented as decisions.
7. **Retro-mark the two shipped specs** (`polish-showcase-experience.md`, `personal-app-roadmap.md`)
   as implemented, or trim to pointers.
8. **Fix `docs/learn/`'s three stale lessons** (01, 02, 09) and its glossary's broken links — lower
   urgency (contributor audience, not end-user) but actively misleading once someone reads it.
9. **Update `docs/README.md`'s IA table** to list Tools/Secrets/Workflows/Omnibar/Observability.
10. **Resolve the `Module-Standard.md`/`Module-Home.md` overlap** — merge or sharpen the split.
