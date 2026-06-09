# app/

The durable application — the home for **proven parts harvested from [`../experiments/`](../experiments/)**. Nothing lands here until an experiment has concluded and earned it.

Organized by the design's **be / run / evolve** split ([`docs/DESIGN.md`](../docs/DESIGN.md) §3):

## `faculties/` — "be"

What the agent **is**: the four faculties we own and grow (DESIGN §3①, §5) — **Memory** (episodic: what happened to *me*), **Knowledge** (semantic: what's *true*; substrate ladder `md → relational → graph → vector`), **Actions** (procedural: how to *do* things), **Guardrails** (the membrane; an ordered inspector gate pipeline, pinned in the generation). Cognition / Model / Workspace are **host-owned** and never live here.

**Serving surface (v1, live):** per-project, the faculties are *served* as an on-disk home at `.mns/{knowledge,memory,actions,instructions}/`, scaffolded by `mns init` (git-style; see [experiment-5](../experiments/experiment-5-faculty-home/)). This dir remains the home for the faculties' *implementation* once harvested.

## `runtime/` — "run"

What **serves & bounds** the agent. We do **not** run the agent loop — the host does; the runtime serves faculties to a host we don't run, captures the boundary, and runs the async evolution loop (DESIGN §3②). First harvest target: **host-adapter/** — the observe model (entire.io shape: detect a host, resolve + parse its transcript, normalize to one `Event`; route by capability, never by host name) from Experiment 1's adapters. Later: faculty serving (MCP / filesystem / instruction-file), activation, identity/permissions.

## `evolution/` — "evolve"

What **grows** the agent — the differentiator: `Observability → Evaluation → Generations → Governance` (DESIGN §3③). First harvest target: **observability/** — the typed, append-only, tree-shaped **trace** (Experiment 1's host-agnostic core: `event` / `ids` / `spans` / `otlp`). Later: evaluation (score the trace), generations (pin definitions, flip the active pointer), governance (the async human approval inbox). Everything immutable is a *definition* (pinned); everything else is *runtime* captured here as a trace — "pin definitions, observe data."

---

> **Status: skeleton.** These are homes, not implementations. The first harvest is queued from Experiment 1 (trace capture → `evolution/observability/` + `runtime/host-adapter/`) — see its [README](../experiments/experiment-1-trace-capture/README.md) Conclusions for the harvest list.
