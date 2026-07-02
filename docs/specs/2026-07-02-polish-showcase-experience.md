# Polish · Showcase · Experience — the three pre-merge activities (02-07-2026)

> Follow-on to `2026-07-02-personal-app-roadmap.md` (phases 0–5 built on
> `feat/personal-app-roadmap`). Before merge/publish, three activities land.
> Non-negotiables for all three: CLI suite (469) + web suite (594) stay green at
> every commit; zero-dep CLI stays zero-dep; the moat is untouchable.

## A — The cleanse (infra end to end)

Goal: the codebase reads like it was written once, by one person, on a good day.

- **src/ (CLI)**: `cli/commands.mjs` has grown past 1100 lines — split by plane
  (data/evolution/inspection/steer/host) into `cli/verbs/*.mjs` composed by the
  table, keeping the one-table invariant (the router/help/catalog/gate all read
  ONE array). Hunt duplicate helpers (arg parsing, list/str coercions appear ×3),
  fold them into `cli/args.mjs`. Every module keeps/gains its what/why/how header.
- **serve/api.mjs**: the façade is the de-facto public API — group + document its
  surface as such (read · gate · operator lane · refactors · generations).
- **web/**: sweep for the same (the fork noted `zuzuu-read.ts` route bodies repeat
  the CLI-first/peek-fallback shape ×5 — extract the pattern). Check client/world
  integrates with ds tokens fully.
- **Dead weight**: the deprecated key-first module aliases, unused exports,
  `web-app/dist` staleness story, stray TODO-shaped comments.
- Method: refactor in SMALL commits, suite after each; behavior-neutral (no verb
  renames — the vault + daemon depend on the surface).

## B — Docs & wiki (the showcase)

Goal: a stranger lands on the repo and *gets it* in 90 seconds; a user finds any
answer in two clicks.

- **README rewrite**: a short front door — the one-liner, the loop diagram, a
  20-line quickstart (init → converse → review → your app grew), one screenshot
  of the World with ghost nodes, the competitive frame, links out. The four-plane
  canonical model MOVES to `docs/MODEL.md` (kept verbatim — it's good, just not
  the front door).
- **docs/ restructure**: `docs/README.md` as the wiki index — Getting started ·
  The model · The moat (why human-gated) · Modules-as-tables (schema, computed
  columns, views, import/export) · The operator lane vs the agent lane · The
  World (map UX) · The daemon & API · Recipes (the personal-vault vertical as the
  worked example) · CHANGELOG. Each page ≤200 lines, task-oriented.
- **The showcase asset**: capture the World rendering the real vault (screenshot;
  GIF if cheap) into docs/assets/; the vault story ("277 notes, 5 modules, built
  by conversation") as the flagship recipe.
- LOG.md and specs/ stay as-is (the lab notebook is part of the charm) but get
  one index paragraph in docs/README.md.

## C — The experience (map-first workbench)

Goal: **the map is the primary VIEW of the Project** (fidelity note: the
workbench stays "a view onto a Project, not the Project" — MODEL.md:353; and
the World is not DESIGN §8's agent-org canvas, which remains unbuilt). The
workbench opens INTO the World; tables/records/review/sessions become surfaces
you reach THROUGH the map. HARD CONSTRAINTS from the decision record: the raw
terminal stays reachable as a tab (composer spec: never hide y/n prompts); the
omnibar `/` conversation routes to the REAL interactive host (interactive-first
pillar); brain push stays local-only.

- **Map-first shell**: the World is the default stage on open (steady state;
  onboarding keeps the checklist). The nav tree demotes to a switcher; selection
  flows FROM the map (click module chip → module context, click node → record,
  click ghost → review).
- **The zoom ladder finishes**: k≥3 mini-cards on nodes (port cards.js L2), a
  focused node's record opens as the wing (already wired) — the missing rung is
  the in-map card so reading never leaves the map.
- **The omnibar completes** (galaxy parity in the workbench): one input — plain
  = fuzzy find + fly-to; `>` = commands (fit, module, review); `/` = the
  CONVERSATION, routed to the ACP lane, with [[addr]] mentions glowing nodes and
  staged proposals appearing as ghosts in real time (the brain push already
  exists). The palette (cmdk) absorbs this rather than a second input.
- **Review-in-place polish**: approving a ghost animates it solidifying (the
  moat made visceral). Reject dissolves.
- **Migration, not big-bang**: Overview/Grid/Record/sessions all stay reachable;
  the map becomes the hub they hang off. When parity feels right, the startpage
  galaxy retires (its new-tab page can point at the daemon URL).

## Sequencing

A and B run in parallel (disjoint trees: src+web vs docs). C follows A (clean
substrate first), led by design; its mechanical ports reuse `client/world`.
Merge/publish decision comes after all three — user's call.

## D — Single-screen consolidation (user-directed, 02-07-2026 evening)

The Overview page and the setup page are DEPRECATED as screens. There is ONE
screen — the World — and everything else is a toggle, overlay, wing, or dialog:

- **Needs-me HUD**: the Overview's composite signal (pendingProposals +
  heldSessions — the "what needs me" home model survives, relocated) becomes a
  persistent pill on the map; clicking it opens the Review overlay (R).
  Project-health/integrity ride the same HUD, quietly.
- **Setup/onboarding**: the checklist becomes a dialog sequence over the dimmed
  World (an empty project = an empty world + the first-rung dialog). Every
  recorded consent gate survives — relocated, never removed.
- **Everything table**: the T toggle (one space, two projections).
- **Inspectors**: note/module attribute wings slide over the map (§ inspector).
- **Sessions/terminal**: a dock toggle/overlay — the raw terminal stays FULLY
  functional (hard constraint: never hide a y/n prompt).
- **Settings**: a quiet affordance at the RIGHT of the bottom footer (the
  Ribbon) opening the settings dialog — always reachable, never disturbing the
  canvas. **The nav tree is removed** — the palette (⌘K), the map itself, the
  HUD, and the footer are the navigation.
- Deep links keep working (URL → open the right overlay over the map).

Sequencing: toggle (in flight) → unified Everything view → inspector wings →
single-screen consolidation (this). Each verified live before the next.

## E — The omnibar endgame (user-directed): one input, view-only canvas

The final consolidation after §D: **the omnibar (⌘K spotlight) is THE
interaction surface; the canvas becomes a view-only browser.** Pointing at the
World browses (pan · zoom · hover · select-to-inspect); every ACTION goes
through the one input:

- **Verb grammar** (structured suggestions, never free-text-only): `new note in
  <module> …field=value` (operator lane, instant) · `edit <addr> field value` ·
  `delete <addr>` · `approve/reject <proposal>` (the gate, keyboard-first) ·
  `new module <name> …columns` · `import <module> <csv>` · `view <name>` (saved
  views) · `table/map` · `fit/fly <addr>` · `sessions` (terminal dock) ·
  `settings` · `/ <conversation>` (the ACP lane).
- Selection context feeds the omnibar: with a node selected, its verbs
  autocomplete first (edit · relate · delete · discuss).
- The moat is grammar-visible: agent-lane verbs read as proposals, operator
  verbs as instant — the two lanes distinguishable IN the suggestion rows.
- Consent/review semantics unchanged; the raw terminal stays one command away
  and fully functional.
- Mouse affordances degrade gracefully to the same commands (a button = a
  canned omnibar invocation) — the omnibar is the API, the UI is sugar over it.

Full sequence: toggle → unified Everything → inspector wings → single-screen
(§D) → omnibar endgame (§E). The workbench converges on the galaxy's original
grammar: one canvas, one input, everything else ephemeral.

### §E.1 — The omnibar is a component system (user-directed refinement)

No left sidebar at all. The omnibar is not just an input — it is a spotlight
SHELL with four composable surfaces (Raycast-grammar, push/pop navigation):

1. **Input line** — the mode grammar (§E): plain find · `>` verbs · `/` chat.
2. **List view** — every result set is a list source behind the one input:
   notes · modules · saved views · pending proposals · **session history**
   (sessions stop being a nav concern; `sessions` or plain-typing a session
   label lists them, Enter resumes/opens the dock) · commands. Sources are
   pluggable rows with consistent affordances (icon · title · meta · actions).
3. **Detail view** — focusing a list item pushes its detail INSIDE the omnibar
   panel: a note's rendered preview, a proposal's diff (approve/reject inline),
   a session's summary + resume, a module's schema card. Esc pops back to the
   list; the map flies/glows behind as context follows focus.
4. **Chat view** — `/` renders the conversation IN the omnibar panel (the ACP
   lane), map glowing mentions behind it; staged proposals appear as ghosts
   live. Chat is a peer surface of list/detail, not a separate stage.

The wings/dialogs of §D progressively fold into omnibar detail views where they
fit; heavyweight surfaces (the Everything table, the terminal dock) stay
toggles. Build order within §E: component shell (input+list+detail) → sources
(notes/modules/commands/sessions/proposals) → chat surface → sidebar removal.

### §E.2 — Omnibar shell: the reference-experience brainstorm (design decisions)

What each reference contributes, distilled to decisions:

- **Raycast (the structural template)** — the deepest insight: *the input finds
  NOUNS; a focused noun reveals its VERBS* (their ⌘K action panel). Decision:
  plain typing lists nouns (notes · modules · sessions · proposals · views);
  Tab (or ⌘K) on a focused row opens its action panel (edit · relate · delete ·
  discuss · approve…). `>` remains the verbs-first entry for globals. Also
  adopted: push/pop view stack with the breadcrumb living in the input
  placeholder; forms as pushed views (see below); frecency ranking.
- **Linear ⌘K** — context seeds the palette: the current selection's verbs rank
  first. Decision: map selection (node/island/ghost) = omnibar context, always.
- **Alfred** — staged argument prompts. Decision: verb arguments complete in
  STAGES (`new note` → pick module → schema-aware form), with inline
  `field=value` tokens as the fast path for those who type ahead. Both, not either.
- **telescope.nvim / Raycast detail** — preview is not a separate step.
  Decision: LIST + DETAIL live side-by-side in the panel for rich nouns (note
  preview, proposal diff, session summary); the map glows/flies behind as
  focus moves. Esc pops, never closes-by-surprise.
- **VS Code quick-input** — prefix modes we already mirror (` ` find · `>`
  verbs · `/` chat); multi-step quick-input chains for schema-aware creation.
- **Superhuman** — the palette TEACHES its shortcuts (a quiet hint column);
  every action has equal keyboard cost. Decision: hint column from day one.
- **Warp/Cursor** — chat shares the shell, streams inline, and its answers can
  carry ACTION ROWS. Decision: agent replies render approve/reject rows inline
  when proposals ride the answer (the gate inside the chat surface).
- **Spotlight** — the discipline of instant top-hit + zero chrome; nothing else.

zuzuu-specific decisions no reference has:
1. **Two-lane row grammar**: instant (operator) verbs vs proposal (agent-lane)
   verbs are visually distinct IN the rows — the moat readable at the input.
2. **Schema-aware forms for free**: the pushed create/edit form renders from
   the module manifest (labels · selects · defaults · computed shown read-only)
   — the §inspector concept folds in here rather than living as separate wings.
3. **The omnibar is the API**: every button anywhere is a canned invocation;
   sources/verbs are a registry, so automations later script the same surface.
4. **Ranking**: exact-substring > prefix > fuzzy (already fixed in the palette),
   then frecency per source; content nouns outrank chrome verbs on plain queries.

Component architecture: keep cmdk as the base; add (a) a view-stack controller
(push/pop, breadcrumb, per-view state), (b) a noun-source registry
(id · icon · search(q) · detail(item) · actions(item)), (c) a verb registry
keyed by noun type + globals, (d) the chat surface as a pushed view over the
ACP lane. The §D HUD/footer invoke the same registries.

### §E.3 — The adapter command: intent routing over the closed registry

On top of the commands sits ONE adapter — input in, the RIGHT command resolved,
then executed through that command's own lane. The registry (the catalog +
omnibar verb registry) is the closed target space: the adapter routes, it never
invents. Three resolution tiers, cheapest first:

1. **Exact/grammar** — the input parses as a known verb or noun (today's path).
2. **Deterministic fuzz** — synonyms + arg extraction against the registry
   ("add a lead acme to crm" → `note create crm acme` via source/verb aliases +
   schema-aware slot filling). Instant, offline, no model.
3. **LLM resolve (ambiguity only)** — the ACP lane gets the input + the
   registry's typed specs and returns `{commandId, params}` — function-calling
   against the catalog, nothing else callable.

Non-negotiables:
- **The adapter has NO authority of its own.** It emits a canned invocation;
  the resolved command's lane applies untouched — operator verbs run instantly,
  agent-lane paths stay proposals. A router, never a second write path.
- **Resolution is always SHOWN before it runs**: the resolved invocation
  renders as the top suggestion row ("→ note create crm acme · instant"), Enter
  confirms. Natural language never executes invisibly.
- Tier 3 resolution failures degrade to tier-1 suggestions, never to "AI did
  something".
- The same adapter serves the CLI later (`zz do "<intent>"`) — one resolver,
  two surfaces, same registry.

### §E.4 — The omnibar as the assist: the greeting is the session start

With the adapter (§E.3) the omnibar stops being a tool and becomes THE ASSIST.
Its ZERO-STATE (workbench open / first ⌘K of the day) is a greeting, not an
empty input — composed entirely from existing READ surfaces (zz start · digest ·
the needs-me composite · session history), never an auto-fired agent:

- **The brief**: one calm block — what changed since you left (generations,
  landed rows), what needs you (N proposals · held sessions), where you were
  (last session's label + open thread).
- **Suggested rows**: ranked, actionable — "Review 3 proposals" · "Resume
  <session>" · "Continue: <yesterday's thread>" · "Start a session" — each a
  canned invocation over the registry (§E.2's omnibar-is-the-API).
- **Then the input**: type anything — noun, verb, or plain intent (the adapter
  routes it); `/` talks. The greeting collapses the moment you type.
- Time-aware tone (morning vs evening), never chatty, never blocking: Esc
  drops you on the World instantly; the greeting is a row list, not a modal
  ceremony.
- Fidelity: composes the recorded steer-plane surfaces (start/wrap/digest);
  interactive-first holds — the assist reads and suggests, the human initiates.

This is the product's front door made literal: the vault's /hi pattern,
graduated into the workbench.

## F — The global page: a special Project page (user-directed)

The launcher retires as a distinct surface. GLOBAL is the same page grammar as
a project — the World + omnibar — where the NODES ARE PROJECTS: each an island
dot carrying counts, health, needs-me; select → project detail (the inspector
grammar); Enter → dive into that project's World (the same page, one level
down). The omnibar's sources at global scope are projects, recent sessions
across projects, and global commands; the greeting (§E.4) rolls up "what needs
me" ACROSS projects.

Fidelity pin: cross-project stays a ROLL-UP + registry read (the recorded tier
doctrine — never one merged master Project); global is a view that aggregates,
each project's gate/generations stay its own.

## G — Settings & observability: teach the substrate (user-directed)

The product has done a poor job educating about its own machinery — log.jsonl
(per-module provenance), generations (the git-native lineage), module.md (the
table's contract). These become graceful, discoverable surfaces:

- **A note's history** in its detail view: its mutation-log entries (who/when/
  which proposal/session — actor · source · op) rendered as a quiet timeline;
  "born here" links to the staging session/proposal.
- **A module's lineage**: the generation strip (mint points, labels, rollback
  affordance) + "what changed" per generation (gen diff), IN the module detail.
- **The contract, visible**: module.md rendered as the schema card (columns ·
  types · defaults · computed) with a "this is a plain file — open it" link;
  the envelope's tolerance explained where custom keys appear.
- **Settings** (footer-right dialog, §D): host wiring, guardrails state, daemon
  info — plus an "under the hood" section that names the files (log.jsonl ·
  .generations/ · module.md · project.md) and links each to its guide page.
- Observability creed: every magic moment (a ghost, a generation, a spotlight)
  should be one click from the PLAIN FILE that explains it.

Sequence after the omnibar stack (§E): global page (§F) → settings +
observability (§G).

## H — The zuzuu-native table (user question: on what basis are columns/filters?)

Today's basis: the ENVELOPE FLOOR (title·module·type·status from the index core)
+ module/type facets. Correct but lazy — it ignores the three doctrines that
make zuzuu's tables special. The native design:

1. **Identity is the id.** The primary cell is the note's id (kebab slug),
   title as secondary text when present — NEVER a blank first column. Addr is
   the key; the id is the name (journal dates, activity slugs prove it).
2. **"A module is a TABLE" means faceting INTO a module changes the columns.**
   With one module facet active, the table becomes THAT module's table: its
   declared schema columns appear (with `label`s, `select` badges with options,
   `date`/`number` right-aligned, `computed` columns shown derived — end_date).
   Unfaceted Everything shows the floor + the smart commons (created_at/age ·
   tags · hasBody dot — "body is opinion" made visible · degree).
3. **One query grammar everywhere.** The filter input accepts the CLI's own
   `--where` grammar (`tier>=2`, `start_date<=2026-07-02`, `k!=v`) alongside
   free text (FTS) — the table is a projection of `zz module items`, so its
   filter language IS the CLI's. A grammar chip renders each parsed clause.
4. **Facets mirror query v2**: module · type · status (lifecycle badges:
   seed/active/archived/deprecated) · tags; SAVED VIEWS render as first-class
   chips (run = apply lens — same chips the map spotlight names).
5. **Group-by as a native gesture** (query v2 aggregate): group rows by any
   column with counts in headers ("by status: active 6 · deferred 2").
6. **The graph in the table**: a degree column (backlinks count, click → the
   map flies there); relations as chips in the row detail.
7. **Provenance visible** (§G kinship): an actor glyph per row (human · agent ·
   migration — from the mutation log) — the moat readable in the table too.
8. Age as quiet recency text (the map encodes it as rings; the table as text).

Principle: the table exposes the SAME power the CLI has — nothing more,
nothing less — and every column earns its place from the schema or the
envelope, never from a hardcoded floor.
