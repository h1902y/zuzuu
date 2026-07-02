# Live experience audit — the full lifecycle in Chrome (02-07-2026, evening)

> Provenance: a real browser walkthrough of the workbench (branch
> `feat/personal-app-roadmap`, post map-first/C-commits build) driven via Chrome
> automation: launcher → onboarding on a fresh scratch project (`ux-audit`) →
> module/schema → notes on both lanes → review gate → the World → the root-mode
> vault. Findings only — no code changed. Screenshots were live; a11y-tree probes
> used where noted. Companion: `2026-07-02-{backend,frontend-merge,product-thesis}-audit.md`.

## Verdict up front

The **middle** of the lifecycle is genuinely excellent — onboarding is the best
consent flow I've seen in a local dev tool, the schema-aware table + form wing
feel like a real product, and the ghost-node review loop (stage → pulsing ghost
in the island → `R` → approve/reject → dissolve, all live over the brain push)
is the thesis made visible. But the **map-first frame around it is defeated by
project-state gating**: on any project that has never run an agent session —
including the flagship root-mode vault, which reads as `no-project` — the World
never becomes the home stage. Today the map-first experience is only reachable
through a module's Graph tab. Map-first is better than table-first *when you can
see it*; right now most users won't.

## Journey findings

### 1. Launcher (⭐ delight)
- Clean project list: emoji · path · note/table counts · pending-review badge ·
  recency, 4 sort modes, search. "open" marker on the live project.
- Rough: the review-count badge is an unlabeled clock icon (zuzuu shows "209" —
  generations? proposals? no tooltip). Note-count inconsistency: personal shows
  277 in one boot and 289 in the next (`.zuzuu/instructions` counted only
  sometimes).
- Rough: a freshly opened project didn't appear in Recents until the next boot.
- Broken-ish: booting the daemon rooted at a project still lands on the
  launcher, not that project's workbench.

### 2. Onboarding (⭐⭐ the best surface in the product)
- Manual-path entry worked instantly; git rung auto-detected as done.
- Consent cards are exemplary: "I'll create the Project home: an empty brain
  plus the enforced guardrail safety floor… **I never pre-fill it**" / "This
  edits your host's config (like .claude/settings.json)… every brain change
  still waits for your approval." A stranger knows exactly what happens and why.
- Three rungs took ~20 seconds; shield flipped to "protected"; host pickers
  (Claude Code · Codex · Gemini CLI · OpenCode · pi) + plain shell.
- Rough: the "Map" nav row is present and highlighted during onboarding while
  showing the checklist — a labeled map that isn't a map.

### 3. Module creation (gap)
- **No UI path to create a module/table.** Not in the nav (TABLES has no "+"),
  not in the ⌘K palette, not on Overview. The daemon route (`POST /module/new`)
  and the guided-flow code exist but nothing surfaces them. CLI (`zz module new`)
  was required.
- The nav DID gain `Instructions` live (brain push) after init — and `Crm`
  appeared live after a daemon restart (see finding 7 on the stale-socket case).

### 4. Notes, both lanes
- **Operator lane (CLI → UI, ⭐)**: `zz note create` rows appeared with schema
  labels ("Company") and the `tier` default applied; **CSV import of 3 rows
  popped into the open World live** — new nodes materialized in the island
  without any UI action, and a fifth generation appeared in the wing in
  real time. This is "watch it build," working.
