# Workbench experience spec — the Project as a CRUD-to-app

> **The consolidated experience design** (brainstorm 2026-06-24/25). It sits on top of the
> research docs [`01`](01-collection-and-graph-views.md)–[`04`](04-query-layer.md) and decides the
> actual *shape* of the workbench — both worlds, every surface, the locked decisions + why. The
> build phase reads this first. Status: design-locked, pre-build. Companion: the visual-language
> brief is [pass ①](../README.md).

---

## 1. The thesis — a database app, not an IDE

The whole design turns on one reframe: **the Project already _is_ a database**, so the workbench
is a **CRUD-to-app admin** over it (Glide / Refine.dev / Airtable / Retool lineage) — not a code
editor with a brain panel bolted on.

```
PROJECT  ───────────────────────────────►  a DATABASE
  module        = a TABLE
  note          = a ROW
  frontmatter   = the COLUMNS   (keys → typed fields)
  relations:    = FOREIGN KEYS  → the graph / ER view across tables
  staged/       = pending writes awaiting the review gate
  log.jsonl     = the change-log / audit ·  generations = version history
```

This single metaphor unifies every gap the workbench had — specialized envelope visualization =
the **record/form**, collection/graph views = **tables + the ER graph**, audit/JSONL = the
**activity log**, review = the **write-gate on the DB**. The workbench is "point at a `.zuzuu/`
database, get an app."

**Two consequences, locked:**
- **Not an editor.** You rarely hand-edit raw markdown; you read a rendered record or edit it
  through a typed **form**. The file experience is **view-first, ✎-to-edit** — Monaco demotes from
  "the editor" to a view-only raw reader + power-user escape hatch.
- **Tables-first nav.** Primary navigation is **tables → records**, not file paths. The raw file
  tree lives behind a toggle; heavy file work goes to the user's own editor (we don't out-IDE the
  IDE — we do the thing only we can).

---

## 2. The shell — two worlds

The workbench has two poles: the **database app** ("knowing") and the **live session** ("doing").
They are **two full-canvas worlds** with a top-level switch (⌘K or click). Each gets the whole
screen; you live in one and flip at the seams of the work rhythm (`start → work → wrap → review`).

```
        ┌ Work ┊ Brain ┐   ← click or ⌘K flips
```

The left rail is **world-specific**: **Work = sessions**, **Brain = tables**. (Same restraint &
visual language across both, so it reads as one product.)

---

## 3. WORK world — *do + approve*

Where the Plane-3 thesis ("session management via conversations") lives. Its job: **converse with
the host to do work, steered by zuzuu, and triage the brain growing in real time** — review is not
deferred to Brain; it happens *live* here.

```
WORK — do + approve
┌─────────────────┬──────────────────────────┬────────────────────┐
│ SESSIONS        │   conversation           │  REVIEW            │
│ ● deck-loop  3  │   live terminal /        │  knowledge/hot-file│
│ ○ fix-tests     │   receipts               │  app.tsx edited 12×│
│ ○ docs-pass     │                          │                    │
│ ─────────────   │                          │  ⊙ diff            │
│ ⚠ recover  ▸    │ ──────────────────────── │  ✓ approve         │
│ + new           │   ❯ type to the agent…   │  ✗ reject          │
└─────────────────┴──────────────────────────┴────────────────────┘
   ● active  ○ idle  · number = pending review  · ⚠ = dropped session
```

### 3a. Sessions (left) — manage, calmly

A **quiet list**, not a wall of buttons. Each row: name · a **state dot** (`●` active / `○` idle) ·
a **pending-review badge** (the count of staged notes for that session). A `⚠ recover` entry
surfaces a dropped/leftover session (the drop-recovery path), and `+ new`. **State, not controls.**

Branch machinery reveals **only on select** — never always-on:

```
select "deck-loop" ▸
┌ deck-loop ───────────────┐
│ ⎇ zz/session-3 · worktree│
│ 7 turns · 3 checkpoints  │
│ continue · merge · ⋯     │   ← ops in one quiet row / overflow, not a button grid
└──────────────────────────┘
```

Each session is a git branch (`zz/session-*`) + worktree; run several concurrently.

### 3b. Conversation (center) — hybrid *(parked default)*

