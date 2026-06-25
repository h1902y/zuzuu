---
date: 2026-06-25
topic: workbench-project-layer
status: ready-for-planning
origin: docs/ideation/2026-06-25-workbench-project-layer.md
---

# Workbench Project Layer — Requirements (Onboarding + Switching)

## Summary

The "Project layer" is the surface *above* the in-Project Stage+Wings shell: it turns an
un-initialized folder into a working Project (onboarding) and lets the workbench move between
Projects (switching). Both live as **three states of the Project's own home surface** — its
empty state is the onboarding checklist, its title is the switcher, its steady body is the
module-cards home — so the layer adds **no new top-level mode or surface**. Switching hops the
browser between per-Project daemons over the recents/instances data `~/.webcode/` already keeps;
onboarding fires the real idempotent `zz` verbs as visible, explicit buttons.

## Problem Frame

Pointing the daemon at a folder lands on a dead-end empty state (`no modules yet — run zz init`)
— a CLI instruction with no affordance. Two gaps sit behind it:

1. **No onboarding.** A new user has no guided path from "this folder isn't a zuzuu Project" →
   initialized → enabled → first session → first review. The daemon can't even perform setup: it
   exposes neither `init`, `enable`, nor `observe` (only approve/reject + module enable/disable/new).
2. **No switching.** The workbench is bolted to one workspace (the daemon's launch root). There is
   no way to move between Projects, despite `~/.webcode/` already tracking recents + running daemons.

The shell-IA work locked a "one frame, no modes" law (`docs/ideation/2026-06-25-workbench-shell-ia.md`).
The risk is bolting two new top-level surfaces onto that frame. This layer must instead express both
as states of the home surface, preserving the law.

## Requirements

### A. The home-envelope state machine

- **R1.** The home surface (selected root, the `⌂` node) renders **one of a fixed set of states** derived
  from the Project's true on-disk condition — not a separate route or mode per state. The states:
  | State | Condition | Home renders |
  |---|---|---|
  | `not-a-repo` | folder is not a git repository | "not a Project yet" + a git-init step (R6) |
  | `no-project` | git repo, no `.zuzuu/` | the onboarding checklist starting at Initialize |
  | `hooks-off` | `.zuzuu/` exists, host hooks not enabled | the checklist with Initialize ✓, Enable current |
  | `no-activity` | enabled, no sessions/proposals yet | the checklist with a "start a session" nudge |
  | `steady` | has content modules / activity | the module-cards home (built) |
- **R2.** State is **observed, never asserted by the client** — the daemon reports the current state from
  the filesystem (git presence, `.zuzuu/` presence, host-hook presence, module/activity counts). Re-running
  any setup verb is safe (the verbs are idempotent), so the home always reflects real state.
- **R3.** Transitions are driven by **completing the real action**, not by client-side wizard advancement;
  each completed step collapses to a **✓ receipt** (a one-line record of what happened), and when the Project
  reaches `steady` the checklist **fades to the module-cards home**.

### B. The onboarding journey

- **R4.** Onboarding is an **in-canvas calm checklist** of the real verbs as buttons, in order:
  ① **Initialize** (`zz init`) · ② **Enable your agent** (`zz enable`, host auto-detected) ·
  ③ **Start a session** · ④ **Review your first proposal**. Each rung shows a one-line "why";
  done/current/upcoming are distinguished by state only (Notion-calm — color for state, not decoration).
- **R5.** Onboarding is reachable as a **transient `⚑ Set up this Project` node** in the nav tree (a sibling
  of sessions/modules, consistent with the one-tree law) that **disappears once the Project is `steady`**.
  When the home is in any non-`steady` state on load, the home auto-presents the checklist (no extra click).
- **R6.** When the folder is `not-a-repo`, the first rung is an **explicit, user-confirmed `git init`**
  (a real filesystem mutation — never automatic), gating Initialize, because `zz init` never runs `git init`
  and a session is a git branch.
- **R7.** Setup steps are **always explicit and visible** — never silently run on the user's behalf. The
  product's "watch and propose" loop is **taught by doing**: rung ④ completes when the **first real proposal
  card arrives** at the review gate and the user makes the first yes/no. No wizard explains the loop.
- **R8.** The **footer ribbon carries the single most-relevant steady-state nudge** (e.g. `○ hooks off · press E to enable`)
  so onboarding state is ambient after the checklist fades, without re-surfacing the full checklist. The
  checklist (home), the `⚑` node (nav), and the ribbon nudge (footer) show the **same state once each** — no
  double-surfacing of the same prompt.

### C. The switcher

- **R9.** The home **title `⌂ <project name>` is the switcher trigger** — clicking it opens a popover; `⌘O`
  opens the same popover from the keyboard. "Currently open" is indicated by the **title alone** (no badge),
  matching single-window tools.
- **R10.** The popover lists **recent Projects** (from `config.json.recent`) reconciled with **running daemons**
  (from `instances/<sha16>.json`): each row shows the Project name/path, a **running vs idle** indicator, and —
  when running — light health (live sessions / pending count). A recent that is running and one that is idle are
  visibly distinct.
- **R11.** Selecting a **running** Project navigates the browser to that daemon's URL (`:port/?token=` from its
  instance file). Selecting an **idle** recent first **launches** its daemon (R13), then navigates.
