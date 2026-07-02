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

### §H.1 — The item detail view: a beautiful READ, edits only via omnibar

The note detail (record/omnibar detail/wing) is a VIEW-ONLY document — no
inline edit affordances anywhere (the §E doctrine: the canvas browses, the
omnibar acts):

- **Frontmatter, read gracefully**: schema-aware attribute rows (label · typed
  rendering — dates as text, selects as badges, numbers aligned, links/relations
  as chips that FLY THE MAP), tags as chips, provenance + actor as the "born
  here" line, custom keys under a quiet "also carries" (OKF tolerance visible),
  computed columns shown with their formula.
- **Body as GitHub-flavored markdown**: tables · fenced code with highlighting ·
  task lists · blockquotes/callouts, rendered with the existing safe renderer
  approach (no raw HTML injection). Empty body renders as the honest signal it
  is ("no take yet"), never invented placeholder prose.
- **Every edit is an omnibar invocation**: the detail's only affordances are
  canned invocations — an "Act ⌘K" hint, and per-attribute quiet targets that
  PRE-FILL the omnibar with the right verb ("set priority …" → staged or
  instant per the actor's lane). Delete/rename/relate likewise. The detail
  never mutates; the omnibar always does — one write door in the UI, matching
  the one write door in the engine.

### §H.2 — Heterogeneous rows: uniform floor + elastic attribute chips

Named columns only work when rows share a schema. The rule, by homogeneity:

- **Everything (heterogeneous)**: a UNIFORM fixed grid of floor columns
  (id-first identity · module dot · type · status) — widths stable, scanning
  calm — plus ONE elastic trailing **Attributes** cell: each row's remaining
  frontmatter as `key: value` chips (2-3 visible, then `+N`), so no attribute
  is unreachable and no row is wider than another. A chip is CLICKABLE: it
  pre-fills the filter with that clause (`platform=x`) — attributes surface
  AND become the query grammar (§H.3 loop closed).
- **Single-module facet (homogeneous)**: the schema's declared columns become
  REAL uniform columns (the module IS a table — types give width hints: date/
  number narrow-fixed, select badge-width, text flex); undeclared extras still
  ride the trailing chips cell.
- **Row expansion**: Enter/click expands the row INLINE into the §H.1 detail
  read (frontmatter rows + GFM body) — the third zoom rung of the table, so
  surveying → inspecting never changes surface. Edits, as always, only via
  the omnibar's pre-filled invocations.

### §H.3 — Tabular operations: the full set (design discussion, 02-07 late)

**1 · Filtering — one grammar, three entry points.** The filter input parses:
free text → FTS clause; `key<op>value` → where clause; `#tag` → tag clause;
special predicates → `is:orphan` (no links) · `has:body`/`no:body` ·
`is:invalid` (floor/schema violations — the compliance lens) · `actor:agent|
human` (provenance) · **`linked:<addr>`** (rows whose relations point at a note
— the graph-aware filter no other table product has; backlinks as a WHERE).
Every active clause renders as a dismissible chip. Facet rows (module · type ·
status · tags) are just SUGGESTED clauses — clicking a facet = typing its
clause. Attribute chips on rows (§H.2) are the third entry. All AND-composed,
all server-side.

**2 · Sorting.** Column-header click cycles asc/desc (core columns SQL-native;
module-scoped EAV columns via the existing post-hydration path; stable addr
tiebreak always). Single sort + tiebreak, no multi-sort (YAGNI).

**3 · Group-by + aggregates (query v2 surfaced).** Group by any column →
collapsible sections; headers carry counts and, when a numeric column is
grouped-over, the aggregate ("active 6 · Σ duration_days 156"). One group-by
at a time; powered by the existing aggregate() — no new engine.

**4 · Selection + bulk ops — selection is context, the omnibar is the verb.**
Multi-select rows (click-drag / x key) → the omnibar's context becomes "N rows":
verbs = set <field> across selection · retype · delete · relate all to <addr> ·
export selection. Bulk lands as ONE batch through commit (one generation,
all-or-nothing); the agent-lane twin ("ask the agent to …") stages proposals.
No bulk action ever lives as table chrome — omnibar only (§E doctrine).

**5 · Column operations.** Show/hide/reorder as VIEW state (not global);
column-header menu = canned omnibar invocations (sort · group by this ·
filter by this · hide). In single-module scope, "add column" = the guided
schema dialog (module add-column, operator-gated as today).

**6 · Views close the loop.** Any filter+sort+group+column state → "Save as
view" (a type:view note — gated, versioned, shareable); views render as chips
and omnibar nouns; ONE view drives BOTH projections (table state ⟷ map
spotlight). Export honors the current view (filtered CSV/JSON — the --where
flags already ride module export's query).

**7 · Cells stay read-only** (§H.1): click → pre-filled omnibar `set` verb;
row expansion → inline detail. Pagination stays server-side.

### §H.4 — Airtable grid language, studied (Mobbin) → adopt/reject

From the reference screens (mobbin.com/screens/… 0a97a6ad, ccf261ba, f7af9d5b,
a626dea7, 8c95c04c, 9b2045e0, 3eb862e7, 03aa705b):

ADOPT (translated to ds tokens, dark):
1. **Field-type icons in column headers** — every header carries its type glyph
   (text · select · date · number · link · bool · ƒ computed) + a per-column
   caret menu. We HAVE the types; show them.
2. **Column-header menu** = sort asc/desc · filter by this field · group by
   this field · hide — each a canned omnibar invocation (§H.3.5 confirmed by
   Airtable's own menu).
3. **Anchored builder panels, not dialogs**: Filter ("Where [field] [op]
   [value] · + add condition"), Group ("pick a field"), Sort — small panels
   under the toolbar buttons that COMPOSE the same clause grammar; the chips
   row stays the visible state (builders write chips; typists type them).
4. **Select values as colored pills** — options get stable hues (hash), status
   lifecycle gets fixed semantic hues; module keeps its island dot.
5. **Frozen identity column** + row-number rail (hover → select checkbox);
   crisp separators, tight ~32px rows, generous column width defaults.
6. **Footer aggregates**: record count always; per-numeric-column Σ/avg when
   grouped or selected ("Sum 830" under a number column — query v2 serves it).
7. **Hidden-fields pill** in the toolbar ("N hidden") — column state visible.
8. **Color-by** (row left-edge strip by a select field) — cheap, high-signal.

REJECT (doctrine):
- Inline cell editing (cells read-only; click → pre-filled omnibar verb).
- The left views rail (single-screen: views are toolbar chips + omnibar nouns).
- Manual row reorder (+drag), inline + add-row grid cell — 'new row' is a
  toolbar affordance invoking the omnibar create form.
- Multiple view TYPES (calendar/kanban/gantt) — our second projection is the
  MAP; other projections are future, not this pass.

Toolbar final shape: [n hidden] [Filter] [Group] [Sort] [Color] · clause chips
below · count+aggregates footer. The builders and the grammar are ONE state.

### §H.5 — The field-config panel (Airtable's edit-field, made zuzuu)

Column header → "Edit column" opens an ANCHORED panel (never a modal), mapping
FieldDef one-to-one:
- **label** (display name) + name (the frontmatter key, immutable once created
  — rename is a refactor, offered separately) · **type picker** (the 8 types +
  ƒ computed with formula input — dateAdd today, more builtins later)
- **type-specific options**: select/multi → an options editor with stable-hue
  pill previews; date → display-format note (STORAGE IS ALWAYS ISO — the
  format only affects rendering; say so in the panel, it teaches the envelope);
  number alignment; link → target module hint
- **required** toggle (with the honest consequence note: existing rows missing
  it become invalid until backfilled — offer "backfill now" riding zz module
  backfill semantics)
- **default**: static value; DATE columns additionally offer "current date" —
  a `default: now` SENTINEL resolved at create time (small CLI extension to
  the fill in writeNote/withDefaults; `now` stays symbolic in module.md)
- **description** (new tolerated FieldDef key; shows as header tooltip + in
  the schema card)
- **Save** = a canned omnibar invocation of module add-column/alter-column
  (operator-gated as today) with the zuzuu consequence line Airtable can't
  print: "saves as generation N+1 — rollback-able". Cancel discards.
Footer aggregates confirmed by the reference (Sum under Duration) — §H.4.6.
CLI prerequisite (small, separate from the grid build): `default: now`
sentinel + `description` passthrough on add/alter-column.

### §H.6 — The note document: ONE detail rendering, every container (Notion grammar)

The detail view is ONE component — `NoteDocument` — rendered identically in all
its containers (omnibar detail pane · wing/sidebar · inline row expansion),
width-adaptive, never re-implemented per surface. Its grammar, from the Notion
reference:

- **Header**: type glyph + the TITLE large; the id beneath as quiet mono
  (`knowledge:brahman`); status pill beside. (Module identity = the island dot.)
- **The lead**: a bold summary line when the note has one (`definition` field,
  else the body's first paragraph) — the "Summary:" treatment; absent = absent.
- **Grouped attribute cards** (Notion's rounded row-groups): CORE (created ·
  tags) · SCHEMA FIELDS (label + typed value rows, select pills, ƒ formulas
  shown) · RELATIONS (each edge an icon+label tappable row — tap flies the map;
  edge notes/cites render as quiet sub-text) · "ALSO CARRIES" (the OKF extras).
- **Body**: GFM below the attribute groups, document-width.
- **Footer meta, quiet** (Notion's "Updated 3 days ago" texture): born here
  (provenance/source link) · actor glyph · generation N · updated relative-time.
- **No inline actions** (doctrine): one "Act ⌘K" hint line; every affordance a
  pre-filled omnibar invocation.
Same component, three widths: panel (~420) · wing (~360) · row-expansion (full
row width, groups collapse to two columns).

## I — Zus that run: the self-correcting DAG (envisioned + grounded, 03-07-2026)

**The thesis extension**: a process IS a note — so processes inherit everything:
queryable rows, graph nodes, GENERATIONS (versioned workflows, rollback-able),
provenance, and gate-governed evolution. No workflow engine has this: workflows
that improve through an evidence-gated proposal loop.

**Grounded audit (code-verified, file:line in the runnable-substrate scan):**
- Action notes: `run:` + inputs→`ZZ_*` env vars; spawnSync at repo root; output
  captured; every run gated (rule regex deny/ask/allow) + allowlisted
  (`policy.run.allow`) + repo-root path check. runs.jsonl records actor ·
  session · inputs · outcome — MODEL.md already names it "the feedback edge
  for observe".
- Workflow notes are TRUE DAGs — steps carry `depends-on` (Kahn topo-sort),
  saga compensations run in REVERSE on failure, each step gated. (Better than
  assumed.) But: sequential walk only; steps are INLINE shell strings — no
  cross-note composition; idempotency/resume explicitly deferred; NO TIMEOUT
  (spawnSync can hang forever).
- Self-correction edge designed but UNWIRED: observe mines session transcripts,
  never runs.jsonl.
- Containment = gating, not isolation: no OS sandbox (tiers aspirational);
  `bash -c` sub-trees bypass the gate by design; the gate is FAIL-OPEN on
  malformed rules; act/flow are agentInvokable (the gate, not the actor check,
  is the protection).
- Relations between notes are purely descriptive — nothing executes from
  depends-on/blocks across notes. No trigger/scheduler of any kind.

**The gap ladder (leverage order — SAFETY BEFORE AUTOMATION):**
1. **Composition** (S): a step may be `note: <module:id>` instead of inline
   `run:` — workflows compose runnable notes; reuse + the DAG spans the graph.
2. **The runs-miner** (M): observe's sibling reads runs.jsonl → failure/flake/
   drift evidence → staged proposals against the action/workflow notes. This
   wires the designed feedback edge; self-correction becomes real, gated.
3. **The safety floor** (M, PREREQUISITE for 4): per-run timeout; fail-CLOSED
   gating for agent-initiated runs; a containment decision (sandbox-runtime
   integration or an honest "advisory-only" label per action); run concurrency
   discipline (the commit lock exists; runs need one).
4. **Triggers as notes** (M): `type: trigger` — {on: cron expr | commit |
   note-change filter, run: <action ref>} — automation itself is a gated,
   versioned note: agents PROPOSE triggers, humans approve, generations track
   them. Every triggered run passes the same gate. Never before rung 3.
5. **The Flow projection** (M): [Table · Map · Flow] — the third view: runnable
   glyphs, depends-on/step edges as arrows (topo left→right), LIVE run state on
   nodes via the brain push (idle · running · green/red last-outcome ring),
   compensation edges firing on failure, ghost edges for proposed workflow
   changes — the moat in the DAG. Replay a run's traversal like the biography.
6. Parallel step execution · retry/resume · idempotency keys · typed step
   ports (FieldDefs as input/output contracts) (L, later).

One-line pitch this earns: **knowledge that runs, processes that learn, and a
human gate on both.**

### §I.1 — The tool boundary: browser · email · APIs · fly-nativeness (03-07)

§I covered execution; the missing layer is TOOL-IFICATION — how the outside
world becomes a governed capability. Four layers:

**1 · Tool notes (the interface contract).** A runnable note grows a declared
interface: typed inputs (FieldDefs as ports — `lead_url: link, required`),
`secrets: [CLEARBIT_KEY]` (NAMES only — see 3), `requires: [python3, browser-use]`
(see 4), and its guardrail posture. Email, an API, a scraper — each is one
tool note. Tool notes are SHAREABLE VIA THE REGISTRY (`zz subscribe`) — the
W4 marketplace becomes a tool marketplace, gate-governed like everything.

**2 · Three bindings (how a tool note runs), narrowest first:**
   a. **shell** (EXISTS): the CLI is zuzuu's FFI — browser-use has a CLI,
      himalaya does email, curl does APIs. Zero new machinery; the answer to
      "CLI-ing browser-use" is: that IS the model.
   b. **mcp** (NEW, M): a tool note may declare `mcp: {server, tool}` — zz
      grows a minimal MCP client; the exploding MCP ecosystem (gmail, browsers,
      SaaS) becomes bindable without shell glue. Inputs map to tool args;
      the guardrail gate evaluates the (server,tool,args) triple.
   c. **agent** (NEW, M): the run is a PROMPT delegated to the host agent via
      the existing ACP lane ("use your browser tool to …") — leverages the
      host's entire tool ecosystem with zero zuzuu deps; the session transcript
      is the run log; observe already mines it. Gated + interactive-first
      (the human can watch/interrupt in the terminal).

**3 · Secrets (never in notes).** Notes reference NAMES; values resolve at run
time from, in order: process env → `.zuzuu/secrets.env` (gitignored, chmod 600)
→ `fly secrets` when hosted. `zz doctor` reports missing secret names per tool.
A note carrying a literal credential is a `zz check` finding.

**4 · Toolchain manifest → fly-nativeness.** The project declares its runtime
(`project.md: requires:` or a `type: toolchain` note): binaries, packages,
browsers. Locally `zz doctor` verifies them. Hosted: **`zz deploy fly`**
generates Dockerfile + fly.toml FROM the manifest (zz + daemon + toolchain +
chromium-headless when browser tools are declared), wires `fly secrets`,
enables the daemon's existing hosted-auth path (WEBCODE_HOSTED), and cron
triggers (§I rung 4) run IN the machine. The project is its own deployment
spec — git-native end to end: `git push` + `zz deploy fly` = the CRM lives.

Ordering: bindings b/c and deploy sit BEHIND §I rung 3 (the safety floor) —
a browser tool with no timeout on a hosted machine is an incident, not a
feature. The CRM proof-project (scrape → enrich → row via operator lane →
draft email, trigger on `stage: lead`) is the §I acceptance test.

### §I.2 — The break book: adversarial scenarios vs "anything digital projectifies" (03-07)

Battle-tested against: scrape HubSpot → enrich → act → ground workers submit
forms. Each break: the failure, then a DESIGN ANSWER or an HONEST BOUNDARY.

**B1 · Cardinality — rows-as-files dies at scale.** 500k scraped contacts =
500k .md files: readdir/git/corpusSig all collapse; a generation per batch
bloats git forever. ANSWER: the two-plane split — zuzuu is the KNOWLEDGE+
WORKFLOW plane (schemas, tools, workflows, curated/hot rows ≤ ~10k/module);
bulk operational data lives in an attached DATA plane (a sqlite/duckdb file,
itself referenced by a note; queryable via a tool note). Never pretend
files-are-rows scales past tens of thousands. BOUNDARY to document.

**B2 · The third actor — pipeline writes poison through the operator lane.**
The moat models two actors (human=direct, agent=gated). A scraper running as
an operator batch-import is NEITHER: automated, high-volume, and unreviewed —
silent wrong-data (page layout changed, still HTTP 200) stuffs garbage
straight into rows. ANSWER: pipeline writes get their own lane — INGESTION:
lands in quarantine (a staged BATCH, not N proposals) with sampling review
("approve batch: 500 rows, 10 shown, anomaly stats"), schema validation as
the hard gate, and diff-vs-previous-scrape anomaly signals. Review fatigue is
the moat's real enemy — the gate must scale by AGGREGATION, not clicks.

**B3 · Durable human-in-the-loop — the 3-day step.** Ground workers submitting
forms = workflow steps that wait DAYS. spawnSync sagas cannot represent this.
ANSWER: durable runs — a RUN IS A NOTE (`type: run`, step statuses as fields),
the runner resumes from it; a waiting step completes via an ingress (see B4)
or a human `zz run complete <step>`; timers (48h escalation) ride the trigger
substrate. Compensation semantics split: reversible (shell) vs IRREVERSIBLE
(a submitted government form) — irreversible steps declare it and sagas STOP
at them instead of pretending to roll back.

**B4 · No ingress.** Workers/webhooks/inbound email have no door — the daemon
is localhost/token. ANSWER (hosted tier): `/ingress/<trigger-id>` webhooks on
the Fly machine, each bound to a trigger note (gated, versioned); email-in via
the same. BOUNDARY (local tier): no unattended ingress on a laptop.

**B5 · Irreversibility — exactly-once vs the outside world.** Retried workflow
= double email to a customer; compensation cannot unsend. ANSWER: idempotency
keys per step (already designed-deferred) + an OUTBOX pattern for external
side effects (a tool note writes an outbox row; a single dispatcher sends and
marks) + "irreversible" flags gating auto-retry to zero. BOUNDARY: zuzuu
cannot give exactly-once to arbitrary shell commands; it can give it to tool
notes that opt into the outbox.

**B6 · Ingestion is prompt-injection surface.** Scraped content becomes notes
the agent later READS — injected instructions in a HubSpot field steer future
proposals. ANSWER: provenance-aware trust (rows with `actor: ingestion` render
as data, are excluded from steering surfaces (start/digest) by default, and
carry their origin visibly); the gate reviews content, but the REAL defense is
that ingested rows never become instructions. Also: secrets must never ride
run inputs into runs.jsonl (redaction list from the secrets layer).

**B7 · Multi-human — the moat has ONE chair.** Ground workers as USERS (not
just external actors) breaks single-operator: no identities, no per-user gate,
git merge conflicts on concurrent generations. BOUNDARY today (solo tool);
the Enterprise tier's control plane is the recorded future answer — do not
improvise multi-user on the side.

**B8 · The automation-hostile web.** CAPTCHAs/bot-detection (must NOT be
automated — also an ethical line), 2FA mid-run, expiring sessions, ToS
(scraping HubSpot's UI violates it — the API is the sanctioned path), DRM,
native apps, real-time collab canvases. ANSWER: API-first bias in tool notes
(HubSpot has an API; browser automation is the LAST resort), an auth-step
primitive (pause for human login — B3's machinery), and a compliance guardrail
posture per tool. BOUNDARY: systems designed to reject automation stay
un-automated; "anything on screen" is FALSE and the docs should never claim it.

**B9 · Relational integrity at app scale.** No FK/cardinality enforcement, no
cascade, no cross-note rollup columns (deal totals per company), no cross-
module transactions, no bidirectional sync conflict model. ANSWER: rollup as
computed-column builtin #2 (aggregate over backlinks); `link` fields gain an
optional target-module + on-delete posture; sync stays IMPORT-shaped (one
direction owns truth) — bidirectional merge is a BOUNDARY, not a roadmap item.

**The corrected claim**: not "anything digital can be projectified" but —
zuzuu projectifies the KNOWLEDGE, GOVERNANCE, and ORCHESTRATION of any digital
work; the data plane attaches, the runtime executes at the tool boundary, and
the human gate scales by aggregation. What it refuses: high-cardinality
storage, multi-user (yet), exactly-once magic, and the automation-hostile web.

### §I.3 — The verdict: don't scrap — invert. Control plane, not engine (03-07)

§I fused two claims. The break book kills one and leaves the other untouched:
- KILLED: "zuzuu is a workflow EXECUTION ENGINE" (durable, concurrent,
  exactly-once, long-running) — that is Temporal's decade-hard problem; every
  break (B3 · B5 · timeout · resume) attacks this claim.
- UNTOUCHED: "processes are NOTES" — versioned, gated, queryable, mapped,
  evolved through review. No engine on earth has this. It is the moat applied
  to process, and it is the profound part.

**The inversion**: zuzuu is the CONTROL PLANE — it owns the DEFINITION (tool/
workflow/trigger notes), the GOVERNANCE (gate, generations, provenance), the
STATE (runs-as-notes), and the LEARNING (runs-miner → proposals). Execution is
always a short-lived, stateless worker advancing durable state that lives in
the substrate we already have. "Borrowed, not invented" applied to runtimes.

**The three-tier execution model** (a tool/workflow note declares its tier):
- **Tier 0 · script** (exists + safety floor): synchronous act/flow with
  timeout — seconds-long, local, reversible. Most personal automation is this.
- **Tier 1 · session** (§I.1 binding c): delegated to the host agent via ACP —
  interactive, judgment-laden, browser work, auth pauses. A human is
  co-present; the transcript is the run log; observe mines it natively.
- **Tier 2 · durable** (the workaround, NEW): **the run is a note** — a state
  machine in frontmatter (per-step status · attempts · idempotency key ·
  waiting-on). NO long-lived process: each step is one short invocation; a
  runner tick (daemon timer, cron, or `zz run advance`) reads the run-note,
  executes the next ready step, writes the new state. Crash-recovery = re-read
  the note. Waits (human steps · timers · ingress) are just STATES — a 3-day
  ground-worker step is a run-note sitting at `waiting: form-42`, visible in
  the table, resumed by `zz run complete` or an ingress trigger. External
  effects only via outbox-opted tool notes (B5). Semantics: AT-LEAST-ONCE +
  idempotency keys — honestly documented, never "exactly-once".

Durability comes from the substrate (notes + git + the one write door), not
from process supervision — that is why this is buildable by this project and
Temporal-lite is not. The moat stays the star: definitions and their evolution
are what zuzuu uniquely governs; execution stays humble, tiered, and honest.
Sequencing unchanged: safety floor → composition → runs-miner → tier-2 runner
→ triggers → Flow view. The CRM proof-project now spans all three tiers.

### §I.4 — Grounded: engines + builders studied (Temporal · Camunda · Airflow · n8n · Windmill · Mobbin)

The field CONVERGES on our design — strong external validation, plus a precise
vocabulary to adopt. (research brief + Mobbin screens: n8n 817531c3/47384bb9,
Apollo 1ee9cb3d, Retool da762b17, Intercom cb6e5ce9.)

**The validation (build with confidence):**
- Windmill (closest cousin, windmill.dev): scripts/flows/secrets ALL git files,
  deployed via git-sync, PR-reviewed, rollback-able. Our git-generations +
  review-gate is a proven architecture, not a gamble.
- Temporal: deterministic-transition / idempotent-side-effect split IS
  "runs-as-notes" (pure state transitions in frontmatter; side effects in short
  stateless workers). Their patching PAIN → their fix is "pin each run to the
  version it started under" — WE GET THIS FREE: a run-note records the workflow
  GENERATION it started under; in-flight runs never float to a newer def.

**Adopt into the runner spec (rungs, source-attributed):**
1. **Pin run→generation** (Temporal): run-note stores the workflow gen it began
   under; the runner reads the def AS-OF that gen. Solves versioning by design.
2. **Idempotency key per side-effecting step** (Temporal incident + outbox):
   {key, request-hash, status, canonical-response} in the run-note, TTL > retry
   window. Prevents the double-email (B5).
3. **Timeout taxonomy** (Temporal): per step, start-to-close (one attempt) +
   total (incl retries); our rung-A `timeout:` is start-to-close — add the
   total budget when retries land.
4. **Retry policy** (Temporal/Kestra): declarative `retry: {type: exponential,
   max, cap}` + NON-RETRYABLE error classes (validation fails fast). Two-tier:
   flow-level onFailure vs per-step errors (Kestra).
5. **Human wait = signal-vs-timer race** (Camunda): a waiting step races an
   external signal (ingress/`zz run complete`) against a boundary timer;
   INTERRUPTING (hard escalate) vs NON-INTERRUPTING (reminder). The 48h ground-
   worker escalation, formalized. `claim` before work (avoids double-assignment).
6. **Small closed step vocabulary** (anti-BPMN): resist 100 node types; a step
   is run|note-ref|wait|gate — four kinds, mirroring our relation-type discipline.
7. **Layered def-change gate** (Argo GitOps): our review gate is the first layer;
   promote/enable is a second — a workflow can be reviewed-in but not yet enabled.

**Flow-view UI (adopt for the future web view):**
- **Editor / Executions tab split** (n8n): definition vs run-history as peer
  views — maps to generations vs runs-as-notes.
- **Grid + Gantt** (Airflow): run×step state-colored matrix (click to drill) +
  single-run latency timeline. THE run-monitoring pattern.
- **Trigger blast-radius preview** (Apollo "current matches: 5"): a proposed
  trigger shows what it WOULD fire on — a safety affordance at REVIEW time.
- **Detached error/compensation nodes** (Retool): failure routes visible,
  untangled from the happy path.
- **Pin-data single-step test** (n8n): capture a node's output, replay downstream
  without re-firing upstream side effects — our "test one tool note" affordance.
- **Waits are first-class nodes** (n8n "send and wait"): render the wait, not
  just the work. Canvas triad: palette (= the tool-note registry) / canvas /
  properties panel.

**Anti-patterns to refuse:** BPMN symbol bloat; unbounded run history (Temporal
50K-event cap → run-notes must stay compact/compactable); non-observable wait
state (n8n HITL silent-fail reports → waits must be visible + alertable);
over-wrapping primitives.
