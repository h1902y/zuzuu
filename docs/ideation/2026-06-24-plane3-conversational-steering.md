---
title: "Plane 3 reimagined — conversational steering & the session experience"
date: 2026-06-24
status: ideation (ce-ideate) — ranked ideas; build before documenting
---

# Plane 3 — conversational steering & the session experience

> **The reframe.** Plane 3 isn't "surfaces" — it's the **product experience of using a
> zuzuu directory through a steered conversation**. zuzuu-codes should be the conversation's
> **starter** (open it right), **steerer** (keep it on-scope as modules/notes evolve), and
> **ender** (close it right), so a user just *initiates and ends as recommended* and extracts
> the directory's full potential. The steering config lives in **`project.md`**.
> Goal of this doc: audit → gaps → ranked ideas. **Build comes before documenting Plane 3.**

## What's built vs. missing (the audit)

Grounded in a codebase audit + prior-art research (Claude Code · Codex/AGENTS.md · Cursor ·
aider · Devin Session Insights · context-rot literature · facilitation/coaching/checklist
rituals).

**Built but invisible (plumbing, no experience):**
- **Session = git branch** (`sessions/session-git.mjs`): open→branch, turn→checkpoint, end→squash-merge. Robust, characterization-tested — and *entirely silent*.
- **The hook lifecycle** (`hosts/hook.mjs`): fires open/turn/end across 4 hosts. User sees nothing.
- **The digest** (`serve/digest.mjs`): a per-module note-count + pending-proposals brief, injected to the **agent** at Claude Code `SessionStart` (`additionalContext`) — the **user never sees it**, and other hosts only get a `digest.md` file.

**Missing entirely:**
- **`project.md` carries no steering.** It's `title` + `format` + a static explainer body that *no pipeline ever reads*. No goals, workflow, session policy, or done-when.
- **The Instructions module is never injected.** Notes can accumulate; nothing reads them into a brief or system prompt.
- **No conversation STARTER** — no goal-setting, no recommended opener, no user-visible brief.
- **No conversation ENDER** — close is silent; mined proposals pile up with no nudge.
- **No mid-conversation steering** — nothing detects drift or proposes split/merge/new-module; everything is post-hoc.
- **The workbench composer is a raw remote keyboard** — no project context, no goal, no wrap-up.

The one thing zuzuu is *ahead of the field on*: a session-start brief synthesized from a
project manifest. No other tool does this. The gap is that it's wired to the agent, not the
*experience*, and the manifest it reads is empty of steering.

## The axes (orthogonal surfaces)

**A. Start** (open the conversation right) · **B. Steer** (keep it on-scope as the project
evolves) · **C. End** (close it right) · **D. `project.md` as the steering spine** (the config
+ the injection wiring that A/B/C all read).

---

## Ranked survivors

Each survivor passed critique against zuzuu's invariants: **git-native · human-gated ·
reuses the observe→stage→review→evolve loop · zero-dep · the host is never driven**.

### 1. The steering spine — `project.md` gains a steering section, and it (plus the Instructions module) gets *injected* — **keystone**

*Axis D.* Add a `steering` block to `project.md` (goals · recommended opener · recommended
closer · drift signals · compaction hint) **and wire it in**: the digest brief reads goals +
the opener; the Instructions module's notes are read into the same brief (the missing injection
path). Nothing steers today because there's no config and no injection — **this unblocks 2–4.**
- **Basis:** the audit's #1 and #2 gaps; the prior-art's near-complete `project.md` steering-section design (AGENTS.md sections + Codex Done-when + Cursor out-of-scope).
- **On-thesis:** `project.md`/Instructions are envelopes; injection is just a richer `digest`. Zero-dep, no new entity.
- **Effort:** S–M. **Depends on:** nothing. **Build first.**

### 2. The opener — `zz start`, a user-facing session contract

*Axis A.* A command (and workbench affordance) that reads the steering spine + digest +
pending review and prints a **recommended opener the user confirms as their first message**:
*"Today's focus · files in scope · out-of-scope (parked) · Done-when · what's pending review."*
This is "initiate as recommended." `zz init` becomes interactive enough to seed the first goal.
- **Basis:** Codex's Goal/Context/Constraints/**Done-when**; the WHO surgical pre-op brief; the coaching session-contract.
- **On-thesis:** read-only over the manifest + index; the human still drives the host.
- **Effort:** M. **Depends on:** #1.

### 3. The closer — `zz wrap`, the recommended session-end ritual

*Axis C.* Make `END` an experience: a wrap-up that (a) prompts *"what shipped · what was decided
· what's blocked · next task"* (captured as a Memory episode), (b) **surfaces the mined
proposals** ("N new staged changes — `zz review`"; today they appear silently), and (c) writes
a **handoff brief** that becomes the next session's opener (closing the loop to #2).
- **Basis:** the audit's silent-end gap; ATC handoff + GTD weekly-review + pair-programming close ("what did we learn?").
- **On-thesis:** reuses observe (already runs at END) + writes a Memory note through the gate.
- **Effort:** M. **Depends on:** #1; pairs with #2.

### 4. Self-improving steering — observe proposes updates to `project.md`'s policy

