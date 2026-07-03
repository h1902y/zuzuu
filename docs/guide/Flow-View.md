# Flow — the third projection: a workflow's DAG, and its runs

`zz host web` renders every Project as [**Table** · **Map** · **Flow**](The-World) — one continuous space, three ways of reading it. Table shows notes as rows, Map shows them as a living force graph, and **Flow** shows a `type: workflow` note's `steps:` as a topological left→right diagram, with its **runs** (`type: run` notes, the durable-runner's state machines — see [Workflows](Workflows)) overlaid live on top.

*(§I rung 5 — "Zus that run: the self-correcting DAG" — the moat, in the DAG.)*

## Getting there

- The header's three-way toggle: **Table · Map · Flow**. Flow is greyed out with a tooltip ("no workflows yet") until the Project has at least one `type: workflow` note.
- The palette: `>flow` — opens the workflow already in context (a selected workflow note), or **Flow home** (a picker of every workflow) otherwise.
- **Selecting a workflow note anywhere** — a map click, a table row, in Everything or a module's own table — focuses Flow on it directly instead of the ordinary note/record surface. A workflow's DAG is a more useful reading than its flat frontmatter.

## The DAG (the "Editor" / DEFINITION view)

Steps lay out **left→right by dependency layer** — never force physics; a workflow's step order is meaning, not a random walk. A step renders as one of three glyphs, the same closed vocabulary the durable runner enforces (`src/grow/run.mjs`):

- **run** — an inline shell command (▷).
- **note** — a reference to another runnable note, `module:id` (🔗) — composition, same rule Tier-0/1 use.
- **wait** — a pause on a named signal (⧗), badged with what it's waiting on. Waits are first-class nodes here, not folded into an edge label (§I.4, n8n's "send and wait").

A step's own `compensate:` command renders as a **detached node** below it, connected by a dashed edge (the Retool pattern — failure routes stay untangled from the happy path) rather than folded into the step itself. A step marked `irreversible: true` carries a small lock badge — the saga honestly **stops** at it on rollback rather than pretending to undo something that can't be undone (see [Workflows](Workflows)).

## Executions (the run overlay)

The right sidebar lists every run of the focused workflow — id, status, started (relative time), and progress (`n/total done`). Each row also carries a compact per-step colored strip (idle/running/done/failed/waiting), the runs×steps state matrix (§I.4, Airflow's Grid view) condensed to fit the sidebar.

**Selecting a run overlays its live state onto the SAME DAG**: node rings turn idle → running → done (green) / failed (red) / waiting (amber); a waiting step's badge switches from the definition's static signal name to the run's actual `waiting_on`; a compensation node that fired during that run's saga is labeled "compensated" (or "compensate failed") instead of the idle "compensate". The header line above the canvas summarizes the focused run — status, progress, and (on a waiting/failed run) what it's blocked on or where it broke.

## It's live — the same push the map uses

A run advancing (`zz run advance`, `zz run signal`, a trigger firing) is a note write like any other — the daemon's brain-state push (`/ws/zuzuu`) already watches every module's `items/` dir project-wide and invalidates the workbench's `["zuzuu"]` queries the moment a run note changes. Flow's queries live under that same key, so **watching a run advance needs no bespoke wiring** — the exact mechanism that makes ghost nodes appear on the map makes a selected run's rings update mid-conversation, with zero manual refresh.

## Scope (read-only, this pass)

Flow is a **reading** surface: no run-control buttons (advance/signal/complete are `zz run …` or a later pass) and no canvas editing (a workflow's `steps:` change through the omnibar/gate, never by dragging a node). Not in this pass, honestly noted:

- **Trigger blast-radius preview** (§I.4's Apollo pattern) — `type: trigger` notes are a separate rung; nothing to preview yet in a project without one.
- **Ghost edges for a staged workflow-edit proposal** — deferred; today only the workflow's LANDED `steps:` render.
- **A Gantt latency timeline** — the Grid strip covers run *state*; a per-run duration timeline is a later pass.
- **Animated replay of a run's traversal** — the run note's `completed_order` is there for it; this pass shows live overlay only, not a scrubber ("replay a run's traversal like the biography" is the named future shape).

## The data underneath

`GET /api/zuzuu/flow` — every `type: workflow` note project-wide (composes the existing unified-table read, `module items --all --type workflow`), joined with the `runs` module grouped by each run's `workflow` field, for the picker's run-count/latest-status summary. A focused workflow's own steps come from the existing single-item read (`GET /api/zuzuu/module/:key/item/:id`); its runs from the existing per-module read with a `where=workflow=<addr>` filter (`GET /api/zuzuu/module/runs?where=…`) — no bespoke CLI verb needed for either. See [Daemon & API](Daemon-API).