- **R12.** The popover has an **"Open a folder…"** affordance: a **path text input with server-side directory
  autocomplete** (the daemon completes directory names under the typed prefix). On submit, the daemon validates
  the path is an existing directory, then launches + navigates (R11). No native OS picker.

### D. The daemon route contract (net-new)

These are the new capabilities the daemon must expose. All brain mutations continue to shell the `zz` CLI
(`web/src/server/zuzuu-cli.ts`) — the daemon never imports the loop. Exact shapes are ce-plan's job; the
**contract** is:

- **R13. Launcher** — given a validated directory, start a daemon for it (reusing the existing singleton /
  instance-file logic so it **never double-spawns** a Project that's already running), wait for its instance
  file, and return its URL. This is the one route that spawns processes.
- **R14. Setup writes** — `init`, `enable`, and `observe` routes that shell the corresponding `zz` verbs against
  the daemon's root. `init` writes `.zuzuu/`; `enable` edits the host's settings (e.g. `.claude/settings.json`).
  Both are idempotent and host-respecting (never clobber user hooks).
- **R15. Project-state read** — a route reporting the home-envelope state (R1) + host detection for the Enable
  rung (which host, whether already enabled).
- **R16. Projects-list read** — a route returning recents reconciled with running instances (R10). Because the
  `~/.webcode/` files are global, any running daemon can serve this list.
- **R17. Directory autocomplete read** — a guarded, **names-only** directory-listing route for R12 (returns child
  directory names under a prefix; never file contents). This necessarily browses **outside any Project's
  safe-path jail**, so it is its own narrowly-scoped, read-only surface.

### E. Architecture

- **R18.** v1 switching is **browser-hops between per-Project daemons + the launcher route (R13)**. The daemon
  stays **one-root-at-boot** (no mutable/swappable root). Each Project is fully isolated (own PTYs, own
  safe-path jail, own token).
- **R19.** The **hub/broker** path (one stable URL proxying per-Project daemons — the shape `web/cloud/broker`
  already implements) is the **cloud-era upgrade**, deferred. The switcher contract (R9–R12) must be designed so
  swapping the runtime underneath it (hops → hub) **does not change the picker's UX** — the migration is a
  runtime swap behind the same surface.

## Key Decisions

- **D1. One surface, three states (the home envelope).** Onboarding and switching are the empty-state and the
  title-affordance of the Project's own home, not new surfaces — preserving the shell's no-modes law and giving
  the layer a single object to spec. *(Origin ideation #1.)*
- **D2. Browser-hops over a hub for v1.** Reuses the entire existing per-workspace architecture and ships now,
  with full isolation; the hub is the cloud-forward upgrade behind the same picker (D-rationale: it is the same
  shape as the already-built local broker, so deferring costs nothing structurally). *(Resolves ideation fork #4.)*
- **D3. Setup is explicit and the workbench owns it.** The workbench gains real setup powers — spawn daemons,
  write `.zuzuu/`, edit host settings — surfaced as visible buttons that run the real idempotent verbs. Teaching
  is by-doing; nothing is run secretly (the gate/transparency law).
- **D4. State is observed, not client-asserted.** The daemon reports the home state from the filesystem; the
  client renders it. Idempotent verbs make re-runs safe, so the UI can never drift from reality.
- **D5. "Open a folder" resolves server-side.** A path input + server-side autocomplete, because a browser cannot
  hand a localhost daemon a real server path; the names-only browse route is the minimal surface for it.

## Scope Boundaries

**In scope:** the home-envelope state machine; the onboarding checklist + receipts + git-init gate; the
switcher popover + `⌘O` + "Open a folder" autocomplete; the launcher + init/enable/observe + project-state +
projects-list + dir-autocomplete routes; browser-hops switching.

**Deferred (revisit later):**
- The hub/broker runtime (cloud-era; keep the picker runtime-swappable per R19).
- A full directory-**tree** browser for "Open a folder" (autocomplete is the v1 form).
- Rich per-Project health in the switcher beyond live/pending (e.g. last-activity, module counts).

**Outside this product's identity (not just deferred):**
- Cross-Project roll-up, org-registry, and the tiered control-plane — a different (multi-Project / hosted) product
  layer. The hub fork stays forward-compatible with it, but it is not this work.
- Cloud session waves E–H (infra-gated).
- Any IDE-like behavior — this remains a CRUD-admin over the Project-as-database; the terminal stays the transcript.

## Success Criteria

- **S1.** Opening the workbench on a plain folder presents a guided path to a working Project with **no CLI
  instruction as a dead-end** — every setup step is an in-canvas action.
- **S2.** A user can complete init → enable → first session → first review **without leaving the workbench**, and
  each completed step leaves a visible ✓ receipt.
- **S3.** From any Project, a user can switch to another **recent or running** Project in ≤2 actions (open picker →
  pick), and add a new folder via path + autocomplete.
- **S4.** Switching to an **idle** Project launches its daemon and lands on its workbench without a manual
  terminal step; switching never double-spawns an already-running Project.
- **S5.** The home surface shows the **correct state** for not-a-repo / no-project / hooks-off / no-activity /
  steady, and the same prompt never appears in more than one place at once.
- **S6.** Swapping the switching runtime from hops to a hub later requires **no change to the switcher UX**.

## Open Questions (residual — for planning)

- **Q1.** Token-in-URL on hop: confirm the receiving daemon's existing token→cookie auth makes the hopped URL safe
  to land on directly (it should, per the current auth model) and whether the token should be stripped from the
  visible URL after landing.
- **Q2.** The git-init confirm (R6): inline in the home checklist vs a small confirm step — a UX detail for planning.
- **Q3.** Whether the projects-list (R16) should be served by the current daemon or a tiny always-running helper, so
  the picker works even when the current Project's daemon is the only one up (likely the current daemon suffices,
  since `~/.webcode/` is global).

## Dependencies & Assumptions

- **Built and reused:** the daemon engine + per-workspace instance/recents model (`web/src/server/{cli,config,instance-file}.ts`);
  the idempotent `zz init`/`zz enable` verbs (`src/cli/{init,enable}.mjs`); the daemon's CLI-shelling seam
  (`web/src/server/zuzuu-cli.ts`); the Stage+Wings frame + nav + ribbon (`web/src/client/shell/*`); the
  DataProvider/FieldType/ListContext data spine; the token DS + kit.
- **Assumption (verified this session):** the daemon exposes none of init/enable/observe today; `config.json.recent`
  (deduped, capped-10) and `instances/<sha16>.json` ({root,port,pid,token,version}) already exist; `zz init` never
  runs `git init` and skips existing files; `zz enable` is idempotent and host-respecting.
- **Invariant:** zero runtime deps in the CLI core; the daemon's runtime deps stay the CLI's optionalDependencies.
