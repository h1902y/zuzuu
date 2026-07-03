# The personal-application roadmap — one brain, one daemon, one map (02-07-2026)

> Synthesis of the four 02-07 audits (`docs/audits/2026-07-02-{backend,frontend-merge,integration-seams,product-thesis}-audit.md`), written the day the thesis got its first proof: a root-mode personal vault (277 notes, 5 modules) driven entirely by conversation, rendered by a second frontend (the startpage galaxy). Read the audits for evidence; this doc is the decisions and the sequence.

## The thesis, and what the audits agreed on

**"A module is a TABLE, a note a ROW"** is already shipped doctrine (LOG:1117). The founder's extension — *notes CRUDed into a personal application that keeps building itself as you converse* — is ~70% latent in the built system. Four findings converged from independent directions:

1. **The moat is agent-shaped, and that's correct — but the workbench over-applies it to humans.** Doctrine says agent-writes-gated / operator-writes-direct (LOG:1115); the workbench's DataProvider inversion stages even the human's own clicks. The CLI lacks `note create`/`delete` entirely, so the first production vault ships a `logMutation` import recipe as a workaround. **Decision: two write lanes, explicitly.** Agent lane: stage → review (unchanged, airtight, `agentInvokable` gate). Operator lane: direct CRUD verbs through the same `commit()` door — validated, minted, logged, instant.
2. **There must be exactly one local API, and it already exists: the workbench daemon.** Today: daemon shells the argv catalog (safe, slow, 22/47 verbs lack JSON); the galaxy's bridge imports `src/notes/index.mjs` internals (fast, unversioned, origin-only security). Both audits + the integration seams landed on the same fix: the daemon becomes the sole surface; the bridge retires.
3. **The galaxy is the face; the workbench is the body.** The workbench's map is a stub; the galaxy is the living-world UX the thesis describes — but read-only, review-blind, vault-hardcoded. Merge direction (b)→(c): port the galaxy into `client/world/`, replace `ModuleGraph.tsx`.
4. **"Keeps building itself" requires push + query power the engine doesn't have.** No reactivity primitive anywhere; EAV filters are equality-only ("active today" can't run in SQL); per-open corpusSig stat-walks tax every poll.

**North star loop (the product in one sentence):** you converse in the omnibar → the agent stages rows/schema through its gated channel → ghost nodes with halos appear in your world in real time → you approve in place → the node solidifies — your app just grew.

---

## Phase 0 — Correctness & hygiene (days)

Small, high-trust, mostly from the backend audit's bug list:

- **Fix cross-module bare-id relation resolution** (`index.mjs:111`) via a global id→addr map at build time — backlinks silently rot today; load-bearing for every graph claim. Add the regression test.
- Fix `module overview` M-opens (`commands.mjs:263` → `moduleCounts`), CLI `--limit 0` coercion (`commands.mjs:210`), schema-aware `note set` coercion (`edit.mjs:17`), double corpusSig on rebuild.
- **Atomic `writeText`** (temp+rename, `metal/fs.mjs:19`) + advisory lock around commit/index-rebuild — three processes share one vault now.
- **`--json` on all read verbs** (22/47 currently `json: false`) — the machine surface becomes uniform.
- **Cross-module query**: `zz query <text>` / `--all` (the primitive already supports empty module).
- Distribution: publish 1.8.0, restore git tags + GitHub releases, start CHANGELOG.

## Phase 1 — The operator lane (week 1)

- **`zz note create <m> <id> [--field k=v…]`, `zz note delete`, `zz note upsert`, `--batch`** — operator-only (`agentInvokable: false`), still through `commit()`: validated, minted, provenance-logged, instant. Kills the vault's logMutation recipe; form-submit becomes one call.
- **Schema v1.5: `default` + `label`/`description` per field** — enough for real forms; backfill-on-alter semantics documented.
- Workbench: route human CRUD through the operator lane (Grid/Form get an instant path); agent writes stay proposals. The moat becomes *visible as a distinction* rather than uniform friction.

