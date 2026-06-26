# Workbench Shell IA — ce-ideate

**The open question:** Before building Phase D's `WorkbenchShell`, is "**Work and Brain as two separate MODES** (a top-level ⌘K switch)" — the locked spec's assumption — the right shell information-architecture? Or is there a better one (a unified single surface, contextual panels, command-driven, three-pane, a continuous canvas, conversation-first, etc.)? What should the shell actually look like, and how do you navigate it?

## Grounding (what's built, what's assumed)

Phase A–C shipped the engine, not the shell: a **DataProvider over the gated `zz` CLI whose writes resolve to a pending proposal** (the human review gate, as data-provider semantics — every write is staged, lands only on approve); a **FieldType registry** (one map drives grid cell + form input + schema graduation); a **ListContext** pull-model; a token-driven design system + copy-owned shadcn/Radix kit; the terminal engine ports verbatim. The locked spec (`docs/design-research/workbench/05-experience-spec.md`) assumed a **two-world shell** — WORK (a live PTY session + a live Review queue) ⇄ BRAIN (the database app: tables → grid → record rail → ER graph → audit), flipped with ⌘K, left-nav = sessions in Work / tables in Brain. The reframe is locked (workbench = CRUD admin over the Project-as-database: module = table, note = row, frontmatter = columns, relations = FKs — **not an IDE**). What is *not* locked, and what this doc decides, is the **shell IA** that holds those poles.

The convergent finding across all five generation frames: **users cross the Work/Brain line because of an event** (a proposal lands, a guardrail fires, the agent touches a watched note), **not a navigation intent** — so any IA that taxes the crossing with a mode-switch is mispriced. And one non-negotiable every frame independently hit: **the review gate cannot belong to a mode** — it is the literal seam (Work produces proposals, Brain consumes them), so it must be co-visible with both poles. The moat forbids the modal switch in its naive form.

---

## Ranked survivors

### 1. Stage + Wings — *one fixed three-region frame; sessions and modules are sibling nav node-types; only the contents morph*

The disciplined synthesis the radicals argue toward. A single permanent shell: a **unified nav tree where sessions and modules are siblings** (not two modes), a **center "stage"** that morphs by selection (terminal for a session node, grid for a module, record for a row, ER canvas for the graph node), and a **right wing** that morphs by context (live review queue + turn summary for a session; FieldType form for a note; schema + generations for a module). Wings dim/retract when idle. A persistent **footer ribbon** carries the one un-missable signal — session liveness + pending-proposal count + an `R`-to-review hotkey — so the gate is never silent regardless of what's on stage. ⌘K rides on top as the fast lane.

```
┌─────────────────────────────────────────────────────────────┐
│ ⌘K        cards-game › knowledge › auth.session              │  breadcrumb = your one location
├──────┬──────────────────────────────────┬───────────────────┤
│ ░NAV │  STAGE (one actor, by selection) │ ░WING (context)   │
│ sess │   session → live terminal (PTY)  │  session live →   │
│ · s1●│   module  → grid (rows×frontmtr) │   review queue    │
│ · s2 │   row     → record (reading)     │   [A] [R]         │
│ modl │   graph   → ER canvas            │  note  → fields   │
│ · kn │                                  │  module→ schema   │
│ · act│                                  │        + gens     │
├──────┴──────────────────────────────────┴───────────────────┤
│ ● zz/auth-fix live · ◷ 2 pending           press R to review │  ← always-on ribbon
└─────────────────────────────────────────────────────────────┘
```

- **Optimizes for:** the gate's cross-pole visibility (its one non-negotiable) + calm (nothing rearranges, only contents change) + CRUD-admin legibility + **shippability** — it reuses the built DataProvider (wing = the pending-proposal surface), FieldType registry (wing = the form), and ListContext (stage = the grid) almost directly.
- **Tradeoff:** the stage still can't be a terminal *and* a grid at once, so two genuinely different objects time-share one space; concurrency (N live sessions) needs an opt-in center-split or the Mission-Control roof bolted on. The footer is a low-bandwidth channel — fine for "2 pending," wrong for streaming a diff.
- **Verdict on Work/Brain modes: DISSOLVE.** Work and Brain become *selections in one tree*, not a top-level switch. The ⌘K flip was solving a problem (cross-pole reference, silent proposals) that a hard mode-switch *creates*. This is the lowest-risk dissolution and the recommended baseline to build Phase D on.

