---
title: "The steering spine — project.md steering + the session-brief injection path"
date: 2026-06-24
status: requirements (ce-brainstorm) — ready for ce-plan
---

# The steering spine

> **The keystone of Plane 3.** Give `project.md` a human-authored `steering` block, and
> finally **inject** it (plus the Instructions module's grown notes) into the per-session
> brief. Today nothing steers because there is no steering config and no injection path —
> this unblocks the opener (#2), closer (#3), self-improving steering (#4), and drift (#6).
> Source: `docs/ideation/2026-06-24-plane3-conversational-steering.md`, idea #1.

## Problem

Audited, verified against the repo:
- **`project.md` carries no steering.** It is `{type, title, format}` + a static explainer body. `readProject` (`src/notes/project.mjs`) reads only `title` + `body`; the body is read by **no pipeline**.
- **The Instructions module is never injected.** Its template + the `observe` correction-route exist, but no path reads its notes into a brief or system prompt.
- **The session brief reaches the agent but carries no directive.** `digestText` (`src/serve/digest.mjs`) emits per-module note counts + pending-review counts, injected at Claude Code `SessionStart` via `additionalContext` (`src/hosts/hook.mjs`) and written to `digest.md` for all hosts. It tells the agent *what's been learned*, never *what we're working on or how to work here*.

## What we're building

1. A `steering` block in `project.md` (human-authored, pinned).
2. `readProject` exposes it.
3. The session brief (`digestText`) folds in **the project's goals + the Instructions module's notes** — the injection path — staying deterministic, zero-network, and lean.

It is *extend an existing capability* (the digest), not a new entity or surface.

## Decisions (resolved this brainstorm)

- **Two distinct steering sources.** `project.md.steering` = the **pinned, human-authored session contract**; the **Instructions module** = **loop-grown** standing guidance (the corrections `observe` mines). Both fold into the brief; they stay distinct — *pin definitions, observe data*.
- **Schema = named fields, prose values.** `steering:` is a small map whose keys are machine-addressable (so the later opener reads `opener`, drift reads `drift`) but whose values are human prose/lists — not a free-text blob, not a fully-typed schema.

## Requirements

**R1 — the `steering` block.** `project.md` gains an optional frontmatter map `steering:` with named keys, each a short prose string or list:
- `goals` — what this Project/repo is for (the standing intent).
- `opener` — the recommended way to begin a session (prose; prior-art shape: Goal · Context · Constraints · **Done-when**).
- `closer` — the recommended way to end a session (prose; e.g. "summarize what shipped · decisions · blockers · next task").
- `drift` — signals that the conversation is going off-scope (a prose list; e.g. "touching files outside the task", ">3 turns on the same error").

All keys optional; an absent `steering` (or absent key) degrades silently to today's behavior. Authored by hand (a plain envelope), so it round-trips and is git-tracked like any note.

**R2 — read path.** `readProject` returns `steering` alongside `title`/`body` (tolerant: missing → `{}`/null). No other reader of `project.md` changes.

**R3 — the injection (the spine).** Extend the session brief (`digestText`) to fold in, in addition to today's counts:
- the project's `steering.goals` (so the agent opens knowing the standing intent), and
- the **Instructions module's notes** (the grown standing guidance), read via the existing `query` path.

The brief continues to be injected by the existing two routes (Claude `additionalContext` + the `digest.md` file) — no host is driven; this is grounding, not control.

**R4 — leanness budget.** The folded-in guidance is **capped** so the brief stays small (prior art: keep always-loaded steering well under ~200 lines / a few hundred tokens). The Instructions notes are selected top-N (by score/recency) and truncated to a line/char budget; `goals` is short by construction. The brief must never balloon a session's context.

**R5 — determinism preserved.** The brief stays **zero-network, zero-LLM, deterministic** (no model call, no ranking beyond the index's existing order). Same input → same brief.

**R6 — graceful for every state.** Empty Project (only guardrails, no `steering`, no Instructions) → today's brief, unchanged. Non-Claude hosts → the `digest.md` file carries the same content as Claude's `additionalContext` (parity via the one `digestText`).

## Scope boundaries

**Out of scope (separate ideas — this is only the schema + the injection):**
- The user-facing **opener** command `zz start` and the **closer** `zz wrap` (ideas #2/#3) — they *consume* `steering.opener`/`closer`, built next on top of this.
- **Self-improving steering** — `observe` proposing edits to `project.md.steering` through the gate (idea #4).
- **Drift detection / parking lot** (idea #6) — consumes `steering.drift`, built later.
- **Mid-session-drop recovery** (idea #7) — the resilience guard for a session that crashes/drops mid-task (resume vs discard from the leftover branch); reuses the sessions engine + #3's handoff, built later.
- Any **workbench** steering surface.
- Module-evolution proposals (idea #5).

**Assumptions:**
- `project.md.steering` is **operator-hand-edited** for v1 (it's the pinned human contract — a plain file the human owns). Loop-proposed tightening is idea #4, deferred. *(If the team later wants steering edits gated through the loop, that's #4, not this.)*
- The Instructions module read uses the existing `query`/index path; no new capability.

## Success criteria

- A repo with a hand-written `project.md.steering` block opens a session whose brief (Claude `additionalContext` and `digest.md`) contains the project goals + the Instructions notes, within the leanness budget.
- A repo with no `steering` and no Instructions notes produces today's brief byte-for-byte (no regression).
- `readProject` round-trips `steering` (parse ∘ serialize identity); the index/guardrails/observe paths are unaffected.
- The brief remains deterministic and zero-network (a characterization test pins it).

## Outstanding questions (for ce-plan)

- The exact leanness budget (line/char cap; top-N for Instructions notes).
- Whether `goals` should also seed the digest's title line or stay a separate brief section.
- Final key names (`goals`/`opener`/`closer`/`drift`) and whether to nest opener sub-parts now or keep prose (default: prose now).

## Handoff

→ `ce-plan` this requirements doc. The build is small and contained: `src/notes/project.mjs`
(read `steering`), `src/cli/init.mjs` (seed an example `steering` block, optional), `src/serve/digest.mjs`
(fold goals + Instructions notes, capped), and characterization tests for the no-regression +
determinism criteria. Then ideas #2/#3 stack directly on `steering.opener`/`closer`.
