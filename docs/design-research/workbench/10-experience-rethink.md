# Workbench Experience Rethink — IA & Surface Consolidation

> Companion to `09-taste-redesign-direction.md`. Where `09` fixes how the workbench *looks* (type scale, icons, elevation), this doc fixes how it's **structured** — the information architecture. Triggered by a hands-on critique (2026-06-30) after live-walking the shipped shell: the sidebar reads non-uniform, onboarding *snaps* into a dashboard, and that dashboard, a full-page search, and a graph view **duplicate or under-earn** their place. Grounded in fresh research: **Mobbin** (web, screen-cited) + a peer-agent / command-palette literature sweep (Hermes · Cursor · Replit · Warp · Zed · Devin · Copilot Workspace · Retool · Superhuman). This doc is for **agreement on the shape before building**.

---

## 1. The diagnosis (code-grounded)

Five problems, each traced to the actual component. The **bones are right** (nav · stage · wing · ribbon, the in-place data model from `09`/`05`) — the failure is **four surfaces competing to be "home," three of them duplicating each other.**

1. **The sidebar isn't uniform** (`shell/NavTree.tsx`). Three different row idioms and three icon sizes share one rail: `NavRow` (`h-10`, 14px, icon 14) · "Set up this Project" (a bare 12px `Text as="button"`, icon 12, no row chrome) · `SessionRow` (status dot icon 9). Section headers are 12px; sections are `gap-7` while rows are `gap-xs`. The rhythm is lumpy and the eye can't find a grid.

2. **"Enable" snaps to the dashboard** (`shell/WorkbenchShell.tsx`). The `Checklist` is a *full-stage* view; the instant `projectState` flips to `steady`, the stage hard-swaps to `<Overview>`. No transition, no persistence — setup vanishes mid-stride.