### 2. Tide — *one adaptive pane the system reshapes by session liveness; the user never operates the switch*

Agrees there are two poles but argues the user should never throw the switch — the **work's own lifecycle drives the shell** (a signal we already emit at branch-attach and squash-merge). **Low tide** (no live session, the common steady state): a calm pure-Brain browser (tables + grid). **High tide** (a session attaches): the surface auto-reshapes — terminal takes the stage, the review queue rises as the rail — and recedes back to the brain on session-end. Brain stays reachable mid-session as a non-destructive slide-over ("peek the brain") so you can reference a note without losing the stream. The tide *offers* to come in (a quiet affordance) rather than yanking the surface mid-edit.

```
LOW TIDE (calm brain browser)            HIGH TIDE (session live → reshaped)
┌──────────────────────────┐             ┌──────────────────────────────┐
│ ░tbl │ knowledge · 42    │             │ ● zz/auth-fix live           │
│ ░tbl │ ▸ auth.session 2d │   ──tide──► │ ┌──────────────┬──────────┐  │
│ ░tbl │ ▸ token.rotn  5d  │   in/out    │ │ $ PTY stream │ ◷ pend 2 │  │
│      │                   │             │ │ (input-only) │ [A][R]   │  │
└──────────────────────────┘             │ └──────────────┴──────────┘  │
                                         │ ⌐ peek the brain (slide-over)│
                                         └──────────────────────────────┘
```

- **Optimizes for:** zero navigation cost for the product's actual rhythm (you're either doing or knowing; the shell matches your real state) and maximal calm (only the relevant pole is ever foregrounded, and transitions are motivated by real events).
- **Tradeoff:** a self-reshaping interface is disorienting if mistimed (mitigated by *offer*, not *force*); and "is a session live" is a boolean while worktrees allow several — it needs an explicit rule for which live session owns the stage (most-recently-active; others as dots).
- **Verdict: DISSOLVE via automation.** The sharpest reframe of the question — there are two poles but the *user should not own the switch*; liveness does. Modes become states the system enters, not places the user travels to. Highest-upside bet; worth prototyping the transition.

### 3. Receipt Spine / The Gate Is the Home — *the proposal queue is the home surface; Work and Brain hang off a receipt as provenance*

Inverts the hierarchy around the moat. Because every write *is* a pending proposal (the literal DataProvider semantics), the **proposal queue is the most important object**, so it's the default home. You don't navigate to review — you start there. Each receipt carries its own **why** (the terminal excerpt that triggered it), **what** (the note diff), and **where** (the destination table it joins). The live terminal and the data grid are reached *through* a receipt: "this came from session zz/auth-fix → open it live" / "this edits knowledge → open the grid." Reject prompts inline for the teaching note (reject teaches, kept cheap). "Receipts not logs," made literal and primary.

```
┌────────────────┬──────────────────────────────────────────────┐
│ ◷ PENDING (3)  │  RECEIPT (selected proposal, expanded)        │
│ ▸ auth-flow  ● │  add note → knowledge/auth-flow               │
│ ▸ rm-rf rule ● │  WHY  ┌ $ ...the turn that proposed this... ┐ │
│ ▸ retry-step   │  WHAT ┌ +relations:[login]  +key: bucket    ┐ │
│ ✓ SETTLED      │  INTO ┌ knowledge ▦ 41 rows → becomes row 42 ┐ │
│ ─────────────  │       [ Approve ⌘↵ ]  [ Reject + teach ]      │
│ ◷ sessions →   │                                              │
│ ▦ tables   →   │  sessions/tables are secondary "sources"     │
└────────────────┴──────────────────────────────────────────────┘
```

