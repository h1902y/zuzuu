# Workbench Shell ("Stage + Wings") — requirements

**Date:** 2026-06-25
**Origin:** `docs/ideation/2026-06-25-workbench-shell-ia.md` (Survivor #1, recommended)
**Status:** decided — ready for `ce-plan` to revise Phase D
**Type:** Deep feature (replaces the locked spec's *two-world shell*, within the already-locked CRUD-admin reframe)

## Summary

The workbench shell is **one fixed three-region frame — `nav · stage · wing` + a persistent
footer ribbon — with no top-level modes.** Sessions and modules are *siblings in one nav tree*;
only the **stage** (center) and **wing** (right) morph by selection. The review gate lives **outside
any mode** (ambient ribbon + inline-on-note + a dedicated cross-session queue). This replaces the
locked two-world `Work ⇄ Brain` ⌘K switch (`docs/design-research/workbench/05-experience-spec.md`),
which the ideation found structurally flawed: the gate is the *seam* between the poles, so a hard
mode-switch is the one IA that hides a proposal behind a flip. The poles are real as a *content*
distinction, fake as a *navigation event*.

## Problem & context

Phase A–C shipped the engine (the proposal-returning **DataProvider**, the **FieldType registry**,
the **ListContext** pull-model, the token design system + copy-owned kit, the ported `term/`
engine) but **not the shell**. The locked spec assumed `Work ⇄ Brain` as two ⌘K-flipped modes.
The ideation's convergent finding (all five frames): users cross the Work/Brain line **because of an
event** (a proposal lands, a guardrail fires), not a navigation intent — so any IA that taxes the
crossing with a mode-switch is mispriced; and the **review gate cannot belong to a mode** (Work
produces proposals, Brain consumes them — it is the literal seam). This doc resolves the six open
questions the ideation left into product decisions.

## The decided shell

### Regions (fixed; never rearrange — only contents change)

```
┌─────────────────────────────────────────────────────────────┐
│ ⌘K        cards-game › knowledge › auth.session              │  breadcrumb = your one location
├──────┬──────────────────────────────────┬───────────────────┤
│ NAV  │  STAGE (one actor, by selection) │ WING (context)    │
│ sess │   session → live terminal (PTY)  │  session → review │
│ ·s1● │   module  → grid (rows×columns)  │   queue + turn    │
│ ·s2○ │   row     → record (read · ✎)    │  note → form +    │
│ modl │   graph   → ER canvas            │   relations/links │
│ ·kn▣ │                                  │  module → schema  │
│ ·in◇ │   default home = the database    │   + generations   │
├──────┴──────────────────────────────────┴───────────────────┤
│ ● zz/auth-fix live · ◷ 2 pending           press R to review │  ← always-on ribbon
└─────────────────────────────────────────────────────────────┘
```

### R1 — One fixed three-region frame, no modes
`nav · stage · wing` + footer ribbon. There is **no top-level Work/Brain switch.** Nothing
rearranges on navigation; only the stage and wing *contents* change. The breadcrumb names the one
current location.

### R2 — Nav: one tree, sessions + modules as siblings
A single nav tree whose top-level node-types are **sessions** and **modules** (siblings, not
modes), plus an **ER-graph** node. Sessions render liveness (`●` live · `○` idle); concurrent live
sessions appear as dots. Modules render type (`▣` typed table · `◇` schemaless cards); **saved
views** nest under a table. Affordances: `+ new session`, `+ new table`.

### R3 — Stage morphs by selection; the database is home
The center stage shows exactly one actor, by the selected nav node:
- **session →** the live terminal (the ported `term/` PTY; *terminal-is-the-transcript*, composer = input-only).
- **module →** the grid (TanStack Table over the DataProvider; FieldType cells; the filter-chip bar drives ListContext).
- **row →** the record (a read view; `✎` opens the FieldType form).
- **graph →** the ER canvas (relations across tables).

**Default home = the database** (the modules overview or the last-viewed table) — *brain-led*. It is
the locked CRUD-admin hero and the calmest resting state (the common case is 0–1 pending). The gate
stays co-visible via the ribbon regardless; a pending count pulls the user to review.

### R4 — Wing morphs by context; retracts when idle
The right wing shows context for the current selection:
- **session →** the live review queue for that session + a turn summary.
- **note/row →** the FieldType form (edit) + relations + a backlinks panel.
- **module →** schema (`fields`) + generations.

Wings dim/retract when there's nothing contextual ("detail in a rail").

### R5 — The gate is outside any mode (hybrid: ambient + contextual + catch-all)
The review gate — *the moat* — is never owned by a region. Three co-present forms:
1. **Ambient — the footer ribbon (always on):** session liveness + pending-proposal count +
   `R`-to-review. The empty state is a quiet **"✓ all caught up"** (calm, never an anxious inbox).
2. **Contextual — inline-on-note:** a pending change appears as an annotation **on the note/row it
   would modify** (review-as-reading; lowest context-fetch), surfaced in the record stage/wing.
3. **Catch-all — a dedicated queue:** the cross-session review surface for proposals that have **no
   note to anchor to** (create · new guardrail · schema graduation), reachable via `R` / the ribbon.
   Cross-session, groupable by module or session.

Approve = a clean yes/no → `evolve` (the write lands). Reject = a **reason chip** → teaches (the
loop refines; per the locked gate-that-teaches model). The dedicated queue is the **buildable floor**;
inline-on-note is a **fast-follow**.

### R6 — Concurrency: single stage, Mission Control as the roof
The **most-recently-active** live session owns the single stage; other live sessions are **dots** in
the nav (click to switch). **Mission Control** — an opt-in "expand all" overview (⌘K / a button)
showing all live sessions + a **cross-session batch queue** — is the *escalation roof*, unlocked
when real concurrency (multiple worktrees) is in play. It is **not** the default floor.

### R7 — Co-visibility: slide-over "peek the brain"
While in a live session, the user can summon a note or table as a **non-destructive slide-over** over
the stage, then dismiss to return to the stream. A **manual pinned two-up** (terminal + grid side by
side) is a **deferred** power option, gated on telemetry showing heavy cross-referencing.

### R8 — ⌘K: the fast lane, not the shell
The palette does **jump-to-node** (session / table / note / graph) **+ key actions** (the verbs
`query`/`act`/`check`, `approve`/`reject`, `new session`). It is an accelerator over the UI — **not**
a full inline command surface, and never the foundation (the ideation rejected palette-as-shell).

### R9 — Reuse what's built; honor the visual language
The shell composes the shipped layers directly: the **DataProvider** (proposal-returning writes →
the wing/queue), the **FieldType registry** (grid cells + the form), **ListContext** (the grid's
filter/sort/pagination), the **token design system + copy-owned kit** (zero inline styling), and the
**ported `term/` engine** (untouched). Visual language: **Notion-calm** — color only for state, calm
by default, detail in a rail, receipts not logs.

### R10 — Invariants (do not violate)
The workbench is a **CRUD-admin over the Project-as-database** (module = table, note = row,
frontmatter = columns, relations = FKs) — **not an IDE**. **Writes resolve to a pending proposal**
(the gate is the moat). **Terminal-is-the-transcript** — we wrap the host, never drive it. **A
session ≡ a git branch** (+ worktrees for concurrency).

## Success criteria

- A user can **browse the database → open a record → edit it (→ a pending proposal) → triage it**
  without ever flipping a mode.
- A pending or just-landed proposal is **never hidden behind a navigation action** — the ribbon +
  inline + queue keep the gate co-visible from anywhere.
- The terminal still attaches and streams (the ported `term/` is unchanged; the e2e flow-control
  test still passes).
- A single live session with 0–1 pending **feels calm** (no overview overkill); N concurrent sessions
  scale via Mission Control, not by complicating the default.
- The shell carries **zero inline styles** (the design-system guard passes over `shell/`).

## Scope boundaries

### Deferred to follow-up
- **Inline-on-note annotations** (R5.2) — the dedicated queue is the floor; annotations are a fast-follow.
- **Mission Control** (R6) — built when real concurrency lands.
- **The manual two-up split** (R7) — gated on a demonstrated cross-reference need.
- **The ER graph + audit surfaces** — separate stage actors, their own build slice.
- **Schema-graduation promote/split UI**, **saved-views power features** — later.

### Out of scope (this product phase)
- The cloud/SaaS skin; re-deciding the CRUD-admin reframe (locked); driving the host; the parked
  terminal-vs-parsed-receipts treatment.

## Phase D impact (for `ce-plan` to revise)

The plan's Phase D units change shape (was a two-world ⌘K shell):
- **U12 `WorkbenchShell`** — **the biggest change.** Replace the two-world ⌘K switch with the fixed
  three-region frame (`nav · stage · wing`) + the footer ribbon; one nav tree (sessions + modules as
  siblings); the stage/wing **morph rules** (R3/R4); ⌘K = jump + actions (R8); concurrency = single
  stage + dots (R6, Mission Control deferred).
- **U13 grid** — essentially unchanged (the stage's *module* actor); wire to ListContext + FieldType.
- **U14 record** — the stage's *row* actor (read · `✎` → form) + the wing form; inline-on-note is the
  fast-follow.
- **U15 review queue** — the **dedicated cross-session queue** (catch-all) + the **ribbon** as the
  ambient entry; approve/reject as decided (R5).
- **New units:** the **footer ribbon**, the **nav tree** (sessions + modules), the **slide-over
  peek**. (Mission Control + inline-on-note become explicit deferred units.)

## Outstanding questions (for `ce-plan` / build time)

- Exact slide-over geometry for "peek the brain" (width, dismiss interaction) — implementation detail.
- The ribbon's bandwidth ceiling: it carries a count + liveness well; does a *streaming* signal (e.g.
  a diff landing) need more than a count, or does that escalate to the wing? (Resolve when wiring R5.)
- Mission Control's trigger threshold (≥2 live sessions? manual only?) — decide when the deferred unit is picked up.
