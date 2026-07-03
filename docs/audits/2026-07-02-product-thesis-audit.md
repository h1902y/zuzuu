# Product audit — vision vs reality, the moat, coverage, distribution (02-07-2026)

> Provenance: full read of README (481 lines), DESIGN.md, all 6 specs, LOG tail + skim, design-research sample (incl. workbench/), package/publish state, and the 57-unit + 80-web test suites — against the founder thesis: **"notes are rows in a table which can be CRUDed to create a personal application… the complete experience as intuitive as conversing about the project, and your personal application keeps building itself."** Companion docs: the other three audits in this directory; roadmap in `docs/specs/2026-07-02-personal-app-roadmap.md`.

## 1. Vision vs reality: the thesis is ~70% latent-and-built; the 30% is a reframe

**What the docs say zuzuu is:** *"Your project directory becomes the coding agent's memory and toolkit… grown by a human-gated loop"* (README:5); *"an evolving Memory, body of Knowledge, set of Actions, and Guardrails — improved automatically from how you actually work"* (DESIGN:19); *"Coding is the first vertical, not the boundary: the same mechanism serves any folder-based knowledge work (an accountant's books, a CEO's briefings)"* (DESIGN:304).

**The thesis is already in the docs, shipped:**
- *"'A module is a TABLE, a note a ROW, the columns are the schema'"* (LOG:1117) — live at the write boundary.
- *"module = table · note = row · frontmatter key = typed column · relations: = foreign keys"* (design-research/workbench/06-crud-app-inspiration.md:8).
- The workbench experience spec literally titles it *"the Project as a CRUD-to-app"* (workbench/05-experience-spec.md:1).
- The conversational half = Plane 3 + the conversational-composer spec + the just-shipped ACP drive lane.

**The delta (the reframe, not new mechanism):**

| Thesis | Built reality | Tension |
|---|---|---|
| "CRUDed to create a personal application" | Workbench locked as *"a CRUD-admin over the Project-as-database… not an IDE"*; *"a view onto a Project, not the Project"* (README:440) | Admin-of-the-table ≠ app-out-of-the-table. The user's-own-domain app lives only in unbuilt W4 marketplace + W5 tasks module (DESIGN:315-316). |
| "keeps building itself" | observe→stage→review→evolve works but pays off after **≥2 sessions**; *"the loop dies after session one if the first run doesn't teach it"* (plans/2026-06-29-001:25) | Real but slow-to-first-value. |
| "instant CRUD" | *"THE INVERSION — a UI write is a proposal, not a mutation"* (LOG:1123) | **Sharpest strain** — even the human's own clicks are staged. |

## 2. What LOG.md says is next

- **2026-07-01 ACP drive lane** (PR #99, still DRAFT): deferred R7b — conversation-kit graduation, Turn/role grouping (user's own prompt doesn't render), real Markdown, inline `acpFailure` onboarding UI, per-host terminal toggle.
- **In-flight (branch `feat/what-needs-me-home`, uncommitted):** Overview reshaped around a composite needs-me signal (`pendingProposals + heldSessions`), dual-primary Review/Start, brain-integrity readout.
- **Shipped 06-28:** command-registry redesign (no OTLP; async evolution service design-only). **06-27:** session END holds for review (`zz session land`).
- **Abandoned/deferred:** OTLP vocabulary (deleted in v2), Cloudflare evolution service (design-only), LLM-judge rung (seam only), Memory episodic distiller (stub), auto-crystallization (cut — always human-gated).
- Roadmap "Next" (guide/Roadmap.md): per-host hook/gate parity (only Claude Code fully wired), real `act` sandbox, conversation mining, richer Gemini observe, cloud tier, pi harness.

## 3. The moat vs the personal-app thesis — the reconciliation already exists in doctrine

*"The human gate is the moat… the one defense"* (README:65); structural since the commit-consolidation: *"`commit` refuses `actor:'agent'` up front… the agent reaches the writer only through `review`"* (LOG:1115). **But the same entry carries the human side:** *"operator-initiated manifest writes… bypass `commit` deliberately, each being a gate-event itself"*, and `note set/append/rename/fold` are direct operator edits.

**The strain in one line: "a personal application with instant CRUD" collides with "every workbench write is a staged proposal."** The doctrine is agent-writes-gated / human-writes-direct; the workbench routes BOTH through proposals. Flipping the human lane is a deliberate product decision the roadmap must make explicitly — the CLI primitives for the direct lane already exist.

## 4. Competitive frame — absent as positioning

Notion ×146, Airtable ×24, Obsidian ×38 in the docs — **all as aesthetic targets or UX lineage, never as competitors**. Stated competition is agent-harness wrappers only (*"versus static wrappers… our modules graduate"*, DESIGN:21). A notes-as-rows-building-an-app product lands in the Notion/Airtable/Tana/Anytype arena; that frame is unwritten. The differentiators are real: **agent-grown + human-gated + git-native + local**.

## 5. Coverage map

**High confidence:** the write boundary/moat/loop (most-tested thing in the repo — correct prioritization), the command surface, the sessions engine, the registry, notes/index.

**Riskiest under-tested (priority order):**
1. **Host-adapter capture** (`src/hosts/`, 5 adapters, one 120-line test; real verification = non-CI playground) — the `observe` foundation is effectively unguarded in CI. Gemini flagged "thin" in README:86.
2. **ACP drive lane rendering** — now the Claude Code default; kit/Turn/Markdown deferred + live-verified only.
3. **`src/use/check.mjs`** — no dedicated test, newly load-bearing as the home's trust signal.
4. Daemon→client session-lifecycle signal (flagged fragile; onboarding depends on it).
5. Composer idle-gating (open heuristic problem). 6. Web .tsx rendering (live-verified, not test-guarded).

## 6. Distribution

- npm public with OIDC trusted publishing + provenance; version-bump auto-publish. Published **1.7.0**; branch is **1.8.0** (publish pending on merge).
- **Hygiene gap:** git tags stopped at `v0.2.0` while npm is at 1.7 — no tag/release trail, no CHANGELOG.
- README is a 36KB single front door carrying the full four-plane ontology — over-dense for a newcomer.
- Onboarding: `zz init` → first value is 6-7 steps and structurally ≥2 sessions. The conversational-onboarding plan + ACP default exist to fix exactly this.

## Five product-level roadmap moves

1. **Resolve instant-CRUD-vs-moat explicitly**: direct human-operator write lane in the workbench (over existing `note set/append/…` + new create/delete), distinct from the agent's gated lane. The one change that makes the thesis coherent with the moat.
2. **Ship app-out-of-the-table (W4/W5)**: one non-coding vertical proving "converse → app builds itself" — persona template + tasks/views. (The personal vault at ~/Documents/personal is this vertical, already live.)
3. **Fix time-to-first-value**: land conversational onboarding + ACP default (PR #99 + the 06-29 plan); design the "nothing recurred yet" first-run state.
4. **Write the competitive frame**: vs Notion/Airtable/Tana/Anytype — agent-grown, human-gated, git-native, local.
5. **Close distribution hygiene**: tags/releases/CHANGELOG; split README front door from the canonical model; host-adapter playground into CI (fixture-backed hermetic tier).