- **UI lane ("New note", broken end-to-end on a schema'd module)**: the button
  stages `{title: "Untitled note", body: ""}` blind — no form, no type, no
  required columns. On a module with `company required` the proposal **can never
  be approved**: the gate correctly refuses it, and the UI shows only
  **"Couldn't approve"** — the CLI's precise reason (`missing required field:
  type; field 'company' is required`) is swallowed. User is stuck with a
  poison proposal unless they reject their own note.
- The record/form wing is excellent: schema labels, typed inputs, "Saves resolve
  to a pending proposal — review to land it" consequence copy.

### 5. Review gate (⭐ works, one copy bug, one error-path bug)
- Staging a note put a badge on the table row, "1 pending · press R to review"
  in the footer, and a **dashed pulsing ghost with its label inside the island**
  — the moat, rendered, live.
- `R` opens the gate OVER the map: keyboard hints (j/k · a · d), diff preview
  ("WILL ADD + Untitled note"), Approve/Reject; Reject asks for a REASON via
  chips (duplicate/wrong/scope/granular/premature/reword) — the recorded
  one-at-a-time ceremony, real.
- Rejecting dissolved the ghost and landed on "All caught up — 2 reviewed this
  round" (calm, finishable ✓) — but the count said 2 when only 1 existed (the
  failed approve seems to count), and the overlay stayed pinned until the next
  interaction.
- Copy bug: a UI-created note claims "Recurring signal across 1 session" — it
  never came from a session.

### 6. The World
- **Via the module Graph tab it is beautiful and correct**: dotted boundary
  ring, constellation chip, labeled amber nodes, position-preserving updates,
  ghost + dissolve verified live, node-click opens the record wing with
  breadcrumbs.
- **P0 — the map-first home never renders.** Steady state (`project-state:
  steady`, host enabled, 2 modules) landed on an **empty black stage** — no
  `.zz-world` in the DOM, no "loading the map…", no error. Mechanism found
  during the walkthrough: `project-state` flaps back to onboarding (the
  session rung — `sessions: 0`) and `sel.stage === "world" && !onboarding`
  falls through to the Overview; in one state it rendered an entirely empty
  stage. Consequence: **the World-as-home, map-first note reading (stage swaps
  away on node click), and find→fly-to are all defeated on any project that
  has never run an agent session.**
- **P0 sibling — the root-mode vault reads as `no-project`** (`modules: 0`):
  `project-state.ts`/`project-health.ts` count modules under `.zuzuu/` only.
  The flagship 289-note vault is offered "Create the brain (.zuzuu/)" — a
  scaffold-over-a-rich-project confusion — and its 6 discovered tables
  notwithstanding, the map is unreachable and "not enabled" shows forever.
- Palette: fuzzy find lists notes nicely, but Enter on a typed query selected
  the first (Navigate) item, not the matched note; the flight never happened
  (and would have been eaten by the onboarding flap anyway). `>` world commands
  and `/` conversation not fully exercised (no live agent session risked in the
  audit); `/`'s routing surface exists.

### 7. Live updates (brain push)
- Working: CSV import → nodes appear in the open World; generation list updates;
  nav table list updates on daemon-fresh sockets.
- Broken (stale socket): with the daemon rooted at project A, switching the
  workspace to project B leaves the /ws/zuzuu socket watching A — CLI writes to
  B never push (observed: crm creation invisible until reload; reproduced the
  general shape; brain-events.ts connects once and never reconnects on
  workspace switch).
- The long-lived daemon serves the boot-time client bundle; after a rebuild the
  old daemon kept serving the pre-C app (no World code at all) — confusing
  during upgrades (the cleanse commit's bin-note covers the CLI entry, but the
  daemon needs the same story).

### 8. Console
- **Zero console errors or exceptions across the entire session.** Every failure
  above is silent state logic, not a crash.

## Top-10 ranked improvements

1. **Make the World actually be the home** (P0): fix the project-state flap —
   "steady" must not require a first agent session, or the world branch must
   not be gated on `!onboarding` (compose the checklist NEXT TO the map, as U5
   composes it into Overview). Acceptance: fresh 2-table project lands on its
   archipelago.
2. **Recognize root-mode in project-state/health** (P0): the vault must read as
   initialized (modules at root), never be offered "Create the brain," and reach
   the map. (The peek/overview fix from `e8ae459` shows the pattern; apply to
   `project-state.ts:55` + `project-health.ts:32`.)
3. **"New note" must be schema-aware** — open the form wing FIRST (typed fields,
   required markers, type picker) and stage on save; never stage an
   unapprovable proposal.
4. **Surface the gate's reason on approve failure** — the CLI already says
   exactly what's wrong; show it in the toast/queue card instead of "Couldn't
   approve."
5. **Reconnect /ws/zuzuu (and refetch) on workspace switch** — the push channel
   must follow the root or live updates silently die after a project switch.
6. **Add module creation to the UI** — a "+ new table" row under TABLES and a
   palette action, wired to the existing `POST /module/new` + guided flow.
7. **Palette Enter should prefer the best note match** for a non-empty query
   (Navigate items below results), and fly the map.
8. **Boot-into-project**: `zz web` from a project dir should open that
   workspace, not the launcher.
9. **Truthful small copy**: review badge tooltip; "Recurring signal across N
   sessions" only for observed proposals; "All caught up" count = real
   decisions; auto-dismiss the caught-up overlay.
10. **Daemon/bundle staleness**: version-stamp the client and show a "workbench
    updated — reload" nudge (or restart hint) when dist changes under a running
    daemon.

## What already delights (keep)

Consent-first onboarding copy · the schema'd Grid with labels/defaults ·
generations wing with rollback one click away · the ghost/review loop over the
map with keyboard triage and reject-reasons · CSV import materializing in the
World live · zero-crash stability throughout.