*Axis B/D.* The compounding magic: when `observe` sees a correction the user repeats, it already
routes to Instructions — **extend it to also propose tightening `project.md`'s steering**
("you kept re-stating X as out-of-scope — add it to the drift signals?"). The *steering config
itself evolves through the gate*, so the conversation gets better-steered over time.
- **Basis:** Devin's "improved prompt"/Playbooks; zuzuu's own observe→propose loop.
- **On-thesis:** pure reuse of the loop — `project.md` is just another envelope the loop can stage a change to.
- **Effort:** S (once #1 exists). **Depends on:** #1.

### 5. Module-evolution steering — propose split / merge / new / retire

*Axis B.* The user's explicit ask: modules and notes *evolve* — split, fuse, form, delete.
Extend `observe`/`check` to detect structural pressure (a module grown past a threshold; two
modules with heavy cross-links; an orphaned cluster) and **stage a structural proposal**
(split module · merge modules · new module · deprecate). Reuses the new refactor ops
(`rename`/`merge`) as the *apply* path.
- **Basis:** the user's premise; the loop + the Tier-2 refactor ops already built.
- **On-thesis:** structural changes become staged changes through the same gate; apply via the refactor verbs.
- **Effort:** M–L. **Depends on:** the refactor ops (built); independent of #1.

### 6. Drift steering — the scope contract + a parking lot

*Axis B.* Keep a session on-scope. Start **manual** (`zz steer` — "am I on track?": shows scope
adherence + the parked out-of-scope items), then **automatic** (the TURN hook checks cheap,
zero-LLM drift heuristics from the audit/prior-art — out-of-scope files touched · >3 turns on
the same error · a re-asked question — and emits a *non-blocking* parking-lot note, never a
block). Parked items become #3's next-session task list. Drift signals are read from
`project.md`'s `steering.drift` (provisioned by #1).
- **Basis:** Agile parking-lot; Cursor's "20-message → new chat"; context-rot signals.
- **On-thesis:** the TURN hook stays light (a nudge, never a drive); fail-open like the tool gate.
- **Effort:** M (manual) → L (automatic). **Depends on:** #1 (`steering.drift`) + #2's scope contract. **Tier 2** (riskier — heuristic accuracy; could be noisy).

### 7. Mid-session-drop recovery — resume a dropped conversation, don't lose it

*Axis B/C.* A session can **drop mid-task** — the host crashes, the agent process dies, the
terminal closes, or the user walks away — leaving a leftover `zz/session-*` branch with
**uncommitted in-flight work** and no clean END (so observe never ran, no handoff was written).
The plumbing exists (`sessions/session-git.mjs` `continueSession`/`discardSession`,
`cli/session.mjs` `leftoverWarning`) but as **recovery commands, not an experience**. Make it a
steered moment: on the next session OPEN, **detect the leftover** and offer a clear choice —
*resume* (re-open the dropped branch, restore the last checkpoint + a "here's where you left off"
brief synthesized from the in-flight diff + any #3 handoff) or *discard* — so a dropped
conversation is **recovered, not silently abandoned or silently merged**.
- **Basis:** the audit (leftover-branch plumbing is unsurfaced); ATC handoff (no context carries silently); context-rot literature (decisions live in the scroll → must be externalized to survive a drop).
- **On-thesis:** reuses the checkpoint/branch engine + #3's handoff brief; fail-soft (a drop never corrupts main — checkpoints are on the session branch, squash-merge only on clean END).
- **Effort:** M. **Depends on:** the sessions engine (built) + #3's handoff brief. **Tier 2.**

---

## Rejected / deferred (with reasons)

- **Per-turn steering injection into the agent** — *rejected.* The TURN hook must stay light (checkpoint only); injecting guidance every turn courts noise and context bloat (the gate is deliberately minimal + fail-open). Steering belongs at start/end + a non-blocking nudge, not every turn.
- **Session-health classification (XS–XL, Devin-style)** — *deferred.* Nice signal, low urgency; revisit after the start/steer/end loop exists.
- **A bespoke conversation UI / chat loop in the workbench** — *rejected* (stands against a fixed decision): the composer is a remote keyboard into the host TUI, never a custom chat loop. Steering surfaces *through* the existing composer (a pre-filled opener, a wrap-up affordance), not a new loop.
- **LLM-based drift detection** — *deferred.* Keep #6 zero-LLM/heuristic first (on-thesis: deterministic, zero-dep); an LLM judge is a later, gated enhancement.

## Recommended build sequence

```
#1 steering spine  ──►  #2 opener  ──►  #3 closer ──►(handoff)──► #2
       │                                   │  │
       └──► #4 self-improving steering ◄────┘  └──► #7 mid-session-drop recovery (resume from handoff)
       (independent) #5 module-evolution steering
       (after #1+#2)  #6 drift steering            — Tier 2 (the two resilience/on-track guards)
```

**#1 is the keystone** — until `project.md` carries steering and something *injects* it, there's
no steering at all. Then #2 (start) and #3 (end) are the visible product experience the user
asked for; #4 makes it compound; #5 handles the module-evolution case. The **two resilience
guards** keep a real session healthy: **#6 drift steering** (the conversation goes *off-scope*
while running) and **#7 mid-session-drop recovery** (the conversation *ends abruptly* and must
be resumed, not lost) — both Tier 2, both leaning on the spine (#1) + the closer's handoff (#3).

## Next step

Per the directive — **build before documenting Plane 3.** The natural next move is to
`ce-brainstorm` **idea #1 (the steering spine)** into a precise spec (what fields `project.md`'s
`steering` block holds, the injection wiring through `digest`/`hook`, the Instructions-module
read path), then `ce-plan` → build. #2 and #3 follow immediately on top.