3. **The dashboard re-lists the sidebar** (`shell/overview/Overview.tsx`). Its two columns — **SESSIONS** ⇄ **THE BRAIN** — render the *same* data the sidebar already shows (`NavTree`'s SESSIONS + TABLES). Only the 5-stat health row + two quick-actions are non-duplicated. ~70 % of the home is a second copy of the nav.

4. **Search is a whole separate window** (`shell/search/Search.tsx`). It consumes the entire stage, while `⌘K` (`palette/palette-commands.ts`) *already* jumps to Sessions/Tables/Projects. Two search surfaces; the heavy one eats the canvas and only adds the *note-content* search ⌘K lacks.

5. **The graph view under-earns its slot** (`shell/graph/BrainGraph.tsx`). A decorative circular all-notes graph. zuzuu brains start near-empty, so it's blank or trivial almost always — yet it holds a top-level nav slot beside Search.

---

## 2. What the research says (Mobbin + peers converge)

The two streams agree so strongly the findings read as one. Three are *market consensus*, not taste:

- **No serious peer tool ships a dedicated home-dashboard page.** Devin, Warp, Zed, Replit all treat the **session/thread list as home**; if there's a "home," it's a *filtered view of active state* (pending reviews, running sessions, recent work), never a page that re-lists nav. The home/nav-redundancy antipattern is widespread in early workbench UIs and consistently gets cut. → kills problem #3. ([Mintlify home = greeting + preview + activity feed](https://mobbin.com/screens/f4b2afdf-dcc5-43fa-98f7-7449b420b889); [Cursor = "New Agent" + recent agents, faceted by tabs](https://mobbin.com/screens/9c12aefb-daa1-482a-bbe7-9eaff84f2967); [zed.dev/blog/parallel-agents](https://zed.dev/blog/parallel-agents); [Devin Spaces — cognition.com/blog](https://cognition.com/blog))

- **Every peer tool uses ⌘K as the primary entry; none has a separate full-page search.** Cursor, Linear, Replit, Copilot, Warp, Zed fold navigation + search + actions into one palette. Ranking = fuzzy + recency + context filter; **synonyms matter** (zuzuu says "approve," users type "merge" — both must match). → kills problem #4. ([Juicebox ⌘K = nav + resources + entities](https://mobbin.com/screens/84169c57-5cd6-4495-bb71-93d37266f4c4); [Vapi ⌘K](https://mobbin.com/screens/593d7acd-2e16-4365-bcd6-02ce52f48f3b); [StackAI](https://mobbin.com/screens/bbcc94bb-f535-4dca-8532-56b135fce5c3); [Superhuman palette framework](https://blog.superhuman.com/how-to-build-a-remarkable-command-palette/); [Retool context-pill scope](https://retool.com/blog/designing-the-command-palette))

- **Graph/relationship views are decorative in practice** — useful only as a *drill-down for a specific note/entity*, never a navigation mode. Copilot Workspace surfaced a dependency map only inside the *planning step*; the useful graphs are *purposeful* (typed edges), not force-directed wallpaper. → reframes problem #5. ([Jira dependency map — typed "blocks" edges](https://mobbin.com/screens/c2cbbf59-d38e-4764-b862-68d584be65b8); [Fibery schema relations](https://mobbin.com/screens/8d9b55e8-241c-417c-ad8d-647b89e58719); [Reflect "Map" — force-graph, but earns it with filters + only at scale](https://mobbin.com/screens/bcf9fd6e-05ba-4fef-ab8b-6a61d3b86d5d))

> **Caveat — test these against zuzuu's category, not just the peers'.** The three cuts above are drawn from coding-agent IDEs whose product *is* the live session; zuzuu's durable asset is the **gated note-brain**, and the session is ephemeral. Before acting on each "peers don't do X," check whether the pattern transfers given the peers have no notes corpus — and weigh at least one **PKM comparable** (Obsidian / Roam / Logseq), which *do* ship content search and graphs, alongside the coding-IDE set. Survivorship bias across product categories is the risk; the cuts may still be right, but they should rest on same-category evidence.

Two more, on the surfaces we *keep*:

- **The session list needs metadata density.** Warp is the only tool that solved the "flat list of unnamed sessions" problem: each row shows git branch + working dir + diff stats + agent status, with named collapsible **Tab Groups** and a cross-session **Notification Mailbox** (Complete / Request / Error). Every other tool's timestamp list rots by day 2. ([warp.dev/agents](https://www.warp.dev/agents), [Warp sidebar arch](https://deepwiki.com/warpdotdev/docs/3.4-windows-panes-tabs-and-sessions))

- **Onboarding should be a receding companion, not a swap.** [Apollo](https://mobbin.com/screens/70d69e07-588c-4c40-bca1-34a01ad05b21) ("Next steps for you" + an "Onboarding hub 35 %" pinned in the rail), [Vanta](https://mobbin.com/screens/d6c8a960-3253-4ca4-b4aa-06e902fa0e4e) ("Finish Starter Guide 15/20" pinned at the top), [Outseta](https://mobbin.com/screens/b1bcf27d-e787-4a4d-81f7-a1ec5515f5fe) (explicit "Remove Setup from the sidebar" graduation) all keep setup as a **dismissible progress affordance** that recedes — it never snaps away. → fixes problem #2.

---

## 3. The thesis

> **Sidebar = navigation. ⌘K = search + jump + act. Home = "what happened / what needs me." Contextual lenses (graph, changes) live inside the thing they describe.** Setup is a companion that recedes, not a screen that swaps.

Collapse four competing "homes" into one clear role each. Nothing in the body should duplicate the rail.

---

## 4. The rethink, surface by surface

### 4.1 Sidebar — one row primitive, grouped IA
- **The fix (now): one `NavRow`** for *every* entry (session, table, project-nav): one height, one icon size, one type size, one selected/hover treatment. Retire the bespoke "Set up this Project" styling. This closes problem #1. (Model: [Vapi's grouped rail — `BUILD / TEST / OBSERVE`](https://mobbin.com/screens/96cc6786-d268-4b44-be65-3e8b97280d3c).)
- **Deferred (a separate pass, beyond the uniformity fix): denser session rows** (Warp — title + a live/branch/diff sub-line + status dot) and **named collapsible Tab Groups**. These need git branch/diff data the daemon doesn't currently serve (`SessionInfo` carries no branch/diff fields; that read surface was pruned in the 2026-06-22 squeeze), so they're gated on concurrency becoming common (see §6 Q4) — not part of the uniformity fix.
- Keep the three sections (`SESSIONS · TABLES · PROJECT`), uniform header + spacing tokens. `PROJECT` **loses Search** (→ ⌘K) and **loses Graph** (→ contextual), leaving **Settings** as the only item — so drop the one-item section header and pin Settings to a fixed footer slot in the rail rather than carrying a section for it.

### 4.2 Home — replace the nav-mirror (structure deferred)
> The home's *structure* is **deferred** pending a decision (scope-to-removal-now vs build-the-stream — see Deferred / Open Questions). What's **settled**: the home stops re-listing sessions+tables (problem #3). Two guardrails hold regardless of which home ships:
> - **Retain the brain-health summary** (broken links · orphans · stale — the `check` verb). It's the *one* non-duplicated thing the current dashboard shows, and brain integrity is what keeps the gated brain trustworthy — whatever replaces the nav-mirror must keep it.
> - Canonical term: **"review stream"** (zuzuu's equivalent of Warp's "notification mailbox") — used consistently in this doc.

The candidate home, pending the decision: a slim identity strip (emoji · name · path · protected/enabled) · the **review stream** (proposals the loop staged, what you approved/rejected, what each session changed) · the brain-health summary · one primary CTA. This is the Mintlify/Apollo "activity + next-steps" shape — and matches the peer consensus that *the work surface, not a dashboard, is home* (tested against zuzuu's category per §2's caveat). The stream's build details (empty-state, item anatomy, layout, the daemon read routes it needs) are deferred with the structure decision. (See §6, open question 1: does "Overview" remain a destination at all?)

### 4.3 Search — fold into ⌘K, but keep a results view
Add a **Notes (content)** group to the existing palette (it already groups Navigate/Actions/Sessions/Tables); `search-notes.ts` is reusable as the content matcher. Specify the states so implementers don't diverge:
- **Ranking / "Top result":** Actions+Navigate rank above Notes-content for command-like queries (single token matching a synonym — `approve`≈`merge`, `table`≈`module`); Notes-content promotes for multi-token queries with no command match. Synonyms apply to commands/Navigate, not to content matching.
- **No-results:** the Notes group shows "No notes matching *[query]*" with a fallback action (e.g. *Create a note named [query]*) — never a silent empty group.
- **Don't delete content-discovery.** ⌘K is a *jump-to-known-target* launcher; browsing/scanning the brain is a distinct content-*discovery* use case that matters for a notes corpus (it's a core read of the asset, not peer-style file search). Keep a **"see all results" affordance** from ⌘K that expands into a canvas results view rather than deleting the `Search.tsx` surface outright (high reversal cost). Wire the ⌘K content matcher **before** removing the page, or content search regresses to zero in between.

### 4.4 Graph — demote to a contextual lens (recommended)
**The fix (now):** drop the top-level **Graph** nav slot and keep the existing per-module `Table · Graph` tab — connections matter *about a module*, not as a global wallpaper.
**Deferred:** a per-note "show connections" lens (a note's `[[links]]` neighborhood) — net-new beyond the demotion, and its entry-point + empty-state need their own design pass; don't bundle it into the demotion.
**On the evidence:** the "blank/decorative almost always" read is partly an artifact of the *empty-brain bootstrap* state, and the right comparable for a typed `[[links]]` note-graph is the **PKM category** (Obsidian / Roam / Reflect — where the graph is a genuine sense-making mode), not coding-IDE dependency maps. So this is a *recommendation*, not a settled cut — §6 Q3 carries the actual decision, phrased neutrally.

### 4.5 Onboarding — a receding companion + a guided segue
- Setup renders as a **`Setup n/3` progress item pinned in the sidebar** (Vanta/Apollo) plus an in-home "next steps" block — not a full-stage takeover. The three rungs are **(1) `git-init` · (2) `init` (create the `.zuzuu/` brain) · (3) `enable` (install the host hook)** — the `Setup 1/3 … 3/3` labels are user-visible copy.
- The Setup item is **pinned until complete** (not user-dismissible mid-way): it auto-shows whenever project state ≠ `steady`, so there's no orphaned incomplete-setup state and no separate re-entry path to design. (Outseta's "remove from sidebar" graduation applies *after* completion, not before.)
- Completing the last rung (`enable`) **doesn't swap to a dashboard**; it collapses the block to a checkmark and *reveals the next action in place* — "start your first session" — so the user flows from setup → work without a jarring cut. The U3 consent gate (just shipped) stays; only its *container* changes from full-stage to companion.

---

## 5. Hermes & peers — concept borrows (beyond layout)

- **Hermes "skill documents"** (NousResearch, 2026): after 5+ tool calls the agent auto-writes a reusable Markdown skill (approach + edge cases + domain knowledge) that future runs load instead of re-reasoning — **structurally identical to zuzuu's note/module**, with `SOUL.md` ≈ the instructions module. A peer validating the exact thesis. *Borrow the surfacing:* present a graduated note as a legible "skill the agent learned," not a database row. ([hermes-agent.nousresearch.com](https://hermes-agent.nousresearch.com/) · [docs](https://hermes-agent.nousresearch.com/docs/))
- **Review queue as Kanban** (Replit Agent 4 — Drafts→Active→Ready→Done, each with a written plan, review-before-merge): more scannable than a linear proposal list; status becomes spatial. Maps 1:1 onto observe→stage→review→evolve. ([replit.com/agent4](https://replit.com/agent4) · [task system](https://docs.replit.com/core-concepts/agent/task-system))
- **Notification mailbox as async review triage** (Warp): aggregate per-session events (Complete / Request / Error) into one inbox — separates *knowing something needs you* from *reviewing it*. The home's review stream (4.2) is this inbox.
- **Spec→Plan as the human gate** (Copilot Workspace): a "what does done look like" spec the human edits *before* the plan — a natural articulation of zuzuu's gate. ([githubnext.com/copilot-workspace](https://githubnext.com/projects/copilot-workspace/))
- **Agent nav left, project/git right** (Zed parallel-agents): puts the agent conversation front-and-center. ([zed.dev/blog/parallel-agents](https://zed.dev/blog/parallel-agents))

> **Scope note.** Of the five borrows above, only the **Warp mailbox** (folds into the home, §4.2) and **Replit Kanban** (the review-queue question, §6 Q2) trace to the five problems in §1. The other three — **Hermes skill-surfacing**, **Copilot Spec→Plan**, and **Zed agent-left layout** — are **out of scope for this work item** and tracked separately: they're inspiration, not requirements (in a "for-agreement" doc, an un-rejected borrow reads as approved scope). In particular the **Zed agent-left split contradicts the §1 "bones are right" premise** — adopting it reopens the shell structure this doc assumes is settled, so it belongs in Open Questions, not as a borrow.

---

## 6. Open questions (decide before building)

1. **Does "Overview" survive as a destination, or does empty-selection land on the review inbox?** (Peer consensus leans: no separate dashboard.)
2. **Review queue: Kanban vs the current overlay/wing list?** Kanban is more scannable but heavier; the gate is the moat — does spatial status help or distract?
3. **Whole-brain graph: invest at scale, or cut?** §4.4 *recommends* demoting it to a per-module/contextual lens. Open: does the typed `[[links]]` graph earn a (filtered) whole-brain view once a brain is large — judged against **PKM comparables** (Obsidian/Roam/Reflect), not coding-IDE dependency maps — or is it cut entirely? (Phrased neutrally so the "decorative" framing doesn't pre-decide it.)
4. **Session grouping (Warp Tab Groups): needed now, or only once concurrency is common?**
5. **⌘K content search: client-side over loaded notes (today's `search-notes.ts`) vs a daemon FTS endpoint** (`index.mjs` already has FTS5) — the latter scales, the former ships sooner.

---

## 7. Sequencing (if approved)

Interlocking, so land in this order: **(1)** sidebar uniformity (`NavRow` unification — isolated, low-risk) → **(2)** fold Search into ⌘K + delete the page → **(3)** demote Graph to contextual → **(4)** rebuild Home as the review/activity stream → **(5)** onboarding companion + guided segue. Each is independently shippable; record per-surface decisions in `docs/LOG.md`.

> Evidence base: this doc's Mobbin screens + the peer sweep are the *why*; `09-taste-redesign-direction.md` is the visual layer that rides on top. Generated 2026-06-30.

---

## Deferred / Open Questions

### From 2026-06-30 review (ce-doc-review)

Deferred for resolution at plan time:

- **[P0] §4.2 — The activity-stream home: scope-to-removal-now vs build-the-stream.** scope-guardian / feasibility / design-lens: §4.2 expands beyond "remove the redundant columns" into a net-new stream with no backing daemon route (the decision-history + per-session-diff read surface was pruned), so §7 step 4 is *not* independently shippable. product-lens: the stream is the one surface that voices the gated-brain moat — don't bury or cut it. **Decide:** (a) scope §4.2 to duplication-removal now + defer the stream to its own backend-gated work item, or (b) commit to the stream as the moat surface and pull it earlier, accepting it needs new daemon read routes (over `log.mjs`) first.
  - *Dependents (resolve with the above):* the stream's empty/first-run state; its item anatomy across the three item types; its layout (Kanban vs chronological feed — §6 Q2); and the daemon read routes it requires.
- **[P1] §4.2 — Home primary-CTA switching rule** ("Review N" when N>0 staged proposals, else "Start a session") — rides with the home-structure decision above.