The conversation surface. Decision **parked** at the recommended default: **hybrid** — the live
**terminal stays the source of truth** (the composer is input-only; the terminal *is* the
transcript, per the shipped decision), with a calm **receipts strip** rendering each parsed turn
(`edited 3 files · ran tests · staged 1 note → review`) from the Design-B transcript. Revisit
(terminal-only vs parsed-receipts-only) when it matters; it's not load-bearing for the rest.

### 3c. Review (right) — *the gate that teaches*

The live approval queue — the single most important surface, because it turns the human gate from
a chore into a **training signal** (the loop `observe → stage → review → evolve` closing on
itself). Per staged note: `⊙ diff` · `✓ approve` · `✗ reject`.

- **Approve** — clean **yes/no**. Approve = *promote* = `evolve` (write the note + mint a
  generation + log). Edits happen later in Brain, not at the gate.
- **Reject** — captures a **reason**, then teaches:

```
✗ reject ▸
  why?  ◦dup ◦wrong ◦scope ◦granular ◦premature ◦reword   (+ optional text)
  → teaches silently  (default)
  ⤴ make an instruction (opt-in)
```

Why structured-reason-then-action beats a free-text comment:
- A **reason chip** is *machine-actionable* — each maps to a concrete loop adjustment (duplicate →
  tighten dedup; too-granular → merge; out-of-scope → suppress that path).
- **Dedup-against-rejected** is the quiet hero: `observe` must dedup future proposals against
  *rejected*, not just *approved* — else it re-proposes what you killed last week. (Same rule that
  stops a discovery loop from looping: dedup vs *seen*, not vs *confirmed*.)
- Two intents stay separate: **Reject & refine** (re-propose now using the reason) vs **Reject &
  teach** (standing negative evidence: raise the corroboration bar / suppress the pattern).
- **Teach silently by default**; promoting a reject into a standing Instruction ("don't propose X")
  is an **explicit opt-in** (`⤴`), so the Instructions module never bloats on autopilot.

---

## 4. BRAIN world — *know* (the database app)

```
BRAIN — the Project as a database app
┌──────────────────┬──────────────────────────────────────┬──────────────┐
│ TABLES (modules) │  knowledge ▸ grid    [type=knowledge]✕ │  ↘ record    │
│ ▸ knowledge   ▣  │  ┌──────┬──────────┬──────┬─────────┐  │  (envelope)  │
│   · all view     │  │title │ type     │ tags │ rel..   │  │  side panel  │
│   · ★ hot-files  │  ├──────┼──────────┼──────┼─────────┤  │  (peek →     │
│ ▸ actions     ▣  │  │ •    │ knowledge│ …    │ → deck  │  │   expand)    │
│ ▸ rules       ▣  │  └──────┴──────────┴──────┴─────────┘  │              │
│ ▸ instructions ◇ │  [grid][board][gallery][ER] · ⌕ query  │              │
│ + new table      │  3 staged ▸ review                     │              │
└──────────────────┴──────────────────────────────────────┴──────────────┘
  ▣ typed table   ◇ schemaless (cards)   · saved views nest under each table
```

### 4a. Tables (left)
Modules as tables: `▣` a typed (graduated) table, `◇` a schemaless module (freeform cards). **Saved
views** nest under each table (filtered/sorted, personal or shared). `+ new table`.

### 4b. The table canvas (center) — grid + views + query
The active table as a **grid** (default), with a **filter-chip bar** and a **view switcher**:
`[grid] [board] [gallery] [ER]`. The `⌕ query` opens the power-user predicate/graph bar. A live
`N staged ▸ review` count. (Query engine = the existing `node:sqlite` index — see §6.)

### 4c. The record (right) — the envelope, as a side panel
Click a row → the envelope opens as a **side panel** (peek → `⤢` expand to full). This is the
specialized envelope visualization:

```
┌ card-schema ───────────────────── ✎  ⤢  ✕ ┐
│ PROPERTIES                       (view-first)│
│   title      Card schema                     │
│   type       knowledge                       │
│   tags       cards · schema                  │
│   relations  → deck-index   → hot-file-app   │
│ ──────────────────────────────────────────── │
│ # Card schema                                │
│   The deck is defined by …  (rendered body)  │
│ ──────────────────────────────────────────── │
│  Generations ·  Audit ·  Backlinks    ← tabs │
│   gen 3 (current) · 2 · 1        [rollback]   │
└──────────────────────────────────────────────┘
  ✎ opens the typed form · ⤢ expands full · ▶ runs a run: note
  every edit → staged → review (never a silent write)
```