## Phase 2 — One daemon (weeks 1–2)

- **`zz graph --json`** (nodes/links/degree/age from the index — the bridge's `/graph` builder moves behind the catalog).
- Daemon routes: `/api/zuzuu/graph`, `/api/zuzuu/positions`; fold the conversation stream toward the ACP lane.
- **SSE/WS brain-state channel**: `{module, generation, stagedChange}` pushed on every commit/stage (pattern exists at `/ws/fs`). TanStack flips to invalidate-on-push. This is what makes "watch it build" real.
- **Resident index handle** in the daemon (memoized `{sig, handle}`) — the per-call stat-walk tax dies for UI reads.
- **Retire the startpage bridge**; the galaxy new-tab page becomes a thin client of the daemon (inherits token/cookie/Host/Origin auth). The two-backends problem ends.

## Phase 3 — The map becomes the face (weeks 2–4)

- Port `graph.js`/`cards.js`/`omnibar.js` as a framework-agnostic **`client/world/`** lib (d3 owns the DOM in a container ref; React owns the shell); replace the `ModuleGraph.tsx` stub. Generalize away the hardcoded 5-module list (feed from `/overview`).
- **The moat in the map**: staged proposals render as ghost/pending nodes with halos; in-map review overlay reuses `ReviewQueue`/`ProposalCard` (keyboard triage survives); approve → the node solidifies. Reject → it dissolves.
- **One conversation**: the omnibar's `/` mode drives the **ACP lane** (already guardrail-gated); `[[wikilink]]` mentions glow nodes; the other two conversation surfaces (bridge claude -p, Composer-as-primary) demote to fallbacks.
- Unify design tokens (galaxy glassmorphism expressed in the Tailwind token system).

## Phase 4 — App-grade tables (month 2)

- **Query v2**: range predicates (`--where k>=v`, `IN`), group-by + aggregations (count/sum/avg/min/max), typed date/number index columns so "activities whose window covers today" runs in SQL.
- **Schema v2**: `unique`, `order`, option metadata, `computed` (read-time expressions) — the substrate for rollups.
- **Saved views as notes** (`type: view` carrying query params — zuzuu-native, gate-governed, renderable by Grid and World alike).
- **Import/export**: CSV/JSON → batch-staged rows; module-as-table export.
- Coverage debt (from the product audit): host-adapter playground → fixture-backed CI tier; dedicated `check.mjs` tests (it's the home's trust signal now); ACP render tests.

## Phase 5 — The product (month 2+)

- **Vertical proof**: the personal vault IS the first non-coding vertical — package what it proved (root-mode + /hi-style conversational driving + the galaxy) as the demo and the persona template (W4/W5 runway: tasks/views module, template marketplace).
- **Time-to-first-value**: land PR #99 (ACP default) + conversational onboarding; design the "nothing recurred yet" first-run state.
- **Competitive frame**: write the missing positioning — vs Notion/Airtable/Tana/Anytype: *agent-grown, human-gated, git-native, local-first*.
- **Attachments story** (the one hard ceiling both the vault and any real personal app hit): a blob dir + frontmatter reference convention, indexed presence-only.
- **Automations**: time-based (`zz cron` over action notes) and data-reactive (on-commit triggers staging follow-up proposals) — the "keeps building itself" loop closing without the human in every hop, but always landing through the gate.

## Sequencing rationale

Phase 0/1 are pure-backend and unblock the vault today. Phase 2 is the keystone — every later phase assumes one daemon + push. Phase 3 is the visible product moment (the demo that sells the thesis). Phase 4 makes modules feel like an app's tables rather than a notes index. Phase 5 is when zuzuu stops being "the coding agent's memory" and becomes "the way you build the app of your life by talking about it."

## Non-goals (explicit)

- No weakening of the agent gate — every agent write stays a proposal forever.
- No second API surface — the daemon is it; direct `src/` imports by frontends are terminated, not blessed.
- No cloud dependency for any of the above — the whole loop stays local + git-native.