- **Optimizes for:** the thing uniquely ours — the human gate — and batch-triage throughput; every pixel serves the moat, and the reviewer never flips to understand context or see impact.
- **Tradeoff:** triage-first, not build-first. **Empty-queue is the common steady state** → a near-blank home, and Brain-as-database (the locked reframe's hero) is demoted to a secondary "browse" link. Risks trading Notion-calm for inbox-pressure.
- **Verdict: REPLACE the split — around a *third* pole.** The real seam isn't doing-vs-knowing, it's **pending-vs-settled**, and the two-mode spec accidentally hides the moat *inside* one mode (Review lives "in Work"). The boldest faithful-to-architecture reframe; strongest if telemetry says the product is review-led.

### 4. Branch Switcher / Split-by-Session — *the session (= git branch) is the unit; Brain is its scoped rail, and `main`/no-session is the global database*

Questions whether "Brain" is a top-level place at all. In real use, the notes you touch are *the notes this session is touching* — so make the **session the primary container** and Brain its **context rail**, scoped to exactly the modules/notes in play. A top bar checks out a branch (the git mental model the user already has); each session-branch shows *its* terminal, *its* touched notes, *its* pending proposals. Switch to `main` (no active session) and the working context becomes the whole-Project database — because the global Brain is just what every branch shares.

```
┌─ ▾ zz/auth-fix  ● live · ◷1 pending      [main ▾]  ⌘K ─────────┐
├──────────────┬──────────────────────────────┬─────────────────┤
│ in-branch    │  WORKING CONTEXT (this branch)│ IN-PLAY BRAIN   │
│ ·terminal    │  ┌─────────────────────────┐  │ notes this sess │
│ ·notes touched│  │ live PTY (transcript)   │  │ reads/writes:   │
│ ·proposals ◷1│  └─────────────────────────┘  │ ▦ knowledge     │
│              │  ┌ pending from this session ┐ │  · auth-flow    │
│ [main → all] │  │ ◷ auth-flow [✓][✗]        │ │ ▦ guardrails    │
│              │  └───────────────────────────┘ │ [open full ▦]   │
└──────────────┴──────────────────────────────┴─────────────────┘
      main (no session) → working context = the full DB grid + graph + audit
```

- **Optimizes for:** **concurrency and provenance** — each session is a self-contained workspace mapping 1:1 onto session = branch = worktree; the review queue is *always* co-visible because it belongs to the session you're in; provenance is spatial (a proposal sits next to the session that produced it).
- **Tradeoff:** the *global* CRUD-admin value prop becomes a `main` zoom-out rather than a first-class home — users who came to *curate the database* start one level deep; cross-session notes (a row two branches edited) are awkward when Brain is session-scoped.
- **Verdict: REPLACE — re-axis from doing/knowing to scope (this-session vs global).** Collapses the two-mode switch into the thing the user already does in git: check out a context. Best concurrency story; bets the product is session-led, the inverse of #3's bet.

### 5. Margin Notes — *the brain is the page; the live session runs in a persistent margin; the gate is an inline annotation on the note it would change*

A genuinely different geometry from how humans annotate. The **note/grid is the body text** holding the center (brain = hero). A live session doesn't get its own world — it runs in a **persistent, dimmed right margin** (a footnote alongside prose), glanceable without summoning, click-to-focus to drive. And a proposal appears as an **inline annotation anchored to the exact note it would change** — a margin comment with `[approve][reject]` right where the affected knowledge lives. Reviewing becomes reading: you see the diff against the row it modifies, zero context-fetching.

```
┌──────┬───────────────────────────────────────┬─────────────┐
│ ░tbl │ ## auth.session.refresh               │ ● zz/auth-fix│
│ ░tbl │ type: knowledge                       │   live PTY   │
│ ░    │ The refresh token rotates…            │   (narrow,   │
│ ░    │ ┌─ ◷ proposed change ────────────┐    │    dimmed)   │
│ ░    │ │ + rotation now every request   │    │   $ …        │
│ ░    │ │ from zz/auth-fix   [A] [R]      │    │   $ …        │
│ ░    │ └────────────────────────────────┘    │             │
│ ░    │ relations: → token.rotation           │             │
└──────┴───────────────────────────────────────┴─────────────┘
```

- **Optimizes for:** keeping knowledge the hero *while* never hiding the live session or the gate; the **lowest-cognitive-load review possible** — the change is shown in situ against its target, three things visible but ranked by visual weight rather than split into worlds.
- **Tradeoff:** the persistent margin spends horizontal space always (less calm than a retracting wing); **anchoring breaks for create-note proposals** (no existing target) and non-note changes (a new guardrail, a schema graduation) — those need a fallback home (the `◷` queue / top of the module grid). Multiple concurrent session-margins strain the geometry.
- **Verdict: DISSOLVE spatially.** Rejects the flip by giving each pole a *fixed region ranked by importance* rather than a mode that swaps the surface. Most radical claim on the gate: a proposal is an edit to a note, so it belongs *on that note* — the review "queue" needn't be a place at all (batch triage stays as a secondary view).

### 6. Mission Control — *(the roof, not the house)* — *an overview of all live sessions + a cross-session batch queue; drill into a session or a table*

Projects to the stated future — several concurrent sessions across worktrees. The home is an **overview of all live work + all pending decisions** (Exposé of session tiles, each with its last line and pending count), plus a **batch queue groupable by module or by session** (review all knowledge proposals at once, or clear one branch). Click a tile → that session's terminal; click a table → its grid.

```
┌─ OVERVIEW          ◷ 7 pending across 3 sessions          ⌘K ─┐
├────────────────┬────────────────┬───────────────────────────┤
│ ◷ auth-fix live│ ◷ ui-pass live │ ◷ docs  idle              │  session tiles
│  $ npm test    │  $ tsc         │  merged 4m ago            │
│  ◷ 3 pending   │  ◷ 2 pending   │  ◷ 2 pending              │
├────────────────┴────────────────┴───────────────────────────┤
│ BATCH QUEUE        group by: ◉ module ○ session              │
│ ▦ knowledge  ◷ auth-flow · api-shape      [✓ all][review ▸]  │
│ ▦ guardrails ◷ rm-rf rule                 [✓][✗]            │
│ TABLES: knowledge · actions · memory · guardrails · graph ▸  │
└──────────────────────────────────────────────────────────────┘
```

- **Optimizes for:** the actual end-state workload — managing N parallel agents and triaging a *cross-session* queue; concurrency and batch review are first-class, scaling the moat from "one live queue" to "fleet triage."
- **Tradeoff:** heavy for the common case (one session, 0–1 pending) — an overview of a single tile is silly, and Brain is demoted to a strip, so the database-admin value prop is weakest here. A great *escalation* surface, a poor *default*.
- **Verdict: KEEP a split, but redraw it (one-vs-many sessions, not Work-vs-Brain).** Best as the **expand-all roof** over #1 or #2's drill-down level, unlocked once real concurrency exists — not the whole shell.

---

## Rejected, and why

| Candidate (frame) | One-line reason |
|---|---|
| **Palette-Native** (the ⌘K bar IS the shell) | You can't *watch* a live PTY or *feel* a proposal land through a launcher — zero ambient awareness; ⌘K is the fast lane, never the foundation. |
| **Focus-Void / Zen-only** (no chrome; all overlays) | A proposal landing mid-type either interrupts (breaks calm) or hides (breaks the gate); discoverability craters; punishes novices. |
| **Zoomverse** (one infinite spatial canvas, modes = zoom levels) | Spatial motion is the opposite of Notion-calm; easy to get lost; dense grid triage is awful on a pannable plane. |
| **Obsidian Workspace** (freeform stackable panes) | Makes the user their own information architect — fights calm-by-default and the premium-not-fiddly brief; mine the graph-as-navigator feature, not the shell. |
| **Everything-Is-A-Row** (session/proposal/gen all rendered as table rows) | Treating a latency-sensitive live PTY as "the body of a row" is a category stretch — clever-but-cold; running processes want persistence, not open-the-row-to-see-it. |
| **Reading Room** (one full-bleed note; everything summoned) | Optimizes knowing over doing so hard the live session becomes a dismissable sheet — fights terminal-as-truth; concurrency invisible at rest. |
| **Audit-First / Time-Is-The-Spine** (the journal timeline is home) | A feed is a poor surface for *browsing structured data* — inverts the locked CRUD-admin thesis (foregrounds the log over the database). |
| **Notion Peek** (Brain home, Work a summonable overlay) | Same flaw as Reading Room — demotes the live session exactly when attention is there; right only if users curate more than they drive. |
| **Quiet Split / Two-Modes-One-Seam** (keep ⌘K flip, float the gate above it) | The honest steelman of the locked spec — but it survives *only* by bolting a cross-mode ribbon on, i.e. admitting the seam must leak; #1 delivers the same calm with no flip and no two empty-states to maintain. |

*(Near-duplicates folded: the three-region "State-Morph / Stage+Wings / Obvious-Retool-Admin / Calm-Single-Pane / Two-Poles-One-Rail" candidates recurred in all five frames → merged into Survivor #1. "The Gate Is The Home / Receipt-Spine / Gate-Is-The-Spine" → #3. "Branch-Switcher / Split-by-Session" → #4.)*

---

## Recommendation

**Build Survivor #1 (Stage + Wings) as the Phase D baseline, and explicitly answer the open question: NO — Work and Brain should not be two top-level modes.** Across all five generation frames the modal ⌘K flip is the single weakest part of the locked spec, for one structural reason: **the review gate must be visible in both poles at once, and a hard mode-switch is the one IA that hides a proposal behind a flip.** The crossing is event-driven, not navigation-driven, so a mode taxes a transition the user didn't choose to make.

The poles are **real as a content distinction** (a dark, dense, keyboard-captured PTY genuinely wants a different surface than a calm, paginated, click-to-edit grid) but **fake as a navigation event**. So collapse the *switch* and keep the *contents*: one stable three-region frame, sessions and modules as sibling node-types in one nav tree, the stage and wing morphing by selection. This reuses everything Phase A–C shipped (proposal-returning DataProvider → the wing; FieldType registry → the form; ListContext → the grid), which makes it both the lowest-risk and the most coherent build.

Concretely, sequence it:
1. **Ship #1 (Stage + Wings)** with the persistent footer ribbon carrying liveness + pending count + `R`-to-review — that ribbon is the cheap version of the one non-negotiable (gate co-visibility).
2. **Graft #6 (Mission Control) as the opt-in "expand all sessions" roof** the moment real concurrency (multiple worktrees) lands — it's the escalation level, not the default floor.
3. **Prototype #2 (Tide)** as the higher-upside variant of #1 — same three regions, but session-liveness (a signal we already emit at branch-attach/squash-merge) drives the reshape instead of the user. If the auto-transition feels earned rather than jarring, it's strictly calmer than #1.
4. **Keep #3 (Receipt Spine) and #5 (Margin Notes) as conviction bets** to validate against telemetry: #3 if the product proves review-led (then promote the queue to the home spine), #5 if we want review to be a contextual annotation on the note rather than a separate queue.

The cross-cutting law for whichever shell wins: **the proposal queue lives *outside* whatever Work/Brain structure is chosen** — as a persistent ribbon (#1), a self-rising rail (#2), the home spine (#3), a per-session rail (#4), or an inline annotation (#5). If Phase D's `WorkbenchShell` gets exactly one thing right, it is that the gate does not belong to a mode.

## Open questions for the ce-brainstorm that follows

1. **The concurrency rule.** When N sessions are live, which one owns the stage in #1/#2 — most-recently-active, manually pinned, or always-split-on-second-session? This is the seam between #1 and #6; decide it before building the nav.
2. **The gate's resting form.** Footer ribbon (#1), auto-rising rail (#2), home spine (#3), or inline annotation (#5)? They're not mutually exclusive — could the ribbon be the *ambient* signal and an inline annotation the *contextual* review? What's the empty-queue (all-caught-up) state, and is it calm or anxious?
3. **Is the product review-led or session-led?** #3 bets the former, #4 the latter — they invert each other's defaults. Do we have (or can we instrument) telemetry on time-curating vs time-driving before committing the home surface?
4. **The terminal-vs-grid co-visibility gap.** #1's stage time-shares one space; when does referencing a note *while* reading the terminal actually happen, and is a slide-over peek (#2) enough, or do we need a real two-up? Quantify the cross-reference case before paying for split-pane.
5. **Annotation fallbacks (#5).** If we like the inline-gate idea, where do create-note proposals, new guardrail rules, and schema graduations live — they have no existing note to annotate. Does that fallback queue become the de-facto home anyway?
6. **The ⌘K contract.** Agreed it's the fast lane, not the IA — but what's in scope? Jump-to-node only, or jump + the four verbs (query/act/check/review) + approve/reject? Where's the line between palette-as-accelerator and palette-as-shell?