Frontmatter renders as **typed property fields** (view-first; `✎` opens the form). The body renders
as markdown; `relations` are navigable chips; a `run:` note gets a `▶` action; tabs hold
**Generations** (with rollback), **Audit**, **Backlinks**. **Every edit flows through `review`** —
the daemon shells the gated `zz` CLI, so the browser physically cannot bypass the gate.

### 4d. ER / graph view
Relations across tables: nodes = notes (colored by table), edges = `relations:`; click a node →
the record panel. The same view *redraws itself* as tables split and intra-table refs become true
foreign keys (§5).

```
ER / graph
 ┌knowledge┐    ┌actions┐
 │card-schema├uses►rebuild-index
 │deck-index │    └──────┘
 └────┬──────┘
      └refs►[rules] no-secret-reads
```

### 4e. Audit
The change-log: `log.jsonl` (mutations, durable) + `runs.jsonl` (runs, local). Filterable
`[table] [event] [actor]`, live tail; click a row → the diff or the run detail.

```
Audit
 ● gen 3  knowledge/card-schema  updated   2m
 ▷ run    actions/rebuild-index  ✓ exit 0  5m
 ● gen 2  knowledge/deck-index   created  12m
```

### 4f. Review (batch)
The **same component** as Work's live queue (§3c), here as a batch triage surface. One review
behavior, two contexts.

---

## 5. Schema graduation — structure evolves through the gate

The reconciliation of "modules are *evolving* collections" with "tables have *schemas*":
**schema is itself an evolutionary stage of a module, and table-splitting is the `grow` loop applied
to *structure* instead of *content*.** The same `observe → stage → review → evolve` gate that grows
rows grows columns and splits tables.

```
①  born schemaless            ②  graduate to a table          ③  split when heterogeneous
┌─ knowledge ────────┐        ┌─ knowledge ▸ grid ───────┐    knowledge → 2 cohorts emerge
│  (freeform cards)  │  ──►   │ title │ kind  │ status   │  ──►  card-mechanics + ui-patterns
└────────────────────┘ infer  └──────────────────────────┘    (observe or you propose the
   gallery / cards     cols →  typed table (grid + forms)      split → rows move, relations
                       confirm                                 rewire, reviewed at the gate)
```

- **Born schemaless** (preserves on-demand materialization — `observe` mints a module mid-session
  without forcing a schema-design interruption). Renders as cards/gallery.
- **Promote** when it stabilizes: the workbench infers columns → you confirm → it becomes a typed
  table, and **fields are mandatory from then on** for that table.
- **Split** when heterogeneous: a gated **refactor** (the machinery exists — `grow/refactor.mjs`
  `merge/rename/refactor` + `repointReferrers` for the link-rewire); `observe` can *propose* the
  split.
- **Migrations** surface at the gate: a new required field → *"3 rows missing `status` → fill ·
  default · make optional."*

Mechanism: a per-module **keys/fields registry** on `module.md` (typed columns + which are
required), minted at **promotion** and itself versioned (a reviewed generation). Schema changes are
gated like content.

---

## 6. The query layer

**Keep `node:sqlite`** (FTS5 + recursive-CTE graph walks + BM25) — it already subsumes every
paradigm surveyed ([`04`](04-query-layer.md)); the zero-dep core forbids a new engine (every fast
searcher/graph DB is a system/native/JVM binary). The design surface is the **workbench UX**, where
the field has converged:

- **Default:** visual **filter chips + saved named views** (personal/shared split, URL-shareable
  state) — build native (~500–800 LOC, zero new deps).
- **Power-user:** a predicate / mini-graph query bar that **compiles to the existing CTE+FTS SQL**.
- *(The serialized filter/query state is the one good idea to borrow from the "GRIP" tangent — a
  saved view is a serialized query, not a new engine.)*

---

## 7. Cross-cutting

- **The gate that teaches** (§3c) — the defining mechanic: reject-with-reason → loop refinement.
- **Calm by restraint** — *state-not-controls* (rails read at a glance), *reveal-on-select* (ops
  hide until needed), *color only for state*, *one verb per row*, *receipts not logs*, *detail in a
  rail*. Carried identically across both worlds so they feel like one product.
- **⌘K palette** — flip worlds · jump to a table / record / session · run a query.
- **Review is one component, two contexts** — live in Work, batch in Brain.
- **One door to every write** — the daemon shells the gated `zz` CLI (never imports `grow/`); the
  browser cannot bypass the review gate. Integrity boundary, not indirection.

---

## 8. Build mapping — what this means for `web/src/client`

Today (`app/App.tsx`): a 3-pane shell — `Sidebar (files) | SessionTabs + TermView + Composer |
RightPanel (editor ⇆ modules dashboard)`. The evolution:

- **The two-world shell** replaces the single 3-pane layout (a `Work ┊ Brain` switch over a shared
  frame).
- **Work world** ≈ today's center (`TermView` + input-only `Composer`) + a **sessions** left rail
  (evolve `SessionTabs`/session state) + a **live Review** right rail (evolve `panel/` modules
  dashboard's approve/reject).
- **Brain world** is mostly **new**: the tables nav, the grid + view switcher + filter chips, the
  record side panel (the envelope), the ER graph, the audit log. The `RightPanel` modules dashboard
  is the seed of Brain's review surface.
- **File explorer / Monaco** (`explorer/`, `editor/`) demote to the behind-a-toggle view-first
  reader.

**Library picks** (from [`01`](01-collection-and-graph-views.md)–[`03`](03-js-library-landscape.md),
all MIT/ISC/BSD/Apache, lazy-loaded via `React.lazy()` + Vite `manualChunks` so they never touch
the initial bundle):

| Surface | Pick |
|---|---|
| grid / table | **TanStack Table v8** (+ TanStack Virtual) |
| lists / receipts / audit / log stream | **react-virtuoso** |
| ER / relation graph | **react-force-graph-2d** → sigma.js + graphology at scale |
| diffs (record + gen↔gen) | **react-diff-viewer-continued** |
| rendered body | **react-markdown** (+ remark-gfm) |
| record form | generated from the module schema (react-hook-form) |
| query | the existing `node:sqlite` index (no new dep) |

---

## 9. Decision log

| # | Decision | Choice | Why / rejected |
|---|---|---|---|
| 1 | What is the workbench? | **CRUD-to-app admin over Project-as-DB** | unifies every surface; rejected "IDE + brain panel" |
| 2 | Shell | **Two worlds: Work ⇄ Brain** | full canvas per mode, maps to the work rhythm; rejected terminal-first rail, brain-first drawer, unified split |
| 3 | Left nav | **Sessions in Work · Tables in Brain** | world-specific; corrects "tables both sides" |
| 4 | File surface | **Lean: tables-first; files behind a toggle, view-only ✎** | don't out-IDE the IDE; rejected first-class explorer + drop-files |
| 5 | Editing | **View-first, ✎ → form; clean approve (no edit-at-gate)** | records edited via typed forms, not raw md |
| 6 | Schema | **Graduates** (born schemaless → promote → split, gated) | reconciles evolving modules + typed tables; rejected mandatory-at-birth, never-mandatory |
| 7 | Query | **Keep node:sqlite; native filter-chips + saved views + power query bar** | zero-dep core; GRIP isn't real ("grep" was the muse) |
| 8 | Record detail | **Side panel (peek → expand)** | stays in grid context; rejected full-page, master-detail split |
| 9 | Review | **Live in Work + batch in Brain; one component** | review belongs in the session, not only after |
| 10 | Reject | **Reason chip → teach silently; ⤴ promote-to-Instruction opt-in; dedup-against-rejected** | turns the gate into a training signal without Instruction bloat |
| 11 | Work center | **Hybrid (terminal-truth + receipts) — parked** | not load-bearing; revisit later |

---

## 10. Open questions for the build phase

- **Field types** — the column type set for graduated tables (text · select · multi · link · date ·
  number · bool · run?) and how `relations` render as a linked-record field.
- **Promotion UX** — inferring columns: union-of-keys vs sampled vs heuristic; how the confirm step
  feels.
- **Split detection** — does `observe` propose splits (cohort detection), or is it manual-only first?
- **Reject taxonomy → loop wiring** — the exact mapping from each reason chip to an `observe`
  adjustment (dedup set, corroboration threshold, route suppression).
- **Receipts fidelity** — how much of the host's rich TUI output the receipts strip reproduces
  before it's worth it (ties to the parked §3b).
- **`@monaco-editor/react` already bundled?** — if so the raw-file reader is ~free; else lean on
  Shiki for read-only highlighting.

> These are decisions, not yet code. The build phase picks per surface and records the choice (and
> why) in [`../../LOG.md`](../../LOG.md).
